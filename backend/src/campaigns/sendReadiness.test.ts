import { describe, expect, it, vi } from "vitest";
import { checkDomain, clearDnsCache, DNS_TIMEOUT_MS, domainOfFrom, type Lookup } from "./sendReadiness.js";

const records = (m: Record<string, string[][]>): Lookup => async (name) => {
  if (name in m) return m[name]!;
  const e = Object.assign(new Error("nx"), { code: "ENOTFOUND" });
  throw e;
};

describe("domainOfFrom", () => {
  it("reads the domain from a plain or named From", () => {
    expect(domainOfFrom('"Yehuda" <hi@Example.ORG>')).toBe("example.org");
    expect(domainOfFrom("hi@example.org")).toBe("example.org");
  });
  it("refuses anything that is not a plain registrable-looking domain", () => {
    for (const bad of ["hi@localhost", "hi@1.2.3.4", "hi@[::1]", "hi@a_b.org", "", "nobody", "hi@exa mple.org", "hi@-x.org"]) expect(domainOfFrom(bad)).toBeNull();
  });
});

describe("checkDomain", () => {
  const good = records({
    "example.org": [["v=spf1 include:amazonses.com ~all"]],
    "resend._domainkey.example.org": [["p=MIGfMA0"]],
    "_dmarc.example.org": [["v=DMARC1; p=none; rua=mailto:a@example.org"]],
  });
  it("passes when SPF, a DKIM key and DMARC are published", async () => {
    clearDnsCache();
    expect(await checkDomain("example.org", good)).toMatchObject({ spf: "pass", dkim: "pass", dmarc: "pass" });
  });
  it("fails what is missing, never mixing the three", async () => {
    clearDnsCache();
    expect(await checkDomain("example.org", records({ "example.org": [["google-site-verification=x"]] }))).toMatchObject({ spf: "fail", dkim: "fail", dmarc: "fail" });
  });
  it("a timeout or a resolver error is unknown, not a failure", async () => {
    clearDnsCache();
    const slow: Lookup = () => new Promise(() => {});
    vi.useFakeTimers();
    const p = checkDomain("example.org", slow);
    await vi.advanceTimersByTimeAsync(DNS_TIMEOUT_MS + 50);
    expect(await p).toMatchObject({ spf: "unknown", dkim: "unknown", dmarc: "unknown" });
    vi.useRealTimers();
    clearDnsCache();
    const broken: Lookup = async () => { throw Object.assign(new Error("x"), { code: "ESERVFAIL" }); };
    expect(await checkDomain("example.org", broken)).toMatchObject({ spf: "unknown" });
  });
  it("asks only for names derived from the domain, and caches for five minutes", async () => {
    clearDnsCache();
    const seen: string[] = [];
    const spy: Lookup = async (n) => { seen.push(n); return good(n); };
    await checkDomain("example.org", spy);
    const first = seen.length;
    await checkDomain("example.org", spy);
    expect(seen.length).toBe(first);
    expect(seen.every((n) => n === "example.org" || n.endsWith(".example.org"))).toBe(true);
    expect(first).toBeLessThanOrEqual(10);
  });
});
