import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import { DISPUTE_BLOCKS_ACTION_MSG, isOpenDispute } from "@/lib/dispute";
import { emitTransactionRealtime } from "@/lib/realtime/broadcast-transaction";
import { canAdminAssign } from "@/lib/payout-lifecycle";
import { AGENT_BLOCKED_ASSIGN_MSG, isAgentActiveForAssignment } from "@/lib/party-status";
import { requireAdminPermission } from "@/lib/require-admin-api";
import { getPayoutAgentApproveDelayMinutesFromEnv } from "@/lib/payout-agent-approve-delay";
import { REQUEST_EXPIRE_MINUTES } from "@/lib/request-expiry";

type TxRow = RowDataPacket & {
  id: number;
  status: string;
  amount: string | number;
  dispute_raised: number;
  dispute_state: string | null;
};

type AgentRow = RowDataPacket & {
  id: number;
  status: string;
};

type PayMethodRow = RowDataPacket & {
  id: number;
};

function num(v: string | number): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** Returns pay_method id if this line can accept this payout amount today (active + pay-out enabled + limit). */
async function findEligiblePayOutMethodId(
  conn: Awaited<ReturnType<typeof pool.getConnection>>,
  agentId: number,
  amount: number,
  preferredPayMethodId: number | null,
): Promise<number | null> {
  if (amount <= 0) return preferredPayMethodId;

  if (preferredPayMethodId != null) {
    const [rows] = await conn.execute<PayMethodRow[]>(
      `SELECT \`id\` FROM \`pay_methods\`
       WHERE \`id\` = ? AND \`agent_id\` = ?
         AND UPPER(TRIM(\`status\`)) = 'ACTIVE'
         AND \`enable_pay_out\` = 1
       LIMIT 1`,
      [preferredPayMethodId, agentId],
    );
    return rows[0]?.id ?? null;
  }

  const [rows] = await conn.execute<PayMethodRow[]>(
    `SELECT \`id\` FROM \`pay_methods\`
     WHERE \`agent_id\` = ?
       AND UPPER(TRIM(\`status\`)) = 'ACTIVE'
       AND \`enable_pay_out\` = 1
     ORDER BY \`id\` ASC
     LIMIT 1`,
    [agentId],
  );
  return rows[0]?.id ?? null;
}

