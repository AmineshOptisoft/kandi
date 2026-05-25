import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { jsonStringOrNumberField } from "@/lib/auth-body";
import { pool } from "@/lib/db";
import { requireAdminSession } from "@/lib/require-admin-api";
import { emitUserStatusUpdate } from "@/lib/realtime/broadcast-user";

const STATUSES = new Set(["ACTIVE", "DEACTIVATED", "PENDING", "BLOCKED"]);

type CompanyRow = RowDataPacket & {
  id: number;
  username: string;
  brand_name: string;
  logo: string | null;
  status: string;
  company_code: string | null;
  commission: string | number;
  net_pay_in: string | number;
  net_pay_out: string | number;
  settlement_amount: string | number;
  settlement_date: Date | string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
  calc_net_pay_in?: string | number | null;
  calc_net_pay_out?: string | number | null;
};

type ColumnRow = RowDataPacket & { Field: string };

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

async function hasCommissionColumn(): Promise<boolean> {
  const [rows] = await pool.execute<ColumnRow[]>("SHOW COLUMNS FROM `companies` LIKE 'commission'");
  return rows.length > 0;
}

function mapPublic(r: CompanyRow) {
  const computedPayIn = num(r.calc_net_pay_in);
  const computedPayOut = num(r.calc_net_pay_out);
  return {
    id: String(r.id),
    username: r.username,
    brand_name: r.brand_name ?? "",
    logo: r.logo,
    status: r.status,
    company_code: r.company_code,
    commission: num(r.commission),
    // Prefer live totals from transactions; fall back to companies table values.
    net_pay_in: computedPayIn || num(r.net_pay_in),
    net_pay_out: computedPayOut || num(r.net_pay_out),
    settlement_amount: num(r.settlement_amount),
    settlement_date: r.settlement_date,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

async function resolveCompanyId(idRaw: string): Promise<number | null> {
  const isNumeric = /^\d+$/.test(idRaw);
  if (isNumeric) {
    const id = Number(idRaw);
    if (Number.isInteger(id) && id >= 1) return id;
  }
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT `id` FROM `companies` WHERE `company_code` = ? LIMIT 1",
    [idRaw],
  );
  if (rows[0]) {
    return Number(rows[0].id);
  }
  return null;
}

export async function GET(
  _req: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const { id: idRaw } = await Promise.resolve(context.params);
  const id = await resolveCompanyId(idRaw);
  if (!id) {
    return NextResponse.json({ ok: false, error: "Company not found" }, { status: 404 });
  }

  const includeCommission = await hasCommissionColumn();
  const [rows] = await pool.execute<CompanyRow[]>(
    `SELECT \`id\`, \`username\`, \`brand_name\`, \`logo\`, \`status\`, \`company_code\`,
            ${includeCommission ? "`commission`," : ""}
            \`net_pay_in\`, \`net_pay_out\`, \`settlement_amount\`, \`settlement_date\`,
            COALESCE(tx.\`calc_net_pay_in\`, 0) AS \`calc_net_pay_in\`,
            COALESCE(tx.\`calc_net_pay_out\`, 0) AS \`calc_net_pay_out\`,
            \`created_at\`, \`updated_at\`
     FROM \`companies\`
     LEFT JOIN (
       SELECT
         t.\`company_id\`,
         COALESCE(SUM(CASE WHEN t.\`type\` = 'PAYIN' THEN CAST(t.\`amount\` AS DECIMAL(18,2)) ELSE 0 END), 0) AS \`calc_net_pay_in\`,
         COALESCE(SUM(CASE WHEN t.\`type\` = 'PAYOUT' THEN CAST(t.\`amount\` AS DECIMAL(18,2)) ELSE 0 END), 0) AS \`calc_net_pay_out\`
       FROM \`transactions\` t
       WHERE t.\`company_id\` IS NOT NULL
       GROUP BY t.\`company_id\`
     ) tx ON tx.\`company_id\` = \`companies\`.\`id\`
     WHERE \`companies\`.\`id\` = ? LIMIT 1`,
    [id],
  );

  const row = rows[0];
  if (!row) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true as const, company: mapPublic(row) });
}

function parsePctField(v: unknown): number | null {
  if (v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(/%/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function PATCH(
  req: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const { id: idRaw } = await Promise.resolve(context.params);
  const id = await resolveCompanyId(idRaw);
  if (!id) {
    return NextResponse.json({ ok: false, error: "Company not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const updates: string[] = [];
  const values: (string | number | null)[] = [];
  const includeCommission = await hasCommissionColumn();

  if (typeof body.username === "string") {
    const u = body.username.trim();
    if (u) {
      updates.push("`username` = ?");
      values.push(u);
    }
  }

  if (typeof body.brand_name === "string") {
    updates.push("`brand_name` = ?");
    values.push(body.brand_name.trim());
  }

  if (body.logo === null) {
    updates.push("`logo` = NULL");
  } else if (typeof body.logo === "string") {
    updates.push("`logo` = ?");
    values.push(body.logo.trim() || null);
  }

  if (typeof body.company_code === "string") {
    const c = body.company_code.trim();
    updates.push("`company_code` = ?");
    values.push(c || null);
  }

  const comm = parsePctField(body.commission);
  if (includeCommission && comm !== null) {
    updates.push("`commission` = ?");
    values.push(comm);
  }

  if (typeof body.status === "string") {
    const s = body.status.trim().toUpperCase();
    if (STATUSES.has(s)) {
      updates.push("`status` = ?");
      values.push(s);
    }
  }

  const pwd = jsonStringOrNumberField(body.password);
  if (pwd) {
    updates.push("`password` = ?");
    values.push(await hash(pwd, 10));
  }

  if (updates.length === 0) {
    return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 });
  }

  values.push(id);

  try {
    const [header] = await pool.execute<ResultSetHeader>(
      `UPDATE \`companies\` SET ${updates.join(", ")} WHERE \`id\` = ?`,
      values,
    );
    if (header.affectedRows === 0) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
    if (code === "ER_DUP_ENTRY") {
      return NextResponse.json({ ok: false, error: "Username or company code already exists" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: "Update failed" }, { status: 500 });
  }

  const [rows] = await pool.execute<CompanyRow[]>(
    `SELECT \`id\`, \`username\`, \`brand_name\`, \`logo\`, \`status\`, \`company_code\`,
            ${includeCommission ? "`commission`," : ""}
            \`net_pay_in\`, \`net_pay_out\`, \`settlement_amount\`, \`settlement_date\`,
            \`created_at\`, \`updated_at\`
     FROM \`companies\` WHERE \`id\` = ? LIMIT 1`,
    [id],
  );
  const row = rows[0];
  if (row) {
    if (typeof body.status === "string") {
      emitUserStatusUpdate(id, "company", body.status);
    }
  }

  return NextResponse.json({ ok: true as const, company: row ? mapPublic(row) : null });
}

export async function DELETE(
  _req: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const { id: idRaw } = await Promise.resolve(context.params);
  const id = await resolveCompanyId(idRaw);
  if (!id) {
    return NextResponse.json({ ok: false, error: "Company not found" }, { status: 404 });
  }

  try {
    const [header] = await pool.execute<ResultSetHeader>("DELETE FROM `companies` WHERE `id` = ?", [id]);
    if (header.affectedRows === 0) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
  } catch (e: unknown) {
    const err = e as { code?: string; errno?: number };
    if (err.errno === 1451 || err.code === "ER_ROW_IS_REFERENCED_2") {
      return NextResponse.json(
        { ok: false, error: "Cannot delete: company is still referenced by other records." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const });
}
