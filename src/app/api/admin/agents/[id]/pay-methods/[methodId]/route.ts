import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  gatewayToPaymentMethod,
  PAY_METHOD_SELECT,
  payMethodToStaffApi,
  boolPay,
  type PayMethodRow,
} from "@/lib/agent-payment-method-map";
import { validateAgentPayMethodPayload } from "@/lib/agent-pay-method-limits";
import { pool } from "@/lib/db";
import { isMysqlErNoSuchTable, PAY_METHODS_TABLE_HINT } from "@/lib/mysql-table-error";
import { requireAdminPermission } from "@/lib/require-admin-api";
import { loadPayMethodFinancials } from "@/lib/transactions-pay-method-financials";

type AgentRow = RowDataPacket & { username: string | null };

function parseMoneyLimit(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v).trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 1e16);
}

async function getOwnedPayMethod(agentId: number, id: number): Promise<PayMethodRow | null> {
  const [rows] = await pool.execute<PayMethodRow[]>(
    `SELECT ${PAY_METHOD_SELECT}
     FROM \`pay_methods\` WHERE \`id\` = ? AND \`agent_id\` = ? LIMIT 1`,
    [id, agentId],
  );
  return rows[0] ?? null;
}

function opTypeToFlags(op: string): { in: boolean; out: boolean } {
  const t = op.trim();
  if (t === "PayIn Only") return { in: true, out: false };
  if (t === "PayOut Only") return { in: false, out: true };
  return { in: true, out: true };
}

