import { describe, expect, it } from "vitest";
import { countChars, truncate } from "@/lib/share";
import { hashtags, plain, renderTemplate, renderWithin, truncateSafe, type Vars } from "../text";

const vars = (o: Partial<Vars> = {}): Vars => ({ title: "T", summary: "S", url: "https://e.test/a", tags: "", version: "", site: "Site", ...o });

describe("countChars", () => {
  it("counts code points, not UTF-16 units", () => {
    expect(countChars("a😀b")).toBe(3);
    expect(countChars("שלום")).toBe(4);
  });
  it("counts every link as 23 on X only", () => {
    const t = "hi https://example.test/a/very/long/address/indeed/yes";
    expect(countChars(t, "x")).toBe(3 + 23);
    expect(countChars(t, "linkedin")).toBe(t.length);
  });
});

describe("truncate", () => {
  it("leaves short text alone", () => expect(truncate("abc", 3)).toBe("abc"));
  it("ends in an ellipsis within the cap", () => expect(truncate("abcdef", 4)).toBe("abc…"));
  it("never cuts a surrogate pair or an emoji sequence", () => {
    const out = truncate("ab😀😀😀", 4);
    expect(out).toBe("ab😀…");
    expect(out).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);
    expect(truncate("a👨‍👩‍👧b", 3)).toBe("a…");
  });
  it("handles zero", () => expect(truncate("abc", 0)).toBe(""));
});

describe("truncateSafe", () => {
  it("drops a link rather than cutting it", () => {
    const out = truncateSafe("Hello world https://example.test/long/path/here", 25);
    expect(out).toBe("Hello world…");
    expect(out).not.toContain("https");
  });
});

describe("plain", () => {
  it("strips tags and control characters and collapses space", () => {
    expect(plain("<b>Hi</b>  <script>x()</script>\u0000there\n")).toBe("Hi x() there");
    expect(plain("a < b and c > d")).toBe("a < b and c > d");
    expect(plain(undefined)).toBe("");
    for (const evil of ["<<script>alert(1)</script>", "<scr<b>ipt>alert(1)", "<img src=x onerror=1", "<<img src=x>img src=x onerror=1>"]) {
      expect(plain(evil), evil).not.toMatch(/<\/?(script|img)/i);
      expect(plain(evil), evil).not.toMatch(/<[a-z!/]/i);
    }
  });
});

describe("hashtags", () => {
  it("keeps one word per tag, dedupes and caps", () => {
    expect(hashtags(["CI/CD", "dev ops", "ci/cd", "ראשון", "!!"])).toBe("#CICD #devops #ראשון");
    expect(hashtags(["a", "b", "c"], 2)).toBe("#a #b");
    expect(hashtags(undefined)).toBe("");
  });
});

describe("renderTemplate", () => {
  it("fills known variables once and leaves unknown ones", () => {
    expect(renderTemplate("{title} {nope}", vars())).toBe("T {nope}");
    expect(renderTemplate("{title}", vars({ title: "{url}" }))).toBe("{url}");
  });
  it("drops the lines an empty variable leaves", () => {
    expect(renderTemplate("{title}\n\n{summary}\n\n{tags}\n\n{url}", vars({ summary: "", tags: "" }))).toBe("T\n\nhttps://e.test/a");
  });
});

describe("renderWithin", () => {
  const tpl = "{title}\n\n{summary}\n\n{url}";
  it("shrinks the summary first and keeps the link whole", () => {
    const out = renderWithin(tpl, vars({ summary: "x".repeat(500) }), 100, "linkedin");
    expect([...out].length).toBeLessThanOrEqual(100);
    expect(out.endsWith("https://e.test/a")).toBe(true);
    expect(out).toContain("…");
  });
  it("weights the link on X", () => {
    const out = renderWithin(tpl, vars({ url: "https://e.test/" + "p".repeat(200), summary: "y".repeat(400) }), 280, "x");
    expect(countChars(out, "x")).toBeLessThanOrEqual(280);
    expect(out).toContain("p".repeat(200));
  });
  it("shortens the title when nothing else is left", () => {
    const out = renderWithin("{title} {url}", vars({ title: "t".repeat(400) }), 100, "linkedin");
    expect([...out].length).toBeLessThanOrEqual(100);
    expect(out.endsWith("https://e.test/a")).toBe(true);
  });
  it("is unlimited with a null cap", () => {
    expect(renderWithin(tpl, vars({ summary: "x".repeat(9000) }), null, "copy").length).toBeGreaterThan(9000);
  });
});
