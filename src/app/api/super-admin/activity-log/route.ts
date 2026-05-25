import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import { requireAdminPermission } from "@/lib/require-admin-api";

type LogRow = RowDataPacket & {
  id: number;
  admin_id: number;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
  admin_email: string | null;
  admin_fullname: string | null;
};

export async function GET(req: Request) {
  const auth = await requireAdminPermission("view_admins");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const adminId = searchParams.get("admin_id");
  const action = searchParams.get("action");
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500);
  const offset = Math.max(Number(searchParams.get("offset") ?? "0"), 0);

  const conditions: string[] = [];
  const params: any[] = [];

  if (adminId && Number.isInteger(Number(adminId))) {
    conditions.push("l.`admin_id` = ?");
    params.push(Number(adminId));
  }
  if (action) {
    conditions.push("l.`action` = ?");
    params.push(action.toUpperCase());
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit, offset);

  const [rows] = await pool.execute<LogRow[]>(
    `SELECT l.*, a.email AS admin_email, a.fullname AS admin_fullname
     FROM \`admin_activity_log\` l
     LEFT JOIN \`admin\` a ON a.admin_id = l.admin_id
     ${where}
     ORDER BY l.created_at DESC
     LIMIT ? OFFSET ?`,
    params,
  );

  const logs = rows.map((r) => ({
    id: r.id,
    adminId: r.admin_id,
    adminEmail: r.admin_email ?? "",
    adminFullname: r.admin_fullname ?? "",
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    details: r.details ? (JSON.parse(r.details) as unknown) : null,
    ipAddress: r.ip_address,
    createdAt: r.created_at,
  }));

  return NextResponse.json({ ok: true as const, logs });
}
