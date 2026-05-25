import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { AGENT_SETTLED_LEDGER_STATUSES } from "@/lib/agent-ledger-statuses";
import { pool } from "@/lib/db";
import { requireAdminPermission } from "@/lib/require-admin-api";

type AgentRow = RowDataPacket & {
  id: number;
  fullname: string | null;
  username: string;
  security_deposit: string | number;
  credit_limit: string | number;
  previous_balance: string | number;
};

type OpeningRow = RowDataPacket & {
  agent_id: number;
  payin_sum: string | number | null;
  payout_sum: string | number | null;
};

type TxRow = RowDataPacket & {
  id: number;
  agent_id: number;
  created_at: Date | string;
  type: string;
  amount: string | number;
  order_id: string;
};

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

const LEDGER_STATUSES = [...AGENT_SETTLED_LEDGER_STATUSES];

export async function GET(req: Request) {
  const auth = await requireAdminPermission("view_ledger");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const fromRaw = searchParams.get("from")?.trim();
  const toRaw = searchParams.get("to")?.trim();
  const agentIdRaw = searchParams.get("agentId")?.trim();

  const from = fromRaw
    ? new Date(fromRaw)
    : (() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
      })();
  const to = toRaw ? new Date(toRaw) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ ok: false, error: "Invalid date range" }, { status: 400 });
  }
  const fromSql = new Date(from);
  fromSql.setHours(0, 0, 0, 0);
  const toSql = new Date(to);
  toSql.setHours(23, 59, 59, 999);

  let selectedAgentId: number | null = null;
  if (agentIdRaw) {
    const n = Number(agentIdRaw);
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json({ ok: false, error: "Invalid agentId" }, { status: 400 });
    }
    selectedAgentId = n;
  }

  const statusPlaceholders = LEDGER_STATUSES.map(() => "?").join(", ");
  const baseAgentWhere = selectedAgentId ? " WHERE `id` = ? " : "";
  const baseAgentParams = selectedAgentId ? [selectedAgentId] : [];

  const [agents] = await pool.execute<AgentRow[]>(
    `SELECT \`id\`, \`fullname\`, \`username\`, \`security_deposit\`, \`credit_limit\`, \`previous_balance\`
     FROM \`agents\`${baseAgentWhere} ORDER BY \`id\` DESC LIMIT 500`,
    baseAgentParams,
  );

  if (agents.length === 0) {
    return NextResponse.json({ ok: true as const, accounts: [], agents: [] });
  }

  const txWhereAgent = selectedAgentId ? " AND t.`assigned_agent_id` = ? " : "";
  const txParamsCommon = [...LEDGER_STATUSES];

  const [openings] = await pool.execute<OpeningRow[]>(
    `SELECT
       t.\`assigned_agent_id\` AS agent_id,
       SUM(CASE WHEN t.\`type\` = 'PAYIN' THEN t.\`amount\` ELSE 0 END) AS payin_sum,
       SUM(CASE WHEN t.\`type\` = 'PAYOUT' THEN t.\`amount\` ELSE 0 END) AS payout_sum
     FROM \`transactions\` t
     WHERE t.\`assigned_agent_id\` IS NOT NULL
       AND t.\`status\` IN (${statusPlaceholders})
       AND t.\`created_at\` < ?
       ${txWhereAgent}
     GROUP BY t.\`assigned_agent_id\``,
    [...txParamsCommon, fromSql, ...(selectedAgentId ? [selectedAgentId] : [])],
  );

  const [entriesRows] = await pool.execute<TxRow[]>(
    `SELECT
       t.\`id\`,
       t.\`assigned_agent_id\` AS agent_id,
       t.\`created_at\`,
       t.\`type\`,
       t.\`amount\`,
       t.\`order_id\`
     FROM \`transactions\` t
     WHERE t.\`assigned_agent_id\` IS NOT NULL
       AND t.\`status\` IN (${statusPlaceholders})
       AND t.\`created_at\` BETWEEN ? AND ?
       ${txWhereAgent}
     ORDER BY t.\`assigned_agent_id\` ASC, t.\`created_at\` ASC, t.\`id\` ASC`,
    [...txParamsCommon, fromSql, toSql, ...(selectedAgentId ? [selectedAgentId] : [])],
  );

  const openingMap = new Map<number, number>();
  for (const o of openings) {
    openingMap.set(o.agent_id, num(o.payin_sum) - num(o.payout_sum));
  }

  const grouped = new Map<number, TxRow[]>();
  for (const row of entriesRows) {
    const arr = grouped.get(row.agent_id) ?? [];
    arr.push(row);
    grouped.set(row.agent_id, arr);
  }

  const accounts = agents.map((a) => {
    const agentEntries = grouped.get(a.id) ?? [];
    const prev = num(a.previous_balance);
    const security = num(a.security_deposit);
    const credit = num(a.credit_limit);
    const openingFromTx = openingMap.get(a.id) ?? 0;
    let runningForEntries = prev + openingFromTx;
    let payIn = 0;
    let payOut = 0;

    const entries = agentEntries.map((e) => {
      const amount = num(e.amount);
      const isPayIn = String(e.type).toUpperCase() === "PAYIN";
      if (isPayIn) payIn += amount;
      else payOut += amount;
      runningForEntries += isPayIn ? amount : -amount;
      return {
        date: new Date(e.created_at).toISOString(),
        debit: isPayIn ? amount : 0,
        credit: isPayIn ? 0 : amount,
        balance: runningForEntries,
        narrative: `${String(e.type).toUpperCase()} · ${e.order_id}`,
      };
    });

    const net = payIn - payOut;
    const closingBalance = runningForEntries;
    const final = closingBalance - security;
    const remaining = credit - final;

    return {
      agentId: a.id,
      name: (a.fullname && a.fullname.trim()) || a.username,
      openingBalance: prev + openingFromTx,
      closingBalance,
      security,
      credit,
      payIn,
      payOut,
      net,
      final,
      remaining,
      entries,
    };
  });

  return NextResponse.json({
    ok: true as const,
    agents: agents.map((a) => ({
      id: a.id,
      name: (a.fullname && a.fullname.trim()) || a.username,
    })),
    accounts,
  });
}
