"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  TransactionSummaryCards,
  TransactionStatisticsPanels,
  AgentPerformanceTable,
  TransactionStatusDistributionTable,
  type TransactionSummaryCard,
  type TransactionStatBlock,
  type AgentPerformanceRow,
  type TransactionStatusDistributionRow,
} from ".";
import { GrTransaction } from "react-icons/gr";
import DateRangePicker, { DateRange } from "@/components/dashboard/DateRangePicker";
import { appendDateRangeToUrl, daysAgoInputDate, toInputDate, todayInputDate } from "@/lib/date-range";
import { TransactionReportIcon } from "@/icons/nav-icons";
import { useAuth } from "@/context/AuthContext";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";

type Tx = {
  id: string;
  amount: number;
  status: string;
  assignedAgentName?: string;
  assignedAgentId?: string | null;
  processingSeconds?: number | null;
  /** Company payin/payout list uses this label; keep in sync for vendor performance. */
  assignedToLabel?: string;
};

type ApiResponse = { ok?: boolean; payins?: Tx[]; payouts?: Tx[]; error?: string };

function inr(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
}

function averageProcessingLabel(items: Tx[]): string {
  const valid = items
    .map((t) => t.processingSeconds)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
  if (!valid.length) return "—";
  const avg = Math.round(valid.reduce((sum, v) => sum + v, 0) / valid.length);
  return formatDuration(avg);
}

function aggregateByStatus(payIns: Tx[], payOuts: Tx[]): TransactionStatusDistributionRow[] {
  const map = new Map<string, { payInCount: number; payInAmount: number; payOutCount: number; payOutAmount: number }>();
  for (const t of payIns) {
    const s = (t.status || "UNKNOWN").toUpperCase();
    const row = map.get(s) ?? { payInCount: 0, payInAmount: 0, payOutCount: 0, payOutAmount: 0 };
    row.payInCount += 1;
    row.payInAmount += t.amount || 0;
    map.set(s, row);
  }
  for (const t of payOuts) {
    const s = (t.status || "UNKNOWN").toUpperCase();
    const row = map.get(s) ?? { payInCount: 0, payInAmount: 0, payOutCount: 0, payOutAmount: 0 };
    row.payOutCount += 1;
    row.payOutAmount += t.amount || 0;
    map.set(s, row);
  }
  return Array.from(map.entries()).map(([status, r]) => ({
    status,
    payInCount: r.payInCount,
    payInAmount: inr(r.payInAmount),
    payOutCount: r.payOutCount,
    payOutAmount: inr(r.payOutAmount),
    totalCount: r.payInCount + r.payOutCount,
    totalAmount: inr(r.payInAmount + r.payOutAmount),
  }));
}

