"use client";

import React, { useContext } from "react";
import AddressCard from "@/components/user/profile/AddressCard";
import Link from "next/link";
import { UserContext } from "../layout";

export default function UserProfilePage() {
  const { user: activeUser } = useContext(UserContext);

  if (!activeUser) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
        <div className="text-6xl">👤</div>
        <h2 className="text-xl font-bold dark:text-white">Profile not selected</h2>
        <p className="text-sm text-gray-500 max-w-xs">
          Please select a customer profile from the simulation bar at the top to view and manage account details.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">My Profile</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your account details and saved addresses for <span className="font-bold text-brand-600">{activeUser.firstName}</span>.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/user/forgot-password"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.05]"
          >
            Forgot Password
          </Link>
          <Link
            href="/user/change-password"
            className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Change Password
          </Link>
        </div>
      </div>

      {/* Info Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex items-center gap-4 mb-6">
           <div className="h-16 w-16 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 text-2xl font-bold">
             {activeUser.firstName.charAt(0)}
           </div>
           <div>
             <h3 className="text-xl font-bold text-gray-800 dark:text-white">{activeUser.firstName} {activeUser.lastName}</h3>
             <p className="text-sm text-gray-400">Customer ID: #CUST-{activeUser.id.toString().padStart(3, "0")}</p>
           </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 pt-6 border-t border-gray-100 dark:border-gray-800">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Email Address</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{activeUser.email}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Phone Number</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{activeUser.phone}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Account Status</p>
            <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 uppercase">
              Active Member
            </span>
          </div>
        </div>
      </div>

      {/* Address Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white/90">
          Saved Address
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <AddressCard address={{
                id: activeUser.id,
                label: "Home",
                address: `${activeUser.street || ""}, ${activeUser.city || ""}, ${activeUser.state || ""} ${activeUser.zip || ""}`.trim().replace(/^,/, ""),
                isDefault: true
            }} />
        </div>
      </div>
    </div>
  );
}
