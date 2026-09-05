// PBKDF2-SHA256 password hashing using Web Crypto (browser only).
// The same scheme maps cleanly onto Supabase Auth later — until then
// no plaintext password is ever stored or logged.

const ITER = 150_000;
const KEYLEN = 32;

const enc = new TextEncoder();

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

export const randomSalt = () => toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);

export async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: ITER, hash: "SHA-256" },
    key,
    KEYLEN * 8
  );
  return toHex(bits);
}

/** Constant-time-ish comparison to avoid trivial timing leaks. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password: string, salt: string, hash: string) {
  return safeEqual(await hashPassword(password, salt), hash);
}

export const uid = (prefix = "") =>
  prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export interface PwStrength { score: 0 | 1 | 2 | 3 | 4; label: string; problems: string[] }

export function passwordStrength(pw: string): PwStrength {
  const problems: string[] = [];
  if (pw.length < 8) problems.push("٨ أحرف على الأقل");
  if (!/[a-z]/i.test(pw)) problems.push("حرف إنجليزي واحد على الأقل");
  if (!/[0-9]/.test(pw)) problems.push("رقم واحد على الأقل");
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["ضعيفة جدًا", "ضعيفة", "متوسطة", "قوية", "قوية جدًا"];
  return { score: Math.min(score, 4) as PwStrength["score"], label: labels[Math.min(score, 4)], problems };
}
