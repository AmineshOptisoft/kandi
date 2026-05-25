import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import {
  applyAgentSettlementBalances,
  applyCompanySettlementBalances,
  buildSettlementPreview,
  computeFinalSettlementAmount,
  isSettlementTableMissing,
  parseOptionalDate,
  SETTLEMENT_MIGRATION_HINT,
  type CommissionHead,
  type SettlementFrequency,
  type SettlementPartyType,
  type SettlementStatus,
  type SettlementTxnType,
  type SettlementType,
} from "@/lib/settlement";
import { requireAdminPermission } from "@/lib/require-admin-api";

type SettlementRow = RowDataPacket & {
  id: number;
  party_type: string;
  party_id: number;
  amount: string | number;
  remark: string | null;
  settled_by: number | null;
  last_settled_at: Date | string | null;
  period_from: Date | string | null;
  period_to: Date | string | null;
  pay_in_commission: string | number;
  pay_out_commission: string | number;
  referral_commission?: string | number | null;
  final_settlement_amount: string | number;
  settlement_status: string;
  settlement_type: string;
  commission_head: string;
  transaction_type: string;
  settlement_frequency: string;
  previous_balance_snapshot: string | number;
  running_balance_snapshot: string | number;
  pay_in_volume: string | number;
  pay_out_volume: string | number;
  created_at: Date | string | null;
  party_name?: string | null;
};

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

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

function mapRow(r: SettlementRow) {
  const finalAmt = num(r.final_settlement_amount);
  const txnType = String(r.transaction_type).toUpperCase();
  return {
    id: String(r.id),
    partyType: String(r.party_type).toUpperCase() as SettlementPartyType,
    partyId: Number(r.party_id),
    partyName: (r.party_name ?? "").trim() || `#${r.party_id}`,
    amount: num(r.amount),
    remark: (r.remark ?? "").trim(),
    settlementDate: formatDt(r.last_settled_at ?? r.created_at),
    periodFrom: formatDt(r.period_from),
    periodTo: formatDt(r.period_to),
    payInCommission: num(r.pay_in_commission),
    payOutCommission: num(r.pay_out_commission),
    referralCommission: num(r.referral_commission),
    finalSettlementAmount: finalAmt,
    settlementStatus: String(r.settlement_status).toLowerCase() as SettlementStatus,
    settlementType: String(r.settlement_type).toUpperCase(),
    commissionHead: String(r.commission_head).toUpperCase(),
    transactionType: txnType as SettlementTxnType,
    displayType: txnType === "CREDIT" ? "Credit" : "Debit",
    settlementFrequency: String(r.settlement_frequency).toLowerCase(),
    previousBalanceSnapshot: num(r.previous_balance_snapshot),
    runningBalanceSnapshot: num(r.running_balance_snapshot),
    payInVolume: num(r.pay_in_volume),
    payOutVolume: num(r.pay_out_volume),
    createdAt: formatDt(r.created_at),
  };
}

function buildListFilters(opts: {
  partyIdRaw: string | null;
  partyIdColumn: string;
  status: string;
  from: Date | null;
  to: Date | null;
}): { where: string[]; params: (string | number | Date)[] } {
  const where: string[] = ["1=1"];
  const params: (string | number | Date)[] = [];
  if (opts.partyIdRaw) {
    const pid = Number(opts.partyIdRaw);
    if (Number.isInteger(pid) && pid > 0) {
      where.push(`s.\`${opts.partyIdColumn}\` = ?`);
      params.push(pid);
    }
  }
  if (opts.status === "pending" || opts.status === "settled" || opts.status === "failed") {
    where.push("s.`settlement_status` = ?");
    params.push(opts.status);
  }
  if (opts.from) {
    where.push("s.`created_at` >= ?");
    params.push(opts.from);
  }
  if (opts.to) {
    where.push("s.`created_at` <= ?");
    params.push(opts.to);
  }
  return { where, params };
}

