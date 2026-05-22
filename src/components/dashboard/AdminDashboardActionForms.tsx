"use client";

import React, { useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";

export type SubadminOption = {
  id: string;
  name: string;
  security?: number;
  credit?: number;
  running?: number;
  totalSettlement?: number;
  finalBalance?: number;
};

function AgentBalanceInfo({
  agent,
  amount,
  mode,
}: {
  agent?: SubadminOption;
  amount?: string;
  mode?: {
    type: "security" | "settlement" | "credit" | "running";
    action: "plus" | "minus";
  };
}) {
  if (!agent) return null;
  const runningVal = agent.running ?? 0;
  const securityVal = agent.security ?? 0;
  const creditVal = agent.credit ?? 0;
  const settlementVal = agent.totalSettlement ?? 0;
  const previewBalanceVal = agent.finalBalance ?? 0;

  const inputAmt = parseFloat(amount || "0") || 0;

  let currentVal = 0;
  let fieldLabelText = "";
  let badgeColor = "";

  if (mode) {
    if (mode.type === "security") {
      currentVal = securityVal;
      fieldLabelText = "Security Deposit";
      badgeColor = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    } else if (mode.type === "credit") {
      currentVal = creditVal;
      fieldLabelText = "Credit Limit";
      badgeColor = "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    } else if (mode.type === "settlement") {
      currentVal = settlementVal;
      fieldLabelText = "Settlement Balance";
      badgeColor = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    } else if (mode.type === "running") {
      currentVal = runningVal;
      fieldLabelText = "Running Balance";
      badgeColor = "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
    }
  }

  const delta = mode ? (mode.action === "plus" ? inputAmt : -inputAmt) : 0;
  const projectedVal = currentVal + delta;

  // Let's compute projected preview balance
  let projRunning = runningVal;
  let projSecurity = securityVal;
  let projSettlement = settlementVal;

  if (mode && inputAmt > 0) {
    const deltaVal = mode.action === "plus" ? inputAmt : -inputAmt;
    if (mode.type === "running") {
      projRunning = runningVal + deltaVal;
    } else if (mode.type === "security") {
      projSecurity = securityVal + deltaVal;
    } else if (mode.type === "settlement") {
      // Settlement always increases settlement_amount by absolute amount
      projSettlement = settlementVal + inputAmt;
      // But it updates running_balance: running_balance - signed
      // Debit (action === "minus"): running_balance - (-amount) = running_balance + amount
      // Credit (action === "plus"): running_balance - amount
      if (mode.action === "minus") {
        projRunning = runningVal + inputAmt;
      } else {
        projRunning = runningVal - inputAmt;
      }
    }
  }

  return (
    <div className="mb-3 space-y-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 p-3">
      {/* Current Balances Grid */}
      <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
        <div>Current Balances</div>
        <div className="text-right">Value</div>
      </div>
      <div className="space-y-1 text-[10px] font-medium text-gray-700 dark:text-gray-300">
        <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
          <span>Security Deposit:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            ₹{securityVal.toLocaleString("en-IN")}
            {projSecurity !== securityVal && (
              <span className="ml-1 text-[9px] text-amber-600 dark:text-amber-400">
                → ₹{projSecurity.toLocaleString("en-IN")}
              </span>
            )}
          </span>
        </div>
        <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
          <span>Credit Limit:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            ₹{creditVal.toLocaleString("en-IN")}
            {mode?.type === "credit" && inputAmt > 0 && (
              <span className="ml-1 text-[9px] text-amber-600 dark:text-amber-400">
                → ₹{projectedVal.toLocaleString("en-IN")}
              </span>
            )}
          </span>
        </div>
        <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
          <span>Running Balance:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            ₹{runningVal.toLocaleString("en-IN")}
            {projRunning !== runningVal && (
              <span className="ml-1 text-[9px] text-amber-600 dark:text-amber-400">
                → ₹{projRunning.toLocaleString("en-IN")}
              </span>
            )}
          </span>
        </div>
        <div className="flex justify-between py-0.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
          <span>Settlement Balance:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            ₹{settlementVal.toLocaleString("en-IN")}
            {projSettlement !== settlementVal && (
              <span className="ml-1 text-[9px] text-amber-600 dark:text-amber-400">
                → ₹{projSettlement.toLocaleString("en-IN")}
              </span>
            )}
          </span>
        </div>
        <div className="flex justify-between py-1 border-t border-dashed border-gray-200 dark:border-gray-700 mt-1.5 pt-1.5">
          <span className="font-semibold text-amber-700 dark:text-amber-400">Preview Balance (Yesterday's Running):</span>
          <span className="font-bold text-amber-800 dark:text-amber-300">
            ₹{previewBalanceVal.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Dynamic Live Preview / Projection */}
      {mode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20 p-2.5 mt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-amber-800 dark:text-amber-300">Projected {fieldLabelText}:</span>
            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${badgeColor}`}>
              {mode.action === "plus" ? "Credit (+)" : "Debit (-)"}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              ₹{currentVal.toLocaleString("en-IN")} {mode.action === "plus" ? "+" : "-"} ₹{inputAmt.toLocaleString("en-IN")}
            </span>
            <span className="text-sm font-bold text-amber-950 dark:text-amber-200">
              ₹{projectedVal.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const fieldInput =
  "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:placeholder:text-gray-500";
const fieldSelect =
  `${fieldInput} dark:scheme-dark [&>option]:bg-gray-900 [&>option]:text-gray-200 [&>option:checked]:bg-brand-600 [&>option:checked]:text-white`;
const fieldTextarea =
  "min-h-[88px] w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/3 dark:text-gray-200 dark:placeholder:text-gray-500";
const fieldLabel = "mb-1.5 block text-xs font-semibold text-gray-800 dark:text-gray-200";

function todayInputDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ModalFooter({
  onCancel,
  submitLabel,
  onSubmit,
}: {
  onCancel: () => void;
  submitLabel: string;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-theme-xs hover:bg-brand-600"
      >
        {submitLabel}
      </button>
    </div>
  );
}

function SubadminSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SubadminOption[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={fieldSelect}
    >
      <option value="" className="bg-white text-gray-500 dark:bg-gray-900 dark:text-gray-400">
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o.id} value={o.id} className="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-200">
          {o.name}
        </option>
      ))}
    </select>
  );
}

function CsvDropZone({
  title,
  hint,
  subtitle,
  accept = ".csv",
  onFile,
}: {
  title: string;
  hint?: React.ReactNode;
  subtitle?: string;
  accept?: string;
  onFile?: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const pick = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    onFile?.(file);
  };

  return (
    <div>
      {hint}
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pick(e.dataTransfer.files[0]);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 transition-colors ${dragOver
          ? "border-brand-400 bg-brand-50/50 dark:border-brand-500 dark:bg-brand-500/10"
          : "border-gray-300 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-900/40"
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <svg
          className="mb-3 h-8 w-8 text-amber-600 dark:text-amber-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
          />
        </svg>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{title}</p>
        {subtitle && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
        {!subtitle && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Click to browse or drag and drop</p>
        )}
        {fileName && (
          <p className="mt-2 text-xs font-medium text-brand-600 dark:text-brand-400">{fileName}</p>
        )}
      </div>
    </div>
  );
}

function AccountTypeRadios({
  name,
  value,
  onChange,
}: {
  name: string;
  value: "security" | "settlement";
  onChange: (v: "security" | "settlement") => void;
}) {
  return (
    <div className="flex flex-wrap gap-4 pt-1">
      {(["security", "settlement"] as const).map((opt) => (
        <label key={opt} className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="radio"
            name={name}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="h-4 w-4 border-gray-300 text-brand-500 focus:ring-brand-500/30"
          />
          <span className="capitalize">{opt === "security" ? "Security" : "Settlement"}</span>
        </label>
      ))}
    </div>
  );
}

function TxTypeRadios({
  value,
  onChange,
}: {
  value: "debit" | "credit";
  onChange: (v: "debit" | "credit") => void;
}) {
  return (
    <div className="flex flex-wrap gap-4 pt-1">
      {(["debit", "credit"] as const).map((opt) => (
        <label key={opt} className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="radio"
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="h-4 w-4 border-gray-300 text-brand-500 focus:ring-brand-500/30"
          />
          <span className="capitalize">{opt}</span>
        </label>
      ))}
    </div>
  );
}

function FormShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  );
}

/* ── Modals ── */

export function InterledgerEntryModal({
  isOpen,
  onClose,
  subadmins,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  subadmins: SubadminOption[];
  onSuccess?: () => void;
}) {
  const [transferDate, setTransferDate] = useState(() => todayInputDate());
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [sourceType, setSourceType] = useState<"security" | "settlement">("security");
  const [destType, setDestType] = useState<"security" | "settlement">("security");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTransferDate(todayInputDate());
    setSourceId("");
    setDestId("");
    setSourceType("security");
    setDestType("security");
    setAmount("");
    setNotes("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!sourceId || !destId || !amount) {
      setError("Please fill all required fields.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/interledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transferDate,
          sourceId,
          destId,
          sourceType,
          destType,
          amount,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Failed to execute transfer.");
        setBusy(false);
        return;
      }
      handleClose();
      onSuccess?.();
    } catch (err) {
      setError("Network error occurred.");
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-2xl p-6 lg:p-8">
      <FormShell title="Add Interledger Entry">
        <div className="rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-2.5 text-xs leading-relaxed text-amber-900/90 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-amber-100/90">
          <span className="font-semibold">Note:</span> Transfer funds between different subadmin accounts and
          account types (Security ⇄ Settlement). The source account will be debited and destination account will be
          credited.
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-900/40">
            {error}
          </div>
        )}

        <div>
          <label className={fieldLabel}>Transfer Date</label>
          <input
            type="date"
            value={transferDate}
            onChange={(e) => setTransferDate(e.target.value)}
            className={fieldInput}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900/40 dark:bg-red-950/20">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                −
              </span>
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">From (Debit)</span>
            </div>
            <div className="mb-3">
              <label className={fieldLabel}>Source Subadmin</label>
              <SubadminSelect
                value={sourceId}
                onChange={setSourceId}
                options={subadmins}
                placeholder="Source subadmin"
              />
            </div>
            <div>
              <label className={fieldLabel}>Source Account Type</label>
              <AccountTypeRadios name="source-acct" value={sourceType} onChange={setSourceType} />
            </div>
          </div>

          <div className="rounded-xl border border-green-200 bg-green-50/60 p-4 dark:border-green-900/40 dark:bg-green-950/20">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
                +
              </span>
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">To (Credit)</span>
            </div>
            <div className="mb-3">
              <label className={fieldLabel}>Destination Subadmin</label>
              <SubadminSelect
                value={destId}
                onChange={setDestId}
                options={subadmins}
                placeholder="Destination subadmin"
              />
            </div>
            <div>
              <label className={fieldLabel}>Destination Account Type</label>
              <AccountTypeRadios name="dest-acct" value={destType} onChange={setDestType} />
            </div>
          </div>
        </div>

        <div>
          <label className={fieldLabel}>Transfer Amount</label>
          {/* <div className="space-y-4">
            {sourceId && (
              <div>
                <span className="mb-1 block text-xs font-semibold text-red-600 dark:text-red-400">Debit Source preview</span>
                <AgentBalanceInfo 
                  agent={subadmins.find(s => s.id === sourceId)} 
                  amount={amount}
                  mode={{ type: sourceType, action: "minus" }}
                />
              </div>
            )}
            {destId && (
              <div>
                <span className="mb-1 block text-xs font-semibold text-green-600 dark:text-green-400">Credit Destination preview</span>
                <AgentBalanceInfo 
                  agent={subadmins.find(s => s.id === destId)} 
                  amount={amount}
                  mode={{ type: destType, action: "plus" }}
                />
              </div>
            )}
          </div> */}
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount to transfer"
            className={fieldInput}
          />
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Enter the amount to transfer</p>
        </div>

        <div>
          <label className={fieldLabel}>Transfer Notes / Remarks</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add custom transfer description or reference notes (optional)"
            className={fieldTextarea}
            rows={3}
          />
        </div>
      </FormShell>
      <ModalFooter onCancel={handleClose} submitLabel={busy ? "Processing..." : "Execute Transfer"} onSubmit={handleSubmit} />
    </Modal>
  );
}

export function SecurityDepositModal({
  isOpen,
  onClose,
  subadmins,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  subadmins: SubadminOption[];
  onSuccess?: () => void;
}) {
  const [subadminId, setSubadminId] = useState("");
  const [depositDate, setDepositDate] = useState(() => todayInputDate());
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [txType, setTxType] = useState<"debit" | "credit">("credit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setSubadminId("");
    setDepositDate(todayInputDate());
    setAmount("");
    setRemarks("");
    setTxType("credit");
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!subadminId || !amount) {
      setError("Please select a subadmin and enter an amount.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/security-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subadminId, amount, remarks, txType, date: depositDate }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Failed to add security deposit.");
        setBusy(false);
        return;
      }
      handleClose();
      onSuccess?.();
    } catch (err) {
      setError("Network error occurred.");
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-lg p-6 lg:p-8">
      <FormShell title="Add Security Deposit">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-900/40">
            {error}
          </div>
        )}
        <div>
          <label className={fieldLabel}>Subadmin</label>
          <SubadminSelect
            value={subadminId}
            onChange={setSubadminId}
            options={subadmins}
            placeholder="Search and select subadmin"
          />
        </div>
        <div>
          <label className={fieldLabel}>Deposit Date</label>
          <input
            type="date"
            value={depositDate}
            onChange={(e) => setDepositDate(e.target.value)}
            className={fieldInput}
          />
        </div>
        <div>
          <label className={fieldLabel}>Amount</label>
          {/* <AgentBalanceInfo
            agent={subadmins.find(s => s.id === subadminId)}
            amount={amount}
            mode={{ type: "security", action: txType === "credit" ? "plus" : "minus" }}
          /> */}
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter deposit amount"
            className={fieldInput}
          />
        </div>
        <div>
          <label className={fieldLabel}>Remarks (optional)</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Add any comments or notes"
            className={fieldTextarea}
            rows={3}
          />
        </div>
        <div>
          <label className={fieldLabel}>Transaction Type</label>
          <TxTypeRadios value={txType} onChange={setTxType} />
        </div>
      </FormShell>
      <ModalFooter onCancel={handleClose} submitLabel={busy ? "Processing..." : "Submit Deposit"} onSubmit={handleSubmit} />
    </Modal>
  );
}

export function SettlementModal({
  isOpen,
  onClose,
  subadmins,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  subadmins: SubadminOption[];
  onSuccess?: () => void;
}) {
  const [subadminId, setSubadminId] = useState("");
  const [settlementDate, setSettlementDate] = useState(() => todayInputDate());
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [txType, setTxType] = useState<"debit" | "credit">("debit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setSubadminId("");
    setSettlementDate(todayInputDate());
    setAmount("");
    setRemarks("");
    setTxType("debit");
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!subadminId) {
      setError("Please select a subadmin.");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const dayStart = new Date(settlementDate);
      const dayEnd = new Date(settlementDate + "T23:59:59");
      const res = await fetch("/api/admin/settlements", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyType: "AGENT",
          partyId: Number(subadminId),
          settlementDate,
          periodFrom: dayStart.toISOString(),
          periodTo: dayEnd.toISOString(),
          remark: remarks,
          settlementType: "NET",
          commissionHead: "ALL",
          transactionType: txType.toUpperCase(),
          settlementFrequency: "manual",
          settlementStatus: "settled",
          finalSettlementAmount: amt,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Failed to add settlement.");
        setBusy(false);
        return;
      }
      handleClose();
      onSuccess?.();
    } catch (err) {
      setError("Network error occurred.");
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-lg p-6 lg:p-8">
      <FormShell title="Add Settlement">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-900/40">
            {error}
          </div>
        )}
        <div>
          <label className={fieldLabel}>Subadmin</label>
          <SubadminSelect
            value={subadminId}
            onChange={setSubadminId}
            options={subadmins}
            placeholder="Search and select subadmin"
          />
        </div>
        <div>
          <label className={fieldLabel}>Settlement Date</label>
          <input
            type="date"
            value={settlementDate}
            onChange={(e) => setSettlementDate(e.target.value)}
            className={fieldInput}
          />
        </div>
        <div>
          <label className={fieldLabel}>Amount</label>
          {/* <AgentBalanceInfo
            agent={subadmins.find(s => s.id === subadminId)}
            amount={amount}
            mode={{ type: "settlement", action: txType === "credit" ? "plus" : "minus" }}
          /> */}
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter settlement amount"
            className={fieldInput}
          />
        </div>
        <div>
          <label className={fieldLabel}>Remarks</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Add any comments or notes"
            className={fieldTextarea}
            rows={3}
          />
        </div>
        <div>
          <label className={fieldLabel}>Transaction Type</label>
          <TxTypeRadios value={txType} onChange={setTxType} />
        </div>
      </FormShell>
      <ModalFooter onCancel={handleClose} submitLabel={busy ? "Processing..." : "Submit Settlement"} onSubmit={handleSubmit} />
    </Modal>
  );
}

export function CommissionSettlementCsvModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg p-6 lg:p-8">
      <h2 className="border-b border-gray-100 pb-4 text-base font-semibold text-gray-900 dark:border-gray-800 dark:text-white">
        Commission Settlement (CSV)
      </h2>
      <div className="mt-4">
        <CsvDropZone
          title="Click to browse or drag and drop CSV"
          hint={
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Upload a CSV with headers: <strong>Vendor, Amount, Cmsn.</strong> The <em>Cmsn</em> value is used as the
              settlement amount; the <em>Amount</em> value is included in the remarks.
            </p>
          }
        />
      </div>
      <ModalFooter onCancel={onClose} submitLabel="Upload" onSubmit={onClose} />
    </Modal>
  );
}

const purpleIcon = "inline-flex h-4 w-4 text-brand-500";

export function ManualDepositModal({
  isOpen,
  onClose,
  subadmins,
}: {
  isOpen: boolean;
  onClose: () => void;
  subadmins: SubadminOption[];
}) {
  const [customerName, setCustomerName] = useState("");
  const [utr, setUtr] = useState("");
  const [amount, setAmount] = useState("");
  const [subadminId, setSubadminId] = useState("");
  const [depositDate, setDepositDate] = useState(() => todayInputDate());

  const handleClose = () => {
    setCustomerName("");
    setUtr("");
    setAmount("");
    setSubadminId("");
    setDepositDate(todayInputDate());
    onClose();
  };

  const labelWithIcon = (icon: React.ReactNode, text: string) => (
    <span className={`${fieldLabel} flex items-center gap-1.5`}>
      <span className={purpleIcon}>{icon}</span>
      {text}
    </span>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-2xl p-6 lg:p-8">
      <FormShell title="Manual Deposit">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            {labelWithIcon(
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>,
              "Customer Name",
            )}
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name"
              className={fieldInput}
            />
          </div>
          <div>
            {labelWithIcon(
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4M9 6l-3 6 3 6" />
              </svg>,
              "UTR",
            )}
            <input
              type="text"
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="Enter UTR number (12-22 characters)"
              className={fieldInput}
            />
          </div>
          <div>
            {labelWithIcon(
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 12v-2" />
              </svg>,
              "Amount",
            )}
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className={fieldInput}
            />
          </div>
          <div>
            {labelWithIcon(
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>,
              "Subadmin",
            )}
            <SubadminSelect
              value={subadminId}
              onChange={setSubadminId}
              options={subadmins}
              placeholder="Search and select subadmin"
            />
          </div>
          <div className="sm:col-span-1">
            {labelWithIcon(
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>,
              "Deposit Date",
            )}
            <input
              type="date"
              value={depositDate}
              onChange={(e) => setDepositDate(e.target.value)}
              className={fieldInput}
            />
          </div>
        </div>
      </FormShell>
      <ModalFooter onCancel={handleClose} submitLabel="Create" onSubmit={handleClose} />
    </Modal>
  );
}

/** Inline panel — appears above the financial statistics table */
export function ManualPayInInlinePanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="border-b border-gray-100 bg-white px-5 py-4 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-gray-500 dark:text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Upload Manual PayIn</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/50 p-6 dark:border-gray-800 dark:bg-gray-900/30">
        <CsvDropZone title="Manual PayIn CSV" subtitle="Click to browse or drag and drop" />
      </div>
    </div>
  );
}
