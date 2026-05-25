"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import Pagination from "../ui/Pagination";
import LogoImagePicker from "./LogoImagePicker";
import CompanyApiKeysSection from "./CompanyApiKeysSection";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";

/* ── Types ── */
type TxStatus = "NOT_ASSIGNED" | "PENDING" | "APPROVED" | "EXPIRED" | "FAILED";

interface Transaction {
  id: string;
  date: string;
  orderId: string;
  payer: string;
  amount: number;
  status: TxStatus;
  type: "PAYIN" | "PAYOUT";
}

function encodeCompanyKey(raw: string): string {
  try {
    return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  } catch {
    return raw;
  }
}

function mapDbStatusToTxStatus(raw: string): TxStatus {
  const s = raw.toUpperCase();
  if (s.includes("APPROVED")) return "APPROVED";
  if (s === "NOT_ASSIGNED" || s.includes("NOT_ASSIGNED")) return "NOT_ASSIGNED";
  if (s.includes("EXPIRED")) return "EXPIRED";
  if (s.includes("REJECTED") || s.includes("REVOKED")) return "FAILED";
  if (s.includes("FAILED")) return "FAILED";
  return "PENDING";
}

function toMoney(value: unknown): string {
  const n = Number(value);
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN")}`;
}

const txStatusStyle: Record<string, string> = {
  NOT_ASSIGNED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  PENDING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  APPROVED: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  EXPIRED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  FAILED: "bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400",
};

const TX_PAGE_SIZE = 5;

type ApiCompany = {
  id: string;
  username: string;
  brand_name: string;
  logo: string | null;
  status: string;
  company_code: string | null;
  commission: number;
  net_pay_in: number;
  net_pay_out: number;
  settlement_amount: number;
};

