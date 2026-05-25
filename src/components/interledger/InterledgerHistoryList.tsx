"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { ListIcon } from "@/icons";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";

type InterledgerItem = {
  id: string;
  transferDate: string;
  sourceAgentId: number;
  sourceAgentName: string;
  destAgentId: number;
  destAgentName: string;
  sourceType: string;
  destType: string;
  amount: number;
  remark: string | null;
  createdAt: string;
};

const fmt = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function formatDt(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function InterledgerHistoryList() {
  const { can, loading: permLoading } = useAdminPermissions();
  const [items, setItems] = useState<InterledgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { loading: authLoading } = useAuth();

  const loadHistory = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/interledger/history", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setItems([]);
        setLoadError(data.error ?? "Could not load interledger history.");
        return;
      }
      setItems(data.items ?? []);
    } catch {
      setLoadError("Network error.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [authLoading]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  if (permLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-gray-500">Checking permissions...</div>
      </div>
    );
  }

  if (!can("add_interledger")) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Access Denied</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">You do not have permission to view interledger history.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white">
          <ListIcon className="w-6 h-6" />
          <h1 className="text-xl font-bold">Interledger History</h1>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          View all fund transfers between agents.
        </p>
      </div>

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
          {loadError}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
        <div className="border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
            Transfer Records ({loading ? "…" : items.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/2">
              <TableRow>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500">Date</TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500">From Agent</TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500">From Account</TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500">To Agent</TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500">To Account</TableCell>
                <TableCell isHeader className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500">Amount</TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500">Remarks</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {!loading && items.length === 0 ? (
                <TableRow>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">
                    No interledger transfers found.
                  </td>
                </TableRow>
              ) : (
                items.map((r) => (
                  <TableRow key={r.id} className="hover:bg-gray-50/60 dark:hover:bg-white/2">
                    <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{formatDateOnly(r.transferDate)}</TableCell>
                    <TableCell className="px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">− {r.sourceAgentName}</TableCell>
                    <TableCell className="px-4 py-3 text-xs capitalize text-gray-600 dark:text-gray-400">{r.sourceType}</TableCell>
                    <TableCell className="px-4 py-3 text-sm font-medium text-green-600 dark:text-green-400">+ {r.destAgentName}</TableCell>
                    <TableCell className="px-4 py-3 text-xs capitalize text-gray-600 dark:text-gray-400">{r.destType}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-right font-semibold text-gray-800 dark:text-gray-100">
                      {fmt(r.amount)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-500">{r.remark || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
