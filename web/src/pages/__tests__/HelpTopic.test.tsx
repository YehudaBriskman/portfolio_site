import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import HelpTopic from "@/pages/HelpTopic";
import { DEFAULT_SETTINGS } from "@/settings/schema";
import { resetSettings, setSettings } from "@/settings/store";
import { useHelpWords } from "@/i18n/help";
import { useNotFoundWords } from "@/i18n/chrome";
import { helpPageIds } from "@/lib/help/pages";
import { HELP_TOPICS, helpTopics } from "@/lib/help/topics";

beforeEach(() => resetSettings());
afterEach(() => document.documentElement.removeAttribute("lang"));

const show = (lang: "en" | "he", id: string) => {
  document.documentElement.lang = lang;
  return render(
    <MemoryRouter initialEntries={[`/help/${id}`]}>
      <Routes>
        <Route path="/help/:topic" element={<HelpTopic />} />
      </Routes>
    </MemoryRouter>,
  );
};

const titleOf = (lang: "en" | "he", id: string) => {
  const w = useHelpWords.of(lang);
  const guides: Record<string, string> = { language: w.language, look: w.look, keyboard: w.keyboard, sharing: w.sharing, rss: w.rss, "contact-form": w.contact };
  return guides[id] ?? w.topics[id as keyof typeof w.topics].title;
};

describe("a help topic page", () => {
  it.each(["en", "he"] as const)("every page has one h1 that is its title, a way up, and its neighbours (%s)", (lang) => {
    const ids = helpPageIds(true);
    for (const id of ids) {
      const { container, unmount } = show(lang, id);
      expect(screen.getAllByRole("heading", { level: 1 }), id).toHaveLength(1);
      expect(screen.getByRole("heading", { level: 1 }).textContent, id).toBe(titleOf(lang, id));
      /* The plain breadcrumb: a link to the index. */
      expect(container.querySelector('nav a[href="/help"]'), id).not.toBeNull();
      const at = ids.indexOf(id);
      const prev = container.querySelector('a[rel="prev"]');
      const next = container.querySelector('a[rel="next"]');
      expect(prev?.getAttribute("href") ?? null, id).toBe(at > 0 ? `/help/${ids[at - 1]}` : null);
      expect(next?.getAttribute("href") ?? null, id).toBe(at < ids.length - 1 ? `/help/${ids[at + 1]}` : null);
      /* No heading level is skipped, and every id is unique. */
      const levels = [...container.querySelectorAll("h1, h2, h3, h4")].map((h) => Number(h.tagName[1]));
      levels.forEach((l, i) => i > 0 && expect(l - levels[i - 1], `${id} heading ${i}`).toBeLessThanOrEqual(1));
      unmount();
    }
  });

  it.each(["en", "he"] as const)("an outcome page says what is seen, why and what to do; only a problem says where to write (%s)", (lang) => {
    const w = useHelpWords.of(lang);
    for (const t of helpTopics) {
      const { container, unmount } = show(lang, t);
      for (const s of [w.topics[t].see, w.topics[t].why, w.topics[t].todo]) expect(container.textContent, t).toContain(s);
      expect(container.querySelector('[data-ph-prose] a[href^="mailto:"]') !== null, t).toBe(HELP_TOPICS[t].kind === "problem");
      unmount();
    }
  });

  it("the guides keep their links", () => {
    expect(show("en", "rss").container.querySelector('a[href="/feed.xml"]')).not.toBeNull();
    expect(show("en", "look").container.querySelector('a[href="/accessibility"]')).not.toBeNull();
    expect(show("en", "contact-form").container.querySelector('[data-ph-prose] a[href^="mailto:"]')).not.toBeNull();
    expect(show("en", "unsubscribe-done").container.querySelector('a[href="/privacy"]')).not.toBeNull();
  });

  it("an unknown topic is the existing 404", () => {
    show("en", "no-such-topic");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(useNotFoundWords.of("en").title);
  });

  it("the contact form's page is the 404 when the form is hidden", () => {
    setSettings({ ...DEFAULT_SETTINGS, home: { sections: DEFAULT_SETTINGS.home.sections.map((s) => (s.id === "contact" ? { ...s, visible: false } : s)) } });
    show("en", "contact-form");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(useNotFoundWords.of("en").title);
  });
});
