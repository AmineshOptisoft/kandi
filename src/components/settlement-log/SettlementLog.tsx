"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ListIcon } from "@/icons";
import { Modal } from "../ui/modal";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../ui/table";
import { SettlementLogIcon } from "@/icons/nav-icons";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";

type PartyType = "AGENT" | "COMPANY";

type SettlementItem = {
  id: string;
  partyType: PartyType;
  partyId: number;
  partyName: string;
  amount: number;
  remark: string;
  settlementDate: string;
  periodFrom: string;
  periodTo: string;
  payInCommission: number;
  payOutCommission: number;
  referralCommission: number;
  finalSettlementAmount: number;
  settlementStatus: string;
  settlementType: string;
  commissionHead: string;
  transactionType: string;
  displayType: string;
  settlementFrequency: string;
  payInVolume: number;
  payOutVolume: number;
};

type PartyOption = { id: string; label: string };

const fmt = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const labelCls =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";
const inputCls =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";

function todayInputDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function SettlementLog() {
  const { can, loading: permLoading } = useAdminPermissions();
  const { loading: authLoading } = useAuth();
  const [tab, setTab] = useState<PartyType>("AGENT");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [items, setItems] = useState<SettlementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [agents, setAgents] = useState<PartyOption[]>([]);
  const [companies, setCompanies] = useState<PartyOption[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [partyId, setPartyId] = useState("");
  const [partySearch, setPartySearch] = useState("");
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [settlementDate, setSettlementDate] = useState(todayInputDate);
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");
  const [transactionType, setTransactionType] = useState<"DEBIT" | "CREDIT">("DEBIT");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadParties = useCallback(async () => {
    if (authLoading) return;
    try {
      const [ar, cr] = await Promise.all([
        fetch("/api/agents", { credentials: "include" }),
        fetch("/api/companies", { credentials: "include" }),
      ]);
      const ad = (await ar.json()) as { ok?: boolean; agents?: Array<{ id: string; fullname?: string; username: string }> };
      const cd = (await cr.json()) as {
        ok?: boolean;
        companies?: Array<{ id: string; brand_name?: string; username: string }>;
      };
      if (ad.ok && ad.agents) {
        setAgents(
          ad.agents.map((a) => ({
            id: a.id,
            label: (a.fullname && a.fullname.trim()) || a.username,
          })),
        );
      }
      if (cd.ok && cd.companies) {
        setCompanies(
          cd.companies.map((c) => ({
            id: c.id,
            label: (c.brand_name && c.brand_name.trim()) || c.username,
          })),
        );
      }
    } catch {
      /* optional */
    }
  }, [authLoading]);

  const loadSettlements = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    setLoadError(null);
    try {
      const q = new URLSearchParams();
      q.set("partyType", tab);
      if (statusFilter) q.set("status", statusFilter);
      if (from) q.set("from", new Date(from).toISOString());
      if (to) q.set("to", new Date(to + "T23:59:59").toISOString());
      const res = await fetch(`/api/admin/settlements?${q}`, { credentials: "include" });
      const data = (await res.json()) as { ok?: boolean; items?: SettlementItem[]; error?: string };
      if (!res.ok || !data.ok) {
        setItems([]);
        setLoadError(data.error ?? "Could not load settlements.");
        return;
      }
      setItems(data.items ?? []);
    } catch {
      setLoadError("Network error.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab, from, to, statusFilter, authLoading]);

  useEffect(() => {
    if (!authLoading) void loadParties();
  }, [loadParties, authLoading]);

  useEffect(() => {
    if (!authLoading) void loadSettlements();
  }, [loadSettlements, authLoading]);

  const partyOptions = tab === "AGENT" ? agents : companies;
  const partyFieldLabel = tab === "AGENT" ? "Subadmin" : "Company";
  const partySearchPlaceholder =
    tab === "AGENT" ? "Search and select subadmin" : "Search and select company";

  const filteredParties = useMemo(() => {
    const q = partySearch.trim().toLowerCase();
    if (!q) return partyOptions;
    return partyOptions.filter((p) => p.label.toLowerCase().includes(q));
  }, [partyOptions, partySearch]);

  const selectedPartyLabel = partyOptions.find((p) => p.id === partyId)?.label ?? "";

  function resetModalForm() {
    setPartyId("");
    setPartySearch("");
    setPartyDropdownOpen(false);
    setSettlementDate(todayInputDate());
    setAmount("");
    setRemark("");
    setTransactionType("DEBIT");
    setFormError(null);
  }

  function openAddModal() {
    resetModalForm();
    setModalOpen(true);
  }

  function selectParty(p: PartyOption) {
    setPartyId(p.id);
    setPartySearch(p.label);
    setPartyDropdownOpen(false);
  }

  async function submitSettlement() {
    if (!partyId) {
      setFormError(`Select a ${partyFieldLabel.toLowerCase()}.`);
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setFormError("Enter a valid settlement amount.");
      return;
    }
    if (!settlementDate) {
      setFormError("Settlement date is required.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const dayStart = new Date(settlementDate);
      const dayEnd = new Date(settlementDate + "T23:59:59");
      const res = await fetch("/api/admin/settlements", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyType: tab,
          partyId: Number(partyId),
          settlementDate,
          periodFrom: dayStart.toISOString(),
          periodTo: dayEnd.toISOString(),
          remark,
          settlementType: "NET",
          commissionHead: "ALL",
          transactionType,
          settlementFrequency: "manual",
          settlementStatus: "settled",
          finalSettlementAmount: amt,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setFormError(data.error ?? "Could not save settlement.");
        return;
      }
      setModalOpen(false);
      resetModalForm();
      await loadSettlements();
    } catch {
      setFormError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (permLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-gray-500">Checking permissions...</div>
      </div>
    );
  }

  if (!can("view_settlements")) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Access Denied</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">You do not have permission to view settlements.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white">
          <ListIcon className="w-6 h-6" />
          <h1 className="text-xl font-bold">Settlement Logs</h1>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Agent and company settlements are recorded separately.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900 w-fit">
        {(["AGENT", "COMPANY"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${tab === t
                ? "bg-white text-gray-900 shadow dark:bg-gray-800 dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
              }`}
          >
            {t === "AGENT" ? "Agent settlements" : "Company settlements"}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-white/3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[140px]">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs dark:border-gray-800 dark:bg-white/3 dark:text-gray-200"
              />
            </div>
            <div className="min-w-[140px]">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs dark:border-gray-800 dark:bg-white/3 dark:text-gray-200"
              />
            </div>
            <div className="min-w-[130px]">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs dark:border-gray-800 dark:bg-white/3 dark:text-gray-200"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="settled">Settled</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
          {can("create_settlements") && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex h-10 items-center rounded-lg bg-brand-500 px-4 text-xs font-semibold text-white hover:bg-brand-600"
            >
              Add Settlement
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
          {loadError}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
            {tab === "AGENT" ? "Agent" : "Company"} records ({loading ? "…" : items.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/2">
              <TableRow>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500">Date</TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500">Party</TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500">Type</TableCell>
                <TableCell isHeader className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500">Amount</TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500">Status</TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500">Remarks</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {!loading && items.length === 0 ? (
                <TableRow>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-500">
                    No settlements yet for {tab === "AGENT" ? "agents" : "companies"}.
                  </td>
                </TableRow>
              ) : (
                items.map((r) => (
                  <TableRow key={r.id} className="hover:bg-gray-50/60 dark:hover:bg-white/2">
                    <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{r.settlementDate}</TableCell>
                    <TableCell className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-gray-100">{r.partyName}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${r.displayType === "Credit"
                          ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                          : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                          }`}
                      >
                        {r.displayType}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-right font-semibold text-gray-800 dark:text-gray-100">
                      {fmt(Math.abs(r.finalSettlementAmount))}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs capitalize text-gray-600">{r.settlementStatus}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-500">{r.remark || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} className="max-w-md">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Settlement</h2>

          <div className="mt-5 space-y-4">
            <div className="relative">
              <label className={labelCls}>{partyFieldLabel}</label>
              <input
                type="text"
                value={partySearch}
                placeholder={partySearchPlaceholder}
                onChange={(e) => {
                  setPartySearch(e.target.value);
                  setPartyId("");
                  setPartyDropdownOpen(true);
                }}
                onFocus={() => setPartyDropdownOpen(true)}
                className={inputCls}
                autoComplete="off"
              />
              {partyDropdownOpen && filteredParties.length > 0 && (
                <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  {filteredParties.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${partyId === p.id ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300" : "text-gray-800 dark:text-gray-200"
                          }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectParty(p);
                        }}
                      >
                        {p.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {partyId && selectedPartyLabel && partySearch !== selectedPartyLabel && (
                <p className="mt-1 text-xs text-gray-500">Selected: {selectedPartyLabel}</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Settlement Date</label>
              <input
                type="date"
                value={settlementDate}
                onChange={(e) => setSettlementDate(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter settlement amount"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Remarks</label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Add any comments or notes"
                rows={3}
                className={`${inputCls} min-h-[88px] resize-y py-2.5`}
              />
            </div>

            <div>
              <span className={labelCls}>Transaction Type</span>
              <div className="flex flex-wrap gap-6 pt-1">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="settlementTxnType"
                    checked={transactionType === "DEBIT"}
                    onChange={() => setTransactionType("DEBIT")}
                    className="h-4 w-4 border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  Debit
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="settlementTxnType"
                    checked={transactionType === "CREDIT"}
                    onChange={() => setTransactionType("CREDIT")}
                    className="h-4 w-4 border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  Credit
                </label>
              </div>
            </div>

            {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitSettlement()}
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit Settlement"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
