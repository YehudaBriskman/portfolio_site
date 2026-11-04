import { describe, expect, it } from "vitest";
import {
  KEYS,
  NEW_PROJECTS,
  PICTURES,
  fillHebrew,
  hebrewIndex,
  mergeKey,
  readPayload,
  // @ts-expect-error -- a plain .mjs script, run with node; vitest loads it as is.
} from "./load-projects-story.mjs";

/*
 * The loader's merge (load-projects-story.mjs): what it adds, what it fills,
 * and everything it must leave exactly as the store has it.
 */

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const payload = readPayload() as Any;
const LIB = new Map<string, string>([
  ["portfolio_site.jpg", "https://yehudabriskman.com/api/images/media/portfolio-site-0a1b2c"],
  ["oci_free.jpg", "https://yehudabriskman.com/api/images/media/oci-free-3d4e5f"],
]);

/** The store as it was before this change: no new projects, no Hebrew on the seeded words. */
function stripHebrew<T>(v: T): T {
  if (Array.isArray(v)) return v.map(stripHebrew) as T;
  if (!v || typeof v !== "object") return v;
  const o = v as Any;
  if (typeof o.en === "string" && !("words" in o)) {
    const { he: _he, heSrc: _src, ...rest } = o;
    return rest as T;
  }
  return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, stripHebrew(x)])) as T;
}
const NEW = new Set(Object.keys(NEW_PROJECTS));
function oldStore(): { projects: Any; story: Any; siteCopy: Any } {
  const projects = stripHebrew(structuredClone(payload.projects));
  projects.items = projects.items.filter((p: Any) => !NEW.has(p.slug));
  const story = stripHebrew(structuredClone(payload.story));
  story.images = {
    windom: { src: "https://yehudabriskman.com/api/images/media/windom-01a68d", alt: { en: "WindoM", he: "WindoM" } },
  };
  return { projects, story, siteCopy: stripHebrew(structuredClone(payload.siteCopy)) };
}

describe("readPayload", () => {
  it("reads the generated seed, with every key the loader writes", () => {
    expect(KEYS).toEqual(["projects", "story", "site-copy"]);
    for (const f of ["projects", "story", "siteCopy"]) expect(payload[f]).toBeTypeOf("object");
    for (const slug of NEW) expect(payload.projects.items.some((p: Any) => p.slug === slug)).toBe(true);
  });
});

describe("mergeKey: projects", () => {
  it("adds the new projects, pointed at the library, and keeps the rest in order", () => {
    const { projects } = oldStore();
    projects.items[0].description = { en: "Edited by the owner since." };
    const before = projects.items.map((p: Any) => p.slug);
    const { next, changes } = mergeKey("projects", projects, payload, LIB);
    expect(next.items.map((p: Any) => p.slug)).toEqual([...before, ...NEW]);
    expect(next.items.find((p: Any) => p.slug === "oci-free").image).toBe(LIB.get("oci_free.jpg"));
    expect(next.items.find((p: Any) => p.slug === "portfolio-site").image).toBe(LIB.get("portfolio_site.jpg"));
    expect(changes.filter((c: string) => c.startsWith("+ project"))).toHaveLength(2);
    // An English the owner changed gets no Hebrew written against the old one.
    expect(next.items[0].description).toEqual({ en: "Edited by the owner since." });
    // The fact beside it, unchanged, does.
    expect(next.items[0].fact.he).toBeTruthy();
  });

  it("does not touch the input, and a second run changes nothing", () => {
    const { projects } = oldStore();
    const snapshot = structuredClone(projects);
    const first = mergeKey("projects", projects, payload, LIB);
    expect(projects).toEqual(snapshot);
    expect(mergeKey("projects", first.next, payload, LIB).changes).toEqual([]);
  });

  it("never replaces Hebrew the store already has", () => {
    const { projects } = oldStore();
    projects.items[0].fact = { ...projects.items[0].fact, he: "עברית של הבעלים" };
    const { next } = mergeKey("projects", projects, payload, LIB);
    expect(next.items[0].fact.he).toBe("עברית של הבעלים");
  });

  it("keeps a project the seed does not know", () => {
    const { projects } = oldStore();
    const extra = { ...structuredClone(projects.items[0]), slug: "owner-only", title: "Owner only" };
    projects.items.push(extra);
    const { next } = mergeKey("projects", projects, payload, LIB);
    expect(next.items.find((p: Any) => p.slug === "owner-only").title).toBe("Owner only");
  });
});

describe("mergeKey: story", () => {
  it("keeps the store's pictures and adds one per new beat", () => {
    const { story } = oldStore();
    const { next } = mergeKey("story", story, payload, LIB);
    expect(next.images.windom).toEqual(story.images.windom);
    expect(next.images["oci-free"]).toEqual({
      src: LIB.get("oci_free.jpg"),
      alt: { en: PICTURES["oci_free.jpg"].alt, he: PICTURES["oci_free.jpg"].he.alt },
    });
    expect(next.start.title.he).toBeTruthy();
    expect(next.roles.every((r: Any) => r.title.he && r.lines.every((l: Any) => l.he))).toBe(true);
  });

  it("keeps a picture the owner already chose for a new beat", () => {
    const { story } = oldStore();
    const mine = { src: "https://yehudabriskman.com/api/images/media/mine-aaaaaa", alt: { en: "Mine" } };
    story.images["oci-free"] = mine;
    expect(mergeKey("story", story, payload, LIB).next.images["oci-free"]).toEqual(mine);
  });

  it("adds no picture for a beat whose project will not be published", () => {
    const { story } = oldStore();
    const { next, notes } = mergeKey("story", story, payload, LIB, new Set(["windom", "bothy"]));
    expect(next.images["oci-free"]).toBeUndefined();
    expect(notes.length).toBe(2);
  });

  it("adds no picture before the cover is in the library", () => {
    const { story } = oldStore();
    const { next } = mergeKey("story", story, payload, new Map([["oci_free.jpg", "<library URL of oci_free.jpg>"]]));
    expect(next.images["oci-free"]).toBeUndefined();
  });
});

describe("mergeKey: site-copy", () => {
  it("fills the Hebrew and leaves the layout and everything else alone", () => {
    const { siteCopy } = oldStore();
    const { next, changes } = mergeKey("site-copy", siteCopy, payload, LIB);
    expect(changes.length).toBe(1);
    expect(stripHebrew(next)).toEqual(siteCopy);
  });
});

describe("hebrewIndex and fillHebrew", () => {
  it("drops an English translated two ways, rather than guess", () => {
    const index = hebrewIndex({ a: { en: "Live", he: "באוויר" }, b: { en: "Live", he: "חי" }, c: { en: "Open", he: "פתוח" } });
    expect(index.has("Live")).toBe(false);
    expect(index.get("Open")).toBe("פתוח");
  });

  it("passes an interlude's words through untouched", () => {
    const words = { words: [{ en: "x", he: "y" }] };
    const { next, filled } = fillHebrew({ words }, new Map([["x", "z"]]));
    expect(next.words).toEqual(words);
    expect(filled).toEqual([]);
  });
});
