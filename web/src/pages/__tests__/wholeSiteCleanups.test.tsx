import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import NotFound from "@/pages/NotFound";
import HelpTopic from "@/pages/HelpTopic";
import DevelopersMcp from "@/pages/DevelopersMcp";
import Plate from "@/components/projects/Plate";
import ObjectLabel from "@/components/gallery/ObjectLabel";
import { relative } from "@/components/dashboard/i18n";
import { resetSettings } from "@/settings/store";

/*
 * The "Phone/Hebrew cleanups from the whole-site pass" (audit vf1). Each block
 * is one defect the verification pass measured; the bidi and i18n ones are
 * right at every width, the layout ones are phone only and are read from the
 * stylesheets, because jsdom has no layout.
 */
beforeEach(() => resetSettings());
afterEach(() => document.documentElement.removeAttribute("lang"));

const css = (f: string) => readFileSync(resolve(process.cwd(), "src", f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const he = () => {
  document.documentElement.lang = "he";
};

describe("relative dates in Hebrew (3)", () => {
  const now = Date.parse("2026-11-15T12:00:00Z");
  it("does not double the count of a dual form", () => {
    expect(relative("2026-09-15T12:00:00Z", now, "he")).toBe("לפני חודשיים");
    expect(relative("2026-11-01T12:00:00Z", now, "he")).toBe("לפני שבועיים");
    expect(relative("2026-11-12T12:00:00Z", now, "he")).toBe("לפני 3 ימים");
    expect(relative("2026-11-18T12:00:00Z", now, "he")).not.toMatch(/\(/);
  });
  it("leaves English alone", () => {
    expect(relative("2026-09-15T12:00:00Z", now, "en")).toBe("2 months ago");
  });
});

describe("the 404 page (2, 5)", () => {
  const show = () =>
    render(
      <MemoryRouter initialEntries={["/no-such-page"]}>
        <NotFound />
      </MemoryRouter>,
    );
  it("keeps the quoted path left to right", () => {
    he();
    show();
    expect(screen.getByText("/no-such-page").closest("[dir]")?.getAttribute("dir")).toBe("ltr");
  });
  it("names the third button as the menu does", () => {
    he();
    const { container } = show();
    expect(container.querySelector('[data-ph="onward-list"] a[href="/blog"]')?.textContent).toBe("בלוג");
    expect(screen.queryByText("רשימות")).toBeNull();
  });
  it("opens on the title row like the other text pages", () => {
    he();
    const { container } = show();
    expect(container.querySelector("section.page-first h1")).not.toBeNull();
  });
});

describe("a Hebrew page with an English or Latin string at its end (1)", () => {
  it("keeps the full stop after the e-mail address inside the left-to-right run", () => {
    he();
    const { container } = render(
      <MemoryRouter initialEntries={["/help/contact-form"]}>
        <Routes>
          <Route path="/help/:topic" element={<HelpTopic />} />
        </Routes>
      </MemoryRouter>,
    );
    const mail = container.querySelector('a[href^="mailto:"]') as HTMLElement;
    const run = mail.closest('[dir="ltr"]') as HTMLElement;
    expect(run).not.toBeNull();
    expect(run.textContent).toBe(`${mail.textContent}.`);
  });
  it("sets an English name and line as left-to-right runs", () => {
    he();
    const { container } = render(<ObjectLabel name="Merging does not ship. A tag does." fact="The box's portal." fields={[]} nameAs="h3" />);
    expect(container.querySelector("h3")?.getAttribute("dir")).toBe("ltr");
    expect(screen.getByText("The box's portal.").getAttribute("dir")).toBe("ltr");
  });
  it("sets the plate's caption as a left-to-right run", () => {
    he();
    render(<Plate tagline="The box's portal." tech={["React"]} />);
    expect(screen.getByText("The box's portal.").getAttribute("dir")).toBe("ltr");
  });
  it("sets a blog excerpt in its own direction at every width", () => {
    expect(css("pages/Blog.tsx")).toMatch(/postExcerpt\} dir="auto" \{\.\.\.inEnglish\(lang, p\.excerpt\)\}/);
  });
});

describe("the stack label (4)", () => {
  it("is the existing Hebrew word on the plate", () => {
    he();
    render(<Plate tech={["React", "Docker"]} />);
    expect(screen.getByText("טכנולוגיות")).toBeInTheDocument();
    expect(screen.queryByText("stack")).toBeNull();
  });
  it("stays English in English", () => {
    render(<Plate tech={["React"]} />);
    expect(screen.getByText("Stack")).toBeInTheDocument();
  });
});

describe("the MCP command boxes (7)", () => {
  it("can be scrolled by keyboard", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Not Found", { status: 404 })));
    const { container } = render(
      <MemoryRouter>
        <DevelopersMcp />
      </MemoryRouter>,
    );
    const boxes = container.querySelectorAll('[data-ph="copy-box"] > code');
    expect(boxes.length).toBeGreaterThan(0);
    boxes.forEach((b) => expect(b.getAttribute("tabindex")).toBe("0"));
    vi.unstubAllGlobals();
  });
  it("shows an edge cue on a phone", () => {
    const info = css("components/phone/pages-info.css");
    expect(info).toMatch(/\[data-ph="copy-box"\] > code \{[^}]*linear-gradient/);
  });
});

describe("phone layout reads from the stylesheets (5, 6)", () => {
  it("draws the active-filter bar under the title, so the title is first", () => {
    expect(css("components/dashboard/Dashboard.module.css")).toMatch(/\.sheetBar ~ \.hello \{\s*order: -1/);
  });
  it("opens the subscribe pages like a text page", () => {
    expect(css("components/SubscribeFrame.tsx")).toContain("page-first");
  });
  it("brings the Story's first curve nearer to Share on a phone", () => {
    const story = css("components/story/Story.module.css");
    const phone = story.slice(story.indexOf("@media (max-width: 639px)"));
    expect(phone).toMatch(/\.seed \{\s*height: 6rem/);
    expect(phone).toMatch(/\.open \{\s*padding-block-end: 1\.5rem/);
  });
});
