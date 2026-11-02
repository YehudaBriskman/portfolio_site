import { afterEach, describe, expect, it, vi } from "vitest";
import { activity, activityQueryString, areaFeedUrl } from "../activity";
import { topPosts } from "../blog";

/* The typed client the dashboards (#224–#227) build on. fetch is stubbed. */

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body)));

describe("activityQueryString", () => {
  it("writes only what was asked, with kinds as one comma list", () => {
    expect(activityQueryString()).toBe("");
    expect(activityQueryString({ limit: 10, before: "abc", area: "windom", kind: ["release", "site"] })).toBe(
      "?limit=10&before=abc&area=windom&kind=release%2Csite",
    );
    expect(activityQueryString({ before: null, kind: "post" })).toBe("?kind=post");
  });
});

describe("activity client", () => {
  it("parses a page and passes the cursor through", async () => {
    const fetchMock = json({
      ok: true,
      items: [
        {
          id: "post:a-note",
          kind: "post",
          at: "2026-10-20T10:00:00.000Z",
          area: { slug: "site", title: "Notes" },
          title: "A note",
          href: "/blog/a-note",
          meta: { tags: [] },
        },
      ],
      nextCursor: "next",
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = await activity.page({ limit: 1 });
    expect(fetchMock).toHaveBeenCalledWith("/api/activity?limit=1");
    expect(page.items[0].kind).toBe("post");
    expect(page.nextCursor).toBe("next");
  });

  it("parses areas with their counts", async () => {
    vi.stubGlobal(
      "fetch",
      json({
        ok: true,
        items: [
          {
            slug: "windom",
            title: "Windom",
            tagline: "",
            description: "",
            coverImage: null,
            links: [],
            order: 10,
            kind: "project",
            repoUrl: null,
            stats: null,
            noteCount: 4,
            lastActivityAt: "2026-10-28T08:00:00.000Z",
            topics: [{ tag: "ci", count: 2 }],
          },
        ],
      }),
    );
    const [area] = await activity.areas();
    expect(area).toMatchObject({ slug: "windom", noteCount: 4, topics: [{ tag: "ci", count: 2 }] });
  });

  it("reports an HTML answer as an unreachable server", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<!doctype html>")));
    await expect(activity.page()).rejects.toThrow("Couldn't reach the server.");
  });

  it("names an area's feed", () => {
    expect(areaFeedUrl("windom")).toBe("/api/seo/feed/windom.xml");
  });
});

describe("topPosts", () => {
  it("puts featured posts first in their order, then the newest", () => {
    const posts = [
      { slug: "old", featured: null, publishedAt: "2026-01-01" },
      { slug: "new", featured: null, publishedAt: "2026-10-01" },
      { slug: "second", featured: 2, publishedAt: "2025-01-01" },
      { slug: "first", featured: 1, publishedAt: "2024-01-01" },
      { slug: "legacy", publishedAt: "2026-09-01" },
    ];
    expect(topPosts(posts).map((p) => p.slug)).toEqual(["first", "second", "new"]);
    expect(topPosts(posts, 5).map((p) => p.slug)).toEqual(["first", "second", "new", "legacy", "old"]);
  });
});
