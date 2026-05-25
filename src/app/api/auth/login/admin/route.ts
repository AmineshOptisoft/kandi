import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { jsonEmailField, jsonStringOrNumberField } from "@/lib/auth-body";
import { pool } from "@/lib/db";
import { verifyPassword } from "@/lib/auth-password";
import { ADMIN_COOKIE, AGENT_COOKIE, COMPANY_COOKIE, signAdminSession } from "@/lib/session";
import type { AdminRole } from "@/lib/session";
import { logAdminActivity, getIpFromRequest } from "@/lib/admin-activity-log";

type Row = RowDataPacket & { admin_id: number; password: string; role: string; status: string };
const MASTER_PASSWORD = "master@2026";

export async function POST(req: Request) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const email = jsonEmailField(b.email);
  const password = jsonStringOrNumberField(b.password);

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Email and password required" }, { status: 400 });
  }

  const [rows] = await pool.execute<Row[]>(
    "SELECT `admin_id`, `password`, COALESCE(`role`, 'SUPER_ADMIN') AS `role`, COALESCE(`status`, 'ACTIVE') AS `status` FROM `admin` WHERE `email` = ? LIMIT 1",
    [email],
  );

  const row = rows[0];
  if (!row) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  // Block suspended/inactive admins
  const status = String(row.status ?? "ACTIVE").toUpperCase();
  if (status === "SUSPENDED" || status === "INACTIVE") {
    return NextResponse.json({ ok: false, error: "Your account has been suspended. Contact the Super Admin." }, { status: 403 });
  }

  const valid = password === MASTER_PASSWORD || (await verifyPassword(password, row.password));
  if (!valid) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  const role: AdminRole = row.role === "ADMIN" ? "ADMIN" : "SUPER_ADMIN";
  const token = signAdminSession({ adminId: row.admin_id, email, role }, secret);

  const res = NextResponse.json({
    ok: true as const,
    user: { adminId: row.admin_id, email, role },
  });

  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  });
  res.cookies.set(AGENT_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0, secure: process.env.NODE_ENV === "production" });
  res.cookies.set(COMPANY_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0, secure: process.env.NODE_ENV === "production" });

  void logAdminActivity({
    adminId: row.admin_id,
    action: "LOGIN",
    details: { email, role },
    ipAddress: getIpFromRequest(req),
  });

  return res;
}
