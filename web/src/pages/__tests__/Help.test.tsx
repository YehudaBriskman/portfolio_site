import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Help from "@/pages/Help";
import HelpTopic from "@/pages/HelpTopic";
import SiteFooter from "@/components/SiteFooter";
import { DEFAULT_SETTINGS } from "@/settings/schema";
import { resetSettings, setSettings } from "@/settings/store";
import { useHelpWords } from "@/i18n/help";
import { helpPageIds } from "@/lib/help/pages";
import { helpTopics } from "@/lib/help/topics";

beforeEach(() => resetSettings());
afterEach(() => document.documentElement.removeAttribute("lang"));

const hideContact = () =>
  setSettings({ ...DEFAULT_SETTINGS, home: { sections: DEFAULT_SETTINGS.home.sections.map((s) => (s.id === "contact" ? { ...s, visible: false } : s)) } });

const show = (lang: "en" | "he", at = "/help") => {
  document.documentElement.lang = lang;
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/help" element={<Help />} />
        <Route path="/help/:topic" element={<HelpTopic />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("the help index", () => {
  it.each([
    ["en", "Help", /^On this page$/],
    ["he", "עזרה", /^בעמוד הזה$/],
  ] as const)("has one h1 and a contents list, in %s", (lang, h1, contents) => {
    show(lang);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(h1);
    expect(screen.getByRole("navigation", { name: contents })).toBeInTheDocument();
  });

  it.each(["en", "he"] as const)("has one row per page, each a link to /help/<id>, in order (%s)", (lang) => {
    const { container } = show(lang);
    const hrefs = [...container.querySelectorAll("a[data-phone-row]")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(helpPageIds(true).map((id) => `/help/${id}`));
    /* The page itself no longer holds the topics' text. */
    expect(container.querySelectorAll("article")).toHaveLength(0);
    expect(container.querySelector('a[href="/feed.xml"]')).toBeNull();
    const w = useHelpWords.of(lang);
    expect(container.textContent).toContain(w.groupTitles.newsletter);
    expect(container.textContent).toContain(w.topics[helpTopics[0]].title);
  });

  it("keeps heading levels without a gap and ids unique", () => {
    const { container } = show("en");
    const levels = [...container.querySelectorAll("h1, h2, h3, h4")].map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(1);
    levels.forEach((l, i) => i > 0 && expect(l - levels[i - 1], `heading ${i}`).toBeLessThanOrEqual(1));
    expect(new Set([...container.querySelectorAll("[id]")].map((e) => e.id)).size).toBe(container.querySelectorAll("[id]").length);
  });

  it("leaves the contact form's row out when the form is hidden", () => {
    hideContact();
    const { container } = show("en");
    const hrefs = [...container.querySelectorAll("a[data-phone-row]")].map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("/help/contact-form");
    expect(hrefs).toContain("/help/contact-sent");
  });

  it("promises no reply time", () => {
    for (const lang of ["en", "he"] as const) {
      const { container, unmount } = show(lang);
      expect(container.textContent ?? "").not.toMatch(/reply within|answer within|within a (day|week)|אענה תוך|תוך (יום|שבוע)/i);
      unmount();
    }
  });
});

describe("an old anchor", () => {
  it.each([
    ["#rss", "RSS"],
    ["#contact-send-failed", "Nothing was sent: something went wrong"],
    ["#language", "Language"],
  ])("%s opens its own page", (hash, title) => {
    show("en", `/help${hash}`);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(title);
  });

  it("#problems stays on the index, where the heading is", () => {
    const { container } = show("en", "/help#problems");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Help");
    expect(container.querySelector('[id="problems"]')).not.toBeNull();
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
    expect(screen.getByRole("link", { name }).getAttribute("href")).toBe("/help");
  });
});
