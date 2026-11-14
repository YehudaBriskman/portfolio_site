#!/usr/bin/env node
/*
 * Generates the static prototypes in ./html (plain HTML + one <style> block,
 * no JS, no network): three directions x screens x he/en x light/dark.
 *   node docs/design/public-mobile-direction/build.mjs
 * The values are the site's own tokens (web/src/index.css): paper, ink, the
 * radius ladder, the five hues and each project's real tint (data/projects.ts).
 * Fonts are the site's self-hosted files, referenced from web/public/fonts.
 * Copy is prototype placeholder text; new public wording needs owner approval.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "html");
mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------ icons */
const P = {
  doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M9.5 12h6M9.5 16h6"/>',
  box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  layers: '<path d="M12 4l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/>',
  spark: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/>',
  code: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
  car: '<path d="M4 15v-3l2-5h12l2 5v3zM4 15v3h3v-3M17 15v3h3v-3M7 12h10"/>',
  tab: '<rect x="4" y="5" width="16" height="14" rx="3"/><path d="M4 10h16M8 14.5h3"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>',
  list: '<path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
  star: '<path d="M12 4l2.4 5 5.6.7-4.1 3.8 1.1 5.5L12 16.3 7 19l1.1-5.5L4 9.7 9.6 9z"/>',
  fork: '<circle cx="7" cy="6" r="2"/><circle cx="17" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 8v2a3 3 0 003 3h4a3 3 0 003-3V8M12 13v3"/>',
  tag: '<path d="M4 12V5h7l9 9-7 7z"/><circle cx="8" cy="9" r="1"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  push: '<path d="M12 19V6M7 11l5-5 5 5"/>',
  out: '<path d="M8 16L18 6M10 6h8v8"/>',
  note: '<path d="M6 4h12v16H6z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
  pen: '<path d="M5 19l1-4L16 5l3 3L9 18z"/>',
  menu: '<path d="M5 8h14M5 16h14"/>',
};
const svg = (n, c = "") => `<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

/* ------------------------------------------------------------------- copy */
const T = {
  en: {
    dir: "ltr", lang: "en",
    work: "Work", notes: "Notes", pinned: "Pinned", all: "All projects", sortBy: "Recently updated", newest: "Newest", name: "Name",
    wsub: "Everything I have built, with the decisions behind it.",
    browse: "Browse by area", latest: "Latest on the site", seeLog: "Full channel log",
    search: "Search notes", chipAll: "All", min: "2 min read", note: "Note", written: "Written",
    contents: "Contents", textSize: "Text", share: "Share", back: "Back",
    overview: "Overview", releases: "Releases", docs: "Docs", decisions: "Decisions", links: "Links",
    repo: "Open repository", repoMeta: "github.com/YehudaBriskman/Bothy", docMeta: "docs/README.md",
    stars: "Stars", forks: "Forks", release: "Release", lang_: "Language", notesN: "Notes", pushed: "Last push",
    ago2d: "2d ago", ago1: "1 day ago", ago3: "3 days ago", ago4: "4 days ago", ago5: "5 days ago",
    pushedTo: "Pushed to Bothy", relB: "Bothy v1.9.0", siteRel: "Site v1.0.0", fixture: "Merging does not ship. A tag does.",
    author: "Yehuda Briskman", role: "Full-stack engineer", site: "The site", bothy: "Bothy", windom: "WindoM", portfolio: "Portfolio site",
    states: { "in-use": "In use", oss: "Open source", live: "Live", archive: "Archive" },
    follow: "Follow along", followSub: "New notes and releases by email, only when there is something new.",
    subscribe: "Subscribe", details: "Details", stack: "Stack",
    p: [
      { s: "windom", t: "WindoM", f: "Every new tab becomes a dashboard", c: [24, 142, 167], st: "in-use", m: "React 19 · 2026", g: "tab" },
      { s: "bothy", t: "Bothy", f: "A console for one machine that asks Docker what is running", c: [58, 132, 104], st: "oss", m: "Docker Compose · 2026", g: "box" },
      { s: "site", t: "Portfolio site", f: "This site: a portfolio and notes in English and Hebrew", c: [35, 64, 107], st: "live", m: "React 19 · 2026", g: "layers" },
      { s: "oci", t: "oci-free", f: "The one free-tier ARM node this site runs on, written as code", c: [31, 138, 91], st: "oss", m: "Kubernetes · 2026", g: "code" },
      { s: "pwy", t: "Programming with Yehuda", f: "Lesson pages built while learning React and Node", c: [140, 87, 52], st: "archive", m: "React · 2025", g: "pen" },
      { s: "icaros", t: "Icaros", f: "A car-listing web app, built while learning React and Node", c: [176, 78, 46], st: "archive", m: "React · 2025", g: "car" },
    ],
    posts: [
      { t: "Merging does not ship. A tag does.", a: "The site", d: "28 Sept 2026", c: [35, 64, 107], g: "note" },
      { t: "There is no exec, and that is a deliberate regression", a: "Bothy", d: "21 Sept 2026", c: [58, 132, 104], g: "note" },
      { t: "The glass is computed optics rather than a stack of CSS tricks", a: "WindoM", d: "9 Sept 2026", c: [24, 142, 167], g: "note" },
      { t: "The page never waits for the API to paint", a: "The site", d: "30 Aug 2026", c: [35, 64, 107], g: "note" },
    ],
    areas: [
      { t: "The site", n: 7, c: [35, 64, 107], g: "layers", s: "This portfolio." },
      { t: "Bothy", n: 4, c: [58, 132, 104], g: "box", s: "The box's portal." },
      { t: "WindoM", n: 3, c: [24, 142, 167], g: "tab", s: "A dashboard for new tabs." },
    ],
    body: [
      "A merge to main puts code on the branch. It does not put it in front of anyone. That sounds like a technicality, and it is the whole safety story of this site.",
      ["h", "Why a tag"],
      "The site is built from a tag, never from a branch. A tag is a decision somebody made on purpose, with a name, on a day. A branch is just wherever the work happens to be.",
      ["q", "A tag builds nothing. It names a thing that already exists."],
      "So the order is: merge, look, tag, then ship. Each step can be stopped, and nothing later undoes a step before it.",
      ["h", "What it costs"],
      "One extra command, and a rule the whole team has to keep: nobody tags a build they have not read. In return a bad merge is an inconvenience, not an outage.",
      ["c", "git tag v1.7.1 && git push origin v1.7.1"],
      "That is the entire release. Everything else is checking.",
    ],
    tags: ["process", "releases"],
  },
  he: {
    dir: "rtl", lang: "he",
    work: "עבודות", notes: "הערות", pinned: "מוצמדים", all: "כל הפרויקטים", sortBy: "עודכנו לאחרונה", newest: "החדשים", name: "שם",
    wsub: "כל מה שבניתי, יחד עם ההחלטות שמאחוריו.",
    browse: "עיון לפי תחום", latest: "אחרונים באתר", seeLog: "יומן הערוץ המלא",
    search: "חיפוש בהערות", chipAll: "הכול", min: "2 דקות קריאה", note: "הערה", written: "נכתב",
    contents: "תוכן עניינים", textSize: "טקסט", share: "שיתוף", back: "חזרה",
    overview: "סקירה", releases: "גרסאות", docs: "תיעוד", decisions: "החלטות", links: "קישורים",
    repo: "פתיחת המאגר", repoMeta: "github.com/YehudaBriskman/Bothy", docMeta: "docs/README.md",
    stars: "כוכבים", forks: "פיצולים", release: "גרסה", lang_: "שפה", notesN: "הערות", pushed: "דחיפה אחרונה",
    ago2d: "לפני יומיים", ago1: "אתמול", ago3: "לפני 3 ימים", ago4: "לפני 4 ימים", ago5: "לפני 5 ימים",
    pushedTo: "נדחף אל Bothy", relB: "Bothy v1.9.0", siteRel: "האתר v1.0.0", fixture: "מיזוג לא משחרר. תג כן.",
    author: "יהודה בריסקמן", role: "מהנדס Full-stack", site: "האתר", bothy: "Bothy", windom: "WindoM", portfolio: "אתר תיק העבודות",
    states: { "in-use": "בשימוש", oss: "קוד פתוח", live: "פעיל", archive: "ארכיון" },
    follow: "להישאר מעודכן", followSub: "הערות וגרסאות חדשות במייל, רק כשיש משהו חדש.",
    subscribe: "הרשמה", details: "פרטים", stack: "טכנולוגיות",
    p: [
      { s: "windom", t: "WindoM", f: "כל לשונית חדשה הופכת ללוח בקרה", c: [24, 142, 167], st: "in-use", m: "React 19 · 2026", g: "tab" },
      { s: "bothy", t: "Bothy", f: "קונסולה למכונה אחת ששואלת את Docker מה רץ", c: [58, 132, 104], st: "oss", m: "Docker Compose · 2026", g: "box" },
      { s: "site", t: "אתר תיק העבודות", f: "האתר הזה: תיק עבודות והערות בעברית ובאנגלית", c: [35, 64, 107], st: "live", m: "React 19 · 2026", g: "layers" },
      { s: "oci", t: "oci-free", f: "שרת ה-ARM החינמי היחיד שהאתר רץ עליו, כתוב כקוד", c: [31, 138, 91], st: "oss", m: "Kubernetes · 2026", g: "code" },
      { s: "pwy", t: "תכנות עם יהודה", f: "דפי שיעור שנבנו תוך כדי לימוד React ו-Node", c: [140, 87, 52], st: "archive", m: "React · 2025", g: "pen" },
      { s: "icaros", t: "Icaros", f: "אפליקציית מודעות רכב, נבנתה בזמן לימוד React ו-Node", c: [176, 78, 46], st: "archive", m: "React · 2025", g: "car" },
    ],
    posts: [
      { t: "מיזוג לא משחרר. תג כן.", a: "האתר", d: "28 בספט׳ 2026", c: [35, 64, 107], g: "note" },
      { t: "אין exec, וזו נסיגה מכוונת", a: "Bothy", d: "21 בספט׳ 2026", c: [58, 132, 104], g: "note" },
      { t: "הזכוכית היא אופטיקה מחושבת, לא ערימת טריקי CSS", a: "WindoM", d: "9 בספט׳ 2026", c: [24, 142, 167], g: "note" },
      { t: "הדף אף פעם לא מחכה ל-API כדי להצטייר", a: "האתר", d: "30 באוג׳ 2026", c: [35, 64, 107], g: "note" },
    ],
    areas: [
      { t: "האתר", n: 7, c: [35, 64, 107], g: "layers", s: "תיק העבודות הזה." },
      { t: "Bothy", n: 4, c: [58, 132, 104], g: "box", s: "הפורטל של המכונה." },
      { t: "WindoM", n: 3, c: [24, 142, 167], g: "tab", s: "לוח בקרה ללשונית חדשה." },
    ],
    body: [
      "מיזוג ל-main מכניס קוד לענף. הוא לא מציג אותו לאף אחד. זה נשמע כמו פרט טכני, וזה כל סיפור הבטיחות של האתר הזה.",
      ["h", "למה תג"],
      "האתר נבנה מתג, אף פעם לא מענף. תג הוא החלטה שמישהו קיבל בכוונה, עם שם, ביום מסוים. ענף הוא סתם המקום שבו העבודה נמצאת כרגע.",
      ["q", "תג לא בונה כלום. הוא נותן שם למשהו שכבר קיים."],
      "אז הסדר הוא: מיזוג, בדיקה, תג, ואז שחרור. כל שלב אפשר לעצור, ושום דבר מאוחר לא מבטל שלב קודם.",
      ["h", "מה זה עולה"],
      "פקודה אחת נוספת, וכלל שכולם צריכים לשמור: אף אחד לא מתייג בנייה שלא קרא. בתמורה, מיזוג גרוע הוא אי־נעימות ולא השבתה.",
      ["c", "git tag v1.7.1 && git push origin v1.7.1"],
      "זה כל השחרור. כל השאר הוא בדיקה.",
    ],
    tags: ["תהליך", "גרסאות"],
  },
};

/* -------------------------------------------------------------------- css */
const FONTS = `
@font-face{font-family:'Audiowide';font-weight:400;font-display:swap;src:url('../../../../web/public/fonts/audiowide-400.woff2') format('woff2')}
@font-face{font-family:'Atkinson Hyperlegible Next';font-weight:400 700;font-display:swap;size-adjust:108.9%;src:url('../../../../web/public/fonts/atkinson-hyperlegible-next-400-700.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122}
@font-face{font-family:'Rubik Hebrew';font-weight:100 900;font-display:swap;src:url('../../../../web/public/fonts/rubik-700-hebrew.woff2') format('woff2');unicode-range:U+0307-0308,U+0590-05FF,U+20AA,U+25CC,U+FB1D-FB4F}
@font-face{font-family:'Heebo Hebrew';font-weight:400 700;font-display:swap;src:url('../../../../web/public/fonts/heebo-400-700-hebrew.woff2') format('woff2');unicode-range:U+0307-0308,U+0590-05FF,U+20AA,U+25CC,U+FB1D-FB4F}
`;

const BASE = `
:root{
  --paper:236 232 220;--paper-2:228 223 209;--paper-3:216 210 194;
  --ink:20 19 15;--soft:85 82 74;--faint:124 120 109;--rule:207 201 186;--firm:166 159 142;
  --signal:35 64 107;--signal-ink:255 255 255;--white:255 255 255;--shade:20 19 15;
  --tmix:rgb(var(--ink));--tmixp:35%;
  --wash-blue:228 238 250;--wash-green:225 245 236;--wash-purple:241 233 250;--wash-yellow:252 244 219;--wash-red:250 233 235;
  --r-sm:14px;--r-md:22px;--r-lg:32px;--r-pill:999px;
  --s1:4px;--s2:8px;--s3:12px;--s4:16px;--s6:24px;
  --d:'Audiowide','Rubik Hebrew',ui-sans-serif,system-ui,sans-serif;
  --t:'Atkinson Hyperlegible Next','Heebo Hebrew',ui-sans-serif,system-ui,sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  color-scheme:light;
}
:root[data-theme=dark]{
  --paper:28 26 22;--paper-2:40 37 32;--paper-3:52 48 42;
  --ink:242 240 234;--soft:168 164 154;--faint:124 120 109;--rule:62 58 51;--firm:118 113 104;
  --signal:122 162 232;--signal-ink:20 19 15;--white:255 255 255;--shade:0 0 0;
  --tmix:rgb(var(--white));--tmixp:38%;
  --wash-blue:24 38 52;--wash-green:24 50 35;--wash-purple:47 35 50;--wash-yellow:60 51 19;--wash-red:56 32 32;
  color-scheme:dark;
}
*{box-sizing:border-box;margin:0}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{width:390px;min-height:844px;background:var(--ground);color:rgb(var(--ink));font:400 16px/1.45 var(--t);display:flex;flex-direction:column;-webkit-font-smoothing:antialiased}
:lang(he) body{line-height:1.55}
a{color:inherit;text-decoration:none}
.i{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;flex:none}
[dir=rtl] .mir{transform:scaleX(-1)}
.num{font-variant-numeric:tabular-nums}
.ltr{direction:ltr;unicode-bidi:isolate}
/* soft circle, tinted by the work it labels */
.ic{--sz:40px;width:var(--sz);height:var(--sz);border-radius:50%;display:grid;place-items:center;flex:none;
  background:rgb(var(--t) / .17);color:color-mix(in srgb,rgb(var(--t)),var(--tmix) var(--tmixp))}
.ic .i{width:calc(var(--sz)*.5);height:calc(var(--sz)*.5)}
.ic.s32{--sz:32px}.ic.s56{--sz:56px}.ic.s72{--sz:72px}
.av{--sz:40px;width:var(--sz);height:var(--sz);border-radius:50%;background:rgb(var(--paper-3));color:rgb(var(--soft));display:grid;place-items:center;font:700 15px var(--t);flex:none;border:1px solid rgb(var(--rule))}
/* chips and pills: 32px tall, 44px hit area via ::after */
.chip{position:relative;display:inline-flex;align-items:center;gap:6px;height:32px;padding-inline:14px;border-radius:var(--r-pill);font-size:14px;font-weight:600;background:rgb(var(--paper-3) / .55);color:rgb(var(--soft));white-space:nowrap}
.chip::after{content:"";position:absolute;inset:-6px -2px}
.chip[aria-current]{background:rgb(var(--ink));color:rgb(var(--paper))}
.pill{display:inline-flex;align-items:center;gap:6px;height:24px;padding-inline:10px;border-radius:var(--r-pill);font-size:12.5px;font-weight:700;white-space:nowrap;background:rgb(var(--paper-3) / .6);color:rgb(var(--soft))}
.pill::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor;opacity:.9}
.pill.blue{background:rgb(var(--wash-blue));color:#0a58b0}.pill.purple{background:rgb(var(--wash-purple));color:#7a3fb5}.pill.green{background:rgb(var(--wash-green));color:#0a7a47}
:root[data-theme=dark] .pill.blue{color:#8bb8ff}:root[data-theme=dark] .pill.purple{color:#cfa3f5}:root[data-theme=dark] .pill.green{color:#6fd9a4}
.pill.plain::before{display:none}
.cnt{display:inline-grid;place-items:center;min-width:24px;height:24px;padding-inline:8px;border-radius:var(--r-pill);background:rgb(var(--paper-3) / .7);color:rgb(var(--soft));font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums}
/* rows */
.row{position:relative;display:flex;align-items:center;gap:var(--s3);min-height:64px;padding:12px var(--s4)}
.row+.row::before{content:"";position:absolute;inset-inline:68px 0;top:0;height:1px;background:rgb(var(--rule) / .8)}
.row .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.row b{font-weight:700;font-size:16px;line-height:1.3}
.row small{font-size:13.5px;color:rgb(var(--soft));line-height:1.35}
.row .tr{display:flex;align-items:center;gap:8px;color:rgb(var(--faint))}
.row .chev{width:18px;height:18px;color:rgb(var(--faint))}
.clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
/* grouped section */
.grp{padding-inline:var(--s4);margin-top:var(--s6)}
.gh{display:flex;align-items:center;justify-content:space-between;padding:0 var(--s2) var(--s2);font:700 14px var(--t);color:rgb(var(--soft))}
.gh a{font-weight:600;color:rgb(var(--signal));font-size:14px}
.card{background:var(--card);border-radius:var(--r-md);overflow:hidden}
/* bar */
.bar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;height:56px;padding-inline:var(--s3);background:var(--ground)}
.bar .t{font:700 16px var(--t);opacity:0;transition:none}
.bar.scrolled{box-shadow:0 1px 0 rgb(var(--rule))}.bar.scrolled .t{opacity:1}
.btn{width:44px;height:44px;display:grid;place-items:center;border-radius:50%;color:rgb(var(--ink))}
.btn span{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:rgb(var(--paper-3) / .6)}
.menu{display:inline-flex;align-items:center;gap:8px;height:36px;padding-inline:16px;border-radius:var(--r-pill);border:1px solid rgb(var(--firm));font:600 15px var(--t)}
.menu .i{width:18px;height:18px}
.hscroll{display:flex;gap:var(--s2);overflow:hidden;padding-inline:var(--s4);padding-block:6px}
.seg{display:flex;padding:4px;border-radius:var(--r-pill);background:rgb(var(--paper-3) / .6);margin-inline:var(--s4)}
.seg a{flex:1;display:grid;place-items:center;height:40px;border-radius:var(--r-pill);font-size:14.5px;font-weight:600;color:rgb(var(--soft))}
.seg a[aria-current]{background:var(--card-hi);color:rgb(var(--ink));box-shadow:0 1px 2px rgb(var(--shade) / .12),0 4px 10px -6px rgb(var(--shade) / .25);font-weight:700}
.field{display:flex;align-items:center;gap:10px;height:48px;padding-inline:16px;border-radius:var(--r-pill);background:var(--card);color:rgb(var(--soft));font-size:16px;border:1px solid rgb(var(--rule))}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:var(--s2);padding-inline:var(--s4)}
.stat{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:var(--r-md);background:var(--card)}
.stat .v{font:700 20px/1.1 var(--t);font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate;text-align:start;display:block}
.stat .l{font-size:12.5px;color:rgb(var(--soft));display:block;margin-top:2px}
.dock{position:sticky;bottom:0;z-index:5;margin-top:auto;padding:12px var(--s4) calc(12px + env(safe-area-inset-bottom))}
.foot{margin-top:var(--s6);padding:var(--s6) var(--s4) 40px;color:rgb(var(--faint));font-size:13px;text-align:center}
.cta{display:flex;align-items:center;justify-content:center;gap:10px;height:52px;border-radius:var(--r-pill);background:rgb(var(--signal));color:rgb(var(--signal-ink));font:700 16px var(--t)}
.pad{padding-inline:var(--s4)}
.ttl{font:400 34px/1.1 var(--d);letter-spacing:-.03em;padding-inline:var(--s4)}
:lang(he) .ttl{font-weight:700;letter-spacing:0}
.sub{padding-inline:var(--s4);margin-top:8px;color:rgb(var(--soft));font-size:16px}
.rd{padding-inline:22px;font-size:18px;line-height:1.72}
:lang(he) .rd{line-height:1.85}
.rd p{margin-top:1.05em}
.rd h2{font:700 21px/1.3 var(--t);margin-top:1.7em;letter-spacing:-.005em}
.rd .q{margin-top:1.4em;padding:16px 18px;border-radius:var(--r-md);background:rgb(var(--paper-3) / .45);font-size:19px;line-height:1.5;font-weight:600}
.rd pre{margin-top:1.3em;padding:14px 16px;border-radius:var(--r-md);background:rgb(var(--panel,12 12 14));color:#F2F0EA;font:14px/1.5 var(--mono);direction:ltr;text-align:left;overflow:hidden;white-space:pre-wrap}
`;

const DIR_A = `
body{--ground:rgb(var(--paper-2));--card:#F4F1E8;--card-hi:#FBF9F3}
:root[data-theme=dark] body{--ground:rgb(var(--paper));--card:rgb(var(--paper-2));--card-hi:rgb(var(--paper-3))}
.card{box-shadow:none}
.gh{text-transform:none}
.bar .t{font-size:17px}
.rd-card{margin:var(--s3) var(--s4) 0;padding:6px 20px 28px;background:var(--card);border-radius:var(--r-md);font-size:17.5px;line-height:1.7}
.rd-card p{margin-top:1em}.rd-card h2{font:700 20px/1.3 var(--t);margin-top:1.6em}
.rd-card .q{margin-top:1.2em;padding:14px 16px;border-radius:var(--r-sm);background:rgb(var(--paper-3) / .5);font-weight:600}
.rd-card pre{margin-top:1.2em;padding:12px 14px;border-radius:var(--r-sm);background:#0C0C0E;color:#F2F0EA;font:13.5px/1.5 var(--mono);direction:ltr;text-align:left;white-space:pre-wrap}
:lang(he) .rd-card{line-height:1.8}
.hdr{margin:0 var(--s4);padding:18px;background:var(--card);border-radius:var(--r-md)}
.tabbar{display:flex;gap:4px;padding:6px;border-radius:var(--r-pill);background:var(--card-hi);border:1px solid rgb(var(--rule));box-shadow:0 8px 20px -10px rgb(var(--shade) / .35)}
.tabbar a{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:44px;border-radius:var(--r-pill);font-size:14.5px;font-weight:700;color:rgb(var(--soft))}
`;

const DIR_B = `
body{--ground:rgb(var(--paper));--card:rgb(var(--paper-2) / .6);--card-hi:rgb(var(--paper-2))}
:root[data-theme=dark] body{--card:rgb(var(--paper-2) / .7)}
.ttl{font-size:36px;padding-inline:22px}.sub{padding-inline:22px}
.cover{height:132px;background:rgb(var(--t) / .2);display:grid;place-items:center}
.gal{display:grid;grid-template-columns:1fr 1fr;gap:22px 14px;padding-inline:22px}
.gcard{display:flex;flex-direction:column;gap:10px}
.gcard .cv{aspect-ratio:4/3;border-radius:var(--r-md);background:rgb(var(--t) / .2);display:grid;place-items:center;position:relative}
.gcard b{font:700 16px/1.3 var(--t)}
.gcard small{display:block;font-size:13.5px;color:rgb(var(--soft));line-height:1.35}
.sec{padding-inline:22px;margin-top:34px}
.sec.tog{padding-inline:22px}
.sec h2{font:700 13px var(--t);color:rgb(var(--faint));letter-spacing:.04em;padding-bottom:6px;border-bottom:1px solid rgb(var(--rule))}
:lang(he) .sec h2{letter-spacing:0}
.prop{display:flex;align-items:center;gap:12px;min-height:44px;font-size:15px;border-bottom:1px solid rgb(var(--rule) / .7)}
.prop .k{display:flex;align-items:center;gap:8px;width:116px;color:rgb(var(--faint));flex:none}
.prop .k .i{width:18px;height:18px}
.lrow{display:flex;gap:14px;align-items:flex-start;padding:14px 0;border-bottom:1px solid rgb(var(--rule) / .7)}
.lrow b{font:700 17px/1.3 var(--t);display:block}.lrow small{font-size:14px;color:rgb(var(--soft));display:block;margin-top:3px}
.tog summary{list-style:none;display:flex;align-items:center;gap:10px;min-height:48px;font-weight:700;font-size:16px;border-bottom:1px solid rgb(var(--rule) / .7)}
.tog summary::-webkit-details-marker{display:none}
.tog summary .i{width:16px;height:16px;transition:none}
.tog[open] summary .i{transform:rotate(90deg)}
.rd{padding-inline:26px}
.progress{position:sticky;top:0;z-index:6;height:3px;background:transparent}.progress i{display:block;height:3px;width:18%;background:rgb(var(--signal));border-start-end-radius:3px;border-end-end-radius:3px}
.aa{position:sticky;bottom:18px;margin-top:auto;align-self:flex-end;margin-inline-end:18px;width:52px;height:52px;border-radius:50%;background:rgb(var(--paper-2));border:1px solid rgb(var(--rule));display:grid;place-items:center;font:700 17px var(--t);box-shadow:0 8px 18px -10px rgb(var(--shade) / .4)}
.pagecrumb{padding:8px 22px 0;font-size:14px;color:rgb(var(--faint));display:flex;gap:8px;align-items:center}
`;

const DIR_C = `
body{--ground:rgb(var(--paper));--card:color-mix(in srgb,rgb(var(--paper)),#fff 38%);--card-hi:color-mix(in srgb,rgb(var(--paper)),#fff 70%)}
:root[data-theme=dark] body{--ground:rgb(var(--paper));--card:color-mix(in srgb,rgb(var(--paper)),rgb(var(--paper-2)) 62%);--card-hi:rgb(var(--paper-3))}
.card{border:1px solid rgb(var(--rule) / .75)}
.gh{padding-inline:6px;font-size:13.5px}
.ttl{font-size:32px}
.hdr{margin:0 var(--s4);padding:18px 18px 16px;background:var(--card);border-radius:var(--r-md);border:1px solid rgb(var(--rule) / .75)}
.gal{display:grid;grid-template-columns:1fr 1fr;gap:var(--s2);padding-inline:var(--s4)}
.gc{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:var(--r-md);background:linear-gradient(180deg,rgb(var(--t) / .15),rgb(var(--t) / .05) 62%),var(--card);border:1px solid rgb(var(--rule) / .75);min-height:158px}
.gc b{font:700 16px/1.25 var(--t)}.gc small{font-size:13px;color:rgb(var(--soft));line-height:1.35}
.pill.tintp{background:transparent;padding-inline:0}
.prop{display:flex;align-items:center;gap:12px;min-height:40px;font-size:15px}
.prop .k{display:flex;align-items:center;gap:8px;width:100px;color:rgb(var(--faint));flex:none}.prop .k .i{width:17px;height:17px}
.tog{border-top:1px solid rgb(var(--rule) / .75)}.tog summary{list-style:none;display:flex;align-items:center;gap:10px;min-height:48px;padding-inline:16px;font-weight:700;font-size:15.5px}
.tog summary::-webkit-details-marker{display:none}.tog summary .i{width:16px;height:16px}.tog[open] summary .i{transform:rotate(90deg)}
.floatbar{display:flex;gap:2px;padding:5px;border-radius:var(--r-pill);background:var(--card-hi);border:1px solid rgb(var(--rule));box-shadow:0 10px 22px -12px rgb(var(--shade) / .45)}
.floatbar a{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:44px;border-radius:var(--r-pill);font-size:14.5px;font-weight:700;color:rgb(var(--soft))}
.floatbar a.main{background:rgb(var(--signal));color:rgb(var(--signal-ink))}
.progress{position:sticky;top:56px;z-index:4;height:2px}.progress i{display:block;height:2px;width:18%;background:rgb(var(--signal))}
.rd{padding-inline:22px}
.tl{position:relative}
`;

/* ------------------------------------------------------------- fragments */
const tint = (c) => `--t:${c.join(" ")}`;
const circ = (it, cls = "") => `<span class="ic ${cls}" style="${tint(it.c)}">${svg(it.g)}</span>`;
const statePill = (L, st) => `<span class="pill ${{ "in-use": "blue", oss: "purple", live: "green", archive: "" }[st]}">${L.states[st]}</span>`;
const bar = (L, { title, scrolled = false, right = "share", left = "back" } = {}) => `
<header class="bar${scrolled ? " scrolled" : ""}">
  <a class="btn" href="#" aria-label="${L.back}"><span>${left === "menu" ? svg("menu") : svg("back", "mir")}</span></a>
  <span class="t">${title || ""}</span>
  ${right ? `<a class="btn" href="#" aria-label="${L.share}"><span>${svg(right === "share" ? "share" : right)}</span></a>` : `<span class="btn"></span>`}
</header>`;

const row = (it, L, { chev = true, trailing = "", meta, title, desc } = {}) => `
<a class="row" href="#">${circ(it)}<span class="tx"><b>${title ?? it.t}</b><small class="${desc ? "" : ""}">${meta ?? it.f ?? it.s ?? ""}</small></span><span class="tr">${trailing}${chev ? svg("chev", "chev mir") : ""}</span></a>`;

const projRow = (p, L) => `
<a class="row" href="#">${circ(p)}<span class="tx"><b>${p.t}</b><small class="clamp2">${p.f}</small><small style="display:flex;align-items:center;gap:8px;margin-top:4px;color:rgb(var(--faint))">${statePill(L, p.st)}<span class="ltr">${p.m}</span></small></span><span class="tr">${svg("chev", "chev mir")}</span></a>`;

const postRow = (p, L, thumb = true) => `
<a class="row" href="#"><span class="ic s56" style="${tint(p.c)}">${svg("note")}</span><span class="tx"><b class="clamp2">${p.t}</b><small>${p.a} · <span class="num">${p.d}</span></small></span>${svg("chev", "chev mir")}</a>`;

const sec = (title, inner, { right = "", count } = {}) => `
<section class="grp"><h2 class="gh"><span>${title}${count != null ? ` <span class="cnt">${count}</span>` : ""}</span>${right}</h2><div class="card">${inner}</div></section>`;

const foot = (L) => `<footer class="foot">© 2026 ${L.author}</footer>`;

const html = (L, theme, body, css, cls, title) => `<!doctype html>
<html lang="${L.lang}" dir="${L.dir}" data-theme="${theme}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${title}</title>
<style>${FONTS}${BASE}${css}</style></head>
<body class="${cls}">${body}</body></html>
`;

/* ========================================================== DIRECTION A */
const A = {
  projects: (L) => `
${bar(L, { title: L.work, right: null, left: "menu" })}
<h1 class="ttl">${L.work}</h1>
<p class="sub">${L.wsub}</p>
<div style="margin-top:16px"><nav class="seg" aria-label="${L.sortBy}"><a href="#" aria-current="true">${L.sortBy.split(" ")[0] === "Recently" ? "Updated" : L.sortBy}</a><a href="#">${L.newest}</a><a href="#">${L.name}</a></nav></div>
${sec(L.pinned, projRow(L.p[0], L) + projRow(L.p[1], L), { count: 2 })}
${sec(L.all, L.p.slice(2).map((p) => projRow(p, L)).join(""), { count: 4 })}
${sec(L.latest, [
    { t: L.fixture, f: `${L.site} · ${L.ago1}`, c: [35, 64, 107], g: "note" },
    { t: L.relB, f: `${L.bothy} · ${L.ago4}`, c: [58, 132, 104], g: "tag" },
    { t: L.pushedTo, f: `${L.bothy} · ${L.ago2d}`, c: [58, 132, 104], g: "push" },
  ].map((e) => row(e, L, { title: e.t, meta: e.f })).join(""), { right: `<a href="#">${L.seeLog}</a>` })}
${foot(L)}`,
  post: (L) => `
${bar(L, { title: L.notes })}
<div class="hdr" style="margin-top:4px">
  <div style="display:flex;gap:8px;margin-bottom:12px"><span class="pill blue plain">${L.note}</span><span class="pill plain">${L.site}</span></div>
  <h1 style="font:400 26px/1.15 var(--d);letter-spacing:-.02em" class="hd">${L.posts[0].t}</h1>
  <div style="display:flex;align-items:center;gap:12px;margin-top:16px"><span class="av">YB</span><span style="display:flex;flex-direction:column"><b style="font-size:15px">${L.author}</b><small style="color:rgb(var(--soft));font-size:13.5px"><span class="num">${L.posts[0].d}</span> · ${L.min}</small></span></div>
</div>
<article class="rd-card" style="margin-top:12px">${L.body.map((b) => typeof b === "string" ? `<p>${b}</p>` : b[0] === "h" ? `<h2>${b[1]}</h2>` : b[0] === "q" ? `<div class="q">${b[1]}</div>` : `<pre>${b[1]}</pre>`).join("")}</article>
<div class="grp" style="margin-top:12px"><div class="card" style="padding:14px 16px;display:flex;gap:8px;flex-wrap:wrap">${L.tags.map((t) => `<span class="chip"># ${t}</span>`).join("")}</div></div>
<div class="dock"><nav class="tabbar" aria-label="${L.contents}"><a href="#">${svg("list")} ${L.contents}</a><a href="#"><span style="font:700 17px var(--t)">Aa</span> ${L.textSize}</a><a href="#">${svg("share")} ${L.share}</a></nav></div>`,
};

/* ========================================================== DIRECTION B */
const B = {
  projects: (L) => `
${bar(L, { title: L.work, right: null, left: "menu" })}
<div style="padding:6px 22px 0"><span class="ic s56" style="--t:35 64 107">${svg("grid")}</span></div>
<h1 class="ttl" style="margin-top:14px">${L.work}</h1>
<p class="sub">${L.wsub}</p>
<section class="sec" style="margin-top:28px"><h2>${L.pinned}</h2></section>
<div class="gal" style="margin-top:16px">${L.p.slice(0, 2).map((p) => `<a class="gcard" href="#" style="${tint(p.c)}"><span class="cv"><span class="ic s56">${svg(p.g)}</span></span><span><b>${p.t}</b><small class="clamp2">${p.f}</small></span>${statePill(L, p.st)}</a>`).join("")}</div>
<section class="sec"><h2>${L.all} · <span class="num">4</span></h2>
${L.p.slice(2).map((p) => `<a class="lrow" href="#" style="${tint(p.c)}"><span class="ic">${svg(p.g)}</span><span style="flex:1"><b>${p.t}</b><small class="clamp2">${p.f}</small><small style="margin-top:8px">${statePill(L, p.st)}</small></span></a>`).join("")}</section>
<details class="sec tog" open style="margin-top:28px"><summary>${svg("chev", "mir")} ${L.latest}</summary>
${[[L.fixture, `${L.site} · ${L.ago1}`], [L.relB, `${L.bothy} · ${L.ago4}`], [L.pushedTo, `${L.bothy} · ${L.ago2d}`]].map(([t, m]) => `<div class="lrow"><span style="flex:1"><b style="font-size:16px">${t}</b><small>${m}</small></span></div>`).join("")}
</details>
${foot(L)}`,
  post: (L) => `
<div class="progress"><i></i></div>
<div class="cover" style="${tint(L.posts[0].c)}"><span class="ic s72">${svg("note")}</span></div>
<div class="pagecrumb"><span>${L.notes}</span><span>/</span><span>${L.site}</span></div>
<h1 style="font:400 30px/1.15 var(--d);letter-spacing:-.025em;padding:14px 26px 8px">${L.posts[0].t}</h1>
<div style="padding-inline:26px;margin-top:6px">
 <div class="prop"><span class="k">${svg("pen")} ${L.written}</span><span>${L.author}</span></div>
 <div class="prop"><span class="k">${svg("clock")} ${L.min.split(" ")[0] ? "" : ""}${L.lang === "en" ? "Date" : "תאריך"}</span><span class="num">${L.posts[0].d}</span></div>
 <div class="prop" style="border-bottom:1px solid rgb(var(--rule) / .7)"><span class="k">${svg("tag")} Tags</span><span style="display:flex;gap:6px;flex-wrap:wrap">${L.tags.map((t) => `<span class="pill plain">${t}</span>`).join("")}</span></div>
</div>
<article class="rd" style="margin-top:8px">${L.body.map((b) => typeof b === "string" ? `<p>${b}</p>` : b[0] === "h" ? `<h2>${b[1]}</h2>` : b[0] === "q" ? `<blockquote style="margin-top:1.3em;padding-inline-start:16px;border-inline-start:3px solid rgb(var(--signal));font-size:20px;line-height:1.5;font-weight:600">${b[1]}</blockquote>` : `<pre>${b[1]}</pre>`).join("")}</article>
<div style="height:40px"></div>
<a class="aa" href="#" aria-label="${L.textSize}">Aa</a>`,
};

/* ========================================================== DIRECTION C */
const C = {
  projects: (L, scrolled) => `
${bar(L, { title: L.work, right: "search", left: "menu", scrolled })}
<h1 class="ttl" style="margin-top:2px">${L.work}</h1>
<p class="sub">${L.wsub}</p>
<div class="hscroll" style="margin-top:10px"><span class="chip" aria-current="true">${L.chipAll} <span class="num">6</span></span><span class="chip">${L.states.live}</span><span class="chip">${L.states.oss}</span><span class="chip">${L.states["in-use"]}</span><span class="chip">${L.states.archive}</span></div>
<section class="grp" style="margin-top:14px"><h2 class="gh"><span>${L.pinned}</span></h2></section>
<div class="gal">${L.p.slice(0, 2).map((p) => `<a class="gc" href="#" style="${tint(p.c)}"><span class="ic">${svg(p.g)}</span><span style="flex:1"><b>${p.t}</b><small class="clamp2" style="display:-webkit-box;margin-top:4px">${p.f}</small></span>${statePill(L, p.st)}</a>`).join("")}</div>
${sec(L.all, L.p.slice(2).map((p) => projRow(p, L)).join(""), { count: 4 })}
${sec(L.latest, [
    { t: L.fixture, f: `${L.site} · ${L.ago1}`, c: [35, 64, 107], g: "note" },
    { t: L.relB, f: `${L.bothy} · ${L.ago4}`, c: [58, 132, 104], g: "tag" },
    { t: L.pushedTo, f: `${L.bothy} · ${L.ago2d}`, c: [58, 132, 104], g: "push" },
  ].map((e) => row(e, L, { title: e.t, meta: e.f })).join(""), { right: `<a href="#">${L.seeLog}</a>` })}
${foot(L)}`,
  post: (L, scrolled) => `
${bar(L, { title: L.posts[0].t.length > 26 ? L.notes : L.posts[0].t, scrolled })}
<div class="progress"><i></i></div>
<div class="pad" style="margin-top:2px;display:flex;gap:8px"><span class="pill blue plain">${L.note}</span><span class="pill plain">${L.site}</span></div>
<h1 style="font:400 29px/1.18 var(--d);letter-spacing:-.025em;padding:14px 22px 0" class="hd">${L.posts[0].t}</h1>
<div style="display:flex;align-items:center;gap:12px;padding:16px 22px 4px"><span class="av">YB</span><span style="display:flex;flex-direction:column"><b style="font-size:15px">${L.author}</b><small style="color:rgb(var(--soft));font-size:13.5px"><span class="num">${L.posts[0].d}</span> · ${L.min}</small></span></div>
<article class="rd">${L.body.map((b) => typeof b === "string" ? `<p>${b}</p>` : b[0] === "h" ? `<h2>${b[1]}</h2>` : b[0] === "q" ? `<div class="q">${b[1]}</div>` : `<pre>${b[1]}</pre>`).join("")}</article>
<div class="pad" style="margin-top:22px;display:flex;gap:8px;flex-wrap:wrap">${L.tags.map((t) => `<span class="chip"># ${t}</span>`).join("")}</div>
<div class="dock"><nav class="floatbar" aria-label="${L.contents}"><a href="#" class="main">${svg("list")} ${L.contents}</a><a href="#"><span style="font:700 17px var(--t)">Aa</span></a><a href="#">${svg("share")}</a></nav></div>`,
  project: (L, scrolled) => {
    const p = L.p[1];
    const stat = (g, v, l, c) => `<div class="stat" style="${tint(c)}"><span class="ic s32">${svg(g)}</span><span><span class="v">${v}</span><span class="l">${l}</span></span></div>`;
    return `
${bar(L, { title: p.t, scrolled })}
<div class="hdr" style="${tint(p.c)}">
  <div style="display:flex;gap:14px;align-items:center"><span class="ic s56">${svg(p.g)}</span><span style="display:flex;flex-direction:column;gap:6px;min-width:0"><b style="font:400 26px/1.1 var(--d);letter-spacing:-.02em">${p.t}</b><span style="display:flex;gap:6px">${statePill(L, p.st)}<span class="pill plain num">2026</span></span></span></div>
  <p style="margin-top:14px;font-size:16.5px;line-height:1.5">${p.f}</p>
</div>
<div class="stats" style="margin-top:8px">
${stat("star", "12", L.stars, [226, 160, 0])}${stat("fork", "3", L.forks, [162, 93, 220])}${stat("tag", "v1.9.0", L.release, [58, 132, 104])}${stat("code", "TypeScript", L.lang_, [0, 115, 234])}
</div>
<div style="margin-top:20px"><nav class="seg" aria-label="${L.overview}"><a href="#" aria-current="true">${L.overview}</a><a href="#">${L.notes}</a><a href="#">${L.releases}</a><a href="#">${L.docs}</a></nav></div>
${sec(L.decisions, [
      { t: L.lang === "en" ? "The security boundary is the Traefik rule" : "גבול האבטחה הוא כלל ה-Traefik", f: L.lang === "en" ? "Not the socket proxy's configuration" : "ולא הגדרות ה-socket proxy", c: [58, 132, 104], g: "layers" },
      { t: L.lang === "en" ? "There is no exec, on purpose" : "אין exec, בכוונה", f: L.lang === "en" ? "A deliberate regression" : "נסיגה מכוונת", c: [226, 68, 92], g: "code" },
      { t: L.lang === "en" ? "One function owns the walk" : "פונקציה אחת מחזיקה את הסריקה", f: L.lang === "en" ? "So the check is not a caller's job" : "כך שהבדיקה אינה באחריות הקורא", c: [162, 93, 220], g: "spark" },
    ].map((e) => row(e, L, { title: e.t, meta: e.f })).join(""), { count: 3 })}
${sec(L.notes, L.posts.slice(1, 3).map((q) => postRow(q, L)).join(""), { count: 4, right: `<a href="#">${L.lang === "en" ? "See all" : "הכול"}</a>` })}
<section class="grp"><div class="card" style="margin-top:0"><details class="tog" open style="border-top:0"><summary>${svg("chev", "mir")} ${L.stack}</summary><div style="display:flex;gap:8px;flex-wrap:wrap;padding:0 16px 16px"><span class="chip">React 19</span><span class="chip">Docker Compose</span><span class="chip">Traefik v3</span><span class="chip">Keycloak</span><span class="chip">Grafana</span></div></details></div></section>
${foot(L)}
<div class="dock"><a class="cta" href="#" style="${tint(p.c)}">${svg("out")} ${L.repo}</a></div>`;
  },
  blog: (L, scrolled) => `
${bar(L, { title: L.notes, right: null, left: "menu", scrolled })}
<h1 class="ttl" style="margin-top:2px">${L.notes}</h1>
<div class="pad" style="margin-top:14px"><div class="field">${svg("search")} <span>${L.search}</span></div></div>
<div class="hscroll" style="margin-top:8px"><span class="chip" aria-current="true">${L.chipAll}</span><span class="chip"># ${L.tags[0]}</span><span class="chip"># ${L.tags[1]}</span><span class="chip"># a11y</span></div>
${sec(L.browse, L.areas.map((a) => row(a, L, { title: a.t, meta: a.s, trailing: `<span class="cnt">${a.n}</span>` })).join(""), { right: `<a href="#">${L.lang === "en" ? "Log" : "יומן"}</a>` })}
${sec(L.latest.replace("site", "notes"), L.posts.map((q) => postRow(q, L)).join(""))}
<div class="pad" style="margin-top:22px"><div class="card hdr" style="margin:0;border-radius:var(--r-md);--t:35 64 107"><div style="display:flex;gap:12px;align-items:center"><span class="ic">${svg("spark")}</span><b style="font-size:17px">${L.follow}</b></div><p style="margin-top:8px;color:rgb(var(--soft));font-size:15px">${L.followSub}</p><div class="cta" style="margin-top:14px">${L.subscribe}</div></div></div>
${foot(L)}`,
  area: (L, scrolled) => {
    const a = L.areas[1];
    const stat = (g, v, l, c) => `<div class="stat" style="${tint(c)}"><span class="ic s32">${svg(g)}</span><span><span class="v">${v}</span><span class="l">${l}</span></span></div>`;
    const ev = [
      { t: L.pushedTo, f: L.ago2d, c: [58, 132, 104], g: "push" },
      { t: L.relB, f: L.ago4, c: [58, 132, 104], g: "tag" },
      { t: L.posts[1].t, f: L.ago5, c: [35, 64, 107], g: "note" },
      { t: L.siteRel, f: L.ago5, c: [162, 93, 220], g: "spark" },
    ];
    return `
${bar(L, { title: a.t, scrolled })}
<div class="hdr" style="${tint(a.c)}"><div style="display:flex;gap:14px;align-items:center"><span class="ic s56">${svg(a.g)}</span><span style="display:flex;flex-direction:column;gap:4px"><b style="font:400 26px/1.1 var(--d);letter-spacing:-.02em">${a.t}</b><span style="color:rgb(var(--soft));font-size:15px">${a.s}</span></span></div></div>
<div class="stats" style="margin-top:8px">
${stat("note", "4", L.notesN, [35, 64, 107])}${stat("tag", "5", L.releases, [58, 132, 104])}${stat("clock", L.ago2d.replace(/\\s/, " "), L.pushed, [0, 115, 234])}${stat("star", "12", L.stars, [226, 160, 0])}
</div>
${sec(L.latest, ev.map((e) => row(e, L, { title: e.t, meta: e.f })).join(""), { right: `<a href="#">${L.seeLog}</a>` })}
${sec(L.notes, L.posts.slice(1, 3).map((q) => postRow(q, L)).join(""), { count: 4 })}
${foot(L)}`;
  },
};

/* ------------------------------------------------------------------ emit */
const DIRS = { a: [A, DIR_A, "A"], b: [B, DIR_B, "B"], c: [C, DIR_C, "C"] };
const files = [];
for (const [k, [mod, css, cls]] of Object.entries(DIRS)) {
  for (const [screen, fn] of Object.entries(mod)) {
    for (const lang of ["en", "he"]) for (const theme of ["light", "dark"]) {
      const L = T[lang];
      const name = `${k}-${screen}.${lang}.${theme}.html`;
      writeFileSync(`${OUT}/${name}`, html(L, theme, fn(L, false), css, cls, `Direction ${cls.toUpperCase()} · ${screen} · ${lang} · ${theme}`));
      files.push(name);
      if (k === "c" && ["projects", "post", "project"].includes(screen)) {
        const n2 = `${k}-${screen}-scrolled.${lang}.${theme}.html`;
        writeFileSync(`${OUT}/${n2}`, html(L, theme, fn(L, true), css, cls, `Direction C · ${screen} scrolled · ${lang} · ${theme}`));
        files.push(n2);
      }
    }
  }
}
console.log(files.length, "files");
