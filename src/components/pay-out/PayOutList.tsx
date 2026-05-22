"use client";
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { AgentPayOutListItem } from "@/lib/agent-transactions-map";
import CompanyTxnAccordionCard from "../company/CompanyTxnAccordionCard";
import DateRangePicker, { DateRange } from "../dashboard/DateRangePicker";
import { isAgentPayoutApproveUnlocked } from "@/lib/payout-agent-approve-delay-ui";
import Pagination from "../ui/Pagination";
import PendingExpireCountdown from "../ui/PendingExpireCountdown";
import { Modal } from "../ui/modal";
import { compressImageDataUrlIfLarge } from "@/lib/compress-image-data-url";
import { csvExportTimestamp, downloadCsv } from "@/lib/csv-download";
import { PiContactlessPaymentFill } from "react-icons/pi";
import { useTransactionRealtimeRefresh } from "@/hooks/useTransactionRealtimeRefresh";
import { useAuth } from "@/context/AuthContext";
import { PayOutIcon } from "@/icons/nav-icons";
import { toInputDate } from "@/lib/date-range";

const PAGE_SIZE = 5;

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

type PayOutStatus =
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

type PayOutItem = AgentPayOutListItem;
type CompanyPayoutItem = {
  id: string;
  orderId: string;
  amount: number;
  status: string;
  clientName: string;
  clientUpi: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  createdAtIso?: string;
  remarks?: string;
  utrCode?: string;
  assignedUpi?: string;
  assignedAtIso?: string;
  assignedToLabel?: string;
  expiresAtIso?: string;
};
type AgentOption = { id: string; label: string };

