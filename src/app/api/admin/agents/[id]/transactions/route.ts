import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import { parseDateRangeFromSearchParams, sqlCreatedAtRange } from "@/lib/date-range";
import { requireAdminSession, hasAdminPermission } from "@/lib/require-admin-api";

type TxRow = RowDataPacket & {
  id: number;
  order_id: string;
  amount: string | number;
  status: string;
  type: string;
  client_name: string | null;
  created_at: Date | string | null;
};

type TodayRow = RowDataPacket & {
  today_pay_in: string | number | null;
  today_pay_out: string | number | null;
};

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export async function GET(
  req: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const hasPerm = await hasAdminPermission(auth.adminId, auth.role, "view_agents") ||
                  await hasAdminPermission(auth.adminId, auth.role, "view_transactions");
  if (!hasPerm) {
    return NextResponse.json(
      { ok: false, error: "Forbidden: requires view_agents or view_transactions privilege" },
      { status: 403 },
    );
  }

  const { id: idRaw } = await Promise.resolve(context.params);
  const agentId = Number(idRaw);
  if (!Number.isInteger(agentId) || agentId < 1) {
    return NextResponse.json({ ok: false, error: "Invalid agent id" }, { status: 400 });
  }

  const [agentRows] = await pool.execute<RowDataPacket[]>(
    "SELECT `id` FROM `agents` WHERE `id` = ? LIMIT 1",
    [agentId],
  );
  if (!agentRows[0]) {
    return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const { from, to } = parseDateRangeFromSearchParams(searchParams);
  const range = sqlCreatedAtRange("t", from, to);
  const rangeParams = range.params;

  const [todayRows] = await pool.execute<TodayRow[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN t.\`type\` = 'PAYIN' AND DATE(t.\`created_at\`) = CURDATE() THEN t.\`amount\` ELSE 0 END), 0) AS today_pay_in,
       COALESCE(SUM(CASE WHEN t.\`type\` = 'PAYOUT' AND DATE(t.\`created_at\`) = CURDATE() THEN t.\`amount\` ELSE 0 END), 0) AS today_pay_out
     FROM \`transactions\` t
     WHERE t.\`assigned_agent_id\` = ?`,
    [agentId],
  );
  const today = todayRows[0];
  const todayPayIn = num(today?.today_pay_in);
  const todayPayOut = num(today?.today_pay_out);

  const [rows] = await pool.execute<TxRow[]>(
    `SELECT t.\`id\`, t.\`order_id\`, t.\`amount\`, t.\`status\`, t.\`type\`, t.\`client_name\`, t.\`created_at\`
     FROM \`transactions\` t
     WHERE t.\`assigned_agent_id\` = ? AND (${range.sql})
     ORDER BY t.\`id\` DESC
     LIMIT 500`,
    [agentId, ...rangeParams],
  );

  const transactions = rows.map((r) => ({
    id: String(r.id),
    orderId: r.order_id,
    amount: num(r.amount),
    status: String(r.status ?? "").toUpperCase(),
    type: String(r.type ?? "").toUpperCase(),
    clientName: (r.client_name ?? "").trim() || "—",
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
  }));

  return NextResponse.json({
    ok: true as const,
    todayPayIn,
    todayPayOut,
    transactions,
  });
}
