import React from "react";
import { howItWorksSteps } from "@/data/user/landing";

export default function HowItWorksSection() {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">How Kadi Works</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Simple 3-step flow</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {howItWorksSteps.map((step, idx) => (
          <div
            key={step.title}
            className="group rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-200 dark:border-gray-800 dark:bg-white/[0.03]"
          >
            <p className="inline-flex rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              Step {idx + 1}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-gray-800 dark:text-white/90">
              {step.title}
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
