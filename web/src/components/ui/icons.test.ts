import { describe, expect, it } from "vitest";
import { CONCEPTS, ICON, type Concept } from "@/components/ui/icons";
import { useMobileWords } from "@/i18n/mobile";

/*
 * The icon vocabulary: one concept, one icon, a word in both languages.
 * A new concept without a word, or a word without a concept, fails here.
 */

const en = useMobileWords.of("en").icons;
const he = useMobileWords.of("he").icons;

describe("icon vocabulary", () => {
  it("has a concept for the spec's groups", () => {
    for (const c of [
      "note", "release", "project", "area", "story", "draft", "scheduled", "sending", "sent", "paused", "failed",
      "attention", "hidden", "contact", "mailable", "unsubscribed", "suppressed", "linkedin", "x", "instagram",
      "email", "from", "to", "when", "budget", "everyday", "alerts", "open", "copy", "markPosted", "delete",
      "undo", "close",
    ]) {
      expect(CONCEPTS, c).toContain(c);
    }
  });

  it.each(CONCEPTS)("%s has an icon and an en and he label", (c: Concept) => {
    expect(ICON[c], c).toBeTruthy();
    expect(en[c], `${c} en`).toBeTruthy();
    expect(he[c], `${c} he`).toMatch(/[֐-׿]|^X$/);
  });

  it("has no word without a concept", () => {
    expect(Object.keys(en).sort()).toEqual([...CONCEPTS].sort());
    expect(Object.keys(he).sort()).toEqual([...CONCEPTS].sort());
  });

  it("labels are unique within a language for different icons", () => {
    const seen = new Map<string, Concept>();
    for (const c of CONCEPTS) {
      const w = en[c];
      const prev = seen.get(w);
      if (prev) expect(ICON[prev], `${prev} and ${c} both say "${w}"`).toBe(ICON[c]);
      seen.set(w, c);
    }
  });
});