export default function TransactionReport() {
  const { user } = useAuth();
  const { can, loading: permissionsLoading } = useAdminPermissions();
  const [payIns, setPayIns] = useState<Tx[]>([]);
  const [payOuts, setPayOuts] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const { loading: authLoading } = useAuth();

  const role = user?.role || "admin";

  useEffect(() => {
    let mounted = true;
    if (authLoading || (role === "admin" && permissionsLoading)) return;
    if (role === "admin" && !can("view_reports")) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Default to last 10 days when no date range is selected
        const fallbackFrom = daysAgoInputDate(10);
        const fallbackTo = todayInputDate();
        const from = dateRange?.from ? toInputDate(dateRange.from) : fallbackFrom;
        const to = dateRange?.to ? toInputDate(dateRange.to) : fallbackTo;

        if (role === "admin") {
          const res = await fetch(appendDateRangeToUrl("/api/admin/transaction-report?limit=5000", from, to), {
            credentials: "include",
          });
          const data = (await res.json()) as ApiResponse;
          if (!mounted) return;
          if (!res.ok || !data.ok) {
            setError(data.error ?? "Could not load report data.");
            setLoading(false);
            return;
          }
          setPayIns(data.payins ?? []);
          setPayOuts(data.payouts ?? []);
        } else if (role === "company") {
          const [piRes, poRes] = await Promise.all([
            fetch(appendDateRangeToUrl("/api/company/payins?limit=5000", from, to), { credentials: "include" }),
            fetch(appendDateRangeToUrl("/api/company/payouts?limit=5000", from, to), { credentials: "include" }),
          ]);
          const pi = (await piRes.json()) as { ok?: boolean; payins?: Tx[] };
          const po = (await poRes.json()) as { ok?: boolean; payouts?: Tx[] };
          if (!mounted) return;
          setPayIns(pi.payins ?? []);
          setPayOuts(po.payouts ?? []);
        }
      } catch (err) {
        if (mounted) setError("Network error.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [dateRange, role, authLoading]);

  const totals = useMemo(() => {
    const all = [...payIns, ...payOuts];
    const completed = all.filter((t) => {
      const s = t.status.toUpperCase();
      return s === "APPROVED" || s === "APPROVED_BY_ADMIN" || s === "APPROVED_BY_AGENT";
    });
    const totalVolume = all.reduce((s, t) => s + (t.amount || 0), 0);
    const completedVolume = completed.reduce((s, t) => s + (t.amount || 0), 0);
    const completionRate = all.length ? ((completed.length / all.length) * 100).toFixed(2) : "0.00";
    const avg = all.length ? totalVolume / all.length : 0;
    const piVolume = payIns.reduce((s, t) => s + (t.amount || 0), 0);
    const poVolume = payOuts.reduce((s, t) => s + (t.amount || 0), 0);
    return { all, completed, totalVolume, completedVolume, completionRate, avg, piVolume, poVolume };
  }, [payIns, payOuts]);
  const agentPerformanceRows: AgentPerformanceRow[] = useMemo(() => {
    const all = [...payIns, ...payOuts];
    const grouped = new Map<
      string,
      {
        agentId: string | null;
        totalTransactions: number;
        totalAmount: number;
        completedAmount: number;
        completedCount: number;
        processingSecondsTotal: number;
        processingSamples: number;
      }
    >();
    for (const t of all) {
      let key = (t.assignedAgentName ?? t.assignedToLabel ?? "").trim();
      if (!key || key === "—") {
        if (t.assignedAgentId) key = `Agent #${t.assignedAgentId}`;
        else continue;
      }
      const lower = key.toLowerCase();
      if (lower === "unassigned" || lower === "overall") continue;
      const aid = t.assignedAgentId ? String(t.assignedAgentId) : null;
      const row = grouped.get(key) ?? {
        agentId: aid,
        totalTransactions: 0,
        totalAmount: 0,
        completedAmount: 0,
        completedCount: 0,
        processingSecondsTotal: 0,
        processingSamples: 0,
      };
      if (!row.agentId && aid) row.agentId = aid;
      row.totalTransactions += 1;
      row.totalAmount += t.amount || 0;
      const s = (t.status || "").toUpperCase();
      if (s.includes("APPROVED")) {
        row.completedCount += 1;
        row.completedAmount += t.amount || 0;
      }
      if (typeof t.processingSeconds === "number" && Number.isFinite(t.processingSeconds) && t.processingSeconds > 0) {
        row.processingSecondsTotal += t.processingSeconds;
        row.processingSamples += 1;
      }
      grouped.set(key, row);
    }
    const rows = Array.from(grouped.entries()).map(([agentName, r]) => ({
      agentName,
      agentId: r.agentId,
      totalTransactions: r.totalTransactions,
      totalAmount: inr(r.totalAmount),
      completed: inr(r.completedAmount),
      completionRate: `${r.totalTransactions ? ((r.completedCount / r.totalTransactions) * 100).toFixed(2) : "0.00"}%`,
      avgProcessingTime: r.processingSamples ? formatDuration(Math.round(r.processingSecondsTotal / r.processingSamples)) : "—",
    }));
    return rows;
  }, [payIns, payOuts]);
  const summaryCards: TransactionSummaryCard[] = [
    { title: "Total Transactions", value: String(totals.all.length), accent: "blue", icon: <span /> },
    { title: "PayIn Transactions", value: String(payIns.length), accent: "green", icon: <span /> },
    { title: "PayOut Transactions", value: String(payOuts.length), accent: "warning", icon: <span /> },
    { title: "Avg. Completion Rate", value: `${totals.completionRate}%`, accent: "teal", icon: <span /> },
  ];

  const statBlocks: TransactionStatBlock[] = [
    {
      title: "Pay-In Statistics",
      rows: [
        { label: "Total Transactions", value: String(payIns.length) },
        { label: "Total Volume", value: inr(totals.piVolume) },
        {
          label: "Completion Rate",
          value: `${(
            payIns.length
              ? (payIns.filter((t) => t.status.toUpperCase().includes("APPROVED")).length / payIns.length) * 100
              : 0
          ).toFixed(2)}%`,
        },
        { label: "Average Transaction", value: inr(payIns.length ? totals.piVolume / payIns.length : 0) },
        { label: "Average Processing Time", value: averageProcessingLabel(payIns) },
      ],
    },
    {
      title: "Pay-Out Statistics",
      rows: [
        { label: "Total Transactions", value: String(payOuts.length) },
        { label: "Total Volume", value: inr(totals.poVolume) },
        {
          label: "Completion Rate",
          value: `${(
            payOuts.length
              ? (payOuts.filter((t) => t.status.toUpperCase().includes("APPROVED")).length / payOuts.length) * 100
              : 0
          ).toFixed(2)}%`,
        },
        { label: "Average Transaction", value: inr(payOuts.length ? totals.poVolume / payOuts.length : 0) },
        { label: "Average Processing Time", value: averageProcessingLabel(payOuts) },
        ],
    },
  ];
  const statusDistributionRows = aggregateByStatus(payIns, payOuts);

  if (role === "admin" && !permissionsLoading && !can("view_reports")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Access Denied</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
          You do not have permission to view Transaction Reports. Please contact your system administrator if you believe this is in error.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-gray-900 dark:text-white">
        <TransactionReportIcon />
        <h1 className="text-xl font-bold">Transaction Report</h1>
        <div className="w-full sm:w-1/2 md:w-1/3 lg:w-1/4 ml-auto flex items-center justify-end">
          <DateRangePicker
            value={dateRange}
            onChange={(r) => setDateRange(r)}
          />
        </div>
      </div>
      {/* <p className="text-xs text-purple-600 dark:text-purple-400">
        {role === "admin" ? "Live admin-wide data" : "Live company-only data"}
      </p> */}

      {loading && <div className="text-sm text-gray-500">Loading report data...</div>}
      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</div>}
      <TransactionSummaryCards cards={summaryCards} />
      <TransactionStatisticsPanels blocks={statBlocks} />
      {role === "admin" && <AgentPerformanceTable rows={agentPerformanceRows} />}
      <TransactionStatusDistributionTable rows={statusDistributionRows} />
    </div>
  );
}