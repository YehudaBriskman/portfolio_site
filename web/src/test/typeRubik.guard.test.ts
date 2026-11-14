import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * One modern UI family (Rubik) for Latin + Hebrew, issue #795.
 * Audiowide survives for the `.display` wordmark/hero name only; Jim
 * Nightshade is retired. Comments are stripped before matching so the
 * history in the stylesheet cannot trip a guard.
 */

const WEB = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(WEB, p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/** Declarations of the first rule whose selector is exactly `selector`. */
function block(css: string, selector: string): string {
  const src = strip(css);
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(?:^|[}\\s])${esc}\\s*\\{([^}]*)\\}`, "m").exec(src);
  if (!m) throw new Error(`no rule for ${selector}`);
  return m[1];
}

const index = read("src/index.css");

/** The selectors that moved off the display face, by file. */
const MOVED: Record<string, string[]> = {
  "src/index.css": [".a-app .a-h1", ".a-brand-name"],
  "src/pages/Project.module.css": [".title", ".crumb", ".slash"],
  "src/components/work/Work.module.css": [".title"],
  "src/components/dashboard/Dashboard.module.css": [".greeting"],
  "src/components/gallery/Filter.module.css": [".title"],
  "src/components/gallery/Rail.module.css": [".indexTitle", ".sheetTitle"],
  "src/components/notes/NoteTile.module.css": [".title"],
  "src/components/Stack.module.css": [".figure"],
  "src/components/story/Story.module.css": [".loopWords", ".figureValue"],
  "src/components/SignupBlock.module.css": [".heading"],
  "src/components/share/SharePreview.module.css": [".title"],
  "src/styles/popup.css": [".pop-title"],
};

describe("tokens", () => {
  it("--font-ui resolves to Rubik UI, in both languages, behind system fallbacks", () => {
    const ui = [...strip(index).matchAll(/--font-ui:\s*([^;]+);/g)].map((m) => m[1]);
    expect(ui.length).toBeGreaterThanOrEqual(1);
    for (const v of ui) expect(v).toMatch(/^'Rubik UI'/);
    expect(strip(index)).toMatch(/--weight-ui:\s*600;/);
  });

  it("--font-display stays Audiowide, and --font-accent is gone", () => {
    expect(strip(index)).toMatch(/--font-display:\s*'Audiowide'/);
    expect(strip(index)).not.toMatch(/--font-accent/);
  });
});

describe("@font-face", () => {
  const faces = [...strip(index).matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
  const rubik = faces.filter((f) => /font-family:\s*'Rubik UI'/.test(f));

  it("Rubik UI ships a Latin and a Hebrew file, 400-600, swap, with a unicode-range each", () => {
    expect(rubik).toHaveLength(2);
    for (const f of rubik) {
      expect(f).toMatch(/font-weight:\s*400 600/);
      expect(f).toMatch(/font-display:\s*swap/);
      expect(f).toMatch(/unicode-range:/);
    }
    expect(rubik.some((f) => /rubik-ui-400-600-latin\.woff2/.test(f))).toBe(true);
    expect(rubik.some((f) => /rubik-ui-400-600-hebrew\.woff2/.test(f))).toBe(true);
    for (const f of ["latin", "hebrew"]) expect(existsSync(resolve(WEB, `public/fonts/rubik-ui-400-600-${f}.woff2`))).toBe(true);
  });

  it("has a size-adjusted fallback face", () => {
    const fb = faces.find((f) => /font-family:\s*'Rubik UI Fallback'/.test(f));
    expect(fb).toBeDefined();
    expect(fb).toMatch(/size-adjust:/);
  });

  it("records its licence and source in a header comment", () => {
    expect(index).toMatch(/SIL Open Font License/);
    expect(index).toMatch(/@fontsource-variable\/rubik/);
  });

  it("no Jim Nightshade face or file remains", () => {
    expect(faces.some((f) => /Jim Nightshade/.test(f))).toBe(false);
    expect(existsSync(resolve(WEB, "public/fonts/jim-nightshade-400.woff2"))).toBe(false);
    for (const f of ["src/index.css", "src/components/Hero.module.css", "index.html"]) expect(strip(read(f))).not.toMatch(/Jim Nightshade/);
  });

  it("the Latin file is the only preload", () => {
    const html = read("index.html").replace(/<!--[\s\S]*?-->/g, "");
    expect(html).toMatch(/rel="preload" href="\/fonts\/rubik-ui-400-600-latin\.woff2"/);
    expect(html).not.toMatch(/rubik-ui-400-600-hebrew/);
  });

  it("the Latin file stays small", () => {
    expect(statSync(resolve(WEB, "public/fonts/rubik-ui-400-600-latin.woff2")).size).toBeLessThan(40_000);
  });
});

describe("selectors moved off Audiowide", () => {
  for (const [file, selectors] of Object.entries(MOVED)) {
    for (const sel of selectors) {
      it(`${file} ${sel}`, () => {
        const body = block(read(file), sel);
        expect(body).toMatch(/font-family:\s*var\(--font-ui\)/);
        expect(body).not.toMatch(/--font-display|Audiowide|--font-accent/);
      });
    }
  }

  it("Stack's figure and Story's figure value keep tabular figures", () => {
    expect(block(read("src/components/Stack.module.css"), ".figure")).toMatch(/tabular-nums/);
    expect(block(read("src/components/story/Story.module.css"), ".figureValue")).toMatch(/tabular-nums/);
  });

  it("the hero fact line uses the UI family, not the retired script", () => {
    expect(block(read("src/components/Hero.module.css"), ".plate > p")).toMatch(/font-family:\s*var\(--font-ui\)/);
  });
});

describe("Audiowide is confined", () => {
  it("--font-display is consumed only by `.display` and the hero plate name", () => {
    const users: string[] = [];
    const files = [
      "src/index.css", "src/styles/popup.css", "src/pages/Project.module.css", "src/components/work/Work.module.css",
      "src/components/dashboard/Dashboard.module.css", "src/components/gallery/Filter.module.css", "src/components/gallery/Rail.module.css",
      "src/components/gallery/ObjectLabel.module.css", "src/components/notes/NoteTile.module.css", "src/components/Stack.module.css",
      "src/components/story/Story.module.css", "src/components/SignupBlock.module.css", "src/components/share/SharePreview.module.css",
    ];
    for (const f of files) {
      for (const m of strip(read(f)).matchAll(/([^{};]+)\{([^{}]*font-family:\s*var\(--font-display\)[^{}]*)\}/g)) users.push(`${f} ${m[1].trim()}`);
    }
    expect(users.sort()).toEqual(["src/components/gallery/ObjectLabel.module.css .plate .name", "src/index.css .display"]);
  });
});
