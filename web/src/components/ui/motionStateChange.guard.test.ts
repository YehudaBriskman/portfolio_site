import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PHONE_QUERY } from "@/hooks/usePhone";
import { outsideNoPreference, readCss } from "@/test/noPreference";

/*
 * State-change motion on a phone, read off the CSS text (docs/motion-contract.md
 * section 13). jsdom has no layout, so a missing exit transition is only
 * visible in the text.
 *
 *  - Every overlay, sub-page and toast has a transition on its enter state AND
 *    on its exit state, inside `prefers-reduced-motion: no-preference` AND the
 *    phone width (usePhone's query). Desktop gets none of it.
 *  - Nothing outside that gate moves (the instant fallback is the plain CSS).
 *  - Durations and easings are tokens; nothing loops.
 *  - The navigation has no second, competing entrance next to a scroll-driven one.
 */

const SRC = resolve(__dirname, "../..");
const css = (p: string) => {
  try {
    return readCss(resolve(SRC, p));
  } catch {
    return ""; // a missing stylesheet fails its own assertions below
  }
};
const src = (p: string) => readFileSync(resolve(SRC, p), "utf8");

const PHONE = `@media (prefers-reduced-motion: no-preference) and ${PHONE_QUERY}`;

function cut(text: string, marker: string): { inside: string; outside: string } {
  let inside = "";
  let outside = text;
  for (let at = outside.indexOf(marker); at !== -1; at = outside.indexOf(marker)) {
    const open = outside.indexOf("{", at) + 1;
    let i = open;
    for (let depth = 1; depth > 0 && i < outside.length; i++) {
      if (outside[i] === "{") depth++;
      else if (outside[i] === "}") depth--;
    }
    inside += outside.slice(open, i - 1) + "\n";
    outside = outside.slice(0, at) + outside.slice(i);
  }
  return { inside, outside };
}
const insidePhone = (text: string) => cut(text, PHONE).inside;
const outsidePhone = (text: string) => cut(text, PHONE).outside;

type Rule = { selector: string; body: string };
/** Flat list of rules, at-rule wrappers flattened. */
function rules(text: string): Rule[] {
  const out: Rule[] = [];
  const stack: string[] = [];
  const body: string[] = [];
  let buf = "";
  for (const ch of text) {
    if (ch === "{") {
      stack.push(buf.trim());
      body.push("");
      buf = "";
    } else if (ch === "}") {
      const sel = stack.pop() ?? "";
      const b = (body.pop() ?? "") + buf;
      if (!sel.startsWith("@")) out.push({ selector: sel.replace(/\s+/g, " "), body: b });
      buf = "";
    } else {
      buf += ch;
      if (ch === ";" && body.length) {
        body[body.length - 1] += buf;
        buf = "";
      }
    }
  }
  return out;
}

const transitionOf = (text: string, selector: string) =>
  rules(insidePhone(text))
    .filter((r) => r.selector.split(",").some((s) => s.trim() === selector))
    .map((r) => r.body.match(/(?:^|;|\s)transition\s*:\s*([^;]+)/)?.[1] ?? "")
    .filter(Boolean)
    .join(" | ");

/* Each surface, with the selector of its resting (exit) state and of its open (enter) state. */
const SURFACES: Array<{ name: string; file: string; exit: string; enter: string; startingStyle?: boolean; discrete?: boolean }> = [
  { name: "BottomSheet", file: "components/ui/BottomSheet.module.css", exit: "dialog.sheet:not([data-dragging])", enter: "dialog.sheet[open]:not([data-dragging])", startingStyle: true, discrete: true },
  { name: "BottomSheet backdrop", file: "components/ui/BottomSheet.module.css", exit: "dialog.sheet:global(.pop-dialog)::backdrop", enter: "dialog.sheet:global(.pop-dialog)[open]::backdrop", startingStyle: true, discrete: true },
  { name: "Settings sub-page", file: "components/ui/SettingsList.module.css", exit: ".page", enter: ".page[data-open]", startingStyle: true, discrete: true },
  { name: "Settings list under a sub-page", file: "components/ui/SettingsList.module.css", exit: ".listPane", enter: ".listPane[data-covered]" },
  { name: "Presence (toast, selection bar, inserted rows)", file: "components/ui/Presence.module.css", exit: ".presence", enter: '.presence[data-state="open"]', startingStyle: true },
  { name: "Disclosure", file: "components/ui/Disclosure.module.css", exit: ".disclosure::details-content", enter: ".disclosure[open]::details-content" },
];

describe("state-change motion: enter and exit transitions (phones)", () => {
  for (const s of SURFACES) {
    const text = css(s.file);
    it(`${s.name}: exit state has a transition inside the phone gate`, () => {
      expect(transitionOf(text, s.exit), `${s.file} ${s.exit}`).not.toBe("");
    });
    it(`${s.name}: enter state has a transition inside the phone gate`, () => {
      expect(transitionOf(text, s.enter), `${s.file} ${s.enter}`).not.toBe("");
    });
    if (s.startingStyle) {
      it(`${s.name}: has an @starting-style inside the phone gate`, () => {
        expect(insidePhone(text)).toContain("@starting-style");
      });
    }
    if (s.discrete) {
      it(`${s.name}: waits for its exit with allow-discrete`, () => {
        expect(transitionOf(text, s.exit)).toMatch(/(display|visibility)[^,]*(allow-discrete|\s)/);
      });
    }
  }
});

