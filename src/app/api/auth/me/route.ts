import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  AGENT_COOKIE,
  COMPANY_COOKIE,
  verifyAdminSession,
  verifyAgentSession,
  verifyCompanySession,
} from "@/lib/session";

export async function GET() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }

  const store = await cookies();
  const adminToken = store.get(ADMIN_COOKIE)?.value;
  if (adminToken) {
    const adminSess = verifyAdminSession(adminToken, secret);
    if (adminSess) {
      return NextResponse.json({
        ok: true as const,
        role: "admin" as const,
        adminId: adminSess.adminId,
        adminRole: adminSess.role,
      });
    }
  }

  const agentToken = store.get(AGENT_COOKIE)?.value;
  if (agentToken) {
    const agentSess = verifyAgentSession(agentToken, secret);
    if (agentSess) {
      return NextResponse.json({
        ok: true as const,
        role: "agent" as const,
        agentId: agentSess.agentId,
      });
    }
  }

  const companyToken = store.get(COMPANY_COOKIE)?.value;
  if (companyToken) {
    const companySess = verifyCompanySession(companyToken, secret);
    if (companySess) {
      return NextResponse.json({
        ok: true as const,
        role: "company" as const,
        companyId: companySess.companyId,
      });
    }
  }

  return NextResponse.json({ ok: false as const, role: null }, { status: 401 });
}
