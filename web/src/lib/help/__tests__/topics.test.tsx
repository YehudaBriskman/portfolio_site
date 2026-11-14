import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Help from "@/pages/Help";
import { useHelpWords } from "@/i18n/help";
import { useContactWords } from "@/i18n/pages";
import { useSubscribeWords } from "@/i18n/subscribe";
import { useShareWords } from "@/i18n/share";
import { HELP_GROUPS, HELP_TOPICS, helpHref, helpTopics, isHelpTopic, type HelpTopic } from "../topics";

afterEach(() => document.documentElement.removeAttribute("lang"));

const SECTION_IDS = ["language", "look", "keyboard", "sharing", "rss", "contact-form", "problems"];

describe("the help topic registry", () => {
  it("builds the address of a topic in each language", () => {
    expect(helpHref("contact-send-failed", "en")).toBe("/help#contact-send-failed");
    expect(helpHref("contact-send-failed", "he")).toBe("/he/help#contact-send-failed");
  });

  it("recognises its own ids and nothing else", () => {
    expect(isHelpTopic("confirm-done")).toBe(true);
    expect(isHelpTopic("toString")).toBe(false);
    expect(isHelpTopic("not-a-topic")).toBe(false);
  });

  it("holds kebab-case ids that are unique and never collide with a section or group id", () => {
    const reserved = new Set([...SECTION_IDS, ...HELP_GROUPS.map((g) => `problems-${g}`)]);
    expect(new Set(helpTopics).size).toBe(helpTopics.length);
    for (const t of helpTopics) {
      expect(t, t).toMatch(/^[a-z]+(-[a-z]+)+$/);
      expect(reserved.has(t), t).toBe(false);
    }
  });

  it.each(["en", "he"] as const)("has a complete entry for every topic, and only those, in %s", (lang) => {
    const topics = useHelpWords.of(lang).topics;
    expect(Object.keys(topics).sort()).toEqual([...helpTopics].sort());
    for (const t of helpTopics) {
      for (const k of ["title", "see", "why", "todo"] as const) expect(topics[t][k].trim(), `${t}.${k}`).not.toBe("");
    }
  });

  it.each(["en", "he"] as const)("the page renders one anchored entry per topic, in %s", (lang) => {
    document.documentElement.lang = lang;
    const { container } = render(
      <MemoryRouter initialEntries={["/help"]}>
        <Help />
      </MemoryRouter>,
    );
    for (const t of helpTopics) {
      const el = container.querySelector(`h4[id="${t}"]`);
      expect(el, t).not.toBeNull();
      expect(el!.textContent).toBe(useHelpWords.of(lang).topics[t].title);
    }
    /* Only a problem says where to write. */
    for (const t of helpTopics) {
      const entry = container.querySelector(`article[aria-labelledby="${t}"]`)!;
      expect(entry.querySelector('a[href^="mailto:"]') !== null, t).toBe(HELP_TOPICS[t].kind === "problem");
    }
  });
});

/*
 * What an entry says is on screen must be what the screen says. Each quoted
 * message is checked against the table the component reads, so a reworded
 * message fails here until the entry is updated.
 */
describe("the entries quote the messages the site shows", () => {
  const quotes = (lang: "en" | "he"): [HelpTopic, string][] => {
    const c = useContactWords.of(lang);
    const s = useSubscribeWords.of(lang);
    const sh = useShareWords.of(lang);
    const first = (text: string) => text.split(/(?<=[.。])\s/)[0];
    return [
      ["contact-sent", c.sent],
      ["contact-fields-invalid", c.invalid.split(/(?<=\.)\s/)[0]],
      ["contact-send-failed", c.failed.server.title],
      ["contact-send-failed", c.failed.server.short],
      ["contact-too-many", c.failed.rate.title],
      ["contact-too-many", c.failed.rate.short],
      ["contact-too-long", c.failed.large.title],
      ["contact-too-long", c.failed.large.short],
      ["contact-offline", c.failed.offline.title],
      ["contact-offline", c.failed.offline.short],
      ["manage-choose-topic", s.errTopics],
      ["newsletter-check-email", s.sent],
      ["newsletter-fields-invalid", s.errTopics],
      ["newsletter-fields-invalid", s.errEmail],
      ["newsletter-too-many", s.errRate],
      ["newsletter-try-again", s.errNetwork],
      ["newsletter-try-again", s.errServer],
      ["newsletter-try-again", s.errReach],
      ["confirm-done", s.confirmDone],
      ["confirm-expired", s.confirmBad],
      ["unsubscribe-done", first(s.unsubDone)],
      ["manage-saved", s.saved.replace(/\.$/, "")],
      ["manage-link-problem", s.manageBad],
      ["manage-save-failed", s.manageSaveBad],
      ["share-link-copied", sh.linkCopied],
      ["share-copy-failed", sh.copyFailed],
      ["share-save-failed", sh.saveFailed],
    ];
  };

  it.each(["en", "he"] as const)("%s", (lang) => {
    const topics = useHelpWords.of(lang).topics;
    for (const [topic, text] of quotes(lang)) expect(topics[topic].see, `${topic}: ${text}`).toContain(text);
  });
});

describe("the contact form's failure notices", () => {
  it("each kind links to a topic that exists on the page", async () => {
    const { HELP_TOPICS: toastTopics } = await import("@/lib/toast/helpTopics");
    const src = readFileSync(resolve(__dirname, "../../../components/Contact.tsx"), "utf8");
    const mapped = [...src.matchAll(/^\s+(rate|large|server|offline): "([a-z-]+)",$/gm)].map((m) => m[2]);
    expect(mapped.length).toBe(4);
    for (const t of mapped) {
      expect(isHelpTopic(t), t).toBe(true);
      expect(Object.keys(toastTopics), t).toContain(t);
    }
  });
});
