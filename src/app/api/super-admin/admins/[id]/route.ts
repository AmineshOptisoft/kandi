import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "@/lib/db";
import { requireSuperAdminSession } from "@/lib/require-super-admin-api";
import { hashPassword } from "@/lib/auth-password";
import { logAdminActivity, getIpFromRequest } from "@/lib/admin-activity-log";

type AdminRow = RowDataPacket & {
  admin_id: number;
  email: string;
  fullname: string | null;
  role: string;
  status: string;
};

async function getAdmin(id: number): Promise<AdminRow | null> {
  const [rows] = await pool.execute<AdminRow[]>(
    `SELECT admin_id, email, fullname, COALESCE(role,'SUPER_ADMIN') AS role, COALESCE(status,'ACTIVE') AS status
     FROM \`admin\` WHERE admin_id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

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

  const admin = await getAdmin(adminId);
  if (!admin) return NextResponse.json({ ok: false, error: "Admin not found" }, { status: 404 });

  return NextResponse.json({ ok: true as const, admin });
}

export async function PATCH(
  req: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  const auth = await requireSuperAdminSession();
  if (!auth.ok) return auth.response;

  const { id: idRaw } = await Promise.resolve(context.params);
  const targetId = Number(idRaw);
  if (!Number.isInteger(targetId) || targetId < 1) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  // Prevent super admin from editing their own role/status
  const existing = await getAdmin(targetId);
  if (!existing) return NextResponse.json({ ok: false, error: "Admin not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const sets: string[] = [];
  const params: any[] = [];

  if (typeof body.fullname === "string") {
    sets.push("`fullname` = ?");
    params.push(body.fullname.trim() || null);
  }
  if (typeof body.email === "string") {
    const e = body.email.trim().toLowerCase();
    if (e) { sets.push("`email` = ?"); params.push(e); }
  }
  if (typeof body.status === "string") {
    const s = body.status.toUpperCase();
    if (["ACTIVE", "INACTIVE", "SUSPENDED"].includes(s)) {
      // Cannot change status of another SUPER_ADMIN
      if (existing.role === "SUPER_ADMIN" && targetId !== auth.adminId) {
        return NextResponse.json({ ok: false, error: "Cannot change status of a Super Admin" }, { status: 403 });
      }
      sets.push("`status` = ?");
      params.push(s);
    }
  }
  if (typeof body.password === "string" && body.password.trim().length >= 8) {
    const hashed = await hashPassword(body.password.trim());
    sets.push("`password` = ?");
    params.push(hashed);
  }

  if (sets.length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  }

  params.push(targetId);
  await pool.execute<ResultSetHeader>(
    `UPDATE \`admin\` SET ${sets.join(", ")} WHERE \`admin_id\` = ?`,
    params as any[],
  );

  void logAdminActivity({
    adminId: auth.adminId,
    action: "UPDATE_ADMIN",
    targetType: "admin",
    targetId,
    details: { fields: sets.map((s) => s.split("`")[1]) },
    ipAddress: getIpFromRequest(req),
  });

  return NextResponse.json({ ok: true as const });
}

export async function DELETE(
  req: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  const auth = await requireSuperAdminSession();
  if (!auth.ok) return auth.response;

  const { id: idRaw } = await Promise.resolve(context.params);
  const targetId = Number(idRaw);
  if (!Number.isInteger(targetId) || targetId < 1) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }
  if (targetId === auth.adminId) {
    return NextResponse.json({ ok: false, error: "Cannot delete your own account" }, { status: 400 });
  }

  const existing = await getAdmin(targetId);
  if (!existing) return NextResponse.json({ ok: false, error: "Admin not found" }, { status: 404 });
  if (existing.role === "SUPER_ADMIN") {
    return NextResponse.json({ ok: false, error: "Cannot delete another Super Admin" }, { status: 403 });
  }

  await pool.execute(`DELETE FROM \`admin\` WHERE \`admin_id\` = ?`, [targetId]);

  void logAdminActivity({
    adminId: auth.adminId,
    action: "DELETE_ADMIN",
    targetType: "admin",
    targetId,
    details: { email: existing.email },
    ipAddress: getIpFromRequest(req),
  });

  return NextResponse.json({ ok: true as const });
}
