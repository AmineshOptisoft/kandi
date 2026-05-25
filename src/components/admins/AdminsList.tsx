"use client";

import React, { useEffect, useState, useCallback } from "react";
import CreateAdminModal from "./CreateAdminModal";
import EditPermissionsModal from "./EditPermissionsModal";
import type { Permission, AdminPermissions } from "@/lib/admin-permissions";
import { ALL_PERMISSIONS } from "@/lib/admin-permissions";

export interface AdminUser {
  adminId: number;
  email: string;
  fullname: string;
  role: "SUPER_ADMIN" | "ADMIN";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  createdAt: string;
  createdBy: number | null;
  creatorEmail: string | null;
  permissions: AdminPermissions;
}

export default function AdminsList() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAdminForPerms, setSelectedAdminForPerms] = useState<AdminUser | null>(null);
  const [editAdmin, setEditAdmin] = useState<AdminUser | null>(null);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/admins");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch admins");
      setAdmins(data.admins || []);
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this administrator?")) return;
    try {
      const res = await fetch(`/api/super-admin/admins/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete admin");
      fetchAdmins();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create, edit, suspend, and configure access permissions for system administrators.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditAdmin(null);
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-all shadow-md shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add New Admin
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Main Grid/Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-transparent text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-4">Name / Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Permissions</th>
                <th className="px-6 py-4">Created By</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm text-gray-700 dark:text-gray-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    Loading administrators...
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    No administrators found.
                  </td>
                </tr>
              ) : (
                admins.map((adm) => (
                  <tr key={adm.adminId} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 dark:text-white">{adm.fullname || "Unnamed Admin"}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{adm.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          adm.role === "SUPER_ADMIN"
                            ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                            : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        }`}
                      >
                        {adm.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          adm.status === "ACTIVE"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                            : adm.status === "SUSPENDED"
                            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {adm.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {adm.role === "SUPER_ADMIN" ? (
                        <span className="text-xs text-purple-500 font-semibold">Full Access (Implicit)</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[280px]">
                          {Object.entries(adm.permissions)
                            .filter(([_, granted]) => granted)
                            .slice(0, 3)
                            .map(([perm]) => (
                              <span
                                key={perm}
                                className="inline-flex rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 text-[10px] font-medium"
                              >
                                {perm.replace("manage_", "").replace("view_", "")}
                              </span>
                            ))}
                          {Object.values(adm.permissions).filter(Boolean).length > 3 && (
                            <span className="inline-flex rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 text-[10px] font-bold">
                              +{Object.values(adm.permissions).filter(Boolean).length - 3} more
                            </span>
                          )}
                          {Object.values(adm.permissions).filter(Boolean).length === 0 && (
                            <span className="text-xs text-gray-400">No permissions</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                      <div>{adm.creatorEmail || "System"}</div>
                      <div className="mt-0.5">{adm.createdAt ? new Date(adm.createdAt).toLocaleDateString() : ""}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {adm.role === "ADMIN" && (
                          <button
                            type="button"
                            onClick={() => setSelectedAdminForPerms(adm)}
                            className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                          >
                            Permissions
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditAdmin(adm);
                            setShowCreateModal(true);
                          }}
                          className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                        >
                          Edit
                        </button>
                        {adm.role === "ADMIN" && (
                          <button
                            type="button"
                            onClick={() => handleDelete(adm.adminId)}
                            className="rounded-lg border border-red-200 dark:border-red-900/40 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <CreateAdminModal
          editAdmin={editAdmin}
          onClose={() => setShowCreateModal(false)}
          onSave={() => {
            setShowCreateModal(false);
            fetchAdmins();
          }}
        />
      )}

      {selectedAdminForPerms && (
        <EditPermissionsModal
          admin={selectedAdminForPerms}
          onClose={() => setSelectedAdminForPerms(null)}
          onSave={() => {
            setSelectedAdminForPerms(null);
            fetchAdmins();
          }}
        />
      )}
    </div>
  );
}
