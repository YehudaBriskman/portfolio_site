import { describe, expect, it } from "vitest";
import { publicDocs, toPublicCollection, toPublicSummary, type Collection, type Post } from "./content.js";

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
