import { pool } from '@/lib/db';
import type { RowDataPacket } from 'mysql2/promise';
/** HMAC secret for outbound PayIn webhooks (PDF: signed with merchant API key). */
export function webhookSigningSecret(): string | null {
  // Use COMPANY_API_KEY if set – this is the key used by the company to sign webhooks.
  // Fallback to WEBHOOK_SIGNING_SECRET (legacy) or SPEEDPAY_API_KEY for backward compatibility.
  return (
    process.env.COMPANY_API_KEY?.trim() ||
    process.env.WEBHOOK_SIGNING_SECRET?.trim() ||
    process.env.SPEEDPAY_API_KEY?.trim()
  ) ?? null;
}

/**
 * Fetch the webhook signing secret for a specific company.
 * Returns the company's api_key if present, otherwise falls back to the global env vars.
 */
export async function getCompanyWebhookSecret(companyId: number): Promise<string | null> {
  try {
    // The column storing the raw secret is `key_hash` (hashed) – we fall back to the global secret if needed.
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT key_hash FROM company_api_keys WHERE company_id = ? LIMIT 1`,
      [companyId]
    );
    if (rows.length && (rows[0] as any).key_hash) return (rows[0] as any).key_hash.trim();
  } catch (e) {
    console.error('Failed to load company webhook key:', e);
  }
  // fallback to global secret
  return (
    process.env.COMPANY_API_KEY?.trim() ||
    process.env.WEBHOOK_SIGNING_SECRET?.trim() ||
    process.env.SPEEDPAY_API_KEY?.trim()
  ) ?? null;
}
