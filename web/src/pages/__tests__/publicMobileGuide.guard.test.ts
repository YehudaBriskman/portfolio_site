import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_PHONE_BREAKPOINT, PUBLIC_PHONE_QUERY } from "../../lib/phoneBreakpoint";

/*
 * docs/public-mobile-guide.md, rules R1, R2, R3, R4, R6 and R15, read off the
 * source (jsdom cannot lay anything out; the browser matrix is a later PR).
 *
 * Each rule starts as a WARNING LIST: the offenders that exist today are named
 * in an allow-list below and the test passes with them. The lists may only
 * SHRINK:
 *   - a new offender (not listed) fails the test;
 *   - a listed offender that has been fixed fails the test too, until its
 *     line is deleted from the list.
 * Scope is the public site: everything under web/src and index.html except the
 * admin (components/admin, pages/Admin*, .a-* rules in index.css) and tests.
 */

const WEB = resolve(__dirname, "../../..");
const SRC = join(WEB, "src");
const ROOT = resolve(WEB, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "__tests__" || e.name === "node_modules") continue;
      walk(p, out);
    } else if (!/\.(test|spec)\./.test(e.name)) out.push(p);
  }
  return out;
}
const rel = (p: string) => relative(WEB, p).split("\\").join("/");
const isAdminFile = (r: string) => /^src\/(components\/admin\/|pages\/Admin|components\/ui\/SidebarGroup)/.test(r);
const publicFiles = (re: RegExp) => walk(SRC).filter((p) => re.test(p) && !isAdminFile(rel(p)));
const read = (p: string) => readFileSync(p, "utf8");

/** Compare found offenders with the allow-list in both directions. */
function expectSame(rule: string, found: Set<string>, allowed: readonly string[]) {
  const allow = new Set(allowed);
  const fresh = [...found].filter((f) => !allow.has(f)).sort();
  const fixed = [...allow].filter((a) => !found.has(a)).sort();
  expect(fresh, `${rule}: NEW offenders. Fix them (docs/public-mobile-guide.md), do not add them to the allow-list:\n  ${fresh.join("\n  ")}`).toEqual([]);
  expect(fixed, `${rule}: these are fixed. Delete them from the allow-list (it may only shrink):\n  ${fixed.join("\n  ")}`).toEqual([]);
}

/* ---- a tiny CSS reader: rules with the at-rule preludes around them ---- */

interface Rule {
  selector: string;
  body: string;
  ctx: string[]; // preludes of every enclosing block, outermost first
}

function parseCss(src: string): Rule[] {
  const css = src.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: Rule[] = [];
  const stack: { prelude: string; body: string }[] = [];
  let buf = "";
  for (const ch of css) {
    if (ch === "{") {
      stack.push({ prelude: buf.trim(), body: "" });
      buf = "";
    } else if (ch === "}") {
      const top = stack.pop();
      if (top) {
        const body = top.body + buf;
        if (!top.prelude.startsWith("@")) {
          rules.push({ selector: top.prelude, body, ctx: stack.map((s) => s.prelude) });
        }
      }
      buf = "";
    } else if (ch === ";" && stack.length) {
      stack[stack.length - 1].body += buf + ";";
      buf = "";
    } else buf += ch;
  }
  return rules;
}

/** A rule whose every selector is `.a-*` is the admin's (index.css is shared). */
const isAdminRule = (r: Rule) =>
  r.selector.split(",").every((s) => /\.a-[\w-]+/.test(s));

const cssFiles = () => publicFiles(/\.css$/);
const parsed = (p: string) => parseCss(read(p)).filter((r) => !isAdminRule(r));

/* ------------------------------------------------------------------------ */

