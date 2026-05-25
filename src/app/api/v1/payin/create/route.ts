import { NextResponse } from "next/server";
import { createMerchantPayIn, merchantError } from "@/lib/merchant-payin-api";
import { requireCompanyApiKey } from "@/lib/require-company-api-key";

function requestOrigin(req: Request): string {
  return process.env.APP_URL?.trim() || new URL(req.url).origin;
}

function parseCreateBody(body: Record<string, unknown>) {
  const amountRaw = body.amount;
  const amount =
    typeof amountRaw === "number"
      ? amountRaw
      : typeof amountRaw === "string"
        ? Number.parseFloat(amountRaw)
        : NaN;
  const return_url = typeof body.return_url === "string" ? body.return_url.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const methodRaw = typeof body.method === "string" ? body.method.trim().toUpperCase() : "";
  const method: "UPI" | "BANK" = methodRaw === "BANK" ? "BANK" : "UPI";
  return { amount, return_url: return_url || null, note: note || null, method };
}

export async function POST(req: Request) {
  const auth = await requireCompanyApiKey(req);
  if (!auth.ok) {
    const err = await auth.response.json().catch(() => ({}));
    const message =
      typeof (err as { error?: unknown }).error === "string"
        ? String((err as { error: string }).error)
        : "Unauthorized (Invalid API Key)";
    return NextResponse.json({ success: false, message }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    const e = merchantError("Invalid JSON body", 400);
    return NextResponse.json(e.body, { status: e.status });
  }

  const input = parseCreateBody(body);
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    const e = merchantError("Valid amount is required", 400);
    return NextResponse.json(e.body, { status: e.status });
  }
  if (!Number.isInteger(input.amount)) {
    const e = merchantError("amount must be an integer", 400);
    return NextResponse.json(e.body, { status: e.status });
  }

  const result = await createMerchantPayIn(auth.company, input, requestOrigin(req));
  return NextResponse.json(result.body, { status: result.status });
}
