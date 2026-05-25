import type { RowDataPacket } from "mysql2/promise";

export type AgentPayInUiStatus =
  | "PENDING"
  | "APPROVED"
  | "EXPIRED"
  | "RECEIPT_PENDING"
  | "UNASSIGNED"
  | "PROCESSING"
  | "EXPIRED_APPROVED_BY_ADMIN"
  | "EXPIRED_APPROVED_BY_AGENT"
  | "DECLINED";

/** Mirrors PayInList `PayInItem` UI shape */
export type AgentPayInListItem = {
  id: string;
  ref: string;
  amount: number;
  status: AgentPayInUiStatus;
  orderId: string;
  clientName: string;
  clientId?: string;
  clientUpi: string;
  assignedUpi: string;
  bankName?: string;
  accountNo?: string;
  ifsc?: string;
  createdOn: string;
  createdAtIso?: string;
  /** When set, open requests auto-expire at this instant (server `expires_at`). */
  expiresAtIso?: string;
  totalAmount: number;
  discountAmount: number;
  assignedTo: string;
  assignedOn: string;
  remarks: string;
  hasReceipt?: boolean;
  /** Raw proof URL or data URL for preview modal */
  paymentProof?: string | null;
  utrCode?: string;
  disputeRaised?: boolean;
  /** Present when an agent is linked to this payin (admin list / filters). */
  assignedAgentId?: string | null;
  /** Raw DB status before UI mapping - used to gate actions accurately. */
  rawStatus?: string;
};

/** Mirrors PayOutList `PayOutItem` UI shape */
export type AgentPayOutListItem = {
  id: string;
  ref: string;
  amount: number;
  status:
    | "CREATED"
    | "UNASSIGNED"
    | "PENDING"
    | "ASSIGNED"
    | "PROCESSING"
    | "EXPIRED"
    | "APPROVED"
    | "DECLINED"
    | "EXPIRED_APPROVED_BY_ADMIN"
    | "EXPIRED_APPROVED_BY_AGENT";
  orderId: string;
  clientName: string;
  clientId?: string;
  clientUpi: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  createdOn: string;
  createdAtIso?: string;
  assignedTo?: string;
  assignedOn?: string;
  /** Present when an agent is linked to this payout (admin list / filters). */
  assignedAgentId?: string | null;
  remarks?: string;
  hasReceipt?: boolean;
  /** Raw proof URL or data URL for preview modal */
  paymentProof?: string | null;
  disputeRaised?: boolean;
  expiresAtIso?: string;
  /** When admin assigned this payout (ISO); used for post-assignment approve delay. */
  assignedAtIso?: string;
};

export type TxRow = RowDataPacket & {
  id: number;
  random_code: string;
  order_id: string;
  amount: string | number;
  status: string;
  type: string;
  client_name: string | null;
  client_id?: string | null;
  client_upi: string | null;
  assigned_upi: string | null;
  user_upi: string | null;
  utr_code: string | null;
  payment_image: string | null;
  user_note: string | null;
  created_at: Date | string | null;
  assigned_date: Date | string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  ifsc_code: string | null;
  dispute_raised: number | boolean | null;
  assigned_agent_id?: number | null;
  expires_at?: Date | string | null;
};

