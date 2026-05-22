import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const [companies] = await pool.execute("SELECT id, username, webhook_url FROM companies");
    const [transactions] = await pool.execute("SELECT id, type, order_id, status, company_id FROM transactions ORDER BY id DESC LIMIT 5");
    return NextResponse.json({ companies, transactions });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
