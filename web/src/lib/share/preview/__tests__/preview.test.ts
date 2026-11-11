import { describe, expect, it } from "vitest";
import { PREVIEW_LIMITS, countX, previewInstagram, previewLinkedIn, previewWhatsApp, previewX } from "..";
import { cpLength, cutAtWord, domainOf, hashtagsOf } from "../text";

describe("constants", () => {
  it("pins every number (approximate; change deliberately)", () => {
    expect(PREVIEW_LIMITS).toEqual({
      linkedin: 3000,
      linkedinFoldChars: 210,
      linkedinFoldLines: 3,
      x: 280,
      xLinkWeight: 23,
      xThreadSuffixReserve: 8,
      instagram: 2200,
      instagramFoldChars: 125,
      instagramHashtags: 30,
      whatsappFoldChars: 700,
    });
  });
});

describe("text helpers", () => {
  it("counts code points: an emoji is one, Hebrew is one each", () => {
    expect(cpLength("a😀b")).toBe(3);
    expect(cpLength("שלום")).toBe(4);
  });
  it("cuts on a space, never mid-word, never through a surrogate pair", () => {
    expect(cutAtWord("hello wonderful world", 9)).toEqual({ head: "hello", cut: true });
    expect(cutAtWord("😀😀😀😀 😀😀😀😀", 6).head).toBe("😀😀😀😀");
    expect(cutAtWord("short", 10)).toEqual({ head: "short", cut: false });
    expect(cutAtWord("שלום עולם יפה", 8).head).toBe("שלום");
  });
  it("keeps a single long link whole", () => {
    const url = "https://example.com/" + "a".repeat(50);
    expect(cutAtWord(`${url} tail`, 20).head).toBe(url);
  });
  it("finds hashtags in Latin and Hebrew, not inside words or anchors", () => {
    expect(hashtagsOf("a #one b #שלום c#no http://x.com/#frag #two_2")).toEqual(["#one", "#שלום", "#two_2"]);
  });
  it("reads a domain", () => {
    expect(domainOf("https://www.example.com/a")).toBe("example.com");
    expect(domainOf("nonsense")).toBe("");
    expect(domainOf(undefined)).toBe("");
  });
});

describe("LinkedIn", () => {
  it("does not fold short text", () => {
    const p = previewLinkedIn("Hello\nworld");
    expect(p).toMatchObject({ folded: false, hidden: "", count: 11, over: false, limit: 3000 });
    expect(p.lines).toEqual(["Hello", "world"]);
  });
  it("folds after three lines", () => {
    const p = previewLinkedIn("a\nb\nc\nd\ne");
    expect(p.folded).toBe(true);
    expect(p.visible).toBe("a\nb\nc");
    expect(p.hidden).toBe("d\ne");
  });
  it("folds at ~210 characters on a word", () => {
    const text = "word ".repeat(80).trim();
    const p = previewLinkedIn(text);
    expect(p.folded).toBe(true);
    expect(p.visible.length).toBeLessThanOrEqual(210);
    expect(p.visible.endsWith("word")).toBe(true);
    expect(p.foldAt).toBe(cpLength(p.visible));
  });
  it("folds Hebrew and surrogate pairs by code point", () => {
    expect(previewLinkedIn("שלום ".repeat(60)).folded).toBe(true);
    expect(previewLinkedIn("😀".repeat(3001)).over).toBe(true);
    expect(previewLinkedIn("😀".repeat(3000)).over).toBe(false);
  });
  it("builds the link card", () => {
    expect(previewLinkedIn("x", { url: "https://www.a.com/p", title: "T", image: "https://a.com/i.png" }).card).toEqual({
      title: "T",
      domain: "a.com",
      image: "https://a.com/i.png",
    });
    expect(previewLinkedIn("x").card).toBeNull();
  });
});

