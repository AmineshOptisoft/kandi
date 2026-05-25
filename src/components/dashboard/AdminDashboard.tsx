"use client";
import React, { useCallback, useEffect, useMemo, useState, useRef, useLayoutEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useTransactionRealtimeRefresh } from "@/hooks/useTransactionRealtimeRefresh";
import { csvExportTimestamp, downloadCsv } from "@/lib/csv-download";
import {
  CommissionSettlementCsvModal,
  InterledgerEntryModal,
  ManualDepositModal,
  ManualPayInInlinePanel,
  SecurityDepositModal,
  SettlementModal,
} from "@/components/dashboard/AdminDashboardActionForms";
import { AdminDashboardIcon } from "@/icons/nav-icons";
import type { Permission } from "@/lib/admin-permissions";

/* ── Types ── */
interface VendorRow {
  id: string;
  name: string;
  security: number;
  credit: number;
  totalPayIn: number;
  totalPayout: number;
  payInToday: number;
  payoutToday: number;
  running: number;
  totalSettlement: number;
  lastSettlement: number;
  payInCommissionPct: number;
  payOutCommissionPct: number;
  referralCommissionPct: number;
  payInCommissionAmount: number;
  payOutCommissionAmount: number;
  referralCommissionAmount: number;
  finalBalance: number;
  remainingBalance: number;
}


