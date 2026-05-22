import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import {
  readWebhookSignature,
  verifySpeedpayWebhookSignature,
  webhookToInternalStatus,
  parseAndVerifyPayinWebhook,
} from "@/lib/integrations/speedpay/webhook";

type TxRow = RowDataPacket & {
  id: number;
  status: string;
};

const TERMINAL = new Set(["APPROVED", "APPROVED_BY_ADMIN", "APPROVED_BY_AGENT", "EXPIRED_APPROVED_BY_ADMIN", "EXPIRED_APPROVED_BY_AGENT", "REJECTED", "EXPIRED", "REVOKED"]);

function nextFromAllowed(current: string, next: string): boolean {
  const now = String(current || "").toUpperCase();
  const nxt = String(next || "").toUpperCase();
  if (!now) return true;
  if (TERMINAL.has(now)) return now === nxt;
  return true;
}

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = readWebhookSignature(req);

  const body = await parseAndVerifyPayinWebhook(req, raw);
  console.log("[Speedpay Webhook] Request body:", JSON.stringify(body));
  if (!body) {
    return NextResponse.json({ success: false, message: "Invalid signature or webhook payload" }, { status: 401 });
  }

  const payinId = body.data?.id;
  const transactionNumber = String(body.data?.transaction_number || "").trim();
  const referenceNumber = body.data?.reference_number ? String(body.data.reference_number).trim() : "";
  const image = body.data?.image ? String(body.data.image).trim() : "";
  const noteStr = (body.note ?? body.data?.note) as string | undefined;

  if (!transactionNumber && (!payinId || payinId < 1)) {
    // Accept payloads that only contain a note with company ID (e.g., "company:15|...")
    // if (noteStr) {
    //   console.log("[Speedpay Webhook] No IDs but note present – accepting webhook");
    //   return NextResponse.json({ success: true, message: "Webhook processed (no transaction ID)" });
    // }
    return NextResponse.json({ success: false, message: "transaction_number or data.id is required" }, { status: 400 });
  }

  const internalStatus = webhookToInternalStatus(body);

  let rows: TxRow[];
  if (payinId && payinId > 0) {
    [rows] = await pool.execute<TxRow[]>(
      "SELECT `id`, `status` FROM `transactions` WHERE `type`='PAYIN' AND `id`=? LIMIT 1",
      [payinId],
    );
  } else {
    [rows] = await pool.execute<TxRow[]>(
      "SELECT `id`, `status` FROM `transactions` WHERE `type`='PAYIN' AND `order_id`=? LIMIT 1",
      [transactionNumber],
    );
  }

  const tx = rows[0];
  if (!tx) {
    return NextResponse.json({ success: true, message: "Ignored: transaction not found" });
  }

  if (!nextFromAllowed(tx.status, internalStatus)) {
    return NextResponse.json({ success: true, message: "Ignored: illegal transition" });
  }

  const [updateRes] = await pool.execute<ResultSetHeader>(
    `UPDATE \`transactions\`
     SET \`status\` = ?,
         \`utr_code\` = COALESCE(NULLIF(?, ''), \`utr_code\`),
         \`payment_image\` = COALESCE(NULLIF(?, ''), \`payment_image\`)
     WHERE \`id\` = ?`,
    [internalStatus, referenceNumber, image, tx.id],
  );

  return NextResponse.json({
    success: true,
    message: "Webhook processed",
    updated: updateRes.affectedRows > 0,
    txId: tx.id,
  });
}
