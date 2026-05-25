import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import {
  createCompanyApiKey,
  isMissingCompanyApiKeysTable,
  listCompanyApiKeys,
} from "@/lib/company-api-keys";
import { requireAdminSession } from "@/lib/require-admin-api";

async function resolveCompanyId(idRaw: string): Promise<number | null> {
  const isNumeric = /^\d+$/.test(idRaw);
  if (isNumeric) {
    const id = Number(idRaw);
    if (Number.isInteger(id) && id >= 1) return id;
  }
  const [rows] = await pool.execute<any[]>(
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
  const companyId = await resolveCompanyId(idRaw);
  if (!companyId) {
    return NextResponse.json({ ok: false, error: "Company not found" }, { status: 404 });
  }

  try {
    const keys = await listCompanyApiKeys(pool, companyId);
    return NextResponse.json({ ok: true as const, keys });
  } catch (e) {
    if (isMissingCompanyApiKeysTable(e)) {
      return NextResponse.json(
        {
          ok: false,
          error: "API keys table missing. Run database/migrations/009_company_api_keys.sql on your DB.",
        },
        { status: 500 },
      );
    }
    throw e;
  }
}

export async function POST(
  req: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const { id: idRaw } = await Promise.resolve(context.params);
  const companyId = await resolveCompanyId(idRaw);
  if (!companyId) {
    return NextResponse.json({ ok: false, error: "Company not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";

  try {
    const created = await createCompanyApiKey(pool, companyId, label);
    return NextResponse.json({
      ok: true as const,
      key: created.key,
      fullKey: created.fullKey,
    });
  } catch (e) {
    if (isMissingCompanyApiKeysTable(e)) {
      return NextResponse.json(
        {
          ok: false,
          error: "API keys table missing. Run database/migrations/009_company_api_keys.sql on your DB.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: false, error: "Could not create API key" }, { status: 500 });
  }
}
