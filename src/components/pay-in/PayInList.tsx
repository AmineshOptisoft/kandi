"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { AgentPayInListItem } from "@/lib/agent-transactions-map";
import DateRangePicker, { DateRange } from "../dashboard/DateRangePicker";
import Pagination from "../ui/Pagination";
import { Modal } from "../ui/modal";
import PendingExpireCountdown from "../ui/PendingExpireCountdown";
import { compressImageDataUrlIfLarge } from "@/lib/compress-image-data-url";
import { csvExportTimestamp, downloadCsv } from "@/lib/csv-download";
import { PayInIcon } from "@/icons/nav-icons";
import CompanyPayInView from "./CompanyPayInView";
import { useTransactionRealtimeRefresh } from "@/hooks/useTransactionRealtimeRefresh";
import { useAuth } from "@/context/AuthContext";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { toInputDate } from "@/lib/date-range";

const PAGE_SIZE = 10;

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const UTR_12_DIGIT_REGEX = /^\d{12,22}$/; // IMPS=12, UPI=12, NEFT RRN=16, RTGS=22;

type PayInStatus = "PENDING" | "APPROVED" | "EXPIRED" | "RECEIPT_PENDING" | "UNASSIGNED" | "PROCESSING" | "EXPIRED_APPROVED_BY_ADMIN" | "EXPIRED_APPROVED_BY_AGENT" | "DECLINED";

type PayInItem = AgentPayInListItem;

const STATUS_TABS: { label: string; value: PayInStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Declined", value: "DECLINED" },
  { label: "Reciept Pending", value: "RECEIPT_PENDING" },
  { label: "Unassigned", value: "UNASSIGNED" },
  { label: "Exp. Approved (Admin)", value: "EXPIRED_APPROVED_BY_ADMIN" },
  { label: "Exp. Approved (Agent)", value: "EXPIRED_APPROVED_BY_AGENT" },
];

const statusStyle: Record<PayInStatus, string> = {
  PENDING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  EXPIRED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  RECEIPT_PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  UNASSIGNED: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  PROCESSING: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  DECLINED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  EXPIRED_APPROVED_BY_ADMIN: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  EXPIRED_APPROVED_BY_AGENT: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
};

const isActionableExpired = (item: PayInItem) =>
  item.status === "EXPIRED" && item.rawStatus !== "REJECTED" && item.rawStatus !== "REVOKED";
const showApprove = (item: PayInItem) =>
  (item.status === "PENDING" || item.status === "PROCESSING" || isActionableExpired(item)) && !!item.assignedAgentId;
const showReject = (item: PayInItem) => (item.status === "PENDING" || item.status === "PROCESSING" || item.status === "RECEIPT_PENDING" || item.status === "EXPIRED") && !!item.assignedAgentId;
/** Revoke / unassign — not offered for receipt-pending (reject only there). */
const showCancel = (item: PayInItem) => (item.status === "PENDING" || item.status === "PROCESSING" || item.status === "EXPIRED") && !!item.assignedAgentId;
const showActionButtons = (item: PayInItem) => showApprove(item) || showReject(item) || showCancel(item);

function showPayInExpireCountdown(item: PayInItem): boolean {
  if (!item.expiresAtIso) return false;
  return (
    item.status === "PENDING" ||
    item.status === "UNASSIGNED" ||
    item.status === "RECEIPT_PENDING" ||
    item.status === "PROCESSING"
  );
}

