import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AdminRole } from "@/lib/session";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/session";
import { pool } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";
import type { Permission } from "@/lib/admin-permissions";

export async function hasAdminPermission(
  adminId: number,
  role: string,
  permission: Permission,
): Promise<boolean> {
  if (role === "SUPER_ADMIN") return true;

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT \`${permission}\` FROM \`admin_permissions\` WHERE \`admin_id\` = ? LIMIT 1`,
    [adminId],
  );

  if (!rows[0]) return false;
  return Boolean(rows[0][permission]);
}

export type AdminSessionOk = {
  ok: true;
  adminId: number;
  role: AdminRole;
  isSuperAdmin: boolean;
};

export async function requireAdminSession(): Promise<
  AdminSessionOk | { ok: false; response: NextResponse }
> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 }) };
  }
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const session = token ? verifyAdminSession(token, secret) : null;
  if (!session) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }
  return {
    ok: true,
    adminId: session.adminId,
    role: session.role,
    isSuperAdmin: session.role === "SUPER_ADMIN",
  };
}

export async function requireAdminPermission(
  permission: Permission,
): Promise<AdminSessionOk | { ok: false; response: NextResponse }> {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth;

  const hasPerm = await hasAdminPermission(auth.adminId, auth.role, permission);
  if (!hasPerm) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: `Forbidden: requires ${permission} privilege` },
        { status: 403 },
      ),
    };
  }

  return auth;
}
