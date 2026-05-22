import { mkdir, writeFile } from "fs/promises";
import path from "path";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function isExternalUrl(v: string): boolean {
  return /^https?:\/\//i.test(v);
}

function isStoredRelativePath(v: string): boolean {
  const s = v.replace(/^\/+/, "");
  return s.startsWith("uploads/") && !s.startsWith("data:");
}

/** PDF/webhook format: `uploads/payin/file.jpg` (no leading slash). */
export function formatPayinImageForApi(raw: string | null | undefined): string | null {
  const v = raw?.trim() || "";
  if (!v) return null;
  if (v.startsWith("data:")) return null;
  if (isExternalUrl(v)) return v;
  return v.replace(/^\/+/, "");
}

export async function persistPaymentProofImage(raw: string, txId: number): Promise<string> {
  const v = raw.trim();
  if (!v) return "";

  if (isExternalUrl(v) || isStoredRelativePath(v)) {
    return formatPayinImageForApi(v) || v.replace(/^\/+/, "");
  }

  let mime = "image/jpeg";
  let b64 = v;
  const dataMatch = /^data:([^;]+);base64,(.+)$/i.exec(v);
  if (dataMatch) {
    mime = dataMatch[1].toLowerCase();
    b64 = dataMatch[2];
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    return v;
  }
  if (buf.length < 16) return v;

  const ext = MIME_EXT[mime] || ".jpg";
  const filename = `${txId}-${Date.now()}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "payin");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buf);

  return `uploads/payin/${filename}`;
}
