import bcrypt from "bcryptjs";

const ROUNDS = 10;

export function isHashed(password) {
  return typeof password === "string" && password.startsWith("$2");
}

export async function hashPassword(plain) {
  return bcrypt.hash(String(plain), ROUNDS);
}

export async function verifyPassword(plain, stored) {
  if (!stored) return false;
  if (isHashed(stored)) return bcrypt.compare(String(plain), stored);
  return String(plain) === String(stored);
}

/** Migre un mot de passe en clair vers bcrypt si la vérification réussit. */
export async function maybeRehash(plain, stored) {
  const ok = await verifyPassword(plain, stored);
  if (!ok || isHashed(stored)) return { ok, hash: stored };
  return { ok, hash: await hashPassword(plain) };
}
