import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Guards for direction A's kit (docs/public-mobile-guide.md, section 6):
 *  - phone-only: every look sits inside the one 640px phone query; outside it
 *    there is only the neutral base (a fixed list);
 *  - no blur, no hover, no physical left/right, no new font;
 *  - every component file has a row in the guide's catalogue.
 */

const DIR = resolve(__dirname, "..");
const ROOT = resolve(DIR, "../../../..");
const css = (f: string) => readFileSync(join(DIR, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

interface Rule {
  selector: string;
  body: string;
  ctx: string[];
}
function parse(src: string): Rule[] {
  const rules: Rule[] = [];
  const stack: { prelude: string; body: string }[] = [];
  let buf = "";
  for (const ch of src) {
    if (ch === "{") {
      stack.push({ prelude: buf.trim(), body: "" });
      buf = "";
    } else if (ch === "}") {
      const top = stack.pop();
      if (top) {
        const body = top.body + buf;
        if (!top.prelude.startsWith("@")) rules.push({ selector: top.prelude, body, ctx: stack.map((s) => s.prelude) });
      }
      buf = "";
    } else if (ch === ";" && stack.length) {
      stack[stack.length - 1].body += buf + ";";
      buf = "";
    } else buf += ch;
  }
  return rules;
}

const PHONE = /^@media \(max-width: 639px\)$/;
/** The neutral base: what a tablet and a desktop see. Nothing else may sit outside the phone query. */
const NEUTRAL: Record<string, string> = {
  ".circle": "display: contents",
  ".chevron": "display: none",
  ".tiles": "display: none",
  ".pinned": "display: none",
  ".group": "display: contents",
  ".stackToggle": "display: none",
};

describe("phone kit: phone only", () => {
  const rules = parse(css("phone.module.css"));

  it("everything outside the 639px query is the neutral base", () => {
    const outside = rules.filter((r) => !r.ctx.some((c) => PHONE.test(c)));
    const found = Object.fromEntries(outside.map((r) => [r.selector, r.body.trim().replace(/;$/, "")]));
    expect(found).toEqual(NEUTRAL);
  });

  it("tokens exist only inside the phone query", () => {
    const t = parse(css("tokens.css"));
    expect(t.length).toBeGreaterThan(0);
    for (const r of t) expect(r.ctx.some((c) => PHONE.test(c)), r.selector).toBe(true);
  });

  it("uses no other breakpoint", () => {
    for (const f of ["phone.module.css", "tokens.css"]) {
      for (const m of css(f).matchAll(/@media[^{]*/g)) expect(m[0].trim(), f).toMatch(PHONE);
    }
  });
});

describe("phone kit: house rules", () => {
  const all = ["phone.module.css", "tokens.css"].map(css).join("\n");

  it("has no blur, no hover, no physical left/right layout", () => {
    expect(all).not.toMatch(/backdrop-filter|filter:\s*blur|:hover/);
    expect(all).not.toMatch(/(^|[;{\s])(margin|padding|border)-(left|right)\s*:|(^|[;{\s])(left|right)\s*:|text-align:\s*(left|right)/);
  });

  it("brings no font and no third-party code", () => {
    expect(all).not.toMatch(/@font-face|@import|url\(/);
    for (const f of readdirSync(DIR).filter((n) => n.endsWith(".tsx"))) {
      const src = readFileSync(join(DIR, f), "utf8");
      for (const m of src.matchAll(/from "([^"]+)"/g)) {
        expect(m[1], `${f} imports ${m[1]}`).toMatch(/^(react|react-router-dom|lucide-react|@\/)/);
      }
    }
  });

  it("every component has a row in the guide's catalogue", () => {
    const md = readFileSync(join(ROOT, "docs/public-mobile-guide.md"), "utf8");
    const components = readdirSync(DIR)
      .filter((n) => n.endsWith(".tsx"))
      .map((n) => n.replace(/\.tsx$/, ""));
    expect(components.length).toBeGreaterThanOrEqual(7);
    for (const c of components) expect(md, `catalogue row for phone/${c}`).toContain(`phone/${c}.tsx`);
  });
});
