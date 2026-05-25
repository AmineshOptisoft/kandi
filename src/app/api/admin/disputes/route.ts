import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import { isMissingDisputeStateColumn, sqlOnlyOpenDispute, sqlOnlyOpenDisputeLegacy } from "@/lib/dispute";
import { requireAdminPermission } from "@/lib/require-admin-api";

type DisputeRow = RowDataPacket & {
  id: number;
  order_id: string;
  amount: string | number;
  type: string;
  status: string;
  client_name: string | null;
  client_upi: string | null;
  utr_code: string | null;
  assigned_upi: string | null;
  dispute_raised: number;
  dispute_reason: string | null;
  dispute_state: string | null;
  created_at: Date | string | null;
  company_name: string | null;
  agent_username: string | null;
};

function num(v: string | number): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function toPaymentStatus(type: string, status: string): string {
  const s = String(status ?? "").toUpperCase();
  if (s.includes("REJECT") || s.includes("REVOK") || s === "FAILED") return "FAILED";
  const isApproved = s.includes("APPROVED");
  if (String(type).toUpperCase() === "PAYIN") return isApproved ? "PAYIN_APPROVED" : "PAYIN_PENDING";
  return isApproved ? "PAYOUT_APPROVED" : "PAYOUT_PENDING";
}

function toDisputeStatus(disputeState: string | null | undefined, disputeRaised: number, txStatus: string): string {
  const ds = String(disputeState ?? "").trim().toUpperCase();
  if (ds === "PENDING" || ds === "RESOLVED" || ds === "OTHER" || ds === "EXPIRED") return ds;
  if (disputeRaised === 1) return "PENDING";
  const s = String(txStatus ?? "").trim().toUpperCase();
  if (s.includes("EXPIRED") || s === "REVOKED") return "EXPIRED";
  return "RESOLVED";
}

function formatDt(v: Date | string | null): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function GET(req: Request) {
  const auth = await requireAdminPermission("view_disputes");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status")?.trim().toUpperCase() ?? "";
  const limitRaw = Number(searchParams.get("limit") ?? "500");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 500) : 500;

  const sqlWithState = `SELECT
       t.\`id\`, t.\`order_id\`, t.\`amount\`, t.\`type\`, t.\`status\`,
       t.\`client_name\`, t.\`client_upi\`, t.\`utr_code\`, t.\`assigned_upi\`,
       t.\`dispute_raised\`, t.\`dispute_reason\`, t.\`dispute_state\`, t.\`created_at\`,
       c.\`brand_name\` AS company_name,
       a.\`username\` AS agent_username
     FROM \`transactions\` t
     LEFT JOIN \`companies\` c ON c.\`id\` = t.\`company_id\`
     LEFT JOIN \`agents\` a ON a.\`id\` = t.\`assigned_agent_id\`
     WHERE ${sqlOnlyOpenDispute("t")}
     ORDER BY t.\`id\` DESC
     LIMIT ${limit}`;

  const sqlLegacy = `SELECT
       t.\`id\`, t.\`order_id\`, t.\`amount\`, t.\`type\`, t.\`status\`,
       t.\`client_name\`, t.\`client_upi\`, t.\`utr_code\`, t.\`assigned_upi\`,
       t.\`dispute_raised\`, t.\`dispute_reason\`, t.\`created_at\`,
       c.\`brand_name\` AS company_name,
       a.\`username\` AS agent_username
     FROM \`transactions\` t
     LEFT JOIN \`companies\` c ON c.\`id\` = t.\`company_id\`
     LEFT JOIN \`agents\` a ON a.\`id\` = t.\`assigned_agent_id\`
     WHERE ${sqlOnlyOpenDisputeLegacy("t")}
     ORDER BY t.\`id\` DESC
     LIMIT ${limit}`;

  try {
    let rows: DisputeRow[];
    try {
      const [r] = await pool.execute<DisputeRow[]>(sqlWithState);
      rows = r;
    } catch (e: unknown) {
      if (!isMissingDisputeStateColumn(e)) throw e;
      const [r2] = await pool.execute<RowDataPacket[]>(sqlLegacy);
      rows = r2.map((row) => ({ ...(row as DisputeRow), dispute_state: null }));
    }

    const items = rows
      .map((r) => ({
        id: String(r.id),
        ref: `#${String(r.order_id).slice(0, 11)}`,
        amount: num(r.amount),
        disputeStatus: toDisputeStatus(r.dispute_state, Number(r.dispute_raised ?? 0), r.status),
        paymentStatus: toPaymentStatus(r.type, r.status),
        orderId: r.order_id,
        companyName: (r.company_name ?? "").trim() || "—",
        subAdminName: (r.agent_username ?? "").trim() || "—",
        clientName: (r.client_name ?? "").trim() || "—",
        clientUpi: (r.client_upi ?? "").trim() || "—",
        utrCode: (r.utr_code ?? "").trim() || "—",
        assignedUpi: (r.assigned_upi ?? "").trim() || "—",
        reason: (r.dispute_reason ?? "").trim() || "Other",
        createdOn: formatDt(r.created_at),
      }))
      .filter((r) => !status || r.disputeStatus === status);

    return NextResponse.json({ ok: true as const, items });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not load disputes" }, { status: 500 });
  }
}
