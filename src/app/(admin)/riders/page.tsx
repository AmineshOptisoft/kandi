"use client";
import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import Link from "next/link";

interface Rider {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  assignedVehicleId?: number | null;
  assignedVehicle?: { id: number; regNumber: string; model: string; battery: number } | null;
  _count: { trips: number };
}

export default function RiderList() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Assign vehicle modal state
  const [assignTarget, setAssignTarget] = useState<Rider | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignMsg, setAssignMsg] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rRes, vRes] = await Promise.all([
        fetch("/api/riders"),
        fetch("/api/vehicles"),
      ]);
      if (rRes.ok) setRiders(await rRes.json());
      if (vRes.ok) setVehicles(await vRes.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this rider?")) return;
    try {
      const res = await fetch(`/api/riders/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete rider");
      setRiders((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Assign vehicle to rider
  const handleAssignVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTarget) return;
    setAssignLoading(true); setAssignMsg("");
    try {
      const res = await fetch(`/api/riders/${assignTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedVehicleId: selectedVehicleId ? parseInt(selectedVehicleId) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAssignMsg(data.error || "Failed to assign vehicle"); return; }
      setAssignMsg("✅ Vehicle assigned successfully!");
      await fetchData();
      setTimeout(() => setAssignTarget(null), 1500);
    } catch {
      setAssignMsg("An error occurred.");
    } finally {
      setAssignLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-500">Loading riders...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">Rider Management</h2>
        <Link
          href="/riders/add"
          className="flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          + Add New Rider
        </Link>
      </div>

      {error && <div className="p-4 text-red-600 bg-red-50 rounded-lg">{error}</div>}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[900px]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  {["ID", "Name", "Phone", "Status", "Assigned Vehicle", "Trips", "Actions"].map((h) => (
                    <TableCell key={h} isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {riders.map((rider) => (
                  <TableRow key={rider.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <TableCell className="px-5 py-4 text-start font-medium text-gray-800 text-theme-sm dark:text-white/90">
                      #{rider.id}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start text-gray-800 dark:text-white/90 font-medium">
                      {rider.name}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start text-gray-500 text-theme-sm dark:text-gray-400">
                      {rider.phone}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-start">
                      <Badge size="sm" color={rider.status === "active" ? "success" : "warning"}>
                        {rider.status}
                      </Badge>
                    </TableCell>

                    {/* Assigned Vehicle Column */}
                    <TableCell className="px-5 py-4 text-start">
                      {rider.assignedVehicle ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                            ⚡ {rider.assignedVehicle.regNumber}
                          </span>
                          <span className="text-xs text-gray-400">
                            {rider.assignedVehicle.model} 🔋{rider.assignedVehicle.battery}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Not assigned</span>
                      )}
                    </TableCell>

                    <TableCell className="px-5 py-4 text-start text-gray-500 text-theme-sm dark:text-gray-400">
                      {rider._count?.trips ?? 0}
                    </TableCell>

                    <TableCell className="px-5 py-4 text-end">
                      <div className="flex items-center justify-end gap-2">
                        {/* Assign Vehicle Button */}
                        <button
                          onClick={() => { setAssignTarget(rider); setSelectedVehicleId(rider.assignedVehicleId?.toString() || ""); setAssignMsg(""); }}
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
                        >
                          🚗 Vehicle
                        </button>
                        <Link
                          href={`/riders/${rider.id}/edit`}
                          className="text-brand-500 hover:text-brand-600 text-sm font-medium"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(rider.id)}
                          className="text-red-500 hover:text-red-600 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {riders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="px-5 py-10 text-center text-gray-500">
                      No riders found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          ASSIGN VEHICLE MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {assignTarget && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAssignTarget(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Assign Vehicle</h3>
                  <p className="text-sm text-gray-400 mt-0.5">Rider: {assignTarget.name}</p>
                </div>
                <button onClick={() => setAssignTarget(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">✕</button>
              </div>
            </div>

            <form onSubmit={handleAssignVehicle} className="p-5 space-y-4">
              {assignMsg && (
                <div className={`p-3 text-sm rounded-lg ${assignMsg.startsWith("✅") ? "text-green-600 bg-green-50 dark:bg-green-900/30" : "text-red-600 bg-red-50 dark:bg-red-900/30"}`}>
                  {assignMsg}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Vehicle
                </label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                >
                  <option value="">— Remove Assignment —</option>
                  {vehicles.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.regNumber} — {v.model} 🔋{v.battery}%
                      {v.status !== "available" ? " (in use)" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  This vehicle will be shown as the rider's default vehicle in the Rider App.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setAssignTarget(null)}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 dark:text-white dark:border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignLoading}
                  className="flex-1 py-2.5 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-xl disabled:opacity-40"
                >
                  {assignLoading ? "Saving..." : "Assign Vehicle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
