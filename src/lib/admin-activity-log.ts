import { pool } from "@/lib/db";

export type ActivityAction =
  | "LOGIN"
  | "LOGOUT"
  | "CREATE_ADMIN"
  | "UPDATE_ADMIN"
  | "DELETE_ADMIN"
  | "SUSPEND_ADMIN"
  | "ACTIVATE_ADMIN"
  | "UPDATE_PERMISSIONS"
  | "RESET_ADMIN_PASSWORD"
  | "CREATE_AGENT"
  | "UPDATE_AGENT"
  | "DELETE_AGENT"
  | "CREATE_COMPANY"
  | "UPDATE_COMPANY"
  | "DELETE_COMPANY"
  | "APPROVE_PAYIN"
  | "REJECT_PAYIN"
  | "APPROVE_PAYOUT"
  | "REJECT_PAYOUT"
  | "CREATE_SETTLEMENT"
  | "RESOLVE_DISPUTE"
  | "OTHER";

export interface LogActivityOptions {
  adminId: number;
  action: ActivityAction | string;
  targetType?: string;
  targetId?: string | number;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Write an entry to admin_activity_log.
 * Safe to call without await — errors are swallowed so they never disrupt main flow.
 */
export async function logAdminActivity(opts: LogActivityOptions): Promise<void> {
  try {
    await pool.execute(
      `INSERT INTO \`admin_activity_log\`
         (\`admin_id\`, \`action\`, \`target_type\`, \`target_id\`, \`details\`, \`ip_address\`)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        opts.adminId,
        opts.action,
        opts.targetType ?? null,
        opts.targetId != null ? String(opts.targetId) : null,
        opts.details ? JSON.stringify(opts.details) : null,
        opts.ipAddress ?? null,
      ],
    );
  } catch (e) {
    // Log silently — never throw from an audit helper
    console.error("[admin-activity-log] failed to write:", e);
  }
}

/** Extract IP from Next.js request headers (X-Forwarded-For or remote-addr). */
export function getIpFromRequest(req: Request): string | undefined {
  const ff = req.headers.get("x-forwarded-for");
  if (ff) return ff.split(",")[0]?.trim();
  const real = req.headers.get("x-real-ip");
  return real ?? undefined;
}
