"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../ui/table";
import Pagination from "../ui/Pagination";
import { CompanyDashboardIcon } from "@/icons/nav-icons";

type SummaryCard = { title: string; value: string; sub: string };
type TxnRow = {
  id: string;
  transactionId: string;
  date: string;
  type: "PAYIN" | "PAYOUT";
  amount: string;
  method: string;
  utr: string;
  status: "EXPIRED" | "APPROVED" | "PENDING";
};

const cards: SummaryCard[] = [
  { title: "Total Payin Operations", value: "0", sub: "Operations" },
  { title: "Total Payout Operations", value: "0", sub: "Operations" },
  { title: "Total Payin", value: "₹0", sub: "Total Amount" },
  { title: "Total PayOut", value: "₹0", sub: "Total Amount" },
  { title: "Success Rate", value: "0%", sub: "Completion Rate" },
];

const statusStyles: Record<string, string> = {
  EXPIRED: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
  APPROVED: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
  PENDING: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300",
};

function toUiStatus(raw: string): TxnRow["status"] {
  const s = raw.toUpperCase();
  if (s.includes("APPROVED")) return "APPROVED";
  if (s.includes("EXPIRED") || s.includes("REJECTED") || s.includes("REVOKED")) return "EXPIRED";
  return "PENDING";
}

function OverviewCard({ card }: { card: SummaryCard }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-white/3">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{card.title}</p>
      <p className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{card.sub}</p>
    </div>
  );
}

