import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { applyAgentLedgerForTransactionStatusChange } from "@/lib/agent-ledger";
import { pool } from "@/lib/db";
import { paymentImageDbLimitMessage, paymentImageExceedsDbLimit } from "@/lib/payment-image-db-limit";
import { DISPUTE_BLOCKS_ACTION_MSG, isOpenDispute } from "@/lib/dispute";
import { emitTransactionRealtime } from "@/lib/realtime/broadcast-transaction";
import { requireAdminPermission } from "@/lib/require-admin-api";

type TxRow = RowDataPacket & {
  id: number;
  status: string;
  payment_image: string | null;
  amount: string | number;
  assigned_agent_id: number | null;
  dispute_raised: number;
  dispute_state: string | null;
};

const ADMIN_ALLOWED_FROM: Record<string, Set<string>> = {
  APPROVED_BY_ADMIN: new Set(["PAID", "PENDING", "RE_ASSIGNED", "EXPIRED"]),
  EXPIRED_APPROVED_BY_ADMIN: new Set(["EXPIRED"]),
  REJECTED: new Set(["PAID", "PENDING", "RE_ASSIGNED", "EXPIRED"]),
  RE_ASSIGNED: new Set(["PAID", "PENDING", "EXPIRED"]),
  REVOKED: new Set(["PAID", "PENDING", "RE_ASSIGNED", "EXPIRED"]),
};

function canAdminTransitionPayout(from: string, to: string): boolean {
  const set = ADMIN_ALLOWED_FROM[to];
  if (!set) return false;
  return set.has(String(from ?? "").trim().toUpperCase());
}

function num(v: string | number): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export async function PATCH(req: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  const { id: idRaw } = await Promise.resolve(context.params);
  const txId = Number(idRaw);
  if (!Number.isInteger(txId) || txId < 1) {
    return NextResponse.json({ ok: false, error: "Invalid payout id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  let toStatus = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
  const paymentImage = typeof body.payment_image === "string" ? body.payment_image.trim() : "";
  if (!toStatus) {
    return NextResponse.json({ ok: false, error: "status is required" }, { status: 400 });
  }

  let requiredPermission: "approve_payouts" | "reject_payouts" | "update_status_payouts" = "update_status_payouts";
  if (toStatus === "APPROVED_BY_ADMIN" || toStatus === "EXPIRED_APPROVED_BY_ADMIN") {
    requiredPermission = "approve_payouts";
  } else if (toStatus === "REJECTED") {
    requiredPermission = "reject_payouts";
  }

  const auth = await requireAdminPermission(requiredPermission);
  if (!auth.ok) return auth.response;

  if (paymentImage && paymentImageExceedsDbLimit(paymentImage)) {
    return NextResponse.json({ ok: false, error: paymentImageDbLimitMessage() }, { status: 400 });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let rows: TxRow[];
    try {
      const [r] = await conn.execute<TxRow[]>(
        `SELECT \`id\`, \`status\`, \`payment_image\`, \`amount\`, \`assigned_agent_id\`, \`dispute_raised\`, \`dispute_state\`
         FROM \`transactions\`
         WHERE \`id\` = ? AND \`type\` = 'PAYOUT'
         LIMIT 1 FOR UPDATE`,
        [txId],
      );
      rows = r;
    } catch {
      const [r] = await conn.execute<TxRow[]>(
        `SELECT \`id\`, \`status\`, \`payment_image\`, \`amount\`, \`assigned_agent_id\`, \`dispute_raised\`
         FROM \`transactions\`
         WHERE \`id\` = ? AND \`type\` = 'PAYOUT'
         LIMIT 1 FOR UPDATE`,
        [txId],
      );
      rows = r.map((row) => ({ ...row, dispute_state: null }));
    }
    const tx = rows[0];
    if (!tx) {
      await conn.rollback();
      return NextResponse.json({ ok: false, error: "PayOut not found" }, { status: 404 });
    }

    if (isOpenDispute(tx.dispute_state, tx.dispute_raised)) {
      await conn.rollback();
      return NextResponse.json({ ok: false, error: DISPUTE_BLOCKS_ACTION_MSG }, { status: 409 });
    }

    if (tx.status === "EXPIRED" && toStatus === "APPROVED_BY_ADMIN") {
      toStatus = "EXPIRED_APPROVED_BY_ADMIN";
    }

    if (!canAdminTransitionPayout(tx.status, toStatus)) {
      await conn.rollback();
      return NextResponse.json(
        { ok: false, error: `Invalid status change from ${tx.status} to ${toStatus}` },
        { status: 409 },
      );
    }

    const existingProof = String(tx.payment_image ?? "").trim().length > 0;
    const proofToStore = paymentImage || (existingProof ? String(tx.payment_image ?? "").trim() : "");
    if ((toStatus === "APPROVED_BY_ADMIN" || toStatus === "EXPIRED_APPROVED_BY_ADMIN") && !proofToStore) {
      await conn.rollback();
      return NextResponse.json(
        { ok: false, error: "Upload proof (screenshot) before approving this payout." },
        { status: 400 },
      );
    }

    await applyAgentLedgerForTransactionStatusChange(conn, {
      assignedAgentId: tx.assigned_agent_id,
      txType: "PAYOUT",
      fromStatus: tx.status,
      toStatus,
      amount: num(tx.amount),
    });

    const setParts: string[] = ["`status` = ?"];
    const params: unknown[] = [toStatus];
    if (paymentImage) {
      setParts.push("`payment_image` = ?");
      params.push(paymentImage);
    }
    params.push(txId, tx.status);

    const [res] = await conn.execute<ResultSetHeader>(
      `UPDATE \`transactions\` SET ${setParts.join(", ")} WHERE \`id\` = ? AND \`type\` = 'PAYOUT' AND \`status\` = ?`,
      params as (string | number)[],
    );
    if (res.affectedRows === 0) {
      await conn.rollback();
      return NextResponse.json({ ok: false, error: "Could not update payout status" }, { status: 500 });
    }

    await conn.commit();
    emitTransactionRealtime(txId, "status");

    // Dispatch outbound webhook to merchant
    try {
      const { sendPayoutWebhookForTxStatusChange } = await import("@/lib/integrations/speedpay/outbound-payout-webhook");
      void sendPayoutWebhookForTxStatusChange(txId, toStatus);
    } catch (e) {
      console.error("Failed to trigger outbound webhook status update:", e);
    }
  } catch (e) {
    await conn.rollback();
    console.error(e);
    return NextResponse.json({ ok: false, error: "Could not update payout (ledger or status conflict)" }, { status: 500 });
  } finally {
    conn.release();
  }

  return NextResponse.json({ ok: true as const, status: toStatus });
}
