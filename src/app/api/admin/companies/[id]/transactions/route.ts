import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
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
  _req: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const hasPerm = await hasAdminPermission(auth.adminId, auth.role, "view_companies") ||
                  await hasAdminPermission(auth.adminId, auth.role, "view_transactions");
  if (!hasPerm) {
    return NextResponse.json(
      { ok: false, error: "Forbidden: requires view_companies or view_transactions privilege" },
      { status: 403 },
    );
  }

  const { id: idRaw } = await Promise.resolve(context.params);
  let companyId: number | null = null;
  const isNumeric = /^\d+$/.test(idRaw);
  if (isNumeric) {
    companyId = Number(idRaw);
  } else {
    const [comp] = await pool.execute<RowDataPacket[]>(
      "SELECT `id` FROM `companies` WHERE `company_code` = ? LIMIT 1",
      [idRaw],
    );
    if (comp[0]) {
      companyId = Number(comp[0].id);
    }
  }

  if (!companyId || !Number.isInteger(companyId) || companyId < 1) {
    return NextResponse.json({ ok: false, error: "Company not found" }, { status: 404 });
  }

  const [companyRows] = await pool.execute<RowDataPacket[]>(
    "SELECT `id` FROM `companies` WHERE `id` = ? LIMIT 1",
    [companyId],
  );
  if (!companyRows[0]) {
    return NextResponse.json({ ok: false, error: "Company not found" }, { status: 404 });
  }

  const [todayRows] = await pool.execute<TodayRow[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN \`type\` = 'PAYIN' AND DATE(\`created_at\`) = CURDATE() THEN \`amount\` ELSE 0 END), 0) AS today_pay_in,
       COALESCE(SUM(CASE WHEN \`type\` = 'PAYOUT' AND DATE(\`created_at\`) = CURDATE() THEN \`amount\` ELSE 0 END), 0) AS today_pay_out
     FROM \`transactions\`
     WHERE \`company_id\` = ?`,
    [companyId],
  );
  const today = todayRows[0];
  const todayPayIn = num(today?.today_pay_in);
  const todayPayOut = num(today?.today_pay_out);

  const [rows] = await pool.execute<TxRow[]>(
    `SELECT \`id\`, \`order_id\`, \`amount\`, \`status\`, \`type\`, \`client_name\`, \`created_at\`
     FROM \`transactions\`
     WHERE \`company_id\` = ?
     ORDER BY \`id\` DESC
     LIMIT 500`,
    [companyId],
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
