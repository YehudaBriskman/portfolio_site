import { describe, expect, it } from "vitest";
import { CEILING_MS, HARD_CAP_MS, decideShutter, type ShutterFacts } from "@/components/motion/shutterReadiness";

const ready: ShutterFacts = {
  elapsed: 0,
  fontsReady: true,
  imagesSettled: true,
  routeResolved: true,
  hasHeading: true,
};

describe("decideShutter", () => {
  it("fast path: everything there, tiles leave at once (no floor)", () => {
    expect(decideShutter(ready)).toBe("tiles");
  });

  it("waits for fonts and for first-screen images", () => {
    expect(decideShutter({ ...ready, fontsReady: false })).toBe("wait");
    expect(decideShutter({ ...ready, imagesSettled: false })).toBe("wait");
  });

  it("an image that errored is settled, so it cannot hold the tiles", () => {
    /* the caller reports `imagesSettled` for load and error alike */
    expect(decideShutter({ ...ready, imagesSettled: true })).toBe("tiles");
  });

  it("chunk late: waits, however long fonts and images were ready", () => {
    expect(decideShutter({ ...ready, routeResolved: false, elapsed: 3000 })).toBe("wait");
    expect(decideShutter({ ...ready, hasHeading: false, elapsed: CEILING_MS + 1 })).toBe("wait");
  });

  it("the soft ceiling gives up on fonts and images but only with content", () => {
    const slow = { ...ready, fontsReady: false, imagesSettled: false };
    expect(decideShutter({ ...slow, elapsed: CEILING_MS - 1 })).toBe("wait");
    expect(decideShutter({ ...slow, elapsed: CEILING_MS })).toBe("tiles");
    expect(decideShutter({ ...slow, routeResolved: false, elapsed: CEILING_MS })).toBe("wait");
  });

  it("content that arrives late (after the ceiling, before the cap) still gets the tiles", () => {
    expect(decideShutter({ ...ready, elapsed: HARD_CAP_MS - 1 })).toBe("tiles");
  });

  it("content never arrives: hard cap fades the sheet, no tiles", () => {
    const none = { ...ready, routeResolved: false, hasHeading: false };
    expect(decideShutter({ ...none, elapsed: HARD_CAP_MS - 1 })).toBe("wait");
    expect(decideShutter({ ...none, elapsed: HARD_CAP_MS })).toBe("fade");
  });

  it("reduced motion or Pause: no shutter at all", () => {
    expect(decideShutter({ ...ready, motionOff: true })).toBe("none");
    expect(decideShutter({ ...ready, motionOff: true, elapsed: HARD_CAP_MS, routeResolved: false })).toBe("none");
  });
});