async function listAgentSettlements(
  filters: ReturnType<typeof buildListFilters>,
  limit: number,
): Promise<SettlementRow[]> {
  const [rows] = await pool.execute<SettlementRow[]>(
    `SELECT s.*, 'AGENT' AS party_type, s.\`agent_id\` AS party_id,
            COALESCE(NULLIF(a.\`fullname\`, ''), a.\`username\`) AS party_name
     FROM \`agent_settlements\` s
     LEFT JOIN \`agents\` a ON a.\`id\` = s.\`agent_id\`
     WHERE ${filters.where.join(" AND ")}
     ORDER BY s.\`id\` DESC
     LIMIT ${limit}`,
    filters.params,
  );
  return rows;
}

async function listCompanySettlements(
  filters: ReturnType<typeof buildListFilters>,
  limit: number,
): Promise<SettlementRow[]> {
  const [rows] = await pool.execute<SettlementRow[]>(
    `SELECT s.*, 'COMPANY' AS party_type, s.\`company_id\` AS party_id,
            0 AS referral_commission,
            COALESCE(NULLIF(c.\`brand_name\`, ''), c.\`username\`) AS party_name
     FROM \`company_settlements\` s
     LEFT JOIN \`companies\` c ON c.\`id\` = s.\`company_id\`
     WHERE ${filters.where.join(" AND ")}
     ORDER BY s.\`id\` DESC
     LIMIT ${limit}`,
    filters.params,
  );
  return rows;
}

async function fetchSettlementById(
  partyType: SettlementPartyType,
  settlementId: number,
): Promise<SettlementRow | undefined> {
  if (partyType === "AGENT") {
    const [rows] = await pool.execute<SettlementRow[]>(
      `SELECT s.*, 'AGENT' AS party_type, s.\`agent_id\` AS party_id,
              COALESCE(NULLIF(a.\`fullname\`, ''), a.\`username\`) AS party_name
       FROM \`agent_settlements\` s
       LEFT JOIN \`agents\` a ON a.\`id\` = s.\`agent_id\`
       WHERE s.\`id\` = ? LIMIT 1`,
      [settlementId],
    );
    return rows[0];
  }
  const [rows] = await pool.execute<SettlementRow[]>(
    `SELECT s.*, 'COMPANY' AS party_type, s.\`company_id\` AS party_id,
            0 AS referral_commission,
            COALESCE(NULLIF(c.\`brand_name\`, ''), c.\`username\`) AS party_name
     FROM \`company_settlements\` s
     LEFT JOIN \`companies\` c ON c.\`id\` = s.\`company_id\`
     WHERE s.\`id\` = ? LIMIT 1`,
    [settlementId],
  );
  return rows[0];
}

