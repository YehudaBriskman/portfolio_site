import { describe, expect, it } from "vitest";
import { contentModifiedAt, itemModifiedAt, stampItemsModified, stampContentModified } from "./content-modified.js";
import { buildSitemap } from "./seo.js";
import type { Post } from "../schemas/content.js";

const T1 = "2026-01-03T00:00:00.000Z";
const T2 = "2026-11-10T00:00:00.000Z";
const T3 = "2026-11-12T00:00:00.000Z";

const post = (o: Partial<Post> = {}): Post =>
  ({
    type: "post", slug: "a-post", title: "A post", subtitle: null, excerpt: "x", body: "Body one.", bodyFormat: "markdown",
    status: "published", publishedAt: "2026-01-02T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: T1,
    tags: [], collection: "site", source: "authored", coverImage: null, links: [], readingMinutes: 1, featured: null,
    seo: { title: null, description: null, canonical: null, noindex: false }, ...o,
  }) as Post;

const he = { title: "כותרת", subtitle: "", excerpt: "", body: "גוף" };

describe("contentModifiedAt", () => {
  it("keeps the date when unchanged content is re-saved", () => {
    const a = stampContentModified(null, post(), T1);
    const b = stampContentModified(a, { ...a, updatedAt: T2, seo: { ...a.seo, noindex: false }, status: "published" }, T2);
    expect(contentModifiedAt(b)).toBe(T1);
  });

  it("moves the date when the body changes", () => {
    const a = stampContentModified(null, post(), T1);
    const b = stampContentModified(a, { ...a, body: "Body two.", updatedAt: T2 }, T2);
    expect(contentModifiedAt(b)).toBe(T2);
  });

  it("moves only the Hebrew date for a translation-only change", () => {
    const a = stampContentModified(null, post({ he }), T1);
    const b = stampContentModified(a, { ...a, he: { ...he, body: "גוף חדש" }, updatedAt: T2 }, T2);
    expect(contentModifiedAt(b, "en")).toBe(T1);
    expect(contentModifiedAt(b, "he")).toBe(T2);
  });

  it("falls back to updatedAt for old documents, and a first stamp of unchanged content keeps it", () => {
    const old = post({ updatedAt: T1 });
    expect(contentModifiedAt(old)).toBe(T1);
    const re = stampContentModified(old, { ...old, updatedAt: T2 }, T2);
    expect(contentModifiedAt(re)).toBe(T1);
    const edited = stampContentModified(old, { ...old, title: "New", updatedAt: T3 }, T3);
    expect(contentModifiedAt(edited)).toBe(T3);
  });

  it("gives each sitemap language URL its own date", () => {
    let p = stampContentModified(null, post({ he }), T1);
    p = stampContentModified(p, { ...p, he: { ...he, body: "אחר" }, updatedAt: T2 }, T2);
    const xml = buildSitemap([p], []);
    const block = (path: string) => xml.split("<url>").find((u) => u.includes(`<loc>${path}`) || u.includes(`${path}</loc>`)) ?? "";
    expect(block("/blog/a-post")).toContain(`<lastmod>${T1}`);
    expect(block("/he/blog/a-post")).toContain(`<lastmod>${T2}`);
  });
});

describe("project dates (#529)", () => {
  const item = (slug: string, en: string, heText?: string, order = 1) => ({ slug, order, fact: { en, ...(heText ? { he: heText, heSrc: "x" } : {}) } });

  it("moves only the language that changed, and ignores order and fingerprints", () => {
    const first = stampItemsModified({ items: [item("a", "one", "אחת")], at: T1 }, [item("a", "one", "אחת", 2)], undefined, T2);
    expect(first.a.en!.at).toBe(T1);
    expect(first.a.he!.at).toBe(T1);
    const second = stampItemsModified({ items: [item("a", "one", "אחת")], at: T2 }, [item("a", "one", "שתיים")], first, T3);
    expect(second.a.en!.at).toBe(T1);
    expect(second.a.he!.at).toBe(T3);
  });

  it("gives a new project the publish date, and no date to one unchanged since the seed", () => {
    const out = stampItemsModified({ items: [item("a", "one")], at: null }, [item("a", "one"), item("b", "two")], undefined, T2);
    expect(out.a).toEqual({});
    expect(out.b.en!.at).toBe(T2);
    const again = stampItemsModified({ items: [item("a", "one"), item("b", "two")], at: T2 }, [item("a", "one"), item("b", "two")], out, T3);
    expect(again.a).toEqual({});
  });

  it("falls back to the document's publish date for one stored before the stamps", () => {
    expect(itemModifiedAt({ publishedAt: T1 }, "a", "en")).toBe(T1);
    expect(itemModifiedAt({ publishedAt: T1, itemMod: {} }, "a", "en")).toBeUndefined();
    expect(itemModifiedAt(null, "a", "en")).toBeUndefined();
  });
});
