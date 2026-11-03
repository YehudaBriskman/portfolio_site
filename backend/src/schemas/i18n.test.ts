import {
  collectionTranslation,
  countUnits,
  coverage,
  findTexts,
  fp,
  hasPublishedHebrew,
  itemStatus,
  normaliseSource,
  postTranslation,
  textUnits,
  unitStatus,
  type TranslationUnit,
} from "./i18n.js";
import type { Collection, Post } from "./content.js";

/*
 * The translation status vocabulary (#301): the fingerprint, one unit, the
 * roll-up to an item, and the two stored shapes it reads (a note's `he` block
 * and a `Text` field).
 */

const NOW = "2026-11-03T08:00:00.000Z";

function post(over: Partial<Post> = {}): Post {
  return {
    type: "post",
    slug: "a-note",
    title: "A note",
    subtitle: null,
    excerpt: "The lede.",
    body: "Body text.",
    bodyFormat: "markdown",
    status: "published",
    publishedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    tags: [],
    collection: "site",
    source: "authored",
    coverImage: null,
    links: [],
    readingMinutes: 1,
    featured: null,
    seo: { title: null, description: null, canonical: null, noindex: false },
    ...over,
  } as Post;
}

describe("the fingerprint", () => {
  it("is twelve hex characters of sha256", () => {
    expect(fp("Hello")).toMatch(/^[0-9a-f]{12}$/);
    expect(fp("Hello")).toBe(fp("Hello"));
    expect(fp("Hello")).not.toBe(fp("Hello."));
  });

  it("ignores reflowed whitespace and Unicode composition, and nothing else", () => {
    expect(fp("one  two\nthree ")).toBe(fp("one two three"));
    /* é composed and decomposed are one text. */
    expect(fp("café")).toBe(fp("café"));
    expect(fp("One two")).not.toBe(fp("one two"));
    expect(normaliseSource("  a \t b\n")).toBe("a b");
  });
});

describe("one unit's status", () => {
  const en = "The English.";

  it("is missing with no Hebrew, draft with Hebrew only in a draft", () => {
    expect(unitStatus({ en })).toBe("missing");
    expect(unitStatus({ en, he: "  " })).toBe("missing");
    expect(unitStatus({ en, draftHe: "עברית" })).toBe("draft");
  });

  it("is unverified with published Hebrew and no fingerprint", () => {
    expect(unitStatus({ en, he: "עברית" })).toBe("unverified");
  });

  it("is translated when the fingerprint matches the English, stale when it does not", () => {
    expect(unitStatus({ en, he: "עברית", heSrc: fp(en) })).toBe("translated");
    expect(unitStatus({ en: "The English, edited.", he: "עברית", heSrc: fp(en) })).toBe("stale");
    /* A whitespace-only edit is not an edit. */
    expect(unitStatus({ en: "The  English.\n", he: "עברית", heSrc: fp(en) })).toBe("translated");
  });

  it("reads published Hebrew before a draft", () => {
    expect(unitStatus({ en, he: "עברית", heSrc: fp(en), draftHe: "עברית חדשה" })).toBe("translated");
  });

  it("counts translated, unverified and stale as Hebrew a reader gets", () => {
    expect(hasPublishedHebrew("translated")).toBe(true);
    expect(hasPublishedHebrew("unverified")).toBe(true);
    expect(hasPublishedHebrew("stale")).toBe(true);
    expect(hasPublishedHebrew("draft")).toBe(false);
    expect(hasPublishedHebrew("missing")).toBe(false);
    expect(hasPublishedHebrew(null)).toBe(false);
  });
});

describe("an item's status", () => {
  const u = (status: TranslationUnit["status"], primary = true): TranslationUnit => ({ path: "x", status, primary, en: "x", he: null, draftHe: null });

  it("is the worst of its primary units", () => {
    expect(itemStatus([u("translated"), u("stale")])).toBe("stale");
    expect(itemStatus([u("stale"), u("missing")])).toBe("missing");
    expect(itemStatus([u("translated"), u("unverified")])).toBe("unverified");
  });

  it("is not moved by a secondary unit", () => {
    expect(itemStatus([u("translated"), u("missing", false)])).toBe("translated");
  });

  it("falls back to every unit when none is primary, and is null with no units", () => {
    expect(itemStatus([u("draft", false)])).toBe("draft");
    expect(itemStatus([])).toBeNull();
  });
});

