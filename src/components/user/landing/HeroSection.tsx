import React from "react";
import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="overflow-hidden rounded-3xl border border-brand-100 bg-linear-to-br from-brand-500 to-brand-700 p-6 text-white dark:border-brand-500/20 md:p-10">
      <div className="grid grid-cols-1 items-center gap-8">
        <div>
          <p className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white">
            Kandi E-Bike Delivery
          </p>
          <h1 className="mt-4 text-3xl font-bold leading-tight md:text-5xl">
            Anything delivered in minutes, across your city.
          </h1>
          <p className="mt-4 max-w-xl text-white/90">
            Groceries, meals, pharmacy, and daily essentials with live rider
            tracking and eco-friendly e-bike delivery.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/user/orders"
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 hover:bg-gray-100"
            >
              Start Ordering
            </Link>
            <Link
              href="/user/track"
              className="rounded-xl border border-white/70 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              Track My Order
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
