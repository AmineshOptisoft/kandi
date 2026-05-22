import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireCompanyApiKey } from "@/lib/require-company-api-key";

type Context = {
  params: {
    transaction_number: string;
  } | Promise<{
    transaction_number: string;
  }>;
};

function mapInternalStatus(status: string): "INITIATE" | "COMPLETED" | "REJECTED" | "EXPIRED" {
  const s = String(status || "").trim().toUpperCase();
  if (s.includes("APPROVED")) {
    return "COMPLETED";
  }
  if (s === "REJECTED" || s === "REVOKED" || s === "DECLINED") {
    return "REJECTED";
  }
  if (s === "EXPIRED") {
    return "EXPIRED";
  }
  return "INITIATE";
}

export async function GET(req: Request, context: Context) {
  const auth = await requireCompanyApiKey(req);
  if (!auth.ok) {
    const err = await auth.response.json().catch(() => ({}));
    const message =
      typeof (err as { error?: unknown }).error === "string"
        ? String((err as { error: string }).error)
        : "Unauthorized (Invalid API Key)";
    return NextResponse.json({ success: false, message }, { status: 401 });
  }

  const { transaction_number } = await Promise.resolve(context.params);

  // Validate format of transaction_number (must not be empty, and match format)
  if (!transaction_number || typeof transaction_number !== "string" || !transaction_number.trim()) {
    return NextResponse.json(
      { success: false, message: "Invalid transaction_number format." },
      { status: 400 },
    );
  }

  // If order_id doesn't match standard PO pattern (e.g. starts with PO followed by numbers)
  if (!transaction_number.startsWith("PO")) {
    return NextResponse.json(
      { success: false, message: "Invalid transaction_number format." },
      { status: 400 },
    );
  }

  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT \`id\`, \`order_id\`, \`amount\`, \`user_note\`, \`client_id\`, \`status\`, \`utr_code\`, \`dispute_reason\`, 
              \`bank_name\`, \`bank_account_number\`, \`ifsc_code\`, \`account_holder_name\`
       FROM \`transactions\`
       WHERE \`type\` = 'PAYOUT' AND \`order_id\` = ? AND \`company_id\` = ?
       LIMIT 1`,
      [transaction_number.trim(), auth.companyId],
    );

    const tx = rows[0];
    if (!tx) {
      return NextResponse.json(
        { success: false, message: "transaction_number not found or does not belong to your account." },
        { status: 404 },
      );
    }

    const publicStatus = mapInternalStatus(tx.status);

    const data = {
      id: Number(tx.id),
      transaction_number: String(tx.order_id),
      amount: Number(tx.amount).toFixed(2),
      note: tx.user_note?.trim() || null,
      unique_identifier: String(tx.client_id || ""),
      status: publicStatus,
      utr: tx.utr_code?.trim() || null,
      reject_reason: tx.dispute_reason?.trim() || null,
      bank_details: {
        bank_name: tx.bank_name?.trim() === "BANK" ? "Bank Transfer" : (tx.bank_name?.trim() || "Bank Transfer"),
        account_number: String(tx.bank_account_number || ""),
        ifsc_code: String(tx.ifsc_code || ""),
        account_name: String(tx.account_holder_name || ""),
      },
    };

    return NextResponse.json({
      success: true,
      message: "Payout status fetched successfully.",
      data,
    }, { status: 200 });

  } catch (error) {
    console.error("Failed to fetch payout status:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
