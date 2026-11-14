/*
 * Contact, the compact forms, the subscribe pages, the 404 page, Privacy's
 * way back and the footer. What each must show on a phone, read by
 * phone-pages.mjs.
 */

const footerCheck = async (page, fail) => {
  const r = await page.evaluate(() => {
    const lists = [...document.querySelectorAll("footer[data-ph-foot] ul.space-y-1")];
    return {
      n: lists.length,
      round: lists.filter((u) => parseFloat(getComputedStyle(u).borderTopLeftRadius) >= 22).length,
      links: [...document.querySelectorAll("footer[data-ph-foot] ul.space-y-1 a")].map((a) => {
        const b = a.getBoundingClientRect();
        return { h: Math.round(b.height), w: Math.round(b.width) };
      }),
    };
  });
  if (r.n !== 3) fail(`${r.n} footer groups, want 3`);
  if (r.round !== r.n) fail("a footer group is not rounded (22px)");
  if (r.links.length < 8) fail(`only ${r.links.length} footer links in groups`);
  if (r.links.some((l) => l.h < 48 || l.w < 200)) fail(`footer link boxes ${JSON.stringify(r.links.filter((l) => l.h < 48 || l.w < 200))} (48 tall, full row)`);
};

const resultCard = async (page, fail) => {
  const r = await page.evaluate(() => {
    const b = document.querySelector("[data-ph-primary]")?.getBoundingClientRect();
    const f = document.querySelector("[data-ph-frame]")?.getBoundingClientRect();
    const res = document.querySelector("[data-ph-result]");
    return {
      primary: b ? { h: Math.round(b.height), full: f ? Math.abs(b.width - f.width) < 2 : false } : null,
      resultRadius: res ? parseFloat(getComputedStyle(res).borderTopLeftRadius) : 0,
      reserved: res ? Math.round(res.getBoundingClientRect().height) : 0,
    };
  });
  if (!r.primary) fail("no primary button");
  else if (r.primary.h < 48 || !r.primary.full) fail(`primary button ${JSON.stringify(r.primary)} (48 tall, full width)`);
  if (r.resultRadius < 22) fail("the result is not a card");
  if (r.reserved < 56) fail(`the result reserves ${r.reserved}px, was 56 (layout shift)`);
};

export const pages = [
  {
    name: "contact",
    route: "/",
    cards: 1,
    keyboard: true,
    before: async (page) => {
      await page.evaluate(() => document.querySelector("#contact").scrollIntoView());
      await page.locator("[data-ph-ask] [data-ph-primary]").click({ force: true });
      await page.waitForTimeout(600);
    },
    check: async (page, fail) => {
      const r = await page.evaluate(() => {
        const f = [...document.querySelectorAll("[data-ph-contact] [data-ph-field]")];
        const btn = document.querySelector("[data-ph-contact] [data-ph-primary]")?.getBoundingClientRect();
        const form = document.querySelector("[data-ph-contact]")?.getBoundingClientRect();
        const rects = f.map((e) => e.getBoundingClientRect());
        return {
          fields: f.length,
          touching: rects.every((b, i) => i === 0 || Math.abs(b.top - rects[i - 1].bottom) < 1.5),
          btn: btn ? { h: Math.round(btn.height), full: form ? Math.abs(btn.width - form.width) < 2 : false } : null,
        };
      });
      if (r.fields !== 3) fail(`${r.fields} grouped fields, want 3`);
      if (!r.touching) fail("the three fields are not one continuous card");
      if (!r.btn || r.btn.h < 48 || !r.btn.full) fail(`send button ${JSON.stringify(r.btn)}`);
    },
  },
  { name: "privacy", route: "/privacy", groups: 1, circles: 1, check: footerCheck },
  { name: "unsubscribe", route: "/unsubscribe?token=t", check: resultCard },
  { name: "confirm", route: "/subscribe/confirm?token=t", check: resultCard },
  { name: "manage", route: "/subscribe/manage", check: async (page, fail) => {
      const r = await page.evaluate(() => ({ result: !!document.querySelector("[data-ph-result]"), back: !!document.querySelector("[data-ph-back]") }));
      if (!r.result || !r.back) fail("the manage page lost its status line or its way home");
    } },
  {
    name: "not-found",
    route: "/nope",
    check: async (page, fail) => {
      const r = await page.evaluate(() => {
        const p = document.querySelector("p[data-ph=path]");
        const btns = [...document.querySelectorAll("[data-ph=onward-list] > a")].map((a) => a.getBoundingClientRect());
        return { radius: p ? parseFloat(getComputedStyle(p).borderTopLeftRadius) : 0, n: btns.length, stacked: btns.every((b, i) => i === 0 || b.top >= btns[i - 1].bottom - 1), tall: btns.every((b) => b.height >= 48) };
      });
      if (r.radius < 22) fail("the quoted path is not a card");
      if (r.n !== 3) fail(`${r.n} ways onward, want 3`);
      if (!r.stacked || !r.tall) fail("the ways onward are not stacked 48+ pills");
    },
  },
];
