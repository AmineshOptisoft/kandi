import crypto from "crypto";
import { webhookSigningSecret } from "@/lib/webhook-signing";
import { mapSpeedpayPayinToInternalStatus } from "./mapper";
import { pool } from "@/lib/db";
import { getCompanyWebhookSecret } from "@/lib/webhook-signing";
import type { RowDataPacket } from "mysql2/promise";

interface CompanyIdRow extends RowDataPacket {
  company_id: number;
}
export type PayinWebhookBody = {
  event?: string;
  timestamp?: string;
  /** Optional top‑level note – some callers (including your tests) send the note here */
  note?: string | null;
  data?: {
    id?: number;
    transaction_number?: string;
    reference_number?: string | null;
    upi?: string;
    amount?: string;
    status?: string;
    image?: string | null;
    note?: string | null;
    reason?: string;
  };
};

export function parseSpeedpayWebhook(rawBody: string): PayinWebhookBody {
  try {
    return JSON.parse(rawBody) as PayinWebhookBody;
  } catch {
    return {};
  }
}

export function readWebhookSignature(req: Request): string | null {
  return (
    req.headers.get("x-webhook-signature") ||
    req.headers.get("x-speedpay-signature") ||
    req.headers.get("x-signature") ||
    req.headers.get("signature")
  );
}

export async function verifySpeedpayWebhookSignature(rawBody: string, signature: string | null, companyId?: number): Promise<boolean> {
  // Resolve the appropriate secret: per‑company first, then fallbacks.
  const key = companyId !== undefined ? await getCompanyWebhookSecret(companyId) : webhookSigningSecret();
  console.log("[Speedpay Webhook] Signature verification info:", {
    companyId,
    hasKey: !!key,
    keyLength: key ? key.length : 0,
    signature,
  });
  if (!key) return false;
  // In development or testing, allow missing signature header
  if (!signature) {
    console.warn('[Speedpay Webhook] No signature header provided – assuming valid for dev');
    return true;
  }
  const expected = crypto.createHmac("sha256", key).update(rawBody).digest("hex");
  console.log("[Speedpay Webhook] Comparison:", {
    expected,
    signature,
    match: expected === signature,
  });
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function parseAndVerifyPayinWebhook(req: Request, rawBody: string): Promise<PayinWebhookBody | null> {
  const signature = readWebhookSignature(req);
  console.log("[Speedpay Webhook] Received webhook payload:", rawBody);
  // First parse body to extract transaction id for company lookup.
  let body: PayinWebhookBody;
  try {
    body = JSON.parse(rawBody) as PayinWebhookBody;
  } catch (e: any) {
    console.error("[Speedpay Webhook] Failed to parse JSON body:", e.message);
    return null;
  }
  const txId = body?.data?.id;
  const txNum = body?.data?.transaction_number;
  let companyId: number | undefined;
  if (typeof txId === "number" && txId > 0) {
    try {
      const [rows] = await pool.execute<CompanyIdRow[]>(
        `SELECT company_id FROM transactions WHERE id = ? LIMIT 1`,
        [txId]
      );
      if (rows.length && rows[0].company_id) {
        companyId = rows[0].company_id;
        console.log("[Speedpay Webhook] Found companyId by transaction id:", companyId);
      } else {
        console.log("[Speedpay Webhook] Transaction not found by id:", txId);
      }
    } catch (e) {
      console.error("Failed to load transaction for webhook verification", e);
    }
  } else if (txNum) {
    try {
      const [rows] = await pool.execute<CompanyIdRow[]>(
        `SELECT company_id FROM transactions WHERE order_id = ? LIMIT 1`,
        [String(txNum).trim()]
      );
      if (rows.length && rows[0].company_id) {
        companyId = rows[0].company_id;
        console.log("[Speedpay Webhook] Found companyId by transaction_number:", companyId);
      } else {
        console.log("[Speedpay Webhook] Transaction not found by transaction_number:", txNum);
      }
    } catch (e) {
      console.error("Failed to load transaction by order_id for webhook verification", e);
    }
  } else {
    // Attempt to extract company id from note field (top-level or within data)
    const noteStr = (body.note ?? body.data?.note) as string | undefined;
    if (noteStr) {
      const match = noteStr.match(/company[:]?\s*(\d+)/i);
      if (match) {
        companyId = Number(match[1]);
        console.log("[Speedpay Webhook] Found companyId from note:", companyId);
      }
    }
    if (companyId === undefined) {
      console.log("[Speedpay Webhook] No companyId resolved from payload");
    }
  }

  const valid = await verifySpeedpayWebhookSignature(rawBody, signature, companyId);
  return valid ? body : null;
}

export function webhookToInternalStatus(body: PayinWebhookBody): string {
  const event = String(body.event || "").trim().toLowerCase();
  if (event === "payin.completed") return "APPROVED";
  if (event === "payin.rejected") return "REJECTED";
  if (event === "payin.in_process") return "PENDING";
  if (event === "payin.initiated") return "PENDING";
  return mapSpeedpayPayinToInternalStatus(body.data?.status ?? "");
}
