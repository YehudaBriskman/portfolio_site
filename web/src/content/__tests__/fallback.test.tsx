import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildStory } from "@/data/story";
import { PROJECTS_HE, SITE_HE, STORY_HE } from "@/data/hebrew";
import { projects } from "@/data/projects";
import { ROLES, START } from "@/data/story";
import { about } from "@/data/site";
import { LRI, PDI, ltrFallback, withStop } from "@/i18n/words";
import { localize, seedBundle } from "../convert";

/*
 * English shown on a Hebrew page because the Hebrew is missing lays out left
 * to right, wherever it lands (#4 of the 2026-11-04 brief).
 *
 * On /he/story the role line "Still writing and reviewing code every day."
 * printed as ".Still writing and reviewing code every day": an English run in
 * an RTL paragraph, its full stop taken to the paragraph's end, which in
 * Hebrew is the left. `localize()` is where every missing `he` becomes its
 * `en`, so the fix is there, in the string, and holds on every surface.
 */

const strip = (b: ReturnType<typeof seedBundle>) => {
  /* The seed with every Hebrew removed: what a document saved before any
     translation looks like. */
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.en === "string") return { en: o.en };
      /* An interlude needs both languages, by schema; it keeps them. */
      return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, k === "words" ? x : walk(x)]));
    }
    return v;
  };
  return walk(b) as ReturnType<typeof seedBundle>;
};

describe("ltrFallback", () => {
  it("isolates English, and leaves Hebrew, numbers and empty text alone", () => {
    expect(ltrFallback("Still writing code.")).toBe(`${LRI}Still writing code.${PDI}`);
    expect(ltrFallback("ראש צוות טכני")).toBe("ראש צוות טכני");
    expect(ltrFallback("2026")).toBe("2026");
    expect(ltrFallback("")).toBe("");
  });

  it("does not isolate twice", () => {
    expect(ltrFallback(ltrFallback("Now"))).toBe(`${LRI}Now${PDI}`);
  });

  it("puts a full stop inside the isolate, at the English end", () => {
    expect(withStop(ltrFallback("Every new tab"))).toBe(`${LRI}Every new tab.${PDI}`);
    expect(withStop("כל לשונית")).toBe("כל לשונית.");
  });
});

describe("a missing Hebrew, on a Hebrew page", () => {
  const bare = strip(seedBundle());
  const he = localize(bare, "he");

  it("comes back as an LTR isolate on every kind of surface", () => {
    const now = he.story.hand.roles.find((r) => r.id === "now")!;
    expect(now.lines[1]).toBe(`${LRI}Still writing and reviewing code every day.${PDI}`);
    expect(he.projects[0].highlights[0].startsWith(LRI)).toBe(true);
    expect(he.projects[0].decisions![0].body.endsWith(PDI)).toBe(true);
    expect(he.site.footer.colophon.startsWith(LRI)).toBe(true);
    expect(he.site.about.intro[0].lines[0].startsWith(LRI)).toBe(true);
  });

  it("keeps the English page's text exactly as written", () => {
    const en = localize(bare, "en");
    expect(en.story.hand.roles[1].lines[1]).toBe("Still writing and reviewing code every day.");
    expect(JSON.stringify(en)).not.toMatch(/[⁦⁩]/);
  });

  it("ends a story beat's English fact with its stop inside the run", () => {
    const s = he.story;
    const story = buildStory(he.projects, s.lines, s.images, s.interludes, s.layouts, s.hand);
    const windom = story.beats.find((b) => b.id === "windom")!;
    expect(windom.lines[0]).toBe(`${LRI}Every new tab becomes a dashboard.${PDI}`);
  });

  it("renders with the full stop at the English end inside an RTL paragraph", () => {
    const line = he.story.hand.roles[1].lines[1];
    render(
      <p dir="rtl" lang="he" data-testid="line">
        {line}
      </p>,
    );
    const text = screen.getByTestId("line").textContent!;
    /* The stop is the last character of the isolated run, before its PDI. */
    expect(text.indexOf(".")).toBe(text.length - 2);
    expect(text.at(-1)).toBe(PDI);
    expect(text[0]).toBe(LRI);
  });
});

describe("the seed's Hebrew", () => {
  it("covers every project, with arrays that line up with the English", () => {
    for (const p of projects) {
      const he = PROJECTS_HE[p.slug];
      expect(he, p.slug).toBeDefined();
      expect(he.highlights.length, `${p.slug} highlights`).toBe(p.highlights.length);
      expect(he.decisions?.length ?? 0, `${p.slug} decisions`).toBe(p.decisions?.length ?? 0);
      expect(Boolean(he.problem), `${p.slug} problem`).toBe(Boolean(p.problem));
      expect(Boolean(he.role), `${p.slug} role`).toBe(Boolean(p.role));
      expect(Boolean(he.outcome), `${p.slug} outcome`).toBe(Boolean(p.outcome));
    }
    expect(Object.keys(PROJECTS_HE).sort()).toEqual(projects.map((p) => p.slug).sort());
  });

  it("covers the story's hand-written beats and How I work, line for line", () => {
    expect(STORY_HE.start.lines.length).toBe(START.lines.length);
    for (const r of ROLES) expect(STORY_HE.roles[r.id]?.lines.length, r.id).toBe(r.lines.length);
    about.intro.forEach((s, i) => expect(SITE_HE.intro[i].lines.length).toBe(s.lines.length));
    about.principles.forEach((p, i) => expect(SITE_HE.principles[i].lines.length).toBe(p.lines.length));
  });

  it("leaves nothing in projects or the story to fall back, and names no employer", () => {
    const b = seedBundle();
    const missing: string[] = [];
    const walk = (v: unknown, path: string) => {
      if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}.${i}`));
      if (!v || typeof v !== "object") return;
      const o = v as Record<string, unknown>;
      if (typeof o.en === "string") return void (o.he ? null : missing.push(path));
      for (const [k, x] of Object.entries(o)) if (k !== "links") walk(x, `${path}.${k}`);
    };
    walk(b.projects, "projects");
    walk({ start: b.story.start, roles: b.story.roles }, "story");
    expect(missing).toEqual([]);
    expect(JSON.stringify(b)).not.toMatch(/IDF|צה"ל|צה״ל|army|military|צבא/i);
  });
});