export async function PATCH(
  req: Request,
  context: { params: { id: string; methodId: string } | Promise<{ id: string; methodId: string }> }
) {
  const auth = await requireAdminPermission("edit_agents");
  if (!auth.ok) return auth.response;

  const resolvedParams = await Promise.resolve(context.params);
  const agentId = Number(resolvedParams.id);
  const rowId = Number(resolvedParams.methodId);

  if (!Number.isInteger(agentId) || agentId < 1 || !Number.isInteger(rowId) || rowId < 1) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const existing = await getOwnedPayMethod(agentId, rowId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (typeof body.fullname === "string") {
      updates.push("`full_name` = ?");
      params.push(body.fullname.trim() || existing.full_name);
    }
    if (typeof body.email === "string") {
      updates.push("`email` = NULLIF(?, '')");
      params.push(body.email.trim());
    }

    let nextIn: boolean | undefined;
    let nextOut: boolean | undefined;
    if (typeof body.operation_type === "string") {
      const f = opTypeToFlags(body.operation_type);
      nextIn = f.in;
      nextOut = f.out;
    }
    if (typeof body.pay_in_enabled === "boolean") nextIn = body.pay_in_enabled;
    if (typeof body.pay_out_enabled === "boolean") nextOut = body.pay_out_enabled;
    if (nextIn !== undefined) {
      updates.push("`enable_pay_in` = ?");
      params.push(nextIn ? 1 : 0);
    }
    if (nextOut !== undefined) {
      updates.push("`enable_pay_out` = ?");
      params.push(nextOut ? 1 : 0);
    }
    if (typeof body.gateway === "string") {
      const pm = gatewayToPaymentMethod(body.gateway.trim());
      updates.push("`payment_method` = ?");
      params.push(pm);
      if (pm === "UPI") {
        updates.push("`account_no` = NULL", "`ifsc_code` = NULL", "`branch_name` = NULL", "`bank_name` = NULL");
      } else {
        updates.push("`upi_id` = NULL");
      }
    }
    if (typeof body.upi_id === "string") {
      updates.push("`upi_id` = NULLIF(?, '')");
      params.push(body.upi_id.trim());
    }
    if (typeof body.bank_name === "string") {
      updates.push("`bank_name` = NULLIF(?, '')");
      params.push(body.bank_name.trim());
    }
    if (typeof body.account_no === "string") {
      updates.push("`account_no` = NULLIF(?, '')");
      params.push(body.account_no.trim());
    }
    if (typeof body.ifsc_code === "string") {
      updates.push("`ifsc_code` = NULLIF(?, '')");
      params.push(body.ifsc_code.trim());
    }
    if (typeof body.branch_name === "string") {
      updates.push("`branch_name` = NULLIF(?, '')");
      params.push(body.branch_name.trim());
    }
    if (typeof body.account_holder_name === "string") {
      updates.push("`account_holder_name` = NULLIF(?, '')");
      params.push(body.account_holder_name.trim());
    }
    if (body.pay_in_limit !== undefined) {
      updates.push("`pay_in_limit` = ?");
      params.push(parseMoneyLimit(body.pay_in_limit));
    }
    if (body.pay_out_limit !== undefined) {
      updates.push("`pay_out_limit` = ?");
      params.push(parseMoneyLimit(body.pay_out_limit));
    }
    if (body.status === "active" || body.status === "inactive") {
      updates.push("`status` = ?");
      params.push(body.status === "active" ? "ACTIVE" : "INACTIVE");
    }

    const newUsername = typeof body.username === "string" ? body.username.trim() : "";
    if (newUsername && newUsername !== (existing.username ?? "").trim()) {
      updates.push("`username` = ?");
      params.push(newUsername);
    }

    const [agentRows] = await pool.execute<AgentRow[]>("SELECT `username` FROM `agents` WHERE `id` = ? LIMIT 1", [agentId]);
    const agentUsername = agentRows[0]?.username ?? `Agent #${agentId}`;

    if (updates.length === 0) {
      const fin0 = await loadPayMethodFinancials(agentId, [rowId]);
      return NextResponse.json({
        ok: true as const,
        payment_method: payMethodToStaffApi(existing, agentUsername, fin0.get(rowId)),
      });
    }

    const needsPayMethodValidation =
      typeof body.operation_type === "string" ||
      typeof body.pay_in_enabled === "boolean" ||
      typeof body.pay_out_enabled === "boolean" ||
      typeof body.gateway === "string" ||
      typeof body.upi_id === "string" ||
      body.pay_in_limit !== undefined ||
      body.pay_out_limit !== undefined;

    if (needsPayMethodValidation) {
      let mergedIn = boolPay(existing.enable_pay_in);
      let mergedOut = boolPay(existing.enable_pay_out);
      if (typeof body.operation_type === "string") {
        const f = opTypeToFlags(body.operation_type);
        mergedIn = f.in;
        mergedOut = f.out;
      }
      if (typeof body.pay_in_enabled === "boolean") mergedIn = body.pay_in_enabled;
      if (typeof body.pay_out_enabled === "boolean") mergedOut = body.pay_out_enabled;
      let mergedPm: "UPI" | "BANK" =
        String(existing.payment_method ?? "").toUpperCase() === "BANK" ? "BANK" : "UPI";
      if (typeof body.gateway === "string") {
        mergedPm = gatewayToPaymentMethod(body.gateway.trim()) === "BANK" ? "BANK" : "UPI";
      }
      const mergedUpi =
        typeof body.upi_id === "string" ? body.upi_id.trim() : String(existing.upi_id ?? "").trim();
      const mergedPin =
        body.pay_in_limit !== undefined ? parseMoneyLimit(body.pay_in_limit) : parseMoneyLimit(existing.pay_in_limit);
      const mergedPout =
        body.pay_out_limit !== undefined ? parseMoneyLimit(body.pay_out_limit) : parseMoneyLimit(existing.pay_out_limit);
      
      const mergedErr = validateAgentPayMethodPayload({
        paymentMethod: mergedPm,
        payInEnabled: mergedIn,
        payOutEnabled: mergedOut,
        payInLimit: mergedPin,
        payOutLimit: mergedPout,
        upiId: mergedUpi,
      });
      if (mergedErr) {
        return NextResponse.json({ ok: false, error: mergedErr }, { status: 400 });
      }
    }

    params.push(rowId, agentId);

    try {
      await pool.execute<ResultSetHeader>(
        `UPDATE \`pay_methods\` SET ${updates.join(", ")} WHERE \`id\` = ? AND \`agent_id\` = ?`,
        params as (string | number | boolean | null)[],
      );
    } catch (e: unknown) {
      if (isMysqlErNoSuchTable(e)) {
        return NextResponse.json({ ok: false, error: PAY_METHODS_TABLE_HINT }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: "Could not update payment method" }, { status: 500 });
    }

    const row = await getOwnedPayMethod(agentId, rowId);
    if (!row) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    const fin = await loadPayMethodFinancials(agentId, [rowId]);
    return NextResponse.json({ ok: true as const, payment_method: payMethodToStaffApi(row, agentUsername, fin.get(rowId)) });
  } catch (e: unknown) {
    if (isMysqlErNoSuchTable(e)) {
      return NextResponse.json({ ok: false, error: PAY_METHODS_TABLE_HINT }, { status: 503 });
    }
    console.error(e);
    return NextResponse.json({ ok: false, error: "Could not update payment method" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: { id: string; methodId: string } | Promise<{ id: string; methodId: string }> }
) {
  const auth = await requireAdminPermission("edit_agents");
  if (!auth.ok) return auth.response;

  const resolvedParams = await Promise.resolve(context.params);
  const agentId = Number(resolvedParams.id);
  const rowId = Number(resolvedParams.methodId);

  if (!Number.isInteger(agentId) || agentId < 1 || !Number.isInteger(rowId) || rowId < 1) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM `pay_methods` WHERE `id` = ? AND `agent_id` = ?",
      [rowId, agentId],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true as const });
  } catch (e: unknown) {
    if (isMysqlErNoSuchTable(e)) {
      return NextResponse.json({ ok: false, error: PAY_METHODS_TABLE_HINT }, { status: 503 });
    }
    console.error(e);
    return NextResponse.json({ ok: false, error: "Could not delete payment method" }, { status: 500 });
  }
}
