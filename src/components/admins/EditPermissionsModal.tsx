"use client";

import React, { useEffect, useState } from "react";
import type { AdminUser } from "./AdminsList";
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  PERMISSION_DESCRIPTIONS,
  PERMISSION_GROUPS,
  type Permission,
} from "@/lib/admin-permissions";

interface EditPermissionsModalProps {
  admin: AdminUser;
  onClose: () => void;
  onSave: () => void;
}

export default function EditPermissionsModal({ admin, onClose, onSave }: EditPermissionsModalProps) {
  const [permissions, setPermissions] = useState<Record<Permission, boolean>>(() => {
    const initial = {} as Record<Permission, boolean>;
    for (const p of ALL_PERMISSIONS) {
      initial[p] = !!admin.permissions?.[p];
    }
    return initial;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (perm: Permission) => {
    setPermissions((prev) => ({
      ...prev,
      [perm]: !prev[perm],
    }));
  };

  const handleSelectAll = () => {
    const next: Partial<Record<Permission, boolean>> = {};
    for (const p of ALL_PERMISSIONS) {
      next[p] = true;
    }
    setPermissions(next as Record<Permission, boolean>);
  };

  const handleClearAll = () => {
    const next: Partial<Record<Permission, boolean>> = {};
    for (const p of ALL_PERMISSIONS) {
      next[p] = false;
    }
    setPermissions(next as Record<Permission, boolean>);
  };

  const handleToggleGroup = (groupPerms: Permission[], grant: boolean) => {
    setPermissions((prev) => {
      const next = { ...prev };
      for (const p of groupPerms) {
        next[p] = grant;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/super-admin/admins/${admin.adminId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(permissions),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save permissions");
      onSave();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Configure Granular Access Permissions</h2>
            <p className="text-xs text-gray-400 mt-0.5">Admin: {admin.fullname || admin.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20 px-4 py-2.5 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Quick Actions Panel */}
          <div className="flex justify-between items-center bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3 text-xs shrink-0">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Global Actions:</span>
            <div className="flex gap-4 font-semibold">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Grant All Permissions
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-red-600 dark:text-red-400 hover:underline"
              >
                Revoke All Permissions
              </button>
            </div>
          </div>

          {/* Permission Groups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(PERMISSION_GROUPS).map(([groupName, groupPerms]) => {
              const allChecked = groupPerms.every((p) => permissions[p]);
              return (
                <div
                  key={groupName}
                  className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-white/[0.01] p-4 flex flex-col gap-3"
                >
                  {/* Group Header */}
                  <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-2">
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 tracking-wide uppercase">
                      {groupName} Module
                    </span>
                    <div className="flex gap-2 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => handleToggleGroup(groupPerms, true)}
                        className="text-blue-500 hover:underline"
                      >
                        Grant All
                      </button>
                      <span className="text-gray-300">/</span>
                      <button
                        type="button"
                        onClick={() => handleToggleGroup(groupPerms, false)}
                        className="text-red-400 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Group Items */}
                  <div className="flex flex-col gap-2">
                    {groupPerms.map((perm) => (
                      <label
                        key={perm}
                        className={`flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer transition-colors ${permissions[perm]
                            ? "bg-blue-500/5 border-blue-500/20 dark:bg-blue-500/10"
                            : "border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.01]"
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={permissions[perm]}
                          onChange={() => handleToggle(perm)}
                          className="mt-0.5 rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500/20 w-3.5 h-3.5"
                        />
                        <div>
                          <div className="text-[11px] font-semibold text-gray-800 dark:text-gray-200">
                            {PERMISSION_LABELS[perm]}
                          </div>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">
                            {PERMISSION_DESCRIPTIONS[perm]}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </form>

        {/* Modal Footer */}
        <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 bg-gray-50 dark:bg-transparent shrink-0 flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 text-sm font-semibold text-white transition-colors shadow-md disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Permissions"}
          </button>
        </div>
      </div>
    </div>
  );
}
