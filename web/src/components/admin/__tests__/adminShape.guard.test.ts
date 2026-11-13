import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The admin's shape, tokens and motion, read off the source (jsdom has no
 * layout, and a corner or a transition is only visible in the text).
 *
 *  - The controls and boxes use the admin radius tokens, not a 6px literal.
 *  - The tokens exist in the light scope and the dark scope.
 *  - Nothing in the admin moves unless the visitor allows motion.
 */

const SRC = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(SRC, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

type Decl = { stack: string[]; selector: string; prop: string; value: string };

/** Every declaration, with the at-rules it sits inside and its own selector. */
function declarations(css: string): Decl[] {
  const out: Decl[] = [];
  const stack: string[] = [];
  let buf = "";
  const flush = () => {
    const m = buf.match(/^\s*([\w-]+)\s*:\s*([\s\S]+?)\s*$/);
    if (m) {
      const selector = [...stack].reverse().find((s) => !s.startsWith("@")) ?? "";
      out.push({ stack: [...stack], selector, prop: m[1], value: m[2] });
    }
    buf = "";
  };
  for (const ch of css) {
    if (ch === "{") { stack.push(buf.trim()); buf = ""; }
    else if (ch === "}") { flush(); stack.pop(); }
    else if (ch === ";") flush();
    else buf += ch;
  }
  return out;
}

const INDEX = declarations(read("index.css"));
const ADMIN_FILES = [
  "components/admin/noteEditor/NoteEditor.module.css",
  "components/admin/Media.module.css",
  "components/admin/announce/inbox/inbox.css",
  "components/admin/announce/previews/previews.css",
];
const FILES = ADMIN_FILES.map((f) => ({ f, decls: declarations(read(f)) }));
const ADMIN_INDEX = INDEX.filter((d) => /\.a-[\w-]+/.test(d.selector));

const has = (sel: string, cls: string) => new RegExp(`${cls.replace(".", "\\.")}(?![\\w-])`).test(sel);

describe("admin radius", () => {
  const CONTROLS = [".a-btn", ".a-input", ".a-select", ".a-card", ".a-box", ".a-table", ".a-nav-item"];
  it("no literal corner under 10px on controls and boxes", () => {
    const bad = ADMIN_INDEX.filter(
      (d) =>
        /^border(-(start|end)-(start|end)|-(top|bottom)-(left|right))?-radius$/.test(d.prop) &&
        CONTROLS.some((c) => has(d.selector, c)) &&
        [...d.value.matchAll(/(\d*\.?\d+)px/g)].some((m) => Number(m[1]) < 10),
    );
    expect(bad.map((d) => `${d.selector} { ${d.prop}: ${d.value} }`)).toEqual([]);
  });
  it("the dashboards' radius is the admin box radius", () => {
    const css = read("components/dashboard/Dashboard.module.css");
    expect(css).toMatch(/--dash-r:\s*var\(--a-r-box/);
  });
});

describe("admin tokens", () => {
  const scope = (sel: string) => new Map(INDEX.filter((d) => d.selector === sel && d.prop.startsWith("--")).map((d) => [d.prop, d.value]));
  const light = scope(".a-app");
  const dark = scope(":root[data-theme='dark'] .a-app");
  const BOTH = ["--a-shadow-1", "--a-shadow-2", "--a-shadow-3", "--a-line", "--a-line-soft", "--a-hover", "--a-press"];
  const LIGHT_ONLY = [
    "--a-r-ctl", "--a-r-box", "--a-r-sheet", "--a-r-pill",
    "--a-s-1", "--a-s-2", "--a-s-3", "--a-s-4", "--a-s-5", "--a-s-6",
    "--a-dur-fast", "--a-dur-base", "--a-dur-sheet", "--a-ease-out", "--a-ease-inout",
  ];
  it("light scope defines every token", () => {
    expect([...BOTH, ...LIGHT_ONLY].filter((t) => !light.has(t))).toEqual([]);
  });
  it("dark scope redefines the shadows, lines and tints", () => {
    expect(BOTH.filter((t) => !dark.has(t))).toEqual([]);
  });
  it("radius ladder is concentric: control < box < sheet", () => {
    const px = (t: string) => Number(light.get(t)?.match(/^(\d+)px$/)?.[1]);
    expect(px("--a-r-ctl")).toBeGreaterThanOrEqual(10);
    expect(px("--a-r-box")).toBeGreaterThan(px("--a-r-ctl"));
    expect(px("--a-r-sheet")).toBeGreaterThan(px("--a-r-box"));
  });
});

describe("admin motion", () => {
  const MOVES = /^(transition|animation)(-name)?$/;
  const allowed = (d: Decl) =>
    d.stack.some((s) => /^@media\s*\(prefers-reduced-motion:\s*no-preference\)/.test(s)) ||
    /^(none|0s|initial)\b/.test(d.value);
  const all = [
    ...ADMIN_INDEX.map((d) => ({ file: "index.css", d })),
    ...FILES.flatMap(({ f, decls }) => decls.map((d) => ({ file: f, d }))),
  ];
  it("every transition and animation is inside prefers-reduced-motion: no-preference", () => {
    const bad = all.filter(({ d }) => MOVES.test(d.prop) && !allowed(d));
    expect(bad.map(({ file, d }) => `${file} :: ${d.selector} { ${d.prop}: ${d.value.slice(0, 40)} }`)).toEqual([]);
  });
  it("never transitions `all`", () => {
    expect(all.filter(({ d }) => d.prop === "transition" && /(^|\s|,)all\b/.test(d.value))).toEqual([]);
  });
});
