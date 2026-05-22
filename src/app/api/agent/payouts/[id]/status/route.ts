import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { applyAgentLedgerForTransactionStatusChange } from "@/lib/agent-ledger";
import { pool } from "@/lib/db";
import { paymentImageDbLimitMessage, paymentImageExceedsDbLimit } from "@/lib/payment-image-db-limit";
import { agentPayoutApproveDelayViolation } from "@/lib/payout-agent-approve-delay";
import { canAgentTransition } from "@/lib/payout-lifecycle";
import { DISPUTE_BLOCKS_ACTION_MSG, isOpenDispute } from "@/lib/dispute";
import { emitTransactionRealtime } from "@/lib/realtime/broadcast-transaction";
import { requireAgentSession } from "@/lib/require-agent-api";

type TxRow = RowDataPacket & {
  id: number;
  status: string;
  payment_image: string | null;
  amount: string | number;
  assigned_agent_id: number | null;
  assigned_date: Date | string | null;
  dispute_raised: number;
  dispute_state: string | null;
};

function num(v: string | number): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export async function PATCH(req: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  const auth = await requireAgentSession();
  if (!auth.ok) return auth.response;

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

  if (paymentImage && paymentImageExceedsDbLimit(paymentImage)) {
    return NextResponse.json({ ok: false, error: paymentImageDbLimitMessage() }, { status: 400 });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let rows: TxRow[];
    try {
      const [r] = await conn.execute<TxRow[]>(
        `SELECT \`id\`, \`status\`, \`payment_image\`, \`amount\`, \`assigned_agent_id\`, \`assigned_date\`, \`dispute_raised\`, \`dispute_state\`
         FROM \`transactions\`
         WHERE \`id\` = ? AND \`type\` = 'PAYOUT' AND \`assigned_agent_id\` = ?
         LIMIT 1 FOR UPDATE`,
        [txId, auth.agentId],
      );
      rows = r;
    } catch {
      const [r] = await conn.execute<TxRow[]>(
        `SELECT \`id\`, \`status\`, \`payment_image\`, \`amount\`, \`assigned_agent_id\`, \`assigned_date\`, \`dispute_raised\`
         FROM \`transactions\`
         WHERE \`id\` = ? AND \`type\` = 'PAYOUT' AND \`assigned_agent_id\` = ?
         LIMIT 1 FOR UPDATE`,
        [txId, auth.agentId],
      );
      rows = r.map((row) => ({ ...row, dispute_state: null }));
    }
    const tx = rows[0];
    if (!tx) {
      await conn.rollback();
      return NextResponse.json({ ok: false, error: "Payout not found for this agent" }, { status: 404 });
    }

    if (isOpenDispute(tx.dispute_state, tx.dispute_raised)) {
      await conn.rollback();
      return NextResponse.json({ ok: false, error: DISPUTE_BLOCKS_ACTION_MSG }, { status: 409 });
    }

    if (tx.status === "EXPIRED" && toStatus === "APPROVED_BY_AGENT") {
      toStatus = "EXPIRED_APPROVED_BY_AGENT";
    }

    if (!canAgentTransition(tx.status, toStatus)) {
      await conn.rollback();
      return NextResponse.json(
        { ok: false, error: `Invalid status change from ${tx.status} to ${toStatus}` },
        { status: 409 },
      );
    }

    const delayHit = agentPayoutApproveDelayViolation(tx.status, toStatus, tx.assigned_date);
    if (delayHit.blocked) {
      await conn.rollback();
      return NextResponse.json(
        {
          ok: false,
          error: `Approve is available after assignment cooling period (${delayHit.waitMinutes} min). Try again after ${delayHit.retryAfterIso}.`,
          retryAfterIso: delayHit.retryAfterIso,
        },
        { status: 429 },
      );
    }

    const existingProof = String(tx.payment_image ?? "").trim().length > 0;
    const proofToStore = paymentImage || (existingProof ? String(tx.payment_image ?? "").trim() : "");
    if ((toStatus === "APPROVED_BY_AGENT" || toStatus === "EXPIRED_APPROVED_BY_AGENT") && !proofToStore) {
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
    params.push(txId, auth.agentId, tx.status);

    const [res] = await conn.execute<ResultSetHeader>(
      `UPDATE \`transactions\` SET ${setParts.join(", ")}
       WHERE \`id\` = ? AND \`assigned_agent_id\` = ? AND \`type\` = 'PAYOUT' AND \`status\` = ?`,
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