describe("X", () => {
  it("counts a link as 23 whatever its length", () => {
    const url = "https://example.com/" + "p".repeat(100);
    expect(countX(`hi ${url}`)).toBe(3 + 23);
    expect(previewX(`hi ${url}`)).toMatchObject({ count: 26, over: false, thread: [`hi ${url}`] });
  });
  it("is over at 281 and suggests a thread within the limit", () => {
    expect(previewX("a".repeat(280)).over).toBe(false);
    const text = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const p = previewX(text);
    expect(p.over).toBe(true);
    expect(p.thread.length).toBeGreaterThan(1);
    for (const t of p.thread) expect(countX(t)).toBeLessThanOrEqual(280);
    expect(p.thread[0].endsWith(`(1/${p.thread.length})`)).toBe(true);
    const joined = p.thread.map((t) => t.replace(/ \(\d+\/\d+\)$/, "")).join(" ");
    expect(joined).toBe(text);
  });
  it("never cuts a link, and never a Hebrew word", () => {
    const url = "https://example.com/" + "q".repeat(200);
    const text = `${"שלום עולם ".repeat(24)}${url} ${"יפה ".repeat(20)}`.trim();
    const p = previewX(text);
    expect(p.thread.filter((t) => t.includes(url)).length).toBe(1);
    const words = new Set(text.split(/\s+/));
    for (const t of p.thread) for (const w of t.replace(/ \(\d+\/\d+\)$/, "").split(/\s+/)) expect(words.has(w)).toBe(true);
  });
  it("hard-splits only a run too long for any post, by code point", () => {
    const p = previewX("😀".repeat(600));
    for (const t of p.thread) expect(countX(t)).toBeLessThanOrEqual(280);
    expect(p.thread.length).toBeGreaterThan(2);
    expect(p.thread.join("")).not.toContain("�");
  });
  it("handles empty text", () => {
    expect(previewX("")).toMatchObject({ count: 0, over: false, thread: [] });
  });
});

describe("WhatsApp", () => {
  it("styles links and basic marks, as text segments", () => {
    const p = previewWhatsApp("Hi *you*\nsee https://a.com/x now", { title: "T" });
    expect(p.lines[0]).toEqual([
      { type: "text", text: "Hi " },
      { type: "bold", text: "you" },
    ]);
    expect(p.lines[1].find((s) => s.type === "link")?.text).toBe("https://a.com/x");
    expect(p.firstLink).toBe("https://a.com/x");
    expect(p.card?.domain).toBe("a.com");
  });
  it("has no card without a link", () => {
    expect(previewWhatsApp("plain").card).toBeNull();
  });
  it("keeps markup characters as text", () => {
    expect(previewWhatsApp("<b>x</b>").lines[0]).toEqual([{ type: "text", text: "<b>x</b>" }]);
  });
});

describe("Instagram", () => {
  it("folds at ~125 characters on a word and counts hashtags", () => {
    const p = previewInstagram(`${"word ".repeat(40)}#a #b #שלום`);
    expect(p.folded).toBe(true);
    expect(p.visible.length).toBeLessThanOrEqual(125);
    expect(p.hashtags).toEqual(["#a", "#b", "#שלום"]);
    expect(p.hashtagsOver).toBe(false);
  });
  it("does not fold a short caption", () => {
    expect(previewInstagram("short")).toMatchObject({ folded: false, visible: "short", hidden: "" });
  });
  it("flags 2200 and 30 hashtags", () => {
    expect(previewInstagram("a".repeat(2201)).over).toBe(true);
    expect(previewInstagram("a".repeat(2200)).over).toBe(false);
    expect(previewInstagram(Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ")).hashtagsOver).toBe(true);
  });
  it("counts surrogate pairs once", () => {
    expect(previewInstagram("😀".repeat(2200)).over).toBe(false);
  });
});

import { emailFrameDoc } from "../email";
describe("emailFrameDoc", () => {
  it("adds the policy inside an existing head", () => {
    const d = emailFrameDoc("<!doctype html><html><head><title>t</title></head><body>x</body></html>");
    expect(d.indexOf("Content-Security-Policy")).toBeGreaterThan(d.indexOf("<head>"));
    expect(d.indexOf("Content-Security-Policy")).toBeLessThan(d.indexOf("<title>"));
    expect(d).toContain("default-src 'none'");
  });
  it("keeps the doctype first when there is no head", () => {
    expect(emailFrameDoc("<!DOCTYPE html><body>x</body>").startsWith("<!DOCTYPE html><head>")).toBe(true);
  });
  it("wraps a fragment", () => {
    expect(emailFrameDoc("<p>x</p>")).toMatch(/^<!doctype html><head>.*<\/head><p>x<\/p>$/);
  });
});
