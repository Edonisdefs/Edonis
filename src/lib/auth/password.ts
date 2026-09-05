import "server-only";

import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Konstante Laufzeit auch bei unbekannter E-Mail-Adresse: verhindert, dass sich
 * über die Antwortzeit ermitteln lässt, ob ein Konto existiert.
 */
const DUMMY_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEeO1i0kQ3AZ8gL8yWmL0mkq9dS2cOX2xMi";

export async function burnPasswordTime(): Promise<void> {
  await bcrypt.compare("dummy-password", DUMMY_HASH);
}
