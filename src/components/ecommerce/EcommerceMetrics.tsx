"use client";
import React, { useEffect, useState } from "react";
import Badge from "../ui/badge/Badge";
import { ArrowDownIcon, ArrowUpIcon, BoxIconLine, GroupIcon, TruckIcon } from "@/icons";

interface Stats {
  totalOrders: number;
  activeDeliveries: number;
  completedOrders: number;
  availableRiders: number;
  totalRevenue: number;
  totalCustomers: number;
}

export const EcommerceMetrics = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard-stats")
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => console.error("Stats fetch error:", err));
  }, []);

  if (loading) {
    return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6 animate-pulse">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-32 rounded-2xl bg-gray-100 dark:bg-gray-800" />
      ))}
    </div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
      {/* Total Orders */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <BoxIconLine />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Total Orders</span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {stats?.totalOrders.toLocaleString()}
            </h4>
          </div>
          <Badge color="success">Live</Badge>
        </div>
      </div>

      {/* Active Deliveries */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-blue-50 rounded-xl dark:bg-blue-900/20">
          <span className="text-xl"><TruckIcon /></span>
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">On-Route</span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {stats?.activeDeliveries}
            </h4>
          </div>
          <Badge color="warning">Active</Badge>
        </div>
      </div>

      {/* Completed Orders */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-green-50 rounded-xl dark:bg-green-900/20">
          <ArrowUpIcon className="text-green-600" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Delivered</span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {stats?.completedOrders}
            </h4>
          </div>
          <Badge color="success">Task Complete</Badge>
        </div>
      </div>

      {/* Ready Riders */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <GroupIcon />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Ready Fleet</span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {stats?.availableRiders}
            </h4>
          </div>
          <Badge color="info">Standby</Badge>
        </div>
      </div>
    </div>
  );
};
