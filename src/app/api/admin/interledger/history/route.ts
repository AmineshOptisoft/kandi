import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdminPermission } from "@/lib/require-admin-api";
import type { RowDataPacket } from "mysql2/promise";

type InterledgerRow = RowDataPacket & {
  id: number;
  transfer_date: string;
  source_agent_id: number;
  source_agent_name: string;
  dest_agent_id: number;
  dest_agent_name: string;
  source_type: string;
  dest_type: string;
  amount: number | string;
  remark: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  const auth = await requireAdminPermission("view_security_deposits");
  if (!auth.ok) return auth.response;

  try {
    const [rows] = await pool.execute<InterledgerRow[]>(
      `SELECT i.*, 
              COALESCE(NULLIF(sa.fullname, ''), sa.username) AS source_agent_name,
              COALESCE(NULLIF(da.fullname, ''), da.username) AS dest_agent_name
       FROM \`interledger_entries\` i
       LEFT JOIN \`agents\` sa ON sa.id = i.source_agent_id
       LEFT JOIN \`agents\` da ON da.id = i.dest_agent_id
       ORDER BY i.id DESC
       LIMIT 500`
    );

    const items = rows.map((r) => ({
      id: String(r.id),
      transferDate: r.transfer_date,
      sourceAgentId: r.source_agent_id,
      sourceAgentName: r.source_agent_name || `#${r.source_agent_id}`,
      destAgentId: r.dest_agent_id,
      destAgentName: r.dest_agent_name || `#${r.dest_agent_id}`,
      sourceType: r.source_type,
      destType: r.dest_type,
      amount: Number(r.amount),
      remark: r.remark,
      createdAt: r.created_at,
    }));

    return NextResponse.json({ ok: true as const, items });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Could not fetch interledger history" }, { status: 500 });
  }
}
