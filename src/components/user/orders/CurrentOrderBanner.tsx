"use client";

import React, { useState, useEffect, useContext } from "react";
import Link from "next/link";
import OrderStatusBadge from "./OrderStatusBadge";
import { UserContext } from "@/app/(user)/user/layout";

export default function CurrentOrderBanner() {
  const context = useContext(UserContext) as any;
  const activeUser = context?.user;
  const [currentOrder, setCurrentOrder] = useState<any>(null);

  useEffect(() => {
    if (!activeUser) {
      setCurrentOrder(null);
      return;
    }

    // Fetch most recent pending/started order
    fetch(`/api/orders?customerId=${activeUser.id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const ongoing = data.find(o => ["Pending", "Accepted", "Started", "Picked Up", "Out for Delivery"].includes(o.status));
          setCurrentOrder(ongoing || null);
        }
      })
      .catch(e => console.error(e));
  }, [activeUser]);

  if (!currentOrder) return null;

  return (
    <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50 p-5 shadow-sm dark:border-brand-500/20 dark:bg-brand-500/10 transition-all hover:bg-brand-100/50">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-brand-500 flex items-center justify-center text-white text-xl shadow-md">
             🛵
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600 mb-0.5">
              Current Ride Request
            </p>
            <p className="text-base font-bold text-gray-800 dark:text-white">
              #ORD-{currentOrder.id.toString().padStart(3, "0")} · OTP: {currentOrder.otp}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Pick: {currentOrder.pickupLoc || "Current Location"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-end md:self-center">
          <OrderStatusBadge status={currentOrder.status} />
          <Link
            href={`/user/track/${currentOrder.id}`}
            className="rounded-xl border border-brand-500 bg-white px-4 py-2 text-sm font-bold text-brand-500 hover:bg-brand-500 hover:text-white transition-all shadow-sm"
          >
            Track on Map
          </Link>
        </div>
      </div>
    </div>
  );
}
