import { describe, expect, it } from "vitest";
import { cardSrc, eventUrl, kitChannel, links, parseTags } from "../helpers";

describe("announce helpers", () => {
  it("builds the card from the event's own ref", () => {
    expect(cardSrc({ kind: "post", ref: "a b" }, "og")).toBe("/api/seo/og/blog/a%20b.png");
    expect(cardSrc({ kind: "release", ref: "v1.5.0" }, "story")).toBe("/api/seo/og/release/v1.5.0.png?format=story");
  });
  it("puts a note's Hebrew page under /he, and leaves a release link alone", () => {
    expect(eventUrl({ kind: "post", url: "https://x.test/blog/a" }, "he")).toBe("https://x.test/he/blog/a");
    expect(eventUrl({ kind: "release", url: "https://github.com/o/r/releases/tag/v1" }, "he")).toBe("https://github.com/o/r/releases/tag/v1");
  });
  it("falls back from Email to Gmail", () => {
    expect(kitChannel("email", (c) => c === "gmail")).toBe("gmail");
    expect(kitChannel("x", () => false)).toBeNull();
  });
  it("does not print the link twice on X", () => {
    const href = links.x("https://x.test/a", "hi https://x.test/a");
    expect(new URL(href).searchParams.has("url")).toBe(false);
    expect(new URL(href).searchParams.get("text")).toBe("hi https://x.test/a");
  });
  it("splits hashtags on spaces and commas", () => {
    expect(parseTags(" #a,b  c,, ")).toEqual(["#a", "b", "c"]);
  });
});
