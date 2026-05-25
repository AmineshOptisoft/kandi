"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EditAgentModal from "./EditAgentModal";
import ResetAgentPasswordModal from "./ResetAgentPasswordModal";
import CreateUserModal, { PaymentMethodEditPayload } from "../users/CreateUserModal";
import Pagination from "../ui/Pagination";
import type { Agent, AgentDetailApi } from "./types";
import DateRangePicker, { DateRange } from "@/components/dashboard/DateRangePicker";
import { appendDateRangeToUrl, daysAgoInputDate, toInputDate, todayInputDate } from "@/lib/date-range";

function statusBadgeClass(s: string) {
  const x = s.toLowerCase();
  if (x === "active") return "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400";
  if (x === "pending") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  if (x === "blocked") return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
  return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
}

function formatAgentDate(v: string | Date | null | undefined): string {
  if (v == null) return "—";
  try {
    const d = typeof v === "string" ? new Date(v) : v;
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

function toListAgent(d: AgentDetailApi): Agent {
  return {
    id: d.id,
    fullname: d.fullname,
    username: d.username,
    email: d.email,
    security_deposit: d.security_deposit,
    credit_limit: d.credit_limit,
    net_pay_in: d.net_pay_in,
    net_pay_out: d.net_pay_out,
    pay_in_commission: d.pay_in_commission,
    pay_out_commission: d.pay_out_commission,
    referral_commission: d.referral_commission,
    referral_code: d.referral_code,
    status: d.status,
  };
}

/** Maps DB agent row to the legacy detail layout fields. */
function mapApiToView(a: AgentDetailApi) {
  const net = a.net_pay_in - a.net_pay_out;
  const finalBal = a.running_balance - a.security_deposit;
  const statusOnline = a.status === "active";
  return {
    id: a.id,
    username: a.username,
    displayName: a.fullname || a.username,
    parent: "—",
    rawStatus: a.status,
    status: statusOnline ? ("online" as const) : ("offline" as const),
    whatsapp: a.email || "N/A",
    currentUsage: 0,
    securityDeposit: a.security_deposit,
    creditLimit: a.credit_limit,
    net,
    prevLastRunning: a.previous_balance,
    runningToday: a.running_balance,
    final: finalBal,
    remainingBalance: a.credit_limit - finalBal,
    payinCommission: `${a.pay_in_commission}%`,
    payoutCommission: `${a.pay_out_commission}%`,
    referralCommission: `${a.referral_commission}%`,
    referralCode: a.referral_code?.trim() ? a.referral_code.trim() : "—",
    accountCreated: formatAgentDate(a.created_at),
    settlementAmount: a.settlement_amount,
    perf: {
      successRate: 0,
      totalVolume: a.net_pay_in,
      today: a.running_balance,
      thisWeek: a.net_pay_in,
    },
  };
}

type ActivityStatus = "EXPIRED" | "APPROVED" | "PENDING" | "PROCESSING" | "FAILED";
type ActivityType = "PAYIN" | "PAYOUT";
interface Activity {
  id: string;
  date: string;
  orderId: string;
  type: ActivityType;
  amount: number;
  statusLabel: string;
  category: ActivityStatus;
}

function mapDbToActivityCategory(raw: string): ActivityStatus {
  const s = raw.toUpperCase();
  if (s.includes("APPROVED")) return "APPROVED";
  if (s.includes("EXPIRED")) return "EXPIRED";
  if (s.includes("REJECTED") || s.includes("REVOKED") || s.includes("FAILED")) return "FAILED";
  if (s.includes("NOT_ASSIGNED") || s === "PAID" || s.includes("RE_ASSIGNED")) return "PROCESSING";
  if (s.includes("PENDING")) return "PENDING";
  return "PENDING";
}

function mapApiRowToActivity(t: {
  id: string;
  orderId: string;
  amount: number;
  status: string;
  type: string;
  createdAt: string | null;
}): Activity {
  const d = t.createdAt ? new Date(t.createdAt) : null;
  const dateStr =
    d && !Number.isNaN(d.getTime())
      ? `${d.toLocaleDateString("en-IN", { day: "numeric", month: "numeric", year: "numeric" })}\n${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}`
      : "—";
  const typ: ActivityType = t.type === "PAYOUT" ? "PAYOUT" : "PAYIN";
  const statusUpper = (t.status || "").toUpperCase();
  return {
    id: t.id,
    date: dateStr,
    orderId: t.orderId,
    type: typ,
    amount: t.amount,
    statusLabel: statusUpper.replace(/_/g, " ") || "—",
    category: mapDbToActivityCategory(statusUpper),
  };
}

const activityStatusStyle: Record<ActivityStatus, string> = {
  EXPIRED: "bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400",
  APPROVED: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  PENDING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  PROCESSING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  FAILED: "bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400",
};

const activityTypeStyle: Record<ActivityType, string> = {
  PAYIN: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  PAYOUT: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
};

const fmt = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN");

/** Row from `GET /api/admin/agents/[id]/pay-methods` (same shape as agent `payment_methods` list). */
type PayMethodStaffApi = {
  id: string;
  fullname: string;
  username: string;
  email: string | null;
  phone?: string | null;
  role_label?: string;
  gateway: string;
  operation_type: string;
  pay_in_enabled: boolean;
  pay_out_enabled: boolean;
  status: string;
  last_seen_label: string;
  tags: string[];
  assigned_to: string;
  upi_id?: string | null;
  bank_name?: string | null;
  account_no?: string | null;
  ifsc_code?: string | null;
  branch_name?: string | null;
  account_holder_name?: string | null;
  pay_in_limit?: number;
  pay_out_limit?: number;
  financial?: {
    totalPayIn: number;
    totalPayOut: number;
    successPayIn: number;
    failedPayIn: number;
    successPayOut: number;
    failedPayOut: number;
  };
};

function payMethodStaffApiToEditPayload(s: PayMethodStaffApi): PaymentMethodEditPayload {
  const isBank = s.gateway === "Bank Transfer Only";
  return {
    id: s.id,
    fullname: s.fullname,
    email: s.email ?? "",
    phone: s.phone ?? "",
    role: s.role_label ?? "",
    username: s.username,
    enablePayIn: s.pay_in_enabled,
    enablePayOut: s.pay_out_enabled,
    opType: s.operation_type,
    gateway: s.gateway,
    upiId: s.upi_id ?? "",
    accountHolderName: !isBank ? (s.account_holder_name ?? "") : "",
    bankAccountHolder: isBank ? (s.account_holder_name ?? "") : "",
    bankName: s.bank_name ?? "",
    accountNo: s.account_no ?? "",
    ifscCode: s.ifsc_code ?? "",
    branchName: s.branch_name ?? "",
    payInLimit: s.pay_in_limit ?? 0,
    payOutLimit: s.pay_out_limit ?? 0,
  };
}

const ACT_PAGE_SIZE = 5;

/* ── Stat card ── */
function StatCard({ label, value, icon, iconBg }: { label: string; value: number; icon: React.ReactNode; iconBg: string }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-4 flex items-center justify-between gap-3">
      <div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
      <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${iconBg}`}>
        {icon}
      </div>
    </div>
  );
}

function ReferralCodeRow({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const canCopy = code !== "—" && code.trim().length > 0;
  const copy = async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(code.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs text-gray-500 dark:text-gray-400">Referral code</span>
      <div className="flex max-w-[65%] items-center gap-2">
        <span className="truncate text-right text-xs font-mono font-semibold text-gray-800 dark:text-gray-200">{code}</span>
        {canCopy ? (
          <button
            type="button"
            onClick={() => void copy()}
            className="shrink-0 text-[10px] font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ── Profile row ── */
function InfoRow({
  label,
  value,
  valueClass = "",
  hint,
}: {
  label: string;
  value: string;
  valueClass?: string;
  /** Short tooltip on the label (e.g. credit limit meaning). */
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs text-gray-500 dark:text-gray-400 cursor-default" title={hint}>
        {label}
        {hint ? (
          <span className="ml-0.5 text-gray-400 dark:text-gray-500" aria-hidden>
            ⓘ
          </span>
        ) : null}
      </span>
      <span className={`text-xs font-semibold text-gray-800 dark:text-gray-200 ${valueClass}`}>{value}</span>
    </div>
  );
}

const PAY_METHOD_TAG_COLORS: Record<string, string> = {
  UPI: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300",
  BANK: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  PEER: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  PAYIN: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300",
  PAYOUT: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300",
};

function formatFinRupee(n: number) {
  return n > 0 ? "₹" + n.toLocaleString("en-IN") : "₹0";
}

function PayMethodToggle({
  enabled,
  color,
}: {
  enabled: boolean;
  color: "green" | "red";
}) {
  const trackOn = color === "green" ? "bg-green-400" : "bg-red-400";
  return (
    <span
      role="presentation"
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? trackOn : "bg-gray-200 dark:bg-gray-700"
        }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-6" : "translate-x-1"
          }`}
      />
    </span>
  );
}

