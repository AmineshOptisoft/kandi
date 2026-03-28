"use client";

import React, { useState, useEffect, useCallback } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import Badge from "@/components/ui/badge/Badge";
import { getSocket } from "@/lib/socket";
import dynamic from "next/dynamic";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";

// Dynamic import for Leaflet (client-side only)
const FleetMap = dynamic(() => import("@/components/admin/tracking/FleetMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-gray-50 flex items-center justify-center animate-pulse rounded-xl border border-gray-100">
       <span className="text-sm font-medium text-gray-400">Loading Fleet Map...</span>
    </div>
  ),
});

export default function Tracking() {
  const [liveRiders, setLiveRiders] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);

  // Assignment Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [assignData, setAssignData] = useState({ riderId: "", vehicleId: "" });
  const [submitting, setSubmitting] = useState(false);

  // Fetch all initial data
  const fetchData = useCallback(async () => {
    try {
      const [rRes, oRes, vRes] = await Promise.all([
        fetch("/api/riders/live-status"),
        fetch("/api/orders"),
        fetch("/api/vehicles")
      ]);
      
      if (rRes.ok) setLiveRiders(await rRes.json());
      if (oRes.ok) {
        const allOrders = await oRes.json();
        setPendingOrders(allOrders.filter((o: any) => o.status === "Pending"));
      }
      if (vRes.ok) setVehicles(await vRes.json());
    } catch (err) {
      console.error("Fetch initial data error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const socket = getSocket();
    
    socket.on("rider-moved", (data) => {
      setLiveRiders((prev) => {
        const index = prev.findIndex((r) => r.riderId === data.riderId);
        const enriched = { ...data, lastSeen: Date.now() };
        if (index > -1) {
          const newRiders = [...prev];
          newRiders[index] = { ...newRiders[index], ...enriched };
          return newRiders;
        }
        return [...prev, enriched];
      });
    });

    socket.on("new-booking", (booking) => {
      setPendingOrders(prev => [booking, ...prev]);
    });

    return () => {
      socket.off("rider-moved");
      socket.off("new-booking");
    };
  }, [fetchData]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !assignData.riderId || !assignData.vehicleId) return;
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
      console.error("Assignment error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header - Consistent with Riders/Customers pages */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">Fleet Tracking</h2>
           <p className="text-sm text-gray-500 font-medium">{liveRiders.length} Active Modules Connected</p>
        </div>
        <div className="flex items-center gap-3">
           <Badge color="success">System Online</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* LIVE MAP */}
        <div className="lg:col-span-3">
           <div className="relative h-[650px] w-full bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-white/[0.05] shadow-sm">
              <FleetMap riders={liveRiders} />
              
              {/* Legend HUD */}
              <div className="absolute bottom-6 left-6 z-[1000] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg">
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Map Legend</p>
                 <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                       <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
                       <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Available</span>
                    </div>
                    <div className="flex items-center gap-3">
                       <span className="h-2.5 w-2.5 rounded-full bg-orange-500"></span>
                       <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Busy / Trip</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* STATUS PANEL */}
        <div className="space-y-6">
          <ComponentCard title="Pending Dispatches">
             <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {pendingOrders.length === 0 ? (
                   <div className="py-12 text-center text-gray-400">
                       <p className="text-xs font-medium italic">No pending requests</p>
                   </div>
                ) : (
                  pendingOrders.map(order => (
                    <div key={order.id} className="p-4 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.05] rounded-xl hover:bg-white transition-all shadow-sm">
                       <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-brand-600">ID: #{order.id}</span>
                          <button 
                            onClick={() => {
                               setSelectedOrder(order);
                               setAssignModalOpen(true);
                            }}
                            className="text-[10px] bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg font-bold transition-all"
                          >
                             Assign
                          </button>
                       </div>
                       <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">📍 {order.pickupLoc}</p>
                    </div>
                  ))
                )}
             </div>
          </ComponentCard>

          <ComponentCard title="Active Taskforce">
             <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {liveRiders.length === 0 ? (
                   <div className="py-8 text-center text-gray-400 italic text-xs">Waiting for signals...</div>
                ) : (
                  liveRiders.map((rider) => (
                    <div key={rider.riderId} className="p-3.5 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.05]">
                      <div className="flex items-center justify-between mb-1">
                         <p className="font-bold text-xs text-gray-800 dark:text-white">
                            {rider.name && rider.name !== "Unknown" ? rider.name : `Rider #${rider.riderId}`}
                         </p>
                         <div className={`h-2 w-2 rounded-full ${rider.status === 'free' ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                      </div>
                      <p className="text-[10px] text-gray-500 font-medium truncate">📍 {rider.area || "Scanning..."}</p>
                    </div>
                  ))
                )}
             </div>
          </ComponentCard>
        </div>
      </div>

      {/* Assignment Side-over (Consistency with Admin Theme) */}
      <Modal 
        isOpen={assignModalOpen} 
        onClose={() => setAssignModalOpen(false)}
        position="right"
      >
        <form onSubmit={handleAssign} className="p-6 h-full flex flex-col space-y-6">
          <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
             <h3 className="text-lg font-bold text-gray-900 dark:text-white">Assign Mission</h3>
             <p className="text-xs text-gray-400 mt-0.5">Order ID: #{selectedOrder?.id}</p>
          </div>

          <div className="flex-1 space-y-5">
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
               <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Pickup Location</label>
               <p className="text-sm font-medium text-gray-800 dark:text-white italic">
                  {selectedOrder?.pickupLoc}
               </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Select Rider</label>
              <select
                value={assignData.riderId}
                onChange={(e) => setAssignData({ ...assignData, riderId: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm font-medium"
                required
              >
                <option value="">— Choose Available Rider —</option>
                {liveRiders.filter(r => r.status === 'free').map((r: any) => (
                  <option key={r.riderId} value={r.riderId}>
                    👤 {r.name && r.name !== "Unknown" ? r.name : `Unit #${r.riderId}`} — {r.area || "Signal Locked"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Select EV Vehicle</label>
              <select
                value={assignData.vehicleId}
                onChange={(e) => setAssignData({ ...assignData, vehicleId: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm font-medium"
                required
              >
                <option value="">— Choose Available EV —</option>
                {vehicles.filter(v => v.status === 'available').map((v: any) => (
                  <option key={v.id} value={v.id}>⚡ {v.regNumber} — {v.model}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-5 border-t border-gray-100 dark:border-gray-800 flex gap-3">
            <button
               type="button"
               onClick={() => setAssignModalOpen(false)}
               className="flex-1 py-3 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 dark:text-white dark:border-gray-700"
            >
               Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-sm shadow-sm transition-all disabled:opacity-50"
            >
              {submitting ? "Assigning..." : "Confirm Dispatch"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
