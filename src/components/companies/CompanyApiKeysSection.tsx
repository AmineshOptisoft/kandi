"use client";

import React, { useCallback, useEffect, useState } from "react";
import { copyTextToClipboard } from "@/lib/copy-clipboard";

type ApiKeyItem = {
  id: string;
  label: string;
  keyPreview: string;
  status: "ACTIVE" | "REVOKED";
  createdAtIso: string | null;
  lastUsedAtIso: string | null;
};

type Props = {
  companyId?: string;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function CompanyApiKeysSection({ companyId }: Props) {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [newFullKey, setNewFullKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const listUrl = companyId ? `/api/companies/${companyId}/api-keys` : "/api/company/api-keys";
  const revokeUrl = (keyId: string) =>
    companyId ? `/api/companies/${companyId}/api-keys/${keyId}` : `/api/company/api-keys/${keyId}`;

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(listUrl, { credentials: "include" });
      const data = (await res.json()) as { ok?: boolean; keys?: ApiKeyItem[]; error?: string };
      if (!res.ok || !data.ok || !data.keys) {
        setError(data.error ?? "Could not load API keys");
        setKeys([]);
        return;
      }
      setKeys(data.keys);
    } catch {
      setError("Network error");
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, [listUrl]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(listUrl, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || "Untitled" }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        key?: ApiKeyItem;
        fullKey?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.key || !data.fullKey) {
        setError(data.error ?? "Could not create API key");
        return;
      }
      setKeys((prev) => [data.key!, ...prev]);
      setNewFullKey(data.fullKey);
      setLabel("");
    } catch {
      setError("Network error");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    if (!window.confirm("Revoke this API key? It will stop working immediately.")) return;
    setRevokingId(keyId);
    setError(null);
    try {
      const res = await fetch(revokeUrl(keyId), {
        method: "PATCH",
        credentials: "include",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not revoke API key");
        return;
      }
      setKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, status: "REVOKED" } : k)));
    } catch {
      setError("Network error");
    } finally {
      setRevokingId(null);
    }
  }

  async function copyNewKey() {
    if (!newFullKey) return;
    const ok = await copyTextToClipboard(newFullKey);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <h3 className="text-sm font-bold text-gray-800 dark:text-white">API Keys</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          The company can add multiple API keys. When the PayIn status changes, the webhook will be sent to the platform’s fixed URL.        </p>
      </div>

      <div className="space-y-4 p-5">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </p>
        )}

        <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Key label
            </label>
            <input
              value={label}
              required
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Website, Mobile App, Partner-1"
              maxLength={100}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
          >
            {creating ? "Creating…" : "Generate API Key"}
          </button>
        </form>

        {newFullKey && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-200">
              Copy your new API key now
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              This key will only be shown once. The full key will not be available again later.            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="flex-1 break-all rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-mono text-gray-800 dark:border-amber-900/40 dark:bg-gray-950 dark:text-gray-100">
                {newFullKey}
              </code>
              <button
                type="button"
                onClick={copyNewKey}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/30"
              >
                {copied ? "Copied" : "Copy key"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setNewFullKey(null)}
              className="mt-3 text-xs font-medium text-amber-800 underline dark:text-amber-200"
            >
              I have saved it
            </button>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50/80 dark:bg-white/[0.02]">
              <tr>
                {["Label", "Key", "Status", "Created", "Last used", "Action"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    Loading API keys…
                  </td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    No API keys yet. Generate one above.
                  </td>
                </tr>
              ) : (
                keys.map((key) => (
                  <tr key={key.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{key.label}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{key.keyPreview}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${key.status === "ACTIVE"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                          }`}
                      >
                        {key.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{formatWhen(key.createdAtIso)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{formatWhen(key.lastUsedAtIso)}</td>
                    <td className="px-4 py-3">
                      {key.status === "ACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => handleRevoke(key.id)}
                          disabled={revokingId === key.id}
                          className="text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-60"
                        >
                          {revokingId === key.id ? "Revoking…" : "Revoke"}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Header: <code className="font-mono">x-api-key: **************</code>
          <br />
          Create: <code className="font-mono">POST /api/v1/payin/create</code>
          <br />
          Status: <code className="font-mono">GET /api/v1/payin/status/[id]</code>
          <br />
          Webhook: create / proof / approve / reject Auto POST (platform fixed URL)
          <br />
          Signature verify: HMAC-SHA256 with webhook signing secret (admin provides)
        </p>
      </div>
    </div>
  );
}
