"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { VendorIcon } from "@/icons/nav-icons";
import CreateAgentModal from "./CreateAgentModal";
import EditAgentModal from "./EditAgentModal";
import Pagination from "../ui/Pagination";
import type { Agent } from "./types";
import DateRangePicker, { DateRange } from "@/components/dashboard/DateRangePicker";
import { appendDateRangeToUrl, daysAgoInputDate, todayInputDate } from "@/lib/date-range";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";

export type { Agent } from "./types";

function statusBadgeClass(s: string) {
  const x = s.toLowerCase();
  if (x === "active") return "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400";
  if (x === "pending") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  if (x === "blocked") return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
  return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
}

function fmtMoney(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

const PAGE_SIZE = 6;

function AgentCard({ agent, onEdit, canEdit }: { agent: Agent; onEdit: () => void; canEdit?: boolean }) {
  const name = agent.fullname || agent.username;
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <span className="text-sm font-bold text-gray-500">{agent.username.slice(0, 1).toUpperCase()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/agent/${agent.id}`} className="truncate text-sm font-bold text-blue-500 hover:underline">
              {agent.username}
            </Link>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClass(agent.status)}`}>
              {agent.status}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{name}</p>
          {agent.email && <p className="truncate text-xs text-gray-400">{agent.email}</p>}
        </div>
        {canEdit !== false && (
          <button type="button" onClick={onEdit} className="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
            Edit
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>Pay-in: {fmtMoney(agent.net_pay_in)}</span>
        <span>Pay-out: {fmtMoney(agent.net_pay_out)}</span>
        <span>Deposit: {fmtMoney(agent.security_deposit)}</span>
      </div>
    </div>
  );
}

function AgentRow({ agent, onEdit, canEdit }: { agent: Agent; onEdit: () => void; canEdit?: boolean }) {
  const name = agent.fullname || agent.username;
  return (
    <div className="flex items-center gap-4 border-b border-gray-100 px-5 py-3.5 transition-colors last:border-0 hover:bg-gray-50/60 dark:border-gray-800 dark:hover:bg-white/[0.02]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
        <span className="text-xs font-bold text-gray-500">{agent.username.slice(0, 1).toUpperCase()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/agent/${agent.id}`} className="text-sm font-semibold text-blue-500 hover:underline">
            {agent.username}
          </Link>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClass(agent.status)}`}>{agent.status}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-400">{name} · Pay-in {fmtMoney(agent.net_pay_in)}</p>
      </div>
      {canEdit !== false && (
        <button type="button" onClick={onEdit} className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold dark:border-gray-700">
          Edit
        </button>
      )}
    </div>
  );
}

export default function AgentList() {
  const { can, loading: permLoading } = useAdminPermissions();
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [periodMetrics, setPeriodMetrics] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      // When no date range selected, send empty strings so backend returns agent table data directly
      const from = dateRange?.from ? dateRange.from.toISOString().slice(0, 10) : "";
      const to = dateRange?.to ? dateRange.to.toISOString().slice(0, 10) : "";
      const res = await fetch(appendDateRangeToUrl("/api/agents", from, to), {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        agents?: Agent[];
        error?: string;
        dateRangeActive?: boolean;
      };
      if (res.status === 401) {
        setLoadError("Admin sign-in required.");
        setAgents([]);
        return;
      }
      if (!res.ok || !data.ok || !data.agents) {
        setLoadError(data.error ?? "Could not load agents.");
        setAgents([]);
        return;
      }
      console.log("agents data", data);
      setAgents(data.agents);
      setPeriodMetrics(Boolean(data.dateRangeActive));
    } catch {
      setLoadError("Network error.");
      setAgents([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = agents.filter(
    (a) =>
      !search ||
      a.username.toLowerCase().includes(search.toLowerCase()) ||
      (a.fullname && a.fullname.toLowerCase().includes(search.toLowerCase())) ||
      (a.email && a.email.toLowerCase().includes(search.toLowerCase())) ||
      (a.referral_code && a.referral_code.toLowerCase().includes(search.toLowerCase())),
  );

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (permLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-gray-500">Checking permissions...</div>
      </div>
    );
  }

  if (!can("view_agents")) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Access Denied</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">You do not have permission to view agents.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <VendorIcon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Vendors</h1>
      </div>

      {/* <DateRangePicker
        value={dateRange}
        onChange={(r) => {
          setDateRange(r);
          setPage(1);
        }}
        fullWidth
      />
      {periodMetrics && (
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
          Pay-in / Pay-out totals show selected date range only.
        </p>
      )} */}

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] px-4 py-3">
        {/* Left: All Agents + count */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">All Vendors</span>
          <span className="inline-flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-bold text-gray-600 dark:text-gray-300">
            {filtered.length}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {can("create_agents") && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
          {searchOpen ? (
            <div className="relative">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                onBlur={() => { if (!search) setSearchOpen(false); }}
                placeholder="Search Vendors..."
                className="w-44 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 pl-9 pr-4 py-2 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="rounded-full border border-gray-200 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 whitespace-nowrap flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-sm">Search Vendors...</span>
            </button>
          )}
          <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-2 ${viewMode === "list" ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-white dark:bg-gray-800"}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-2 ${viewMode === "grid" ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-white dark:bg-gray-800"}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Agents List</h2>
        </div>
        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400 dark:text-gray-500">Data not available</div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
            {paginated.map((a) => (
              <AgentCard key={a.id} agent={a} onEdit={() => setEditAgent(a)} canEdit={can("edit_agents")} />
            ))}
          </div>
        ) : (
          <div>
            {paginated.map((a) => (
              <AgentRow key={a.id} agent={a} onEdit={() => setEditAgent(a)} canEdit={can("edit_agents")} />
            ))}
          </div>
        )}
      </div>

      <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {showCreate && (
        <CreateAgentModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setPage(1);
            await load({ silent: true });
          }}
        />
      )}
      {editAgent && (
        <EditAgentModal
          agent={editAgent}
          onClose={() => setEditAgent(null)}
          onSaved={async () => {
            await load({ silent: true });
          }}
        />
      )}
    </div>
  );
}
