"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getSocket } from "@/lib/socket";
import Badge from "@/components/ui/badge/Badge";

// Dynamic import for Leaflet map for customer
const CustomerTrackMap = dynamic(() => import("@/components/user/tracking/CustomerTrackMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center animate-pulse text-gray-400 font-bold tracking-widest text-xs uppercase">🛰️ Connecting to Kadi Satellites...</div>,
});

export default function OrderTrackingPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [riderPos, setRiderPos] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveLog, setLiveLog] = useState<string[]>([]);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/ride-requests/${id}`);
      if (!res.ok) {
        router.push("/user/orders");
        return;
      }
      const data = await res.json();
      setOrder(data);
      setLoading(false);
    } catch (err) {
      console.error("Order fetch error:", err);
    }
  }, [id, router]);

  useEffect(() => {
    fetchOrder();

    const socket = getSocket();
    
    // Listen for rider movement
    socket.on("rider-moved", (data) => {
      if (order?.riderId && data.riderId === order.riderId) {
        setRiderPos({ lat: data.lat, lng: data.lng });
      }
    });

    // Listen for status changes
    socket.on("notification", (data) => {
      if (data.orderId === parseInt(id as string)) {
        console.log("🔔 Live Update:", data.type);
        setLiveLog(prev => [`System: ${data.message || data.type}`, ...prev].slice(0, 3));
        fetchOrder();
      }
    });

    return () => {
      socket.off("rider-moved");
      socket.off("notification");
    };
  }, [id, order?.riderId, fetchOrder]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 gap-4">
       <div className="h-12 w-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
       <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Hydrating Mission Data...</p>
    </div>
  );

  const steps = [
    { label: "Booked", status: ["Pending"] },
    { label: "Assigned", status: ["Accepted", "Arrived"] },
    { label: "On Route", status: ["Started"] },
    { label: "Arrived", status: ["Delivered"] }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col overflow-hidden">
      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 p-4 sticky top-0 z-[1001] shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="h-10 w-10 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 transition-all font-bold">←</button>
            <div>
              <h1 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tighter italic">Kadi Mission #ORD-{id}</h1>
              <div className="flex items-center gap-2">
                 <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                 <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">{order?.status} ACTIVE</p>
              </div>
            </div>
          </div>
          <Badge color={order?.status === "Started" || order?.status === "Delivered" ? "success" : "info"}>
             {order?.status}
          </Badge>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col lg:flex-row">
        {/* ── MAP ───────────────────────────────────────────── */}
        <div className="flex-1 relative h-[50vh] lg:h-auto min-h-[400px]">
          <CustomerTrackMap 
            riderPos={riderPos} 
            pickup={[order?.pickupLat, order?.pickupLng]} 
            drop={[order?.dropLat, order?.dropLng]} 
            status={order?.status}
          />
          
          {/* Real-time Status Log Overlay */}
          {liveLog.length > 0 && (
            <div className="absolute bottom-4 left-4 z-[999] space-y-2 pointer-events-none">
               {liveLog.map((log, i) => (
                 <div key={i} className="bg-gray-900/90 text-white text-[10px] font-bold px-4 py-2 rounded-xl backdrop-blur border border-white/10 animate-fade-in-up">
                    {log}
                 </div>
               ))}
            </div>
          )}
        </div>

        {/* ── CONTROL PANEL ─────────────────────────────────── */}
        <div className="w-full lg:w-[450px] bg-white dark:bg-gray-900 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-800 shadow-2xl z-[1002] flex flex-col justify-between">
          <div className="p-8 space-y-8 overflow-y-auto">
            {/* Status Stepper */}
            <div className="flex justify-between items-center px-2 relative">
               <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-100 dark:bg-gray-800 -translate-y-1/2 z-0"></div>
               {steps.map((step, i) => {
                 const isCompleted = steps.slice(0, i + 1).some(s => s.status.includes(order.status)) || order.status === "Delivered";
                 return (
                   <div key={i} className="relative z-10 flex flex-col items-center gap-2">
                      <div className={`h-6 w-6 rounded-full border-4 ${isCompleted ? 'bg-brand-500 border-brand-100' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-800'} transition-all duration-500 shadow-sm`}></div>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${isCompleted ? 'text-brand-600' : 'text-gray-400'}`}>{step.label}</span>
                   </div>
                 );
               })}
            </div>

            {/* Rider Identity */}
            <div className="bg-gray-50 dark:bg-white/5 rounded-[32px] p-6 border border-gray-100 dark:border-white/5 shadow-inner">
               <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                     <div className="h-16 w-16 bg-brand-500 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-brand-500/30 transform -rotate-3">
                        {order?.rider?.name?.charAt(0) || "K"}
                     </div>
                     <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">Assigned Unit</p>
                        <p className="text-xl font-black text-gray-800 dark:text-white capitalize leading-none">{order?.rider?.name || "Kadi Unit #" + order.id}</p>
                     </div>
                  </div>
                  <div className="flex gap-2">
                     <a href={`tel:${order?.rider?.phone}`} className="h-12 w-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-green-500 rounded-2xl flex items-center justify-center shadow-sm hover:scale-105 transition-all text-xl">📞</a>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200/50 dark:border-gray-800/50">
                     <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Security OTP</p>
                     <p className="text-2xl font-black text-brand-600 tracking-[0.2em]">{order?.otp || "----"}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200/50 dark:border-gray-800/50">
                     <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Fare</p>
                     <p className="text-2xl font-black text-gray-800 dark:text-white leading-none">₹{order?.amount || "---"}</p>
                     <p className="text-[10px] text-gray-500 font-medium mt-1">{order?.paymentMode}</p>
                  </div>
               </div>
            </div>

            {/* Route Summary */}
            <div className="space-y-4">
               <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Route Intelligence</h3>
               <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100 dark:before:bg-gray-800">
                  <div className="relative">
                     <div className="absolute -left-[2.1rem] top-1/2 -translate-y-1/2 bg-white dark:bg-gray-950 p-1 rounded-full"><div className="h-4 w-4 bg-green-500 rounded-full border-4 border-green-100 dark:border-green-900/50"></div></div>
                     <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Pickup Link</p>
                     <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 line-clamp-1">{order?.pickupLoc}</p>
                  </div>
                  <div className="relative">
                     <div className="absolute -left-[2.1rem] top-1/2 -translate-y-1/2 bg-white dark:bg-gray-950 p-1 rounded-full"><div className="h-4 w-4 bg-brand-500 rounded-full border-4 border-brand-100 dark:border-brand-900/50"></div></div>
                     <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Destination Node</p>
                     <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 line-clamp-1">{order?.dropLoc}</p>
                  </div>
               </div>
            </div>
          </div>

          <div className="p-6 bg-gray-50 dark:bg-white/5 border-t border-gray-200 dark:border-gray-800">
             <button className="w-full h-14 bg-gray-800 dark:bg-white text-white dark:text-gray-950 font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-gray-200 dark:shadow-none hover:translate-y-[-2px] active:translate-y-[0px] transition-all text-xs">
                Need Help? Support Active
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
