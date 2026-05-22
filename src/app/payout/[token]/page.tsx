"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type DecodedPayload = {
  orderId: string;
  return_url: string;
  amount: number;
  account_name: string;
};

export default function PayoutRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;
  const [payload, setPayload] = useState<DecodedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(4);

  useEffect(() => {
    if (!token) return;

    try {
      // Decode URL safe Base64
      const normalized = token
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      
      const pad = normalized.length % 4;
      const padded = pad ? normalized + "=".repeat(4 - pad) : normalized;
      const decodedStr = atob(padded);
      const data = JSON.parse(decodedStr) as DecodedPayload;
      
      if (!data.return_url || !data.orderId) {
        throw new Error("Invalid payload structure");
      }
      setPayload(data);
    } catch (e) {
      console.error("Failed to decode payout token", e);
      setError("Invalid or expired payout link.");
    }
  }, [token]);

  useEffect(() => {
    if (!payload) return;

    if (secondsLeft <= 0) {
      // Redirect to return_url
      window.location.href = payload.return_url;
      return;
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [payload, secondsLeft]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
        <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-8 text-center shadow-lg dark:border-red-950/20 dark:bg-gray-900">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/30">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Verification Failed</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition-all hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100"
          >
            Go back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 font-medium">Loading payout details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-12 dark:from-gray-950 dark:to-gray-900">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900/60 dark:backdrop-blur-md">
        
        {/* Header decoration */}
        <div className="relative h-2 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500"></div>

        <div className="p-8 sm:p-10">
          {/* Status Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-400">
            <svg className="h-8 w-8 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <div className="mt-6 text-center">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/10 dark:bg-emerald-950/20 dark:text-emerald-400 dark:ring-emerald-500/20">
              Payout Link Generated
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Payout Requested Successfully
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Your payout request has been registered and is pending admin assignment.
            </p>
          </div>

          {/* Details Card */}
          <div className="mt-8 rounded-2xl bg-gray-50/50 p-6 dark:bg-gray-800/40 border border-gray-100/60 dark:border-gray-800/60">
            <div className="flex justify-between items-center py-2">
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500">PAYOUT AMOUNT</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                ₹{payload.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="h-[1px] bg-gray-100 dark:bg-gray-800 my-2"></div>
            <div className="flex justify-between items-center py-2">
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500">BENEFICIARY</span>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{payload.account_name}</span>
            </div>
            <div className="h-[1px] bg-gray-100 dark:bg-gray-800 my-2"></div>
            <div className="flex justify-between items-center py-2">
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500">TRANSACTION ID</span>
              <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{payload.orderId}</span>
            </div>
          </div>

          {/* Loader and Auto-Redirect details */}
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]"></div>
              <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]"></div>
              <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-emerald-500"></div>
            </div>
            <p className="mt-4 text-xs font-medium text-gray-400 dark:text-gray-500">
              Redirecting you to merchant callback in{" "}
              <span className="font-bold text-gray-700 dark:text-gray-300 text-sm">{secondsLeft}</span> seconds...
            </p>
          </div>

          {/* Redirect Button */}
          <div className="mt-8">
            <a
              href={payload.return_url}
              className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all hover:scale-[1.01] hover:brightness-105 active:scale-95"
            >
              Continue back to Merchant
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