describe("a note", () => {
  it("is missing in Hebrew with no Hebrew block, field by field", () => {
    const { units, status } = postTranslation(post());
    expect(status).toBe("missing");
    /* An empty subtitle is not a unit. */
    expect(units.map((x) => x.path)).toEqual(["title", "excerpt", "body"]);
  });

  it("reads the published Hebrew and its per-field fingerprints", () => {
    const p = post({
      he: { title: "רשימה", subtitle: "", excerpt: "הפתיח.", body: "גוף.", src: { title: fp("A note"), excerpt: fp("An older lede.") } } as Post["he"],
    });
    const byPath = Object.fromEntries(postTranslation(p).units.map((x) => [x.path, x.status]));
    expect(byPath).toEqual({ title: "translated", excerpt: "stale", body: "unverified" });
    expect(postTranslation(p).status).toBe("stale");
  });

  it("reads Hebrew in an unpublished draft as draft", () => {
    const p = post({ draft: { he: { title: "רשימה", subtitle: "", excerpt: "", body: "" } } as Post["draft"] });
    const title = postTranslation(p).units.find((x) => x.path === "title")!;
    expect(title).toMatchObject({ status: "draft", draftHe: "רשימה", he: null });
  });

  it("calls the Hebrew of a never-published note a draft", () => {
    const p = post({ status: "draft", he: { title: "רשימה", subtitle: "", excerpt: "", body: "גוף" } as Post["he"] });
    expect(postTranslation(p).units.find((x) => x.path === "title")!.status).toBe("draft");
  });
});

describe("an area", () => {
  it("reads the area's Hebrew block", () => {
    const c = {
      type: "collection",
      slug: "bothy",
      title: "Bothy",
      tagline: "A dev box",
      description: "",
      he: { title: "Bothy", tagline: null, description: null },
    } as unknown as Collection;
    const { units, status } = collectionTranslation(c);
    expect(units.map((x) => [x.path, x.status])).toEqual([
      ["title", "unverified"],
      ["tagline", "missing"],
    ]);
    expect(status).toBe("missing");
  });
});

describe("structured copy", () => {
  const published = {
    slug: "windom",
    title: "WindoM",
    fact: { en: "A new tab.", he: "לשונית חדשה.", heSrc: fp("A new tab.") },
    description: { en: "Longer.", he: "ארוך." },
    decisions: [{ title: { en: "One" }, body: { en: "Why.", he: "למה.", heSrc: fp("Why not.") } }],
    tech: ["React"],
  };

  it("finds every Text and its path, and nothing that is not one", () => {
    expect(findTexts(published).map((t) => t.path)).toEqual(["fact", "description", "decisions.0.title", "decisions.0.body"]);
  });

  it("gives each Text a status, with the draft's Hebrew at the same path", () => {
    const draft = structuredClone(published) as Record<string, unknown>;
    (draft.decisions as { title: { en: string; he?: string } }[])[0].title.he = "אחת";
    const units = textUnits(published, draft, (p) => p === "fact");
    expect(units.map((x) => [x.path, x.status, x.primary])).toEqual([
      ["fact", "translated", true],
      ["description", "unverified", false],
      ["decisions.0.title", "draft", false],
      ["decisions.0.body", "stale", false],
    ]);
  });
});

describe("counts", () => {
  it("counts units, and coverage is the share a Hebrew reader gets in Hebrew", () => {
    const units = postTranslation(post({ he: { title: "x", subtitle: "", excerpt: "", body: "" } as Post["he"] })).units;
    const counts = countUnits([{ type: "post", id: "a", title: "a", route: "/", rank: 0, visibility: "public", status: null, units }]);
    expect(counts).toEqual({ missing: 2, draft: 0, stale: 0, unverified: 1, translated: 0 });
    expect(coverage(counts)).toBe(33);
    expect(coverage({ missing: 0, draft: 0, stale: 0, unverified: 0, translated: 0 })).toBe(100);
  });
});
