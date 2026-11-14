import { describe, expect, it } from "vitest";
import { contentWarnings, suggestedSlot } from "../warnings";

const f = (o: Partial<Parameters<typeof contentWarnings>[0]> = {}) => ({ subject: "New note", bodyText: "Hello", blocks: null, ...o });

describe("subject advice", () => {
  it("is quiet for an ordinary subject, English or Hebrew", () => {
    expect(contentWarnings(f())).toEqual([]);
    expect(contentWarnings(f({ subject: "שלושה פוסטים חדשים באתר" }))).toEqual([]);
  });
  it("flags a long subject at 61 characters, not 60", () => {
    expect(contentWarnings(f({ subject: "a".repeat(60) }))).toEqual([]);
    expect(contentWarnings(f({ subject: "a".repeat(61) }))).toContain("subjectLong");
  });
  it("flags shouting, runs of ! or ?, and a fake Re:/Fwd:", () => {
    expect(contentWarnings(f({ subject: "BIG NEWS today" }))).toContain("subjectCaps");
    expect(contentWarnings(f({ subject: "Released" + "!!" }))).toContain("subjectBang");
    expect(contentWarnings(f({ subject: "Re: your order" }))).toContain("subjectRe");
    expect(contentWarnings(f({ subject: "FWD: x" }))).toContain("subjectRe");
    expect(contentWarnings(f({ subject: "Notes on API and CSS" }))).toEqual([]); // two short caps words apart are fine
  });
});

describe("link advice", () => {
  const cta = (url: string, label = "Read") => ({ type: "cta" as const, url, label });
  it("flags a shortener and a plain http link, in blocks or plain text", () => {
    expect(contentWarnings(f({ blocks: [cta("https://bit.ly/abc")] }))).toContain("linkShort");
    expect(contentWarnings(f({ bodyText: "see https://t.co/x" }))).toContain("linkShort");
    expect(contentWarnings(f({ blocks: [cta("http://example.org/a")] }))).toContain("linkHttp");
    expect(contentWarnings(f({ blocks: [cta("https://example.org/a")] }))).toEqual([]);
  });
  it("flags a label that shows another address than the link goes to", () => {
    expect(contentWarnings(f({ blocks: [cta("https://evil.example/x", "yehudabriskman.com/notes")] }))).toContain("linkMismatch");
    expect(contentWarnings(f({ blocks: [cta("https://www.yehudabriskman.com/notes", "yehudabriskman.com/notes")] }))).toEqual([]);
    expect(contentWarnings(f({ blocks: [cta("https://yehudabriskman.com/notes", "Read the note")] }))).toEqual([]);
  });
});

describe("image advice", () => {
  const img = (text?: string) => ({ type: "image" as const, url: "https://x/y.png", ...(text !== undefined ? { text } : {}) });
  const p = (text: string) => ({ type: "p" as const, text });
  it("flags an image with no description, and a mail that is mostly pictures", () => {
    expect(contentWarnings(f({ blocks: [img(), p("x".repeat(300))] }))).toEqual(["imageAlt"]);
    expect(contentWarnings(f({ blocks: [img("A chart"), p("short")] }))).toEqual(["imageHeavy"]);
    expect(contentWarnings(f({ blocks: [img("A chart"), p("x".repeat(300))] }))).toEqual([]);
  });
});

describe("suggestedSlot", () => {
  it("is the next Tuesday 09:30 in the zone, strictly in the future", () => {
    expect(suggestedSlot(Date.parse("2026-11-14T10:00:00Z"), "Asia/Jerusalem")).toBe("2026-11-17T09:30"); // a Saturday
    expect(suggestedSlot(Date.parse("2026-11-17T05:00:00Z"), "Asia/Jerusalem")).toBe("2026-11-17T09:30"); // Tuesday 07:00 local
    expect(suggestedSlot(Date.parse("2026-11-17T08:00:00Z"), "Asia/Jerusalem")).toBe("2026-11-24T09:30"); // Tuesday 10:00 local: next week
  });
});
