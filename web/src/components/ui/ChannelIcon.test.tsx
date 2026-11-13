import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CHANNELS, ChannelIcon, ChannelRow } from "@/components/ui/ChannelIcon";
import { useMobileWords } from "@/i18n/mobile";

afterEach(() => document.documentElement.removeAttribute("lang"));

describe("ChannelIcon", () => {
  it("is LinkedIn, X, Instagram, email in that fixed order", () => {
    expect([...CHANNELS]).toEqual(["linkedin", "x", "instagram", "email"]);
  });

  it.each(CHANNELS)("%s: a named image in en and he, posted and not", (ch) => {
    for (const lang of ["en", "he"] as const) {
      document.documentElement.lang = lang;
      const w = useMobileWords.of(lang).channel;
      for (const done of [true, false]) {
        const { container, unmount } = render(<ChannelIcon channel={ch} done={done} />);
        const el = container.firstElementChild!;
        expect(el.getAttribute("role")).toBe("img");
        expect(el.getAttribute("aria-label")).toBe(done ? w.posted(w.names[ch]) : w.notPosted(w.names[ch]));
        expect(el.getAttribute("data-done")).toBe(String(done));
        expect(el.querySelector("svg[aria-hidden='true']")).toBeTruthy();
        unmount();
      }
    }
  });

  it("posted and not-posted differ by shape, not by colour alone", () => {
    for (const ch of CHANNELS) {
      const a = render(<ChannelIcon channel={ch} done />);
      const b = render(<ChannelIcon channel={ch} done={false} />);
      expect(a.container.querySelector("[data-check]"), ch).toBeTruthy();
      expect(b.container.querySelector("[data-check]"), ch).toBeNull();
      expect(a.container.innerHTML).not.toBe(b.container.innerHTML);
      a.unmount();
      b.unmount();
    }
  });

  it("brand glyphs are filled when posted and outlined when not", () => {
    const a = render(<ChannelIcon channel="linkedin" done />);
    const b = render(<ChannelIcon channel="linkedin" done={false} />);
    expect(a.container.querySelector("path")!.getAttribute("fill")).toBe("currentColor");
    expect(b.container.querySelector("path")!.getAttribute("fill")).toBe("none");
  });
});

describe("ChannelRow", () => {
  it("is a labelled group of four, in order, folding done by channel", () => {
    const { container } = render(<ChannelRow done={{ linkedin: "2026-11-01", instagram: undefined, email: "2026-11-02" }} />);
    const group = container.firstElementChild!;
    expect(group.getAttribute("role")).toBe("group");
    expect(group.getAttribute("aria-label")).toBe("Where it is posted");
    const imgs = [...group.querySelectorAll("[role='img']")];
    expect(imgs.map((e) => e.getAttribute("data-channel"))).toEqual(["linkedin", "x", "instagram", "email"]);
    expect(imgs.map((e) => e.getAttribute("data-done"))).toEqual(["true", "false", "false", "true"]);
  });

  it("folds gmail into email", () => {
    const { container } = render(<ChannelRow done={{ gmail: "2026-11-02" }} />);
    expect(container.querySelector("[data-channel='email']")!.getAttribute("data-done")).toBe("true");
  });
});

describe("channel glyph source", () => {
  const src = readFileSync(resolve(__dirname, "channelGlyphs.ts"), "utf8");
  it("records where the paths came from, the licence and the commit", () => {
    expect(src).toMatch(/simple-icons/);
    expect(src).toMatch(/CC0-1\.0/);
    expect(src).toMatch(/[0-9a-f]{40}/);
  });
});
