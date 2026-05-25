"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import CreateCompanyModal from "./CreateCompanyModal";
import LogoImagePicker from "./LogoImagePicker";
import Pagination from "../ui/Pagination";
import { GoOrganization } from "react-icons/go";
import DateRangePicker, { DateRange } from "@/components/dashboard/DateRangePicker";
import { appendDateRangeToUrl, toInputDate } from "@/lib/date-range";
import { CompaniesIcon } from "@/icons/nav-icons";

export type Company = {
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
  today_pay_in: number;
  today_pay_out: number;
};

interface EditModalProps {
  company: Company;
  onClose: () => void;
  onSaved: () => void;
}

function displayStatus(s: string): string {
  switch (s) {
    case "ACTIVE":
      return "Active";
    case "DEACTIVATED":
      return "Deactivated";
    case "PENDING":
      return "Pending";
    case "BLOCKED":
      return "Blocked";
    default:
      return s;
  }
}

function statusBadgeClass(s: string) {
  if (s === "ACTIVE") {
    return "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400";
  }
  if (s === "PENDING") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  }
  if (s === "BLOCKED") {
    return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
  }
  return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
}

function EditModal({ company, onClose, onSaved }: EditModalProps) {
  const [form, setForm] = useState({
    username: company.username,
    brand_name: company.brand_name,
    company_code: company.company_code ?? "",
    commission: String(company.commission ?? 0),
    logo: company.logo ?? "",
    status: company.status,
    newPassword: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return;
    }
    const u = URL.createObjectURL(logoFile);
    setLogoPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [logoFile]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const inputCls =
    "w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors";
  const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5";

  async function save() {
    setError(null);
    if (!form.username.trim()) { setError("Username is required."); return; }
    if (!form.brand_name.trim()) { setError("Brand name is required."); return; }
    if (form.newPassword.trim() && form.newPassword.length < 6) { setError("New password must be at least 6 characters."); return; }
    setSaving(true);
    try {
      if (logoFile) {
        const fd = new FormData();
        fd.append("file", logoFile);
        const up = await fetch(`/api/companies/${company.id}/logo`, {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const upData = (await up.json()) as { ok?: boolean; error?: string };
        if (!up.ok || !upData.ok) {
          setError(upData.error ?? "Logo upload failed.");
          return;
        }
      }

      const body: Record<string, unknown> = {
        username: form.username.trim(),
        brand_name: form.brand_name.trim(),
        company_code: form.company_code.trim() || null,
        commission: form.commission,
        status: form.status,
      };
      if (!logoFile) {
        body.logo = form.logo.trim() || null;
      }
      if (form.newPassword.trim()) {
        body.password = form.newPassword;
      }
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Save failed.");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  const pickerDisplay =
    logoPreview ??
    (form.logo.trim() && (form.logo.startsWith("http") || form.logo.startsWith("/")) ? form.logo.trim() : null) ??
    (company.logo && (company.logo.startsWith("http") || company.logo.startsWith("/")) ? company.logo : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Edit company — {company.username}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="sm:col-span-2 text-sm text-error-500 dark:text-error-400" role="alert">
              {error}
            </div>
          )}
          <div className="sm:col-span-2">
            <label className={labelCls}>Username <span className="text-red-500">*</span></label>
            <input value={form.username} onChange={set("username")} className={inputCls} disabled={saving} required />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Brand name <span className="text-red-500">*</span></label>
            <input value={form.brand_name} onChange={set("brand_name")} className={inputCls} disabled={saving} required />
          </div>
          <div>
            <label className={labelCls}>Company code</label>
            <input value={form.company_code} onChange={set("company_code")} className={inputCls} disabled={saving} />
          </div>
          <div>
            <label className={labelCls}>Commission (%)</label>
            <input value={form.commission} onChange={set("commission")} className={inputCls} disabled={saving} placeholder="e.g. 2 or 1.5%" />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select value={form.status} onChange={set("status")} className={inputCls} disabled={saving}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING">PENDING</option>
              <option value="DEACTIVATED">DEACTIVATED</option>
              <option value="BLOCKED">BLOCKED</option>
            </select>
          </div>
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div>
              <label className={labelCls}>Logo</label>
              <LogoImagePicker
                compact
                previewSrc={pickerDisplay}
                disabled={saving}
                uploading={false}
                onFile={(f) => {
                  setLogoFile(f);
                  setForm((p) => ({ ...p, logo: "" }));
                }}
              />
              {logoFile && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setLogoFile(null)}
                  className="mt-1 text-xs font-medium text-gray-500 underline hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Remove selected image
                </button>
              )}
            </div>
            {/* <div>
              <label className={labelCls}>Or logo URL</label>
              <input
                value={form.logo}
                onChange={(e) => {
                  setLogoFile(null);
                  setForm((p) => ({ ...p, logo: e.target.value }));
                }}
                className={inputCls}
                placeholder="https://… or /uploads/…"
                disabled={saving}
              />
            </div> */}
          </div>
          {/* <div className="sm:col-span-2">
            <label className={labelCls}>New password (optional)</label>
            <input
              type="password"
              value={form.newPassword}
              onChange={set("newPassword")}
              className={inputCls}
              placeholder="Leave blank to keep current"
              disabled={saving}
            />
          </div> */}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white transition-colors shadow-sm"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

const fmt = (n: number) => "₹\u00A0" + n.toLocaleString("en-IN");

function InfoTip({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[9px] font-bold cursor-help ml-1"
    >
      i
    </span>
  );
}

import { useAuth } from "@/context/AuthContext";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";

export default function CompaniesList() {
  const { loading: authLoading } = useAuth();
  const { can, loading: permLoading } = useAdminPermissions();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [removeSubmitting, setRemoveSubmitting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [periodMetrics, setPeriodMetrics] = useState(false);

  useEffect(() => {
    if (!removeConfirmId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRemoveConfirmId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [removeConfirmId]);

  const load = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    setLoadError(null);
    try {
      // When no date range selected, send empty strings so backend returns company table data directly
      const from = dateRange?.from ? toInputDate(dateRange.from) : "";
      const to = dateRange?.to ? toInputDate(dateRange.to) : "";
      const res = await fetch(appendDateRangeToUrl("/api/companies", from, to), {
        credentials: "include",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        companies?: Company[];
        error?: string;
        dateRangeActive?: boolean;
      };
      if (res.status === 401) {
        setLoadError("Admin sign-in required.");
        setCompanies([]);
        return;
      }
      if (!res.ok || !data.ok || !data.companies) {
        setLoadError(data.error ?? "Could not load companies.");
        setCompanies([]);
        return;
      }
      setCompanies(data.companies);
      setPeriodMetrics(Boolean(data.dateRangeActive));
    } catch {
      setLoadError("Network error.");
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange, authLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleStatus = async (c: Company) => {
    const next = c.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE";
    try {
      const res = await fetch(`/api/companies/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setLoadError(data.error ?? "Could not update status.");
        return;
      }
      await load();
    } catch {
      setLoadError("Network error.");
    }
  };

  const confirmRemoveCompany = useCallback(async () => {
    if (!removeConfirmId) return;
    setRemoveSubmitting(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/companies/${removeConfirmId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setLoadError(data.error ?? "Could not delete company.");
        return;
      }
      setRemoveConfirmId(null);
      await load();
    } catch {
      setLoadError("Network error.");
    } finally {
      setRemoveSubmitting(false);
    }
  }, [removeConfirmId, load]);

  const filtered = companies.filter(
    (c) =>
      !search ||
      c.username.toLowerCase().includes(search.toLowerCase()) ||
      (c.company_code && c.company_code.toLowerCase().includes(search.toLowerCase())) ||
      c.brand_name.toLowerCase().includes(search.toLowerCase()),
  );

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, filtered.length);

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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white">
          <CompaniesIcon />
          <h1 className="text-xl font-bold">Companies Management</h1>
        </div>
        <div className="w-full sm:w-1/2 md:w-1/3 lg:w-1/4 ml-auto flex items-center justify-end">
        <DateRangePicker
          value={dateRange}
          onChange={(r) => {
            setDateRange(r);
            setPage(1);
          }}
          fullWidth
        />
      </div>
        {can("create_companies") && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            disabled={!!loadError && companies.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-green-600 hover:bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm shrink-0 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add New Company
          </button>
        )}
        
      </div>

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          {loadError}{" "}
          <Link href="/signin/admin" className="font-semibold underline">
            Sign in as admin
          </Link>
        </div>
      )}
    
      {periodMetrics && (
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
          In/Out column shows pay-in and pay-out totals for the selected date range.
        </p>
      )}

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="relative w-64">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search companies..."
              className="w-full rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 pl-9 pr-4 py-2 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
            />
          </div>
          
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-white/[0.02]">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 w-12">#</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Company <InfoTip text="Login username and company code" />
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {periodMetrics ? "Period (In/Out)" : "Today (In/Out)"}{" "}
                  <InfoTip
                    text={
                      periodMetrics
                        ? "Pay-in and pay-out totals for the selected date range"
                        : "Today's pay-in and pay-out totals"
                    }
                  />
                </th>
                {/* <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Net volume (In/Out) <InfoTip text="From database net_pay_in / net_pay_out" />
                </th> */}
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Status <InfoTip text="Account status" />
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Commission</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Brand Name</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Logo</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-14 text-center text-gray-400 dark:text-gray-500">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-14 text-center text-gray-400 dark:text-gray-500">
                    Data not available
                  </td>
                </tr>
              ) : (
                paginated.map((c, idx) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/companies/${c.company_code || c.id}`}
                        className="text-sm font-semibold text-blue-500 block leading-tight hover:underline"
                      >
                        {c.username}
                      </Link>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {c.company_code ? `Code: ${c.company_code}` : "No code"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">In:</span>
                          <span className="rounded px-1.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            {fmt(c.today_pay_in ?? 0)}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Out:</span>
                          <span className="rounded px-1.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            {fmt(c.today_pay_out ?? 0)}
                          </span>
                        </span>
                      </div>
                    </td>
                    {/* <td className="px-5 py-4">
                      <div className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-300">
                        <span>
                          <span className="text-gray-400">PayIn:</span> {fmt(c.net_pay_in)}
                        </span>
                        <span>
                          <span className="text-gray-400">PayOut:</span> {fmt(c.net_pay_out)}
                        </span>
                      </div>
                    </td> */}
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center rounded-lg px-3 py-1 text-xs font-semibold ${statusBadgeClass(c.status)}`}>
                        {displayStatus(c.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{`${Number(c.commission) || 0}%`}</td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{c.brand_name || "—"}</td>
                    <td className="px-5 py-4">
                      {c.logo &&
                        (c.logo.startsWith("http://") ||
                          c.logo.startsWith("https://") ||
                          c.logo.startsWith("/") ||
                          c.logo.startsWith("data:image/")) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.logo} alt="" className="h-8 w-8 rounded object-cover bg-gray-100 dark:bg-gray-800" />
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">No logo</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          href={`/companies/${c.company_code || c.id}`}
                          title="View details"
                          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </Link>
                        {can("edit_companies") && (
                          <button
                            type="button"
                            title="Edit company"
                            onClick={() => setEditCompany(c)}
                            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                        )}
                        {can("deactivate_companies") && (
                          <button
                            type="button"
                            title={c.status === "ACTIVE" ? "Deactivate" : "Activate"}
                            onClick={() => void toggleStatus(c)}
                            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${c.status === "ACTIVE"
                              ? "text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
                              : "text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
                              }`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}
                        {can("delete_companies") && (
                          <button
                            type="button"
                            title="Delete company"
                            onClick={() => setRemoveConfirmId(c.id)}
                            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-white/[0.02]">
          <p className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
            {filtered.length === 0 ? "No entries" : `Showing ${start} to ${end} of ${filtered.length} entries`}
          </p>
          <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>

      {/* ── Modals ── */}
      {showCreate && (
        <CreateCompanyModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setPage(1);
            void load();
          }}
        />
      )}
      {editCompany && (
        <EditModal
          company={editCompany}
          onClose={() => setEditCompany(null)}
          onSaved={() => {
            void load();
          }}
        />
      )}

      {removeConfirmId !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-company-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px] dark:bg-black/60"
            aria-label="Dismiss"
            onClick={() => setRemoveConfirmId(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <h3 id="remove-company-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              Delete company?
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              This permanently deletes{" "}
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {(() => {
                  const rm = companies.find((c) => c.id === removeConfirmId);
                  return rm ? `${rm.username} (${rm.brand_name || "—"})` : "this company";
                })()}
              </span>
              . This cannot be undone. If linked transactions exist, the server will refuse deletion.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={removeSubmitting}
                onClick={() => setRemoveConfirmId(null)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removeSubmitting}
                onClick={() => void confirmRemoveCompany()}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                {removeSubmitting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
