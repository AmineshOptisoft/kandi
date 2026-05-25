import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { AGENT_SETTLED_LEDGER_SQL_IN } from "@/lib/agent-ledger-statuses";
import { pool } from "@/lib/db";
import { requireAdminPermission } from "@/lib/require-admin-api";

type AgentRow = RowDataPacket & {
  id: number;
  fullname: string | null;
  username: string;
  security_deposit: string | number;
  credit_limit: string | number;
  net_pay_in: string | number;
  net_pay_out: string | number;
  previous_balance: string | number;
  running_balance: string | number;
  settlement_amount: string | number;
  pay_in_commission: string | number;
  pay_out_commission: string | number;
  referral_commission: string | number;
  agg_payin_approved: string | number | null;
  agg_payout_total: string | number | null;
  last_settlement_amount: string | number | null;
};

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function commissionAmount(volume: number, pct: number): number {
  if (!Number.isFinite(volume) || !Number.isFinite(pct) || volume <= 0 || pct <= 0) return 0;
  return Math.round((volume * pct) / 100 * 100) / 100;
}

function mapAgent(r: AgentRow) {
  const security = num(r.security_deposit);
  const credit = num(r.credit_limit);
  const payInToday = num(r.net_pay_in);
  const payoutToday = num(r.net_pay_out);
  const payInCommissionPct = num(r.pay_in_commission);
  const payOutCommissionPct = num(r.pay_out_commission);
  const referralCommissionPct = num(r.referral_commission);

  const totalPayIn = num(r.agg_payin_approved);
  const totalPayout = num(r.agg_payout_total);
  const totalSettlement = num(r.settlement_amount);
  const lastSettlement = num(r.last_settlement_amount);
  const running = num(r.running_balance);
  const previousBalance = num(r.previous_balance);
  const finalBalance = previousBalance;
  const remainingBalance = credit - (running - security);

  return {
    id: String(r.id),
    name: (r.fullname && r.fullname.trim()) || r.username,
    security,
    credit,
    totalPayIn,
    totalPayout,
    payInToday,
    payoutToday,
    running,
    totalSettlement,
    lastSettlement,
    payInCommissionPct,
    payOutCommissionPct,
    referralCommissionPct,
    payInCommissionAmount: commissionAmount(payInToday, payInCommissionPct),
    payOutCommissionAmount: commissionAmount(payoutToday, payOutCommissionPct),
    referralCommissionAmount: commissionAmount(payInToday, referralCommissionPct),
    finalBalance,
    remainingBalance,
  };
}

export async function GET() {
  const auth = await requireAdminPermission("view_dashboard");
  if (!auth.ok) return auth.response;

  try {
    let rows: AgentRow[];
    try {
      [rows] = await pool.execute<AgentRow[]>(
        `SELECT a.\`id\`, a.\`fullname\`, a.\`username\`, a.\`security_deposit\`, a.\`credit_limit\`,
                a.\`net_pay_in\`, a.\`net_pay_out\`, a.\`previous_balance\`, a.\`running_balance\`, a.\`settlement_amount\`,
                a.\`pay_in_commission\`, a.\`pay_out_commission\`, a.\`referral_commission\`,
                COALESCE(tx.\`agg_payin_approved\`, 0) AS agg_payin_approved,
                COALESCE(tx.\`agg_payout_total\`, 0) AS agg_payout_total,
                COALESCE(ls.\`last_settlement_amount\`, 0) AS last_settlement_amount
         FROM \`agents\` a
         LEFT JOIN (
           SELECT
             t.\`assigned_agent_id\` AS agent_id,
             SUM(CASE
               WHEN t.\`type\` = 'PAYIN' AND UPPER(TRIM(t.\`status\`)) IN ${AGENT_SETTLED_LEDGER_SQL_IN}
               THEN CAST(t.\`amount\` AS DECIMAL(18, 2))
               ELSE 0
             END) AS agg_payin_approved,
             SUM(CASE
               WHEN t.\`type\` = 'PAYOUT'
                AND UPPER(TRIM(t.\`status\`)) NOT LIKE '%REJECT%'
                AND UPPER(TRIM(t.\`status\`)) NOT LIKE '%REVOK%'
                AND UPPER(TRIM(t.\`status\`)) NOT IN ('FAILED', 'CANCELLED', 'CANCELED', 'PAID')
               THEN CAST(t.\`amount\` AS DECIMAL(18, 2))
               ELSE 0
             END) AS agg_payout_total
           FROM \`transactions\` t
           WHERE t.\`assigned_agent_id\` IS NOT NULL AND t.\`assigned_agent_id\` > 0
           GROUP BY t.\`assigned_agent_id\`
         ) tx ON tx.agent_id = a.\`id\`
         LEFT JOIN (
           SELECT s.\`agent_id\`,
                  COALESCE(NULLIF(s.\`final_settlement_amount\`, 0), s.\`amount\`, 0) AS last_settlement_amount
           FROM \`agent_settlements\` s
           INNER JOIN (
             SELECT \`agent_id\`, MAX(\`id\`) AS max_id
             FROM \`agent_settlements\`
             WHERE \`settlement_status\` = 'settled'
             GROUP BY \`agent_id\`
           ) latest ON latest.max_id = s.\`id\`
         ) ls ON ls.agent_id = a.\`id\`
         ORDER BY a.\`id\` DESC
         LIMIT 500`,
      );
    } catch {
      [rows] = await pool.execute<AgentRow[]>(
        `SELECT a.\`id\`, a.\`fullname\`, a.\`username\`, a.\`security_deposit\`, a.\`credit_limit\`,
                a.\`net_pay_in\`, a.\`net_pay_out\`, a.\`previous_balance\`, a.\`running_balance\`, a.\`settlement_amount\`,
                a.\`pay_in_commission\`, a.\`pay_out_commission\`, a.\`referral_commission\`,
                COALESCE(tx.\`agg_payin_approved\`, 0) AS agg_payin_approved,
                COALESCE(tx.\`agg_payout_total\`, 0) AS agg_payout_total,
                0 AS last_settlement_amount
         FROM \`agents\` a
         LEFT JOIN (
           SELECT
             t.\`assigned_agent_id\` AS agent_id,
             SUM(CASE
               WHEN t.\`type\` = 'PAYIN' AND UPPER(TRIM(t.\`status\`)) IN ${AGENT_SETTLED_LEDGER_SQL_IN}
               THEN CAST(t.\`amount\` AS DECIMAL(18, 2))
               ELSE 0
             END) AS agg_payin_approved,
             SUM(CASE
               WHEN t.\`type\` = 'PAYOUT'
                AND UPPER(TRIM(t.\`status\`)) NOT LIKE '%REJECT%'
                AND UPPER(TRIM(t.\`status\`)) NOT LIKE '%REVOK%'
                AND UPPER(TRIM(t.\`status\`)) NOT IN ('FAILED', 'CANCELLED', 'CANCELED', 'PAID')
               THEN CAST(t.\`amount\` AS DECIMAL(18, 2))
               ELSE 0
             END) AS agg_payout_total
           FROM \`transactions\` t
           WHERE t.\`assigned_agent_id\` IS NOT NULL AND t.\`assigned_agent_id\` > 0
           GROUP BY t.\`assigned_agent_id\`
         ) tx ON tx.agent_id = a.\`id\`
         ORDER BY a.\`id\` DESC
         LIMIT 500`,
      );
    }

    const vendors = rows.map(mapAgent);
    return NextResponse.json({ ok: true as const, rows: vendors });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not load dashboard" }, { status: 500 });
  }
}
