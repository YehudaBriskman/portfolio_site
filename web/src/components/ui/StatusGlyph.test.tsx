import { afterEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { STATUS, STATUS_KINDS, StatusGlyph, type StatusKind } from "@/components/ui/StatusGlyph";
import { useMobileWords } from "@/i18n/mobile";

afterEach(() => document.documentElement.removeAttribute("lang"));

const words = (lang: "en" | "he") => useMobileWords.of(lang).status;

describe("StatusGlyph", () => {
  it("knows every kind the spec lists", () => {
    expect([...STATUS_KINDS].sort()).toEqual(
      [
        "draft", "scheduled", "sending", "sent", "paused", "failed", "canceled", "published", "changes", "hidden",
        "archived", "active", "revoked", "expired", "missing", "stale", "unverified", "translated", "mailable",
        "pending", "unsubscribed", "suppressed", "attention",
      ].sort(),
    );
  });

  it("takes its own words and a stronger tone, for one glyph that must say what is wrong", () => {
    const { container } = render(<StatusGlyph kind="attention" tone="danger" label="No title" />);
    const root = container.firstElementChild!;
    expect(root.getAttribute("aria-label")).toBe("No title");
    expect(root.getAttribute("data-tone")).toBe("danger");
  });

  it.each(STATUS_KINDS.filter((k) => !STATUS[k].quiet))("%s: aria-hidden svg and an accessible name, en and he", (kind) => {
    for (const lang of ["en", "he"] as const) {
      document.documentElement.lang = lang;
      const { container, unmount } = render(<StatusGlyph kind={kind as StatusKind} />);
      const root = container.firstElementChild!;
      expect(root.getAttribute("role")).toBe("img");
      expect(root.getAttribute("aria-label")).toBe(words(lang)[kind as StatusKind]);
      expect(root.getAttribute("aria-label")!.length).toBeGreaterThan(0);
      expect(root.querySelector("svg[aria-hidden='true']")).toBeTruthy();
      expect(root.getAttribute("title")).toBe(words(lang)[kind as StatusKind]);
      unmount();
    }
  });

  it("every kind has an icon and one of four tones, and a word in both languages", () => {
    for (const k of STATUS_KINDS) {
      expect(STATUS[k].icon, k).toBeTruthy();
      expect(["neutral", "ok", "attention", "danger"]).toContain(STATUS[k].tone);
      expect(words("en")[k], k).toBeTruthy();
      expect(words("he")[k], k).toMatch(/[֐-׿]/);
    }
  });

  it("defaults draw nothing on a row", () => {
    for (const k of ["published", "active", "mailable", "translated"] as const) {
      const { container, unmount } = render(<StatusGlyph kind={k} />);
      expect(container.firstChild, k).toBeNull();
      unmount();
    }
  });

  it("showDefault draws a default", () => {
    const { container } = render(<StatusGlyph kind="published" showDefault />);
    expect(container.querySelector("svg[aria-hidden='true']")).toBeTruthy();
  });

  it("withWord prints the word and leaves no duplicate name", () => {
    const { container } = render(<StatusGlyph kind="failed" withWord />);
    expect(container.textContent).toBe("Failed");
    expect(container.querySelector("[role='img']")).toBeNull();
  });

  it("carries the tone and kind as data, so colour is never the only difference", () => {
    const { container } = render(<StatusGlyph kind="failed" />);
    const el = container.firstElementChild!;
    expect(el.getAttribute("data-kind")).toBe("failed");
    expect(el.getAttribute("data-tone")).toBe("danger");
    const icons = new Set(STATUS_KINDS.filter((k) => !STATUS[k].quiet).map((k) => STATUS[k].icon));
    expect(icons.size).toBeGreaterThan(14);
  });
});
