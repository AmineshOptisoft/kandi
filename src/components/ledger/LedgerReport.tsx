"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../ui/table";
import DateRangePicker, { type DateRange } from "../dashboard/DateRangePicker";
import { LedgerIcon } from "@/icons/nav-icons";
interface LedgerEntry {
  date: string;
  debit: number;
  credit: number;
  balance: number;
  narrative: string;
}

interface LedgerAccount {
  agentId: number;
  name: string;
  openingBalance: number;
  closingBalance: number;
  security: number;
  credit: number;
  payIn: number;
  payOut: number;
  net: number;
  final: number;
  remaining: number;
  entries: LedgerEntry[];
}
interface AgentOption {
  id: number;
  name: string;
}

function startOfLocalDay(d = new Date()) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function defaultLedgerDateRange(): DateRange {
  const day = startOfLocalDay();
  return { from: day, to: day, label: "Today" };
}

export default function LedgerReport() {
  const { can, loading: permLoading } = useAdminPermissions();
  const [dateRange, setDateRange] = useState<DateRange>(() => defaultLedgerDateRange());
  const [selectedAgentId, setSelectedAgentId] = useState<number | "ALL">("ALL");
  const [openAgentId, setOpenAgentId] = useState<number | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fmtAmount = useCallback((v: number) => {
    return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, []);

  const fmtDate = useCallback((iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN");
  }, []);

  const { loading: authLoading } = useAuth();

  const fetchLedger = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    setLoadError(null);
    try {
      const qs = new URLSearchParams();
      if (dateRange.from) qs.set("from", dateRange.from.toISOString());
      if (dateRange.to) qs.set("to", dateRange.to.toISOString());
      if (selectedAgentId !== "ALL") qs.set("agentId", String(selectedAgentId));
      const res = await fetch(`/api/admin/ledger?${qs.toString()}`, { credentials: "include" });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        agents?: AgentOption[];
        accounts?: LedgerAccount[];
      };
      if (!res.ok || !data.ok || !data.accounts || !data.agents) {
        setLoadError(data.error ?? "Could not load ledger.");
        setAccounts([]);
        setAgents([]);
        return;
      }
      const accounts = data.accounts;
      const agentsList = data.agents;
      setAccounts(accounts);
      setAgents(agentsList);
      setOpenAgentId((prev) => prev ?? accounts[0]?.agentId ?? null);
    } catch {
      setLoadError("Network error.");
      setAccounts([]);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to, selectedAgentId, authLoading]);

  useEffect(() => {
    void fetchLedger();
  }, [fetchLedger]);

  if (permLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-gray-500">Checking permissions...</div>
      </div>
    );
  }

  if (!can("view_ledger")) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Access Denied</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">You do not have permission to view ledger reports.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white">
          <LedgerIcon />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Ledger Report</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <button
            onClick={() => void fetchLedger()}
            className="inline-flex h-10 items-center rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white shadow-theme-xs transition-colors hover:bg-brand-600 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-white/3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Filter</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{accounts.length} records found</p>
          </div>
          <select
            value={selectedAgentId === "ALL" ? "ALL" : String(selectedAgentId)}
            onChange={(e) => setSelectedAgentId(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
            className="h-10 min-w-[180px] rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/3 dark:text-gray-200"
          >
            <option value="ALL">All Agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
          {loadError}
        </div>
      )}

      {accounts.map((account) => (
        <div
          key={account.agentId}
          className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3"
        >
          <button
            type="button"
            onClick={() => setOpenAgentId((prev) => (prev === account.agentId ? null : account.agentId))}
            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
              openAgentId === account.agentId
                ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-700"
                : "bg-transparent text-brand-700 hover:bg-brand-50 dark:text-brand-700 dark:hover:bg-brand-50/15"
            }`}
          >
            <div>
              <h3 className="text-sm font-semibold">{account.name}</h3>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                From {dateRange.from?.toLocaleDateString("en-IN") ?? "—"} to {dateRange.to?.toLocaleDateString("en-IN") ?? "—"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Opening{" "}
                <span className="font-semibold text-gray-700 dark:text-gray-200">{fmtAmount(account.openingBalance)}</span>
              </p>
              <svg
                className={`h-4 w-4 shrink-0 transition-transform duration-300 ${openAgentId === account.agentId ? "rotate-180" : ""
                  }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          <div
            className={`grid transition-all duration-300 ease-in-out ${openAgentId === account.agentId ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"
              }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
                <div className="rounded-lg bg-gray-50 px-2 py-1.5 text-xs dark:bg-gray-800/60"><span className="text-gray-500">Security</span><div className="font-semibold">{fmtAmount(account.security)}</div></div>
                <div className="rounded-lg bg-gray-50 px-2 py-1.5 text-xs dark:bg-gray-800/60"><span className="text-gray-500">PayIn</span><div className="font-semibold">{fmtAmount(account.payIn)}</div></div>
                <div className="rounded-lg bg-gray-50 px-2 py-1.5 text-xs dark:bg-gray-800/60"><span className="text-gray-500">PayOut</span><div className="font-semibold">{fmtAmount(account.payOut)}</div></div>
                <div className="rounded-lg bg-gray-50 px-2 py-1.5 text-xs dark:bg-gray-800/60"><span className="text-gray-500">Net</span><div className="font-semibold">{fmtAmount(account.net)}</div></div>
                <div className="rounded-lg bg-gray-50 px-2 py-1.5 text-xs dark:bg-gray-800/60"><span className="text-gray-500">Opening</span><div className="font-semibold">{fmtAmount(account.openingBalance)}</div></div>
                <div className="rounded-lg bg-gray-50 px-2 py-1.5 text-xs dark:bg-gray-800/60"><span className="text-gray-500">Running</span><div className="font-semibold">{fmtAmount(account.closingBalance)}</div></div>
                <div className="rounded-lg bg-gray-50 px-2 py-1.5 text-xs dark:bg-gray-800/60"><span className="text-gray-500">Final</span><div className="font-semibold">{fmtAmount(account.final)}</div></div>
                <div className="rounded-lg bg-gray-50 px-2 py-1.5 text-xs dark:bg-gray-800/60"><span className="text-gray-500">Remaining</span><div className="font-semibold">{fmtAmount(account.remaining)}</div></div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                <Table>
                  <TableHeader className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/2">
                    <TableRow>
                      <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400">Date</TableCell>
                      <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400">Debit (Rs.)</TableCell>
                      <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400">Credit (Rs.)</TableCell>
                      <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400">Balance (Rs.)</TableCell>
                      <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400">Short Narrative</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {account.entries.length ? (
                      account.entries.map((entry, entryIndex) => (
                        <TableRow key={`${entry.date}-${entryIndex}`} className="hover:bg-gray-50/60 dark:hover:bg-white/2">
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{fmtDate(entry.date)}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{entry.debit ? fmtAmount(entry.debit) : "-"}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{entry.credit ? fmtAmount(entry.credit) : "-"}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{fmtAmount(entry.balance)}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{entry.narrative}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell className="px-4 py-6 text-sm text-gray-400">No ledger entries found.</TableCell>
                        <TableCell className="px-4 py-6 text-sm text-gray-400">-</TableCell>
                        <TableCell className="px-4 py-6 text-sm text-gray-400">-</TableCell>
                        <TableCell className="px-4 py-6 text-sm text-gray-400">-</TableCell>
                        <TableCell className="px-4 py-6 text-sm text-gray-400">-</TableCell>
                      </TableRow>
                    )}
                    <TableRow className="bg-gray-50/80 dark:bg-white/2">
                      <TableCell className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Total</TableCell>
                      <TableCell className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
                        {fmtAmount(account.entries.reduce((sum, row) => sum + row.debit, 0))}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
                        {fmtAmount(account.entries.reduce((sum, row) => sum + row.credit, 0))}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-500 dark:text-gray-300">-</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-500 dark:text-gray-300">-</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <p className="mt-3 text-right text-xs text-gray-500 dark:text-gray-400">
                Running <span className="font-semibold text-gray-700 dark:text-gray-200">{fmtAmount(account.closingBalance)}</span>
              </p>
            </div>
          </div>
        </div>
      ))}
      {!loading && accounts.length === 0 && !loadError && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400 dark:border-gray-800 dark:bg-white/3">
          No ledger records found for selected filters.
        </div>
      )}
    </div>
  );
}
