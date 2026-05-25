import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2/promise";
import { pool } from "@/lib/db";
import { requireAdminSession } from "@/lib/require-admin-api";

const MAX_BYTES = 2 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export async function POST(req: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const { id: idRaw } = await Promise.resolve(context.params);
  let cid: number | null = null;
  const isNumeric = /^\d+$/.test(idRaw);
  if (isNumeric) {
    cid = Number(idRaw);
  } else {
    const [comp] = await pool.execute<any[]>(
      "SELECT `id` FROM `companies` WHERE `company_code` = ? LIMIT 1",
      [idRaw],
    );
    if (comp[0]) {
      cid = Number(comp[0].id);
    }
  }

  if (!cid || !Number.isInteger(cid) || cid < 1) {
    return NextResponse.json({ ok: false, error: "Company not found" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Expected multipart form" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "File too large (max 2 MB)" }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  const ext = MIME_EXT[mime];
  if (!ext) {
    return NextResponse.json({ ok: false, error: "Only JPEG, PNG, WebP, or GIF allowed" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const filename = `${cid}-${Date.now()}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "companies");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buf);

  const publicUrl = `/uploads/companies/${filename}`;

  const [header] = await pool.execute<ResultSetHeader>("UPDATE `companies` SET `logo` = ? WHERE `id` = ?", [
    publicUrl,
    cid,
  ]);
  if (header.affectedRows === 0) {
    return NextResponse.json({ ok: false, error: "Company not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true as const, logo: publicUrl });
}
