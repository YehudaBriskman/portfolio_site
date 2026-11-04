import { describe, expect, it } from "vitest";
import { eventTitle } from "@/components/dashboard/eventTitle";
import { WORDS } from "@/components/dashboard/i18n";
import { kindOf } from "@/components/projects/catalogue";
import { stateWord } from "@/components/work/words";
import type { ActivityEvent } from "@/services/activity";

/* The state chip as a key, and activity lines built from structure (#306). */

describe("stateWord", () => {
  it("words a key in each language, and a label saved before #306 the same way", () => {
    expect(stateWord("in-use", "en")).toBe("In use");
    expect(stateWord("in-use", "he")).toBe("בשימוש");
    expect(stateWord("In use", "he")).toBe("בשימוש");
    expect(stateWord("archive", "he")).toBe("ארכיון");
    expect(stateWord("open-source", "en")).toBe("Open source");
  });

  it("reads a release tag as released, and prints anything else as written", () => {
    expect(stateWord("v1.5.1", "he")).toBe("פורסם");
    expect(stateWord("Beta", "he")).toBe("Beta");
  });

  it("gives keys and old labels the same colour family", () => {
    expect(["live", "in-use", "open-source", "v2.0.0", "archive"].map(kindOf)).toEqual(["live", "use", "open", "release", "rest"]);
    expect(kindOf("In use")).toBe("use");
  });
});

describe("eventTitle", () => {
  const ev = (over: Partial<ActivityEvent>): ActivityEvent =>
    ({ id: "x", kind: "push", at: "2026-11-01T00:00:00.000Z", area: null, title: "Pushed to Bothy", href: "https://example.com", meta: {}, ...over }) as ActivityEvent;

  it("words a push from the repository's name, in the page's language", () => {
    const e = ev({ meta: { repo: "Bothy" } });
    expect(eventTitle(e, WORDS.he, "he")).toBe("עדכוני קוד ב־Bothy");
    expect(eventTitle(e, WORDS.en, "en")).toBe("Pushed to Bothy");
  });

  it("shows a note's Hebrew title on a Hebrew page, the English where there is none", () => {
    const e = ev({ kind: "post", title: "A note", meta: { he: { title: "רשימה", excerpt: null } } });
    expect(eventTitle(e, WORDS.he, "he")).toBe("רשימה");
    expect(eventTitle(e, WORDS.en, "en")).toBe("A note");
    expect(eventTitle(ev({ kind: "post", title: "A note", meta: { he: null } }), WORDS.he, "he")).toBe("A note");
  });

  it("falls back to the sent title for an event from before #306", () => {
    expect(eventTitle(ev({ meta: {} }), WORDS.he, "he")).toBe("Pushed to Bothy");
  });
});
