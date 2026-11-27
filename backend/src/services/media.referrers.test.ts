import { couch } from "../db/couch.js";
import { mediaStore, usageIndex } from "./media.js";
import { publicContentJson, resetPublicContentCache } from "./media-visibility.js";

/* A use past the first page must still stop a delete: the scan pages to the end. */

afterEach(() => {
  vi.restoreAllMocks();
  resetPublicContentCache();
});

describe("mediaStore.referrers", () => {
  it("pages by bookmark until a short page", async () => {
    const page = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ _id: `post:${from + i}`, type: "post" }));
    const last = { _id: "post:last", type: "post", coverImage: "/api/images/media/pic-abc123" };
    const asked: Array<{ limit: number; bookmark?: string }> = [];
    vi.spyOn(couch, "find").mockImplementation(async (q: unknown) => {
      const query = q as { limit: number; bookmark?: string };
      asked.push(query);
      if (!query.bookmark) return { docs: page(0, query.limit), bookmark: "b1" } as never;
      if (query.bookmark === "b1") return { docs: page(query.limit, query.limit), bookmark: "b2" } as never;
      return { docs: [last], bookmark: "b3" } as never;
    });
    const refs = await mediaStore.referrers();
    expect(asked.map((q) => q.bookmark)).toEqual([undefined, "b1", "b2"]);
    expect(refs).toHaveLength(asked[0].limit * 2 + 1);
    expect(usageIndex(["pic-abc123"], refs).get("pic-abc123")).toHaveLength(1);
  });
});

describe("publicContentJson", () => {
  it("reads every page, so a published page past the first still makes its picture public", async () => {
    const asked: Array<{ limit: number; bookmark?: string }> = [];
    const post = (id: string, extra: Record<string, unknown> = {}) => ({ _id: id, type: "post", status: "published", ...extra });
    vi.spyOn(couch, "find").mockImplementation(async (q: unknown) => {
      const query = q as { limit: number; bookmark?: string };
      asked.push(query);
      if (!query.bookmark) return { docs: Array.from({ length: query.limit }, (_, i) => post(`post:${i}`)), bookmark: "b1" } as never;
      return { docs: [post("post:last", { coverImage: "/api/images/media/pic-abc123" })], bookmark: "b2" } as never;
    });
    const blobs = await publicContentJson();
    expect(asked.map((q) => q.bookmark)).toEqual([undefined, "b1"]);
    expect(blobs).toHaveLength(asked[0].limit + 1);
    expect(blobs.some((j) => j.includes("pic-abc123"))).toBe(true);
  });
});
