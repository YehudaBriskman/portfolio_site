/*
 * Derives the tracking ramp per face instead of inheriting Archivo's.
 *
 * Method: at each step, sweep the tracking from +0.02em down to -0.08em and
 * record (a) the narrowest run of blank columns between two inked ones and
 * (b) how many separate ink runs the string still has. Archivo at the shipped
 * value is the reference — whatever residual gap it leaves is the gap the ramp
 * was tuned to produce, so the right value for another face is the one that
 * leaves the same residue in that face.
 *
 * SUPERSEDED FOR THE TEXT AND DATA ROLES (#97). This script was written when
 * the second-level face was Jim Nightshade and the data face Comic Relief,
 * against the #65 specimen at `/__specimen.html`, which no longer exists in
 * that form. The display steps it derives are still the record behind
 * --track-display and --track-head for Audiowide. The text and data steps are
 * now derived by the same method inside specimen.html (its ramp table, also
 * exposed as `window.__ramp`), for Comic Relief and Atkinson Hyperlegible Next
 * side by side, at the weights those steps actually ship at — which this
 * script never measured, because nothing was set at 700 when it was written.
 */
import { chromium } from "/home/yehuda/projects/army/unisync/MVP/node_modules/playwright-core/index.mjs";

const browser = await chromium.launch({
  executablePath: "/home/yehuda/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome",
  args: ["--no-sandbox", "--font-render-hinting=none"],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto("http://127.0.0.1:4226/__specimen.html", { waitUntil: "networkidle" });
await page.waitForFunction(() => document.documentElement.dataset.ready === "1");

const rows = await page.evaluate(() => {
  function profile(face, sizePx, trackEm, text, scale = 8) {
    const c = document.createElement("canvas");
    const m = c.getContext("2d", { willReadFrequently: true });
    const px = sizePx * scale;
    m.font = `${px}px "${face}"`;
    m.letterSpacing = `${trackEm * px}px`;
    c.width = Math.ceil(m.measureText(text).width) + px;
    c.height = Math.ceil(px * 2.4);
    const g = c.getContext("2d", { willReadFrequently: true });
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.font = `${px}px "${face}"`;
    g.letterSpacing = `${trackEm * px}px`;
    g.fillStyle = "#000"; g.textBaseline = "alphabetic";
    g.fillText(text, px * 0.3, px * 1.5);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const ink = new Array(c.width).fill(false);
    for (let x = 0; x < c.width; x++)
      for (let y = 0; y < c.height; y++)
        if (d[(y * c.width + x) * 4] < 128) { ink[x] = true; break; }
    const first = ink.indexOf(true), last = ink.lastIndexOf(true);
    if (first < 0) return { gap: 0, runs: 0, width: 0 };
    let min = Infinity, run = 0, runs = 1;
    for (let x = first; x <= last; x++) {
      if (!ink[x]) run++;
      else if (run > 0) { min = Math.min(min, run); runs++; run = 0; }
    }
    return { gap: (min === Infinity ? 0 : min) / scale, runs, width: (last - first) / scale };
  }

  const STEPS = [
    ["display/hero", 144, -0.045, { display: "HAMBURGEVONS" }],
    ["display/section", 100.8, -0.045, { display: "HAMBURGEVONS" }],
    ["head/object", 35.2, -0.035, { display: "HAMBURGEVONS" }],
    ["sub", 32, -0.020, { text: "Hamburgevons" }],
    ["sub/display", 32, -0.020, { display: "HAMBURGEVONS" }],
    ["inline-name", 17, -0.020, { display: "HAMBURGEVONS" }],
    ["body", 19, -0.006, { text: "Hamburgevons quick" }],
    ["field", 11.52, 0.180, { data: "REACT 19 IN USE" }],
  ];
  const FACES = {
    display: ["Archivo", "Audiowide", "Rubik Glitch"],
    text: ["Archivo", "Jim Nightshade", "Solitreo"],
    data: ["IBM Plex Mono", "Comic Relief", "Playpen Sans Hebrew"],
  };
  const HE = {
    "Rubik Glitch": "מפרטהעבודה",
    "Solitreo": "נמדדמתוךהעבודה",
    "Playpen Sans Hebrew": "חנותהתוספים",
  };

  const out = [];
  for (const [step, size, shipped, roleText] of STEPS) {
    const role = Object.keys(roleText)[0];
    for (const face of FACES[role]) {
      const text = HE[face] ?? roleText[role];
      const natural = profile(face, size, 0, text);
      const atShipped = profile(face, size, shipped, text);
      // Sweep for the tracking that reproduces Archivo's / Plex's residue.
      const sweep = [];
      for (let t = 0.03; t >= -0.09; t -= 0.0025) sweep.push([Number(t.toFixed(4)), profile(face, size, t, text)]);
      out.push({ step, size, shipped, face, natural, atShipped, sweep });
    }
  }
  return out;
});

await browser.close();

// Reference residue per step: whatever the incumbent face leaves at the
// shipped value. Archivo for display and text, IBM Plex Mono for the field.
const byStep = new Map();
for (const r of rows) {
  if (r.face === "Archivo" || r.face === "IBM Plex Mono") byStep.set(r.step, r.atShipped.gap);
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad("step", 16), pad("face", 21), pad("size", 7), pad("shipped", 9),
  pad("gap@0", 8), pad("gap@ship", 9), pad("runs@0", 7), pad("runs@ship", 10), pad("merges at", 11), "suggested");
for (const r of rows) {
  const target = byStep.get(r.step);
  let best = null, merge = null;
  for (const [t, p] of r.sweep) {
    if (p.runs < r.natural.runs) { if (merge === null) merge = t; continue; }
    if (p.gap + 1e-9 >= target) best = t;          // loosest value still at/above target
  }
  // The sweep runs loose -> tight, so `best` ends as the tightest value that
  // still clears the reference residue.
  console.log(
    pad(r.step, 16), pad(r.face, 21), pad(r.size + "px", 7), pad(r.shipped + "em", 9),
    pad(r.natural.gap.toFixed(2), 8), pad(r.atShipped.gap.toFixed(2), 9),
    pad(r.natural.runs, 7), pad(r.atShipped.runs, 10),
    pad(merge === null ? "never" : merge.toFixed(4) + "em", 11),
    best === null ? "—" : best.toFixed(4) + "em");
}