export async function GET(req: Request) {
  const auth = await requireAdminPermission("view_settlements");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const partyType = searchParams.get("partyType")?.trim().toUpperCase() ?? "";
  const partyIdRaw = searchParams.get("partyId");
  const status = searchParams.get("status")?.trim().toLowerCase() ?? "";
  const from = parseOptionalDate(searchParams.get("from"));
  const to = parseOptionalDate(searchParams.get("to"));
  const limitRaw = Number(searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 500) : 200;

  try {
    let rows: SettlementRow[] = [];
    if (partyType === "AGENT") {
      const filters = buildListFilters({
        partyIdRaw,
        partyIdColumn: "agent_id",
        status,
        from,
        to,
      });
      rows = await listAgentSettlements(filters, limit);
    } else if (partyType === "COMPANY") {
      const filters = buildListFilters({
        partyIdRaw,
        partyIdColumn: "company_id",
        status,
        from,
        to,
      });
      rows = await listCompanySettlements(filters, limit);
    } else {
      const agentFilters = buildListFilters({
        partyIdRaw,
        partyIdColumn: "agent_id",
        status,
        from,
        to,
      });
      const companyFilters = buildListFilters({
        partyIdRaw,
        partyIdColumn: "company_id",
        status,
        from,
        to,
      });
      const half = Math.ceil(limit / 2);
      const [agentRows, companyRows] = await Promise.all([
        listAgentSettlements(agentFilters, half),
        listCompanySettlements(companyFilters, half),
      ]);
      rows = [...agentRows, ...companyRows]
        .sort((a, b) => Number(b.id) - Number(a.id))
        .slice(0, limit);
    }
    return NextResponse.json({ ok: true as const, items: rows.map(mapRow) });
  } catch (e: unknown) {
    if (isSettlementTableMissing(e)) {
      return NextResponse.json({ ok: false, error: SETTLEMENT_MIGRATION_HINT, items: [] }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "Could not load settlements" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminPermission("create_settlements");
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const partyTypeRaw = typeof body.partyType === "string" ? body.partyType.trim().toUpperCase() : "";
  const partyId = Number(body.partyId);
  if ((partyTypeRaw !== "AGENT" && partyTypeRaw !== "COMPANY") || !Number.isInteger(partyId) || partyId < 1) {
    return NextResponse.json({ ok: false, error: "partyType and partyId required" }, { status: 400 });
  }
  const partyType = partyTypeRaw as SettlementPartyType;

  const settlementDateRaw =
    typeof body.settlementDate === "string"
      ? body.settlementDate
      : typeof body.periodFrom === "string"
        ? body.periodFrom.slice(0, 10)
        : undefined;
  const settlementDay = parseOptionalDate(settlementDateRaw);
  const periodFrom =
    parseOptionalDate(typeof body.periodFrom === "string" ? body.periodFrom : undefined) ??
    settlementDay;
  const periodTo =
    parseOptionalDate(typeof body.periodTo === "string" ? body.periodTo : undefined) ??
    (settlementDateRaw ? parseOptionalDate(`${settlementDateRaw}T23:59:59`) : null);

  const settlementType = (
    typeof body.settlementType === "string" ? body.settlementType.trim().toUpperCase() : "NET"
  ) as SettlementType;
  let commissionHead = (
    typeof body.commissionHead === "string" ? body.commissionHead.trim().toUpperCase() : "ALL"
  ) as CommissionHead;
  if (partyType === "COMPANY" && commissionHead === "REFERRAL") {
    commissionHead = "ALL";
  }
  const transactionType = (
    typeof body.transactionType === "string" ? body.transactionType.trim().toUpperCase() : "DEBIT"
  ) as SettlementTxnType;
  const settlementFrequency = (
    typeof body.settlementFrequency === "string" ? body.settlementFrequency.trim().toLowerCase() : "manual"
  ) as SettlementFrequency;
  const settlementStatus = (
    typeof body.settlementStatus === "string" ? body.settlementStatus.trim().toLowerCase() : "settled"
  ) as SettlementStatus;
  const remark = typeof body.remark === "string" ? body.remark.trim() : "";
  const previousSettlementId =
    body.previousSettlementId != null && Number.isInteger(Number(body.previousSettlementId))
      ? Number(body.previousSettlementId)
      : null;
  const manualFinal =
    body.finalSettlementAmount != null ? Number(body.finalSettlementAmount) : undefined;

  const preview = await buildSettlementPreview(pool, partyType, partyId, periodFrom, periodTo);
  if (!preview) {
    return NextResponse.json({ ok: false, error: "Party not found" }, { status: 404 });
  }

  const finalAmount = computeFinalSettlementAmount({
    payInVolume: preview.payInVolume,
    payOutVolume: preview.payOutVolume,
    payInCommissionAmt: preview.payInCommissionAmount,
    payOutCommissionAmt: preview.payOutCommissionAmount,
    referralCommissionAmt: preview.referralCommissionAmount,
    settlementType,
    commissionHead,
    transactionType,
    runningBalance: preview.runningBalanceSnapshot,
    previousBalance: preview.previousBalanceSnapshot,
    manualAmount: manualFinal,
  });

  const amountField = Math.abs(finalAmount);
  const settledAt = settlementStatus === "settled" ? (settlementDay ?? new Date()) : null;
  const isManualEntry = manualFinal != null && Number.isFinite(manualFinal);
  const recordPayInComm = isManualEntry ? 0 : preview.payInCommissionAmount;
  const recordPayOutComm = isManualEntry ? 0 : preview.payOutCommissionAmount;
  const recordReferralComm = isManualEntry ? 0 : preview.referralCommissionAmount;
  const recordPayInVol = isManualEntry ? 0 : preview.payInVolume;
  const recordPayOutVol = isManualEntry ? 0 : preview.payOutVolume;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let settlementId: number;
    if (partyType === "AGENT") {
      const [ins] = await conn.execute<ResultSetHeader>(
        `INSERT INTO \`agent_settlements\` (
          \`agent_id\`, \`amount\`, \`remark\`, \`settled_by\`, \`last_settled_at\`,
          \`period_from\`, \`period_to\`,
          \`pay_in_commission\`, \`pay_out_commission\`, \`referral_commission\`,
          \`final_settlement_amount\`, \`settlement_status\`, \`previous_settlement_id\`,
          \`settlement_type\`, \`commission_head\`, \`transaction_type\`, \`settlement_frequency\`,
          \`previous_balance_snapshot\`, \`running_balance_snapshot\`,
          \`pay_in_volume\`, \`pay_out_volume\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          partyId,
          amountField,
          remark || null,
          auth.adminId,
          settledAt,
          periodFrom,
          periodTo,
          recordPayInComm,
          recordPayOutComm,
          recordReferralComm,
          finalAmount,
          settlementStatus,
          previousSettlementId,
          settlementType,
          commissionHead,
          transactionType,
          settlementFrequency,
          preview.previousBalanceSnapshot,
          preview.runningBalanceSnapshot,
          recordPayInVol,
          recordPayOutVol,
        ],
      );
      settlementId = Number(ins.insertId);
    } else {
      const [ins] = await conn.execute<ResultSetHeader>(
        `INSERT INTO \`company_settlements\` (
          \`company_id\`, \`amount\`, \`remark\`, \`settled_by\`, \`last_settled_at\`,
          \`period_from\`, \`period_to\`,
          \`pay_in_commission\`, \`pay_out_commission\`,
          \`final_settlement_amount\`, \`settlement_status\`, \`previous_settlement_id\`,
          \`settlement_type\`, \`commission_head\`, \`transaction_type\`, \`settlement_frequency\`,
          \`previous_balance_snapshot\`, \`running_balance_snapshot\`,
          \`pay_in_volume\`, \`pay_out_volume\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          partyId,
          amountField,
          remark || null,
          auth.adminId,
          settledAt,
          periodFrom,
          periodTo,
          recordPayInComm,
          recordPayOutComm,
          finalAmount,
          settlementStatus,
          previousSettlementId,
          settlementType,
          commissionHead,
          transactionType,
          settlementFrequency,
          preview.previousBalanceSnapshot,
          preview.runningBalanceSnapshot,
          recordPayInVol,
          recordPayOutVol,
        ],
      );
      settlementId = Number(ins.insertId);
    }

    if (settlementStatus === "settled") {
      if (partyType === "AGENT") {
        await applyAgentSettlementBalances(conn, partyId, finalAmount);
      } else {
        await applyCompanySettlementBalances(conn, partyId, finalAmount);
      }
    }

    await conn.commit();

    const row = await fetchSettlementById(partyType, settlementId);
    if (!row) {
      return NextResponse.json({ ok: true as const, id: String(settlementId) });
    }
    return NextResponse.json({ ok: true as const, settlement: mapRow(row), preview });
  } catch (e: unknown) {
    await conn.rollback();
    if (isSettlementTableMissing(e)) {
      return NextResponse.json({ ok: false, error: SETTLEMENT_MIGRATION_HINT }, { status: 503 });
    }
    console.error(e);
    return NextResponse.json({ ok: false, error: "Could not create settlement" }, { status: 500 });
  } finally {
    conn.release();
  }
}
