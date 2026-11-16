import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * One glass for the phone's floating controls (#885): the menu circle, the
 * back/section pill and the reader's bottom bar share ONE class and ONE set of
 * tokens, and none of the three restates a ground, a blur or a hairline. The
 * pill is portalled to <body> so no `isolate` ancestor can trap its layer
 * under the page.
 */
const src = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");
const bare = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const index = bare(src("index.css"));

describe("float-glass", () => {
  it("defines the tokens and the class once, with blur, saturate, a hairline and a shadow", () => {
    expect(index).toMatch(/--glass-bg:/);
    expect(index).toMatch(/--glass-blur:\s*blur\(\d+px\)\s*saturate\(/);
    expect(index).toMatch(/--glass-border:\s*1px solid/);
    expect(index).toMatch(/--glass-shadow:/);
    const block = index.slice(index.indexOf("html .float-glass {"));
    expect(block).toMatch(/background:\s*var\(--glass-bg\)/);
    expect(block).toMatch(/backdrop-filter:\s*var\(--glass-blur\)/);
    expect(block).toMatch(/-webkit-backdrop-filter:\s*var\(--glass-blur\)/);
  });

  it("is colourless glass: a near-clear neutral tint (<= 0.2), a strong blur, no ground of its own (#891)", () => {
    const m = index.match(/--glass-bg:\s*rgb\(var\(--paper\)\s*\/\s*([\d.]+)\)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeLessThanOrEqual(0.2);
    expect(Number(m![1])).toBeGreaterThan(0);
    expect(index).toMatch(/--glass-blur:\s*blur\((1[6-9]|[2-9]\d)px\)/);
  });

  it("keeps the label and icon legible on any backdrop with a halo, not a ground", () => {
    expect(index).toMatch(/--glass-halo:\s*rgb\(var\(--paper\)\)/);
    const block = index.slice(index.indexOf("html .float-glass {"));
    expect(block).toMatch(/text-shadow:\s*var\(--glass-text-halo\)/);
    expect(bare(src("components/Nav.module.css"))).toMatch(/\.toggle \.bars::(before|after)[^}]*var\(--glass-halo\)/);
  });

  it("falls back to a solid surface with no backdrop-filter or with reduced transparency", () => {
    expect(index).toMatch(/@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)\s*\{\s*html \.float-glass/);
    expect(index).toMatch(/@media \(prefers-reduced-transparency: reduce\)\s*\{\s*html \.float-glass/);
  });

  it("is carried by the circle, the pill and the reader bar, and they add no ground of their own", () => {
    expect(src("components/Nav.tsx")).toMatch(/styles\.toggle\} float-glass/);
    expect(src("components/ui/FloatingBack.tsx")).toMatch(/styles\.float\} float-glass/);
    expect(src("components/notes/ReadingBar.tsx")).toMatch(/styles\.barPill\} float-glass/);
    const toggle = bare(src("components/Nav.module.css")).match(/\n {2}\.toggle \{[^}]*\}/)![0];
    const pill = bare(src("components/ui/FloatingBack.module.css")).match(/\n\.float \{[^}]*\}/)![0];
    const bar = bare(src("components/notes/reader/Reader.module.css")).match(/\n {2}\.barPill \{[^}]*\}/)![0];
    for (const rule of [toggle, pill, bar]) {
      expect(rule).not.toMatch(/background:|backdrop-filter|box-shadow:|border:/);
    }
  });

  it("portals the pill to <body>, outside any isolating header", () => {
    expect(src("components/ui/FloatingBack.tsx")).toMatch(/createPortal\(/);
  });

  it("keeps the pill and the circle above the reader bar and the page", () => {
    expect(index).toMatch(/--float-z:\s*49/);
    expect(bare(src("components/ui/FloatingBack.module.css"))).toMatch(/z-index:\s*var\(--float-z\)/);
  });
});

describe("post tables", () => {
  const md = src("components/notes/reader/NoteMarkdown.tsx");
  const fn = md.slice(md.indexOf("function MarkdownTable"), md.indexOf("function MarkdownRule"));

  it("scroll inside their own focusable, named region and stay in the reading column", () => {
    expect(fn).toMatch(/tabIndex=\{0\}/);
    expect(fn).toMatch(/role="region"/);
    expect(fn).toMatch(/aria-label=\{w\.table\}/);
    expect(fn).toMatch(/overflow-x-auto/);
    expect(fn).toMatch(/max-w-full/);
    // no full-bleed on a phone, no inset padding that fights the column gutter
    expect(fn).not.toMatch(/\bbleed\b|FULL_WIDTH/);
    expect(fn).not.toMatch(/px-5/);
    expect(fn).toMatch(/text-start/);
    expect(fn).not.toMatch(/text-left/);
  });

  it("show an edge fade cue only on the side that has more to scroll", () => {
    const css = bare(index);
    expect(css).toMatch(/\.table-scroll\[data-more~='end'\]/);
    expect(css).toMatch(/\.table-scroll\[data-more~='start'\]/);
    expect(css).toMatch(/mask-image/);
  });
});
