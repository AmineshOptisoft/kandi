"use client";
import React, { useEffect, useState } from "react";
import ComponentCard from "@/components/common/ComponentCard";
import StatisticsChart from "@/components/ecommerce/StatisticsChart";
import MonthlySalesChart from "@/components/ecommerce/MonthlySalesChart";

export default function Reports() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard-stats")
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => console.error("Report fetch error:", err));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">
             Mission Intelligence & Fleet Analytics
           </h2>
           <p className="text-sm text-gray-400">Deep-dive into operational efficiency and unit performance</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-all shadow-sm">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 11V13H12V11M8 3V9M8 9L5 6M8 9L11 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Export Mission Data (CSV)
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
         <MonthlySalesChart />
         <StatisticsChart />

         <div className="lg:col-span-2">
            <ComponentCard title="Mission Summary KPI (Lifetime)">
               <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="p-6 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                     <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Deliveries</p>
                     <p className="text-3xl font-black text-gray-800 dark:text-white">
                        {loading ? "---" : stats?.completedOrders.toLocaleString()}
                     </p>
                     <div className="flex items-center gap-1 mt-2">
                        <span className="text-xs font-bold text-green-500">Fleet Success</span>
                     </div>
                  </div>
                  <div className="p-6 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                     <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Completion Rate</p>
                     <p className="text-3xl font-black text-gray-800 dark:text-white">
                        {loading ? "---" : stats?.completionRate}%
                     </p>
                     <div className="flex items-center gap-1 mt-2">
                        <span className="text-xs font-bold text-blue-500">Unit Reliability</span>
                     </div>
                  </div>
                  <div className="p-6 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                     <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Cancelled Orders</p>
                     <p className="text-3xl font-black text-gray-800 dark:text-white">
                        {loading ? "---" : stats?.cancelledOrders}
                     </p>
                     <div className="flex items-center gap-1 mt-2">
                        <span className="text-xs font-bold text-orange-400">Signal Dropped</span>
                     </div>
                  </div>
               </div>
            </ComponentCard>
         </div>
      </div>
    </div>
  );
}
