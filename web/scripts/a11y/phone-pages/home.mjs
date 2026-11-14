/*
 * The home page below the hero. What it must show on a phone, read by
 * phone-pages.mjs. The hero is not looked at here (public-landing.mjs).
 */
export const pages = [
  {
    name: "home-specs",
    route: "/",
    check: async (page, fail) => {
      await page.evaluate(() => document.querySelector("#stack")?.scrollIntoView());
      const r = await page.evaluate(() => {
        const dl = document.querySelector("dl[data-ph=specs]");
        const cells = dl ? [...dl.children] : [];
        const boxes = cells.map((c) => c.getBoundingClientRect());
        return {
          n: cells.length,
          round: cells.every((c) => parseFloat(getComputedStyle(c).borderTopLeftRadius) >= 22),
          filled: cells.every((c) => getComputedStyle(c).backgroundColor !== "rgba(0, 0, 0, 0)"),
          twoUp: boxes.length < 2 || Math.abs(boxes[0].top - boxes[1].top) < 2,
          inside: boxes.every((b) => b.left >= 0 && b.right <= innerWidth),
          h1: document.querySelectorAll("h1").length,
        };
      });
      if (r.n < 2) fail(`${r.n} spec cells`);
      if (!r.round || !r.filled) fail("the spec cells are not rounded tiles");
      if (!r.twoUp) fail("the spec tiles are not two to a row");
      if (!r.inside) fail("a spec tile leaves the screen");
      if (r.h1 !== 1) fail(`${r.h1} h1 on the home page, want 1`);
    },
  },
];
