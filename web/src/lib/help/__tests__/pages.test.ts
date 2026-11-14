import { describe, expect, it } from "vitest";
import { HELP_GROUPS, helpTopics } from "../topics";
import { HELP_GUIDES, helpPageIds, helpPagePath, isHelpPage, legacyHelpTarget, neighbours } from "../pages";

describe("the help pages", () => {
  it("lists the guides first, then each group's topics in the registry's order", () => {
    const ids = helpPageIds(true);
    expect(ids.slice(0, HELP_GUIDES.length)).toEqual(["language", "look", "keyboard", "sharing", "rss", "contact-form"]);
    expect(ids.slice(HELP_GUIDES.length).sort()).toEqual([...helpTopics].sort());
    expect(new Set(ids).size).toBe(ids.length);
    expect(HELP_GROUPS.length).toBe(3);
  });

  it("leaves the contact form's guide out when the form is hidden", () => {
    expect(helpPageIds(false)).not.toContain("contact-form");
    expect(helpPageIds(false)).toHaveLength(helpPageIds(true).length - 1);
    expect(isHelpPage("contact-form", false)).toBe(false);
    expect(isHelpPage("contact-form", true)).toBe(true);
    expect(isHelpPage("toString", true)).toBe(false);
  });

  it("addresses a page at /help/<id>", () => {
    expect(helpPagePath("rss")).toBe("/help/rss");
    expect(helpPagePath("contact-sent")).toBe("/help/contact-sent");
  });

  it("sends an old anchor to its page, and leaves the in-page ones alone", () => {
    expect(legacyHelpTarget("#rss", true)).toBe("/help/rss");
    expect(legacyHelpTarget("#contact-send-failed", true)).toBe("/help/contact-send-failed");
    expect(legacyHelpTarget("#contact-form", false)).toBeNull();
    expect(legacyHelpTarget("#problems", true)).toBeNull();
    expect(legacyHelpTarget("#problems-share", true)).toBeNull();
    expect(legacyHelpTarget("#nope", true)).toBeNull();
    expect(legacyHelpTarget("", true)).toBeNull();
  });

  it("names the previous and the next page, and none past either end", () => {
    const ids = helpPageIds(true);
    expect(neighbours("language", true)).toEqual({ prev: null, next: "look" });
    expect(neighbours("look", true)).toEqual({ prev: "language", next: "keyboard" });
    expect(neighbours(ids.at(-1)!, true).next).toBeNull();
    expect(neighbours("rss", false).next).toBe(helpPageIds(false)[5]);
  });
});
