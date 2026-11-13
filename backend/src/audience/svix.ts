import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Svix-style webhook signatures, which is what Resend sends. The signed content
 * is `<id>.<timestamp>.<raw body>`, the key is the base64 part of `whsec_...`,
 * and the header holds one or more space-separated `v1,<base64 hmac>` entries.
 * Implemented here rather than pulled in as a dependency: it is a dozen lines.
 */

export const TOLERANCE_SECONDS = 5 * 60;

export type SvixHeaders = { id?: string; timestamp?: string; signature?: string };

const B64 = /^[A-Za-z0-9+/_-]+={0,2}$/;

/** The HMAC key bytes for a `whsec_...` secret, or null when it is not one. */
export function secretKey(secret: string): Buffer | null {
  if (!secret.startsWith("whsec_")) return null;
  const b64 = secret.slice(6);
  if (!B64.test(b64)) return null;
  const key = Buffer.from(b64, "base64");
  return key.length > 0 ? key : null;
}

/** True only for a fresh, correctly signed request. Every failure is the same `false`. */
export function verifySvix(secret: string, raw: Buffer, h: SvixHeaders, nowMs = Date.now()): boolean {
  try {
    const key = secretKey(secret);
    if (!key || !h.id || !h.timestamp || !h.signature || h.id.length > 256 || h.signature.length > 2048) return false;
    if (!/^\d{1,12}$/.test(h.timestamp)) return false;
    if (Math.abs(Math.floor(nowMs / 1000) - Number(h.timestamp)) > TOLERANCE_SECONDS) return false;
    const expected = createHmac("sha256", key).update(`${h.id}.${h.timestamp}.`).update(raw).digest();
    let ok = false;
    // Every entry is compared, so the time taken does not say which one matched.
    for (const entry of h.signature.split(" ")) {
      const [version, sig] = entry.split(",");
      if (version !== "v1" || !sig) continue;
      const got = Buffer.from(sig, "base64");
      if (got.length === expected.length && timingSafeEqual(got, expected)) ok = true;
    }
    return ok;
  } catch {
    return false;
  }
}
