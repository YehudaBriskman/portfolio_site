import { describe, expect, it } from "vitest";
import { neighbours, newestFirst, relatedPosts, type LinkablePost } from "./seo-links.js";

const p = (slug: string, publishedAt: string | null, tags: string[] = [], collection = "site"): LinkablePost => ({
  slug,
  publishedAt,
  tags,
  collection,
});

const ALL = [
  p("a", "2026-01-01"),
  p("b", "2026-02-01", ["react", "css"], "windom"),
  p("c", "2026-03-01", ["react"], "windom"),
  p("d", "2026-04-01", ["css"]),
  p("e", "2026-05-01", [], "windom"),
  p("f", "2026-06-01", ["react", "css"], "windom"),
  p("g", "2026-07-01", ["react"], "other"),
];

describe("neighbours", () => {
  it("is the next older and the next newer note", () => {
    expect(neighbours(ALL[3], ALL)).toEqual({ prev: ALL[2], next: ALL[4] });
  });
  it("has no previous for the oldest and no next for the newest", () => {
    expect(neighbours(ALL[0], ALL).prev).toBeNull();
    expect(neighbours(ALL[6], ALL).next).toBeNull();
  });
  it("does not depend on the order the store returned", () => {
    expect(neighbours(ALL[3], [...ALL].reverse())).toEqual(neighbours(ALL[3], ALL));
  });
});

describe("relatedPosts", () => {
  it("ranks by shared tags, then area, then newest, and never includes the note itself", () => {
    expect(relatedPosts(ALL[1], ALL).map((x) => x.slug)).toEqual(["f", "c", "g", "d", "e"]);
  });
  it("caps the list and leaves out notes with nothing in common", () => {
    expect(relatedPosts(ALL[1], ALL, 2)).toHaveLength(2);
    expect(relatedPosts(p("z", "2026-08-01", ["x"], "none"), ALL)).toEqual([]);
  });
  it("is deterministic whatever the input order", () => {
    expect(relatedPosts(ALL[1], [...ALL].reverse())).toEqual(relatedPosts(ALL[1], ALL));
  });
});

describe("newestFirst", () => {
  it("breaks a date tie by slug", () => {
    expect([p("b", "x"), p("a", "x")].sort(newestFirst).map((x) => x.slug)).toEqual(["a", "b"]);
  });
});