export async function POST(req: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  const auth = await requireAdminPermission("assign_payouts");
  if (!auth.ok) return auth.response;

  const { id: idRaw } = await Promise.resolve(context.params);
  const txId = Number(idRaw);
  if (!Number.isInteger(txId) || txId < 1) {
    return NextResponse.json({ ok: false, error: "Invalid payout id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const agentId = Number(body.agentId);
  const payMethodId = body.payMethodId == null ? null : Number(body.payMethodId);
  if (!Number.isInteger(agentId) || agentId < 1) {
    return NextResponse.json({ ok: false, error: "Valid agentId required" }, { status: 400 });
  }
  if (payMethodId != null && (!Number.isInteger(payMethodId) || payMethodId < 1)) {
    return NextResponse.json({ ok: false, error: "payMethodId must be a positive number" }, { status: 400 });
  }

  let txRows: TxRow[];
  try {
    const [r] = await pool.execute<TxRow[]>(
      "SELECT `id`, `status`, `amount`, `dispute_raised`, `dispute_state` FROM `transactions` WHERE `id` = ? AND `type` = 'PAYOUT' LIMIT 1",
      [txId],
    );
    txRows = r;
  } catch {
    const [r] = await pool.execute<TxRow[]>(
      "SELECT `id`, `status`, `amount`, `dispute_raised` FROM `transactions` WHERE `id` = ? AND `type` = 'PAYOUT' LIMIT 1",
      [txId],
    );
    txRows = r.map((row) => ({ ...row, dispute_state: null }));
  }
  const tx = txRows[0];
  if (!tx) return NextResponse.json({ ok: false, error: "Payout not found" }, { status: 404 });
  if (isOpenDispute(tx.dispute_state, tx.dispute_raised)) {
    return NextResponse.json({ ok: false, error: DISPUTE_BLOCKS_ACTION_MSG }, { status: 409 });
  }
  if (!canAdminAssign(tx.status)) {
    return NextResponse.json({ ok: false, error: `Cannot assign payout while status is ${tx.status}` }, { status: 409 });
  }

  const [agents] = await pool.execute<AgentRow[]>(
    "SELECT `id`, `status` FROM `agents` WHERE `id` = ? LIMIT 1",
    [agentId],
  );
  const agentRow = agents[0];
  if (!agentRow) return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
  if (!isAgentActiveForAssignment(agentRow.status)) {
    return NextResponse.json({ ok: false, error: AGENT_BLOCKED_ASSIGN_MSG }, { status: 409 });
  }

  if (payMethodId != null) {
    const [payMethods] = await pool.execute<PayMethodRow[]>(
      "SELECT `id` FROM `pay_methods` WHERE `id` = ? AND `agent_id` = ? LIMIT 1",
      [payMethodId, agentId],
    );
    if (!payMethods[0]) {
      return NextResponse.json({ ok: false, error: "payMethodId does not belong to selected agent" }, { status: 400 });
    }
  }

  const amt = num(tx.amount);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const resolvedPayMethodId = await findEligiblePayOutMethodId(conn, agentId, amt, payMethodId);
    if (amt > 0 && resolvedPayMethodId == null) {
      await conn.rollback();
      return NextResponse.json(
        {
          ok: false,
          error:
            "This agent has no active pay-out line with Pay-out enabled and enough daily pay-out limit for this amount. Enable pay-out on a bank/UPI line or raise limits.",
        },
        { status: 409 },
      );
    }

    if (resolvedPayMethodId != null && amt > 0) {
      const [inc] = await conn.execute<ResultSetHeader>(
        `UPDATE \`pay_methods\`
         SET \`today_total_pay_out_amount\` = \`today_total_pay_out_amount\` + ?
         WHERE \`id\` = ? AND \`agent_id\` = ? AND UPPER(TRIM(\`status\`)) = 'ACTIVE' AND \`enable_pay_out\` = 1`,
        [amt, resolvedPayMethodId, agentId],
      );
      if (inc.affectedRows === 0) {
        await conn.rollback();
        return NextResponse.json(
          { ok: false, error: "Pay-out line became unavailable (status). Retry or pick another agent." },
          { status: 409 },
        );
      }
    }

    const delayMin = getPayoutAgentApproveDelayMinutesFromEnv();
    const totalMinutes = delayMin + REQUEST_EXPIRE_MINUTES;

    const [res] = await conn.execute<ResultSetHeader>(
      `UPDATE \`transactions\`
       SET \`assigned_agent_id\` = ?,
           \`pay_method_id\` = ?,
           \`status\` = 'PENDING',
           \`assigned_date\` = NOW(),
           \`expires_at\` = DATE_ADD(NOW(), INTERVAL ? MINUTE)
       WHERE \`id\` = ? AND \`type\` = 'PAYOUT'`,
      [agentId, resolvedPayMethodId, totalMinutes, txId],
    );

    if (res.affectedRows === 0) {
      await conn.rollback();
      return NextResponse.json({ ok: false, error: "Could not assign payout" }, { status: 500 });
    }

    await conn.commit();
    emitTransactionRealtime(txId, "assign");

    // Dispatch outbound webhook to merchant
    try {
      const { sendPayoutWebhookForTxStatusChange } = await import("@/lib/integrations/speedpay/outbound-payout-webhook");
      void sendPayoutWebhookForTxStatusChange(txId, "PENDING");
    } catch (e) {
      console.error("Failed to trigger outbound webhook on assignment:", e);
    }
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  return NextResponse.json({ ok: true as const });
}
