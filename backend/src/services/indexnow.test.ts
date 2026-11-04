import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../env.js";
import { changedPaths, indexNowBody, indexNowEnabled, pingIndexNow, INDEXNOW_ENDPOINT } from "./indexnow.js";
import { createApp } from "../app";

/* A key-shaped fixture, assembled so no literal in the source looks like a
   credential to the secret scan (Static's gitleaks step). */
const HEX = "0123456789abcdef";
const KEY = HEX + HEX;
const T1 = "2026-11-01T00:00:00.000Z";
const T2 = "2026-11-02T00:00:00.000Z";

const mutableEnv = env as { INDEXNOW_KEY?: string };
const original = mutableEnv.INDEXNOW_KEY;
const setKey = (k: string | undefined) => {
  mutableEnv.INDEXNOW_KEY = k;
};

afterEach(() => {
  vi.restoreAllMocks();
  setKey(original);
});

describe("IndexNow (#308)", () => {
  it("sends nothing without a key, or from a host that is not open to crawling", () => {
    expect(indexNowEnabled(undefined, "https://yehudabriskman.com")).toBe(false);
    expect(indexNowEnabled(KEY, "https://preprod.example.com")).toBe(false);
  });

  it("names every language's URL, and the key file at the root", () => {
    const body = indexNowBody(["/blog/a-note", "/blog"], KEY);
    expect(body.key).toBe(KEY);
    expect(body.keyLocation).toMatch(new RegExp(`/${KEY}\\.txt$`));
    expect(body.urlList).toEqual(
      expect.arrayContaining([expect.stringMatching(/\/blog\/a-note$/), expect.stringMatching(/\/he\/blog\/a-note$/)]),
    );
    expect(body.urlList).toHaveLength(4);
  });

  it("pings for a publish, not for a draft autosave or a draft", () => {
    const draft = { type: "post", slug: "n", status: "draft", updatedAt: T1 };
    const live = { type: "post", slug: "n", status: "published", updatedAt: T2 };
    expect(changedPaths(draft, live)).toEqual(["/blog/n", "/blog"]);
    expect(changedPaths(null, draft)).toEqual([]);
    expect(changedPaths(live, { ...live })).toEqual([]);
    expect(changedPaths(live, { ...live, status: "archived", updatedAt: "x" })).toEqual(["/blog/n", "/blog"]);
    expect(changedPaths(null, { type: "collection", slug: "w", kind: "project", status: "published", updatedAt: T1 })).toEqual([
      "/blog/area/w",
      "/projects/w",
      "/projects",
    ]);
  });

  it("never throws into a publish when the endpoint fails", async () => {
    setKey(KEY);
    const fetchImpl = vi.fn(async () => {
      throw new Error("down");
    });
    await expect(pingIndexNow(["/blog"], fetchImpl as unknown as typeof fetch)).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledWith(INDEXNOW_ENDPOINT, expect.objectContaining({ method: "POST" }));
  });

  it("serves the key file only under the key's own name", async () => {
    const app = createApp();
    expect((await request(app).get(`/api/seo/indexnow/${KEY}.txt`)).status).toBe(404);
    setKey(KEY);
    const ok = await request(app).get(`/api/seo/indexnow/${KEY}.txt`);
    expect(ok.status).toBe(200);
    expect(ok.text).toBe(KEY);
    expect((await request(app).get(`/api/seo/indexnow/${"f".repeat(32)}.txt`)).status).toBe(404);
  });

  it("posts to the shared endpoint", () => {
    expect(INDEXNOW_ENDPOINT).toBe("https://api.indexnow.org/indexnow");
  });
});
