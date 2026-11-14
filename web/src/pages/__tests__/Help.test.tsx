import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Help from "@/pages/Help";
import SiteFooter from "@/components/SiteFooter";

afterEach(() => document.documentElement.removeAttribute("lang"));

const show = (lang: "en" | "he", at = "/help") => {
  document.documentElement.lang = lang;
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Help />
    </MemoryRouter>,
  );
};

describe("the help page", () => {
  it.each([
    ["en", "Help", /^On this page$/],
    ["he", "עזרה", /^בעמוד הזה$/],
  ] as const)("has one h1 and a contents list, in %s", (lang, h1, contents) => {
    show(lang);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(h1);
    expect(screen.getByRole("navigation", { name: contents })).toBeInTheDocument();
  });

  it.each(["en", "he"] as const)("every contents link resolves to a section heading, in order (%s)", (lang) => {
    const { container } = show(lang);
    const nav = screen.getByRole("navigation");
    const targets = [...nav.querySelectorAll("a")].map((a) => a.getAttribute("href")!.slice(1));
    expect(targets).toEqual(["language", "look", "keyboard", "sharing", "rss", "contact-form"]);
    for (const id of targets) {
      const el = container.querySelector(`[id="${id}"]`);
      expect(el, id).not.toBeNull();
      expect(el!.tagName).toBe("H2");
    }
    const headings = [...container.querySelectorAll("h1, h2, h3")].map((h) => h.tagName);
    expect(headings).not.toContain("H3");
    expect(headings[0]).toBe("H1");
    expect(new Set([...container.querySelectorAll("[id]")].map((e) => e.id)).size).toBe(container.querySelectorAll("[id]").length);
  });

  it("holds no newsletter or privacy section, and no promise about timing", () => {
    for (const lang of ["en", "he"] as const) {
      const { container, unmount } = show(lang);
      const text = container.textContent ?? "";
      expect(text).not.toMatch(/newsletter|unsubscribe|reply within|within a (day|week)|עלון|הסרה מהרשימה|אענה תוך/i);
      expect(container.querySelector('main a[href="/privacy"]')).toBeNull();
      unmount();
    }
  });

  it("describes Send in plain facts and offers the notes feed, in English", () => {
    const { container } = show("en");
    expect(container.textContent).toMatch(/Send message/);
    expect(container.querySelector('a[href="/feed.xml"]')).not.toBeNull();
    expect(container.querySelector('a[href^="mailto:"]')).not.toBeNull();
  });

  it("is written in Hebrew", () => {
    const { container } = show("he");
    expect(container.querySelector("h2")!.textContent).toMatch(/[֐-׿]/);
    expect(container.textContent).toMatch(/שליחת ההודעה/);
  });
});

describe("the footer link", () => {
  it.each([
    ["en", "help"],
    ["he", "עזרה"],
  ] as const)("points at /help (%s)", (lang, name) => {
    document.documentElement.lang = lang;
    render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name });
    expect(link.getAttribute("href")).toBe("/help");
  });
});
