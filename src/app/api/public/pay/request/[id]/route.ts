import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import { payInDisplayStatus, publicPayInDisplayMethod, sqlFieldToUtf8 } from "@/lib/payin-lifecycle";
import { isMysqlPacketTooLarge, validatePaymentProofPayload } from "@/lib/payment-proof-limits";
import { persistPaymentProofImage } from "@/lib/payment-proof-storage";
import { emitTransactionRealtime } from "@/lib/realtime/broadcast-transaction";
import { sendPayinWebhookForTx } from "@/lib/integrations/speedpay/outbound-webhook";
import { expireOpenRequestsPastDeadline } from "@/lib/request-expiry";
import { fetchSpeedpayPayinStatus } from "@/lib/integrations/speedpay/controller";

type TxRow = RowDataPacket & {
  id: number;
  order_id: string;
  amount: string | number;
  status: string;
  client_name: string | null;
  client_upi: string | null;
  assigned_upi: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  ifsc_code: string | null;
  utr_code: string | null;
  payment_image: string | null;
  pay_method_id: number | null;
  assigned_agent_id: number | null;
  payment_method: string;
  account_holder_name: string | null;
  qr_code_url: string | null;
  expires_at: Date | string | null;
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

function expiresAtToIso(v: Date | string | null | undefined): string | undefined {
  if (v == null) return undefined;
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

async function loadTx(txId: number): Promise<TxRow | null> {
  const [rows] = await pool.execute<TxRow[]>(
    `SELECT \`id\`, \`order_id\`, \`amount\`, \`status\`, \`client_name\`, \`client_upi\`, \`assigned_upi\`,
            \`bank_name\`, \`bank_account_number\`, \`ifsc_code\`, \`utr_code\`, \`payment_image\`,
            \`pay_method_id\`, \`assigned_agent_id\`, \`payment_method\`, \`account_holder_name\`, \`qr_code_url\`, \`expires_at\`
     FROM \`transactions\`
     WHERE \`id\` = ? AND \`type\` = 'PAYIN'
     LIMIT 1`,
    [txId],
  );
  return rows[0] ?? null;
}

function mapTx(tx: TxRow) {
  const dbStatus = String(tx.status ?? "").trim();
  const proofSubmitted = Boolean(
    (tx.utr_code && String(tx.utr_code).trim()) || (tx.payment_image && String(tx.payment_image).trim()),
  );
  return {
    id: String(tx.id),
    orderId: sqlFieldToUtf8(tx.order_id),
    amount: num(tx.amount),
    status: dbStatus,
    displayStatus: payInDisplayStatus(dbStatus),
    clientName: sqlFieldToUtf8(tx.client_name),
    clientUpi: sqlFieldToUtf8(tx.client_upi),
    assignedUpi: sqlFieldToUtf8(tx.assigned_upi),
    bankName: sqlFieldToUtf8(tx.bank_name),
    accountNo: sqlFieldToUtf8(tx.bank_account_number),
    ifsc: sqlFieldToUtf8(tx.ifsc_code),
    hasReceipt: Boolean(tx.payment_image && String(tx.payment_image).trim().length > 0),
    utrCode: sqlFieldToUtf8(tx.utr_code),
    paymentMethod: publicPayInDisplayMethod(tx),
    accountHolderName: sqlFieldToUtf8(tx.account_holder_name),
    waitForAgent: dbStatus === "NOT_ASSIGNED" || !tx.pay_method_id || !tx.assigned_agent_id,
    proofSubmitted,
    qrCodeUrl: sqlFieldToUtf8(tx.qr_code_url),
    expiresAtIso: expiresAtToIso(tx.expires_at),
  };
}

export async function GET(_req: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  const { id: idRaw } = await Promise.resolve(context.params);
  if (String(idRaw).startsWith("sp_")) {
    const providerId = Number(String(idRaw).slice(3));
    if (!Number.isInteger(providerId) || providerId < 1) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }
    try {
      const s = await fetchSpeedpayPayinStatus(providerId);
      return NextResponse.json({
        ok: true as const,
        request: {
          id: `sp_${s.providerId}`,
          orderId: s.transactionNumber,
          amount: s.amount,
          status: s.providerStatus,
          displayStatus: s.displayStatus,
          clientName: "",
          clientUpi: "",
          assignedUpi: s.upi,
          bankName: "",
          accountNo: "",
          ifsc: "",
          hasReceipt: false,
          utrCode: s.referenceNumber ?? "",
          paymentMethod: "UPI",
          accountHolderName: "",
          waitForAgent: false,
          proofSubmitted: false,
          qrCodeUrl: "",
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not fetch request";
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
  }
  const txId = Number(idRaw);
  if (!Number.isInteger(txId) || txId < 1) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }
  await expireOpenRequestsPastDeadline(pool);
  const tx = await loadTx(txId);
  if (!tx) return NextResponse.json({ ok: false, error: "Request not found" }, { status: 404 });
  return NextResponse.json({ ok: true as const, request: mapTx(tx) });
}

export async function PATCH(req: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  const { id: idRaw } = await Promise.resolve(context.params);
  if (String(idRaw).startsWith("sp_")) {
    return NextResponse.json(
      { ok: false, error: "Hosted provider flow: submit payment on provider page and rely on status/webhook updates." },
      { status: 409 },
    );
  }
  const txId = Number(idRaw);
  if (!Number.isInteger(txId) || txId < 1) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  await expireOpenRequestsPastDeadline(pool);
  const tx = await loadTx(txId);
  if (!tx) return NextResponse.json({ ok: false, error: "Request not found" }, { status: 404 });
  const st = String(tx.status).toUpperCase();
  if (st === "EXPIRED") {
    return NextResponse.json({ ok: false, error: "This payment request has expired." }, { status: 410 });
  }
  if (String(tx.status).toUpperCase() !== "PENDING") {
    return NextResponse.json(
      { ok: false, error: `UTR/proof can only be submitted while status is PENDING (current: ${tx.status})` },
      { status: 409 },
    );
  }
  if (!tx.pay_method_id || !tx.assigned_agent_id) {
    return NextResponse.json({ ok: false, error: "Agent/account not assigned yet. Please wait." }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const utr = typeof body.utr_code === "string" ? body.utr_code.trim() : "";
  const image = typeof body.payment_image === "string" ? body.payment_image.trim() : "";
  const userUpi = typeof body.user_upi === "string" ? body.user_upi.trim() : "";
  if (!utr && !image) {
    return NextResponse.json({ ok: false, error: "Provide utr_code or payment_image" }, { status: 400 });
  }
  if (!isValidUtrCode(utr)) {
    return NextResponse.json({ ok: false, error: "UTR/RRN must be between 12 and 22 digits." }, { status: 400 });
  }

  const proofCheck = validatePaymentProofPayload({ utr_code: utr, payment_image: image, user_upi: userUpi });
  if (!proofCheck.ok) {
    return NextResponse.json({ ok: false, error: proofCheck.error }, { status: proofCheck.status });
  }

  const storedImage = image ? await persistPaymentProofImage(image, txId) : "";

  let res: ResultSetHeader;
  try {
    const [r] = await pool.execute<ResultSetHeader>(
      `UPDATE \`transactions\`
       SET \`utr_code\` = COALESCE(NULLIF(?, ''), \`utr_code\`),
           \`payment_image\` = COALESCE(NULLIF(?, ''), \`payment_image\`),
           \`user_upi\` = COALESCE(NULLIF(?, ''), \`user_upi\`)
       WHERE \`id\` = ? AND \`type\` = 'PAYIN' AND \`status\` = 'PENDING'
         AND \`pay_method_id\` IS NOT NULL AND \`assigned_agent_id\` IS NOT NULL`,
      [utr, storedImage, userUpi, txId],
    );
    res = r;
  } catch (e: unknown) {
    if (isMysqlPacketTooLarge(e)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Proof data is too large for the database server. Use a smaller screenshot (under ~500 KB) or enter UTR only.",
        },
        { status: 413 },
      );
    }
    throw e;
  }
  if (res.affectedRows === 0) {
    return NextResponse.json(
      { ok: false, error: "Could not save proof (status may have changed or row is not assignable)" },
      { status: 409 },
    );
  }
  const updated = await loadTx(txId);
  if (!updated) return NextResponse.json({ ok: false, error: "Request not found" }, { status: 404 });
  emitTransactionRealtime(txId, "proof");
  void sendPayinWebhookForTx(txId, { event: "payin.in_process" });
  return NextResponse.json({ ok: true as const, request: mapTx(updated) });
}
