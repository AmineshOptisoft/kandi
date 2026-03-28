import React from "react";
import Link from "next/link";
import type { Order } from "@/data/user/orders";
import OrderStatusBadge from "./OrderStatusBadge";

export default function OrderCard({ order }: { order: any }) {
  const formattedDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A';
  const displayAmount = order.amount !== undefined && order.amount !== null ? order.amount : (order.totalAmount || 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            Order #ORD-{order.id.toString().padStart(3, "0")}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{formattedDate}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Time / ETA</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {order.eta || (order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—")}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Fare Amount</p>
          <p className="text-sm font-bold text-brand-600 dark:text-brand-400">
            ₹{Number(displayAmount).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Rider Assigned</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {order.rider?.name || "Pending Selection"}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        <Link
          href={`/user/orders/${order.id}`}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.05]"
        >
          View Details
        </Link>
        <Link
          href={`/user/track?orderId=${order.id}`}
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 shadow-sm"
        >
          Track
        </Link>
      </div>
    </div>
  );
}
