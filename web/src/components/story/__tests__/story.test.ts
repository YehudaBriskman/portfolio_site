import { describe, expect, it } from "vitest";
import { buildStory, RATIO } from "@/data/story";
import { projects, type Project } from "@/data/projects";
import { plate } from "@/data/site";

/*
 * The story's timeline is derived from the project table (#46, #158), and
 * these are the ways that derivation could quietly stop being true. Each one
 * is a change a reasonable person makes to `data/projects.ts` without opening
 * the story at all — which is exactly why the story has to refuse rather than
 * adapt.
 */

const LINES = Object.fromEntries(projects.map((p) => [p.slug, "A line."]));
const extra = (slug: string, year: string): Project => ({ ...projects[0], slug, year });

describe("buildStory", () => {
  it("runs start, every project in year order, then the two roles", () => {
    const { beats } = buildStory();
    expect(beats[0]).toMatchObject({ kind: "start", when: String(plate.shippingSince) });
    expect(beats.slice(-2).map((b) => b.kind)).toEqual(["role", "role"]);
    expect(beats.at(-1)!.when).toBe("Now");

    const years = beats.filter((b) => b.kind === "project").map((b) => Number(b.when));
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it("gives every project exactly one beat, under its own year, title and fact", () => {
    const beats = buildStory().beats.filter((b) => b.kind === "project");
    expect(beats.map((b) => b.id).sort()).toEqual(projects.map((p) => p.slug).sort());
    for (const p of projects) {
      const b = beats.find((x) => x.id === p.slug)!;
      expect(b.when).toBe(p.year);
      expect(b.title).toBe(p.title);
      expect(b.lines[0]).toBe(`${p.fact}.`);
      expect(b.href).toBe(`/projects/${p.slug}`);
    }
  });

  it("keeps every beat short: a line or two", () => {
    for (const b of buildStory().beats) {
      expect(b.lines.length).toBeGreaterThanOrEqual(1);
      expect(b.lines.length).toBeLessThanOrEqual(2);
      expect(b.lines.join(" ").split(/\s+/).length).toBeLessThanOrEqual(30);
    }
  });

  it("gives every beat an image slot of a fixed shape", () => {
    for (const b of buildStory().beats) expect(b.ratio).toBe(RATIO);
  });

  it("refuses a project with no line", () => {
    expect(() => buildStory([...projects, extra("p-2027", "2027")], LINES)).toThrow(/p-2027/);
  });

  it("refuses a line for a project no longer in the table", () => {
    const table = projects.filter((p) => p.slug !== "icaros");
    expect(() => buildStory(table, LINES)).toThrow(/icaros/);
  });

  it("refuses a picture filed under a beat that does not exist", () => {
    expect(() => buildStory(projects, LINES, { "no-such-beat": { src: "/x.jpg", alt: "" } })).toThrow(/no-such-beat/);
  });

  it("puts a supplied picture on its beat, in the same slot", () => {
    const { beats } = buildStory(projects, LINES, { windom: { src: "/story/windom.jpg", alt: "A new tab" } });
    const b = beats.find((x) => x.id === "windom")!;
    expect(b.image).toEqual({ src: "/story/windom.jpg", alt: "A new tab" });
    expect(b.ratio).toBe(RATIO);
  });

  it("counts its figures from the table", () => {
    const { figures, firstYear, lastYear } = buildStory();
    const byCaption = Object.fromEntries(figures.map((f) => [f.caption, f.value]));
    expect(byCaption["Anyone can open"]).toBe(projects.filter((p) => p.link || p.github).length);
    expect(byCaption["In a store"]).toBe(1);
    expect(byCaption["Years"]).toBe(lastYear - firstYear + 1);
  });

  /*
   * The role is described, never attributed (THE EMPLOYER IS NEVER NAMED,
   * `data/site.ts`). This cannot test for a name itself — a test that spelled
   * it would publish it in the repository — so it holds the shape: no beat
   * carries an "at <Organisation>" clause, and the current role is the words
   * the owner chose.
   */
  it("names no organisation and calls the role a technical team lead", () => {
    const { beats } = buildStory();
    for (const b of beats) {
      /* A project's title is its own name, and may hold a name. */
      const own = b.kind === "project" ? b.lines : [b.title, ...b.lines];
      for (const text of own) expect(text).not.toMatch(/\b(at|for|with) (the )?[A-Z]/);
    }
    expect(beats.at(-1)!.title).toBe("Technical team lead");
  });

  /* The owner's tone rule (#158): what happened, no hedging, no gaps explained. */
  it("does not apologise, explain a gap or hedge", () => {
    const text = buildStory()
      .beats.flatMap((b) => [b.title, ...b.lines])
      .join(" ");
    expect(text).not.toMatch(/\b(before there was|not because|only the author|honest|worth a sentence|empty|just|maybe|perhaps|sort of)\b/i);
  });
});
