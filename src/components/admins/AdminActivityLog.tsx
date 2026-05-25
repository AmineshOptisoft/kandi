"use client";

import React, { useEffect, useState, useCallback } from "react";
import Pagination from "../ui/Pagination";

export interface LogEntry {
  id: number;
  adminId: number;
  adminEmail: string;
  adminFullname: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: any;
  ipAddress: string | null;
  createdAt: string;
}

const LIMIT = 15;

export default function AdminActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [adminFilter, setAdminFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * LIMIT;
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(offset),
      });
      if (adminFilter) params.append("admin_id", adminFilter);
      if (actionFilter) params.append("action", actionFilter);

      const res = await fetch(`/api/super-admin/activity-log?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch logs");
      
      setLogs(data.logs || []);
      setHasMore((data.logs || []).length === LIMIT);
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }, [page, adminFilter, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page when filter changes
  const handleFilterChange = () => {
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin Activity Log</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Complete audit history of administrative actions, edits, status updates, and session logins.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Admin User ID (Optional)
          </label>
          <input
            type="number"
            value={adminFilter}
            onChange={(e) => setAdminFilter(e.target.value)}
            placeholder="e.g. 1"
            className="w-40 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Action (Optional)
          </label>
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="e.g. UPDATE_PERMISSIONS"
            className="w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
          />
        </div>

        <button
          type="button"
          onClick={handleFilterChange}
          className="rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          Apply Filters
        </button>
      </div>

      {/* Table view */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-transparent text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Admin</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Target (Type/ID)</th>
                <th className="px-6 py-4">IP Address</th>
                <th className="px-6 py-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs text-gray-700 dark:text-gray-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    Loading logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    No activity records matching search criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {log.adminFullname || "System"}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {log.adminEmail} (ID: {log.adminId})
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 font-bold uppercase text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.targetType ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-gray-500 uppercase">
                            {log.targetType}:
                          </span>
                          <span className="font-mono text-gray-400">{log.targetId}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-gray-400">
                      {log.ipAddress || "Unknown"}
                    </td>
                    <td className="px-6 py-4 max-w-sm">
                      {log.details ? (
                        <pre className="font-mono text-[10px] bg-gray-50 dark:bg-gray-850 p-2 rounded-lg max-h-24 overflow-y-auto overflow-x-auto text-gray-500">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-2">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => p - 1)}
          className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-xs text-gray-400">Page {page}</span>
        <button
          type="button"
          disabled={!hasMore || loading}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
