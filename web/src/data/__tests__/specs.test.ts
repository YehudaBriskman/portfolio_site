import { describe, expect, it } from "vitest";
import { specFigures } from "@/data/specs";
import { isLive, projects } from "@/data/projects";

/*
 * The plate's figures are truth claims, so these are the checks that they are
 * still derived from something rather than remembered.
 *
 * Every assertion below re-derives its number a second way — by counting the
 * seed table in the test rather than by restating the answer — because a test
 * that hard-codes `expect(figure.value).toBe(6)` passes just as happily when
 * the derivation has been replaced by a literal, which is the one failure
 * this file exists to catch.
 */
describe("the spec plate's figures", () => {
  const byCaption = new Map(specFigures.map((f) => [f.caption, f]));

  it("counts the objects in the collection", () => {
    expect(byCaption.get("Projects")?.value).toBe(projects.length);
  });

  it("counts only the projects with a public link as live", () => {
    const live = projects.filter((p) => p.link && p.state !== "Archive").length;
    expect(byCaption.get("Live")?.value).toBe(live);
    /* The claim is "fewer than all of them", and it has to stay checkable:
       if every project ever has a link, the figure stops saying anything and
       should be cut rather than printed as a second project count. */
    expect(live).toBeLessThan(projects.length);
  });

  it("does not count a learning project as live, though its page still loads", () => {
    /* Programming with Yehuda and Icaros keep their links and are archived
       (2026-11-03). Counting a link alone put "5 live" on the hero. */
    const learning = projects.filter((p) => p.status === "Learning project");
    expect(learning.map((p) => p.slug).sort()).toEqual(["icaros", "programming-with-yehuda"]);
    for (const p of learning) {
      expect(p.link).toBeTruthy();
      expect(isLive(p)).toBe(false);
    }
  });

  it("folds version numbers, so one tool is not counted twice", () => {
    const raw = new Set(projects.flatMap((p) => p.tech));
    const folded = byCaption.get("Tools")?.value ?? 0;

    expect(folded).toBeGreaterThan(0);
    /* `React 19` and `React`, `Vite 8` and `Vite` are each one tool. The
       unfolded set is the number this plate printed first and it was wrong. */
    expect(folded).toBeLessThan(raw.size);
  });

  it("spans the years in the table, inclusive of both ends", () => {
    const years = projects.map((p) => Number.parseInt(p.year, 10));
    expect(byCaption.get("Shipping")?.value).toBe(Math.max(...years) - Math.min(...years) + 1);
  });

  it("prints no figure it could not source", () => {
    /* A nought on a spec plate is a figure whose source has gone away. The
       plate drops it; it never prints it. */
    expect(specFigures.every((f) => f.value > 0)).toBe(true);
    expect(specFigures.length).toBeGreaterThanOrEqual(2);
  });
});
