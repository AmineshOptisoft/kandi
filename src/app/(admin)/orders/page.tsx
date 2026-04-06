"use client";

import React, { useState, useEffect, useCallback } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "@/components/ui/badge/Badge";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import { getSocket } from "@/lib/socket";

import { ORDER_STATUS, ORDER_STATUS_LABELS, RIDER_STATUS, VEHICLE_STATUS } from "@/lib/constants";

export default function OrdersList() {
  const [orders, setOrders] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<"Pending" | "Active" | "Completed" | "Cancelled" | "All">("Pending");

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
      const selectedRider = riders.find((r: any) => r.id?.toString() === assignData.riderId);
      if (selectedRider?.assignedVehicleId) {
        setAssignData(prev => ({ ...prev, vehicleId: selectedRider.assignedVehicleId?.toString() }));
      }
    }
  }, [assignData.riderId, riders]);

  const freeRiders = riders.filter((r: any) => r.status === RIDER_STATUS.ACTIVE);

  const getRelevantVehicles = () => {
    const baseAvail = vehicles.filter((v: any) => v.status === VEHICLE_STATUS.AVAILABLE);
    if (!assignData.riderId) return baseAvail;

    const selectedRider = riders.find((r: any) => r.id?.toString() === assignData.riderId);
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

  const filteredOrders = orders.filter(o => {
    if (filterTab === "Pending") return o.status === ORDER_STATUS.PENDING;
    if (filterTab === "Active") return [ORDER_STATUS.ACCEPTED, ORDER_STATUS.ARRIVED, ORDER_STATUS.STARTED].includes(o.status);
    if (filterTab === "Completed") return o.status === ORDER_STATUS.DELIVERED;
    if (filterTab === "Cancelled") return o.status === ORDER_STATUS.CANCELED;
    return true; // "All"
  });

  return (
    <div className="space-y-6">
      <ComponentCard title="Ride Requests">
        <div className="mb-4 flex flex-wrap gap-2 px-1">
          {["Pending", "Active", "Completed", "Cancelled", "All"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab as any)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filterTab === tab
                  ? "bg-brand-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
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
              {filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 text-sm">#ORD-{order.id}</td>
                  <td className="px-6 py-4 text-sm">{order.customer?.firstName}</td>
                  <td className="px-6 py-4 text-sm truncate max-w-[150px]">{order.pickupLoc}</td>
                  <td className="px-6 py-4">
                    <Badge color={
                      order.status === ORDER_STATUS.DELIVERED ? "success" : 
                      order.status === ORDER_STATUS.PENDING ? "warning" : 
                      [ORDER_STATUS.ACCEPTED, ORDER_STATUS.ARRIVED, ORDER_STATUS.STARTED].includes(order.status) ? "info" : "error"
                    }>
                      {ORDER_STATUS_LABELS[order.status] || order.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    {order.status === ORDER_STATUS.PENDING ? (
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
                    ) : (
                      <span className="text-gray-400 text-sm italic">
                        {order.rider?.name || 'N/A'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400 italic text-sm">
                    No orders found in {filterTab} status.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ComponentCard>

      {/* Assignment Modal */}
      <Modal isOpen={assignModalOpen} onClose={() => setAssignModalOpen(false)}>
        <form onSubmit={handleAssign} className="space-y-4 p-4">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">Assign Trip</h3>
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
