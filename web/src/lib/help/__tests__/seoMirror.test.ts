// @vitest-environment node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { helpSeoPages } from "../seo";

/*
 * The server renders each help page's head from a copy of these words
 * (backend/src/services/help-pages.json): it cannot import from web/. This
 * keeps the copy honest. After a change to i18n/help.ts or the page list:
 *
 *   UPDATE_HELP_SEO=1 npx vitest run src/lib/help/__tests__/seoMirror.test.ts
 */
const FILE = resolve(__dirname, "../../../../../backend/src/services/help-pages.json");
const wanted = `${JSON.stringify(helpSeoPages(), null, 2)}\n`;

describe("the server's copy of the help pages' head words (#803)", () => {
  it("matches i18n/help.ts", () => {
    if (process.env.UPDATE_HELP_SEO) writeFileSync(FILE, wanted);
    expect(readFileSync(FILE, "utf8"), "run with UPDATE_HELP_SEO=1 to rewrite backend/src/services/help-pages.json").toBe(wanted);
  });

  it("gives every page a title and a description of its own, in both languages", () => {
    const pages = helpSeoPages();
    for (const lang of ["en", "he"] as const) {
      expect(new Set(pages.map((p) => p.title[lang])).size, `${lang} titles`).toBeGreaterThan(20);
      for (const p of pages) expect(p.description[lang].trim().length, `${p.id} ${lang}`).toBeGreaterThanOrEqual(20);
    }
    expect(pages.every((p) => p.hebrew)).toBe(true);
  });
});
