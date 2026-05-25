import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdminPermission } from "@/lib/require-admin-api";
import type { ResultSetHeader } from "mysql2/promise";

export async function POST(req: Request) {
  const auth = await requireAdminPermission("create_security_deposits");
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const { transferDate, sourceId, destId, sourceType, destType, amount, notes } = body;
  
  if (!transferDate || !sourceId || !destId || !sourceType || !destType || !amount) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  const amountVal = Number(amount);
  if (!Number.isFinite(amountVal) || amountVal <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 });
  }

  if (sourceId === destId && sourceType === destType) {
    return NextResponse.json({ ok: false, error: "Source and destination cannot be the same" }, { status: 400 });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Insert interledger entry
    await conn.query(
      `INSERT INTO \`interledger_entries\` (
        \`transfer_date\`, \`source_agent_id\`, \`dest_agent_id\`, 
        \`source_type\`, \`dest_type\`, \`amount\`, \`remark\`, \`created_by\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [transferDate, sourceId, destId, sourceType, destType, amountVal, notes || null, auth.adminId]
    );

    // Update Source (Debit)
    if (sourceType === "security") {
      await conn.query(
        `UPDATE \`agents\` SET \`security_deposit\` = \`security_deposit\` - ? WHERE \`id\` = ?`,
        [amountVal, sourceId]
      );
    } else {
      await conn.query(
        `UPDATE \`agents\` 
         SET \`running_balance\` = \`running_balance\` - ?
         WHERE \`id\` = ?`,
        [amountVal, sourceId]
      );
    }

    // Update Dest (Credit)
    if (destType === "security") {
      await conn.query(
        `UPDATE \`agents\` SET \`security_deposit\` = \`security_deposit\` + ? WHERE \`id\` = ?`,
        [amountVal, destId]
      );
    } else {
      await conn.query(
        `UPDATE \`agents\` 
         SET \`running_balance\` = \`running_balance\` + ?
         WHERE \`id\` = ?`,
        [amountVal, destId]
      );
    }

    await conn.commit();
    return NextResponse.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  } finally {
    conn.release();
  }
}
