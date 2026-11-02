import { describe, expect, it } from "vitest";
import { buildStory, PEAK_YEAR } from "@/data/story";
import { projects, type Project } from "@/data/projects";
import { plate } from "@/data/site";

/*
 * The story's arc is derived from the project table (#46), and these are the
 * ways that derivation could quietly stop being true. Each one is a change a
 * reasonable person makes to `data/projects.ts` without opening the story at
 * all — which is exactly why the story has to refuse rather than adapt.
 */

const at = (year: string): Project => ({ ...projects[0], slug: `p-${year}`, year });

describe("buildStory", () => {
  it("has one chapter per project year, in order, between a before and a now", () => {
    const story = buildStory();
    const years = [...new Set(projects.map((p) => p.year))].sort();

    expect(story.chapters.map((c) => c.kind)).toEqual(["before", ...years.map(() => "year"), "now"]);
    expect(story.chapters.filter((c) => c.kind === "year").map((c) => c.span)).toEqual(years);
    expect(story.chapters.map((c) => c.number)).toEqual(story.chapters.map((_, i) => i + 1));
  });

  it("files every project under its own year's chapter, and none twice", () => {
    const story = buildStory();
    const filed = story.chapters.flatMap((c) => c.projects.map((p) => `${c.span}:${p.slug}`));
    expect(filed.sort()).toEqual(projects.map((p) => `${p.year}:${p.slug}`).sort());
  });

  it("spans the before chapter from the stated first year to the table's first", () => {
    const before = buildStory().chapters[0];
    const firstTable = Math.min(...projects.map((p) => Number(p.year)));
    expect(before.span).toBe(`${plate.shippingSince}–${firstTable - 1}`);
    expect(before.projects).toEqual([]);
    expect(before.ask).toBeDefined();
  });

  it("has exactly one peak, and it is the dark year", () => {
    const peaks = buildStory().chapters.filter((c) => c.peak);
    expect(peaks).toHaveLength(1);
    expect(peaks[0].span).toBe(PEAK_YEAR);
    /* The pin splits the peak's lede into what is held and what arrives. */
    expect(peaks[0].lede?.split(/(?<=\.)\s+/)).toHaveLength(2);
  });

  it("refuses a project year that has no chapter", () => {
    expect(() => buildStory([...projects, at("2027")])).toThrow(/2027/);
  });

  it("refuses a chapter for a year with no projects left in it", () => {
    expect(() => buildStory(projects.filter((p) => p.year !== "2025"))).toThrow(/2025/);
  });

  it("counts its figures from the table", () => {
    const { figures, firstYear, lastYear } = buildStory();
    const byCaption = Object.fromEntries(figures.map((f) => [f.caption, f.value]));
    expect(byCaption["Anyone can open"]).toBe(projects.filter((p) => p.link || p.github).length);
    expect(byCaption["In a store"]).toBe(1);
    expect(byCaption["Years walked"]).toBe(lastYear - firstYear + 1);
  });

  /*
   * The role is described, never attributed (see THE EMPLOYER IS NEVER NAMED
   * in `data/site.ts`). This cannot test for the name itself — a test that
   * spelled it would publish it in the repository — so it holds the shape
   * instead: the now-chapter's description of the current role carries no
   * "at <Organisation>" clause. The previous employer is the one "at" the
   * chapter may name, and only in its "Before that" sentence.
   */
  it("describes the current role without an organisation", () => {
    const now = buildStory().chapters.at(-1)!;
    const current = now.body[0];
    expect(current).toMatch(/technical team lead/i);
    expect(current).not.toMatch(/\bat (the )?[A-Z]/);
    expect(now.body.filter((p) => /\bat [A-Z]/.test(p))).toEqual([
      expect.stringMatching(/^Before that/),
    ]);
  });
});