function num(v: string | number): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function formatDt(v: Date | string | null | undefined): string {
  if (v == null) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function toIso(v: Date | string | null | undefined): string | undefined {
  if (v == null) return undefined;
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function payInAssignedToLabel(r: TxRow): string {
  const upi = (r.assigned_upi ?? "").trim();
  if (upi) return upi;
  const bank = (r.bank_name ?? "").trim();
  const account = (r.bank_account_number ?? "").trim();
  if (bank && account) {
    const tail = account.length > 4 ? account.slice(-4) : account;
    return `${bank} · ${tail}`;
  }
  if (bank) return bank;
  if (account) return account;
  return "—";
}

export function mapDbStatusToPayInUi(status: string): AgentPayInListItem["status"] {
  switch (status) {
    case "NOT_ASSIGNED":
      return "UNASSIGNED";
    case "PENDING":
      return "PENDING";
    case "PAID":
      return "RECEIPT_PENDING";
    case "APPROVED":
    case "APPROVED_BY_AGENT":
    case "APPROVED_BY_ADMIN":
      return "APPROVED";
    case "EXPIRED_APPROVED_BY_ADMIN":
      return "EXPIRED_APPROVED_BY_ADMIN";
    case "EXPIRED_APPROVED_BY_AGENT":
      return "EXPIRED_APPROVED_BY_AGENT";
    case "EXPIRED":
      return "EXPIRED";
    case "RE_ASSIGNED":
      return "PROCESSING";
    case "REJECTED":
    case "REVOKED":
      return "DECLINED";
    default:
      return "PROCESSING";
  }
}

export function mapDbStatusToPayOutUi(status: string): AgentPayOutListItem["status"] {
  switch (status) {
    case "NOT_ASSIGNED":
      return "UNASSIGNED";
    case "PENDING":
      return "PENDING";
    case "PAID":
      return "PROCESSING";
    case "APPROVED":
    case "APPROVED_BY_AGENT":
    case "APPROVED_BY_ADMIN":
      return "APPROVED";
    case "EXPIRED_APPROVED_BY_ADMIN":
      return "EXPIRED_APPROVED_BY_ADMIN";
    case "EXPIRED_APPROVED_BY_AGENT":
      return "EXPIRED_APPROVED_BY_AGENT";
    case "EXPIRED":
      return "EXPIRED";
    case "RE_ASSIGNED":
      return "PROCESSING";
    case "REJECTED":
    case "REVOKED":
      return "DECLINED";
    default:
      return "PENDING";
  }
}

export function rowToPayInItem(r: TxRow): AgentPayInListItem {
  const amt = num(r.amount);
  const ui = mapDbStatusToPayInUi(r.status);
  const assignedUpi = (r.assigned_upi ?? "").trim() || "—";
  const utr = (r.utr_code ?? "").trim();
  return {
    id: String(r.id),
    ref: `#${String(r.order_id).slice(0, 10)}`,
    amount: amt,
    status: ui,
    orderId: r.order_id,
    clientName: (r.client_name ?? "").trim() || "—",
    clientId: (r.client_id ?? "").trim() || undefined,
    clientUpi: (r.client_upi ?? r.user_upi ?? "").trim() || "SKIP_UPI",
    assignedUpi,
    bankName: (r.bank_name ?? "").trim() || "—",
    accountNo: (r.bank_account_number ?? "").trim() || "—",
    ifsc: (r.ifsc_code ?? "").trim() || "—",
    createdOn: formatDt(r.created_at),
    createdAtIso: toIso(r.created_at),
    totalAmount: amt,
    discountAmount: 0,
    assignedTo: payInAssignedToLabel(r),
    assignedOn: formatDt(r.assigned_date),
    remarks: (r.user_note ?? "").trim() || "—",
    hasReceipt: Boolean(r.payment_image && String(r.payment_image).length > 0),
    paymentProof: (r.payment_image && String(r.payment_image).trim()) ? String(r.payment_image).trim() : undefined,
    utrCode: utr || undefined,
    disputeRaised: Number(r.dispute_raised ?? 0) === 1,
    expiresAtIso: toIso(r.expires_at),
    assignedAgentId: r.assigned_agent_id ? String(r.assigned_agent_id) : null,
    rawStatus: String(r.status ?? "").trim().toUpperCase(),
  };
}

export function rowToPayOutItem(r: TxRow, listRole: "admin" | "agent" = "agent"): AgentPayOutListItem {
  const amt = num(r.amount);
  const dbSt = String(r.status ?? "").toUpperCase();
  const aid = r.assigned_agent_id != null && Number(r.assigned_agent_id) > 0 ? String(r.assigned_agent_id) : null;
  let ui = mapDbStatusToPayOutUi(r.status);
  if (listRole === "admin" && dbSt === "PENDING" && aid) {
    ui = "ASSIGNED";
  }
  return {
    id: String(r.id),
    ref: `#${String(r.order_id).slice(0, 10)}`,
    amount: amt,
    status: ui,
    orderId: r.order_id,
    clientName: (r.client_name ?? "").trim() || "—",
    clientId: (r.client_id ?? "").trim() || undefined,
    clientUpi: (r.client_upi ?? r.user_upi ?? "").trim() || "—",
    bankName: (r.bank_name ?? "").trim() || "—",
    accountNo: (r.bank_account_number ?? "").trim() || "—",
    ifsc: (r.ifsc_code ?? "").trim() || "—",
    createdOn: formatDt(r.created_at),
    createdAtIso: toIso(r.created_at),
    remarks: (r.user_note ?? "").trim() || undefined,
    hasReceipt: Boolean(r.payment_image && String(r.payment_image).length > 0),
    paymentProof: (r.payment_image && String(r.payment_image).trim()) ? String(r.payment_image).trim() : undefined,
    disputeRaised: Number(r.dispute_raised ?? 0) === 1,
    assignedAgentId: aid,
    expiresAtIso: toIso(r.expires_at),
    assignedAtIso: toIso(r.assigned_date),
  };
}
