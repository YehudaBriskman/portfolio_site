import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Readable admin text is at least 14px (.875rem), and a value an ellipsis
 * cuts short can still be read in full. Both are read off the source, because
 * jsdom has no layout: a size or a clipped string is only visible in the text.
 */

const SRC = resolve(__dirname, "../../..");
const ADMIN_DIRS = ["components/admin", "components/dashboard"];
const FLOOR = 0.875;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "__tests__") walk(p, out);
    } else if (!/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const files = [
  ...ADMIN_DIRS.flatMap((d) => walk(join(SRC, d))),
  ...readdirSync(join(SRC, "pages")).filter((n) => /^Admin.*\.tsx$/.test(n)).map((n) => join(SRC, "pages", n)),
];
const rel = (f: string) => relative(SRC, f);

/*
 * Decorative only: a mark the reader does not read as a sentence.
 * Each entry is `file :: fragment of the selector`.
 */
const DECORATIVE = [
  // Mock chrome of the platform previews: a WhatsApp timestamp.
  "previews.css :: .pv-wa-time",
];

function allowed(file: string, text: string) {
  return DECORATIVE.some((d) => {
    const [f, frag] = d.split(" :: ");
    return file.endsWith(f) && text.includes(frag);
  });
}

function toRem(v: string): number | null {
  const m = v.trim().match(/^(\d*\.?\d+)(rem|px|em)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] === "px" ? n / 16 : n;
}

/** Every `selector { declarations }` leaf block, nested at-rules included. */
function rules(css: string) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
}

/** In the global sheet only the admin's own `.a-*` classes count. */
const INDEX_CSS = join(SRC, "index.css");

describe("admin and dashboard text is never under .875rem", () => {
  const small: string[] = [];

  for (const f of [...files.filter((x) => x.endsWith(".css")), INDEX_CSS]) {
    for (const { sel, body } of rules(readFileSync(f, "utf8"))) {
      if (f === INDEX_CSS && !/\.a-[\w-]+/.test(sel)) continue;
      for (const d of body.matchAll(/(?:^|[;\s])font-size\s*:\s*([^;]+)/g)) {
        const rem = toRem(d[1]);
        if (rem !== null && rem < FLOOR && !allowed(f, sel)) {
          small.push(`${rel(f)}  ${sel.split("\n").pop()!.trim()}  { font-size: ${d[1].trim()} }`);
        }
      }
    }
  }

  for (const f of files.filter((x) => x.endsWith(".tsx"))) {
    const src = readFileSync(f, "utf8");
    src.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/(?<![\w-])text-xs(?![\w-])|text-\[(\d*\.?\d+(?:rem|px))\]/g)) {
        const rem = m[1] ? toRem(m[1]) : 0.75;
        if (rem !== null && rem < FLOOR) small.push(`${rel(f)}:${i + 1}  ${m[0]}`);
      }
    });
  }

  it("has no readable text below the floor (decorative allowlist aside)", () => {
    expect(small).toEqual([]);
  });

  it("measures: 12px and 0.75rem are under the floor, 14px is not", () => {
    expect(toRem("0.75rem")).toBeLessThan(FLOOR);
    expect(toRem("12px")).toBeLessThan(FLOOR);
    expect(toRem("14px")).toBe(FLOOR);
  });
});

describe("a value an ellipsis or line-clamp cuts short keeps its full text reachable", () => {
  const clipped: string[] = [];
  for (const f of files.filter((x) => x.endsWith(".tsx"))) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/<\w+\b(?:[^<>]|=>)*?className=(?:"[^"]*"|\{`[^`]*`\})(?:[^<>]|=>)*>/g)) {
      const tag = m[0];
      if (/(?<![\w-])(?:truncate|line-clamp-\d|text-ellipsis)(?![\w-])/.test(tag) && !/\btitle=/.test(tag)) {
        clipped.push(`${rel(f)}:${src.slice(0, m.index).split("\n").length}`);
      }
    }
  }

  it("gives every truncating element a title", () => {
    expect(clipped).toEqual([]);
  });
});
