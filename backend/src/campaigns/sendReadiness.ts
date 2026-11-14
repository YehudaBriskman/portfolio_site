import { Resolver } from "node:dns/promises";
import { contactLines, missingIdentity, type SenderSettings } from "../announce/schemas.js";
import { env } from "../env.js";
import { resolveSender, senderWarnings } from "./config.js";

/*
 * Send readiness: what the owner must fix before the first real send. Counts
 * and statuses only, never record text, never an address.
 *
 * DNS is looked up for ONE domain: the one in the saved From address. The names
 * asked are fixed suffixes of it (the domain, resend._domainkey.<d>, _dmarc.<d>
 * and a few common DKIM selectors), never anything from a request. Each lookup
 * has a hard timeout; a timeout or resolver error is "unknown", never "fail".
 * Results are cached five minutes so the screen cannot be used to hammer a
 * resolver. A DNS check proves the records exist, not that the provider signs
 * with them: only the test send shows that.
 */

export const DNS_TIMEOUT_MS = 3000;
const CACHE_MS = 5 * 60_000;
/* Resend publishes resend._domainkey; the rest are what other providers use, so a domain moved between providers still reads right. */
const DKIM_SELECTORS = ["resend", "google", "selector1", "selector2", "k1", "s1", "default"];

export type Lookup = (name: string) => Promise<string[][]>;
export type DnsState = "pass" | "fail" | "unknown";
export type DomainStatus = { domain: string; spf: DnsState; dkim: DnsState; dmarc: DnsState };

const resolver = new Resolver({ timeout: DNS_TIMEOUT_MS, tries: 1 });
const defaultLookup: Lookup = (name) => resolver.resolveTxt(name);

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
/** The domain of a From value, only when it looks like an ordinary public domain (no IP, no bracket, no single label). */
export function domainOfFrom(from: string): string | null {
  const m = /([^<>\s@"]+)@([^<>\s@"]+)>?\s*$/.exec(from.trim());
  const d = m?.[2]?.toLowerCase();
  if (!d || d.length > 253) return null;
  const labels = d.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l)) || /^\d+$/.test(labels[labels.length - 1]!)) return null;
  return d;
}

const cache = new Map<string, { at: number; value: DomainStatus }>();
export const clearDnsCache = () => cache.clear();

const NOT_THERE = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

async function txt(look: Lookup, name: string): Promise<string[] | "unknown"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const rows = await Promise.race([
      look(name),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), DNS_TIMEOUT_MS); }),
    ]);
    return rows.map((r) => r.join(""));
  } catch (e) {
    return NOT_THERE.has((e as { code?: string }).code ?? "") ? [] : "unknown";
  } finally {
    clearTimeout(timer);
  }
}

export async function checkDomain(domain: string, look: Lookup = defaultLookup, now = Date.now()): Promise<DomainStatus> {
  const hit = cache.get(domain);
  if (hit && now - hit.at < CACHE_MS) return hit.value;
  const [root, dmarc, ...dkimRows] = await Promise.all([
    txt(look, domain),
    txt(look, `_dmarc.${domain}`),
    ...DKIM_SELECTORS.map((s) => txt(look, `${s}._domainkey.${domain}`)),
  ]);
  const state = (rows: string[] | "unknown", test: (r: string) => boolean): DnsState => (rows === "unknown" ? "unknown" : rows.some(test) ? "pass" : "fail");
  /* Any published selector counts; if none was found but some could not be read, say unknown rather than fail. */
  const dkim: DnsState = dkimRows.some((r) => r !== "unknown" && r.length > 0) ? "pass" : dkimRows.some((r) => r === "unknown") ? "unknown" : "fail";
  const value: DomainStatus = {
    domain,
    spf: state(root, (r) => /^v=spf1\b/i.test(r.trim())),
    dkim,
    dmarc: state(dmarc, (r) => /^v=DMARC1\b/i.test(r.trim())),
  };
  cache.set(domain, { at: now, value });
  return value;
}

export type ReadinessItem = { id: string; status: "ok" | "fix" | "unknown" | "info" };

/** The whole checklist for the saved settings. `domain` is null when the From address is not an ordinary domain. */
export async function sendReadiness(s: SenderSettings, look?: Lookup): Promise<{ domain: string | null; replyTo: boolean; items: ReadinessItem[] }> {
  const from = resolveSender(s);
  const domain = domainOfFrom(from.from);
  const dns = domain ? await checkDomain(domain, look) : null;
  const dnsItem = (id: "spf" | "dkim" | "dmarc"): ReadinessItem => ({ id, status: !dns ? "unknown" : dns[id] === "pass" ? "ok" : dns[id] === "fail" ? "fix" : "unknown" });
  const reply = (from.replyTo ?? "").trim();
  const replyOk = reply.length > 0 && !/(^|[^a-z])no[-_.]?reply/i.test(reply);
  const lacks = missingIdentity(s);
  return {
    domain,
    replyTo: replyOk,
    items: [
      dnsItem("spf"),
      dnsItem("dkim"),
      dnsItem("dmarc"),
      { id: "domainMatch", status: senderWarnings(s).length === 0 ? "ok" : "fix" },
      { id: "replyTo", status: replyOk ? "ok" : "fix" },
      { id: "identity", status: lacks.length === 0 && contactLines(s).length > 0 ? "ok" : "fix" },
      { id: "testRecipient", status: s.testRecipients.length > 0 ? "ok" : "fix" },
      { id: "webhook", status: env.RESEND_WEBHOOK_SECRET ? "ok" : "fix" },
    ],
  };
}

/** Tests swap the resolver here; production leaves it unset. */
export const dnsOverride: { look?: Lookup } = {};