export default function CompanyDashboard() {
  const [refreshTick, setRefreshTick] = useState(0);
  const [payIns, setPayIns] = useState<
    {
      id: string;
      orderId: string;
      amount: number;
      status: string;
      createdAtIso?: string;
      assignedUpi?: string;
      utrCode?: string;
    }[]
  >([]);
  const [payOuts, setPayOuts] = useState<
    {
      id: string;
      orderId: string;
      amount: number;
      status: string;
      createdAtIso?: string;
      bankName?: string;
      remarks?: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardStats, setDashboardStats] = useState<{
    totalPayInAmount: number;
    totalPayOutAmount: number;
    successPayInCount: number;
    successPayOutCount: number;
    totalPayInCount: number;
    totalPayOutCount: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useEffect(() => {
    const onRefresh = () => setRefreshTick((t) => t + 1);
    window.addEventListener("tepay:company-dashboard-refresh", onRefresh);
    return () => window.removeEventListener("tepay:company-dashboard-refresh", onRefresh);
  }, []);

  const { loading: authLoading } = useAuth();

  useEffect(() => {
    let mounted = true;
    if (authLoading) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [piRes, poRes, statsRes] = await Promise.all([
          fetch("/api/company/payins?limit=100", { credentials: "include" }),
          fetch("/api/company/payouts?limit=100", { credentials: "include" }),
          fetch("/api/company/dashboard/stats", { credentials: "include" }),
        ]);
        const pi = (await piRes.json()) as {
          ok?: boolean;
          payins?: {
            id: string;
            orderId: string;
            amount: number;
            status: string;
            createdAtIso?: string;
            assignedUpi?: string;
            utrCode?: string;
          }[];
          error?: string;
        };
        const po = (await poRes.json()) as {
          ok?: boolean;
          payouts?: {
            id: string;
            orderId: string;
            amount: number;
            status: string;
            createdAtIso?: string;
            bankName?: string;
            remarks?: string;
          }[];
          error?: string;
        };
        const statsData = (await statsRes.json()) as { ok?: boolean; stats?: any };
        
        if (!mounted) return;
        if (!piRes.ok || !poRes.ok || !pi.ok || !po.ok) {
          setError(pi.error ?? po.error ?? "Could not load dashboard data.");
          return;
        }
        setPayIns(pi.payins ?? []);
        setPayOuts(po.payouts ?? []);
        if (statsData.ok && statsData.stats) {
          setDashboardStats(statsData.stats);
        }
      } catch {
        if (mounted) setError("Network error.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshTick, authLoading]);

  const liveCards = useMemo(() => {
    if (!dashboardStats) return cards;
    const totalOps = dashboardStats.totalPayInCount + dashboardStats.totalPayOutCount;
    const successOps = dashboardStats.successPayInCount + dashboardStats.successPayOutCount;
    const rate = totalOps > 0 ? ((successOps / totalOps) * 100).toFixed(2) : "0.00";
    return [
      { title: "Total Payin Operations", value: String(dashboardStats.totalPayInCount), sub: "Operations" },
      { title: "Total Payout Operations", value: String(dashboardStats.totalPayOutCount), sub: "Operations" },
      { title: "Total Payin", value: `₹${Math.round(dashboardStats.totalPayInAmount).toLocaleString("en-IN")}`, sub: "Total Amount" },
      { title: "Total PayOut", value: `₹${Math.round(dashboardStats.totalPayOutAmount).toLocaleString("en-IN")}`, sub: "Total Amount" },
      { title: "Success Rate", value: `${rate}%`, sub: "Completion Rate" },
    ];
  }, [dashboardStats]);

  const recentRows = useMemo(() => {
    type M = { at: number; row: TxnRow };
    const merged: M[] = [
      ...payIns.map((t) => ({
        at: t.createdAtIso ? new Date(t.createdAtIso).getTime() : 0,
        row: {
          id: t.id,
          transactionId: t.orderId,
          date: t.createdAtIso ? new Date(t.createdAtIso).toLocaleString("en-IN") : "—",
          type: "PAYIN" as const,
          amount: `₹${Math.round(t.amount || 0).toLocaleString("en-IN")}`,
          method: "UPI",
          utr: t.utrCode || "Not Provided",
          status: toUiStatus(t.status),
        },
      })),
      ...payOuts.map((t) => ({
        at: t.createdAtIso ? new Date(t.createdAtIso).getTime() : 0,
        row: {
          id: t.id,
          transactionId: t.orderId,
          date: t.createdAtIso ? new Date(t.createdAtIso).toLocaleString("en-IN") : "—",
          type: "PAYOUT" as const,
          amount: `₹${Math.round(t.amount || 0).toLocaleString("en-IN")}`,
          method: "BANK",
          utr: t.remarks || "Not Provided",
          status: toUiStatus(t.status),
        },
      })),
    ];
    merged.sort((a, b) => b.at - a.at);
    return merged.slice(0, 20).map((m) => m.row);
  }, [payIns, payOuts]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return recentRows;
    return recentRows.filter(
      (r) =>
        r.transactionId.toLowerCase().includes(q) ||
        r.utr.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        r.id.includes(q),
    );
  }, [recentRows, searchQuery]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white">
          <CompanyDashboardIcon />
          <h1 className="text-xl font-bold">Company Dashboard</h1>
        </div>
        <Link href="/company-settings" className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-600 dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-300">
          Payment QR Link
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {liveCards.map((card) => (
          <OverviewCard key={card.title} card={card} />
        ))}
      </div>

      {loading && <div className="text-sm text-gray-500">Loading dashboard data...</div>}
      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</div>}

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Recent Transactions</h3>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order ID, UTR, status…"
            className="h-9 min-w-[230px] rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/3 dark:text-gray-200"
          />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/2">
              <TableRow>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400">Transaction ID</TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400">Date</TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400">Type</TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400">Amount</TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400">Payment Method</TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400">UTR / Ref</TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400">Status</TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400">Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {paginatedRows.length === 0 ? (
                <TableRow>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    No transactions to show.
                  </td>
                </TableRow>
              ) : (
                paginatedRows.map((row) => (
                  <TableRow key={`${row.type}-${row.id}`} className="hover:bg-gray-50/60 dark:hover:bg-white/2">
                    <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{row.transactionId}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{row.date}</TableCell>
                    <TableCell className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">{row.type}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{row.amount}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{row.method}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{row.utr}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles[row.status]}`}>
                        {row.status}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">
                      <Link
                        href={`/company-dashboard/trx/${row.id}`}
                        className="inline-flex rounded-md border border-brand-200 px-2 py-1 text-brand-500 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-900/20"
                        title="View details"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {filteredRows.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-white/[0.02]">
            <p className="text-xs text-gray-400 shrink-0">
              Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filteredRows.length)} of {filteredRows.length} entries
            </p>
            <Pagination
              total={filteredRows.length}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