/** Page shells that still use Tailwind min-h-screen (= 100vh). Move to min-h-svh. */
const ALLOW_BARE_VH: readonly string[] = [
  "src/components/PageShell.tsx  min-h-screen",
  "src/pages/Index.tsx  min-h-screen",
];
/** Unguarded hover today: a file and how many rules. Wrap in @media (hover: hover) and delete the line. */
const ALLOW_HOVER: readonly string[] = [
  "src/components/Contact.module.css  1 unguarded :hover rule",
  "src/components/HeroCorners.module.css  1 unguarded :hover rule",
  "src/components/LatestNotes.module.css  1 unguarded :hover rule",
  "src/components/SiteFooter.tsx  tailwind hover: utility",
  "src/components/city/ContributionCity.module.css  1 unguarded :hover rule",
  "src/components/dashboard/Dashboard.module.css  14 unguarded :hover rules",
  "src/components/dashboard/History.module.css  6 unguarded :hover rules",
  "src/components/gallery/ObjectLabel.module.css  1 unguarded :hover rule",
  "src/components/nav/DisplayMenu.module.css  1 unguarded :hover rule",
  "src/components/notes/Byline.tsx  tailwind hover: utility",
  "src/components/notes/NoteTile.module.css  1 unguarded :hover rule",
  "src/components/notes/headingAnchors.module.css  1 unguarded :hover rule",
  "src/components/notes/reader/NoteMarkdown.tsx  tailwind hover: utility",
  "src/components/notes/reader/Reader.module.css  5 unguarded :hover rules",
  "src/components/projects/ProjectRun.module.css  1 unguarded :hover rule",
  "src/components/share/ShareMenu.module.css  1 unguarded :hover rule",
  "src/components/share/SharePreview.module.css  2 unguarded :hover rules",
  "src/components/story/Story.module.css  1 unguarded :hover rule",
  "src/components/ui/button.tsx  tailwind hover: utility",
  "src/components/work/Tabs.module.css  2 unguarded :hover rules",
  "src/components/work/Work.module.css  5 unguarded :hover rules",
  "src/index.css  2 unguarded :hover rules",
  "src/pages/BlogLog.module.css  4 unguarded :hover rules",
  "src/pages/DevelopersMcp.tsx  tailwind hover: utility",
  "src/pages/Project.module.css  4 unguarded :hover rules",
];
const ALLOW_SMALL_INPUT: readonly string[] = [];
/** Admin-only unsaved-changes prompts. A public page must never add one. */
const ALLOW_BEFOREUNLOAD: readonly string[] = [
  "src/hooks/useLeaveGuard.ts",
  "src/pages/AdminEditor.tsx",
];
/** Public phone switches that are not 639px. PR 6 migrates them to PUBLIC_PHONE_BREAKPOINT. */
const ALLOW_PHONE_BREAKPOINT: readonly string[] = [
  "src/components/Hero.module.css  max-width:699px",
  "src/components/HeroCorners.module.css  max-width:699px",
  "src/components/city/ContributionCity.module.css  max-width:640px",
  "src/components/ground/AmbientOrbs.module.css  max-width:699px",
  "src/components/projects/ProjectRun.module.css  max-width:699px",
  "src/components/projects/ProjectRun.module.css  max-width:700px",
  "src/index.css  max-width:479.98px",
  "src/index.css  max-width:599px",
  "src/index.css  max-width:700px",
];

