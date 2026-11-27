import { describe, expect, it } from "vitest";
import { MEDIA_ID, newMediaId } from "./media.js";

describe("a new media id", () => {
  it("ends in 64 random bits", () => {
    expect(newMediaId("Icaros Cover.png")).toMatch(/^icaros-cover-[0-9a-f]{16}$/);
    expect(newMediaId("")).toMatch(/^image-[0-9a-f]{16}$/);
    expect(newMediaId("a.png")).not.toBe(newMediaId("a.png"));
  });

  it("stays inside the 60 characters the admin routes accept", () => {
    const id = newMediaId(`${"long-name-".repeat(20)}.png`);
    expect(id.length).toBeLessThanOrEqual(60);
    expect(id).toMatch(MEDIA_ID);
  });
});
