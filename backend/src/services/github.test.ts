import { fetchSiteReleases, pickSiteReleases, startStatsRefresh } from "./github.js";
import type { SiteReleases } from "../schemas/content.js";

/*
 * The site's own releases, which the scheduled refresh stores for the
 * activity feed's `site` events (#223). fetch is stubbed; nothing here
 * reaches GitHub.
 */

const rel = (tag: string, publishedAt: string | null, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  name: tag,
  html_url: `https://github.com/o/r/releases/tag/${tag}`,
  published_at: publishedAt,
  draft: false,
  prerelease: false,
  ...extra,
});

afterEach(() => vi.unstubAllGlobals());

describe("pickSiteReleases", () => {
  it("keeps published v* releases only, newest first", () => {
    const picked = pickSiteReleases([
      rel("v1.0.0", "2026-01-01T00:00:00Z"),
      rel("v1.1.0", "2026-02-01T00:00:00Z"),
      rel("web-1.2", "2026-03-01T00:00:00Z"),
      rel("v2.0.0-rc1", "2026-04-01T00:00:00Z", { prerelease: true }),
      rel("v2.0.0", null, { draft: true }),
    ]);
    expect(picked.map((r) => r.tag)).toEqual(["v1.1.0", "v1.0.0"]);
  });
});

describe("fetchSiteReleases", () => {
  const previous: SiteReleases = {
    _id: "site-releases",
    _rev: "4-abc",
    type: "site-releases",
    repo: { owner: "o", name: "r" },
    items: [{ tag: "v0.9.0", name: null, url: "https://x", publishedAt: "2025-12-01T00:00:00Z" }],
    fetchedAt: "2026-01-01T00:00:00Z",
    error: null,
  };

  it("stores the fetched list under the previous revision", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([rel("v1.0.0", "2026-01-01T00:00:00Z")]))));
    const doc = await fetchSiteReleases({ owner: "o", name: "r" }, previous);
    expect(doc).toMatchObject({ _id: "site-releases", _rev: "4-abc", error: null });
    expect(doc.items.map((r) => r.tag)).toEqual(["v1.0.0"]);
  });

  it("keeps the last good list when GitHub fails, and says why", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    const doc = await fetchSiteReleases({ owner: "o", name: "r" }, previous);
    expect(doc.items).toEqual(previous.items);
    expect(doc.error).toMatch(/GitHub/);
  });
});

describe("startStatsRefresh", () => {
  it("keeps saving later areas after one save fails", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ stargazers_count: 1, pushed_at: "2026-01-01T00:00:00Z" }), { status: 200 })));
    const cols = ["a", "b", "c"].map((n) => ({ _id: n, repo: { owner: "o", name: n } }));
    const saved: string[] = [];
    const stop = startStatsRefresh({
      list: async () => cols as never,
      save: async (c) => {
        if (c._id === "a") throw new Error("409");
        saved.push(c._id!);
      },
    });
    await vi.advanceTimersByTimeAsync(21_000);
    stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    expect(saved).toEqual(["b", "c"]);
  });
});