const STATUS_TABS: { label: string; value: PayOutStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Unassigned", value: "UNASSIGNED" },
  { label: "Pending", value: "PENDING" },
  { label: "Assigned", value: "ASSIGNED" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Approved", value: "APPROVED" },
  { label: "Declined", value: "DECLINED" },
  { label: "Exp. Approved (Admin)", value: "EXPIRED_APPROVED_BY_ADMIN" },
  { label: "Exp. Approved (Agent)", value: "EXPIRED_APPROVED_BY_AGENT" },
];

const STATUS_FILTER_OPTIONS = [
  "All",
  "CREATED",
  "UNASSIGNED",
  "PENDING",
  "ASSIGNED",
  "PROCESSING",
  "EXPIRED",
  "APPROVED",
  "DECLINED",
  "EXPIRED_APPROVED_BY_ADMIN",
  "EXPIRED_APPROVED_BY_AGENT",
];

const statusStyle: Record<PayOutStatus, string> = {
  CREATED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  UNASSIGNED: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  PENDING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  ASSIGNED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  PROCESSING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  EXPIRED: "bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  DECLINED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  EXPIRED_APPROVED_BY_ADMIN: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  EXPIRED_APPROVED_BY_AGENT: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
};

const showAssign = (item: PayOutItem) =>
  !item.assignedAgentId &&
  (item.status === "CREATED" ||
    item.status === "UNASSIGNED" ||
    item.status === "PENDING" ||
    item.status === "EXPIRED");

const showApprove = (item: PayOutItem) =>
  (item.status === "PROCESSING" || item.status === "PENDING" || item.status === "EXPIRED") && !!item.assignedAgentId;

/** Agent: DB stays PENDING after admin assign; approve after proof or from processing. */
const showApproveAgent = (item: PayOutItem) =>
  (item.status === "PENDING" || item.status === "PROCESSING" || item.status === "EXPIRED") && !!item.assignedAgentId;

const showReject = (s: PayOutStatus) => s === "PENDING" || s === "PROCESSING" || s === "EXPIRED";
const showCancel = (s: PayOutStatus) => s === "PENDING" || s === "PROCESSING" || s === "EXPIRED";
const showActions = (item: PayOutItem) => showApprove(item) || showReject(item.status) || showCancel(item.status);

function showPayOutExpireCountdown(item: PayOutItem): boolean {
  if (!item.expiresAtIso) return false;
  return (
    item.status === "PENDING" ||
    item.status === "UNASSIGNED" ||
    item.status === "ASSIGNED" ||
    item.status === "PROCESSING" ||
    item.status === "CREATED"
  );
}

function canOpenApproveModal(role: "admin" | "agent", item: PayOutItem): boolean {
  return role === "agent" ? showApproveAgent(item) : showApprove(item);
}

function formatApproveDelayRemain(assignedAtIso: string, delayMinutes: number): string {
  const end = new Date(assignedAtIso.trim()).getTime() + delayMinutes * 60_000;
  const sec = Math.max(0, Math.ceil((end - Date.now()) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function MoneyIcon() {
  return (
    <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="2" y="6" width="20" height="13" rx="2" strokeWidth={1.5} />
      <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeWidth={1.5} d="M6 9.5v5M18 9.5v5" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="inline w-3.5 h-3.5 ml-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function DetailField({ label, value, isLink }: { label: string; value: string; isLink?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">{label}</p>
      {isLink ? (
        <a href="#" className="text-sm font-medium text-blue-500 hover:underline break-all">
          {value}<ExternalLinkIcon />
        </a>
      ) : (
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 break-all">{value}</p>
      )}
    </div>
  );
}

function AssignButton({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-gray-900 dark:bg-white px-5 py-2 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors shadow-sm whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
    >
      Assign
    </button>
  );
}

function ApproveButton({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-gray-900 dark:bg-white px-5 py-2 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors shadow-sm whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
    >
      Approve
    </button>
  );
}

function RejectButton({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      Reject
    </button>
  );
}

function ViewButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/20 transition-colors"
    >
      View
    </button>
  );
}

function ChevronBtn({ rotated, onClick }: { rotated: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
    >
      <svg className={`w-4 h-4 transition-transform duration-200 ${rotated ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

function proofIsPdf(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (u.startsWith("data:") && u.includes("application/pdf")) return true;
  const path = u.split("?")[0] ?? u;
  return path.endsWith(".pdf");
}

function DeclineMenu({
  disabled,
  onReject,
  onRevoke,
}: {
  disabled?: boolean;
  onReject: () => void;
  onRevoke: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Decline
        <svg className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 min-w-[10rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            onClick={() => {
              setOpen(false);
              onReject();
            }}
          >
            Reject
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/20"
            onClick={() => {
              setOpen(false);
              onRevoke();
            }}
          >
            Revoke
          </button>
        </div>
      )}
    </div>
  );
}

function PayOutCard({
  item,
  busy,
  onOpenAction,
  onView,
  onOpenProof,
  allowAssign,
  isAdmin,
  isAgent,
  onDispute,
  agentApproveDelayMinutes,
}: {
  item: PayOutItem;
  busy?: boolean;
  onOpenAction: (item: PayOutItem, action: "approve" | "reject" | "cancel" | "assign") => void;
  onView?: () => void;
  onOpenProof?: (proofUrl: string) => void;
  allowAssign?: boolean;
  isAdmin?: boolean;
  isAgent?: boolean;
  onDispute?: (item: PayOutItem) => void;
  /** From server when agent loads payouts; controls post-assignment approve delay. */
  agentApproveDelayMinutes?: number;
}) {
  const [extraOpen, setExtraOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [delayTick, setDelayTick] = useState(0);

  useEffect(() => {
    if (!isAgent || agentApproveDelayMinutes == null || agentApproveDelayMinutes <= 0) return;
    if (item.status !== "PENDING" || !item.assignedAtIso) return;
    if (isAgentPayoutApproveUnlocked(item, agentApproveDelayMinutes)) return;
    const id = window.setInterval(() => setDelayTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [isAgent, agentApproveDelayMinutes, item.id, item.status, item.assignedAtIso]);

  void delayTick;
  const baseApprove = isAgent ? showApproveAgent(item) : showApprove(item);
  const approveUnlocked =
    !isAgent || agentApproveDelayMinutes == null
      ? true
      : isAgentPayoutApproveUnlocked(item, agentApproveDelayMinutes);
  const showApproveBtn = baseApprove && approveUnlocked;

  const headerRow = (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
        <span className="text-xs font-mono font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{item.ref}</span>
        <MoneyIcon />
        <span className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">
          {item.amount.toLocaleString("en-IN")} INR
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${statusStyle[item.status]}`}>
          {item.status}
        </span>
        {showPayOutExpireCountdown(item) && approveUnlocked ? (
          <PendingExpireCountdown
            expiresAtIso={item.expiresAtIso!}
            assignedAtIso={item.assignedAtIso}
            delayMinutes={agentApproveDelayMinutes}
          />
        ) : null}
        {isAgent &&
          item.status === "PENDING" &&
          baseApprove &&
          !approveUnlocked &&
          item.assignedAtIso &&
          agentApproveDelayMinutes != null &&
          agentApproveDelayMinutes > 0 ? (
          <span
            className="text-[10px] font-semibold tabular-nums text-amber-700 dark:text-amber-300"
            title="Approve is available after the assignment cooling period (set by server)."
          >
            Approve in {formatApproveDelayRemain(item.assignedAtIso, agentApproveDelayMinutes)}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!item.disputeRaised && allowAssign && showAssign(item) && (
          <AssignButton onClick={() => onOpenAction(item, "assign")} disabled={busy} />
        )}
        {!item.disputeRaised && showApproveBtn && (
          <ApproveButton onClick={() => onOpenAction(item, "approve")} disabled={busy} />
        )}
        {!item.disputeRaised && showReject(item.status) && showCancel(item.status) ? (
          <DeclineMenu
            disabled={busy}
            onReject={() => onOpenAction(item, "reject")}
            onRevoke={() => onOpenAction(item, "cancel")}
          />
        ) : !item.disputeRaised && showReject(item.status) ? (
          <RejectButton onClick={() => onOpenAction(item, "reject")} disabled={busy} />
        ) : !item.disputeRaised && showCancel(item.status) ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onOpenAction(item, "cancel")}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Revoke
          </button>
        ) : null}
        {isAdmin &&
          onDispute &&
          !item.disputeRaised &&
          (showApproveBtn || showReject(item.status) || showCancel(item.status) || item.status === "ASSIGNED") && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDispute(item)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-purple-600 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-900/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Dispute
            </button>
          )}
        {onView && <ViewButton onClick={onView} />}
        {item.hasReceipt && (
          <button
            type="button"
            title="View payment proof"
            disabled={busy}
            onClick={() => {
              const p = item.paymentProof?.trim();
              if (p) onOpenProof?.(p);
              else window.alert("Proof is not available for this transaction.");
            }}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <ReceiptIcon />
          </button>
        )}
        {/* Mobile chevron */}
        <span className="lg:hidden">
          <ChevronBtn rotated={mobileOpen} onClick={() => setMobileOpen((v) => !v)} />
        </span>
        {/* Desktop chevron */}
        <span className="hidden lg:inline-flex">
          <ChevronBtn rotated={extraOpen} onClick={() => setExtraOpen((v) => !v)} />
        </span>
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/3 overflow-hidden">
      {headerRow}

      {/* ── DESKTOP: always-visible detail rows ── */}
      <div className="hidden lg:block border-t border-gray-100 dark:border-gray-800 px-5 py-4">
        {/* Row 1: ORDER ID · CLIENT ID · CLIENT NAME · CLIENT UPI */}
        <div className="grid grid-cols-4 gap-x-8 mb-4">
          <DetailField label="Order ID" value={item.orderId} />
          <DetailField label="Client ID" value={item.clientId || "—"} />
          <DetailField label="Client Name" value={item.clientName} />
          <DetailField label="Client UPI" value={item.clientUpi} />
        </div>

        {/* Row 2: BANK NAME · ACCOUNT NO · IFSC + Assign button */}
        <div className="flex items-end gap-8">
          <div className="grid grid-cols-3 gap-x-8 flex-1">
            <DetailField label="Bank Name" value={item.bankName} />
            <DetailField label="Account No" value={item.accountNo} />
            <DetailField label="IFSC" value={item.ifsc} />
          </div>
          <div className="shrink-0" />
        </div>

        {/* Extra rows toggled by chevron */}
        {extraOpen && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-3 gap-x-8 gap-y-4">
            <DetailField label="Created On" value={item.createdOn} />
            {item.assignedTo && <DetailField label="Assigned To" value={item.assignedTo} />}
            {item.assignedOn && <DetailField label="Assigned On" value={item.assignedOn} />}
            {item.remarks && <DetailField label="Remarks" value={item.remarks} />}
          </div>
        )}
      </div>

      {/* ── MOBILE: accordion ── */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-100 dark:border-gray-800 px-4 py-4 grid grid-cols-1 gap-4">
          <DetailField label="Order ID" value={item.orderId} />
          <DetailField label="Client ID" value={item.clientId || "—"} />
          <DetailField label="Client Name" value={item.clientName} />
          <DetailField label="Client UPI" value={item.clientUpi} />
          <DetailField label="Bank Name" value={item.bankName} />
          <DetailField label="Account No" value={item.accountNo} />
          <DetailField label="IFSC" value={item.ifsc} />
          <DetailField label="Created On" value={item.createdOn} />
          {item.assignedTo && <DetailField label="Assigned To" value={item.assignedTo} />}
          {item.assignedOn && <DetailField label="Assigned On" value={item.assignedOn} />}
          {item.remarks && <DetailField label="Remarks" value={item.remarks} />}
        </div>
      )}
    </div>
  );
}

