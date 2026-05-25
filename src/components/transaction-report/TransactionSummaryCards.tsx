import React from "react";

export interface TransactionSummaryCard {
  title: string;
  value: string;
  accent: "blue" | "green" | "warning" | "teal";
  icon: React.ReactNode;
}

const accentStyles: Record<string, string> = {
  blue: "border-blue-200/70 dark:border-blue-800/70 text-blue-500 dark:text-blue-400",
  green: "border-green-200/70 dark:border-green-800/70 text-green-500 dark:text-green-400",
  warning: "border-amber-200/70 dark:border-amber-800/70 text-amber-500 dark:text-amber-400",
  teal: "border-cyan-200/70 dark:border-cyan-800/70 text-cyan-500 dark:text-cyan-400",
};

export default function TransactionSummaryCards({ cards }: { cards: TransactionSummaryCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`rounded-xl border bg-white p-3.5 dark:bg-white/[0.03] ${accentStyles[card.accent]}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{card.title}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 text-inherit dark:bg-gray-800/50">
              {card.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