/* ── Main component ── */
export default function CompanyDetail({ id }: { id: string }) {
  const { can, loading: permLoading } = useAdminPermissions();
  const [apiCompany, setApiCompany] = useState<ApiCompany | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [todayPayIn, setTodayPayIn] = useState(0);
  const [todayPayOut, setTodayPayOut] = useState(0);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);

  const uploadLogoFile = useCallback(
    async (file: File) => {
      let blobUrl: string | null = null;
      setUploadError(null);
      setUploadingLogo(true);
      try {
        blobUrl = URL.createObjectURL(file);
        setPendingPreview(blobUrl);
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/companies/${id}/logo`, {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const data = (await res.json()) as { ok?: boolean; logo?: string; error?: string };
        if (!res.ok || !data.ok || !data.logo) {
          setUploadError(data.error ?? "Upload failed.");
          return;
        }
        setApiCompany((prev) => (prev ? { ...prev, logo: data.logo as string } : null));
      } catch {
        setUploadError("Network error.");
      } finally {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        setPendingPreview(null);
        setUploadingLogo(false);
      }
    },
    [id],
  );

  const { loading: authLoading } = useAuth();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (authLoading) return;
      setLoadError(null);
      setApiCompany(null);
      if (!id || id === "undefined") {
        setLoadError("Invalid company link.");
        return;
      }
      try {
        const res = await fetch(`/api/companies/${id}`, { credentials: "include" });
        const data = (await res.json()) as { ok?: boolean; company?: ApiCompany; error?: string };
        if (cancelled) return;
        if (res.status === 404) {
          setLoadError("Company not found.");
          return;
        }
        if (!res.ok || !data.ok || !data.company) {
          setLoadError(data.error ?? "Could not load company.");
          return;
        }
        setApiCompany(data.company);
      } catch {
        if (!cancelled) setLoadError("Network error.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function loadTx() {
      if (authLoading) return;
      if (!id || id === "undefined") {
        setTxLoading(false);
        setTransactions([]);
        return;
      }
      setTxLoading(true);
      setTxError(null);
      try {
        const res = await fetch(`/api/admin/companies/${id}/transactions`, { credentials: "include" });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          todayPayIn?: number;
          todayPayOut?: number;
          transactions?: {
            id: string;
            orderId: string;
            amount: number;
            status: string;
            type: string;
            clientName: string;
            createdAt: string | null;
          }[];
        };
        if (cancelled) return;
        if (!res.ok || !data.ok || !data.transactions) {
          setTxError(data.error ?? "Could not load transactions.");
          setTransactions([]);
          setTodayPayIn(0);
          setTodayPayOut(0);
          return;
        }
        setTodayPayIn(Number(data.todayPayIn) || 0);
        setTodayPayOut(Number(data.todayPayOut) || 0);
        const mapped: Transaction[] = data.transactions.map((t) => {
          const d = t.createdAt ? new Date(t.createdAt) : null;
          const dateLine = d
            ? `${d.toLocaleDateString("en-IN", { day: "numeric", month: "numeric", year: "numeric" })}\n${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}`
            : "—";
          const typ = t.type === "PAYOUT" ? "PAYOUT" : "PAYIN";
          return {
            id: t.id,
            date: dateLine,
            orderId: t.orderId,
            payer: t.clientName || "—",
            amount: t.amount,
            status: mapDbStatusToTxStatus(t.status),
            type: typ,
          };
        });
        setTransactions(mapped);
      } catch {
        if (!cancelled) {
          setTxError("Network error.");
          setTransactions([]);
        }
      } finally {
        if (!cancelled) setTxLoading(false);
      }
    }
    void loadTx();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    setTxPage(1);
  }, [id]);

  const txPaginated = transactions.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE);

  const paymentLink = useMemo(() => {
    const code = apiCompany?.company_code?.trim() ?? "";
    if (!code || typeof window === "undefined") return "";
    const key = encodeCompanyKey(code);
    return `${window.location.origin}/pay/${key}`;
  }, [apiCompany?.company_code]);

  const securityKey = useMemo(() => {
    const code = apiCompany?.company_code?.trim() ?? "";
    return code ? encodeCompanyKey(code) : "—";
  }, [apiCompany?.company_code]);

  const qrImageUrl = paymentLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(paymentLink)}`
    : "";

  const handleCopy = () => {
    if (!paymentLink) return;
    navigator.clipboard.writeText(paymentLink).catch(() => { });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (permLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-gray-500">Checking permissions...</div>
      </div>
    );
  }

  if (!can("view_companies")) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Access Denied</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">You do not have permission to view companies.</p>
      </div>
    );
  }

  if (loadError && !apiCompany) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/companies" className="text-sm text-brand-500 hover:underline w-fit">
          ← Back to companies
        </Link>
        <p className="text-gray-600 dark:text-gray-400">{loadError}</p>
      </div>
    );
  }

  if (!apiCompany) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  const company = apiCompany;
  return (
    <div className="flex flex-col gap-5">
      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        <Link
          href="/companies"
          className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Company <span className="text-blue-500">Details</span>
        </h1>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">

        {/* ── Left: Profile card ── */}
        <div className="rounded-2xl bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 overflow-hidden">
          {/* Logo + profile */}
          <div className="flex flex-col items-center pt-8 pb-5 px-5 border-b border-gray-100 dark:border-gray-800">
            <LogoImagePicker
              previewSrc={
                pendingPreview ??
                (company.logo && (company.logo.startsWith("http") || company.logo.startsWith("/"))
                  ? company.logo
                  : null)
              }
              onFile={uploadLogoFile}
              uploading={uploadingLogo}
              disabled={!can("edit_companies")}
            />
            {uploadError && <p className="text-xs text-red-500 text-center max-w-[220px] mt-1">{uploadError}</p>}
            <p className="text-base font-bold text-gray-900 dark:text-white mt-3">{company.username}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Brand: {company.brand_name || "—"}</p>
          </div>

          {/* Info fields */}
          <div className="px-5 py-4 flex flex-col gap-4 border-b border-gray-100 dark:border-gray-800">
            {[
              { label: "Status", value: company.status },
              { label: "Company code", value: company.company_code || "—" },
              { label: "Commission", value: `${Number(company.commission) || 0}%` },
              { label: "Net pay-in", value: toMoney(company.net_pay_in) },
              { label: "Net pay-out", value: toMoney(company.net_pay_out) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">{label}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{value}</p>
              </div>
            ))}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Security Key</p>
              <p className="text-sm font-mono font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 tracking-widest break-all">
                {securityKey}
              </p>
            </div>
          </div>

          {/* QR / Payment portal */}
          <div className="px-5 py-5">
            <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-3">Public Payment Portal</p>
            {!company.company_code?.trim() ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                Company code generate nahi hai — QR aur link tab dikhenge jab code assign ho.
              </p>
            ) : (
              <>
                <div className="rounded-xl border border-gray-200 p-4 text-center dark:border-gray-800">
                  <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">Scan this QR Code to initiate a payment</p>
                  <div className="mx-auto h-44 w-44 rounded-md bg-white p-2 shadow-theme-xs">
                    {paymentLink ? (
                      <img
                        src={qrImageUrl}
                        alt="Payment QR"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-gray-400">Preparing…</div>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Payment link</p>
                <p className="mt-1 break-all rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 font-mono text-[10px] text-gray-600 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300">
                  {paymentLink || "—"}
                </p>
              </>
            )}
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!paymentLink}
                className="flex items-center gap-1.5 flex-1 justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copied ? "Copied!" : "Copy Link"}
              </button>
              {paymentLink ? (
                <a
                  href={paymentLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white transition-colors shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ) : (
                <span
                  className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-300 text-gray-500 shrink-0 dark:bg-gray-700 dark:text-gray-500"
                  title="Payment link unavailable"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </span>
              )}
            </div>
            {qrImageUrl ? (
              <a
                href={qrImageUrl}
                download={`company-${company.id}-pay-qr.png`}
                className="mt-2 flex w-full items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                Download QR Image
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="w-full mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-400 opacity-50 cursor-not-allowed"
              >
                Download QR Image
              </button>
            )}
          </div>
        </div>

        {/* ── Right: Transaction History ── */}
        <div className="rounded-2xl bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-wrap">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <h2 className="text-sm font-bold text-gray-800 dark:text-white">Transaction History</h2>
            </div>
            <div className="flex items-center gap-6 shrink-0">
              <div className="text-right">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-none mb-0.5">Total Pay-In (Today)</p>
                <p className={`text-sm font-bold ${todayPayIn > 0 ? "text-green-500" : "text-red-500"}`}>
                  ₹{todayPayIn.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-none mb-0.5">Total Pay-Out (Today)</p>
                <p className={`text-sm font-bold ${todayPayOut > 0 ? "text-green-500" : "text-red-500"}`}>
                  ₹{todayPayOut.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>

          {txError && (
            <div className="border-b border-red-100 bg-red-50 px-5 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              {txError}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-white/[0.02]">
                  {["Date", "Order ID", "Payer", "Type", "Amount", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txLoading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-sm text-gray-400">
                      Loading transactions…
                    </td>
                  </tr>
                ) : txError ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-sm text-gray-400">
                      Could not load list.
                    </td>
                  </tr>
                ) : txPaginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-sm text-gray-400">No transactions found.</td>
                  </tr>
                ) : (
                  txPaginated.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        {tx.date.split("\n").map((line, i) => (
                          <p key={i} className={`text-xs ${i === 0 ? "font-medium text-gray-700 dark:text-gray-200" : "text-gray-400"}`}>{line}</p>
                        ))}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-xs font-mono text-gray-600 dark:text-gray-300 break-all max-w-[160px]">{tx.orderId}</p>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-gray-300">{tx.payer}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tx.type === "PAYOUT"
                              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                              : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                            }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                        ₹{tx.amount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${txStatusStyle[tx.status]}`}>
                          {tx.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/transactions/${tx.id}`}
                          title="View transaction"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-white/[0.02]">
            <p className="text-xs text-gray-400 shrink-0">
              {txLoading || txError
                ? "—"
                : transactions.length === 0
                  ? "No entries"
                  : `Showing ${(txPage - 1) * TX_PAGE_SIZE + 1} to ${Math.min(txPage * TX_PAGE_SIZE, transactions.length)} of ${transactions.length} entries`}
            </p>
            {!txLoading && !txError && transactions.length > 0 ? (
              <Pagination total={transactions.length} page={txPage} pageSize={TX_PAGE_SIZE} onPageChange={setTxPage} />
            ) : null}
          </div>
        </div>

      </div>

      {/* <CompanyApiKeysSection companyId={id} /> */}
    </div>
  );
}
