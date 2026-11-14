/*
 * The reading pages: Help, Accessibility, Developers/MCP, Story, Follow.
 * What each must show on a phone (min counts), read by phone-pages.mjs.
 */

/** the radius of every element matching `sel` is at least `min` px (a group is a rounded surface) */
const rounded = (sel, min, want) => async (page, fail) => {
  const r = await page.evaluate(
    ([sel, min]) => {
      const els = [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().height > 0);
      return { n: els.length, bad: els.filter((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius) < min).length };
    },
    [sel, min],
  );
  if (r.n < want) fail(`${r.n} of "${sel}", want ${want}`);
  if (r.bad) fail(`${r.bad} of "${sel}" are not rounded (>= ${min}px)`);
};

export const pages = [
  {
    name: "help",
    route: "/help",
    groups: 1,
    circles: 6,
    check: async (page, fail) => {
      await rounded("[data-ph-prose] article", 22, 5)(page, fail);
      await rounded("[data-ph-prose] > ul", 22, 3)(page, fail);
      /* every contents row still jumps to its section */
      const dead = await page.evaluate(() =>
        [...document.querySelectorAll("[data-phone-row][href^='#']")].filter((a) => !document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)))).length,
      );
      if (dead) fail(`${dead} contents rows point at a missing section`);
    },
  },
  {
    name: "accessibility",
    route: "/accessibility",
    check: rounded("[data-ph-prose] > ul", 22, 4),
  },
  {
    name: "developers-mcp",
    route: "/developers/mcp",
    check: async (page, fail) => {
      await rounded("[data-ph=copy-box]", 14, 4)(page, fail);
      const t = await page.evaluate(() => ({
        tables: document.querySelectorAll("[data-ph=tools]").length,
        copy: [...document.querySelectorAll("[data-ph=copy-box] > button")].map((b) => Math.round(b.getBoundingClientRect().height)),
      }));
      if (t.tables !== 3) fail(`${t.tables} tool tables, want 3`);
      if (t.copy.length !== 4 || t.copy.some((h) => h < 44)) fail(`copy buttons ${JSON.stringify(t.copy)} (4, 44 tall)`);
    },
  },
  {
    name: "story",
    route: "/story",
    check: async (page, fail) => {
      const r = await page.evaluate(() => {
        const dl = document.querySelector("[data-ph=figures]");
        return { cols: dl ? getComputedStyle(dl).gridTemplateColumns.split(" ").length : 0, link: !!document.querySelector("[data-ph=onward]") };
      });
      if (r.cols !== 2) fail(`closing figures in ${r.cols} columns, want 2`);
      if (!r.link) fail("the onward link is gone");
    },
  },
  {
    name: "follow",
    route: "/follow",
    cards: 1,
    keyboard: true,
    check: async (page, fail) => {
      const r = await page.evaluate(() => ({
        form: !!document.querySelector("[data-signup] form"),
        consent: document.querySelector("[data-ph-consent]")?.textContent?.trim() ?? "",
        primary: Math.round(document.querySelector("[data-ph-primary]")?.getBoundingClientRect().height ?? 0),
        full: (() => {
          const b = document.querySelector("[data-ph-primary]")?.getBoundingClientRect();
          const f = document.querySelector("[data-signup] form")?.getBoundingClientRect();
          return b && f ? Math.abs(b.width - f.width) < 2 : false;
        })(),
        checks: document.querySelectorAll("[data-ph-checks] input[type=checkbox]").length,
      }));
      if (!r.form) fail("no sign-up form");
      if (r.consent.length < 20) fail("the consent sentence is missing");
      if (r.primary < 44 || !r.full) fail(`primary button ${r.primary} tall, full width ${r.full}`);
      if (r.checks !== 2) fail(`${r.checks} topic checkboxes, want 2`);
    },
  },
];
