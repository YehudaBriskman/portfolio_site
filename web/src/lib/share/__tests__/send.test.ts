import { describe, expect, it } from "vitest";
import { buildShare, sendHref } from "..";

const base = { kind: "note", entity: { slug: "n", title: "T", summary: "S" }, locale: "en", audience: "visitor", origin: "https://example.com" } as const;
const r = (channel: Parameters<typeof buildShare>[0]["channel"]) => buildShare({ ...base, channel });

describe("sendHref", () => {
  it("reproduces the built address for the unedited caption", () => {
    for (const c of ["linkedin", "email", "gmail", "x", "whatsapp"] as const) {
      const res = r(c);
      expect(sendHref(res, res.text)).toBe(res.href);
    }
  });

  it("follows an edited caption, encoded", () => {
    expect(sendHref(r("whatsapp"), "a&b")).toBe("https://wa.me/?text=a%26b");
    expect(sendHref(r("gmail"), "body")).toContain("&body=body");
  });

  it("leaves the link out of X's text, since X takes it as a parameter", () => {
    const res = r("x");
    const href = sendHref(res, `hello ${res.url}`)!;
    expect(new URL(href).searchParams.get("text")).toBe("hello");
    expect(new URL(href).searchParams.get("url")).toBe(res.url);
  });

  it("has no address for copy, native and Instagram", () => {
    for (const c of ["copy", "native", "instagram"] as const) expect(sendHref(r(c), "x")).toBeUndefined();
  });
});
