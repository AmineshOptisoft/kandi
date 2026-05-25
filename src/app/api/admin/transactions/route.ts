import { NextResponse } from "next/server";
import { rowToPayInItem, rowToPayOutItem, type TxRow } from "@/lib/agent-transactions-map";
import { pool } from "@/lib/db";
import { requireAdminPermission } from "@/lib/require-admin-api";
import { isMissingDisputeStateColumn, sqlExcludeOpenDispute, sqlExcludeOpenDisputeLegacy } from "@/lib/dispute";
import { expireOpenRequestsPastDeadline } from "@/lib/request-expiry";

const SELECT_TX = `
  \`id\`, \`random_code\`, \`order_id\`, \`amount\`, \`status\`, \`type\`,
  \`client_name\`, \`client_id\`, \`client_upi\`, \`assigned_upi\`, \`user_upi\`,
  \`utr_code\`, \`payment_image\`, \`user_note\`,
  \`created_at\`, \`assigned_date\`, \`assigned_agent_id\`,
  \`bank_name\`, \`bank_account_number\`, \`ifsc_code\`, \`dispute_raised\`, \`expires_at\`
`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const typeRaw = searchParams.get("type")?.toUpperCase() ?? "";
  if (typeRaw !== "PAYIN" && typeRaw !== "PAYOUT") {
    return NextResponse.json({ ok: false, error: "Query type=PAYIN or type=PAYOUT required" }, { status: 400 });
  }

  const permission = typeRaw === "PAYOUT" ? "view_payouts" : "view_payins";
  const auth = await requireAdminPermission(permission);
  if (!auth.ok) return auth.response;

  const statusRaw = searchParams.get("status")?.trim().toUpperCase() ?? "";
  const limitRaw = Number(searchParams.get("limit") ?? "500");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 500) : 500;
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const offset = (page - 1) * limit;

  const where = ["`type` = ?"];
  const params: Array<string> = [typeRaw];
  if (statusRaw) {
    where.push("`status` = ?");
    params.push(statusRaw);
  }

  async function loadRows(excludeDisputeSql: string) {
    const countSql = `SELECT COUNT(*) as c FROM \`transactions\` WHERE ${where.join(" AND ")} AND (${excludeDisputeSql})`;
    const [countRows] = await pool.execute<any[]>(countSql, params);
    const total = (countRows[0]?.c) ?? 0;

    const sql = `
      SELECT ${SELECT_TX}
      FROM \`transactions\`
      WHERE ${where.join(" AND ")} AND (${excludeDisputeSql})
      ORDER BY \`id\` DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [rows] = await pool.execute<TxRow[]>(sql, params);
    return { rows, total };
  }

  try {
    await expireOpenRequestsPastDeadline(pool);
    let loaded;
    try {
      loaded = await loadRows(sqlExcludeOpenDispute());
    } catch (e: unknown) {
      if (!isMissingDisputeStateColumn(e)) throw e;
      loaded = await loadRows(sqlExcludeOpenDisputeLegacy());
    }
    const { rows, total } = loaded as { rows: TxRow[]; total: number };
    const items =
      typeRaw === "PAYIN"
        ? rows.map((r) => rowToPayInItem(r))
        : rows.map((r) => rowToPayOutItem(r, "admin"));
    return NextResponse.json({ ok: true as const, items, total });
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "ER_BAD_FIELD_ERROR") {
      return NextResponse.json(
        {
          ok: false,
          error: "Database columns mismatch. Run database/migrations/002_rename_transactions_columns.sql if needed.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: "Could not load transactions" }, { status: 500 });
  }
}