function EditableCreditCell({
  rowId,
  value,
  onSave,
  canEdit,
}: {
  rowId: string;
  value: number;
  onSave: (id: string, next: number) => void;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const display =
    value > 0 ? (
      <span className="text-green-600 dark:text-green-400 font-semibold">{value.toLocaleString("en-IN")}</span>
    ) : (
      <span>0</span>
    );

  const startEdit = () => {
    setDraft(value === 0 ? "" : String(value));
    setEditing(true);
  };

  const commit = () => {
    const normalized = draft.replace(/,/g, "").trim();
    const parsed = normalized === "" ? 0 : Number(normalized);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      setEditing(false);
      return;
    }
    onSave(rowId, parsed);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(String(value));
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 py-0.5">
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          className="w-24 min-w-0 rounded-md border border-brand-300 bg-white px-2 py-1 text-xs text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 dark:border-brand-600 dark:bg-gray-900 dark:text-gray-100"
          autoFocus
        />
        <button
          type="button"
          onClick={commit}
          className="rounded-md bg-brand-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-brand-600"
        >
          Save
        </button>
        <button
          type="button"
          onClick={cancel}
          className="rounded-md border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="group/credit relative flex min-h-[1.75rem] items-center gap-1">
      {display}
      {canEdit && (
        <button
          type="button"
          title="Extra PayIn headroom beyond the security pool (credit limit). Click to edit."
          onClick={(e) => {
            e.stopPropagation();
            startEdit();
          }}
          className="inline-flex shrink-0 items-center justify-center rounded p-0.5 text-gray-400 opacity-100 transition-opacity hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800 dark:hover:text-brand-400"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ── Helpers ── */
const fmt = (n: number) => {
  if (n === 0) return "0";
  const abs = Math.abs(n).toLocaleString("en-IN");
  return n < 0 ? `-${abs}` : abs;
};

const fmtPct = (n: number) => {
  if (!Number.isFinite(n) || n === 0) return "0%";
  const t = (Math.round(n * 100) / 100).toString().replace(/\.0+$/, "");
  return `${t}%`;
};

const colorVal = (n: number, zeroDash = false) => {
  if (n === 0) return zeroDash ? <span className="text-gray-400">0</span> : <span>0</span>;
  return <span className={n > 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}>{fmt(n)}</span>;
};

const badge = (n: number) => (
  <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${n > 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : n < 0 ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
    }`}>{fmt(n)}</span>
);

const colHdr = "px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap border-r border-gray-100 dark:border-gray-800 last:border-0";
const colCell = "px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap border-r border-gray-100 dark:border-gray-800 last:border-0";
/** Wide enough for two icon buttons + slide offset + label pills (getActionLabelSpace ≤ 220px) */
const colActions = "min-w-[240px] w-[240px] max-w-[240px] text-center align-middle";

const TABLE_TOOLBAR_ICONS: { id: "menu" | "totals" | "highlight" | "inactive" | "headerFilters" | "customize"; icon: React.ReactNode }[] = [
  {
    id: "menu",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l2 2m0 0l2-2m-2 2v-6" />
      </svg>
    ),
  },
  {
    id: "totals",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l16 16" />
      </svg>
    ),
  },
  {
    id: "highlight",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2M12 19v2M3 12h2m14 0h2" />
      </svg>
    ),
  },
  {
    id: "inactive",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l16 16" />
      </svg>
    ),
  },
  {
    id: "headerFilters",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l16 16" />
      </svg>
    ),
  },
  {
    id: "customize",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17H5a2 2 0 01-2-2V5a2 2 0 012-2h4m6 14h4a2 2 0 002-2V5a2 2 0 00-2-2h-4M9 17v-4m6 4v-4M9 7h6" />
      </svg>
    ),
  },
];

type StatsColKey =
  | "vendor"
  | "security"
  | "totalPayIn"
  | "totalPayout"
  | "payInToday"
  | "payoutToday"
  | "running"
  | "finalBalance"
  | "totalSettlement"
  | "lastSettlement"
  | "payInCommission"
  | "payOutCommission"
  | "referralCommission"
  | "credit"
  | "actions";

const FIN_STATS_COLUMNS: { key: StatsColKey; label: string }[] = [
  { key: "vendor", label: "Vendor" },
  { key: "security", label: "Security" },
  { key: "totalPayIn", label: "Total PayIn" },
  { key: "totalPayout", label: "Total Payout" },
  { key: "payInToday", label: "PayIn (today)" },
  { key: "payoutToday", label: "Payout (today)" },
  { key: "running", label: "Running" },
  { key: "finalBalance", label: "Preview Balance" },
  { key: "totalSettlement", label: "Total Settlement" },
  { key: "lastSettlement", label: "Last Settlement" },
  { key: "payInCommission", label: "PayIn Commission" },
  { key: "payOutCommission", label: "PayOut Commission" },
  { key: "referralCommission", label: "Referral Commission" },
  { key: "credit", label: "Credit" },
  { key: "actions", label: "Actions" },
];

function defaultColBoolMap(value: boolean): Record<StatsColKey, boolean> {
  return Object.fromEntries(FIN_STATS_COLUMNS.map((c) => [c.key, value])) as Record<StatsColKey, boolean>;
}

/** Rows treated as “inactive” for the toolbar filter (no meaningful pay-in / payout / running flow). */
function isInactiveVendorRow(r: VendorRow): boolean {
  return (
    r.totalPayIn === 0 &&
    r.totalPayout === 0 &&
    r.running === 0 &&
    r.payInToday === 0 &&
    r.security === 0
  );
}

function vendorRowCsvCell(row: VendorRow, key: StatsColKey): string {
  if (key === "vendor") return row.name;
  if (key === "actions") return "";
  if (key === "payInCommission") {
    return `${fmtPct(row.payInCommissionPct)} (${row.payInCommissionAmount})`;
  }
  if (key === "payOutCommission") {
    return `${fmtPct(row.payOutCommissionPct)} (${row.payOutCommissionAmount})`;
  }
  if (key === "referralCommission") {
    return `${fmtPct(row.referralCommissionPct)} (${row.referralCommissionAmount})`;
  }
  const v = row[key as keyof VendorRow];
  if (typeof v === "number") return String(v);
  return String(v ?? "");
}

type SortDir = "asc" | "desc";

const COLUMN_HEADER_TITLES: Partial<Record<StatsColKey, string>> = {
  credit:
    "Extra PayIn headroom beyond the security pool: allowed exposure even when deposit-backed room is used up.",
  payInCommission: "Agent PayIn commission rate (percentage) and today's amount (PayIn today × commission %)",
  payOutCommission: "Agent PayOut commission rate (percentage) and today's amount (Payout today × commission %)",
  referralCommission: "Agent referral commission rate (percentage) and today's amount (PayIn today × commission %)",
  lastSettlement: "Amount from the agent's most recent settled settlement record",
  finalBalance: "Preview Balance = Yesterday's Running Balance",
};

const COLUMNS_WITH_INFO_ICON = new Set<StatsColKey>([
  "totalPayIn",
  "totalPayout",
  "payInToday",
  "payoutToday",
  "payInCommission",
  "payOutCommission",
  "referralCommission",
  "lastSettlement",
  "finalBalance",
]);

function compareVendorRows(a: VendorRow, b: VendorRow, key: StatsColKey, dir: SortDir): number {
  let valA: number;
  let valB: number;
  if (key === "vendor") {
    let cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
    return dir === "asc" ? cmp : -cmp;
  } else if (key === "payInCommission") {
    valA = a.payInCommissionAmount;
    valB = b.payInCommissionAmount;
  } else if (key === "payOutCommission") {
    valA = a.payOutCommissionAmount;
    valB = b.payOutCommissionAmount;
  } else if (key === "referralCommission") {
    valA = a.referralCommissionAmount;
    valB = b.referralCommissionAmount;
  } else {
    valA = a[key as keyof VendorRow] as number;
    valB = b[key as keyof VendorRow] as number;
  }
  let cmp = valA - valB;
  if (cmp === 0) {
    cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
  }
  return dir === "asc" ? cmp : -cmp;
}

function ColInfoIcon() {
  return (
    <span className="inline-flex h-3 w-3 cursor-help items-center justify-center rounded-full bg-gray-300 text-[8px] font-bold dark:bg-gray-600">
      i
    </span>
  );
}

function columnHeaderLabel(key: StatsColKey): React.ReactNode {
  const col = FIN_STATS_COLUMNS.find((c) => c.key === key);
  if (!col) return null;
  if (COLUMNS_WITH_INFO_ICON.has(key)) {
    return (
      <>
        {col.label}
        &nbsp;
        <ColInfoIcon />
      </>
    );
  }
  return col.label;
}

function SortChevrons({ active, dir }: { active: boolean; dir: SortDir }) {
  const idle = "text-gray-300 dark:text-gray-600";
  const on = "text-brand-500 dark:text-brand-400";
  return (
    <span className="inline-flex shrink-0 flex-col leading-none" aria-hidden>
      <svg
        className={`-mb-0.5 h-2 w-2 ${active && dir === "asc" ? on : idle}`}
        viewBox="0 0 12 12"
        fill="currentColor"
      >
        <path d="M6 3 10 8H2z" />
      </svg>
      <svg
        className={`h-2 w-2 ${active && dir === "desc" ? on : idle}`}
        viewBox="0 0 12 12"
        fill="currentColor"
      >
        <path d="M6 9 2 4h8z" />
      </svg>
    </span>
  );
}

function SortableHeader({
  colKey,
  className,
  children,
  title,
  sortKey,
  sortDir,
  onSort,
}: {
  colKey: StatsColKey;
  className: string;
  children: React.ReactNode;
  title?: string;
  sortKey: StatsColKey | null;
  sortDir: SortDir;
  onSort: (key: StatsColKey) => void;
}) {
  if (colKey === "actions") {
    return (
      <th className={className} scope="col">
        {children}
      </th>
    );
  }

  const active = sortKey === colKey;
  const ariaSort = active ? (sortDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <th
      className={className}
      scope="col"
      aria-sort={ariaSort}
      title={title}
    >
      <button
        type="button"
        onClick={() => onSort(colKey)}
        className={`-mx-0.5 inline-flex max-w-full items-center gap-1 rounded px-0.5 text-left transition-colors hover:text-gray-800 dark:hover:text-gray-100 ${active ? "text-brand-600 dark:text-brand-400" : ""
          }`}
      >
        <span className="!w-fit ">{children}</span>
        <SortChevrons active={active} dir={sortDir} />
      </button>
    </th>
  );
}

/* ── Tooltip wrapper ── */
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50
                      opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150">
        <div className="bg-gray-900 dark:bg-gray-700 text-white text-[11px] font-medium
                        rounded px-2 py-0.5 whitespace-nowrap shadow-lg">
          {label}
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
      </div>
    </div>
  );
}

/* ── Component ── */
export default function AdminDashboard() {
  const { loading: authLoading } = useAuth();
  const { can, isSuperAdmin, loading: permLoading } = useAdminPermissions();
  const router = useRouter();
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hoveredToolbarIndex, setHoveredToolbarIndex] = useState<number | null>(null);
  const [hoveredTableActionIndex, setHoveredTableActionIndex] = useState<number | null>(null);
  /** Per vendor row: which action slot (0 View, 1 Remove) is hovered — same slide + label animation as table toolbar */
  const [vendorRowHoveredAction, setVendorRowHoveredAction] = useState<{ rowId: string; slot: 0 | 1 } | null>(null);
  const [removeConfirmVendorId, setRemoveConfirmVendorId] = useState<string | null>(null);
  const [openTopModal, setOpenTopModal] = useState<
    "interledger" | "security-deposit" | "settlement" | "commission-csv" | "manual-deposit" | null
  >(null);
  const [manualPayInPanelOpen, setManualPayInPanelOpen] = useState(false);

  const tableToolbarRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [highlightMenuOpen, setHighlightMenuOpen] = useState(false);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [showTotalsRow, setShowTotalsRow] = useState(true);
  const [hideHeaderFilters, setHideHeaderFilters] = useState(false);
  const [rowActivityFilter, setRowActivityFilter] = useState<"all" | "active" | "inactive">("all");
  const [colVisible, setColVisible] = useState<Record<StatsColKey, boolean>>(() => defaultColBoolMap(true));
  const [colHighlight, setColHighlight] = useState<Record<StatsColKey, boolean>>(() => defaultColBoolMap(false));
  const [sortKey, setSortKey] = useState<StatsColKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const load = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/dashboard", { credentials: "include" });
      const data = (await res.json()) as { ok?: boolean; rows?: VendorRow[]; error?: string };
      if (res.status === 401) {
        setLoadError("Admin sign-in required.");
        setRows([]);
        return;
      }
      if (!res.ok || !data.ok || !data.rows) {
        setLoadError(data.error ?? "Could not load dashboard.");
        setRows([]);
        return;
      }
      setRows(data.rows);
    } catch {
      setLoadError("Network error.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [authLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  useTransactionRealtimeRefresh({
    onRefresh: () => {
      void load();
    },
  });

  const totals = useMemo(() => {
    const z: Omit<VendorRow, "id" | "name"> = {
      security: 0,
      credit: 0,
      totalPayIn: 0,
      totalPayout: 0,
      payInToday: 0,
      payoutToday: 0,
      running: 0,
      totalSettlement: 0,
      lastSettlement: 0,
      payInCommissionPct: 0,
      payOutCommissionPct: 0,
      referralCommissionPct: 0,
      payInCommissionAmount: 0,
      payOutCommissionAmount: 0,
      referralCommissionAmount: 0,
      finalBalance: 0,
      remainingBalance: 0,
    };
    return rows.reduce(
      (acc, r) => ({
        security: acc.security + r.security,
        credit: acc.credit + r.credit,
        totalPayIn: acc.totalPayIn + r.totalPayIn,
        totalPayout: acc.totalPayout + r.totalPayout,
        payInToday: acc.payInToday + r.payInToday,
        payoutToday: acc.payoutToday + r.payoutToday,
        running: acc.running + r.running,
        totalSettlement: acc.totalSettlement + r.totalSettlement,
        lastSettlement: acc.lastSettlement + r.lastSettlement,
        payInCommissionPct: acc.payInCommissionPct,
        payOutCommissionPct: acc.payOutCommissionPct,
        referralCommissionPct: acc.referralCommissionPct,
        payInCommissionAmount: acc.payInCommissionAmount + r.payInCommissionAmount,
        payOutCommissionAmount: acc.payOutCommissionAmount + r.payOutCommissionAmount,
        referralCommissionAmount: acc.referralCommissionAmount + r.referralCommissionAmount,
        finalBalance: acc.finalBalance + r.finalBalance,
        remainingBalance: acc.remainingBalance + r.remainingBalance,
      }),
      z,
    );
  }, [rows]);

  const saveRowCredit = async (id: string, next: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const remainingBalance = next - r.finalBalance;
          return { ...r, credit: next, remainingBalance };
        }
        return r;
      }),
    );

    try {
      await fetch(`/api/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credit_limit: next }),
      });
      void load();
    } catch (e) {
      console.error("Failed to update credit limit", e);
    }
  };
  const getActionLabelSpace = (label: string) =>
    Math.max(72, Math.min(220, label.length * 7 + 24));

  const tableToolbarHoverLabel = (idx: number): string => {
    switch (idx) {
      case 0:
        return "Menu / Options List";
      case 1:
        return showTotalsRow ? "Hide Totals" : "Show Totals";
      case 2:
        return "Highlight";
      case 3:
        return "Show Inactive (active or inactive)";
      case 4:
        return hideHeaderFilters ? "Show Header Filters" : "Hide Header Filters";
      case 5:
        return `Customize Columns (${FIN_STATS_COLUMNS.length})`;
      default:
        return "";
    }
  };

  useEffect(() => {
    if (!removeConfirmVendorId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRemoveConfirmVendorId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [removeConfirmVendorId]);

  useEffect(() => {
    if (!menuOpen && !highlightMenuOpen && !columnsMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (tableToolbarRef.current && !tableToolbarRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setHighlightMenuOpen(false);
        setColumnsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen, highlightMenuOpen, columnsMenuOpen]);

  const confirmRemoveVendor = () => {
    if (!removeConfirmVendorId) return;
    setRows((prev) => prev.filter((r) => r.id !== removeConfirmVendorId));
    setRemoveConfirmVendorId(null);
  };

  type TopActionId =
    | "interledger"
    | "security-deposit"
    | "settlement"
    | "export"
    | "manual-payin"
    | "commission-csv"
    | "manual-deposit";

  const ALL_TOP_ACTIONS: { id: TopActionId; label: string; icon: React.ReactNode; requiredPermission?: Permission }[] = [
    {
      id: "interledger",
      label: "Add Interledger Entry",
      requiredPermission: "add_interledger" as const,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7l-4 5 4 5M17 7l4 5-4 5M10 6l4 12" />
        </svg>
      ),
    },
    {
      id: "security-deposit",
      label: "Add Security Deposit",
      requiredPermission: "add_security_deposit" as const,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.2-2.7 7.8-7 10-4.3-2.2-7-5.8-7-10V6l7-3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v6M9 11h6" />
        </svg>
      ),
    },
    {
      id: "settlement",
      label: "Add Settlement",
      requiredPermission: "add_settlement" as const,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 13v4M10 15h4" />
        </svg>
      ),
    },
    {
      id: "export",
      label: "Export Data",
      requiredPermission: "export_data" as const,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v11m0 0l-4-4m4 4l4-4M4 16v2a3 3 0 003 3h10a3 3 0 003-3v-2" />
        </svg>
      ),
    },
    {
      id: "manual-payin",
      label: "Manual PayIn (CSV)",
      requiredPermission: "manual_payin" as const,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M12 17V11m0 0l-2 2m2-2l2 2M8 20h8" />
        </svg>
      ),
    },
    {
      id: "commission-csv",
      label: "Commission Settlement (CSV)",
      requiredPermission: "commission_settlement" as const,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M8.5 15.5l2.1 2.1 4.9-4.9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 10h6" />
        </svg>
      ),
    },
    {
      id: "manual-deposit",
      label: "Manual Deposit",
      requiredPermission: "manually_deposit" as const,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h18v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 8V6a2 2 0 012-2h6a2 2 0 012 2v2M12 11v6M9 14h6" />
        </svg>
      ),
    },
  ];

  // Filter the toolbar to only include actions the current admin can perform
  const topActions = permLoading
    ? []
    : ALL_TOP_ACTIONS.filter((a) => !a.requiredPermission || can(a.requiredPermission));

  const subadminOptions = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        security: r.security,
        credit: r.credit,
        running: r.running,
        totalSettlement: r.totalSettlement,
        finalBalance: r.finalBalance,
      })),
    [rows],
  );

  const filtered = useMemo(() => {
    let list = rows.filter(
      (r) => !search || r.name.toLowerCase().includes(search.toLowerCase())
    );
    if (rowActivityFilter === "active") list = list.filter((r) => !isInactiveVendorRow(r));
    if (rowActivityFilter === "inactive") list = list.filter((r) => isInactiveVendorRow(r));
    return list;
  }, [rows, search, rowActivityFilter]);

  const handleSort = useCallback((key: StatsColKey) => {
    if (key === "actions") return;
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const sortedRows = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => compareVendorRows(a, b, sortKey, sortDir));
  }, [filtered, sortKey, sortDir]);

  const exportFinancialCsv = useCallback(
    (opts: { visibleColumnsOnly: boolean }) => {
      const cols = FIN_STATS_COLUMNS.filter(
        (c) => c.key !== "actions" && (!opts.visibleColumnsOnly || colVisible[c.key]),
      );
      if (cols.length === 0) {
        window.alert("Select at least one data column to export.");
        return;
      }
      const header = cols.map((c) => c.label);
      const dataRows = filtered.map((row) => cols.map((c) => vendorRowCsvCell(row, c.key)));
      downloadCsv(
        `admin-financial${opts.visibleColumnsOnly ? "-view" : ""}-${csvExportTimestamp()}.csv`,
        [header, ...dataRows],
      );
    },
    [filtered, colVisible],
  );

  const handleTopAction = useCallback(
    (id: TopActionId) => {
      if (id === "export") {
        exportFinancialCsv({ visibleColumnsOnly: false });
        return;
      }
      if (id === "manual-payin") {
        setOpenTopModal(null);
        setManualPayInPanelOpen((open) => !open);
        return;
      }
      setManualPayInPanelOpen(false);
      if (id === "interledger") setOpenTopModal("interledger");
      else if (id === "security-deposit") setOpenTopModal("security-deposit");
      else if (id === "settlement") setOpenTopModal("settlement");
      else if (id === "commission-csv") setOpenTopModal("commission-csv");
      else if (id === "manual-deposit") setOpenTopModal("manual-deposit");
    },
    [exportFinancialCsv],
  );

  const hoveredLabelSpacePx =
    hoveredToolbarIndex === null ? 0 : getActionLabelSpace(topActions[hoveredToolbarIndex].label);
  const hoveredTableActionSpacePx =
    hoveredTableActionIndex === null
      ? 0
      : getActionLabelSpace(tableToolbarHoverLabel(hoveredTableActionIndex));

  const xh = (k: StatsColKey) => (colHighlight[k] ? " bg-amber-50/90 dark:bg-amber-950/35" : "");
  const xv = (k: StatsColKey) => (colVisible[k] ? "" : " hidden");
  const visibleColCount = FIN_STATS_COLUMNS.filter((c) => colVisible[c.key]).length;

  if (permLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-gray-500">Checking permissions...</div>
      </div>
    );
  }

  if (!can("view_dashboard")) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Access Denied</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">You do not have permission to view the Admin Dashboard.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <AdminDashboardIcon className="h-5 w-5 text-gray-800 dark:text-white" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 ml-7">
            Live agent balances from the database — columns without data stay
          </p>
        </div>

        {/* Right-side toolbar — animated action rail */}
        <div className="relative flex items-center gap-0.5 flex-wrap">
          {topActions.map((action, idx) => {
            const isHovered = hoveredToolbarIndex === idx;
            const isLeftOfHovered = hoveredToolbarIndex !== null && idx < hoveredToolbarIndex;
            return (
              <div
                key={action.label}
                className="group relative transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  transform: isLeftOfHovered ? `translateX(-${hoveredLabelSpacePx}px)` : "translateX(0px)",
                }}
                onMouseEnter={() => setHoveredToolbarIndex(idx)}
                onMouseLeave={() => setHoveredToolbarIndex(null)}
              >
                <button
                  type="button"
                  aria-label={action.label}
                  className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-300 ${action.id === "manual-payin" && manualPayInPanelOpen
                    ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                    : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (idx === 3) exportFinancialCsv({ visibleColumnsOnly: false });
                    else if (idx === 4) {
                      downloadCsv(`manual-payin-template-${csvExportTimestamp()}.csv`, [
                        ["order_id", "amount", "client_name", "client_upi", "utr", "remarks"],
                      ]);
                    } else if (idx === 5) {
                      downloadCsv(`commission-settlement-template-${csvExportTimestamp()}.csv`, [
                        [
                          "vendor_id",
                          "vendor_name",
                          "settlement_amount",
                          "period_from_YYYY-MM-DD",
                          "period_to_YYYY-MM-DD",
                          "remarks",
                        ],
                      ]);
                    }
                    handleTopAction(action.id);
                  }}
                >
                  {action.icon}
                </button>
                <span
                  className={`pointer-events-none absolute right-7 top-1/2 z-20 w-fit -translate-y-1/2 whitespace-nowrap rounded-md border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 px-2 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-200 shadow-sm text-right transition-all duration-200 ease-out
                    opacity-0 translate-x-1 scale-95
                    group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100`}
                >
                  {action.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Financial Statistics card ── */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] overflow-hidden">
        {loadError && (
          <div className="px-5 py-3 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/25 border-b border-amber-100 dark:border-amber-900/40">
            {loadError}{" "}
            <Link href="/signin/admin" className="font-semibold underline">
              Sign in as admin
            </Link>
          </div>
        )}
        {loading && (
          <div className="px-5 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
            Loading dashboard…
          </div>
        )}
        {/* Card header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Financial Statistics</h2>
          <div className="flex items-center gap-1">
            <div className="relative flex flex-wrap items-center gap-0.5" ref={tableToolbarRef}>
              {TABLE_TOOLBAR_ICONS.map((item, idx) => {
                const isHovered = hoveredTableActionIndex === idx;
                const isLeftOfHovered = hoveredTableActionIndex !== null && idx < hoveredTableActionIndex;
                const label = tableToolbarHoverLabel(idx);
                return (
                  <div
                    key={item.id}
                    className="group relative transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{
                      transform: isLeftOfHovered ? `translateX(-${hoveredTableActionSpacePx}px)` : "translateX(0px)",
                    }}
                    onMouseEnter={() => setHoveredTableActionIndex(idx)}
                    onMouseLeave={() => setHoveredTableActionIndex(null)}
                  >
                    <button
                      type="button"
                      aria-label={label}
                      className="relative z-10 flex h-7 w-7 items-center justify-center rounded text-gray-400 transition-colors duration-300 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.id === "menu") {
                          setHighlightMenuOpen(false);
                          setColumnsMenuOpen(false);
                          setMenuOpen((o) => !o);
                        } else if (item.id === "totals") {
                          setShowTotalsRow((s) => !s);
                        } else if (item.id === "highlight") {
                          setMenuOpen(false);
                          setColumnsMenuOpen(false);
                          setHighlightMenuOpen((o) => !o);
                        } else if (item.id === "inactive") {
                          setRowActivityFilter((m) => (m === "all" ? "active" : m === "active" ? "inactive" : "all"));
                        } else if (item.id === "headerFilters") {
                          setHideHeaderFilters((h) => !h);
                        } else if (item.id === "customize") {
                          setMenuOpen(false);
                          setHighlightMenuOpen(false);
                          setColumnsMenuOpen((o) => !o);
                        }
                      }}
                    >
                      {item.icon}
                    </button>
                    <span
                      className={`pointer-events-none absolute right-6 top-1/2 z-30 w-fit max-w-[220px] -translate-y-1/2 whitespace-nowrap rounded-md border border-gray-200 bg-white/95 px-2 py-1 text-right text-[11px] font-medium text-gray-600 shadow-sm transition-all duration-200 ease-out dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-200
                        opacity-0 translate-x-1 scale-95
                        group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}

              {menuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 text-left text-xs shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  <div className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-200">Options</div>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                    onClick={() => {
                      setMenuOpen(false);
                      void load();
                    }}
                  >
                    Refresh summary
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                    onClick={() => {
                      exportFinancialCsv({ visibleColumnsOnly: true });
                      setMenuOpen(false);
                    }}
                  >
                    Export view…
                  </button>
                </div>
              )}

              {highlightMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 max-h-72 w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 text-left shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  <p className="mb-1.5 px-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Highlight columns
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {FIN_STATS_COLUMNS.map((c) => (
                      <label
                        key={c.key}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-800"
                          checked={colHighlight[c.key]}
                          onChange={() => setColHighlight((prev) => ({ ...prev, [c.key]: !prev[c.key] }))}
                        />
                        <span className="truncate">{c.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {columnsMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 max-h-72 w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 text-left shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  <p className="mb-1.5 px-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Customize columns ({FIN_STATS_COLUMNS.length})
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {FIN_STATS_COLUMNS.map((c) => (
                      <label
                        key={`vis-${c.key}`}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-800"
                          checked={colVisible[c.key]}
                          onChange={() =>
                            setColVisible((prev) => {
                              const next = { ...prev, [c.key]: !prev[c.key] };
                              if (!FIN_STATS_COLUMNS.some((col) => next[col.key])) return prev;
                              return next;
                            })
                          }
                        />
                        <span className="truncate">{c.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!hideHeaderFilters && (
              <>
                <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />
                <span className="pr-1 text-xs whitespace-nowrap text-gray-400 dark:text-gray-500">
                  Showing <span className="font-semibold text-gray-600 dark:text-gray-300">{filtered.length}</span>{" "}
                  results
                  {rowActivityFilter !== "all" && (
                    <span className="ml-1 text-[10px] font-semibold text-blue-500 dark:text-blue-400">
                      ({rowActivityFilter})
                    </span>
                  )}
                </span>
              </>
            )}
          </div>
        </div>

        {manualPayInPanelOpen && (
          <ManualPayInInlinePanel onClose={() => setManualPayInPanelOpen(false)} />
        )}

        {/* Table (horizontal scroll) */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: "1680px" }}>
            <thead>
              <tr className="bg-gray-50/80 dark:bg-white/[0.03] border-b border-gray-100 dark:border-gray-800">
                {FIN_STATS_COLUMNS.map((col) => (
                  <SortableHeader
                    key={col.key}
                    colKey={col.key}
                    className={`${colHdr}${col.key === "vendor" ? " sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 min-w-[200px]" : ""
                      }${col.key === "actions" ? ` ${colActions}` : ""}${xh(col.key)}${xv(col.key)}`}
                    title={COLUMN_HEADER_TITLES[col.key]}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                  >
                    {columnHeaderLabel(col.key)}
                  </SortableHeader>
                ))}
              </tr>

              {showTotalsRow && (
                <tr className="border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-white/[0.04]">
                  <td className={`${colCell} sticky left-0 z-10 bg-gray-100 dark:bg-gray-900 font-bold text-gray-600 dark:text-gray-300${xh("vendor")}${xv("vendor")}`}>Vendor</td>
                  <td className={`${colCell} font-bold text-blue-600 dark:text-blue-400${xh("security")}${xv("security")}`}>{totals.security.toLocaleString("en-IN")}</td>
                  <td className={`${colCell} font-bold text-blue-600 dark:text-blue-400${xh("totalPayIn")}${xv("totalPayIn")}`}>{totals.totalPayIn.toLocaleString("en-IN")}</td>
                  <td className={`${colCell} font-bold text-orange-500${xh("totalPayout")}${xv("totalPayout")}`}>{totals.totalPayout.toLocaleString("en-IN")}</td>
                  <td className={`${colCell} font-bold text-blue-600 dark:text-blue-400${xh("payInToday")}${xv("payInToday")}`}>{totals.payInToday.toLocaleString("en-IN")}</td>
                  <td className={`${colCell} font-bold text-orange-500${xh("payoutToday")}${xv("payoutToday")}`}>{totals.payoutToday.toLocaleString("en-IN")}</td>
                  <td className={`${colCell}${xh("running")}${xv("running")}`}>{badge(totals.running)}</td>
                  <td className={`${colCell}${xh("finalBalance")}${xv("finalBalance")}`}>{badge(totals.finalBalance)}</td>
                  <td className={`${colCell}${xh("totalSettlement")}${xv("totalSettlement")}`}>{totals.totalSettlement.toLocaleString("en-IN")}</td>
                  <td className={`${colCell}${xh("lastSettlement")}${xv("lastSettlement")}`}>{totals.lastSettlement.toLocaleString("en-IN")}</td>
                  <td className={`${colCell} font-semibold text-emerald-600 dark:text-emerald-400${xh("payInCommission")}${xv("payInCommission")}`}>— ({totals.payInCommissionAmount.toLocaleString("en-IN")})</td>
                  <td className={`${colCell} font-semibold text-emerald-600 dark:text-emerald-400${xh("payOutCommission")}${xv("payOutCommission")}`}>— ({totals.payOutCommissionAmount.toLocaleString("en-IN")})</td>
                  <td className={`${colCell} font-semibold text-emerald-600 dark:text-emerald-400${xh("referralCommission")}${xv("referralCommission")}`}>— ({totals.referralCommissionAmount.toLocaleString("en-IN")})</td>
                  <td className={`${colCell} font-bold text-blue-600 dark:text-blue-400${xh("credit")}${xv("credit")}`}>{totals.credit.toLocaleString("en-IN")}</td>
                  <td className={`${colCell} ${colActions}${xh("actions")}${xv("actions")}`}></td>
                </tr>
              )}
            </thead>

            <tbody>
              {sortedRows.map((row) => {
                const rowHover = vendorRowHoveredAction?.rowId === row.id ? vendorRowHoveredAction : null;
                const vendorRowHoveredSpacePx =
                  rowHover == null ? 0 : getActionLabelSpace(rowHover.slot === 0 ? "View" : "Block");

                return (
                  <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-blue-50/30 dark:hover:bg-white/[0.015] transition-colors">
                    {/* Vendor name — sticky */}
                    <td className={`${colCell} sticky left-0 z-10 bg-white dark:bg-gray-900 font-semibold text-gray-800 dark:text-gray-200${xh("vendor")}${xv("vendor")}`}>
                      <Link href={`/agent/${row.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                        {row.name}
                      </Link>
                    </td>

                    <td className={`${colCell}${xh("security")}${xv("security")}`}>{row.security > 0 ? row.security.toLocaleString("en-IN") : "0"}</td>
                    <td className={`${colCell}${xh("totalPayIn")}${xv("totalPayIn")}`}>{row.totalPayIn > 0 ? row.totalPayIn.toLocaleString("en-IN") : "0"}</td>
                    <td className={`${colCell}${xh("totalPayout")}${xv("totalPayout")}`}>{row.totalPayout > 0 ? row.totalPayout.toLocaleString("en-IN") : "0"}</td>
                    <td className={`${colCell}${xh("payInToday")}${xv("payInToday")}`}>{row.payInToday > 0 ? row.payInToday.toLocaleString("en-IN") : "0"}</td>
                    <td className={`${colCell}${xh("payoutToday")}${xv("payoutToday")}`}>{row.payoutToday > 0 ? row.payoutToday.toLocaleString("en-IN") : "0"}</td>
                    <td className={`${colCell}${xh("running")}${xv("running")}`}>{badge(row.running)}</td>
                    <td className={`${colCell}${xh("finalBalance")}${xv("finalBalance")}`}>{badge(row.finalBalance)}</td>
                    <td className={`${colCell}${xh("totalSettlement")}${xv("totalSettlement")}`}>{colorVal(row.totalSettlement, true)}</td>
                    <td className={`${colCell}${xh("lastSettlement")}${xv("lastSettlement")}`}>{colorVal(row.lastSettlement, true)}</td>
                    <td className={`${colCell}${xh("payInCommission")}${xv("payInCommission")}`}>
                      {fmtPct(row.payInCommissionPct)} ({colorVal(row.payInCommissionAmount, true)})
                    </td>
                    <td className={`${colCell}${xh("payOutCommission")}${xv("payOutCommission")}`}>
                      {fmtPct(row.payOutCommissionPct)} ({colorVal(row.payOutCommissionAmount, true)})
                    </td>
                    <td className={`${colCell}${xh("referralCommission")}${xv("referralCommission")}`}>
                      {fmtPct(row.referralCommissionPct)} ({colorVal(row.referralCommissionAmount, true)})
                    </td>
                    <td className={`${colCell}${xh("credit")}${xv("credit")}`}>
                      <EditableCreditCell rowId={row.id} value={row.credit} onSave={saveRowCredit} canEdit={can("edit_agents")} />
                    </td>

                    {/* Actions — same label-from-behind + sibling shift as Financial Statistics toolbar */}
                    <td className={`${colCell} ${colActions}${xh("actions")}${xv("actions")}`}>
                      <div
                        className="relative flex items-center justify-center gap-0.5 mx-auto max-w-full"
                        onMouseLeave={() => {
                          setVendorRowHoveredAction((h) => (h?.rowId === row.id ? null : h));
                        }}
                      >
                        <div
                          className="relative transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                          style={{
                            transform:
                              rowHover !== null && rowHover.slot === 1
                                ? `translateX(-${vendorRowHoveredSpacePx}px)`
                                : "translateX(0px)",
                          }}
                          onMouseEnter={() => setVendorRowHoveredAction({ rowId: row.id, slot: 0 })}
                        >
                          {can("view_agents") && (
                            <>
                              <button
                                type="button"
                                aria-label="View"
                                onClick={() => router.push(`/agent/${row.id}`)}
                                className="relative z-10 flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-300"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                              <span
                                className={`pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 z-20 w-fit whitespace-nowrap rounded-md border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 px-2 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-200 shadow-sm text-right transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${rowHover !== null && rowHover.slot === 0 ? "opacity-100 translate-x-0 scale-100" : "opacity-0 translate-x-1 scale-95"}`}
                              >
                                View
                              </span>
                            </>
                          )}
                        </div>
                        {can("deactivate_agents") && (
                          <div
                            className="relative transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                            style={{ transform: "translateX(0px)" }}
                            onMouseEnter={() => setVendorRowHoveredAction({ rowId: row.id, slot: 1 })}
                          >
                            <button
                              type="button"
                              aria-label="Block"
                              className="relative z-10 flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-300"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setRemoveConfirmVendorId(row.id);
                              }}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                            <span
                              className={`pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 z-20 w-fit whitespace-nowrap rounded-md border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 px-2 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-200 shadow-sm text-right transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${rowHover !== null && rowHover.slot === 1 ? "opacity-100 translate-x-0 scale-100" : "opacity-0 translate-x-1 scale-95"}`}
                            >
                              Block
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={Math.max(1, visibleColCount)} className="py-12 text-center text-sm text-gray-400">No vendors found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-white/[0.02]">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Showing <span className="font-semibold text-gray-600 dark:text-gray-300">{filtered.length}</span> of{" "}
            <span className="font-semibold text-gray-600 dark:text-gray-300">{rows.length}</span> results
          </p>
        </div>
      </div>

      <InterledgerEntryModal
        isOpen={openTopModal === "interledger"}
        onClose={() => setOpenTopModal(null)}
        subadmins={subadminOptions}
        onSuccess={() => void load()}
      />
      <SecurityDepositModal
        isOpen={openTopModal === "security-deposit"}
        onClose={() => setOpenTopModal(null)}
        subadmins={subadminOptions}
        onSuccess={() => void load()}
      />
      <SettlementModal
        isOpen={openTopModal === "settlement"}
        onClose={() => setOpenTopModal(null)}
        subadmins={subadminOptions}
        onSuccess={() => void load()}
      />
      <CommissionSettlementCsvModal
        isOpen={openTopModal === "commission-csv"}
        onClose={() => setOpenTopModal(null)}
      />
      <ManualDepositModal
        isOpen={openTopModal === "manual-deposit"}
        onClose={() => setOpenTopModal(null)}
        subadmins={subadminOptions}
      />

      {removeConfirmVendorId !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-vendor-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px] dark:bg-black/60"
            aria-label="Dismiss"
            onClick={() => setRemoveConfirmVendorId(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <h3 id="remove-vendor-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              Block vendor?
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              This will block{" "}
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {rows.find((r) => r.id === removeConfirmVendorId)?.name ?? "this vendor"}
              </span>{" "}
              from the financial statistics table. You can refresh the page to restore mock data.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setRemoveConfirmVendorId(null)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoveVendor}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
              >
                Block
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
