import { env } from "../env.js";

/** The normalised href when `raw` is http(s) or mailto without credentials, else null. */
export function safeHref(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol === "https:" || u.protocol === "http:") return u.username || u.password ? null : u.href;
    return u.protocol === "mailto:" ? u.href : null;
  } catch {
    return null;
  }
}

/** The origin images may come from: the public site. */
export const siteOrigin = (): string => new URL(env.SITE_URL).origin;

/** An https image on `origin` (the site's own), else null. No remote images from anywhere else. */
export function safeImage(raw: string, origin: string = siteOrigin()): string | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && u.origin === origin && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}
