import { couch } from "../db/couch.js";
import { mediaStore, usageIndex } from "./media.js";

/* A use past the first page must still stop a delete: the scan pages to the end. */

afterEach(() => vi.restoreAllMocks());

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
