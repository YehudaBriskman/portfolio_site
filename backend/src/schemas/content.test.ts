import { describe, expect, it } from "vitest";
import {
  publicDocs,
  rawImageUrl,
  rawImageUrlOrNull,
  toPublicCollection,
  toPublicSummary,
  type Collection,
  type Post,
} from "./content.js";

/*
 * WindoM's og:image was `raw.githubusercontent.com/…/blob/main/…`, which 404s:
 * the raw host has no `/blob/` segment. Every form a person might paste becomes
 * the one address that returns the file's bytes.
 */
describe("rawImageUrl", () => {
  const RAW = "https://raw.githubusercontent.com/YehudaBriskman/WindoM/main/docs/images/banner.png";

  it.each([
    ["the raw host with /blob/ left in", "https://raw.githubusercontent.com/YehudaBriskman/WindoM/blob/main/docs/images/banner.png"],
    ["a github.com /blob/ page", "https://github.com/YehudaBriskman/WindoM/blob/main/docs/images/banner.png"],
    ["a /blob/ page with ?raw=true", "https://github.com/YehudaBriskman/WindoM/blob/main/docs/images/banner.png?raw=true"],
    ["github.com's /raw/ redirect", "https://github.com/YehudaBriskman/WindoM/raw/main/docs/images/banner.png"],
    ["www.github.com", "https://www.github.com/YehudaBriskman/WindoM/blob/main/docs/images/banner.png"],
    ["an already-raw URL", RAW],
  ])("normalises %s", (_, input) => {
    expect(rawImageUrl(input)).toBe(RAW);
  });

  it("keeps a ref that is a tag or a sha, and a nested path", () => {
    expect(rawImageUrl("https://github.com/me/repo/blob/v1.2.0/a/b/c.webp")).toBe(
      "https://raw.githubusercontent.com/me/repo/v1.2.0/a/b/c.webp",
    );
  });

  it.each([
    "https://yehudabriskman.com/og.png",
    "https://github.com/me/repo",
    "https://github.com/me/repo/tree/main/docs",
    "https://github.com/me/repo/blob/main",
    "https://example.com/me/repo/blob/main/x.png",
    "not a url",
  ])("leaves %s alone", (input) => {
    expect(rawImageUrl(input)).toBe(input);
  });

  it("passes null through, and is what the public API serves", () => {
    expect(rawImageUrlOrNull(null)).toBeNull();
    expect(rawImageUrlOrNull(undefined)).toBeNull();
    const blob = "https://raw.githubusercontent.com/me/repo/blob/main/cover.png";
    const fixed = "https://raw.githubusercontent.com/me/repo/main/cover.png";
    expect(toPublicSummary({ slug: "a", coverImage: blob } as Post).coverImage).toBe(fixed);
    expect(toPublicCollection({ slug: "a", coverImage: blob, repo: null, stats: null } as unknown as Collection).coverImage).toBe(fixed);
  });
});

const NOW = "2026-11-02T10:00:00.000Z";

const area: Collection = {
  type: "collection",
  slug: "bothy",
  title: "Bothy",
  description: "",
  coverImage: null,
  links: [],
  order: 1,
  status: "published",
  kind: "project",
  tagline: "",
  repo: { owner: "me", name: "bothy", branch: "main", docPaths: ["docs/README.md", "/notes/a b.md", "../secret", " "] },
  stats: {
    stars: 3,
    forks: 1,
    openIssues: 2,
    language: "TypeScript",
    license: "MIT",
    pushedAt: NOW,
    latestRelease: null,
    fetchedAt: NOW,
    error: null,
  },
  createdAt: NOW,
  updatedAt: NOW,
};

describe("public area (#225)", () => {
  it("links only the opted-in doc paths, never one that climbs out", () => {
    expect(publicDocs(area.repo)).toEqual([
      { path: "docs/README.md", url: "https://github.com/me/bothy/blob/main/docs/README.md" },
      { path: "notes/a b.md", url: "https://github.com/me/bothy/blob/main/notes/a%20b.md" },
    ]);
    expect(publicDocs(null)).toEqual([]);
  });

  it("carries forks and the time the stats were read, but not open issues or errors", () => {
    const pub = toPublicCollection(area);
    expect(pub.stats).toMatchObject({ forks: 1, fetchedAt: NOW });
    expect(pub.stats).not.toHaveProperty("openIssues");
    expect(pub.stats).not.toHaveProperty("error");
    expect(JSON.stringify(pub)).not.toContain("docPaths");
  });
});

describe("public note summary (#225)", () => {
  it("says when it was last saved, and null for a legacy document", () => {
    const post = { slug: "a-note", updatedAt: NOW } as Post;
    expect(toPublicSummary(post).updatedAt).toBe(NOW);
    expect(toPublicSummary({ slug: "old" } as Post).updatedAt).toBeNull();
  });
});
