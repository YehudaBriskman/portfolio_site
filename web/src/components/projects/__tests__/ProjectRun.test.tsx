import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProjectRun from "@/components/projects/ProjectRun";
import type { ProjectEntry } from "@/hooks/useProjects";
import type { Collection } from "@/services/blog";

/*
 * jsdom has no layout and no scroll-driven animation, so the run itself — the
 * pin, the curve, the reverse — is verified in a browser
 * (`scripts/shoot-work-run.mjs`). What can break silently here is the markup
 * contract the fallback rests on, and the off-switches, which are asserted
 * against the stylesheet text for the reason ProjectPile.test.tsx gives.
 */

const CSS = readFileSync(
  resolve(process.cwd(), "src/components/projects/ProjectRun.module.css"),
  "utf8"
).replace(/\/\*[\s\S]*?\*\//g, "");

const collection = (over: Partial<Collection> = {}): Collection => ({
  slug: "windom",
  title: "WindoM",
  tagline: "Every new tab becomes a dashboard",
  description: "A Chrome extension.",
  coverImage: null,
  links: [],
  order: 10,
  kind: "project",
  repoUrl: null,
  stats: null,
  ...over,
});

const entry = (over: Partial<ProjectEntry> = {}, c: Partial<Collection> = {}): ProjectEntry => ({
  collection: collection(c),
  live: false,
  state: "In use",
  status: "Live",
  year: "2026",
  tech: ["React 19", "TypeScript"],
  highlights: [],
  fields: [{ kind: "state", value: "In use" }],
  tint: [24, 142, 167],
  problem: null,
  role: null,
  outcome: null,
  decisions: [],
  primaryLink: null,
  otherLinks: [],
  ...over,
});

const three = [
  entry(),
  entry({ state: "Open source", tint: null }, { slug: "bothy", title: "Bothy" }),
  entry({ state: "Live", year: "2024" }, { slug: "icaros", title: "Icaros" }),
];

function draw(entries: ProjectEntry[]) {
  return render(
    <MemoryRouter>
      <ProjectRun entries={entries} label="Selected work" heading="h3" />
    </MemoryRouter>
  );
}

describe("ProjectRun", () => {
  it("is an ordered list of every project, one link per card", () => {
    draw(three);
    const list = screen.getByRole("list", { name: "Selected work" });
    expect(list.tagName).toBe("OL");
    expect(list.querySelectorAll(":scope > li")).toHaveLength(3);
    expect(
      screen
        .getAllByRole("link")
        .map((l) => l.getAttribute("href"))
        .filter((h) => h?.startsWith("/projects/"))
    ).toEqual(["/projects/windom", "/projects/bothy", "/projects/icaros"]);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("offers a way past the run", () => {
    draw(three);
    const skip = screen.getByRole("link", { name: "Skip past the work" });
    const target = document.getElementById(skip.getAttribute("href")!.slice(1));
    expect(target).not.toBeNull();
    expect(target?.getAttribute("tabindex")).toBe("-1");
  });

  it("places one hidden moment per card, outside the list, under the anchor ids", () => {
    const { container } = draw(three);
    const marks = container.querySelectorAll("[data-run-mark]");
    expect(Array.from(marks).map((m) => m.id)).toEqual([
      "object-windom",
      "object-bothy",
      "object-icaros",
    ]);
    marks.forEach((m) => {
      expect(m.getAttribute("aria-hidden")).toBe("true");
      expect(m.closest("ol")).toBeNull();
    });
  });

  it("writes the count, the index and each card's own arrival", () => {
    const { container } = draw(three);
    expect(container.querySelector("[data-run-stage]")?.getAttribute("style")).toContain(
      "--run-n: 3"
    );
    const slots = Array.from(container.querySelectorAll("ol > li"));
    expect(slots[1].getAttribute("style")).toContain("--run-i: 1");
    /* Open source swings open from the left edge: origin 0% 50%. */
    expect(slots[1].getAttribute("style")).toContain("--arrive-ox: -50%");
    expect(slots[1].getAttribute("style")).toContain("--arrive-oy: 0%");
    expect(slots[0].getAttribute("style")).toContain("--run-tint: 24 142 167");
    expect(slots[1].getAttribute("style")).not.toContain("--run-tint");
  });

  it("draws nothing for no projects", () => {
    const { container } = draw([]);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ProjectRun.module.css", () => {
  it("drives the run by scroll alone, from the static stage's named timeline", () => {
    expect(CSS).toMatch(/\.stage\s*\{[^}]*view-timeline-name:\s*--run/);
    expect(CSS.match(/animation-timeline:\s*--run/g)).toHaveLength(2);
    expect(CSS).not.toMatch(/animation-timeline:\s*view\(\)\s*;/);
    expect(CSS).not.toMatch(/animation-(duration|delay)/);
    expect(CSS).not.toMatch(/scroll-snap/);
  });

  it.each([
    ["no support", /@supports not \(animation-timeline: view\(\)\)\s*\{([\s\S]*?)\n\}/],
    ["reduced motion", /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/],
  ])("lands %s on the plain list", (_, block) => {
    const body = CSS.match(block)?.[1] ?? "";
    expect(body).toMatch(/\.slot\s*\{[^}]*animation-name:\s*none/);
    expect(body).toMatch(/\.card\s*\{[^}]*animation-name:\s*none/);
    expect(body).toMatch(/\.frame\s*\{[^}]*position:\s*static/);
    expect(body).toMatch(/\.run\s*\{[^}]*container-type:\s*normal/);
    expect(body).toMatch(/\.stage\s*\{[^}]*height:\s*auto/);
  });

  it("lands Pause on the same plain list", () => {
    expect(CSS).toMatch(/body\.motion-paused\) \.slot\s*\{[^}]*animation-name:\s*none/);
    expect(CSS).toMatch(/body\.motion-paused\) \.card\s*\{[^}]*animation-name:\s*none/);
    expect(CSS).toMatch(/body\.motion-paused\) \.frame\s*\{[^}]*position:\s*static/);
    expect(CSS).toMatch(/body\.motion-paused\) \.run\s*\{[^}]*container-type:\s*normal/);
    expect(CSS).toMatch(/body\.motion-paused\) \.stage\s*\{[^}]*height:\s*auto/);
  });
});
