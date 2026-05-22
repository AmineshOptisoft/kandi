import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import {
  parseSpeedpayWebhook,
  readWebhookSignature,
  verifySpeedpayWebhookSignature,
  webhookToInternalStatus,
} from "@/lib/integrations/speedpay/webhook";
import { applyAgentLedgerForTransactionStatusChange } from "@/lib/agent-ledger";
import { emitTransactionRealtime } from "@/lib/realtime/broadcast-transaction";

type TxRow = RowDataPacket & {
  id: number;
  status: string;
  amount: string | number;
  assigned_agent_id: number | null;
};

const TERMINAL = new Set([
  "APPROVED",
  "APPROVED_BY_ADMIN",
  "APPROVED_BY_AGENT",
  "EXPIRED_APPROVED_BY_ADMIN",
  "EXPIRED_APPROVED_BY_AGENT",
  "REJECTED",
  "EXPIRED",
  "REVOKED",
]);

function nextFromAllowed(current: string, next: string): boolean {
  const now = String(current || "").toUpperCase();
  const nxt = String(next || "").toUpperCase();
  if (!now) return true;
  if (TERMINAL.has(now)) return now === nxt;
  return true;
}

function num(v: string | number): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = readWebhookSignature(req);

  if (!(await verifySpeedpayWebhookSignature(raw, signature))) {
    return NextResponse.json({ success: false, message: "Invalid signature" }, { status: 401 });
  }

  const body = parseSpeedpayWebhook(raw);
  const payoutId = body.data?.id;
  const transactionNumber = String(body.data?.transaction_number || "").trim();
  const referenceNumber = body.data?.reference_number ? String(body.data.reference_number).trim() : "";
  const reason = body.data?.reason ? String(body.data.reason).trim() : "";

  if (!transactionNumber && (!payoutId || payoutId < 1)) {
    return NextResponse.json({ success: false, message: "transaction_number or data.id is required" }, { status: 400 });
  }

  const internalStatus = webhookToInternalStatus(body);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let rows: TxRow[];
    if (payoutId && payoutId > 0) {
      [rows] = await conn.execute<TxRow[]>(
        "SELECT `id`, `status`, `amount`, `assigned_agent_id` FROM `transactions` WHERE `type`='PAYOUT' AND `id`=? LIMIT 1 FOR UPDATE",
        [payoutId],
      );
    } else {
      [rows] = await conn.execute<TxRow[]>(
        "SELECT `id`, `status`, `amount`, `assigned_agent_id` FROM `transactions` WHERE `type`='PAYOUT' AND `order_id`=? LIMIT 1 FOR UPDATE",
        [transactionNumber],
      );
    }

    const tx = rows[0];
    if (!tx) {
      await conn.rollback();
      return NextResponse.json({ success: true, message: "Ignored: payout transaction not found" });
    }

    if (!nextFromAllowed(tx.status, internalStatus)) {
      await conn.rollback();
      return NextResponse.json({ success: true, message: "Ignored: illegal transition" });
    }

    // Apply ledger status transition for payout
    await applyAgentLedgerForTransactionStatusChange(conn, {
      assignedAgentId: tx.assigned_agent_id,
      txType: "PAYOUT",
      fromStatus: tx.status,
      toStatus: internalStatus,
      amount: num(tx.amount),
    });

    const setParts: string[] = ["`status` = ?"];
    const params: any[] = [internalStatus];

    if (referenceNumber) {
      setParts.push("`utr_code` = COALESCE(NULLIF(?, ''), `utr_code`)");
      params.push(referenceNumber);
    }
    if (reason) {
      setParts.push("`dispute_reason` = ?");
      params.push(reason);
    }

    params.push(tx.id);

    const [updateRes] = await conn.execute<ResultSetHeader>(
      `UPDATE \`transactions\`
       SET ${setParts.join(", ")}
       WHERE \`id\` = ?`,
      params,
    );

    await conn.commit();

    emitTransactionRealtime(tx.id, "status");

    // Dispatch outbound webhook to merchant
    try {
      const { sendPayoutWebhookForTxStatusChange } = await import("@/lib/integrations/speedpay/outbound-payout-webhook");
      void sendPayoutWebhookForTxStatusChange(tx.id, internalStatus);
    } catch (e) {
      console.error("Failed to trigger outbound webhook on inbound speedpay update:", e);
    }

    return NextResponse.json({
      success: true,
      message: "Webhook processed",
      updated: updateRes.affectedRows > 0,
      txId: tx.id,
    });

  } catch (e) {
    await conn.rollback();
    console.error("Inbound payout webhook processing failed:", e);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  } finally {
    conn.release();
  }
}
