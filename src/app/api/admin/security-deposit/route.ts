import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdminPermission } from "@/lib/require-admin-api";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { logAdminActivity, getIpFromRequest } from "@/lib/admin-activity-log";

type SecurityLogRow = RowDataPacket & {
  id: number;
  agent_id: number;
  amount: string | number;
  remark: string | null;
  created_by: number | null;
  transaction_type: string;
  previous_balance_snapshot: string | number;
  running_balance_snapshot: string | number;
  created_at: Date | string | null;
  agent_name?: string | null;
};

function formatDt(v: Date | string | null): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapRow(r: SecurityLogRow) {
  const amount = Number(r.amount);
  const txnType = String(r.transaction_type).toUpperCase();
  return {
    id: String(r.id),
    agentId: Number(r.agent_id),
    agentName: (r.agent_name ?? "").trim() || `#${r.agent_id}`,
    amount,
    remark: r.remark || "—",
    createdBy: r.created_by,
    transactionType: txnType,
    displayType: txnType === "CREDIT" ? "Credit" : "Debit",
    previousBalanceSnapshot: Number(r.previous_balance_snapshot),
    runningBalanceSnapshot: Number(r.running_balance_snapshot),
    createdAt: formatDt(r.created_at),
  };
}

export async function GET(req: Request) {
  const auth = await requireAdminPermission("view_security_deposits");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId")?.trim() ?? "";
  const from = searchParams.get("from")?.trim() ?? "";
  const to = searchParams.get("to")?.trim() ?? "";

  const where: string[] = ["1=1"];
  const params: (string | number | Date)[] = [];

  if (agentId) {
    const aid = Number(agentId);
    if (Number.isInteger(aid) && aid > 0) {
      where.push("l.`agent_id` = ?");
      params.push(aid);
    }
  }

  if (from) {
    const dFrom = new Date(from);
    if (!Number.isNaN(dFrom.getTime())) {
      where.push("l.`created_at` >= ?");
      params.push(dFrom);
    }
  }

  if (to) {
    const dTo = new Date(to);
    if (!Number.isNaN(dTo.getTime())) {
      where.push("l.`created_at` <= ?");
      params.push(dTo);
    }
  }

  try {
    const [rows] = await pool.execute<SecurityLogRow[]>(
      `SELECT l.*, COALESCE(NULLIF(a.\`fullname\`, ''), a.\`username\`) AS agent_name
       FROM \`agent_security_logs\` l
       LEFT JOIN \`agents\` a ON a.\`id\` = l.\`agent_id\`
       WHERE ${where.join(" AND ")}
       ORDER BY l.\`id\` DESC
       LIMIT 500`,
      params
    );
    return NextResponse.json({ ok: true as const, items: rows.map(mapRow) });
  } catch (err: any) {
    console.error(err);
    if (err?.code === "ER_NO_SUCH_TABLE") {
      return NextResponse.json({ ok: true as const, items: [] });
    }
    return NextResponse.json({ ok: false, error: "Could not load security logs" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminPermission("create_security_deposits");
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const { subadminId, amount, remarks, txType } = body;

  if (!subadminId || !amount) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  const agentId = Number(subadminId);
  const amountVal = Number(amount);
  if (!Number.isFinite(amountVal) || amountVal <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 });
  }

  const remarkVal = remarks ? String(remarks) : null;
  const txnType = String(txType).toUpperCase() === "DEBIT" ? "DEBIT" : "CREDIT";
  const diff = txnType === "DEBIT" ? -amountVal : amountVal;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [agentRows] = await conn.execute<RowDataPacket[]>(
      "SELECT `security_deposit` FROM `agents` WHERE `id` = ? FOR UPDATE",
      [agentId]
    );

    if (agentRows.length === 0) {
      await conn.rollback();
      return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
    }

    const prevSecurityDeposit = Number(agentRows[0].security_deposit);
    const newSecurityDeposit = prevSecurityDeposit + diff;

    await conn.execute(
      "UPDATE `agents` SET `security_deposit` = ? WHERE `id` = ?",
      [newSecurityDeposit, agentId]
    );

    await conn.execute(
      `INSERT INTO \`agent_security_logs\` (
        \`agent_id\`, \`amount\`, \`remark\`, \`created_by\`, \`transaction_type\`,
        \`previous_balance_snapshot\`, \`running_balance_snapshot\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        agentId,
        amountVal,
        remarkVal,
        auth.adminId,
        txnType,
        prevSecurityDeposit,
        newSecurityDeposit
      ]
    );

    await conn.commit();

    void logAdminActivity({
      adminId: auth.adminId,
      action: "UPDATE_SECURITY_DEPOSIT",
      targetType: "agent",
      targetId: agentId,
      details: { amount: amountVal, transactionType: txnType, remark: remarkVal, previous: prevSecurityDeposit, current: newSecurityDeposit },
      ipAddress: getIpFromRequest(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  } finally {
    conn.release();
  }
}

