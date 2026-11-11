import { describe, expect, it } from "vitest";
import { buildShare, SHARE_CHANNELS, SHARE_KINDS, type ShareChannel, type ShareInput, type ShareKind } from "@/lib/share";

const ORIGIN = "https://example.test";
const entity = { slug: "why-ci", title: "Why CI must fail", summary: "A short summary.", tags: ["ci", "devops"], version: "v1.5.0" };
const base = (o: Partial<ShareInput> = {}): ShareInput => ({
  kind: "post",
  entity,
  locale: "en",
  channel: "copy",
  audience: "visitor",
  origin: ORIGIN,
  ...o,
});
const U = (path: string, medium: string) => `${ORIGIN}${path}?utm_source=share&utm_medium=${medium}`;

describe("buildShare: exact output", () => {
  it("copy gives the link", () => {
    const r = buildShare(base());
    expect(r.url).toBe(U("/blog/why-ci", "copy"));
    expect(r.text).toBe(r.url);
    expect(r.href).toBeUndefined();
  });

  it("LinkedIn opens share-offsite and says the caption is not prefilled", () => {
    const r = buildShare(base({ channel: "linkedin" }));
    expect(r.href).toBe(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(U("/blog/why-ci", "linkedin"))}`);
    expect(r.textPrefilled).toBe(false);
    expect(r.text).toBe(`Look what I found: Why CI must fail\n\nA short summary.\n\n#ci #devops\n\n${U("/blog/why-ci", "linkedin")}`);
    expect(r.limits).toEqual({ max: 3000, count: [...r.text].length, over: false });
  });

  it("Gmail and mailto prefill subject and body", () => {
    const g = buildShare(base({ channel: "gmail" }));
    const body = `A short summary.\n\n${U("/blog/why-ci", "gmail")}`;
    expect(g.subject).toBe("Look what I found: Why CI must fail");
    expect(g.text).toBe(body);
    expect(g.href).toBe(`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(g.subject!)}&body=${encodeURIComponent(body)}`);
    expect(g.textPrefilled).toBe(true);
    const m = buildShare(base({ channel: "email" }));
    expect(m.href).toBe(
      `mailto:?subject=${encodeURIComponent(m.subject!)}&body=${encodeURIComponent(`A short summary.\r\n\r\n${U("/blog/why-ci", "email")}`)}`,
    );
  });

  it("X puts the link in its own parameter and counts it as 23", () => {
    const r = buildShare(base({ channel: "x" }));
    expect(r.href).toBe(
      `https://x.com/intent/post?url=${encodeURIComponent(U("/blog/why-ci", "x"))}&text=${encodeURIComponent("Look what I found: Why CI must fail")}`,
    );
    expect(r.limits.max).toBe(280);
    expect(r.limits.count).toBe([..."Look what I found: Why CI must fail\n\n"].length + 23);
  });

  it("WhatsApp carries text and link", () => {
    const r = buildShare(base({ channel: "whatsapp" }));
    expect(r.href).toBe(`https://wa.me/?text=${encodeURIComponent(`Look what I found: Why CI must fail\n${U("/blog/why-ci", "whatsapp")}`)}`);
  });

  it("Instagram is a card and a caption, no link", () => {
    const r = buildShare(base({ channel: "instagram" }));
    expect(r.href).toBeUndefined();
    expect(r.textPrefilled).toBe(false);
    expect(r.image).toBe(`${ORIGIN}/api/seo/og/blog/why-ci.png?format=square`);
    expect(r.limits.max).toBe(2200);
  });

  it("native shares the caption beside the link", () => {
    const r = buildShare(base({ channel: "native" }));
    expect(r.text).toBe("Look what I found: Why CI must fail");
    expect(r.url).toBe(U("/blog/why-ci", "native"));
    expect(r.limits.max).toBeNull();
  });
});

describe("buildShare: kinds, audiences, locales", () => {
  it("covers every kind and channel without throwing, as plain text", () => {
    for (const kind of SHARE_KINDS) {
      for (const channel of SHARE_CHANNELS) {
        for (const audience of ["visitor", "owner"] as const) {
          for (const locale of ["en", "he"] as const) {
            const r = buildShare(base({ kind, channel, audience, locale }));
            expect(r.url.startsWith(ORIGIN), `${kind}/${channel}`).toBe(true);
            expect(r.text.length).toBeGreaterThan(0);
            expect(r.text).not.toMatch(/\{[a-z]+\}/);
          }
        }
      }
    }
  });

  it("paths per kind", () => {
    const path = (kind: ShareKind) => new URL(buildShare(base({ kind })).url).pathname;
    expect(path("note")).toBe("/blog/why-ci");
    expect(path("area")).toBe("/blog/area/why-ci");
    expect(path("project")).toBe("/projects/why-ci");
    expect(path("release")).toBe("/projects/why-ci");
    expect(path("story")).toBe("/story");
    expect(path("home")).toBe("/");
  });

  it("owner captions", () => {
    expect(buildShare(base({ audience: "owner", channel: "native" })).text).toBe("New on the blog: Why CI must fail");
    expect(buildShare(base({ audience: "owner", kind: "release", channel: "native", entity: { slug: "windom", title: "Windom", version: "v1.5.0" } })).text).toBe(
      "Windom v1.5.0 is out",
    );
  });

  it("Hebrew links to /he and uses Hebrew captions", () => {
    const r = buildShare(base({ locale: "he", channel: "native", entity: { slug: "x", title: "כותרת" } }));
    expect(new URL(r.url).pathname).toBe("/he/blog/x");
    expect(r.text).toBe("מצאתי משהו שכדאי לראות: כותרת");
    expect(new URL(buildShare(base({ kind: "home", locale: "he" })).url).pathname).toBe("/he");
    expect(buildShare(base({ audience: "owner", kind: "release", channel: "native", locale: "he", entity: { slug: "w", title: "Windom", version: "v1" } })).text).toBe(
      "יצאה גרסה v1 של Windom",
    );
  });

  it("images exist only for kinds with a card", () => {
    expect(buildShare(base({ kind: "project", format: "og" })).image).toBe(`${ORIGIN}/api/seo/og/projects/why-ci.png`);
    expect(buildShare(base({ kind: "story" })).image).toBeUndefined();
  });
});

