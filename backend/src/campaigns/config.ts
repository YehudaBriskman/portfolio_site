import type { SenderSettings } from "../announce/schemas.js";
import { env } from "../env.js";

/*
 * The effective From and Reply-To: the in-app value wins, an empty one falls
 * back to the environment. SMTP credentials are never read here or shown.
 */

const ADDR = /<([^<>]+)>\s*$/;
const addressOf = (s: string) => (ADDR.exec(s)?.[1] ?? s).trim();
const nameOf = (s: string) => (ADDR.test(s) ? s.replace(ADDR, "").trim().replace(/^"|"$/g, "") : "");
const domainOf = (addr: string) => addr.split("@")[1]?.toLowerCase() ?? "";

export function resolveSender(s: Pick<SenderSettings, "fromName" | "fromAddress" | "replyTo">): { from: string; replyTo: string | undefined } {
  const replyTo = s.replyTo || env.MAIL_REPLY_TO || undefined;
  if (!s.fromAddress && !s.fromName) return { from: env.MAIL_FROM, replyTo };
  const address = s.fromAddress || addressOf(env.MAIL_FROM);
  const name = s.fromName || nameOf(env.MAIL_FROM);
  return { from: name ? `"${name}" <${address}>` : address, replyTo };
}

export type SenderWarning = { field: "fromAddress" | "replyTo"; code: "domain-not-sendable"; message: string };

/**
 * A From domain the SMTP account probably cannot send for. A warning, never a
 * block: only the provider knows, and a relay may well allow it.
 */
export function senderWarnings(s: Pick<SenderSettings, "fromAddress">): SenderWarning[] {
  if (!s.fromAddress) return [];
  const known = new Set([domainOf(addressOf(env.MAIL_FROM)), domainOf(env.SMTP_USER ?? "")].filter(Boolean));
  if (known.size === 0 || known.has(domainOf(s.fromAddress))) return [];
  return [
    {
      field: "fromAddress",
      code: "domain-not-sendable",
      message: "The mail account may not be allowed to send as this domain, so mail could bounce or land in spam. Check with your mail provider.",
    },
  ];
}
