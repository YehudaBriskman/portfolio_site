import { describe, expect, it } from "vitest";
import { findAll } from "./find-all";

describe("findAll", () => {
  it("follows bookmarks past the first page", async () => {
    const pages = [
      { docs: [1, 2], bookmark: "b1" },
      { docs: [3, 4], bookmark: "b2" },
      { docs: [5], bookmark: "b3" },
    ];
    const seen: (string | undefined)[] = [];
    const out = await findAll<number>(async (b) => {
      seen.push(b);
      return pages[seen.length - 1]!;
    }, 2);
    expect(out).toEqual([1, 2, 3, 4, 5]);
    expect(seen).toEqual([undefined, "b1", "b2"]);
  });

  it("stops when the bookmark does not advance", async () => {
    const out = await findAll<number>(async () => ({ docs: [1, 2], bookmark: "same" }), 2);
    expect(out).toEqual([1, 2, 1, 2]);
  });
});