function MoneyIcon() {
  return (
    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    <svg className="inline w-3.5 h-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

function ApproveButton({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-full bg-gray-900 dark:bg-white px-4 py-2 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors shadow-sm whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
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
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
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
      className="p-2 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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

function hasBankDetails(item: PayInItem): boolean {
  return Boolean(
    item.bankName &&
    item.bankName !== "—" &&
    item.accountNo &&
    item.accountNo !== "—" &&
    item.ifsc &&
    item.ifsc !== "—",
  );
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

function PayInCard({
  item,
  onOpenAction,
  onView,
  onOpenProof,
  busy,
  isAdmin,
  onDispute,
  canApprove,
  canDecline,
  canDispute,
}: {
  item: PayInItem;
  onOpenAction: (item: PayInItem, initialAction: "approve" | "reject" | "cancel") => void;
  onView?: () => void;
  onOpenProof?: (proofUrl: string) => void;
  busy?: boolean;
  isAdmin?: boolean;
  onDispute?: (item: PayInItem) => void;
  canApprove?: boolean;
  canDecline?: boolean;
  canDispute?: boolean;
}) {
  // Desktop: chevron toggles extra details (Total Amount, Discount, etc.)
  // Mobile: chevron toggles all details
  const [extraOpen, setExtraOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const headerRow = (
    <div className="flex items-center gap-3 px-5 py-3.5">
      {/* ref + amount + status */}
      <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
        <span className="text-xs font-mono font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{item.ref}</span>
        <MoneyIcon />
        <span className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">
          {item.amount.toLocaleString("en-IN")} INR
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${statusStyle[item.status]}`}>
          {item.status.replace("_", " ")}
        </span>
        {showPayInExpireCountdown(item) ? <PendingExpireCountdown expiresAtIso={item.expiresAtIso!} /> : null}
      </div>

      {/* right-side action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {!item.disputeRaised && showApprove(item) && (canApprove !== false) && (
          <ApproveButton onClick={() => onOpenAction(item, "approve")} disabled={busy} />
        )}
        {!item.disputeRaised && showReject(item) && showCancel(item) && (canDecline !== false) ? (
          <DeclineMenu
            disabled={busy}
            onReject={() => onOpenAction(item, "reject")}
            onRevoke={() => onOpenAction(item, "cancel")}
          />
        ) : !item.disputeRaised && showReject(item) && (canDecline !== false) ? (
          <RejectButton onClick={() => onOpenAction(item, "reject")} disabled={busy} />
        ) : !item.disputeRaised && showCancel(item) && (canDecline !== false) ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onOpenAction(item, "cancel")}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Revoke
          </button>
        ) : null}
        {isAdmin && onDispute && !item.disputeRaised && showActionButtons(item) && canDispute && (
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
        {/* Mobile chevron — toggles all details */}
        <span className="lg:hidden">
          <ChevronBtn rotated={mobileOpen} onClick={() => setMobileOpen((v) => !v)} />
        </span>
        {/* Desktop chevron — toggles extra details */}
        <span className="hidden lg:inline-flex">
          <ChevronBtn rotated={extraOpen} onClick={() => setExtraOpen((v) => !v)} />
        </span>
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] overflow-hidden">
      {/* ── Header ── */}
      {headerRow}

      {/* ── DESKTOP: always-visible primary detail rows ── */}
      <div className="hidden lg:block border-t border-gray-100 dark:border-gray-800 px-5 py-4">
        {/* Row 1: ORDER ID · CLIENT NAME · CLIENT UPI */}
        <div className="grid grid-cols-3 gap-x-8 gap-y-1 mb-4">
          <DetailField label="Order ID" value={item.orderId} />
          <DetailField label="Client Name" value={item.clientName} />
          <DetailField label="Client UPI" value={item.clientUpi} />
        </div>

        {/* Row 2: UTR (if any) · ASSIGNED UPI · CREATED ON + Approve at far right */}
        <div className="flex items-end gap-8">
          {item.utrCode && (
            <div className="shrink-0">
              <DetailField label="UTR Code" value={item.utrCode} />
            </div>
          )}
          {hasBankDetails(item) ? (
            <>
              <div className="shrink-0">
                <DetailField label="Bank Name" value={item.bankName!} />
              </div>
              <div className="shrink-0">
                <DetailField label="Account No" value={item.accountNo!} />
              </div>
              <div className="shrink-0">
                <DetailField label="IFSC" value={item.ifsc!} />
              </div>
            </>
          ) : (
            <div className="shrink-0">
              <DetailField label="Assigned UPI" value={item.assignedUpi} isLink={item.assignedUpi !== "—"} />
            </div>
          )}
          <div className="shrink-0">
            <DetailField label="Created On" value={item.createdOn} />
          </div>
          <div className="ml-auto shrink-0" />
        </div>

        {/* Extra rows (toggled by chevron) */}
        {extraOpen && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="grid grid-cols-3 gap-x-8 gap-y-4 mb-4">
              <DetailField label="Total Amount" value={`${item.totalAmount} INR`} />
              <DetailField label="Discount Amount" value={`${item.discountAmount} INR`} />
              <DetailField label="Assigned To" value={item.assignedTo} />
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailField label="Assigned On" value={item.assignedOn} />
              <DetailField label="Remarks" value={item.remarks} />
            </div>
          </div>
        )}
      </div>

      {/* ── MOBILE: accordion detail panel ── */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-100 dark:border-gray-800 px-4 py-4">
          <div className="grid grid-cols-1 gap-4 mb-4">
            <DetailField label="Order ID" value={item.orderId} />
            <DetailField label="Client Name" value={item.clientName} />
            <DetailField label="Client UPI" value={item.clientUpi} />
          </div>
          {item.utrCode && (
            <div className="mb-4">
              <DetailField label="UTR Code" value={item.utrCode} />
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 mb-4">
            {hasBankDetails(item) ? (
              <>
                <DetailField label="Bank Name" value={item.bankName!} />
                <DetailField label="Account No" value={item.accountNo!} />
                <DetailField label="IFSC" value={item.ifsc!} />
              </>
            ) : (
              <DetailField label="Assigned UPI" value={item.assignedUpi} isLink={item.assignedUpi !== "—"} />
            )}
            <DetailField label="Created On" value={item.createdOn} />
            <DetailField label="Total Amount" value={`${item.totalAmount} INR`} />
            <DetailField label="Discount Amount" value={`${item.discountAmount} INR`} />
            <DetailField label="Assigned To" value={item.assignedTo} />
            <DetailField label="Assigned On" value={item.assignedOn} />
            <DetailField label="Remarks" value={item.remarks} />
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_FILTER_OPTIONS = ["All", "PENDING", "APPROVED", "EXPIRED", "RECEIPT_PENDING", "UNASSIGNED", "PROCESSING",'DECLINED' ,"EXPIRED_APPROVED_BY_ADMIN", "EXPIRED_APPROVED_BY_AGENT"];

type ActionType = "approve" | "reject" | "cancel";

export default function PayInList() {
  const { user, loading: authLoading } = useAuth();
  const { can, loading: permLoading } = useAdminPermissions();
  const [panelRole, setPanelRole] = useState<"admin" | "agent" | "company">("admin");
  useEffect(() => {
    const role = localStorage.getItem("tepay_role");
    if (role === "agent" || role === "company") {
      setPanelRole(role);
    }
  }, []);
  const resolvedRole = (authLoading ? null : user?.role) || panelRole;

  const [activeTab, setActiveTab] = useState<PayInStatus | "ALL">("ALL");
  const [showFilter, setShowFilter] = useState(false);

  const [items, setItems] = useState<PayInItem[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PayInItem | null>(null);
  const [modalAction, setModalAction] = useState<ActionType>("approve");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUtr, setModalUtr] = useState("");
  const [modalProofDataUrl, setModalProofDataUrl] = useState<string | null>(null);
  const [modalProofName, setModalProofName] = useState("");
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [page, setPage] = useState(1);

  const loadPayIns = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    const endpoint =
      resolvedRole === "admin"
        ? `/api/admin/transactions?type=PAYIN`
        : `/api/agent/transactions?type=PAYIN`;
    try {
      const res = await fetch(endpoint, { credentials: "include" });
      if (res.status === 401) {
        setItems([]);
        setListError("Please sign in to view PayIns.");
        return;
      }
      const data = (await res.json()) as { ok?: boolean; items?: PayInItem[]; error?: string };
      if (!res.ok || !data.ok || !data.items) {
        setItems([]);
        setTotalOrders(0);
        setListError(data.error ?? "Could not load transactions.");
        return;
      }
      setListError(null);
      setItems(data.items);
      setTotalOrders((data as any).total ?? data.items.length);
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
    void loadPayIns();
  }, [resolvedRole, loadPayIns, authLoading]);

  useTransactionRealtimeRefresh({
    types: ["PAYIN"],
    onRefresh: () => {
      if (resolvedRole !== "company") void loadPayIns();
    },
  });

  const raiseDispute = useCallback(
    async (item: PayInItem) => {
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
        await loadPayIns();
        window.alert("Dispute raised. Request moved to Disputes — approve/reject blocked until resolved.");
      } catch {
        window.alert("Network error.");
      }
    },
    [resolvedRole, loadPayIns],
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

  const counts: Partial<Record<PayInStatus | "ALL", number>> = {
    ALL: dateFilteredBaseData.length,
    PENDING: dateFilteredBaseData.filter((d) => d.status === "PENDING").length,
    APPROVED: dateFilteredBaseData.filter((d) => d.status === "APPROVED").length,
    EXPIRED: dateFilteredBaseData.filter((d) => d.status === "EXPIRED").length,
    DECLINED: dateFilteredBaseData.filter((d) => d.status === "DECLINED").length,
    RECEIPT_PENDING: dateFilteredBaseData.filter((d) => d.status === "RECEIPT_PENDING").length,
    UNASSIGNED: dateFilteredBaseData.filter((d) => d.status === "UNASSIGNED").length,
    PROCESSING: dateFilteredBaseData.filter((d) => d.status === "PROCESSING").length,
    EXPIRED_APPROVED_BY_ADMIN: dateFilteredBaseData.filter((d) => d.status === "EXPIRED_APPROVED_BY_ADMIN").length,
    EXPIRED_APPROVED_BY_AGENT: dateFilteredBaseData.filter((d) => d.status === "EXPIRED_APPROVED_BY_AGENT").length,
  };

  const filtered = dateFilteredBaseData.filter((d) => {
    if (activeTab !== "ALL" && d.status !== activeTab) return false;
    if (search && !d.orderId.toLowerCase().includes(search.toLowerCase()) &&
      !d.clientName.toLowerCase().includes(search.toLowerCase()) &&
      !d.assignedUpi.toLowerCase().includes(search.toLowerCase()) &&
      !(d.bankName ?? "").toLowerCase().includes(search.toLowerCase()) &&
      !(d.accountNo ?? "").toLowerCase().includes(search.toLowerCase()) &&
      !(d.ifsc ?? "").toLowerCase().includes(search.toLowerCase()) &&
      !(d.utrCode ?? "").includes(search)) return false;
    if (amount && d.amount !== Number(amount)) return false;
    if (filterStatus !== "All" && d.status !== filterStatus) return false;
    return true;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportPayInsCsv = useCallback(() => {
    const headers = [
      "id",
      "ref",
      "order_id",
      "status",
      "amount",
      "total_amount",
      "discount_amount",
      "client_name",
      "client_upi",
      "assigned_upi",
      "bank_name",
      "account_no",
      "ifsc",
      "utr",
      "created_on",
      "created_at_iso",
      "expires_at_iso",
      "assigned_to",
      "assigned_on",
      "remarks",
      "dispute_raised",
      "has_receipt",
    ];
    const rows = filtered.map((d) => [
      d.id,
      d.ref,
      d.orderId,
      d.status,
      d.amount,
      d.totalAmount,
      d.discountAmount,
      d.clientName,
      d.clientUpi,
      d.assignedUpi,
      d.bankName ?? "",
      d.accountNo ?? "",
      d.ifsc ?? "",
      d.utrCode ?? "",
      d.createdOn,
      d.createdAtIso ?? "",
      d.expiresAtIso ?? "",
      d.assignedTo,
      d.assignedOn,
      d.remarks,
      d.disputeRaised ? "yes" : "no",
      d.hasReceipt ? "yes" : "no",
    ]);
    downloadCsv(`payins-${csvExportTimestamp()}.csv`, [headers, ...rows]);
  }, [filtered]);

  function openActionModal(item: PayInItem, action: ActionType) {
    setSelectedItem(item);
    setModalAction(action);
    setModalUtr(item.utrCode ?? "");
    setModalProofDataUrl(null);
    setModalProofName("");
    setModalError(null);
    setModalOpen(true);
  }

  async function runAction(
    item: PayInItem,
    action: ActionType,
    opts?: { utr?: string; paymentImage?: string | null },
  ) {
    setActionBusyId(item.id);
    setModalError(null);

    let normalizedProof = "";
    if (action === "approve") {
      normalizedProof = (opts?.paymentImage ?? "").trim();
      if (normalizedProof.startsWith("data:image/")) {
        normalizedProof = (await compressImageDataUrlIfLarge(normalizedProof)).trim();
      }
      const utr = (opts?.utr ?? "").trim();
      if (!UTR_12_DIGIT_REGEX.test(utr)) {
        setModalError("UTR/RRN must be 12–22 digits (IMPS/UPI=12, NEFT=16, RTGS=22).");
        setActionBusyId(null);
        return;
      }
      if (!item.hasReceipt && !normalizedProof) {
        setModalError("Upload payment proof (screenshot) before approving.");
        setActionBusyId(null);
        return;
      }
    }

    let status = "";
    if (action === "approve") status = resolvedRole === "admin" ? "APPROVED_BY_ADMIN" : "APPROVED_BY_AGENT";
    if (action === "reject") status = "REJECTED";
    if (action === "cancel") status = resolvedRole === "admin" ? "RE_ASSIGNED" : "REVOKED";

    const body: Record<string, string> = { status };
    if (action === "approve") {
      const utr = (opts?.utr ?? "").trim();
      if (utr) body.utr_code = utr;
      if (normalizedProof) body.payment_image = normalizedProof;
    }

    try {
      const endpoint =
        resolvedRole === "admin" ? `/api/admin/payins/${item.id}/status` : `/api/agent/payins/${item.id}/status`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setModalError(data.error ?? "Could not update transaction.");
        return;
      }
      closeActionModal();
      setSelectedItem(null);
      setModalUtr("");
      await loadPayIns();
    } catch {
      setModalError("Network error.");
    } finally {
      setActionBusyId(null);
    }
  }

  if (resolvedRole === "company") {
    return <CompanyPayInView />;
  }

  if (resolvedRole === "admin") {
    if (permLoading) {
      return (
        <div className="flex items-center justify-center p-12">
          <div className="text-sm text-gray-500">Checking permissions...</div>
        </div>
      );
    }

    if (!can("view_payins")) {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Access Denied</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">You do not have permission to view pay-ins.</p>
        </div>
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white">
          <PayInIcon />
          <h1 className="text-xl font-bold">Pay In</h1>
        </div>
        {!listLoading && !listError && (
          <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
            {resolvedRole === "admin"
              ? "Live: all PayIn requests for admin actions (max 500)."
              : "Live: transactions assigned to your agent account (max 500)."}
          </p>
        )}
      </div>

      {listLoading && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {resolvedRole === "admin" ? "Loading admin payins…" : "Checking agent session…"}
        </div>
      )}
      {listError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
          {listError}
        </div>
      )}

      {showFilter && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white leading-tight">Advanced Search</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                  </svg>
                  {totalOrders.toLocaleString()} Orders found
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(resolvedRole !== "admin" || can("export_transactions")) && (
                <button
                  type="button"
                  onClick={exportPayInsCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export
                </button>
              )}
              <button
                onClick={() => setShowFilter(false)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search & Filter section */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Search & Filter</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Search input */}
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">Search</label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, UPI, order ID..."
                  className="w-full rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
                />
              </div>
              {/* Amount input */}
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">Amount</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
                />
              </div>
              {/* Status dropdown */}
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors appearance-none cursor-pointer"
                >
                  {STATUS_FILTER_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s === "RECEIPT_PENDING" ? "Receipt Pending" : s.charAt(0) + s.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Helper text */}
            <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Peer / Client Name, UPI, Order ID, Receipt, UTR
            </p>
          </div>

          {/* Date Range section */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Date Range</span>
            </div>

            {/* Full-width date range trigger */}
            <div className="w-full">
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                fullWidth
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end px-5 pb-4">
            <button
              onClick={() => setShowFilter(false)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
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
          {STATUS_TABS.map((tab) => {
            const count = counts[tab.value];
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => { setActiveTab(tab.value); setPage(1); }}
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

        {/* Filter toggle icon */}
        <button
          onClick={() => setShowFilter((v) => !v)}
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

      {/* Cards list */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] px-6 py-12 text-center text-gray-400">
            No transactions found.
          </div>
        ) : (
          paginated.map((item) => (
            <PayInCard
              key={item.id}
              item={item}
              onOpenAction={openActionModal}
              onOpenProof={(url) => setProofPreviewUrl(url)}
              // onView={resolvedRole === "admin" ? () => (window.location.href = `/transactions/${item.id}`) : undefined}
              busy={actionBusyId === item.id}
              isAdmin={resolvedRole === "admin"}
              onDispute={raiseDispute}
              canApprove={resolvedRole !== "admin" || can("approve_payins")}
              canDecline={resolvedRole !== "admin" || can("reject_payins")}
              canDispute={resolvedRole !== "admin" || can("create_disputes")}
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
              {modalAction === "approve" && "Approve PayIn"}
              {modalAction === "reject" && "Reject PayIn"}
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
            {modalAction === "approve" && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    UTR code (12 digits) <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={modalUtr}
                    onChange={(e) => setModalUtr(e.target.value)}
                    placeholder="Enter 12-digit UTR"
                    inputMode="numeric"
                    maxLength={12}
                    className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                </div>
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
              </>
            )}
            {modalAction === "reject" && (
              <p className="text-sm text-gray-600 dark:text-gray-300">Reject this PayIn? The payer will need to submit again if applicable.</p>
            )}
            {modalAction === "cancel" && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Revoke unassigns this transaction from the current handler. Use the button below to confirm; Close only dismisses this dialog.
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
              {modalAction === "approve" && (
                <ApproveButton
                  onClick={() =>
                    selectedItem &&
                    void runAction(selectedItem, "approve", { utr: modalUtr, paymentImage: modalProofDataUrl })
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
              (() => {
                // Normalize the URL — handle relative paths, ensure proper prefix
                let src = proofPreviewUrl.trim();
                if (src && !src.startsWith("data:") && !src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("/")) {
                  src = "/" + src;
                }
                return proofIsPdf(src) ? (
                  <iframe title="Payment proof PDF" src={src} className="h-[70vh] w-full rounded-md border border-gray-200 dark:border-gray-700" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt="Payment proof"
                    className="mx-auto max-h-[75vh] w-auto max-w-full object-contain"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = "none";
                      const fallback = document.createElement("div");
                      fallback.className = "flex flex-col items-center justify-center py-12 text-gray-400";
                      fallback.innerHTML = `<svg class="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg><p class="text-sm font-medium">Image could not be loaded</p><p class="text-xs mt-1">The proof image may be corrupted or unavailable</p>`;
                      target.parentElement?.appendChild(fallback);
                    }}
                  />
                );
              })()}
          </div>
        </div>
      </Modal>
    </div>
  );
}
