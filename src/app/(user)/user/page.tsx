"use client";

import React, { useContext } from "react";
import Link from "next/link";
import HeroSection from "@/components/user/landing/HeroSection";
import HowItWorksSection from "@/components/user/landing/HowItWorksSection";
import FeaturesSection from "@/components/user/landing/FeaturesSection";
import { UserContext } from "./layout";

export default function UserLandingPage() {
  const { user: activeUser } = useContext(UserContext) as any;

  return (
    <div className="space-y-10">
      {activeUser && (
        <div className="p-4 bg-brand-500 rounded-2xl text-white flex items-center justify-between shadow-lg">
           <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">😊</div>
              <div>
                <h2 className="text-xl font-bold">Hello, {activeUser.firstName}!</h2>
                <p className="text-sm opacity-80">Welcome back to Kadi EV Fleet.</p>
              </div>
           </div>
           <Link href="/user/orders" className="bg-white/20 hover:bg-white/40 px-4 py-2 rounded-xl text-sm font-bold transition-all">
              View My Orders
           </Link>
        </div>
      )}
      <HeroSection />
      <HowItWorksSection />
      <FeaturesSection />
      <section className="rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-2xl font-bold text-gray-800 dark:text-white/90">
          Ready to place your next delivery order?
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Start now and get your order delivered by our e-bike network.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/user/orders"
            className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Order Now
          </Link>
          <Link
            href="/user/track"
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.05]"
          >
            Track Order
          </Link>
        </div>
      </section>
    </div>
  );
}
