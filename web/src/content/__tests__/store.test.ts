import { afterEach, describe, expect, it, vi } from "vitest";
import { contentSnapshot, contentView, loadContent, resetContent } from "@/content/store";
import { seedBundle } from "@/content/convert";

/*
 * The store's promise (#163): the seed renders from the first frame, the
 * API's content replaces it when it is valid, and nothing the API does can
 * take the seed away.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
  resetContent();
  window.history.replaceState(null, "", "/");
});

describe("content store", () => {
  it("starts on the seed", () => {
    expect(contentSnapshot()).toEqual(seedBundle());
  });

  it("swaps in a valid bundle from /api/content", async () => {
    const next = seedBundle();
    next.siteCopy.hero.title = { en: "Edited title" };
    const fetchMock = vi.fn(async () => json(next));
    vi.stubGlobal("fetch", fetchMock);
    await loadContent();
    expect(fetchMock).toHaveBeenCalledWith("/api/content", expect.anything());
    expect(contentView().site.plateTitle.name).toBe("Edited title");
    expect(contentSnapshot().siteCopy.hero.title.en).toBe("Edited title");
  });

  it("does not re-render when the API serves the seed", async () => {
    const before = contentSnapshot();
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: true, ...JSON.parse(JSON.stringify(seedBundle())) })));
    await loadContent();
    expect(contentSnapshot()).toBe(before);
  });

  it("keeps the seed when the body fails the schema", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ projects: { items: [] } })));
    await loadContent();
    expect(contentSnapshot()).toEqual(seedBundle());
  });

  it("keeps the seed when the API is down or answers HTML", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<!doctype html>")));
    await loadContent();
    expect(contentSnapshot()).toEqual(seedBundle());
    resetContent();
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "down" }, 503)));
    await loadContent();
    expect(contentSnapshot()).toEqual(seedBundle());
  });

  it("reads the drafts first on ?preview", async () => {
    window.history.replaceState(null, "", "/?preview=1");
    const draft = seedBundle();
    draft.siteCopy.footer.place = { en: "Haifa, Israel" };
    const fetchMock = vi.fn(async (url: string) => (url.includes("preview") ? json(draft) : json(seedBundle())));
    vi.stubGlobal("fetch", fetchMock);
    await loadContent();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/content/preview");
    expect(contentSnapshot().siteCopy.footer.place.en).toBe("Haifa, Israel");
  });
});
