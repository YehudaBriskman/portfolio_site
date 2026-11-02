import { describe, expect, it } from "vitest";
import { band, readoutText } from "@/components/city/useCityHand";

/*
 * The hand itself — the gesture split, the coast and the settle — is pointer
 * geometry through a 3D transform, and jsdom has neither, so it is verified in
 * a real browser (see the pull request for #111). What can be held here are
 * the two pure pieces a later edit is most likely to break without anything
 * on screen saying so: what the readout says, and how far the city may turn.
 */

describe("the readout", () => {
  it("prints a calendar date, not the reader's local day before it", () => {
    /* A Monday in UTC. Parsed as local time west of Greenwich it would be
       Sunday — the bug `cityPlan.ts` documents for the caption. */
    expect(readoutText("2026-08-17", 172)).toBe("Mon, 17 Aug 2026 · 172 contributions");
  });

  it("says one contribution in the singular", () => {
    expect(readoutText("2026-08-18", 1)).toMatch(/· 1 contribution$/);
  });

  it("says nothing rather than a nought", () => {
    /* "0 contributions" reads as a measurement of a day; "nothing" is what
       an empty cell in this chart means. */
    expect(readoutText("2026-03-07", 0)).toBe("Sat, 7 Mar 2026 · nothing");
  });

  it("groups thousands", () => {
    expect(readoutText("2026-08-17", 1234)).toMatch(/1,234 contributions$/);
  });
});

describe("the rubber band", () => {
  it("is the identity inside the free range", () => {
    for (const raw of [-30, -12.5, 0, 7, 30]) expect(band(raw)).toBe(raw);
  });

  it("is symmetric", () => {
    for (const raw of [35, 60, 400]) expect(band(-raw)).toBeCloseTo(-band(raw));
  });

  it("gives ground beyond the free range but never reaches the hard stop", () => {
    expect(band(40)).toBeGreaterThan(30);
    expect(band(40)).toBeLessThan(40);
    expect(band(80)).toBeGreaterThan(band(40));
    /* However hard the throw, the city never turns past 48 degrees: far
       enough to see a street from the side, not so far the year reads
       backwards. */
    expect(band(1e6)).toBeLessThanOrEqual(48);
  });

  it("joins the free range without a step", () => {
    expect(band(30.0001) - band(30)).toBeLessThan(0.001);
  });
});