type CompanyPayOutTab = "ALL" | "APPROVED" | "PENDING" | "UNASSIGNED" | "REJECTED";
type ActionType = "approve" | "reject" | "cancel" | "assign";

function CompanyPayOutRequestModal({
  isOpen,
  onClose,
  onSubmitted,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const inputClass =
    "h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500/15";
  const [form, setForm] = useState({
    client_id: "",
    client_name: "",
    account_holder_name: "",
    amount: "",
    bank_name: "",
    bank_account_number: "",
    ifsc_code: "",
    user_note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  function patchField(k: keyof typeof form, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function fetchClientProfile(externalId: string) {
    const cid = externalId.trim();
    if (!cid) return;
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/company/payout-client?client_id=${encodeURIComponent(cid)}`, {
        credentials: "include",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        profile?: {
          client_name: string;
          account_holder_name: string;
          bank_name: string;
          bank_account_number: string;
          ifsc_code: string;
        } | null;
      };
      if (!res.ok || !data.ok || !data.profile) return;
      const p = data.profile;
      setForm((prev) => ({
        ...prev,
        client_id: cid,
        client_name: p.client_name || prev.client_name,
        account_holder_name: p.account_holder_name || p.client_name || prev.account_holder_name,
        bank_name: p.bank_name || prev.bank_name,
        bank_account_number: p.bank_account_number || prev.bank_account_number,
        ifsc_code: p.ifsc_code || prev.ifsc_code,
      }));
    } catch {
      /* ignore */
    } finally {
      setProfileLoading(false);
    }
  }

  async function submitRequest() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/company/payouts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: form.client_id.trim(),
          client_name: form.client_name.trim(),
          account_holder_name: form.account_holder_name.trim() || form.client_name.trim(),
          amount: form.amount,
          bank_name: form.bank_name.trim(),
          bank_account_number: form.bank_account_number.trim(),
          ifsc_code: form.ifsc_code.trim(),
          user_note: form.user_note.trim(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not submit payout request");
        return;
      }
      setForm({
        client_id: "",
        client_name: "",
        account_holder_name: "",
        amount: "",
        bank_name: "",
        bank_account_number: "",
        ifsc_code: "",
        user_note: "",
      });
      onClose();
      onSubmitted();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl p-0 overflow-hidden" showCloseButton={false}>
      <div className="rounded-xl bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="text-xl font-semibold text-gray-900">New PayOut Form</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold tracking-wide text-gray-600">
                Client ID <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                placeholder="e.g. customer or wallet ID"
                value={form.client_id}
                onChange={(e) => patchField("client_id", e.target.value)}
                onBlur={() => void fetchClientProfile(form.client_id)}
              />
              {profileLoading && <p className="mt-1 text-[10px] text-gray-400">Loading saved details…</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold tracking-wide text-gray-600">Client Name <span className="text-red-500">*</span></label>
              <input
                className={inputClass}
                placeholder="Full name of the client"
                value={form.client_name}
                onChange={(e) => patchField("client_name", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-wide text-gray-600">Amount <span className="text-red-500">*</span></label>
            <input
              className={inputClass}
              placeholder="Enter amount (₹)"
              value={form.amount}
              onChange={(e) => patchField("amount", e.target.value)}
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3.5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-gray-600">Holder Name <span className="text-red-500">*</span></label>
                <input
                  className={inputClass}
                  placeholder="Account holder name"
                  value={form.account_holder_name}
                  onChange={(e) => patchField("account_holder_name", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-gray-600">Bank Name <span className="text-red-500">*</span></label>
                <input
                  className={inputClass}
                  value={form.bank_name}
                  onChange={(e) => patchField("bank_name", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-gray-600">Account Number <span className="text-red-500">*</span></label>
                <input
                  className={inputClass}
                  value={form.bank_account_number}
                  onChange={(e) => patchField("bank_account_number", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-gray-600">IFSC Code <span className="text-red-500">*</span></label>
                <input
                  className={inputClass}
                  value={form.ifsc_code}
                  onChange={(e) => patchField("ifsc_code", e.target.value)}
                />
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-wide text-gray-600">Remarks</label>
            <input
              className={inputClass}
              placeholder="Optional note"
              value={form.user_note}
              onChange={(e) => patchField("user_note", e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitRequest()}
              className="rounded-md bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function maskAccountTail(accountNo: string): string {
  const t = accountNo.replace(/\s/g, "");
  if (!t) return "";
  return t.length <= 4 ? t : `····${t.slice(-4)}`;
}

function companyPayoutBankSummary(it: CompanyPayoutItem): string {
  const parts: string[] = [];
  const bank = (it.bankName ?? "").trim();
  if (bank) parts.push(bank);
  const tail = maskAccountTail(it.accountNo ?? "");
  if (tail) parts.push(tail);
  const ifsc = (it.ifsc ?? "").trim();
  if (ifsc) parts.push(ifsc);
  return parts.length ? parts.join(" · ") : "—";
}

function CompanyPayOutView() {
  const [activeTab, setActiveTab] = useState<CompanyPayOutTab>("ALL");
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [items, setItems] = useState<CompanyPayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const companyTabs: { label: string; value: CompanyPayOutTab }[] = [
    { label: "All", value: "ALL" },
    { label: "Approved", value: "APPROVED" },
    { label: "Pending", value: "PENDING" },
    { label: "Not_assigned", value: "UNASSIGNED" },
    { label: "Rejected", value: "REJECTED" },
  ];

  const loadCompanyPayouts = useCallback(
    async (tabOverride?: CompanyPayOutTab) => {
      const tab = tabOverride ?? activeTab;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/company/payouts`, { credentials: "include" });
        const data = (await res.json()) as { ok?: boolean; payouts?: CompanyPayoutItem[]; error?: string };
        if (!res.ok || !data.ok || !data.payouts) {
          setError(data.error ?? "Could not load payouts");
          setItems([]);
          return;
        }
        setItems(data.payouts);
      } catch {
        setError("Network error");
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [activeTab],
  );

  useEffect(() => {
    void loadCompanyPayouts();
  }, [loadCompanyPayouts]);

  useTransactionRealtimeRefresh({ types: ["PAYOUT"], onRefresh: () => void loadCompanyPayouts() });

  const counts = useMemo(() => {
    return {
      ALL: items.length,
      APPROVED: items.filter((d) => d.status.includes("APPROVED")).length,
      PENDING: items.filter((d) => d.status === "PENDING" || d.status === "CREATED").length,
      UNASSIGNED: items.filter((d) => d.status === "UNASSIGNED").length,
      REJECTED: items.filter((d) => d.status === "REJECTED" || d.status === "DECLINED" || d.status === "REVOKED").length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (activeTab === "ALL") return items;
    if (activeTab === "APPROVED") return items.filter((d) => d.status.includes("APPROVED"));
    if (activeTab === "REJECTED") return items.filter((d) => d.status === "REJECTED" || d.status === "DECLINED" || d.status === "REVOKED");
    if (activeTab === "PENDING") return items.filter((d) => d.status === "PENDING" || d.status === "CREATED");
    return items.filter((d) => d.status === activeTab);
  }, [items, activeTab]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white">
          <PayOutIcon />
          <h1 className="text-xl font-bold">PayOut Management</h1>
        </div>
        <button
          onClick={() => setIsRequestOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Request
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-white/3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {companyTabs.map((tab) => {
              const count = counts[tab.value as keyof typeof counts];
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${isActive
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                    : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                >
                  {tab.label}
                  {count !== undefined && count > 0 && !isActive && (
                    <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full bg-gray-100 dark:bg-gray-700 px-1.5 text-[10px] font-bold text-gray-600 dark:text-gray-300">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18l-7 8v6l-4-2v-4L3 4z" />
            </svg>
            Filters
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {loading && <div className="rounded-xl border border-gray-100 px-3 py-5 text-sm text-gray-500">Loading payouts...</div>}
          {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">{error}</div>}
          {!loading && !error && filteredItems.length === 0 && (
            <div className="flex h-[180px] items-start justify-center rounded-xl border border-gray-100 pt-10 text-sm text-gray-400 dark:border-gray-800 dark:text-gray-500">
              No PAYOUT requests found in this tab.
            </div>
          )}
          {!loading &&
            !error &&
            paginatedItems.map((it) => (
              <CompanyTxnAccordionCard
                key={it.id}
                variant="PAYOUT"
                transactionId={it.id}
                orderId={it.orderId}
                amount={it.amount}
                status={it.status}
                clientName={it.clientName}
                clientUpi={it.clientUpi}
                bankSummary={companyPayoutBankSummary(it)}
                utrCode={it.utrCode ?? ""}
                assignedUpi={it.assignedUpi ?? ""}
                createdAtIso={it.createdAtIso}
                assignedAtIso={it.assignedAtIso}
                assignedToLabel={it.assignedToLabel ?? "—"}
                remarks={it.remarks ?? ""}
                expiresAtIso={it.expiresAtIso}
              />
            ))}
        </div>
        {filteredItems.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-3 mt-2 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-400 shrink-0">
              Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filteredItems.length)} of {filteredItems.length} entries
            </p>
            <Pagination
              total={filteredItems.length}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <CompanyPayOutRequestModal
        isOpen={isRequestOpen}
        onClose={() => setIsRequestOpen(false)}
        onSubmitted={() => {
          setActiveTab("ALL");
          void loadCompanyPayouts("ALL");
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("tepay:company-dashboard-refresh"));
          }
        }}
      />
    </div>
  );
}

export default function PayOutList() {
  const [panelRole, setPanelRole] = useState<"admin" | "agent" | "company">("admin");
  useEffect(() => {
    const role = localStorage.getItem("tepay_role");
    if (role === "agent" || role === "company") {
      setPanelRole(role);
    }
  }, []);

  const [items, setItems] = useState<PayOutItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PayOutItem | null>(null);
  const [modalAction, setModalAction] = useState<ActionType>("approve");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalProofDataUrl, setModalProofDataUrl] = useState<string | null>(null);
  const [modalProofName, setModalProofName] = useState("");
  const { user, loading: authLoading } = useAuth();
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const resolvedRole = (authLoading ? null : user?.role) || panelRole;
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [activeTab, setActiveTab] = useState<PayOutStatus | "ALL">("ALL");
  const [showFilter, setShowFilter] = useState(false);
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [page, setPage] = useState(1);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [payoutAgentApproveDelayMins, setPayoutAgentApproveDelayMins] = useState(10);

  const loadPayOuts = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    const endpoint =
      resolvedRole === "admin"
        ? "/api/admin/transactions?type=PAYOUT"
        : "/api/agent/transactions?type=PAYOUT";
    try {
      const res = await fetch(endpoint, { credentials: "include" });
      if (res.status === 401) {
        setItems([]);
        setListError("Please sign in to view PayOuts.");
        return;
      }
      const data = (await res.json()) as {
        ok?: boolean;
        items?: PayOutItem[];
        error?: string;
        payoutAgentApproveDelayMinutes?: number;
      };
      if (!res.ok || !data.ok || !data.items) {
        setItems([]);
        setListError(data.error ?? "Could not load transactions.");
        return;
      }
      setListError(null);
      setItems(data.items);
      if (resolvedRole === "agent" && typeof data.payoutAgentApproveDelayMinutes === "number") {
        setPayoutAgentApproveDelayMins(data.payoutAgentApproveDelayMinutes);
      }
    } catch {
      setItems([]);
      setListError("Network error.");
    } finally {
      setListLoading(false);
    }
  }, [resolvedRole]);

  useEffect(() => {
    if (authLoading) return;
    if (resolvedRole === "company") return;
    void loadPayOuts();
  }, [resolvedRole, loadPayOuts, authLoading]);

  useTransactionRealtimeRefresh({
    types: ["PAYOUT"],
    onRefresh: () => {
      if (resolvedRole !== "company") void loadPayOuts();
    },
  });

  useEffect(() => {
    if (resolvedRole !== "admin") return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/agents", { credentials: "include" });
        const data = (await res.json()) as {
          ok?: boolean;
          agents?: Array<{
            id: string;
            fullname?: string | null;
            username: string;
            status?: string;
            previous_balance?: number;
            net_pay_in?: number;
            net_pay_out?: number;
            running_balance?: number;
          }>;
        };
        if (!mounted || !res.ok || !data.ok || !data.agents) return;
        setAgents(
          data.agents
            .filter((a) => String(a.status ?? "").trim().toLowerCase() === "active")
            .map((a) => {
              const name = (a.fullname && a.fullname.trim()) || a.username;
              const prev = typeof a.previous_balance === "number" ? a.previous_balance : Number(a.previous_balance ?? 0);
              const nIn = typeof a.net_pay_in === "number" ? a.net_pay_in : Number(a.net_pay_in ?? 0);
              const nOut = typeof a.net_pay_out === "number" ? a.net_pay_out : Number(a.net_pay_out ?? 0);
              const dbRun = typeof a.running_balance === "number" ? a.running_balance : Number(a.running_balance ?? 0);
              const computed =
                (Number.isFinite(prev) ? prev : 0) +
                (Number.isFinite(nIn) ? nIn : 0) -
                (Number.isFinite(nOut) ? nOut : 0);
              const run = Number.isFinite(computed) ? computed : dbRun;
              const runLabel = Number.isFinite(run)
                ? ` · Running ₹${run.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                : "";
              return {
                id: a.id,
                label: `${name}${runLabel}`,
              };
            }),
        );
      } catch {
        // keep empty agent list; assignment modal shows validation
      }
    })();
    return () => {
      mounted = false;
    };
  }, [resolvedRole]);

  const raiseDispute = useCallback(
    async (item: PayOutItem) => {
      if (resolvedRole !== "admin") return;
      const reason = window.prompt("Dispute reason?", "Other");
      if (reason === null) return;
      try {
        const res = await fetch(`/api/admin/transactions/${item.id}/dispute`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() || "Other" }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          window.alert(data.error ?? "Could not raise dispute.");
          return;
        }
        await loadPayOuts();
        window.alert("Dispute raised. Request moved to Disputes — approve/reject blocked until resolved.");
      } catch {
        window.alert("Network error.");
      }
    },
    [resolvedRole, loadPayOuts],
  );

  function closeActionModal() {
    setModalOpen(false);
    setModalError(null);
    setModalProofDataUrl(null);
    setModalProofName("");
  }

  function handleModalProofFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) {
      setModalProofDataUrl(null);
      setModalProofName("");
      return;
    }
    if (f.size > MAX_PROOF_BYTES) {
      setModalError("Proof file must be 5 MB or smaller.");
      return;
    }
    setModalError(null);
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        const r = reader.result;
        if (typeof r === "string") {
          const out = await compressImageDataUrlIfLarge(r);
          setModalProofDataUrl(out);
          setModalProofName(f.name);
        }
      })();
    };
    reader.readAsDataURL(f);
  }

  const baseData = items;
  const dateFilteredBaseData = baseData.filter((d) => {
    if (!dateRange?.from || !dateRange?.to) return true;
    if (!d.createdAtIso) return false;
    const createdAt = new Date(d.createdAtIso);
    if (Number.isNaN(createdAt.getTime())) return false;
    const createdDate = toInputDate(createdAt);
    const fromDate = toInputDate(dateRange.from);
    const toDate = toInputDate(dateRange.to);
    return createdDate >= fromDate && createdDate <= toDate;
  });
  const totalOrders = dateFilteredBaseData.length;

  const counts: Partial<Record<PayOutStatus | "ALL", number>> = {
    ALL: dateFilteredBaseData.length,
    CREATED: dateFilteredBaseData.filter((d) => d.status === "CREATED").length,
    UNASSIGNED: dateFilteredBaseData.filter((d) => d.status === "UNASSIGNED").length,
    PENDING: dateFilteredBaseData.filter((d) => d.status === "PENDING").length,
    ASSIGNED: dateFilteredBaseData.filter((d) => d.status === "ASSIGNED").length,
    PROCESSING: dateFilteredBaseData.filter((d) => d.status === "PROCESSING").length,
    EXPIRED: dateFilteredBaseData.filter((d) => d.status === "EXPIRED").length,
    APPROVED: dateFilteredBaseData.filter((d) => d.status === "APPROVED").length,
    DECLINED: dateFilteredBaseData.filter((d) => d.status === "DECLINED").length,
    EXPIRED_APPROVED_BY_ADMIN: dateFilteredBaseData.filter((d) => d.status === "EXPIRED_APPROVED_BY_ADMIN").length,
    EXPIRED_APPROVED_BY_AGENT: dateFilteredBaseData.filter((d) => d.status === "EXPIRED_APPROVED_BY_AGENT").length,
  };

  const statusTabsVisible =
    resolvedRole === "admin" ? STATUS_TABS : STATUS_TABS.filter((t) => t.value !== "ASSIGNED");

  const filtered = dateFilteredBaseData.filter((d) => {
    if (activeTab !== "ALL" && d.status !== activeTab) return false;
    if (search &&
      !d.orderId.toLowerCase().includes(search.toLowerCase()) &&
      !d.clientName.toLowerCase().includes(search.toLowerCase()) &&
      !d.clientUpi.toLowerCase().includes(search.toLowerCase()) &&
      !d.bankName.toLowerCase().includes(search.toLowerCase()) &&
      !d.accountNo.includes(search)) return false;
    if (amount && d.amount !== Number(amount)) return false;
    if (filterStatus !== "All" && d.status !== filterStatus) return false;
    if (dateRange?.from && dateRange?.to) {
      if (!d.createdAtIso) return false;
      const createdAt = new Date(d.createdAtIso);
      if (Number.isNaN(createdAt.getTime())) return false;
      const createdDate = toInputDate(createdAt);
      const fromDate = toInputDate(dateRange.from);
      const toDate = toInputDate(dateRange.to);
      if (createdDate < fromDate || createdDate > toDate) return false;
    }
    return true;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportPayOutsCsv = useCallback(() => {
    const headers = [
      "id",
      "ref",
      "order_id",
      "status",
      "amount",
      "client_name",
      "client_upi",
      "bank_name",
      "account_no",
      "ifsc",
      "created_on",
      "created_at_iso",
      "assigned_to",
      "assigned_on",
      "assigned_agent_id",
      "remarks",
      "expires_at_iso",
      "assigned_at_iso",
      "dispute_raised",
      "has_receipt",
    ];
    const rows = filtered.map((d) => [
      d.id,
      d.ref,
      d.orderId,
      d.status,
      d.amount,
      d.clientName,
      d.clientUpi,
      d.bankName,
      d.accountNo,
      d.ifsc,
      d.createdOn,
      d.createdAtIso ?? "",
      d.assignedTo ?? "",
      d.assignedOn ?? "",
      d.assignedAgentId ?? "",
      d.remarks ?? "",
      d.expiresAtIso ?? "",
      d.assignedAtIso ?? "",
      d.disputeRaised ? "yes" : "no",
      d.hasReceipt ? "yes" : "no",
    ]);
    downloadCsv(`payouts-${csvExportTimestamp()}.csv`, [headers, ...rows]);
  }, [filtered]);

  function openActionModal(item: PayOutItem, action: ActionType) {
    setSelectedItem(item);
    setModalAction(action);
    setModalError(null);
    setModalProofDataUrl(null);
    setModalProofName("");
    setSelectedAgentId("");
    setModalOpen(true);
  }

  async function runAction(item: PayOutItem, action: ActionType, opts?: { paymentImage?: string | null }) {
    setActionBusyId(item.id);
    setModalError(null);
    try {
      if (action === "approve" && !canOpenApproveModal(resolvedRole === "agent" ? "agent" : "admin", item)) {
        setModalError("Approve only after assignment/processing stage.");
        return;
      }
      if (
        action === "approve" &&
        resolvedRole === "agent" &&
        item.status === "PENDING" &&
        !isAgentPayoutApproveUnlocked(item, payoutAgentApproveDelayMins)
      ) {
        setModalError("Assignment cooling period: approve is not available yet.");
        return;
      }
      let res: Response;
      if (action === "assign") {
        if (resolvedRole !== "admin") {
          setModalError("Only admin can assign payout.");
          return;
        }
        if (!selectedAgentId) {
          setModalError("Please select an agent.");
          return;
        }
        res = await fetch(`/api/admin/payouts/${item.id}/assign`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: Number(selectedAgentId) }),
        });
      } else {
        let normalizedProof = (opts?.paymentImage ?? "").trim();
        if (normalizedProof.startsWith("data:image/")) {
          normalizedProof = (await compressImageDataUrlIfLarge(normalizedProof)).trim();
        }
        if (action === "approve" && !item.hasReceipt && !normalizedProof) {
          setModalError("Upload payment proof (screenshot) before approving.");
          return;
        }
        const status =
          action === "approve"
            ? resolvedRole === "admin"
              ? "APPROVED_BY_ADMIN"
              : "APPROVED_BY_AGENT"
            : action === "reject"
              ? "REJECTED"
              : resolvedRole === "admin"
                ? "RE_ASSIGNED"
                : "REVOKED";
        const endpoint =
          resolvedRole === "admin" ? `/api/admin/payouts/${item.id}/status` : `/api/agent/payouts/${item.id}/status`;
        const body: Record<string, string> = { status };
        if (normalizedProof) body.payment_image = normalizedProof;
        res = await fetch(endpoint, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setModalError(data.error ?? "Could not update payout status");
        return;
      }
      closeActionModal();
      setSelectedItem(null);
      await loadPayOuts();
    } catch {
      setModalError("Network error");
    } finally {
      setActionBusyId(null);
    }
  }

  if (resolvedRole === "company") {
    return <CompanyPayOutView />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white">
          <PayOutIcon />
          <h1 className="text-xl font-bold">Pay Out</h1>
        </div>
        {!listLoading && !listError && (
          <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
            {resolvedRole === "admin"
              ? "Live: all PayOut requests for admin actions (max 500)."
              : "Live: payout transactions assigned to your agent account (max 500)."}
          </p>
        )}
      </div>

      {listLoading && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {resolvedRole === "admin" ? "Loading admin payouts…" : "Checking agent session…"}
        </div>
      )}
      {listError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
          {listError}
        </div>
      )}

      {showFilter && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/3 overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white leading-tight">Advanced Search</p>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                  </svg>
                  {totalOrders.toLocaleString()} Orders found
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportPayOutsCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </button>
              <button
                onClick={() => setShowFilter(false)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search & Filter inputs */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Search & Filter</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">Search</label>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, UPI, order ID..."
                  className="w-full rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">Amount</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors appearance-none cursor-pointer">
                  {STATUS_FILTER_OPTIONS.filter((s) => resolvedRole === "admin" || s !== "ASSIGNED").map((s) => (
                    <option key={s} value={s}>
                      {s === "All" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Client Name, UPI, Order ID, Account No, Bank Name
            </p>
          </div>

          {/* Date Range */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Date Range</span>
            </div>
            <DateRangePicker
              value={dateRange}
              onChange={(r) => {
                setDateRange(r);
                setPage(1);
              }}
              fullWidth
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end px-5 pb-4">
            <button onClick={() => setShowFilter(false)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              Hide Filters
            </button>
          </div>
        </div>
      )}

      {/* Tab bar + filter toggle */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {statusTabsVisible.map((tab) => {
            const count = counts[tab.value as PayOutStatus];
            const isActive = activeTab === tab.value;
            return (
              <button key={tab.value} onClick={() => { setActiveTab(tab.value); setPage(1); }}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${isActive
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
              >
                {tab.label}
                {count !== undefined && count > 0 && !isActive && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button onClick={() => setShowFilter((v) => !v)}
          className={`flex items-center justify-center w-9 h-9 rounded-full transition-colors ${showFilter
            ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/3 px-6 py-12 text-center text-gray-400">
            No transactions found.
          </div>
        ) : (
          paginated.map((item) => (
            <PayOutCard
              key={item.id}
              item={item}
              busy={actionBusyId === item.id}
              onOpenAction={openActionModal}
              onOpenProof={(url) => setProofPreviewUrl(url)}
              //onView={resolvedRole === "admin" ? () => (window.location.href = `/transactions/${item.id}`) : undefined}
              allowAssign={resolvedRole === "admin"}
              isAdmin={resolvedRole === "admin"}
              isAgent={resolvedRole === "agent"}
              onDispute={raiseDispute}
              agentApproveDelayMinutes={resolvedRole === "agent" ? payoutAgentApproveDelayMins : undefined}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      <Pagination
        total={filtered.length}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeActionModal}
        className="max-w-xl p-0 overflow-hidden"
        showCloseButton={false}
      >
        <div className="rounded-xl bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {modalAction === "assign" && "Assign PayOut"}
              {modalAction === "approve" && "Approve PayOut"}
              {modalAction === "reject" && "Reject PayOut"}
              {modalAction === "cancel" && "Revoke assignment"}
            </h3>
            <button
              type="button"
              onClick={closeActionModal}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              x
            </button>
          </div>
          <div className="space-y-4 px-5 py-4">
            {selectedItem && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {selectedItem.orderId} · {selectedItem.clientName} · ₹{selectedItem.amount.toLocaleString("en-IN")}
              </p>
            )}
            {modalAction === "assign" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Assign to agent
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  <option value="">Select agent</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {modalAction === "approve" && (
              <div className="space-y-3">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Payment proof (screenshot) {!selectedItem?.hasReceipt && <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleModalProofFile}
                      className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                    />
                    <div className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-6 py-6 text-center transition-all group-hover:bg-gray-50 dark:border-gray-700/75 dark:bg-gray-800/30 dark:group-hover:bg-gray-800/60">
                      {modalProofDataUrl ? (
                        <div className="flex flex-col items-center gap-3">
                          <img src={modalProofDataUrl} alt="Preview" className="h-24 w-auto rounded object-contain shadow-sm ring-1 ring-gray-900/10 dark:ring-white/10" />
                          <span className="text-xs font-medium text-brand-500 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-2 py-1 rounded">Change image</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
                          <div className="rounded-full bg-white p-3 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10 mb-1">
                            <svg className="h-6 w-6 text-brand-500 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                          </div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                            Click to upload <span className="font-normal text-gray-500 dark:text-gray-400">or drag and drop</span>
                          </p>
                          <p className="text-[11px]">SVG, PNG, JPG or GIF (max. 5MB)</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {selectedItem?.hasReceipt && !modalProofDataUrl && (
                  <div className="flex items-center gap-2 rounded-lg bg-blue-50/80 px-3 py-2.5 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                    <svg className="h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    A proof is already on file. Upload a new file to replace it.
                  </div>
                )}
              </div>
            )}
            {modalAction === "reject" && (
              <p className="text-sm text-gray-600 dark:text-gray-300">Reject this PayOut request?</p>
            )}
            {modalAction === "cancel" && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Revoke returns this payout to a state where it can be reassigned. Close only dismisses this dialog.
              </p>
            )}
            {modalError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
                {modalError}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeActionModal}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
              {modalAction === "assign" && (
                <AssignButton
                  onClick={() => selectedItem && void runAction(selectedItem, "assign")}
                  disabled={!selectedItem || actionBusyId === selectedItem?.id}
                />
              )}
              {modalAction === "approve" && (
                <ApproveButton
                  onClick={() =>
                    selectedItem && void runAction(selectedItem, "approve", { paymentImage: modalProofDataUrl })
                  }
                  disabled={!selectedItem || actionBusyId === selectedItem?.id}
                />
              )}
              {modalAction === "reject" && (
                <RejectButton
                  onClick={() => selectedItem && void runAction(selectedItem, "reject")}
                  disabled={!selectedItem || actionBusyId === selectedItem?.id}
                />
              )}
              {modalAction === "cancel" && (
                <button
                  type="button"
                  disabled={!selectedItem || actionBusyId === selectedItem?.id}
                  onClick={() => selectedItem && void runAction(selectedItem, "cancel")}
                  className="rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Revoke assignment
                </button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={proofPreviewUrl != null}
        onClose={() => setProofPreviewUrl(null)}
        className="max-w-3xl p-0 overflow-hidden"
        showCloseButton={false}
      >
        <div className="rounded-xl bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Payment proof</h3>
            <button
              type="button"
              onClick={() => setProofPreviewUrl(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              ×
            </button>
          </div>
          <div className="max-h-[80vh] overflow-auto p-4">
            {proofPreviewUrl &&
              (proofIsPdf(proofPreviewUrl) ? (
                <iframe title="Payment proof PDF" src={proofPreviewUrl} className="h-[70vh] w-full rounded-md border border-gray-200 dark:border-gray-700" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={proofPreviewUrl} alt="Payment proof" className="mx-auto max-h-[75vh] w-auto max-w-full object-contain" />
              ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
