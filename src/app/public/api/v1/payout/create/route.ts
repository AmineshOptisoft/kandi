import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import type { ResultSetHeader } from "mysql2/promise";
import { pool } from "@/lib/db";
import { requireCompanyApiKey } from "@/lib/require-company-api-key";
import { clientsTableHasCompanyIdColumn } from "@/lib/clients-company-column";
import { emitTransactionRealtime } from "@/lib/realtime/broadcast-transaction";
import { sqlExpiresAtFromNow } from "@/lib/request-expiry";

function requestOrigin(req: Request): string {
  return process.env.APP_URL?.trim() || new URL(req.url).origin;
}

async function upsertClientPayoutSnapshot(
  exec: any,
  args: {
    companyId: number;
    externalClientId: string;
    clientName: string;
    accountHolderName: string;
    bankName: string;
    accountNo: string;
    ifsc: string;
  },
): Promise<void> {
  await exec.execute(
    `INSERT INTO \`clients\` (
       \`company_id\`, \`client_id\`, \`client_name\`, \`phone\`, \`email\`,
       \`account_number\`, \`ifsc_code\`, \`branch_name\`, \`bank_name\`,
       \`bank_account_holder_name\`, \`upi_id\`, \`upi_account_holder_name\`, \`status\`
     ) VALUES (?, ?, ?, '', '', ?, ?, '', ?, ?, '', '', 'ACTIVE')
     ON DUPLICATE KEY UPDATE
       \`client_name\` = VALUES(\`client_name\`),
       \`account_number\` = VALUES(\`account_number\`),
       \`ifsc_code\` = VALUES(\`ifsc_code\`),
       \`bank_name\` = VALUES(\`bank_name\`),
       \`bank_account_holder_name\` = VALUES(\`bank_account_holder_name\`),
       \`updated_at\` = CURRENT_TIMESTAMP`,
    [
      args.companyId,
      args.externalClientId,
      args.clientName,
      args.accountNo,
      args.ifsc,
      args.bankName,
      args.accountHolderName,
    ],
  );
}

