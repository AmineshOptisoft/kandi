import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "@/lib/db";
import { requireSuperAdminSession } from "@/lib/require-super-admin-api";
import { ALL_PERMISSIONS, noPermissionsGranted, isValidPermission } from "@/lib/admin-permissions";
import { logAdminActivity, getIpFromRequest } from "@/lib/admin-activity-log";

type PermRow = RowDataPacket & Record<string, unknown>;

export async function GET(
  _req: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  const auth = await requireSuperAdminSession();
  if (!auth.ok) return auth.response;

  const { id: idRaw } = await Promise.resolve(context.params);
  const adminId = Number(idRaw);
  if (!Number.isInteger(adminId) || adminId < 1) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const [rows] = await pool.execute<PermRow[]>(
    `SELECT * FROM \`admin_permissions\` WHERE \`admin_id\` = ? LIMIT 1`,
    [adminId],
  );

  const row = rows[0];
  const permissions = row
    ? Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, Boolean(row[p])]))
    : noPermissionsGranted();

  return NextResponse.json({ ok: true as const, permissions });
}

export async function PUT(
  req: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  const auth = await requireSuperAdminSession();
  if (!auth.ok) return auth.response;

  const { id: idRaw } = await Promise.resolve(context.params);
  const adminId = Number(idRaw);
  if (!Number.isInteger(adminId) || adminId < 1) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  // Verify target is a regular ADMIN (cannot set permissions on SUPER_ADMIN)
  const [adminRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(role,'SUPER_ADMIN') AS role FROM \`admin\` WHERE \`admin_id\` = ? LIMIT 1`,
    [adminId],
  );
  const target = adminRows[0] as { role: string } | undefined;
  if (!target) return NextResponse.json({ ok: false, error: "Admin not found" }, { status: 404 });
  if (target.role === "SUPER_ADMIN") {
    return NextResponse.json({ ok: false, error: "Super Admins always have full access — no explicit permissions needed" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const permVals = ALL_PERMISSIONS.map((p) => (Boolean(body[p]) ? 1 : 0));
  const cols = ALL_PERMISSIONS.map((p) => `\`${p}\``).join(", ");
  const placeholders = ALL_PERMISSIONS.map(() => "?").join(", ");
  const updates = ALL_PERMISSIONS.map((p) => `\`${p}\` = VALUES(\`${p}\`)`).join(", ");

  await pool.execute<ResultSetHeader>(
    `INSERT INTO \`admin_permissions\` (\`admin_id\`, ${cols})
     VALUES (?, ${placeholders})
     ON DUPLICATE KEY UPDATE ${updates}`,
    [adminId, ...permVals],
  );

  const granted = ALL_PERMISSIONS.filter((p, i) => permVals[i] === 1);
  void logAdminActivity({
    adminId: auth.adminId,
    action: "UPDATE_PERMISSIONS",
    targetType: "admin",
    targetId: adminId,
    details: { granted },
    ipAddress: getIpFromRequest(req),
  });

  return NextResponse.json({ ok: true as const });
}
