/*
 * What a failed SMTP send means for the ADDRESS and for the CAMPAIGN.
 *
 * nodemailer throws one Error shape for every failure: `code` is its own
 * label (EAUTH, ECONNECTION, ETIMEDOUT, EENVELOPE ...), `responseCode` and
 * `response` are the server's reply. Only a few replies say "this address does
 * not exist"; a 5.7.x policy block or a bad login says nothing about the person
 * and must never suppress them.
 *
 *   hard       the address is permanently bad (5.1.x, 5.2.1, 551/553): suppress
 *   soft       this recipient cannot take mail right now (mailbox full, other 4xx): count, suppress after repeats
 *   transient  the relay or network hiccuped (421/450/451, timeouts): retry later
 *   policy     a permanent refusal that is not about the address (5.7.x, 554, spam block): never suppress
 *   auth       our credentials were refused: stop the campaign
 *   unknown    nothing recognisable
 */
export type SmtpErrorKind = "hard" | "soft" | "transient" | "policy" | "auth" | "unknown";
export type SmtpClass = { kind: SmtpErrorKind; code?: number };

const NETWORK = new Set(["ECONNECTION", "ETIMEDOUT", "ESOCKET", "ECONNRESET", "ECONNREFUSED", "EDNS", "ENOTFOUND", "EHOSTUNREACH", "ENETUNREACH", "EPIPE"]);
const AUTH_REPLIES = new Set([530, 534, 535, 538]);
/* A bare 550 is a policy block as often as a missing mailbox: only wording that names the mailbox counts. */
const NO_SUCH_MAILBOX = /(user|recipient|mailbox|address|account)[^.]{0,30}(unknown|not found|does not exist|doesn't exist|unavailable|invalid|disabled)|no such (user|recipient|mailbox)|unknown (user|recipient)/i;

type Shape = { code?: unknown; responseCode?: unknown; response?: unknown; message?: unknown };

export function classifySmtpError(err: unknown): SmtpClass {
  const e: Shape = err && typeof err === "object" ? (err as Shape) : {};
  const label = typeof e.code === "string" ? e.code : "";
  const response = typeof e.response === "string" ? e.response : "";
  const text = response || (typeof e.message === "string" ? e.message : "");
  const parsed = /^\s*([245]\d\d)\b/.exec(response);
  const code = typeof e.responseCode === "number" ? e.responseCode : parsed ? Number(parsed[1]) : undefined;
  const out = (kind: SmtpErrorKind): SmtpClass => (code !== undefined ? { kind, code } : { kind });

  if (label === "EAUTH" || (code !== undefined && AUTH_REPLIES.has(code))) return out("auth");
  if (code === undefined) return NETWORK.has(label) ? { kind: "transient" } : { kind: "unknown" };

  const enh = /\b([245])\.(\d{1,3})\.(\d{1,3})\b/.exec(text);
  const cls = enh ? Number(enh[2]) : null;
  const detail = enh ? `${enh[2]}.${enh[3]}` : null;

  if (code >= 400 && code < 500) {
    if (cls === 2) return out("soft");
    if (code === 421 || code === 450 || code === 451 || code === 454 || cls === 3 || cls === 4 || cls === 7) return out("transient");
    return out("soft");
  }
  if (code >= 500 && code < 600) {
    if (detail === "2.2" || code === 552) return out("soft");
    if (cls === 7) return out("policy");
    if (cls === 1) return detail === "1.7" || detail === "1.8" ? out("policy") : out("hard");
    if (detail === "2.1") return out("hard");
    if (cls !== null) return out("policy");
    if (code === 551 || code === 553) return out("hard");
    if (code === 550 && NO_SUCH_MAILBOX.test(text)) return out("hard");
    return out("policy");
  }
  return out("unknown");
}
