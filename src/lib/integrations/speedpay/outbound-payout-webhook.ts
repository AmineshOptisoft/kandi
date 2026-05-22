import crypto from "crypto";
import type { RowDataPacket } from "mysql2/promise";
import { webhookSigningSecret } from "@/lib/webhook-signing";
import { pool } from "@/lib/db";

export type PayoutWebhookEvent = "payout.initiated" | "payout.completed";

type TxRow = RowDataPacket & {
  id: number;
  company_id: number | null;
  order_id: string;
  client_id: string | null; // unique_identifier
  amount: string | number;
  status: string;
  bank_account_number: string | null;
  ifsc_code: string | null;
  account_holder_name: string | null;
  utr_code: string | null;
  user_note: string | null;
  dispute_reason: string | null;
};

export type PayoutWebhookPayload = {
  event: PayoutWebhookEvent;
  timestamp: string;
  data: {
    id: number;
    transaction_number: string;
    amount: string;
    note: string | null;
    unique_identifier: string;
    status: "INITIATE" | "COMPLETED" | "REJECTED" | "EXPIRED";
    utr: string | null;
    reject_reason: string | null;
    bank_details: {
      bank_name: string;
      account_number: string;
      ifsc_code: string;
      account_name: string;
    };
  };
};

const RETRY_DELAYS_MS = [2000, 5000, 15000];

function webhookSigningKey(): string | null {
  return webhookSigningSecret();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatAmount(v: string | number): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

export function payoutWebhookEventForStatus(status: string): PayoutWebhookEvent {
  const s = String(status || "").trim().toUpperCase();
  const terminal = new Set([
    "APPROVED",
    "APPROVED_BY_ADMIN",
    "APPROVED_BY_AGENT",
    "EXPIRED_APPROVED_BY_ADMIN",
    "EXPIRED_APPROVED_BY_AGENT",
    "REJECTED",
    "EXPIRED",
    "REVOKED",
    "DECLINED",
  ]);
  if (terminal.has(s)) return "payout.completed";
  return "payout.initiated";
}

export function buildPayoutWebhookPayload(
  tx: TxRow,
  event: PayoutWebhookEvent,
  reason?: string,
): PayoutWebhookPayload {
  const s = String(tx.status || "").trim().toUpperCase();
  
  let publicStatus: "INITIATE" | "COMPLETED" | "REJECTED" | "EXPIRED" = "INITIATE";
  let rejectReason: string | null = null;
  let utrCode: string | null = null;

  if (s.includes("APPROVED")) {
    publicStatus = "COMPLETED";
    utrCode = tx.utr_code?.trim() || null;
  } else if (s === "REJECTED" || s === "REVOKED" || s === "DECLINED") {
    publicStatus = "REJECTED";
    rejectReason = reason?.trim() || tx.dispute_reason?.trim() || "Transaction rejected";
  } else if (s === "EXPIRED") {
    publicStatus = "EXPIRED";
    rejectReason = "Verification link expired (30 minutes)";
  }

  return {
    event,
    timestamp: new Date().toISOString(),
    data: {
      id: Number(tx.id),
      transaction_number: String(tx.order_id || ""),
      amount: formatAmount(tx.amount),
      note: tx.user_note?.trim() || null,
      unique_identifier: String(tx.client_id || ""),
      status: publicStatus,
      utr: utrCode,
      reject_reason: rejectReason,
      bank_details: {
        bank_name: "State Bank of India", // Mapped dynamically if possible, else generic placeholder
        account_number: String(tx.bank_account_number || ""),
        ifsc_code: String(tx.ifsc_code || ""),
        account_name: String(tx.account_holder_name || ""),
      },
    },
  };
}

export async function sendPayoutWebhook(payload: PayoutWebhookPayload, webhookUrl: string): Promise<void> {
  const url = webhookUrl.trim();
  const key = webhookSigningKey();
  if (!url || !key) return;

  const rawBody = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", key).update(rawBody).digest("hex");
  const headers = {
    "Content-Type": "application/json",
    "x-webhook-signature": signature,
    "x-webhook-timestamp": payload.timestamp,
  };

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]!);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: rawBody,
        cache: "no-store",
      });
      if (res.ok) return;
    } catch {
      // retry
    }
  }
}

async function loadPayoutTx(txId: number): Promise<TxRow | null> {
  const [rows] = await pool.execute<TxRow[]>(`
    SELECT t.id,
           t.company_id,
           t.order_id,
           t.client_id,
           t.amount,
           t.status,
           t.bank_account_number,
           t.ifsc_code,
           t.account_holder_name,
           t.utr_code,
           t.user_note,
           t.dispute_reason
    FROM transactions t
    WHERE t.id = ? AND t.type = 'PAYOUT'
    LIMIT 1`,
    [txId]
  );
  return rows[0] ?? null;
}

async function dispatchPayoutWebhook(tx: TxRow, event: PayoutWebhookEvent, reason?: string): Promise<void> {
  const webhookUrl = process.env.MERCHANT_WEBHOOK_URL?.trim() || null;
  if (!webhookUrl) return;

  const payload = buildPayoutWebhookPayload(tx, event, reason);
  await sendPayoutWebhook(payload, webhookUrl);
}

export async function sendPayoutWebhookForTx(
  txId: number,
  opts?: { event?: PayoutWebhookEvent; reason?: string },
): Promise<void> {
  const tx = await loadPayoutTx(txId);
  if (!tx) return;

  const event = opts?.event ?? payoutWebhookEventForStatus(tx.status);
  await dispatchPayoutWebhook(tx, event, opts?.reason);
}

export async function sendPayoutWebhookForTxStatusChange(
  txId: number,
  newStatus: string,
  reason?: string,
): Promise<void> {
  const tx = await loadPayoutTx(txId);
  if (!tx) return;

  const event = payoutWebhookEventForStatus(newStatus);
  await dispatchPayoutWebhook(tx, event, reason);
}
