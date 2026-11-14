import { beforeAll, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TopPostCard, metaOf } from "@/pages/Blog";
import type { PostSummary } from "@/services/blog";

/*
 * The blog's own card on a phone (W3): image first, 16:9 with the room
 * reserved, the note's glyph tile when there is no cover, titles and excerpts
 * that follow their own script (dir=auto), and date and read time as chips.
 * jsdom has no layout; the look is held by scripts/a11y/public-blog-cards.mjs.
 */
const post = (over: Partial<PostSummary> = {}): PostSummary => ({
  slug: "merging",
  title: "Merging does not ship. A tag does.",
  subtitle: null,
  excerpt: "A short excerpt.",
  publishedAt: "2026-09-29T00:00:00.000Z",
  tags: [],
  collection: "site",
  coverImage: null,
  readingMinutes: 4,
  ...over,
});
beforeAll(() => {
  /* a phone: the public breakpoint query matches */
  window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as never;
});
const t = { minRead: (n: number) => `${n} min read`, featured: "Featured" } as never;

const card = (p: PostSummary) =>
  render(
    <MemoryRouter>
      <ul>
        <TopPostCard p={p} t={t} lang="en" areaTitle="The site" />
      </ul>
    </MemoryRouter>,
  ).container;

describe("TopPostCard", () => {
  it("leads with the cover: 16:9, lazy, size reserved, decorative", () => {
    const img = card(post({ coverImage: "/media/c.jpg" })).querySelector("img")!;
    expect(img.getAttribute("src")).toBe("/media/c.jpg");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("width")).toBe("1600");
    expect(img.getAttribute("height")).toBe("900");
    expect(img.getAttribute("alt")).toBe("");
  });

  it("falls back to the glyph tile, never an empty image", () => {
    const root = card(post());
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("[data-post-media] svg")).not.toBeNull();
  });

  it("lets title and excerpt follow their own script", () => {
    const root = card(post());
    expect(root.querySelector("h3")!.getAttribute("dir")).toBe("auto");
    expect(root.querySelector("p[dir]")!.getAttribute("dir")).toBe("auto");
  });

  it("shows date and read time as chips, each with an icon", () => {
    const root = card(post());
    expect(root.querySelectorAll("[data-post-meta] svg").length).toBe(2);
    expect(root.textContent).toContain("4 min read");
  });
});

describe("metaOf", () => {
  it("has no separator character in the parts (the stylesheet draws it)", () => {
    const parts = metaOf(post(), t, "en", () => "The site");
    expect(JSON.stringify(parts)).not.toContain("·");
  });
});