function AgentPayMethodFinancialOverview({ data }: { data: NonNullable<PayMethodStaffApi["financial"]> }) {
  return (
    <div className="grid grid-cols-2 gap-3 px-1 pt-3">
      {[
        { label: "Total Pay In", value: formatFinRupee(data.totalPayIn) },
        { label: "Total Pay Out", value: formatFinRupee(data.totalPayOut) },
        { label: "Success Pay In", value: formatFinRupee(data.successPayIn) },
        { label: "Failed Pay In", value: formatFinRupee(data.failedPayIn) },
        { label: "Success Pay Out", value: formatFinRupee(data.successPayOut) },
        { label: "Failed Pay Out", value: formatFinRupee(data.failedPayOut) },
      ].map((r) => (
        <div
          key={r.label}
          className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2"
        >
          <span className="text-xs text-gray-500 dark:text-gray-400">{r.label}</span>
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Payment-method card (matches agent `/users` list). */
function AgentPayMethodCard({ pm, onDelete, onEdit, onTogglePayIn, onTogglePayOut }: { pm: PayMethodStaffApi; onDelete?: (id: string) => Promise<void> | void; onEdit?: (pm: PayMethodStaffApi) => void; onTogglePayIn?: (pm: PayMethodStaffApi) => Promise<void> | void; onTogglePayOut?: (pm: PayMethodStaffApi) => Promise<void> | void; }) {
  const [finOpen, setFinOpen] = useState(false);
  const fin = pm.financial ?? {
    totalPayIn: 0,
    totalPayOut: 0,
    successPayIn: 0,
    failedPayIn: 0,
    successPayOut: 0,
    failedPayOut: 0,
  };
  const tags = pm.tags?.length ? pm.tags : ["UPI"];
  const indicator = pm.status === "active" ? "bg-green-400" : "bg-gray-300";
  const displayName = pm.fullname?.trim() || pm.username;
  const subName = pm.username;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 shrink-0">
            <svg className="w-5 h-5 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">{displayName}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{subName}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
          {tags.map((t) => (
            <span
              key={`${pm.id}-${t}`}
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PAY_METHOD_TAG_COLORS[t] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
            >
              {t}
            </span>
          ))}
          <span className={`w-2.5 h-2.5 rounded-full ${indicator} ml-1`} title={pm.status} />
        </div>

        <div className="flex items-center gap-2 mb-1 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{pm.last_seen_label}</span>
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="truncate">{pm.assigned_to || "—"}</span>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-3">{pm.gateway}</p>

        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => onEdit && onEdit(pm)}
            className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete && onDelete(pm.id)}
            className="flex-1 rounded-lg border border-red-100 dark:border-red-900/30 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
          >
            Delete
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div
            onClick={() => onTogglePayIn && onTogglePayIn(pm)}
            className={`flex items-center justify-between rounded-xl px-3 py-2 cursor-pointer transition-colors ${pm.pay_in_enabled ? "bg-green-50 dark:bg-green-900/10 hover:bg-green-100 dark:hover:bg-green-900/20" : "bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4" />
              </svg>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">Pay In</span>
            </div>
            <PayMethodToggle enabled={pm.pay_in_enabled} color="green" />
          </div>
          <div
            onClick={() => onTogglePayOut && onTogglePayOut(pm)}
            className={`flex items-center justify-between rounded-xl px-3 py-2 cursor-pointer transition-colors ${pm.pay_out_enabled ? "bg-purple-50 dark:bg-purple-900/10 hover:bg-purple-100 dark:hover:bg-purple-900/20" : "bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20"
              }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8V20m0 0l4-4m-4 4l-4-4" />
              </svg>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">Pay Out</span>
            </div>
            <PayMethodToggle enabled={pm.pay_out_enabled} color="red" />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setFinOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Financial Overview
          </div>
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${finOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {finOpen ? (
          <div className="px-4 pb-4">
            <AgentPayMethodFinancialOverview data={fin} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AgentDetail({ id }: { id: string }) {
  const router = useRouter();
  const { can } = useAdminPermissions();
  const [detail, setDetail] = useState<AgentDetailApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethodEditPayload | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"accounts" | "stats">("stats");
  const [actPage, setActPage] = useState(1);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [txError, setTxError] = useState<string | null>(null);
  const [payMethods, setPayMethods] = useState<PayMethodStaffApi[]>([]);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [dateRangeTx, setDateRangeTx] = useState<DateRange | null>(null);
  const [dateRangeAccounts, setDateRangeAccounts] = useState<DateRange | null>(null);

  useEffect(() => {
    setActPage(1);
  }, [id, dateRangeTx]);

  const { loading: authLoading } = useAuth();

  const load = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    setTxError(null);
    setActivities([]);
    setPayMethods([]);
    setAccountsError(null);
    const idNum = Number(id);
    if (!Number.isInteger(idNum) || idNum < 1) {
      setNotFound(true);
      setDetail(null);
      setPayMethods([]);
      setAccountsError(null);
      setLoading(false);
      return;
    }
    try {
      // Default to last 10 days when no date range is selected
      const fallbackFrom = daysAgoInputDate(10);
      const fallbackTo = todayInputDate();
      const txFrom = dateRangeTx?.from ? toInputDate(dateRangeTx.from) : fallbackFrom;
      const txTo = dateRangeTx?.to ? toInputDate(dateRangeTx.to) : fallbackTo;
      const pmFrom = dateRangeAccounts?.from ? toInputDate(dateRangeAccounts.from) : fallbackFrom;
      const pmTo = dateRangeAccounts?.to ? toInputDate(dateRangeAccounts.to) : fallbackTo;
      const [agentRes, txRes, pmRes] = await Promise.all([
        fetch(`/api/agents/${id}`, { credentials: "include" }),
        fetch(appendDateRangeToUrl(`/api/admin/agents/${id}/transactions`, txFrom, txTo), {
          credentials: "include",
        }),
        fetch(appendDateRangeToUrl(`/api/admin/agents/${id}/pay-methods`, pmFrom, pmTo) + `&_t=${Date.now()}`, {
          credentials: "include",
          cache: "no-store",
          headers: { "Pragma": "no-cache", "Cache-Control": "no-cache" }
        }),
      ]);

      if (agentRes.status === 401) {
        setLoadError("Admin sign-in required.");
        setDetail(null);
        setPayMethods([]);
        setAccountsError(null);
        return;
      }

      const agentData = (await agentRes.json().catch(() => ({}))) as {
        ok?: boolean;
        agent?: AgentDetailApi;
        error?: string;
      };

      if (agentRes.status === 404) {
        setNotFound(true);
        setDetail(null);
        setPayMethods([]);
        setAccountsError(null);
        return;
      }
      if (!agentRes.ok || !agentData.ok || !agentData.agent) {
        setLoadError(agentData.error ?? "Could not load agent.");
        setDetail(null);
        setPayMethods([]);
        setAccountsError(null);
        return;
      }

      setDetail(agentData.agent);

      const txData = (await txRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        transactions?: {
          id: string;
          orderId: string;
          amount: number;
          status: string;
          type: string;
          createdAt: string | null;
        }[];
      };

      if (txRes.ok && txData.ok && Array.isArray(txData.transactions)) {
        setActivities(txData.transactions.map(mapApiRowToActivity));
        setTxError(null);
      } else {
        setActivities([]);
        setTxError(txData.error ?? "Could not load transactions.");
      }

      const pmData = (await pmRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        payment_methods?: PayMethodStaffApi[];
      };
      if (pmRes.ok && pmData.ok && Array.isArray(pmData.payment_methods)) {
        const normalized: PayMethodStaffApi[] = pmData.payment_methods.map((s) => {
          const row = s as PayMethodStaffApi & { tags?: string[]; assigned_to?: string };
          return {
            ...row,
            tags: Array.isArray(row.tags) ? row.tags : ["UPI"],
            assigned_to: typeof row.assigned_to === "string" ? row.assigned_to : "",
          };
        });
        setPayMethods(normalized);
        setAccountsError(null);
      } else {
        setPayMethods([]);
        setAccountsError(pmData.error ?? "Could not load payment accounts.");
      }
    } catch {
      setLoadError("Network error.");
      setDetail(null);
      setPayMethods([]);
      setAccountsError(null);
    } finally {
      setLoading(false);
    }
  }, [id, dateRangeTx, dateRangeAccounts]);

  useEffect(() => {
    void load();
  }, [load]);

  const actPaginated = useMemo(
    () => activities.slice((actPage - 1) * ACT_PAGE_SIZE, actPage * ACT_PAGE_SIZE),
    [activities, actPage],
  );

  const stats = useMemo(() => {
    const totalTx = activities.length;
    const completed = activities.filter((a) => a.category === "APPROVED").length;
    const processing = activities.filter(
      (a) => a.category === "PROCESSING" || a.category === "PENDING",
    ).length;
    const failed = activities.filter((a) => a.category === "EXPIRED" || a.category === "FAILED").length;
    const payins = activities.filter((a) => a.type === "PAYIN");
    const payouts = activities.filter((a) => a.type === "PAYOUT");
    const completedPayins = payins.filter((a) => a.category === "APPROVED").length;
    const payinVolume = payins.reduce((s, a) => s + a.amount, 0);
    const payinSuccess = payins.length ? ((completedPayins / payins.length) * 100).toFixed(2) : "0.00";
    const completedPayouts = payouts.filter((a) => a.category === "APPROVED").length;
    const payoutVolume = payouts.reduce((s, a) => s + a.amount, 0);
    const payoutSuccess = payouts.length ? ((completedPayouts / payouts.length) * 100).toFixed(2) : "0.00";
    return {
      totalTx,
      completed,
      processing,
      failed,
      payinsCount: payins.length,
      completedPayins,
      payinVolume,
      payinSuccess,
      payoutsCount: payouts.length,
      completedPayouts,
      payoutVolume,
      payoutSuccess,
    };
  }, [activities]);

  async function patchStatus(next: string) {
    if (!detail) return;
    setToggleBusy(true);
    try {
      const res = await fetch(`/api/agents/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) await load();
    } finally {
      setToggleBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center text-gray-500 dark:border-gray-800 dark:bg-white/[0.03]">
        Loading agent…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
        <p className="mb-2">{loadError}</p>
        <Link href="/signin/admin" className="font-semibold text-blue-600 underline dark:text-blue-400">
          Sign in as admin
        </Link>
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-800 dark:bg-white/[0.03]">
        <p className="text-gray-600 dark:text-gray-300">Agent not found.</p>
        <Link href="/agent" className="mt-4 inline-block text-blue-500 hover:underline">
          Back to agents
        </Link>
      </div>
    );
  }

  const agent = mapApiToView(detail);
  const initials = agent.username.slice(0, 1).toUpperCase();

  return (
    <div className="flex flex-col gap-5">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Vendor Details — <span className="text-blue-500">{agent.username}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {can("edit_agents") && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="rounded-xl bg-blue-500 hover:bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors shadow-sm"
            >
              Edit Vendor
            </button>
          )}
          {(agent.rawStatus === "active" ? can("deactivate_agents") : can("activate_agents")) && (
            <button
              type="button"
              disabled={toggleBusy}
              onClick={() => void patchStatus(agent.rawStatus === "active" ? "deactivated" : "active")}
              className="rounded-xl bg-orange-400 hover:bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors shadow-sm disabled:opacity-50"
            >
              {agent.rawStatus === "active" ? "Deactivate" : "Activate"}
            </button>
          )}
          {can("edit_agents") && (
            <button
              type="button"
              onClick={() => setPasswordModalOpen(true)}
              className="rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2 text-sm font-semibold text-white transition-colors shadow-sm"
            >
              New password
            </button>
          )}
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">

        {/* ── Left: Profile card ── */}
        <div className="rounded-2xl bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 overflow-hidden">
          {/* Card header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Profile Information</span>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClass(agent.rawStatus)}`}>
              {agent.rawStatus}
            </span>
          </div>

          {/* Avatar */}
          <div className="flex flex-col items-center pt-6 pb-4 px-5 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-teal-500 dark:bg-teal-600 mb-2 shrink-0">
              <span className="text-2xl font-bold text-white">{initials}</span>
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{agent.username}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{agent.username.toLowerCase()}</p>
          </div>

          {/* Info rows */}
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <InfoRow label="Email / contact" value={agent.whatsapp} />
            {/* <InfoRow label="Current Usage" value={fmt(agent.currentUsage)} /> */}
            <InfoRow label="Security Deposit" value={fmt(agent.securityDeposit)} />
            <InfoRow
              label="Credit Limit"
              value={fmt(agent.creditLimit)}
              hint="Extra PayIn headroom on top of the security pool: even if deposit-backed room is tight, this much additional PayIn exposure is still allowed."
            />
            <InfoRow label="Net (PayIn − PayOut)" value={agent.net >= 0 ? fmt(agent.net) : `₹-${Math.abs(agent.net).toLocaleString("en-IN")}`} />
            <InfoRow label="Prev (Last Running)" value={agent.prevLastRunning >= 0 ? fmt(agent.prevLastRunning) : `₹-${Math.abs(agent.prevLastRunning).toLocaleString("en-IN")}`}
              valueClass={agent.prevLastRunning < 0 ? "text-red-500 dark:text-red-400" : ""} />
            <InfoRow label="Running (Today)" value={agent.runningToday >= 0 ? fmt(agent.runningToday) : `₹-${Math.abs(agent.runningToday).toLocaleString("en-IN")}`}
              valueClass={agent.runningToday < 0 ? "text-red-500 dark:text-red-400" : ""} />
            <InfoRow label="Final" value={`₹${agent.final < 0 ? "-" : ""}${Math.abs(agent.final).toLocaleString("en-IN")}`}
              valueClass={agent.final < 0 ? "text-red-500 dark:text-red-400" : ""} />
            <InfoRow
              label="Remaining Balance"
              value={`${agent.remainingBalance < 0 ? "-" : ""}₹${Math.abs(agent.remainingBalance).toLocaleString("en-IN")}`}
              hint="Credit limit minus final balance (credit − (running − security))."
            />
            <InfoRow label="Settlement" value={fmt(agent.settlementAmount)} />
            <InfoRow label="PayIn Commission" value={agent.payinCommission} />
            <InfoRow label="PayOut Commission" value={agent.payoutCommission} />
            <InfoRow label="Referral Commission" value={agent.referralCommission} />
            <ReferralCodeRow code={agent.referralCode} />
            <InfoRow label="Account Created" value={agent.accountCreated} />
          </div>

          {/* Performance Summary */}
          <div className="px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Performance Summary</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Success Rate", value: `${stats.totalTx ? ((stats.completed / stats.totalTx) * 100).toFixed(2) : "0.00"}%`, neg: false },
                { label: "Total PayIn", value: agent.perf.totalVolume >= 0 ? fmt(agent.perf.totalVolume) : `₹-${Math.abs(agent.perf.totalVolume).toLocaleString("en-IN")}`, neg: agent.perf.totalVolume < 0 },
                { label: "Today Running", value: agent.perf.today >= 0 ? fmt(agent.perf.today) : `₹-${Math.abs(agent.perf.today).toLocaleString("en-IN")}`, neg: agent.perf.today < 0 },
                { label: "This Week", value: agent.perf.thisWeek >= 0 ? fmt(agent.perf.thisWeek) : `₹-${Math.abs(agent.perf.thisWeek).toLocaleString("en-IN")}`, neg: agent.perf.thisWeek < 0 },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">{item.label}</p>
                  <p className={`text-sm font-bold ${item.neg ? "text-red-500" : "text-gray-800 dark:text-gray-200"}`}>{item.value}</p>
                </div>
              ))}
            </div>
            {/* <button
              type="button"
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 hover:bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm"
              onClick={() => {
                setActiveTab("stats");
                setTimeout(() => {
                  document.getElementById("recent-activity")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 0);
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Full Transaction History
            </button> */}
          </div>
        </div>

        {/* ── Right: Tabs ── */}
        <div className="rounded-2xl bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200 dark:border-gray-800">
            {(["accounts", "stats"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3.5 text-sm font-semibold transition-colors ${activeTab === tab
                  ? "border-b-2 border-blue-500 text-blue-500"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
              >
                {tab === "accounts" ? "Payment Accounts" : "Transaction Stats"}
              </button>
            ))}
          </div>

          {/* ── Transaction Stats tab ── */}
          {activeTab === "stats" && (
            <div className="p-5 flex flex-col gap-5">
              {/* Section heading */}

              <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:items-end sm:justify-between  w-full ">
                <h2 className="text-base font-bold text-gray-800 dark:text-white">Transaction Statistics</h2>
                <div className="w-50">
                  <DateRangePicker
                    value={dateRangeTx}
                    onChange={(r) => setDateRangeTx(r)}
                    fullWidth
                  />
                </div>
              </div>
              {txError && (
                <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                  {txError}
                </div>
              )}

              {/* 4 stat cards */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <StatCard label="Total Transactions" value={stats.totalTx} iconBg="bg-blue-100 dark:bg-blue-900/30"
                  icon={<svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>} />
                <StatCard label="Completed" value={stats.completed} iconBg="bg-green-100 dark:bg-green-900/30"
                  icon={<svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                <StatCard label="Processing" value={stats.processing} iconBg="bg-yellow-100 dark:bg-yellow-900/30"
                  icon={<svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>} />
                <StatCard label="Failed/Rejected" value={stats.failed} iconBg="bg-red-100 dark:bg-red-900/30"
                  icon={<svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
              </div>

              {/* Pay-In + Pay-Out stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Pay-In */}
                <div className="rounded-xl border border-green-200 dark:border-green-900/40 bg-green-50/60 dark:bg-green-900/10 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/40">
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-bold text-green-700 dark:text-green-400">Pay-In Statistics</h3>
                  </div>
                  {[
                    { label: "Total Pay-Ins:", value: stats.payinsCount.toString() },
                    { label: "Completed Pay-Ins:", value: stats.completedPayins.toString() },
                    {
                      label: "Total Volume:",
                      value:
                        stats.payinVolume >= 1000
                          ? `₹${(stats.payinVolume / 1000).toFixed(0)}K`
                          : fmt(stats.payinVolume),
                    },
                    { label: "Success Rate:", value: `${stats.payinSuccess}%` },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-green-100 dark:border-green-900/30 last:border-0">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{r.label}</span>
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{r.value}</span>
                    </div>
                  ))}
                </div>

                {/* Pay-Out */}
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-900/10 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40">
                      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8V20m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-bold text-blue-700 dark:text-blue-400">Pay-Out Statistics</h3>
                  </div>
                  {[
                    { label: "Total Pay-Outs:", value: stats.payoutsCount.toString() },
                    { label: "Completed Pay-Outs:", value: stats.completedPayouts.toString() },
                    { label: "Total Volume:", value: fmt(stats.payoutVolume) },
                    { label: "Success Rate:", value: `${stats.payoutSuccess}%` },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-blue-100 dark:border-blue-900/30 last:border-0">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{r.label}</span>
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div id="recent-activity" className="scroll-mt-24">

                <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-white/[0.02]">
                          {["Date", "Order ID", "Type", "Amount", "Status", "Actions"].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {actPaginated.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                              {txError ? "Could not load activity." : "No assigned transactions yet."}
                            </td>
                          </tr>
                        ) : (
                          actPaginated.map((a) => (
                            <tr key={a.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 py-3">
                                {a.date.split("\n").map((line, i) => (
                                  <p
                                    key={i}
                                    className={`text-xs ${i === 0 ? "font-medium text-gray-700 dark:text-gray-200" : "text-gray-400"}`}
                                  >
                                    {line}
                                  </p>
                                ))}
                              </td>
                              <td className="px-4 py-3 text-xs font-mono text-gray-600 dark:text-gray-300 break-all max-w-[180px]">
                                {a.orderId}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${activityTypeStyle[a.type]}`}
                                >
                                  {a.type}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                                ₹{a.amount.toLocaleString("en-IN")}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${activityStatusStyle[a.category]}`}
                                >
                                  {a.statusLabel}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <Link
                                  href={`/transactions/${a.id}`}
                                  title="View transaction"
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                    />
                                  </svg>
                                </Link>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-white/[0.02]">
                    <p className="text-xs text-gray-400 shrink-0">
                      {activities.length === 0
                        ? "No entries"
                        : `Showing ${(actPage - 1) * ACT_PAGE_SIZE + 1} to ${Math.min(actPage * ACT_PAGE_SIZE, activities.length)} of ${activities.length} entries`}
                    </p>
                    {activities.length > 0 ? (
                      <Pagination
                        total={activities.length}
                        page={actPage}
                        pageSize={ACT_PAGE_SIZE}
                        onPageChange={setActPage}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Payment Accounts tab ── */}
          {activeTab === "accounts" && (
            <div className="p-5 flex flex-col gap-4">
              {!can("view_payment_accounts") ? (
                <div className="flex flex-col items-center justify-center py-14 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Access Denied</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">You do not have permission to view payment accounts.</p>
                </div>
              ) : (
                <>
                  {accountsError && (
                    <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                      {accountsError}
                    </div>
                  )}

                  {payMethods.length === 0 && !accountsError ? (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 py-14 text-center text-gray-400 dark:text-gray-500">
                      <svg className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No payment accounts yet</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-500 max-w-sm mx-auto">
                        The agent will add the payment method from their panel — all linked methods will be displayed here.
                      </p>
                    </div>
                  ) : null}

                  {payMethods.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-base font-bold text-gray-900 dark:text-white">Payment accounts</h3>
                          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            {payMethods.length} {payMethods.length === 1 ? "account" : "accounts"}
                          </span>
                        </div>
                        <div className="w-64">
                          <DateRangePicker
                            value={dateRangeAccounts}
                            onChange={(r) => setDateRangeAccounts(r)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {payMethods.map((pm) => (
                          <AgentPayMethodCard
                            key={pm.id}
                            pm={pm}
                            onDelete={can("delete_payment_accounts") ? async (pmId) => {
                              if (!confirm("Delete this payment account? This cannot be undone.")) return;
                              try {
                                const res = await fetch(`/api/admin/agents/${id}/pay-methods/${pmId}`, {
                                  method: "DELETE",
                                  credentials: "include",
                                });
                                const d = await res.json().catch(() => ({}));
                                if (!res.ok || !d.ok) {
                                  setAccountsError(d.error ?? "Could not delete account.");
                                  return;
                                }
                                await load();
                              } catch {
                                setAccountsError("Network error.");
                              }
                            } : undefined}
                            onEdit={can("edit_payment_accounts") ? (pmRow) => {
                              setEditPaymentMethod(payMethodStaffApiToEditPayload(pmRow));
                              setShowCreateModal(true);
                            } : undefined}
                            onTogglePayIn={(can("enable_payin") || can("disable_payin")) ? async (pmRow) => {
                              const originalState = pmRow.pay_in_enabled;
                              // Check specific permission for the action about to be taken
                              if (originalState && !can("disable_payin")) return;
                              if (!originalState && !can("enable_payin")) return;

                              setPayMethods(prev => prev.map(p =>
                                p.id === pmRow.id ? { ...p, pay_in_enabled: !originalState } : p
                              ));
                              try {
                                const res = await fetch(`/api/admin/agents/${id}/pay-methods/${pmRow.id}`, {
                                  method: "PATCH",
                                  credentials: "include",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ pay_in_enabled: !originalState }),
                                });
                                const d = await res.json().catch(() => ({}));
                                if (!res.ok || !d.ok) {
                                  setPayMethods(prev => prev.map(p =>
                                    p.id === pmRow.id ? { ...p, pay_in_enabled: originalState } : p
                                  ));
                                  setAccountsError(d.error ?? "Could not update account.");
                                  return;
                                }
                                if (d.payment_method) {
                                  setPayMethods(prev => prev.map(p =>
                                    p.id === pmRow.id ? d.payment_method : p
                                  ));
                                }
                              } catch {
                                setPayMethods(prev => prev.map(p =>
                                  p.id === pmRow.id ? { ...p, pay_in_enabled: originalState } : p
                                ));
                                setAccountsError("Network error.");
                              }
                            } : undefined}
                            onTogglePayOut={(can("enable_payout") || can("disable_payout")) ? async (pmRow) => {
                              const originalState = pmRow.pay_out_enabled;
                              // Check specific permission for the action about to be taken
                              if (originalState && !can("disable_payout")) return;
                              if (!originalState && !can("enable_payout")) return;

                              setPayMethods(prev => prev.map(p =>
                                p.id === pmRow.id ? { ...p, pay_out_enabled: !originalState } : p
                              ));
                              try {
                                const res = await fetch(`/api/admin/agents/${id}/pay-methods/${pmRow.id}`, {
                                  method: "PATCH",
                                  credentials: "include",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ pay_out_enabled: !originalState }),
                                });
                                const d = await res.json().catch(() => ({}));
                                if (!res.ok || !d.ok) {
                                  setPayMethods(prev => prev.map(p =>
                                    p.id === pmRow.id ? { ...p, pay_out_enabled: originalState } : p
                                  ));
                                  setAccountsError(d.error ?? "Could not update account.");
                                  return;
                                }
                                if (d.payment_method) {
                                  setPayMethods(prev => prev.map(p =>
                                    p.id === pmRow.id ? d.payment_method : p
                                  ));
                                }
                              } catch {
                                setPayMethods(prev => prev.map(p =>
                                  p.id === pmRow.id ? { ...p, pay_out_enabled: originalState } : p
                                ));
                                setAccountsError("Network error.");
                              }
                            } : undefined}
                          />
                        ))}
                      </div>
                    </>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {editOpen && (
        <EditAgentModal
          agent={toListAgent(detail)}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            void load();
          }}
        />
      )}

      {passwordModalOpen && (
        <ResetAgentPasswordModal
          agentId={detail.id}
          username={detail.username}
          onClose={() => setPasswordModalOpen(false)}
          onSaved={() => {
            void load();
          }}
        />
      )}

      {showCreateModal && (
        <CreateUserModal
          editPaymentMethod={editPaymentMethod}
          adminAgentId={id}
          onClose={() => {
            setShowCreateModal(false);
            setEditPaymentMethod(null);
          }}
          onSuccess={() => void load()}
        />
      )}
    </div>
  );
}
