import { compare, hash } from "bcryptjs";

/** Only bcrypt hashes ($2a/$2b/$2y) are accepted — no plain-text passwords. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored.startsWith("$2")) return false;
  return compare(plain, stored);
}

/** Hash a plain-text password with bcrypt (cost 10). */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, 10);
}
