import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ReadingBar from "@/components/notes/ReadingBar";
import { TUCK_AFTER, TUCK_DELTA, nextTucked } from "@/components/notes/readerBar";
import { READING_DEFAULT } from "@/components/notes/reader/readingPrefs";

/*
 * Direction A's reader bar (docs/public-mobile-guide.md, section 6): the
 * tuck rule is a pure function; the bar has exactly the three controls the
 * reader already had (Contents, Text size, Share) and the text-size control
 * writes the same reading preferences the sheet does. Layout is measured in a
 * browser by `npm run a11y:public-blog`.
 */

describe("nextTucked", () => {
  it("always shows the bar near the top", () => {
    expect(nextTucked(true, TUCK_AFTER, 900)).toBe(false);
    expect(nextTucked(true, 0, 50)).toBe(false);
  });
  it("tucks on the way down and returns on the way up", () => {
    expect(nextTucked(false, 500, 400)).toBe(true);
    expect(nextTucked(true, 380, 500)).toBe(false);
  });
  it("ignores a wobble smaller than a direction", () => {
    expect(nextTucked(true, 500 - (TUCK_DELTA - 1), 500)).toBe(true);
    expect(nextTucked(false, 500 + (TUCK_DELTA - 1), 500)).toBe(false);
  });
});

describe("ReadingBar on a phone", () => {
  const entity = { slug: "a-note", title: "A note", summary: "s", tags: [] };
  const target = { current: document.createElement("div") };

  it("has Contents and Text size (and Share when sharing is on), and Text size steps the scale", () => {
    const onContents = vi.fn();
    const setPrefs = vi.fn();
    render(
      <MemoryRouter>
        <ReadingBar entity={entity} target={target} onContents={onContents} prefs={READING_DEFAULT} setPrefs={setPrefs} />
      </MemoryRouter>,
    );
    const bar = document.querySelector('[data-phone="reader-bar"]') as HTMLElement;
    expect(bar).toBeTruthy();
    /* Share is drawn by ShareMenu, which stays out when the site setting turns sharing off (as in this test). */
    expect(bar.querySelectorAll("button").length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByRole("button", { name: "Contents" }));
    expect(onContents).toHaveBeenCalledOnce();

    const size = screen.getByRole("button", { name: "Text size" });
    expect(size.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(size);
    expect(size.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Larger text" }));
    expect(setPrefs).toHaveBeenCalledWith({ scale: 1.125 });
  });

  it("flags the document so the footer takes the bar's room, and clears it", () => {
    const { unmount } = render(
      <MemoryRouter>
        <ReadingBar entity={entity} target={target} />
      </MemoryRouter>,
    );
    expect(document.documentElement.hasAttribute("data-has-reader-bar")).toBe(true);
    unmount();
    expect(document.documentElement.hasAttribute("data-has-reader-bar")).toBe(false);
  });
});

describe("the reader's phone CSS", () => {
  const css = readFileSync(resolve(process.cwd(), "src/components/notes/reader/Reader.module.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const phone = css.slice(css.indexOf(".bar {"));

  it("keeps the bar hidden above 640 and opaque (no blur) below it", () => {
    expect(phone).toMatch(/\.bar \{\s*display: none;\s*\}/);
    expect(phone).not.toMatch(/backdrop-filter|blur\(/);
    expect(phone).not.toMatch(/:hover/);
  });
});
