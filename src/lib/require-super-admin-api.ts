import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/session";

/**
 * Guard that only allows SUPER_ADMIN sessions through.
 * Use this on all /api/super-admin/* routes.
 */
export async function requireSuperAdminSession(): Promise<
  { ok: true; adminId: number } | { ok: false; response: NextResponse }
> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 }) };
  }
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const session = token ? verifyAdminSession(token, secret) : null;
  if (!session) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.role !== "SUPER_ADMIN") {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Forbidden: Super Admin access required" }, { status: 403 }) };
  }
  return { ok: true, adminId: session.adminId };
}
