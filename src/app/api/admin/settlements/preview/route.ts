import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import {
  buildSettlementPreview,
  isSettlementTableMissing,
  parseOptionalDate,
  SETTLEMENT_MIGRATION_HINT,
  type SettlementPartyType,
} from "@/lib/settlement";
import { requireAdminPermission } from "@/lib/require-admin-api";

export async function GET(req: Request) {
  const auth = await requireAdminPermission("view_settlements");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const partyTypeRaw = searchParams.get("partyType")?.trim().toUpperCase() ?? "";
  const partyId = Number(searchParams.get("partyId"));
  if ((partyTypeRaw !== "AGENT" && partyTypeRaw !== "COMPANY") || !Number.isInteger(partyId) || partyId < 1) {
    return NextResponse.json(
      { ok: false, error: "partyType=AGENT|COMPANY and partyId required" },
      { status: 400 },
    );
  }

  const periodFrom = parseOptionalDate(searchParams.get("periodFrom"));
  const periodTo = parseOptionalDate(searchParams.get("periodTo"));

  try {
    const preview = await buildSettlementPreview(
      pool,
      partyTypeRaw as SettlementPartyType,
      partyId,
      periodFrom,
      periodTo,
    );
    if (!preview) {
      return NextResponse.json({ ok: false, error: "Party not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true as const, preview });
  } catch (e: unknown) {
    if (isSettlementTableMissing(e)) {
      return NextResponse.json({ ok: false, error: SETTLEMENT_MIGRATION_HINT }, { status: 503 });
    }
    console.error(e);
    return NextResponse.json({ ok: false, error: "Could not build settlement preview" }, { status: 500 });
  }
}