describe("buildShare: settings", () => {
  it("overrides templates per locale and channel, for visitors", () => {
    const settings = { templates: { en: { x: "{title} by {site} {url} {version}" }, he: { x: "{title} ב{site}" } } };
    const r = buildShare(base({ channel: "x", settings }));
    expect(r.text).toBe(`Why CI must fail by Yehuda Briskman ${U("/blog/why-ci", "x")} v1.5.0`);
    expect(buildShare(base({ channel: "x", locale: "he", settings })).text).toBe("Why CI must fail ב" + "יהודה בריסקמן");
    // owner ignores the visitor menu's overrides; blank override falls back
    expect(buildShare(base({ channel: "x", audience: "owner", settings })).text).toContain("New on the blog");
    expect(buildShare(base({ channel: "x", settings: { templates: { en: { x: "  " }, he: {} } } })).text).toContain("Look what I found");
  });

  it("omits utm when off and cleans the source", () => {
    expect(buildShare(base({ settings: { utm: { enabled: false, source: "s" } } })).url).toBe(`${ORIGIN}/blog/why-ci`);
    expect(buildShare(base({ settings: { utm: { enabled: true, source: "My Site" } } })).url).toBe(
      `${ORIGIN}/blog/why-ci?utm_source=my-site&utm_medium=copy`,
    );
  });

  it("uses a custom site name", () => {
    const r = buildShare(base({ channel: "x", siteName: "Acme", settings: { templates: { en: { x: "{site}" }, he: {} } } }));
    expect(r.text).toBe("Acme");
  });
});

describe("buildShare: limits", () => {
  const long = { ...entity, summary: "word ".repeat(1500), title: "T" };
  const within = (channel: ShareChannel) => {
    const r = buildShare(base({ channel, entity: long }));
    expect(r.limits.over, channel).toBe(false);
    expect(r.limits.count).toBeLessThanOrEqual(r.limits.max!);
    return r;
  };

  it("trims the summary to each cap and keeps the link", () => {
    for (const c of ["linkedin", "instagram", "x"] as const) {
      const r = within(c);
      if (c !== "x") expect(r.text.endsWith(r.url)).toBe(true);
    }
  });

  it("does not cut an emoji summary mid-surrogate", () => {
    const r = buildShare(base({ channel: "x", entity: { ...entity, summary: "😀".repeat(400) } }));
    expect(r.text).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);
    expect(r.text).not.toMatch(/(?<![\ud800-\udbff])[\udc00-\udfff]/);
    expect(r.limits.over).toBe(false);
  });

  it("flags text it cannot fit", () => {
    const settings = { templates: { en: { x: "z".repeat(400) }, he: {} } };
    const r = buildShare(base({ channel: "x", settings }));
    expect(r.limits.over).toBe(false);
    expect(r.text.endsWith("…")).toBe(true);
  });
});

describe("buildShare: safety", () => {
  it("writes no HTML into any text", () => {
    const evil = { slug: "a", title: "<img src=x onerror=alert(1)>Hi", summary: "<script>bad()</script>text", tags: ["<b>t</b>"] };
    for (const channel of SHARE_CHANNELS) {
      const r = buildShare(base({ channel, entity: evil }));
      expect(r.text, channel).not.toMatch(/<[a-z/!]/i);
      expect(r.subject ?? "").not.toMatch(/<[a-z/!]/i);
    }
  });

  it("takes the origin only from the caller, whatever the entity says", () => {
    const sneaky = { slug: "//evil.test/x", title: "https://evil.test", summary: "see https://evil.test" };
    for (const kind of ["post", "area", "project", "release"] as const) {
      const r = buildShare(base({ kind, entity: sneaky }));
      expect(new URL(r.url).origin).toBe(ORIGIN);
      expect(new URL(r.url).pathname.split("/").length).toBeLessThanOrEqual(4);
    }
    expect(() => buildShare(base({ origin: "javascript:alert(1)" }))).toThrow(RangeError);
    expect(() => buildShare(base({ entity: { slug: "..", title: "x" } }))).toThrow(RangeError);
  });

  it("does not expand a placeholder typed into entity text", () => {
    const r = buildShare(base({ channel: "native", entity: { slug: "a", title: "{url} {site}" } }));
    expect(r.text).toBe("Look what I found: {url} {site}");
  });

  it("makes a mailto that is exactly one subject and one body", () => {
    const r = buildShare(base({ channel: "email", entity: { slug: "a", title: "A&B=C?D" } }));
    const q = new URL(r.href!.replace("mailto:", "mailto://x")).searchParams;
    expect([...q.keys()]).toEqual(["subject", "body"]);
    expect(q.get("subject")).toBe("Look what I found: A&B=C?D");
  });
});
