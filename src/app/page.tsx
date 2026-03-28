import React from "react";
import Link from "next/link";
import HeroSection from "@/components/user/landing/HeroSection";
import HowItWorksSection from "@/components/user/landing/HowItWorksSection";
import FeaturesSection from "@/components/user/landing/FeaturesSection";
import UserHeader from "@/components/user/layout/UserHeader";
import UserFooter from "@/components/user/layout/UserFooter";

export default function RootLandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <UserHeader />
      <main className="mx-auto w-full max-w-(--breakpoint-2xl) space-y-10 px-4 py-6 md:px-6">
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
              href="/user/book-ride"
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
      </main>
      <UserFooter />
    </div>
  );
}
