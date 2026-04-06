"use client";
import React, { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";
import Link from "next/link";

import { ORDER_STATUS_LABELS, ORDER_STATUS } from "@/lib/constants";

interface Order {
  id: number;
  status: number;
  createdAt: string;
  customer: { firstName: string; lastName: string };
  rider?: { name: string } | null;
}

export default function RecentOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<"Pending" | "Active" | "Completed" | "Cancelled" | "All">("All");

  useEffect(() => {
    fetch("/api/orders")
      .then(res => res.json())
      .then(data => {
        setOrders(data);
        setLoading(false);
      })
      .catch(err => console.error("Orders fetch error:", err));
  }, []);

  if (loading) {
    return (
      <div className="p-10 text-center animate-pulse bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-100 dark:border-gray-800">
         <p className="text-sm font-medium text-gray-400">Hydrating Mission Logs...</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
             Pending Ride Requests
          </h3>
          <p className="text-xs text-gray-400">Latest mission assignments</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-wrap gap-1 md:gap-2 px-1 mr-2 bg-gray-50 dark:bg-gray-800/50 p-1 rounded-lg">
            {["All", "Pending", "Active", "Completed", "Cancelled"].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab as any)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  filterTab === tab
                    ? "bg-white dark:bg-black shadow-sm text-brand-500"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <Link 
            href="/orders" 
            className="text-xs font-bold text-brand-500 hover:text-brand-600 uppercase tracking-widest px-3 py-1.5"
          >
            Mission Archive →
          </Link>
        </div>
      </div>
      <div className="max-w-full overflow-x-auto">
        <Table>
          <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
            <TableRow>
              <TableCell isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                Mission ID
              </TableCell>
              <TableCell isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                Customer
              </TableCell>
              <TableCell isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                Operative
              </TableCell>
              <TableCell isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                Status
              </TableCell>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {orders
              .filter(o => {
                if (filterTab === "Pending") return o.status === ORDER_STATUS.PENDING;
                if (filterTab === "Active") return [ORDER_STATUS.ACCEPTED, ORDER_STATUS.ARRIVED, ORDER_STATUS.STARTED].includes(o.status);
                if (filterTab === "Completed") return o.status === ORDER_STATUS.DELIVERED;
                if (filterTab === "Cancelled") return o.status === ORDER_STATUS.CANCELED;
                return true;
              })
              .slice(0, 5) // Show only 5 after filtering
              .map((order) => (
              <TableRow key={order.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.01]">
                <TableCell className="py-4">
                  <p className="font-bold text-gray-800 text-theme-sm dark:text-white/90">
                    #ORD-{order.id}
                  </p>
                </TableCell>
                <TableCell className="py-4 text-gray-700 font-medium text-theme-sm dark:text-gray-400">
                  {order.customer.firstName} {order.customer.lastName}
                </TableCell>
                <TableCell className="py-4 text-gray-500 text-theme-sm dark:text-gray-400">
                   {order.rider?.name || (
                     <span className="text-[10px] font-black text-orange-500 uppercase tracking-tighter bg-orange-50 px-2 py-0.5 rounded-full">
                        Pending Unit
                     </span>
                   )}
                </TableCell>
                <TableCell className="py-4 text-gray-500 text-theme-sm dark:text-gray-400">
                  <Badge
                    size="sm"
                    color={
                      order.status === ORDER_STATUS.DELIVERED ? "success" : 
                      order.status === ORDER_STATUS.PENDING ? "warning" : 
                      [ORDER_STATUS.ACCEPTED, ORDER_STATUS.ARRIVED, ORDER_STATUS.STARTED].includes(order.status) ? "info" : "error"
                    }
                  >
                    {ORDER_STATUS_LABELS[order.status] || order.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}

            {orders.filter(o => {
                if (filterTab === "Pending") return o.status === ORDER_STATUS.PENDING;
                if (filterTab === "Active") return [ORDER_STATUS.ACCEPTED, ORDER_STATUS.ARRIVED, ORDER_STATUS.STARTED].includes(o.status);
                if (filterTab === "Completed") return o.status === ORDER_STATUS.DELIVERED;
                if (filterTab === "Cancelled") return o.status === ORDER_STATUS.CANCELED;
                return true;
              }).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-gray-400 italic text-sm">
                   No recent mission logs detected
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
