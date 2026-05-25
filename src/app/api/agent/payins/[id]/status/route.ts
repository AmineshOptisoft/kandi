import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { applyAgentLedgerForTransactionStatusChange } from "@/lib/agent-ledger";
import { pool } from "@/lib/db";
import { paymentImageDbLimitMessage, paymentImageExceedsDbLimit } from "@/lib/payment-image-db-limit";
import { persistPaymentProofImage } from "@/lib/payment-proof-storage";
import { DISPUTE_BLOCKS_ACTION_MSG, isOpenDispute } from "@/lib/dispute";
import { emitTransactionRealtime } from "@/lib/realtime/broadcast-transaction";
import { sendPayinWebhookForTxStatusChange } from "@/lib/integrations/speedpay/outbound-webhook";
import { canAgentVerifyPayIn } from "@/lib/payin-lifecycle";
import { requireAgentSession } from "@/lib/require-agent-api";

type TxRow = RowDataPacket & {
  id: number;
  status: string;
  payment_image: string | null;
  amount: string | number;
  assigned_agent_id: number | null;
  dispute_raised: number;
  dispute_state: string | null;
};

function num(v: string | number): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function isValidUtrCode(v: string): boolean {
  // IMPS = 12 digits, UPI ref = 12 digits, NEFT RRN = 16 digits, some RTGS = 22 digits
  return /^\d{12,22}$/.test(v);
}

export async function PATCH(req: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  const auth = await requireAgentSession();
  if (!auth.ok) return auth.response;

  const { id: idRaw } = await Promise.resolve(context.params);
  const txId = Number(idRaw);
  if (!Number.isInteger(txId) || txId < 1) {
    return NextResponse.json({ ok: false, error: "Invalid payin id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  let toStatus = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
  const utrCode = typeof body.utr_code === "string" ? body.utr_code.trim() : "";
  const paymentImage = typeof body.payment_image === "string" ? body.payment_image.trim() : "";
  if (!toStatus) {
    return NextResponse.json({ ok: false, error: "status is required" }, { status: 400 });
  }

  if (paymentImage && paymentImageExceedsDbLimit(paymentImage)) {
    return NextResponse.json({ ok: false, error: paymentImageDbLimitMessage() }, { status: 400 });
  }

  const storedPaymentImage = paymentImage ? await persistPaymentProofImage(paymentImage, txId) : "";

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let rows: TxRow[];
    try {
      const [r] = await conn.execute<TxRow[]>(
        `SELECT \`id\`, \`status\`, \`payment_image\`, \`amount\`, \`assigned_agent_id\`, \`dispute_raised\`, \`dispute_state\`
         FROM \`transactions\`
         WHERE \`id\` = ? AND \`type\` = 'PAYIN' AND \`assigned_agent_id\` = ?
         LIMIT 1 FOR UPDATE`,
        [txId, auth.agentId],
      );
      rows = r;
    } catch {
      const [r] = await conn.execute<TxRow[]>(
        `SELECT \`id\`, \`status\`, \`payment_image\`, \`amount\`, \`assigned_agent_id\`, \`dispute_raised\`
         FROM \`transactions\`
         WHERE \`id\` = ? AND \`type\` = 'PAYIN' AND \`assigned_agent_id\` = ?
         LIMIT 1 FOR UPDATE`,
        [txId, auth.agentId],
      );
      rows = r.map((row) => ({ ...row, dispute_state: null }));
    }
    const tx = rows[0];
    if (!tx) {
      await conn.rollback();
      return NextResponse.json({ ok: false, error: "PayIn not found for this agent" }, { status: 404 });
    }
    const fromStatus = String(tx.status ?? "").trim().toUpperCase();

    if (isOpenDispute(tx.dispute_state, tx.dispute_raised)) {
      await conn.rollback();
      return NextResponse.json({ ok: false, error: DISPUTE_BLOCKS_ACTION_MSG }, { status: 409 });
    }

    if (fromStatus === "EXPIRED" && toStatus === "APPROVED_BY_AGENT") {
      toStatus = "EXPIRED_APPROVED_BY_AGENT";
    }

    if (!canAgentVerifyPayIn(fromStatus, toStatus)) {
      await conn.rollback();
      return NextResponse.json(
        { ok: false, error: `Invalid status change from ${fromStatus || "UNKNOWN"} to ${toStatus}` },
        { status: 409 },
      );
    }

    const existingProof = String(tx.payment_image ?? "").trim().length > 0;
    const proofToStore = storedPaymentImage || (existingProof ? String(tx.payment_image ?? "").trim() : "");
    if ((toStatus === "APPROVED_BY_AGENT" || toStatus === "EXPIRED_APPROVED_BY_AGENT") && !isValidUtrCode(utrCode)) {
      await conn.rollback();
      return NextResponse.json({ ok: false, error: "UTR/RRN must be between 12 and 22 digits for approval." }, { status: 400 });
    }
    if ((toStatus === "APPROVED_BY_AGENT" || toStatus === "EXPIRED_APPROVED_BY_AGENT") && !proofToStore) {
      await conn.rollback();
      return NextResponse.json(
        { ok: false, error: "Upload proof (screenshot) or ensure payer proof exists before approving." },
        { status: 400 },
      );
    }

    await applyAgentLedgerForTransactionStatusChange(conn, {
      assignedAgentId: tx.assigned_agent_id,
      txType: "PAYIN",
      fromStatus: tx.status,
      toStatus,
      amount: num(tx.amount),
    });

    const setParts: string[] = ["`status` = ?"];
    const params: unknown[] = [toStatus];
    setParts.push("`utr_code` = COALESCE(NULLIF(?, ''), `utr_code`)");
    params.push(utrCode);
    if (storedPaymentImage) {
      setParts.push("`payment_image` = ?");
      params.push(storedPaymentImage);
    }
    params.push(txId, auth.agentId, tx.status);

    const [res] = await conn.execute<ResultSetHeader>(
      `UPDATE \`transactions\` SET ${setParts.join(", ")}
       WHERE \`id\` = ? AND \`assigned_agent_id\` = ? AND \`type\` = 'PAYIN' AND \`status\` = ?`,
      params as (string | number)[],
    );
    if (res.affectedRows === 0) {
      await conn.rollback();
      return NextResponse.json({ ok: false, error: "Could not update payin status" }, { status: 500 });
    }

    await conn.commit();
    emitTransactionRealtime(txId, "status");
    const rejectReason =
      typeof body.reason === "string"
        ? body.reason.trim()
        : typeof body.reject_reason === "string"
          ? body.reject_reason.trim()
          : undefined;
    void sendPayinWebhookForTxStatusChange(txId, toStatus, rejectReason);
  } catch (e) {
    await conn.rollback();
    console.error(e);
    return NextResponse.json({ ok: false, error: "Could not update payin (ledger or status conflict)" }, { status: 500 });
  } finally {
    conn.release();
  }

  return NextResponse.json({ ok: true as const, status: toStatus });
}
