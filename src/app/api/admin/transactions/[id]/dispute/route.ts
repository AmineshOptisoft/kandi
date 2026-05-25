import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import { isMissingDisputeStateColumn, isOpenDispute } from "@/lib/dispute";
import { emitTransactionRealtime } from "@/lib/realtime/broadcast-transaction";
import { requireAdminPermission } from "@/lib/require-admin-api";

type TxRow = RowDataPacket & {
  id: number;
  type: string;
  dispute_raised: number;
  dispute_state: string | null;
};

const DISPUTE_STATES = new Set(["PENDING", "RESOLVED", "OTHER", "EXPIRED", "NONE"]);

export async function PATCH(req: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  const { id: idRaw } = await Promise.resolve(context.params);
  const txId = Number(idRaw);
  if (!Number.isInteger(txId) || txId < 1) {
    return NextResponse.json({ ok: false, error: "Invalid transaction id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const requiredPermission = ("dispute_state" in body) ? "resolve_disputes" : "create_disputes";
  const auth = await requireAdminPermission(requiredPermission);
  if (!auth.ok) return auth.response;

  const stateRaw = typeof body.dispute_state === "string" ? body.dispute_state.trim().toUpperCase() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  const [rows] = await pool.execute<TxRow[]>(
    "SELECT `id`, `type`, `dispute_raised`, `dispute_state` FROM `transactions` WHERE `id` = ? LIMIT 1",
    [txId],
  );
  const tx = rows[0];
  if (!tx) {
    return NextResponse.json({ ok: false, error: "Transaction not found" }, { status: 404 });
  }

  if ("dispute_state" in body) {
    if (!stateRaw || !DISPUTE_STATES.has(stateRaw)) {
      return NextResponse.json(
        { ok: false, error: "dispute_state must be one of: NONE, PENDING, RESOLVED, OTHER, EXPIRED" },
        { status: 400 },
      );
    }

    const releasing = stateRaw === "RESOLVED" || stateRaw === "NONE";
    try {
      if (releasing) {
        const [res] = await pool.execute<ResultSetHeader>(
          "UPDATE `transactions` SET `dispute_state` = 'NONE', `dispute_raised` = 0 WHERE `id` = ?",
          [txId],
        );
        if (res.affectedRows === 0) {
          return NextResponse.json({ ok: false, error: "Could not resolve dispute" }, { status: 500 });
        }
      } else {
        const [res] = await pool.execute<ResultSetHeader>(
          "UPDATE `transactions` SET `dispute_state` = ?, `dispute_raised` = 1 WHERE `id` = ?",
          [stateRaw, txId],
        );
        if (res.affectedRows === 0) {
          return NextResponse.json({ ok: false, error: "Could not update dispute state" }, { status: 500 });
        }
      }
      emitTransactionRealtime(txId, "dispute");
      return NextResponse.json({ ok: true as const, dispute_state: releasing ? "NONE" : stateRaw });
    } catch (e: unknown) {
      if (isMissingDisputeStateColumn(e)) {
        if (releasing) {
          const [res] = await pool.execute<ResultSetHeader>(
            "UPDATE `transactions` SET `dispute_raised` = 0 WHERE `id` = ?",
            [txId],
          );
          if (res.affectedRows === 0) {
            return NextResponse.json({ ok: false, error: "Could not resolve dispute" }, { status: 500 });
          }
          emitTransactionRealtime(txId, "dispute");
          return NextResponse.json({ ok: true as const, dispute_state: "NONE" });
        }
        return NextResponse.json(
          {
            ok: false,
            error: "Run database migration `database/migrations/003_dispute_state.sql` to enable dispute states.",
          },
          { status: 503 },
        );
      }
      throw e;
    }
  }

  if (isOpenDispute(tx.dispute_state, tx.dispute_raised)) {
    return NextResponse.json({ ok: false, error: "Transaction is already in dispute" }, { status: 409 });
  }

  const txType = String(tx.type ?? "").trim().toUpperCase();
  const disputeType = txType === "PAYOUT" ? "PAYOUT" : "PAYIN";

  try {
    const [res] = await pool.execute<ResultSetHeader>(
      `UPDATE \`transactions\`
       SET \`dispute_raised\` = 1,
           \`dispute_reason\` = ?,
           \`dispute_state\` = 'PENDING',
           \`dispute_type\` = ?,
           \`dispute_raised_at\` = NOW()
       WHERE \`id\` = ?`,
      [reason || "Other", disputeType, txId],
    );
    if (res.affectedRows === 0) {
      return NextResponse.json({ ok: false, error: "Could not raise dispute" }, { status: 500 });
    }
    emitTransactionRealtime(txId, "dispute");
    return NextResponse.json({ ok: true as const, dispute_state: "PENDING" });
  } catch (e: unknown) {
    if (isMissingDisputeStateColumn(e)) {
      const [res] = await pool.execute<ResultSetHeader>(
        "UPDATE `transactions` SET `dispute_raised` = 1, `dispute_reason` = ? WHERE `id` = ?",
        [reason || "Other", txId],
      );
      if (res.affectedRows === 0) {
        return NextResponse.json({ ok: false, error: "Could not raise dispute" }, { status: 500 });
      }
      emitTransactionRealtime(txId, "dispute");
      return NextResponse.json({ ok: true as const });
    }
    const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "ER_BAD_FIELD_ERROR") {
      const [res] = await pool.execute<ResultSetHeader>(
        "UPDATE `transactions` SET `dispute_raised` = 1, `dispute_reason` = ? WHERE `id` = ?",
        [reason || "Other", txId],
      );
      if (res.affectedRows === 0) {
        return NextResponse.json({ ok: false, error: "Could not raise dispute" }, { status: 500 });
      }
      emitTransactionRealtime(txId, "dispute");
      return NextResponse.json({ ok: true as const });
    }
    throw e;
  }
}
