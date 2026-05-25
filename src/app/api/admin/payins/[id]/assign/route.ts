import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import { canAssignPayIn } from "@/lib/payin-lifecycle";
import { emitTransactionRealtime } from "@/lib/realtime/broadcast-transaction";
import { AGENT_BLOCKED_ASSIGN_MSG, isAgentActiveForAssignment } from "@/lib/party-status";
import { requireAdminPermission } from "@/lib/require-admin-api";

type TxRow = RowDataPacket & {
  id: number;
  status: string;
  amount: string | number;
  pay_method_id: number | null;
};

type AgentRow = RowDataPacket & {
  id: number;
  status: string;
};

type PayMethodRow = RowDataPacket & {
  id: number;
  upi_id: string | null;
  payment_method: string;
  bank_name: string | null;
  account_no: string | null;
  ifsc_code: string | null;
  branch_name: string | null;
  account_holder_name: string | null;
};

function num(v: string | number): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  const auth = await requireAdminPermission("assign_payins");
  if (!auth.ok) return auth.response;

  const { id: idRaw } = await Promise.resolve(context.params);
  const txId = Number(idRaw);
  if (!Number.isInteger(txId) || txId < 1) {
    return NextResponse.json({ ok: false, error: "Invalid payin id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const agentId = Number(body.agentId);
  const payMethodId = Number(body.payMethodId);
  if (!Number.isInteger(agentId) || agentId < 1 || !Number.isInteger(payMethodId) || payMethodId < 1) {
    return NextResponse.json({ ok: false, error: "Valid agentId and payMethodId required" }, { status: 400 });
  }

  const [txRows] = await pool.execute<TxRow[]>(
    "SELECT `id`, `status`, `amount`, `pay_method_id` FROM `transactions` WHERE `id` = ? AND `type` = 'PAYIN' LIMIT 1",
    [txId],
  );
  const tx = txRows[0];
  if (!tx) return NextResponse.json({ ok: false, error: "PayIn not found" }, { status: 404 });

  const st = String(tx.status ?? "").trim().toUpperCase();
  if (st === "PENDING" && tx.pay_method_id != null) {
    return NextResponse.json(
      { ok: false, error: "This pay-in is already assigned to an account. Re-assign is blocked." },
      { status: 409 },
    );
  }
  if (!canAssignPayIn(tx.status)) {
    return NextResponse.json({ ok: false, error: `Cannot assign payin while status is ${tx.status}` }, { status: 409 });
  }

  const [agentRows] = await pool.execute<AgentRow[]>(
    "SELECT `id`, `status` FROM `agents` WHERE `id` = ? LIMIT 1",
    [agentId],
  );
  const agentRow = agentRows[0];
  if (!agentRow) {
    return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
  }
  if (!isAgentActiveForAssignment(agentRow.status)) {
    return NextResponse.json({ ok: false, error: AGENT_BLOCKED_ASSIGN_MSG }, { status: 409 });
  }

  const [payMethods] = await pool.execute<PayMethodRow[]>(
    `SELECT \`id\`, \`upi_id\`, \`payment_method\`, \`bank_name\`, \`account_no\`, \`ifsc_code\`, \`branch_name\`, \`account_holder_name\`
     FROM \`pay_methods\`
     WHERE \`id\` = ? AND \`agent_id\` = ? AND \`status\` = 'ACTIVE' AND \`enable_pay_in\` = 1
     LIMIT 1`,
    [payMethodId, agentId],
  );
  const pm = payMethods[0];
  if (!pm) return NextResponse.json({ ok: false, error: "payMethodId is not an active payin account for this agent" }, { status: 400 });

  const amt = num(tx.amount);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [inc] = await conn.execute<ResultSetHeader>(
      `UPDATE \`pay_methods\`
       SET \`today_total_pay_in_amount\` = \`today_total_pay_in_amount\` + ?
       WHERE \`id\` = ? AND \`agent_id\` = ? AND \`status\` = 'ACTIVE' AND \`enable_pay_in\` = 1
         AND (\`pay_in_limit\` <= 0 OR (\`today_total_pay_in_amount\` + ?) <= \`pay_in_limit\`)`,
      [amt, payMethodId, agentId, amt],
    );
    if (inc.affectedRows === 0) {
      await conn.rollback();
      return NextResponse.json({ ok: false, error: "Account pay-in limit reached or account inactive" }, { status: 409 });
    }

    const [res] = await conn.execute<ResultSetHeader>(
      `UPDATE \`transactions\`
       SET \`assigned_agent_id\` = ?,
           \`pay_method_id\` = ?,
           \`assigned_upi\` = ?,
           \`payment_method\` = ?,
           \`bank_name\` = ?,
           \`bank_account_number\` = ?,
           \`ifsc_code\` = ?,
           \`branch_name\` = ?,
           \`account_holder_name\` = ?,
           \`assigned_by\` = ?,
           \`status\` = 'PENDING',
           \`assigned_date\` = NOW(),
           \`not_assigned_date\` = NULL
       WHERE \`id\` = ? AND \`type\` = 'PAYIN'
         AND (\`status\` = 'NOT_ASSIGNED' OR (\`status\` = 'PENDING' AND \`pay_method_id\` IS NULL))`,
      [
        agentId,
        payMethodId,
        pm.upi_id,
        pm.payment_method,
        pm.bank_name ?? null,
        pm.account_no ?? null,
        pm.ifsc_code ?? null,
        pm.branch_name ?? null,
        pm.account_holder_name ?? null,
        payMethodId,
        txId,
      ],
    );
    if (res.affectedRows === 0) {
      await conn.rollback();
      return NextResponse.json({ ok: false, error: "Could not assign pay-in (status changed or not assignable)" }, { status: 409 });
    }

    await conn.commit();
    emitTransactionRealtime(txId, "assign");
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  return NextResponse.json({ ok: true as const });
}
