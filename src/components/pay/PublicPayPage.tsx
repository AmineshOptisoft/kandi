"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { publicPayInDisplayMethod } from "@/lib/payin-lifecycle";
import { copyTextToClipboard } from "@/lib/copy-clipboard";

type CompanyInfo = {
  id: string;
  brand_name: string;
  logo: string | null;
  company_code: string | null;
  status?: string;
  paymentsEnabled?: boolean;
  blockMessage?: string | null;
};

type PayRequest = {
  id: string;
  orderId: string;
  amount: number;
  status: string;
  /** Server UX label (e.g. NOT_ASSIGNED → WAITING_FOR_AGENT). */
  displayStatus?: string;
  clientName: string;
  /** Legacy / optional payer UPI stored on txn; Payment UI does not use this for pay-to details. */
  clientUpi?: string;
  assignedUpi: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  waitForAgent: boolean;
  /** True when UTR or payment_image already saved; status may still be PENDING until approval. */
  proofSubmitted?: boolean;
  hasReceipt?: boolean;
  utrCode?: string;
  /** Assigned agent pay method (from server), not the payer's initial preference alone. */
  paymentMethod?: "UPI" | "BANK";
  accountHolderName?: string;
  /** Server-built UPI intent string (preferred for QR when present). */
  qrCodeUrl?: string;
  /** When set, request auto-expires at this instant (see `request-expiry`). */
  expiresAtIso?: string;
};

type Step = "FORM" | "WAIT_ASSIGN" | "PAYMENT" | "VERIFY_QUEUE" | "FINAL";

const FINAL_STATES = new Set(["APPROVED", "APPROVED_BY_ADMIN", "REJECTED", "EXPIRED", "REVOKED"]);
/** Fallback payment-step countdown when server does not send `expiresAtIso` (seconds). */
const PAYMENT_TIMER_SEC = 300;
/** After JPEG compress we keep data URL under this length (UTF-8) to fit DB `max_allowed_packet`. */
const TARGET_MAX_PROOF_DATA_URL_CHARS = 480_000;
/** Max raw file before client-side image compress (bytes). */
const MAX_PROOF_IMAGE_RAW_BYTES = 20 * 1024 * 1024;
/** PDF proof is sent as data URL (~4/3 size); keep small. */
const MAX_PROOF_PDF_RAW_BYTES = 380 * 1024;
const UTR_12_DIGIT_REGEX = /^\d{12}$/;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("read"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read"));
    reader.readAsDataURL(file);
  });
}

/** Resize + JPEG re-encode so base64 proof stays under server limits. */
async function compressProofImageToDataUrl(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    let w = bitmap.width;
    let h = bitmap.height;
    const cap = 1920;
    const m = Math.max(w, h);
    if (m > cap) {
      w = Math.round((w * cap) / m);
      h = Math.round((h * cap) / m);
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, w);
    canvas.height = Math.max(1, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    let q = 0.9;
    let dataUrl = canvas.toDataURL("image/jpeg", q);
    while (dataUrl.length > TARGET_MAX_PROOF_DATA_URL_CHARS && q > 0.5) {
      q -= 0.06;
      dataUrl = canvas.toDataURL("image/jpeg", q);
    }
    while (dataUrl.length > TARGET_MAX_PROOF_DATA_URL_CHARS && canvas.width > 360) {
      const nw = Math.max(360, Math.round(canvas.width * 0.86));
      const nh = Math.max(1, Math.round((canvas.height * nw) / canvas.width));
      const tmp = document.createElement("canvas");
      tmp.width = nw;
      tmp.height = nh;
      const tctx = tmp.getContext("2d");
      if (!tctx) break;
      tctx.drawImage(canvas, 0, 0, nw, nh);
      canvas.width = nw;
      canvas.height = nh;
      const ctx2 = canvas.getContext("2d");
      if (!ctx2) break;
      ctx2.drawImage(tmp, 0, 0);
      q = 0.82;
      dataUrl = canvas.toDataURL("image/jpeg", q);
    }
    return dataUrl.length <= TARGET_MAX_PROOF_DATA_URL_CHARS ? dataUrl : null;
  } catch {
    return null;
  }
}

