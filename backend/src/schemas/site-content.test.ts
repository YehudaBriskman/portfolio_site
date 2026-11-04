import { CONTENT_SEED } from "../content/seed.js";
import { buildEvents } from "../services/activity.js";
import type { Collection, Post } from "./content.js";
import { ProjectsContentSchema, SiteCopySchema, stateKey, type ContentBundle } from "./site-content.js";

/*
 * Prose fields that became `Text`, and the state chip that became a key
 * (#306). A document saved before #306 must still parse, as the new shape.
 */

const seed = () => structuredClone(CONTENT_SEED) as ContentBundle;

describe("the read shim (#306)", () => {
  it("reads a link label saved as a string as English", () => {
    const p = seed().projects as unknown as { items: Record<string, unknown>[] };
    p.items[0].links = [{ label: "Chrome Web Store", url: "https://example.com/store" }];
    const parsed = ProjectsContentSchema.parse(p);
    expect(parsed.items[0].links[0].label).toEqual({ en: "Chrome Web Store" });
  });

  it("reads a footer work label saved as a string as English, and keeps a Hebrew one", () => {
    const s = seed().siteCopy as unknown as { footer: { work: Record<string, unknown>[] } };
    s.footer.work[0].label = "WindoM";
    s.footer.work[1].label = { en: "Bothy", he: "בות׳י" };
    const parsed = SiteCopySchema.parse(s);
    expect(parsed.footer.work[0].label).toEqual({ en: "WindoM" });
    expect(parsed.footer.work[1].label).toEqual({ en: "Bothy", he: "בות׳י" });
  });

  it("stores the state as a key, from a label saved before, in the chip and the field line alike", () => {
    const p = seed().projects as unknown as { items: Record<string, unknown>[] };
    p.items[0].state = "In use";
    p.items[0].fields = [
      { kind: "state", value: "Open source" },
      { kind: "where", value: "Chrome Web Store" },
    ];
    p.items[1].state = "v1.5.1";
    const parsed = ProjectsContentSchema.parse(p);
    expect(parsed.items[0].state).toBe("in-use");
    expect(parsed.items[0].fields).toEqual([
      { kind: "state", value: "open-source" },
      { kind: "where", value: "Chrome Web Store" },
    ]);
    expect(parsed.items[1].state).toBe("v1.5.1");
  });

  it("maps every known label to its key and leaves a name alone", () => {
    expect(["Live", "In use", "Open source", "In progress", "Released", "Archive", "Archived", "in-use"].map(stateKey)).toEqual([
      "live",
      "in-use",
      "open-source",
      "in-progress",
      "released",
      "archive",
      "archive",
      "in-use",
    ]);
    expect(stateKey("Beta")).toBe("Beta");
  });

  it("the seed is already in the new shape", () => {
    const s = seed();
    expect(ProjectsContentSchema.parse(s.projects)).toEqual(s.projects);
    expect(SiteCopySchema.parse(s.siteCopy)).toEqual(s.siteCopy);
  });
});

describe("activity events carry structure, not only a sentence (#306)", () => {
  const area = {
    _id: "collection:bothy",
    type: "collection",
    slug: "bothy",
    title: "Bothy",
    status: "published",
    repo: { owner: "o", name: "Bothy", branch: "main", docPaths: [] },
    stats: { pushedAt: "2026-11-01T10:00:00.000Z" },
  } as unknown as Collection;
  const post = (he: Post["he"]) =>
    ({
      _id: "post:a",
      type: "post",
      slug: "a",
      title: "A note",
      excerpt: "Lede",
      status: "published",
      collection: "bothy",
      publishedAt: "2026-11-02T10:00:00.000Z",
      he,
    }) as unknown as Post;

  it("a push names its repository in meta, and a note carries its published Hebrew", () => {
    const events = buildEvents({ posts: [post({ title: "רשימה", subtitle: "", excerpt: "", body: "גוף" })], collections: [area], siteReleases: [] });
    expect(events.find((e) => e.kind === "push")!.meta).toMatchObject({ repo: "Bothy" });
    expect(events.find((e) => e.kind === "post")!.meta.he).toEqual({ title: "רשימה", excerpt: null });
  });

  it("a note with no Hebrew carries none", () => {
    const events = buildEvents({ posts: [post(null)], collections: [area], siteReleases: [] });
    expect(events.find((e) => e.kind === "post")!.meta.he).toBeNull();
  });
});
