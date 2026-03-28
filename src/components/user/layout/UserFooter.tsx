import React from "react";

export default function UserFooter() {
  return (
    <footer className="border-t border-gray-200 py-6 dark:border-gray-800">
      <div className="mx-auto w-full max-w-(--breakpoint-2xl) px-4 md:px-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Copyright {new Date().getFullYear()} Kadi. Fast and reliable e-bike delivery.
        </p>
      </div>
    </footer>
  );
}