function formatMmSs(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function buildUpiPayUri(assignedUpi: string, payeeName: string, amount: number): string {
  const params = new URLSearchParams({
    pa: assignedUpi.trim(),
    pn: payeeName.trim() || "Payee",
    am: String(amount),
    cu: "INR",
  });
  return `upi://pay?${params.toString()}`;
}

function qrDataUrl(upiUri: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiUri)}`;
}

/** Read `pa` from `upi://pay?...` when assigned UPI text is empty. */
function parsePayeeUpiFromIntent(uri: string): string {
  const u = uri.trim();
  if (!u.toLowerCase().startsWith("upi://")) return "";
  const q = u.includes("?") ? u.slice(u.indexOf("?") + 1) : "";
  try {
    const pa = new URLSearchParams(q).get("pa");
    return pa?.trim() ?? "";
  } catch {
    return "";
  }
}

export default function PublicPayPage({ companyKey }: { companyKey: string }) {
  const paySessionKey = useMemo(() => `tepay-public-pay-active:${companyKey}`, [companyKey]);

  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [companyBlocked, setCompanyBlocked] = useState(false);
  const [companyBlockMessage, setCompanyBlockMessage] = useState<string | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);

  const [method, setMethod] = useState<"UPI" | "BANK">("UPI");
  const [clientName, setClientName] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [request, setRequest] = useState<PayRequest | null>(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [utrInput, setUtrInput] = useState("");
  const [proofDataUrl, setProofDataUrl] = useState<string | null>(null);
  const [proofName, setProofName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [secondsLeft, setSecondsLeft] = useState(PAYMENT_TIMER_SEC);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingCompany(true);
      setCompanyError(null);
      setCompanyBlocked(false);
      setCompanyBlockMessage(null);
      setRequest(null);
      setUtrInput("");
      setProofDataUrl(null);
      setProofName("");
      setFormError(null);
      try {
        const res = await fetch(`/api/public/pay/${encodeURIComponent(companyKey)}`);
        const data = (await res.json()) as { ok?: boolean; company?: CompanyInfo; error?: string };
        if (!mounted) return;
        if (!res.ok || !data.ok || !data.company) {
          setCompanyError(data.error ?? "Invalid payment link");
          setCompany(null);
          setCompanyBlocked(false);
          return;
        }
        setCompany(data.company);
        const blocked = data.company.paymentsEnabled === false;
        setCompanyBlocked(blocked);
        setCompanyBlockMessage(
          blocked
            ? data.company.blockMessage?.trim() ||
            "This company cannot accept payment requests right now because the account has been blocked."
            : null,
        );
      } catch {
        if (mounted) setCompanyError("Network error while loading payment page");
      } finally {
        if (mounted) setLoadingCompany(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [companyKey]);

  useEffect(() => {
    if (!company) return;
    const raw = typeof window !== "undefined" ? sessionStorage.getItem(paySessionKey)?.trim() : "";
    if (!raw) return;

    let cancelled = false;
    const storedId = raw;
    (async () => {
      try {
        const res = await fetch(`/api/public/pay/request/${encodeURIComponent(storedId)}`);
        const data = (await res.json()) as { ok?: boolean; request?: PayRequest };
        if (cancelled) return;
        if (typeof window !== "undefined" && sessionStorage.getItem(paySessionKey) !== storedId) return;
        if (!res.ok || !data.ok || !data.request) {
          sessionStorage.removeItem(paySessionKey);
          return;
        }
        setRequest({
          ...data.request,
          waitForAgent: Boolean(data.request.waitForAgent),
          proofSubmitted: Boolean(data.request.proofSubmitted),
        });
        setUtrInput(data.request.utrCode?.trim() ?? "");
      } catch {
        if (!cancelled && typeof window !== "undefined") sessionStorage.removeItem(paySessionKey);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [company, paySessionKey]);

  useEffect(() => {
    if (!request?.id) return;

    const id = request.id;
    const poll = async () => {
      try {
        const res = await fetch(`/api/public/pay/request/${id}`);
        const data = (await res.json()) as { ok?: boolean; request?: PayRequest };
        if (!res.ok || !data.ok || !data.request) return;
        setRequest({
          ...data.request,
          waitForAgent: Boolean(data.request.waitForAgent),
          proofSubmitted: Boolean(data.request.proofSubmitted),
        });
      } catch {
        // ignore transient polling failures
      }
    };

    void poll();
    const waiting =
      request.waitForAgent ||
      String(request.status).toUpperCase() === "NOT_ASSIGNED" ||
      String(request.displayStatus ?? "").toUpperCase() === "WAITING_FOR_AGENT";
    const ms = waiting ? 2000 : 5000;
    const timer = setInterval(() => void poll(), ms);
    return () => clearInterval(timer);
  }, [request?.id, request?.waitForAgent, request?.status, request?.displayStatus]);

  const currentStep: Step = useMemo(() => {
    if (!request) return "FORM";
    const st = String(request.status).toUpperCase();
    if (FINAL_STATES.has(st)) return "FINAL";
    if (st === "PAID") return "VERIFY_QUEUE";
    if (request.proofSubmitted && st === "PENDING") return "VERIFY_QUEUE";
    if (
      request.waitForAgent ||
      st === "NOT_ASSIGNED" ||
      String(request.displayStatus ?? "").toUpperCase() === "WAITING_FOR_AGENT"
    ) {
      return "WAIT_ASSIGN";
    }
    return "PAYMENT";
  }, [request]);

  const assignedMethod = useMemo((): "UPI" | "BANK" => {
    if (!request) return "UPI";
    return publicPayInDisplayMethod({
      payment_method: request.paymentMethod,
      assigned_upi: request.assignedUpi,
      qr_code_url: request.qrCodeUrl,
      bank_name: request.bankName,
      bank_account_number: request.accountNo,
      ifsc_code: request.ifsc,
    });
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const st = String(request.status).toUpperCase();
    if (FINAL_STATES.has(st)) return;
    if (currentStep !== "PAYMENT") return;

    const iso = request.expiresAtIso?.trim();
    if (iso) {
      const end = new Date(iso).getTime();
      if (Number.isFinite(end)) {
        const tick = () => setSecondsLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
        tick();
        const id = window.setInterval(tick, 1000);
        return () => window.clearInterval(id);
      }
    }

    setSecondsLeft(PAYMENT_TIMER_SEC);
    const id = window.setInterval(() => setSecondsLeft((s) => (s <= 0 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [currentStep, request?.id, request?.status, request?.expiresAtIso]);

  async function createRequest() {
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/public/pay/${encodeURIComponent(companyKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: clientName,
          client_upi: "",
          amount,
          method,
          id: request?.id,
          note: request?.id,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; request?: PayRequest; error?: string; waitForAgent?: boolean };
      if (!res.ok || !data.ok || !data.request) {
        setFormError(data.error ?? "Could not create payment request");
        return;
      }
      try {
        sessionStorage.setItem(paySessionKey, data.request.id);
      } catch {
        // ignore quota / private mode
      }
      setRequest({
        ...data.request,
        waitForAgent: Boolean(data.request?.waitForAgent ?? data.waitForAgent),
        proofSubmitted: Boolean(data.request?.proofSubmitted),
      });
      setUtrInput("");
      setProofDataUrl(null);
      setProofName("");
      setProofError(null);
    } catch {
      setFormError("Network error");
    } finally {
      setSaving(false);
    }
  }

  const ingestProofFile = useCallback((file: File | null) => {
    if (!file) return;
    const okType = file.type === "image/png" || file.type === "image/jpeg" || file.type === "application/pdf";
    if (!okType) {
      setProofError("Use PNG, JPG, or PDF.");
      return;
    }

    if (file.type === "application/pdf") {
      if (file.size > MAX_PROOF_PDF_RAW_BYTES) {
        setProofError(`PDF must be about ${Math.round(MAX_PROOF_PDF_RAW_BYTES / 1024)} KB or smaller (server limit). Use a JPG screenshot instead.`);
        return;
      }
      setProofError(null);
      void readFileAsDataUrl(file)
        .then((dataUrl) => {
          if (dataUrl.length > TARGET_MAX_PROOF_DATA_URL_CHARS) {
            setProofError("That PDF is still too large when encoded. Use a smaller PDF or a JPG/PNG screenshot.");
            return;
          }
          setProofDataUrl(dataUrl);
          setProofName(file.name);
        })
        .catch(() => setProofError("Could not read file."));
      return;
    }

    if (file.size > MAX_PROOF_IMAGE_RAW_BYTES) {
      setProofError("Image file is too large to process in the browser. Try a smaller photo.");
      return;
    }
    setProofError(null);
    void compressProofImageToDataUrl(file).then((dataUrl) => {
      if (!dataUrl) {
        setProofError("Could not compress image. Try another photo or a PDF under the size limit.");
        return;
      }
      setProofDataUrl(dataUrl);
      setProofName(file.name);
    });
  }, []);

  async function submitProof() {
    if (!request) return;
    const utr = utrInput.trim();
    const image = proofDataUrl?.trim() ?? "";
    if (!UTR_12_DIGIT_REGEX.test(utr)) {
      setProofError("UTR must be exactly 12 digits.");
      return;
    }
    if (!image) {
      setProofError("Upload a screenshot or proof of payment (required).");
      return;
    }
    if (image.length > TARGET_MAX_PROOF_DATA_URL_CHARS) {
      setProofError("Proof file is too large. Choose a smaller image or re-upload.");
      return;
    }
    setProofBusy(true);
    setProofError(null);
    try {
      const res = await fetch(`/api/public/pay/request/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utr_code: utr, payment_image: image }),
      });
      const data = (await res.json()) as { ok?: boolean; request?: PayRequest; error?: string };
      if (!res.ok || !data.ok || !data.request) {
        setProofError(data.error ?? "Could not submit payment");
        return;
      }
      setRequest({
        ...data.request,
        waitForAgent: Boolean(data.request.waitForAgent),
        proofSubmitted: Boolean(data.request.proofSubmitted),
      });
      setSuccessOrderId(data.request.orderId);
      setShowSuccessModal(true);
    } catch {
      setProofError("Network error");
    } finally {
      setProofBusy(false);
    }
  }

  async function copyField(key: string, text: string) {
    const t = text.trim();
    if (!t) return;
    const ok = await copyTextToClipboard(t);
    if (ok) {
      setProofError(null);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((k) => (k === key ? null : k));
      }, 1600);
    } else {
      setProofError("Copy failed — select the text and copy manually.");
    }
  }

  const brandTitle = company?.brand_name ?? "Merchant";

  const upiIntent = useMemo(() => {
    if (!request || assignedMethod !== "UPI") return "";
    const server = (request.qrCodeUrl ?? "").trim();
    if (server.toLowerCase().startsWith("upi://")) return server;
    const upi = (request.assignedUpi ?? "").trim();
    if (!upi) return "";
    return buildUpiPayUri(upi, request.clientName || brandTitle, request.amount);
  }, [request, assignedMethod, brandTitle]);

  const qrImageSrc = useMemo(() => {
    if (!request || assignedMethod !== "UPI") return "";
    const server = (request.qrCodeUrl ?? "").trim();
    if (server.startsWith("http://") || server.startsWith("https://")) return server;
    return upiIntent ? qrDataUrl(upiIntent) : "";
  }, [request, assignedMethod, upiIntent]);

  const displayReceiverUpi = useMemo(() => {
    if (!request) return "";
    const a = (request.assignedUpi ?? "").trim();
    if (a) return a;
    return parsePayeeUpiFromIntent(upiIntent);
  }, [request, upiIntent]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50 px-4 py-10 text-gray-900 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 dark:text-gray-100">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8">
        {loadingCompany && <p className="text-sm text-gray-500">Loading…</p>}
        {companyError && (
          <div className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800">{companyError}</div>
        )}

        <Modal
          isOpen={companyBlocked && Boolean(company)}
          onClose={() => { }}
          showCloseButton={false}
          closeOnBackdropClick={false}
          closeOnEscape={false}
          className="max-w-md"
        >
          <div className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Payments unavailable</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              {companyBlockMessage}
            </p>
            {company?.brand_name && (
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{company.brand_name}</p>
            )}
          </div>
        </Modal>

        {company && !companyError && !companyBlocked && (
          <>
            <div className="flex flex-col items-center gap-2">
              {company.logo ? (
                <img src={company.logo} alt="" className="h-16 w-16 rounded-2xl object-cover shadow-md ring-2 ring-white" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-lg font-bold text-white shadow-md">
                  {brandTitle.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {currentStep === "FORM" && (
              <div className="w-full rounded-2xl border border-white/80 bg-white/95 p-6 shadow-xl shadow-sky-100/80 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/90 dark:shadow-none">
                <h1 className="text-center text-xl font-bold text-gray-900 dark:text-white">Pay to {brandTitle}</h1>
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                      User name <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Enter Name"
                      className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none ring-sky-400/30 focus:border-sky-400 focus:ring-4 dark:border-gray-600 dark:bg-gray-800"
                    />
                    <p className="mt-1 flex items-start gap-1 text-xs text-red-600">
                      <span className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full bg-red-500 text-[8px] leading-3 text-white text-center">!</span>
                      Enter exact registered username to avoid payment delay or loss.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Amount</label>
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter Amount"
                      inputMode="decimal"
                      className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none ring-sky-400/30 focus:border-sky-400 focus:ring-4 dark:border-gray-600 dark:bg-gray-800"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Select Payment Method</p>
                    <div className="mt-3 grid gap-3">
                      <button
                        type="button"
                        onClick={() => setMethod("UPI")}
                        className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${method === "UPI"
                          ? "border-sky-400 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/40"
                          : "border-gray-100 bg-sky-50/40 hover:border-sky-200 dark:border-gray-700 dark:bg-gray-800/50"
                          }`}
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xs font-bold text-sky-600 shadow-sm ring-1 ring-sky-100">
                          UPI
                        </span>
                        <span>
                          <span className="block font-semibold text-gray-900 dark:text-white">UPI</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Pay by any UPI app</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMethod("BANK")}
                        className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${method === "BANK"
                          ? "border-emerald-400 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/40"
                          : "border-gray-100 bg-emerald-50/40 hover:border-emerald-200 dark:border-gray-700 dark:bg-gray-800/50"
                          }`}
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-emerald-100 dark:bg-gray-800">
                          <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </span>
                        <span>
                          <span className="block font-semibold text-gray-900 dark:text-white">Bank Transfer</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Direct bank deposit</span>
                        </span>
                      </button>
                    </div>
                  </div>
                  {formError && <p className="text-xs text-red-600">{formError}</p>}
                  <button
                    type="button"
                    onClick={() => void createRequest()}
                    disabled={saving}
                    className="mt-2 h-12 w-full rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 text-sm font-bold text-white shadow-lg shadow-sky-300/50 transition hover:from-sky-600 hover:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Please wait…" : "Proceed to Pay"}
                  </button>
                </div>
              </div>
            )}

            {request && currentStep === "WAIT_ASSIGN" && (
              <div className="w-full rounded-2xl border border-amber-200 bg-amber-50/90 p-6 text-center shadow-lg dark:border-amber-900/50 dark:bg-amber-950/30">
                <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Payment account assign ho raha hai…</p>
                <p className="mt-2 text-xs text-amber-900/80 dark:text-amber-200/90">
                  Order <span className="font-mono font-semibold">{request.orderId}</span>. System abhi{" "}
                  <span className="font-semibold">kisi available agent ke account</span> se link karega (eligible + limit ke
                  hisaab se) — page khula rakhein; assign hote hi neeche{" "}
                  <span className="font-semibold">UPI QR / bank details</span> khud dikhenge.
                </p>
                <p className="mt-2 text-[11px] text-amber-900/70 dark:text-amber-200/80">
                  English: A receiver account is being picked automatically; details will appear here without refresh.
                </p>
              </div>
            )}

            {request && currentStep === "PAYMENT" && (
              <div className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center justify-between bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-3 text-white">
                  <span className="text-sm font-medium">Payment Time Left</span>
                  <span className="flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums">
                    <svg className="h-4 w-4 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatMmSs(secondsLeft)}
                  </span>
                </div>

                <div className="px-5 pb-6 pt-5">
                  <p className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">Transfer amount</p>
                  <p className="mt-1 text-center text-3xl font-bold text-gray-900 dark:text-white">
                    ₹ {request.amount.toLocaleString("en-IN")}
                  </p>

                  <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-center text-[11px] font-medium leading-snug text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
                    Pay only using the <span className="font-semibold">details on this screen</span> — they are the agent
                    receiver details assigned to this payment (QR, UPI ID, or bank fields from the server).
                  </p>

                  <div className="mt-5 rounded-lg border-l-4 border-sky-500 bg-sky-50 px-3 py-3 text-sm text-sky-950 dark:border-sky-400 dark:bg-sky-950/40 dark:text-sky-100">
                    <p className="font-bold">Instructions:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed">
                      {assignedMethod === "UPI" ? (
                        <>
                          <li>Scan QR code or copy UPI ID and pay the exact amount using any UPI app.</li>
                          <li>Copy UPI address to pay if you are paying from the same device.</li>
                          <li>This QR is for one-time use only.</li>
                        </>
                      ) : (
                        <>
                          <li>Transfer the exact amount to the bank details below from your bank app.</li>
                          <li>Use NEFT/IMPS/RTGS as supported by your bank.</li>
                          <li>Keep the reference / UTR after payment for verification.</li>
                        </>
                      )}
                    </ul>
                  </div>

                  {assignedMethod === "UPI" && (qrImageSrc || displayReceiverUpi || upiIntent) ? (
                    <div className="mt-6 flex flex-col items-center">
                      <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Agent payment (receive)
                      </p>
                      {qrImageSrc ? (
                        <img
                          src={qrImageSrc}
                          alt="Payment QR"
                          width={220}
                          height={220}
                          className="rounded-lg border border-gray-100 bg-white p-2 dark:border-gray-600"
                        />
                      ) : null}
                      <div className="relative mt-4 w-full">
                        <input
                          readOnly
                          value={displayReceiverUpi || upiIntent}
                          className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 pr-20 pl-3 text-sm font-medium dark:border-gray-600 dark:bg-gray-800"
                        />
                        <button
                          type="button"
                          onClick={() => void copyField("agent-upi", displayReceiverUpi || upiIntent)}
                          className="absolute right-1 top-1 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700"
                        >
                          {copiedKey === "agent-upi" ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  ) : assignedMethod === "BANK" ? (
                    <div className="mt-6 space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Agent bank account (receive)</p>
                      {[
                        { label: "Account holder", value: request.accountHolderName ?? "", key: "bank-holder" },
                        { label: "Bank name", value: request.bankName ?? "", key: "bank-name" },
                        { label: "Account number", value: request.accountNo ?? "", key: "bank-ac" },
                        { label: "IFSC", value: request.ifsc ?? "", key: "bank-ifsc" },
                      ].map((row) => {
                        const v = row.value.trim();
                        if (!v) return null;
                        return (
                          <div
                            key={row.key}
                            className="flex items-start justify-between gap-2 rounded-lg border border-gray-200/80 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900/40"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{row.label}</p>
                              <p className="break-all font-mono text-sm text-gray-800 dark:text-gray-100">{v}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void copyField(row.key, v)}
                              className="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-700"
                            >
                              {copiedKey === row.key ? "Copied" : "Copy"}
                            </button>
                          </div>
                        );
                      })}
                      {!request.bankName?.trim() && !request.accountNo?.trim() && !request.ifsc?.trim() && (
                        <p className="text-amber-800 dark:text-amber-200">
                          Bank details abhi load nahi hue — thodi der mein dubara check karein (page khula rakhein).
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-6 space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-800/60">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Assigned account details</p>
                      <p className="text-amber-800 dark:text-amber-200">
                        Assigned payment details are not on this response yet. This page updates automatically — wait a few
                        seconds. If it persists, go back and try again or contact support.
                      </p>
                    </div>
                  )}

                  <div className="relative my-8 flex items-center">
                    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                    <span className="shrink-0 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Payment verification
                    </span>
                    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                      Upload screenshot / proof <span className="font-normal text-red-500">(required)</span>
                    </label>
                    <div
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        ingestProofFile(e.dataTransfer.files[0] ?? null);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 transition-colors ${dragOver ? "border-sky-400 bg-sky-50/80" : "border-gray-200 bg-gray-50/50 hover:border-sky-300 dark:border-gray-600 dark:bg-gray-800/40"
                        }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,application/pdf"
                        className="hidden"
                        onChange={(e) => ingestProofFile(e.target.files?.[0] ?? null)}
                      />
                      <svg className="mb-2 h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Click or drag file to upload</p>
                      <p className="mt-1 text-xs text-gray-400">PNG, JPG, PDF (max. 5MB)</p>
                      {proofName ? <p className="mt-2 text-xs font-semibold text-sky-600 dark:text-sky-400">{proofName}</p> : null}
                    </div>
                  </div>

                  <div className="mt-4">
                    <input
                      value={utrInput}
                      onChange={(e) => setUtrInput(e.target.value)}
                      placeholder="Enter Ref / UTR No. (12 digits)"
                      inputMode="numeric"
                      maxLength={12}
                      className="h-11 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-gray-600 dark:bg-gray-800"
                    />
                  </div>

                  {proofError && <p className="mt-2 text-xs text-red-600">{proofError}</p>}

                  <button
                    type="button"
                    onClick={() => void submitProof()}
                    disabled={proofBusy || !proofDataUrl?.trim()}
                    className="mt-5 h-12 w-full rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 text-sm font-bold text-white shadow-md transition hover:from-sky-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {proofBusy ? "Submitting…" : "I HAVE PAID"}
                  </button>

                  <p className="mt-4 text-center text-[11px] text-gray-400 dark:text-gray-500">
                    Copy ID:{" "}
                    <span className="font-mono text-gray-600 dark:text-gray-400">{request.orderId}</span>{" "}
                    <button
                      type="button"
                      onClick={() => void copyField("receiptFooter", request.orderId)}
                      className="ml-1 font-semibold text-sky-600 underline hover:text-sky-700 dark:text-sky-400"
                    >
                      {copiedKey === "receiptFooter" ? "Copied" : "Copy"}
                    </button>
                  </p>
                </div>
              </div>
            )}

            {request && currentStep === "VERIFY_QUEUE" && (
              <div className="w-full rounded-2xl border border-sky-200 bg-white p-6 text-center shadow-lg dark:border-sky-900 dark:bg-gray-900">
                <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">Proof received</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Copy ID</p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-lg bg-gray-100 px-3 py-2 font-mono text-sm font-semibold text-gray-900 dark:bg-gray-800 dark:text-sky-100">
                    {request.orderId}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyField("copyId", request.orderId)}
                    className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-200 dark:hover:bg-sky-900/60"
                  >
                    {copiedKey === "copyId" ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                  This copy ID is in the verification queue. You will see the final status on this page.
                </p>
              </div>
            )}

            {request && currentStep === "FINAL" && (
              <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-lg dark:border-gray-700 dark:bg-gray-900">
                <p className="text-lg font-bold text-gray-900 dark:text-white">Final status</p>
                <p className="mt-2 font-mono text-sm text-gray-600 dark:text-gray-300">{request.orderId}</p>
                <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-gray-800 dark:text-gray-200">{request.status.replace(/_/g, " ")}</p>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
        }}
        showCloseButton={false}
        closeOnBackdropClick={false}
        closeOnEscape={false}
        className="max-w-sm p-0 shadow-2xl"
      >
        <div className="rounded-3xl bg-white p-8 text-center dark:bg-gray-900">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Payment submitted</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Your copy ID</p>
          <p className="mt-2 break-all rounded-lg bg-gray-100 px-3 py-2 font-mono text-base font-bold text-gray-900 dark:bg-gray-800 dark:text-white">
            {successOrderId ?? "—"}
          </p>
          <button
            type="button"
            onClick={() => successOrderId && void copyField("successModal", successOrderId)}
            className="mt-3 w-full rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {copiedKey === "successModal" ? "Copied to clipboard" : "Copy copy ID"}
          </button>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Tap outside does not close this dialog. Use the button below when you are done.
          </p>
          <button
            type="button"
            onClick={() => setShowSuccessModal(false)}
            className="mt-6 h-11 w-full rounded-xl bg-gray-900 text-sm font-bold text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            OK
          </button>
        </div>
      </Modal>
    </div>
  );
}
