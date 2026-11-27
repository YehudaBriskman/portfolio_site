import request from "supertest";
import { createApp } from "../app";
import { couch } from "../db/couch.js";

/* Requests that arrive while the published posts are being read share that one read. */

afterEach(() => vi.restoreAllMocks());

describe("crawler routes under concurrent requests", () => {
  it("read the published posts once for requests in flight together, and again afterwards", async () => {
    let reads = 0;
    const waiting: Array<() => void> = [];
    vi.spyOn(couch, "get").mockRejectedValue(new Error("no store"));
    vi.spyOn(couch, "find").mockImplementation(async (q: unknown) => {
      const selector = (q as { selector: { type?: string; status?: unknown } }).selector;
      if (selector.type === "post") {
        reads += 1;
        await new Promise<void>((ok) => waiting.push(ok));
      }
      return { docs: [] };
    });
    const app = createApp();
    const feed = () => request(app).get("/api/seo/feed.xml").then((r) => r.status);
    const both = Promise.all([feed(), feed(), feed()]);
    await vi.waitFor(() => expect(reads).toBeGreaterThan(0));
    await new Promise((ok) => setTimeout(ok, 200));
    expect(reads).toBe(1);
    waiting.splice(0).forEach((ok) => ok());
    expect(await both).toEqual([200, 200, 200]);

    const later = feed();
    await vi.waitFor(() => expect(reads).toBe(2));
    waiting.splice(0).forEach((ok) => ok());
    expect(await later).toBe(200);
  });
});
