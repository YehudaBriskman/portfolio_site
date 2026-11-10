import { afterEach, describe, expect, it } from "vitest";
import { switchLang, takeLangScroll } from "@/i18n/routing";

/*
 * A language switch hands the reader's scroll position to the remounted
 * router, once, so it stays where it was instead of restoring an old position
 * for the other language's path or jumping to the top.
 */
afterEach(() => {
  takeLangScroll();
  window.history.replaceState(null, "", "/");
});

describe("switchLang's scroll hand-over", () => {
  it("records where the reader was, and gives it up once", () => {
    Object.defineProperty(window, "scrollY", { value: 2400, configurable: true });
    window.history.replaceState(null, "", "/");
    switchLang("he");
    expect(window.location.pathname).toBe("/he");
    expect(takeLangScroll()).toBe(2400);
    expect(takeLangScroll()).toBeNull();
  });

  it("records nothing when the language is already the one asked for", () => {
    Object.defineProperty(window, "scrollY", { value: 500, configurable: true });
    window.history.replaceState(null, "", "/he");
    switchLang("he");
    expect(takeLangScroll()).toBeNull();
  });
});
