import { createHmac, timingSafeEqual } from "crypto";

export type AdminRole = "SUPER_ADMIN" | "ADMIN";

export type AdminSessionPayload = {
  v: 1;
  adminId: number;
  email: string;
  role: AdminRole;
  exp: number;
};

export type AgentSessionPayload = {
  v: 1;
  agentId: number;
  username: string;
  exp: number;
};

export type CompanySessionPayload = {
  v: 1;
  companyId: number;
  username: string;
  exp: number;
};

export const ADMIN_COOKIE = "tepay_admin";
export const AGENT_COOKIE = "tepay_agent";
export const COMPANY_COOKIE = "tepay_company";

const defaultMaxAgeMs = 7 * 24 * 60 * 60 * 1000;

function signJson(payload: object, secret: string, maxAgeMs: number): string {
  const withExp = { ...payload, exp: Date.now() + maxAgeMs } as { exp: number };
  const body = Buffer.from(JSON.stringify(withExp), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifySignedJson<T extends { exp: number }>(
  token: string,
  secret: string,
  parse: (raw: unknown) => T | null,
): T | null {
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const body = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const raw = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as unknown;
    const data = parse(raw);
    if (!data || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export function signAdminSession(
  input: { adminId: number; email: string; role?: AdminRole },
  secret: string,
  maxAgeMs = defaultMaxAgeMs,
): string {
  const payload: Omit<AdminSessionPayload, "exp"> = {
    v: 1,
    adminId: input.adminId,
    email: input.email,
    role: input.role ?? "SUPER_ADMIN",
  };
  return signJson(payload, secret, maxAgeMs);
}

export function verifyAdminSession(token: string, secret: string): AdminSessionPayload | null {
  return verifySignedJson(token, secret, (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    if (o.v !== 1 || typeof o.adminId !== "number" || typeof o.email !== "string" || typeof o.exp !== "number") {
      return null;
    }
    // Backward compat: tokens without role default to SUPER_ADMIN so existing sessions keep working
    const role: AdminRole = o.role === "ADMIN" ? "ADMIN" : "SUPER_ADMIN";
    return { ...o, role } as unknown as AdminSessionPayload;
  });
}

export function signAgentSession(
  input: { agentId: number; username: string },
  secret: string,
  maxAgeMs = defaultMaxAgeMs,
): string {
  const payload: Omit<AgentSessionPayload, "exp"> = { v: 1, agentId: input.agentId, username: input.username };
  return signJson(payload, secret, maxAgeMs);
}

export function verifyAgentSession(token: string, secret: string): AgentSessionPayload | null {
  return verifySignedJson(token, secret, (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    if (o.v !== 1 || typeof o.agentId !== "number" || typeof o.username !== "string" || typeof o.exp !== "number") {
      return null;
    }
    return o as unknown as AgentSessionPayload;
  });
}

export function signCompanySession(
  input: { companyId: number; username: string },
  secret: string,
  maxAgeMs = defaultMaxAgeMs,
): string {
  const payload: Omit<CompanySessionPayload, "exp"> = { v: 1, companyId: input.companyId, username: input.username };
  return signJson(payload, secret, maxAgeMs);
}

export function verifyCompanySession(token: string, secret: string): CompanySessionPayload | null {
  return verifySignedJson(token, secret, (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    if (o.v !== 1 || typeof o.companyId !== "number" || typeof o.username !== "string" || typeof o.exp !== "number") {
      return null;
    }
    return o as unknown as CompanySessionPayload;
  });
}