describe("public mobile guide: the guide itself", () => {
  const guide = join(ROOT, "docs/public-mobile-guide.md");
  const md = existsSync(guide) ? read(guide) : "";

  it("exists with rules R1 to R20, the catalogue and the real-device checklist", () => {
    expect(md, "docs/public-mobile-guide.md is missing").not.toBe("");
    for (let n = 1; n <= 20; n++) expect(md, `R${n}`).toMatch(new RegExp(`^\\|\\s*R${n}\\s*\\|`, "m"));
    expect(md).toMatch(/^## .*[Cc]atalogue/m);
    expect(md).toMatch(/^## .*[Rr]eal-device/m);
  });

  it("documents the one phone breakpoint and the constant that holds it", () => {
    expect(PUBLIC_PHONE_BREAKPOINT).toBe(640);
    expect(PUBLIC_PHONE_QUERY).toBe("(max-width: 639px)");
    expect(md).toContain("640");
    expect(md).toContain("PUBLIC_PHONE_BREAKPOINT");
  });

  it("is linked from AGENTS.md and docs/README.md", () => {
    expect(read(join(ROOT, "AGENTS.md"))).toContain("docs/public-mobile-guide.md");
    expect(read(join(ROOT, "docs/README.md"))).toContain("public-mobile-guide.md");
  });
});

describe("public mobile guide: warning lists that may only shrink", () => {
  it("R2: no bare 100vh for layout (use svh / dvh)", () => {
    const found = new Set<string>();
    const files = [...publicFiles(/\.(css|tsx?)$/), join(WEB, "index.html")];
    for (const p of files) {
      read(p)
        .split("\n")
        .forEach((line, i) => {
          // a scroll-timeline inset is arithmetic on the viewport, not a box that must fit the screen
          if (/view-timeline-inset|scroll-timeline|animation-range/.test(line)) return;
          const hit = /\b100vh\b/.test(line) ? "100vh" : /(^|[\s"'`:])(min-|max-)?h-screen\b/.exec(line)?.[0].trim().replace(/^[:"'`]/, "");
          if (hit) found.add(`${rel(p)}  ${hit}`);
        });
    }
    expectSame("R2", found, ALLOW_BARE_VH);
  });

  it("R6: hover styles live inside @media (hover: hover)", () => {
    // one entry per file with its count, so renaming a selector does not churn the list
    const found = new Set<string>();
    for (const p of cssFiles()) {
      const n = parsed(p).filter((r) => /:hover\b/.test(r.selector) && !r.ctx.some((c) => /\bhover:\s*hover\b/.test(c))).length;
      if (n) found.add(`${rel(p)}  ${n} unguarded :hover rule${n > 1 ? "s" : ""}`);
    }
    // Tailwind 3 `hover:` utilities are not wrapped in the media query: one entry per file
    for (const p of publicFiles(/\.tsx$/)) if (/["'`\s]hover:[\w[-]/.test(read(p))) found.add(`${rel(p)}  tailwind hover: utility`);
    expectSame("R6", found, ALLOW_HOVER);
  });

  it("R4: inputs, selects and textareas are at least 16px (iOS zooms the page below that)", () => {
    const found = new Set<string>();
    for (const p of cssFiles()) {
      for (const r of parsed(p)) {
        if (!/(^|[\s,>+~(.:\]])(input|textarea|select)\b/.test(r.selector)) continue;
        const m = /(?:^|[;\s])font-size:\s*([\d.]+)(px|rem|em)\b/.exec(r.body);
        if (!m) continue;
        const px = Number(m[1]) * (m[2] === "px" ? 1 : 16);
        if (px < 16) found.add(`${rel(p)}  ${r.selector.replace(/\s+/g, " ").slice(0, 90)}  font-size:${m[1]}${m[2]}`);
      }
    }
    expectSame("R4", found, ALLOW_SMALL_INPUT);
  });

  it("R15: no unload handler anywhere; beforeunload only where listed (it can cost the back/forward cache)", () => {
    const unload = new Set<string>();
    const before = new Set<string>();
    for (const p of walk(SRC).filter((f) => /\.(tsx?|html)$/.test(f))) {
      const t = read(p);
      if (/["'`]unload["'`]|\bonunload\b/.test(t)) unload.add(rel(p));
      if (/["'`]beforeunload["'`]/.test(t)) before.add(rel(p));
    }
    expect([...unload], "an unload handler disables bfcache on every page; use pagehide").toEqual([]);
    expectSame("R15", before, ALLOW_BEFOREUNLOAD);
  });

  it("R1: one public phone breakpoint, 640 (max-width 639px); other widths are listed", () => {
    const found = new Set<string>();
    for (const p of cssFiles()) {
      const r0 = rel(p);
      if (/^src\/components\/ui\//.test(r0)) continue; // shared admin kit: the admin's 600px hook, see the guide
      for (const m of read(p).replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/@media[^{]*\bmax-width:\s*(\d+(?:\.\d+)?)px/g)) {
        const w = Number(m[1]);
        if (w > 767) continue; // tablet and desktop steps are not the phone switch
        if (w === 639 || w === 639.98) continue;
        found.add(`${r0}  max-width:${m[1]}px`);
      }
    }
    expectSame("R1", found, ALLOW_PHONE_BREAKPOINT);
  });

  it("R3: the viewport meta never locks zoom", () => {
    const hits: string[] = [];
    for (const p of [join(WEB, "index.html"), ...walk(SRC).filter((f) => /\.tsx?$/.test(f))]) {
      const t = read(p);
      for (const m of t.matchAll(/<meta[^>]*name=["']viewport["'][^>]*>|["']viewport["'][^\n]{0,200}/g)) {
        if (/maximum-scale|user-scalable\s*=\s*(no|0)/i.test(m[0])) hits.push(rel(p));
      }
    }
    expect(hits).toEqual([]);
    expect(read(join(WEB, "index.html"))).toMatch(/name="viewport"[^>]*viewport-fit=cover/);
  });
});
