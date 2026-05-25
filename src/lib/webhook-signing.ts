import { pool } from '@/lib/db';
import type { RowDataPacket } from 'mysql2/promise';

/** HMAC secret for outbound PayIn webhooks. */
export function webhookSigningSecret(): string | null {
  return (
    process.env.WEBHOOK_SIGNING_SECRET?.trim() ||
    process.env.SPEEDPAY_API_KEY?.trim()
  ) ?? null;
}

/**
 * Fetch the webhook signing secret for a specific company.
 * Checks for a per-company `webhook_secret` column first (if it exists),
 * then falls back to the global WEBHOOK_SIGNING_SECRET env var.
 * 
 * NOTE: Do NOT use `key_hash` (hashed API key) as a signing secret —
 * merchants cannot know the hash value to verify signatures.
 */
export async function getCompanyWebhookSecret(companyId: number): Promise<string | null> {
  try {
    // Check if companies table has a dedicated webhook_secret column
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT webhook_secret FROM companies WHERE id = ? LIMIT 1`,
      [companyId]
    );
    const secret = (rows[0] as { webhook_secret?: string | null } | undefined)?.webhook_secret?.trim();
    if (secret) return secret;
  } catch {
    // Column may not exist yet — fall through to global secret
  }
  // Fall back to global env secret (shared with all merchants)
  return webhookSigningSecret();
}
