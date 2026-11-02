import { describe, expect, it } from "vitest";
import { complete, parseAsk, pendingSigil, suggest } from "@/components/dashboard/ask";
import { dayPart, greeting, hourOf, relative } from "@/components/dashboard/i18n";

const TOPICS = [
  { value: "ci", label: "ci" },
  { value: "github actions", label: "github actions" },
  { value: "css", label: "css" },
];
const AREAS = [
  { value: "site", label: "The site" },
  { value: "bothy", label: "Bothy" },
];

describe("the ask box's language", () => {
  it("reads # as a topic, @ as an area and the rest as search words", () => {
    expect(parseAsk("rollback #ci @bothy fast", TOPICS, AREAS)).toEqual({
      q: "rollback fast",
      tags: ["ci"],
      areas: ["bothy"],
    });
  });

  it("matches a topic with spaces through its dashed form, and an area by its title", () => {
    expect(parseAsk("#github-actions @The", TOPICS, AREAS).tags).toEqual(["github actions"]);
    expect(parseAsk("@BOTHY", TOPICS, AREAS).areas).toEqual(["bothy"]);
  });

  it("keeps an unknown #word as a search word rather than dropping it", () => {
    expect(parseAsk("#kubernetes @nowhere", TOPICS, AREAS)).toEqual({ q: "kubernetes nowhere", tags: [], areas: [] });
  });

  it("offers matches only while a # or @ word is being typed, and completes it", () => {
    expect(pendingSigil("hello")).toBeNull();
    expect(pendingSigil("hello #c")).toEqual({ sigil: "#", word: "c" });
    expect(suggest("hello #c", TOPICS, AREAS).map((o) => o.value)).toEqual(["ci", "css", "github actions"]);
    expect(suggest("@b", TOPICS, AREAS).map((o) => o.value)).toEqual(["bothy"]);
    expect(suggest("#ci ", TOPICS, AREAS)).toEqual([]);
    expect(complete("x #git", TOPICS[1])).toBe("x #github-actions ");
  });
});

describe("the greeting", () => {
  it("follows the reader's hour, read through Intl in their time zone", () => {
    const d = new Date("2026-11-02T18:30:00Z");
    expect(hourOf(d, "UTC")).toBe(18);
    expect(hourOf(d, "Asia/Jerusalem")).toBe(20);
    expect(greeting(d, "en", "UTC")).toBe("Good evening");
    expect(greeting(new Date("2026-11-02T06:00:00Z"), "en", "UTC")).toBe("Good morning");
  });

  it("speaks Hebrew when the page is in Hebrew", () => {
    expect(greeting(new Date("2026-11-02T18:30:00Z"), "he", "UTC")).toBe("ערב טוב");
    expect(greeting(new Date("2026-11-02T13:00:00Z"), "he", "UTC")).toBe("צהריים טובים");
  });

  it("splits the day at 5, 12, 17 and 22", () => {
    expect([4, 5, 11, 12, 16, 17, 21, 22].map(dayPart)).toEqual([
      "night",
      "morning",
      "morning",
      "afternoon",
      "afternoon",
      "evening",
      "evening",
      "night",
    ]);
  });

  it("ages a timestamp in the page's language", () => {
    const now = Date.parse("2026-11-03T12:00:00Z");
    expect(relative("2026-10-31T12:00:00Z", now, "en")).toBe("3 days ago");
    expect(relative("2026-10-31T12:00:00Z", now, "he")).toBe("לפני 3 ימים");
    expect(relative(null, now, "en")).toBe("");
  });
});