/* Stylesheets that gain their motion in this change: a desktop reader gets none of it. */
const PHONE_FILES = [
  "components/ui/BottomSheet.module.css",
  "components/ui/SettingsList.module.css",
  "components/ui/Presence.module.css",
  "components/ui/UndoToast.module.css",
  "components/ui/SelectionBar.module.css",
];

describe("state-change motion: phones only", () => {
  it("the gate is the phone breakpoint, usePhone's", () => {
    expect(PHONE_QUERY).toBe("(max-width: 599px)");
  });
  for (const f of PHONE_FILES) {
    const text = css(f);
    it(`${f}: no transition, animation or @starting-style outside the phone gate`, () => {
      const out = outsidePhone(text);
      expect(out).not.toMatch(/@keyframes|@starting-style/);
      expect(out).not.toMatch(/(?:^|[;{\s])animation(?:-[a-z-]+)?\s*:\s*(?!none\b)[^;]+/);
      expect(out).not.toMatch(/(?:^|[;{\s])transition(?:-[a-z-]+)?\s*:\s*(?!none\b)[^;]+/);
    });
    it(`${f}: durations and easings are tokens, nothing loops`, () => {
      const lines = insidePhone(text).match(/(?:^|[;{\s])transition(?:-duration|-timing-function)?\s*:[^;]+/g) ?? [];
      for (const l of lines) {
        expect(l, l).not.toMatch(/\b\d+(\.\d+)?m?s\b/);
        expect(l, l).not.toMatch(/cubic-bezier\(|(^|\s)ease(-in|-out|-in-out)?(\s|,|$)/);
        expect(l, l).not.toMatch(/(^|[\s:])all\b/);
      }
      expect(text).not.toMatch(/\binfinite\b/);
    });
  }
  it("every other stylesheet here keeps the older rule: motion only inside no-preference", () => {
    for (const f of ["components/ui/FilterSheet.module.css", "components/ui/FilterChips.module.css", "components/ui/InfoPopover.module.css", "components/ui/RecordRow.module.css", "components/ui/SettingsRow.module.css"]) {
      const out = outsideNoPreference(css(f));
      expect(out, f).not.toMatch(/@keyframes/);
      expect(out, f).not.toMatch(/(?:^|[;{\s])(?:animation|transition)(?:-[a-z-]+)?\s*:\s*(?!none\b)[^;]+/);
    }
  });

  it("the tokens exist on :root", () => {
    const index = css("index.css");
    for (const t of ["--a-dur-1", "--a-dur-2", "--a-dur-3", "--a-ease-out", "--a-ease-in", "--a-ease-spring"]) {
      expect(index, t).toMatch(new RegExp(`:root\\s*\\{[^}]*${t}\\s*:`));
    }
  });

  it("the toast and the selection bar are drawn through Presence, so they leave softly", () => {
    for (const f of ["components/ui/UndoToast.tsx", "components/ui/SelectionBar.tsx"]) {
      expect(src(f), f).toMatch(/<Presence\b/);
    }
  });

  it("the sub-page and the sheet keep their last content to leave with", () => {
    expect(src("components/ui/SettingsList.tsx")).toMatch(/data-open/);
    expect(src("components/ui/BottomSheet.tsx")).toMatch(/retained/);
  });
});

describe("navigation: one entrance per element", () => {
  /* The site header, the admin drawer and rail, the display menu, the sidebar groups. */
  const NAV = [
    "components/Nav.module.css",
    "components/nav/DisplayMenu.module.css",
    "components/ui/SidebarGroup.module.css",
  ];
  it("no navigation rule carries an entrance animation (keyframes) at all", () => {
    for (const f of NAV) {
      const text = css(f);
      expect(text, f).not.toMatch(/@keyframes/);
      expect(text, f).not.toMatch(/(?:^|[;{\s])animation(?:-name)?\s*:\s*(?!none\b)[^;]+/);
    }
  });
  it("no element has both a time-driven entrance and a scroll-driven animation", () => {
    for (const f of ["index.css", ...NAV]) {
      const bad = rules(css(f)).filter((r) => {
        const anim = r.body.match(/(?:^|;|\s)animation\s*:\s*([^;]+)/)?.[1];
        if (!anim || /^none\b/.test(anim)) return false;
        const timeDriven = !/animation-timeline/.test(r.body);
        return timeDriven && /(?:^|[.\s,])(?:a-side|a-nav|a-tab|a-crumbs|nav|header)\b/.test(r.selector) && /\d+m?s/.test(anim);
      });
      expect(bad.map((r) => r.selector), f).toEqual([]);
    }
  });
  it("the drawer enters and leaves by a transition, not a keyframe, on a phone", () => {
    const index = css("index.css");
    expect(index).toMatch(/\.a-side:not\(\[data-open\]\)/);
  });
});
