import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import { requireAdminSession, hasAdminPermission } from "@/lib/require-admin-api";

type TxRow = RowDataPacket & {
  id: number;
  order_id: string;
  type: string;
  amount: string | number;
  status: string;
  created_at: Date | string | null;
  updated_at: Date | string | null;
  client_name: string | null;
  client_upi: string | null;
  user_upi: string | null;
  utr_code: string | null;
  payment_method: string | null;
  assigned_upi: string | null;
  bank_account_number: string | null;
  ifsc_code: string | null;
  bank_name: string | null;
  account_holder_name: string | null;
  assigned_agent_id: number | null;
  approved_date: Date | string | null;
  rejected_date: Date | string | null;
  assigned_date: Date | string | null;
};

type AgentRow = RowDataPacket & {
  id: number;
  fullname: string | null;
  username: string;
};

function toIso(v: Date | string | null): string | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function num(v: string | number): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export async function GET(_req: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const { id: idRaw } = await Promise.resolve(context.params);
  const txId = Number(idRaw);
  if (!Number.isInteger(txId) || txId < 1) {
    return NextResponse.json({ ok: false, error: "Invalid transaction id" }, { status: 400 });
  }

  const [rows] = await pool.execute<TxRow[]>(
    `SELECT
      \`id\`, \`order_id\`, \`type\`, \`amount\`, \`status\`, \`created_at\`, \`updated_at\`,
      \`client_name\`, \`client_upi\`, \`user_upi\`, \`utr_code\`, \`payment_method\`,
      \`assigned_upi\`, \`bank_account_number\`, \`ifsc_code\`, \`bank_name\`, \`account_holder_name\`,
      \`assigned_agent_id\`, \`approved_date\`, \`rejected_date\`, \`assigned_date\`
     FROM \`transactions\`
     WHERE \`id\` = ?
     LIMIT 1`,
     [txId],
  );
  const tx = rows[0];
  if (!tx) return NextResponse.json({ ok: false, error: "Transaction not found" }, { status: 404 });

  const txType = String(tx.type).toUpperCase();
  const primaryPermission = txType === "PAYOUT" ? "view_payouts" : "view_payins";
  const hasPerm = await hasAdminPermission(auth.adminId, auth.role, "view_transactions") ||
                  await hasAdminPermission(auth.adminId, auth.role, primaryPermission);
  if (!hasPerm) {
    return NextResponse.json(
      { ok: false, error: `Forbidden: requires view_transactions or ${primaryPermission} privilege` },
      { status: 403 },
    );
  }

  let assignedAgent = "—";
  if (tx.assigned_agent_id) {
    const [agentRows] = await pool.execute<AgentRow[]>(
      "SELECT `id`, `fullname`, `username` FROM `agents` WHERE `id` = ? LIMIT 1",
      [tx.assigned_agent_id],
    );
    const a = agentRows[0];
    if (a) assignedAgent = `${(a.fullname && a.fullname.trim()) || a.username} (${a.username})`;
  }

  const history: Array<{ at: string; label: string; note: string }> = [];
  const created = toIso(tx.created_at);
  if (created) history.push({ at: created, label: "INITIATED", note: "Transaction created" });
  const assigned = toIso(tx.assigned_date);
  if (assigned) history.push({ at: assigned, label: "ASSIGNED", note: "Assigned to agent" });
  const approved = toIso(tx.approved_date);
  if (approved) history.push({ at: approved, label: "APPROVED", note: "Transaction approved" });
  const rejected = toIso(tx.rejected_date);
  if (rejected) history.push({ at: rejected, label: "REJECTED", note: "Transaction rejected" });
  const updated = toIso(tx.updated_at);
  if (updated && !history.some((h) => h.at === updated)) {
    history.push({ at: updated, label: String(tx.status).toUpperCase(), note: "Status updated" });
  }
  history.sort((a, b) => (a.at > b.at ? 1 : -1));

  return NextResponse.json({
    ok: true as const,
    transaction: {
      id: tx.id,
      orderId: tx.order_id,
      type: String(tx.type).toUpperCase(),
      amount: num(tx.amount),
      status: String(tx.status).toUpperCase(),
      createdAt: toIso(tx.created_at),
      updatedAt: toIso(tx.updated_at),
      clientName: tx.client_name ?? "—",
      clientUpi: tx.client_upi ?? tx.user_upi ?? "—",
      utrCode: tx.utr_code ?? "N/A",
      paymentMethod: tx.payment_method ?? "N/A",
      assignedUpi: tx.assigned_upi ?? "Not Provided",
      bankName: tx.bank_name ?? "N/A",
      accountNo: tx.bank_account_number ?? "N/A",
      ifsc: tx.ifsc_code ?? "N/A",
      accountHolder: tx.account_holder_name ?? "N/A",
      assignedAgent,
      history,
    },
  });
}
