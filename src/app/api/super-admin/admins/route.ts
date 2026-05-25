import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "@/lib/db";
import { requireAdminPermission } from "@/lib/require-admin-api";
import { hashPassword } from "@/lib/auth-password";
import { ALL_PERMISSIONS, noPermissionsGranted } from "@/lib/admin-permissions";
import type { Permission } from "@/lib/admin-permissions";
import { logAdminActivity, getIpFromRequest } from "@/lib/admin-activity-log";

type AdminRow = RowDataPacket & {
  admin_id: number;
  email: string;
  fullname: string | null;
  role: string;
  status: string;
  created_at: string | null;
  created_by: number | null;
  creator_email: string | null;
};

type PermRow = RowDataPacket & Record<string, unknown>;

export async function GET(req: Request) {
  const auth = await requireAdminPermission("view_admins");
  if (!auth.ok) return auth.response;

  const [rows] = await pool.execute<AdminRow[]>(
    `SELECT a.admin_id, a.email, a.fullname, 
            COALESCE(a.role,'SUPER_ADMIN') AS role,
            COALESCE(a.status,'ACTIVE') AS status,
            a.created_at,
            a.created_by,
            c.email AS creator_email
     FROM \`admin\` a
     LEFT JOIN \`admin\` c ON c.admin_id = a.created_by
     ORDER BY a.admin_id ASC`,
  );

  // Load all permissions in one query
  const [permRows] = await pool.execute<PermRow[]>(
    `SELECT * FROM \`admin_permissions\``,
  );
  const permMap = new Map<number, Record<string, boolean>>();
  for (const pr of permRows) {
    const id = pr.admin_id as number;
    const perms: Record<string, boolean> = {};
    for (const p of ALL_PERMISSIONS) {
      perms[p] = Boolean(pr[p]);
    }
    permMap.set(id, perms);
  }

  const admins = rows.map((r) => ({
    adminId: r.admin_id,
    email: r.email,
    fullname: r.fullname ?? "",
    role: r.role,
    status: r.status,
    createdAt: r.created_at,
    createdBy: r.created_by,
    creatorEmail: r.creator_email ?? null,
    permissions: r.role === "SUPER_ADMIN"
      ? Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, true]))
      : (permMap.get(r.admin_id) ?? noPermissionsGranted()),
  }));

  return NextResponse.json({ ok: true as const, admins });
}

export async function POST(req: Request) {
  const auth = await requireAdminPermission("create_admins");
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password.trim() : "";
  const fullname = typeof body.fullname === "string" ? body.fullname.trim() : "";
  const permissionsInput = (body.permissions ?? {}) as Record<string, unknown>;

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Email and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const hashed = await hashPassword(password);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO \`admin\` (\`email\`, \`fullname\`, \`role\`, \`status\`, \`password\`, \`created_by\`)
       VALUES (?, ?, 'ADMIN', 'ACTIVE', ?, ?)`,
      [email, fullname || null, hashed, auth.adminId],
    );
    const newAdminId = result.insertId;

    // Build permission row
    const permCols = ALL_PERMISSIONS.join("`, `");
    const permVals = ALL_PERMISSIONS.map((p) => (Boolean(permissionsInput[p as Permission]) ? 1 : 0));

    await conn.execute(
      `INSERT INTO \`admin_permissions\` (\`admin_id\`, \`${permCols}\`) VALUES (?, ${ALL_PERMISSIONS.map(() => "?").join(", ")})`,
      [newAdminId, ...permVals],
    );

    await conn.commit();

    void logAdminActivity({
      adminId: auth.adminId,
      action: "CREATE_ADMIN",
      targetType: "admin",
      targetId: newAdminId,
      details: { email, fullname, permissions: permissionsInput },
      ipAddress: getIpFromRequest(req),
    });

    return NextResponse.json({ ok: true as const, adminId: newAdminId });
  } catch (e: unknown) {
    await conn.rollback();
    const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "ER_DUP_ENTRY") {
      return NextResponse.json({ ok: false, error: "An admin with that email already exists" }, { status: 409 });
    }
    console.error("[super-admin/admins POST]", e);
    return NextResponse.json({ ok: false, error: "Could not create admin" }, { status: 500 });
  } finally {
    conn.release();
  }
}