async function insertLegacyCompanyPayoutProfile(
  exec: any,
  args: {
    companyId: number;
    externalClientId: string;
    clientName: string;
    accountHolderName: string;
    bankName: string;
    accountNo: string;
    ifsc: string;
  },
): Promise<void> {
  await exec.execute(
    `INSERT INTO \`company_payout_client_profiles\`
     (\`company_id\`, \`external_client_id\`, \`client_name\`, \`account_holder_name\`, \`bank_name\`, \`bank_account_number\`, \`ifsc_code\`)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      args.companyId,
      args.externalClientId,
      args.clientName,
      args.accountHolderName,
      args.bankName,
      args.accountNo,
      args.ifsc,
    ],
  );
}

export async function POST(req: Request) {
  const auth = await requireCompanyApiKey(req);
  if (!auth.ok) {
    const err = await auth.response.json().catch(() => ({}));
    const message =
      typeof (err as { error?: unknown }).error === "string"
        ? String((err as { error: string }).error)
        : "Unauthorized (Invalid API Key)";
    return NextResponse.json({ success: false, message }, { status: 401 });
  }
  // auth is guaranteed to be the successful shape here
  const { companyId } = auth as { ok: true; companyId: number; keyId: number; company: any };

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const {
    amount,
    account_number,
    ifsc_code,
    account_name,
    note,
    unique_identifier,
    return_url,
  } = body;

  // Validate fields
  if (amount === undefined || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ success: false, message: "Valid amount is required" }, { status: 400 });
  }

  if (!account_number || typeof account_number !== "string" || !account_number.trim()) {
    return NextResponse.json({ success: false, message: "account_number is required" }, { status: 400 });
  }

  if (!ifsc_code || typeof ifsc_code !== "string" || !ifsc_code.trim()) {
    return NextResponse.json({ success: false, message: "ifsc_code is required" }, { status: 400 });
  }

  if (!account_name || typeof account_name !== "string" || !account_name.trim()) {
    return NextResponse.json({ success: false, message: "account_name is required" }, { status: 400 });
  }

  if (!unique_identifier || typeof unique_identifier !== "string" || !unique_identifier.trim()) {
    return NextResponse.json({ success: false, message: "unique_identifier is required" }, { status: 400 });
  }

  if (!return_url || typeof return_url !== "string" || !return_url.trim()) {
    return NextResponse.json({ success: false, message: "return_url is required" }, { status: 400 });
  }

  // Validate IFSC code (11-character format: ABCD0123456)
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!ifscRegex.test(ifsc_code.trim())) {
    return NextResponse.json({
      success: false,
      message: "Invalid IFSC code format. Expected 11-character format like ABCD0123456.",
    }, { status: 400 });
  }

  // Check unique_identifier reuse (idempotency key per company)
  const [existingIdem] = await pool.execute<any[]>(
    "SELECT `id` FROM `transactions` WHERE `company_id` = ? AND `type` = 'PAYOUT' AND `idempotency_key` = ? LIMIT 1",
    [auth.companyId, unique_identifier.trim()],
  );
  if (existingIdem.length > 0) {
    return NextResponse.json({
      success: false,
      message: "unique_identifier has already been used. Attempting to reuse will result in an error.",
    }, { status: 400 });
  }

  // Calculate Company Balance and check limits
  const [balanceRows] = await pool.execute<any[]>(
    `SELECT 
       COALESCE(SUM(CASE WHEN \`type\` = 'PAYIN' AND \`status\` IN ('APPROVED', 'APPROVED_BY_ADMIN', 'APPROVED_BY_AGENT', 'EXPIRED_APPROVED_BY_ADMIN', 'EXPIRED_APPROVED_BY_AGENT') THEN \`amount\` ELSE 0 END), 0) AS total_payin,
       COALESCE(SUM(CASE WHEN \`type\` = 'PAYOUT' AND \`status\` NOT IN ('REJECTED', 'EXPIRED', 'REVOKED') THEN \`amount\` ELSE 0 END), 0) AS total_payout
     FROM \`transactions\`
     WHERE \`company_id\` = ?`,
    [auth.companyId],
  );
  const payin = Number(balanceRows[0]?.total_payin || 0);
  const payout = Number(balanceRows[0]?.total_payout || 0);
  const balance = payin - payout;



    // Insufficient balance – create a pending transaction for admin approval
    const pendingConn = await pool.getConnection();
    try {
      await pendingConn.beginTransaction();
      await pendingConn.execute<ResultSetHeader>(
        `INSERT INTO \`transactions\` (\`random_code\`, \`type\`, \`order_id\`, \`client_id\`, \`amount\`, \`currency\`, \`payment_method\`, \`bank_account_number\`, \`ifsc_code\`, \`bank_name\`, \`account_holder_name\`, \`status\`, \`client_name\`, \`client_upi\`, \`company_id\`, \`idempotency_key\`, \`user_note\`, \`expires_at\`) VALUES (?, 'PAYOUT', ?, ?, ?, 'INR', 'BANK', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${sqlExpiresAtFromNow()})`,
        [
          randomUUID().replace(/-/g, "").slice(0, 20),
          `PO${Date.now()}${Math.floor(Math.random() * 1000)}`,
          unique_identifier.trim(),
          amount,
          account_number.trim(),
          ifsc_code.trim(),
          "BANK",
          account_name.trim(),
          "PENDING_APPROVAL",
          account_name.trim(),
          account_number.trim(),
          auth.companyId,
          unique_identifier.trim(),
          note?.trim() || null,
        ]
      );
      await pendingConn.commit();
    } catch (e) {
      await pendingConn.rollback();
      console.error("Failed to create pending payout transaction:", e);
    } finally {
      pendingConn.release();
    }
    return NextResponse.json({
      success: true,
      message: "Balance insufficient – payout request sent for admin approval.",
      pending: true,
    }, { status: 202 });

  // Handle min/max payout limits
  const minLimit = Number(process.env.PAYOUT_MIN_LIMIT || 100);
  const maxLimit = Number(process.env.PAYOUT_MAX_LIMIT || 500000);
  if (amount < minLimit || amount > maxLimit) {
    return NextResponse.json({
      success: false,
      message: `Payout amount must be between ${minLimit} and ${maxLimit} INR.`,
    }, { status: 400 });
  }

  const randomCode = randomUUID().replace(/-/g, "").slice(0, 20);
  const orderId = `PO${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const useClientsTable = await clientsTableHasCompanyIdColumn(pool);
  if (useClientsTable && unique_identifier.trim().length > 100) {
    return NextResponse.json({ success: false, message: "unique_identifier must be at most 100 characters" }, { status: 400 });
  }
   const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [res] = await conn.execute<ResultSetHeader>(
      `INSERT INTO \`transactions\` (
        \`random_code\`, \`type\`, \`order_id\`, \`client_id\`, \`amount\`, \`currency\`, \`payment_method\`,
        \`bank_account_number\`, \`ifsc_code\`, \`bank_name\`, \`account_holder_name\`,
        \`status\`, \`client_name\`, \`client_upi\`, \`company_id\`, \`idempotency_key\`, \`user_note\`, \`expires_at\`
      ) VALUES (?, 'PAYOUT', ?, ?, ?, 'INR', 'BANK', ?, ?, ?, ?, 'NOT_ASSIGNED', ?, ?, ?, ?, ?, ${sqlExpiresAtFromNow()})`,
      [
        randomCode,
        orderId,
        unique_identifier.trim(), // client_id
        amount,
        account_number.trim(), // bank_account_number
        ifsc_code.trim(), // ifsc_code
        "BANK", // bank_name
        account_name.trim(), // account_holder_name
        account_name.trim(), // client_name
        account_number.trim(), // client_upi
        companyId,
        unique_identifier.trim(), // idempotency_key
        note?.trim() || null,
      ],
    );

    await conn.commit();
    emitTransactionRealtime(Number(res.insertId), "create");
    
    // Dispatch outbound webhook to merchant
    try {
      const { sendPayoutWebhookForTx } = await import("@/lib/integrations/speedpay/outbound-payout-webhook");
      void sendPayoutWebhookForTx(Number(res.insertId), { event: "payout.initiated" });
    } catch (e) {
      console.error("Failed to trigger payout.initiated webhook:", e);
    }

    // Re-use bank details if needed / upsert client record
    try {
      if (useClientsTable) {
        await upsertClientPayoutSnapshot(pool, {
          companyId: companyId,
          externalClientId: unique_identifier.trim(),
          clientName: account_name.trim(),
          accountHolderName: account_name.trim(),
          bankName: "BANK",
          accountNo: account_number.trim(),
          ifsc: ifsc_code.trim(),
        });
      } else {
        await insertLegacyCompanyPayoutProfile(pool, {
          companyId: companyId,
          externalClientId: unique_identifier.trim(),
          clientName: account_name.trim(),
          accountHolderName: account_name.trim(),
          bankName: "BANK",
          accountNo: account_number.trim(),
          ifsc: ifsc_code.trim(),
        });
      }
    } catch (e) {
      console.error("Failed to upsert client snapshot in payout creation:", e);
    }

    // Build the token payload for redirecting the user back
    const payload = {
      orderId,
      return_url: return_url.trim(),
      amount,
      account_name: account_name.trim(),
    };
    const token = Buffer.from(JSON.stringify(payload)).toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    const origin = requestOrigin(req);
    const redirectUrl = `${origin}/payout/${token}`;

    return NextResponse.json({
      success: true,
      message: "Payout link generated successfully.",
      data: {
        redirect_url: redirectUrl,
      },
    }, { status: 200 });

  } catch (e) {
    await conn.rollback();
    console.error("Failed to insert payout request:", e);
    return NextResponse.json({ success: false, message: "Could not create payout request due to an internal error." }, { status: 500 });
  } finally {
    conn.release();
  }
}
