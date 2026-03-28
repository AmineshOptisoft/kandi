"use client";

import React, { useState, useEffect, useCallback } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "@/components/ui/badge/Badge";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import { getSocket } from "@/lib/socket";

export default function OrdersList() {
  const [orders, setOrders] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // For Assignment Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [assignData, setAssignData] = useState({ riderId: "", vehicleId: "" });
  const [submitting, setSubmitting] = useState(false);

  // Live Rider Data from Socket
  const [riderStatusMap, setRiderStatusMap] = useState<Record<number, any>>({});

  useEffect(() => {
    const socket = getSocket();
    socket.on("rider-moved", (data) => {
      setRiderStatusMap((prev) => ({ ...prev, [data.riderId]: data }));
    });
    return () => { socket.off("rider-moved"); };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [oRes, rRes, vRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/riders"),
        fetch("/api/vehicles"),
      ]);
      if (oRes.ok) setOrders(await oRes.json());
      if (rRes.ok) setRiders(await rRes.json());
      if (vRes.ok) setVehicles(await vRes.json());
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle auto-selection of pinned vehicle
  useEffect(() => {
    if (assignData.riderId) {
      const selectedRider = riders.find((r: any) => r.id.toString() === assignData.riderId);
      if (selectedRider?.assignedVehicleId) {
        setAssignData(prev => ({ ...prev, vehicleId: selectedRider.assignedVehicleId.toString() }));
      }
    }
  }, [assignData.riderId, riders]);

  const freeRiders = riders.filter((r: any) => r.currentState === "Free" || r.status === "active");

  const getRelevantVehicles = () => {
    const baseAvail = vehicles.filter((v: any) => v.status === "available");
    if (!assignData.riderId) return baseAvail;
    
    const selectedRider = riders.find((r: any) => r.id.toString() === assignData.riderId);
    if (selectedRider?.assignedVehicleId) {
      const pinned = vehicles.find((v: any) => v.id === selectedRider.assignedVehicleId);
      if (pinned && !baseAvail.find(v => v.id === pinned.id)) {
        return [pinned, ...baseAvail];
      }
    }
    return baseAvail;
  };

  const availableVehicles = getRelevantVehicles();

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ride-requests/${selectedOrder.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assignData),
      });
      if (res.ok) {
        setAssignModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading orders...</div>;

  return (
    <div className="space-y-6">
      <ComponentCard title="Pending Ride Requests">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pickup</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {orders.filter(o => o.status === "Pending").map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 text-sm">#ORD-{order.id}</td>
                  <td className="px-6 py-4 text-sm">{order.customer?.firstName}</td>
                  <td className="px-6 py-4 text-sm truncate max-w-[150px]">{order.pickupLoc}</td>
                  <td className="px-6 py-4"><Badge color="warning">{order.status}</Badge></td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => {
                        setSelectedOrder(order);
                        setAssignModalOpen(true);
                        setAssignData({ riderId: "", vehicleId: "" });
                      }}
                      className="text-brand-500 font-bold hover:underline"
                    >
                      Assign Rider
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ComponentCard>

      {/* Assignment Modal */}
      <Modal isOpen={assignModalOpen} onClose={() => setAssignModalOpen(false)} title="Assign Trip">
        <form onSubmit={handleAssign} className="space-y-4">
          <div>
            <Label>Select Rider</Label>
            <select
              value={assignData.riderId}
              onChange={(e) => setAssignData({ ...assignData, riderId: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700"
              required
            >
              <option value="">Choose a rider...</option>
              {freeRiders.map((r: any) => {
                const live = riderStatusMap[r.id];
                return (
                  <option key={r.id} value={r.id}>
                    {r.name} {live?.area ? `📍 (${live.area})` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <Label>Select Vehicle</Label>
            <select
              value={assignData.vehicleId}
              onChange={(e) => setAssignData({ ...assignData, vehicleId: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700"
              required
            >
              <option value="">Choose a vehicle...</option>
              {availableVehicles.map((v: any) => (
                <option key={v.id} value={v.id}>{v.regNumber} - {v.model}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 bg-brand-500 text-white rounded-lg font-bold"
          >
            {submitting ? "Assigning..." : "Assign Trip"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
