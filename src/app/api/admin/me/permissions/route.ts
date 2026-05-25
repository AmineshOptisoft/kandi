import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import { requireAdminSession } from "@/lib/require-admin-api";
import { ALL_PERMISSIONS, allPermissionsGranted, noPermissionsGranted } from "@/lib/admin-permissions";

type PermRow = RowDataPacket & Record<string, unknown>;

/**
 * GET /api/admin/me/permissions
 * Returns the permission map for the currently logged-in admin.
 * SUPER_ADMIN gets all permissions granted implicitly.
 */
export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  // Super admin always has every permission
  if (auth.isSuperAdmin) {
    return NextResponse.json({ ok: true as const, isSuperAdmin: true, permissions: allPermissionsGranted() });
  }

  const [rows] = await pool.execute<PermRow[]>(
    `SELECT * FROM \`admin_permissions\` WHERE \`admin_id\` = ? LIMIT 1`,
    [auth.adminId],
  );

  const row = rows[0];
  const permissions = row
    ? Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, Boolean(row[p])]))
    : noPermissionsGranted();

  return NextResponse.json({ ok: true as const, isSuperAdmin: false, permissions });
}
