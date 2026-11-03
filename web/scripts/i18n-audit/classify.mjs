#!/usr/bin/env node
/*
 * Folds the crawl's raw records into findings: one row per distinct Latin
 * string per kind (text, an attribute, the head), with every route and state
 * it was seen in, whether it was marked English, where it comes from, and a
 * first-pass treatment. The doc's table is this output after a hand review
 * (overrides in overrides.json beside the output).
 *
 *   node scripts/i18n-audit/classify.mjs <runs-dir> <out.json>
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const [RUNS, OUTFILE] = process.argv.slice(2);
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/* ------------------------------------------------------------- the inputs */
const records = [];
const api = {};
for (const d of readdirSync(RUNS)) {
  const p = join(RUNS, d);
  if (!statSync(p).isDirectory() || !existsSync(join(p, "records.json"))) continue;
  records.push(...JSON.parse(readFileSync(join(p, "records.json"), "utf8")));
  Object.assign(api, JSON.parse(readFileSync(join(p, "api.json"), "utf8")));
}

/* Every string the API served, with the endpoint and JSON path it came from. */
const apiStrings = [];
const walk = (o, ep, path) => {
  if (typeof o === "string") {
    if (/[A-Za-z]/.test(o)) apiStrings.push({ s: o, ep, path });
  } else if (Array.isArray(o)) o.forEach((v, i) => walk(v, ep, `${path}[${i}]`));
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, ep, path ? `${path}.${k}` : k);
};
for (const [ep, body] of Object.entries(api)) walk(body, ep, "");

/* Every source file the web build reads, for string literals. */
const srcFiles = [];
const collect = (dir) => {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) {
      if (!/__tests__|node_modules|\/test$/.test(f)) collect(f);
    } else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n)) { const t = readFileSync(f, "utf8"); srcFiles.push({ f: relative(REPO, f), t, low: t.toLowerCase() }); };
  }
};
collect(join(REPO, "web/src"));
collect(join(REPO, "backend/src"));
const isTable = (f) => /(\/i18n\/|words\.ts$|historyWords\.ts$|dashboard\/i18n\.ts$|seo-words\.ts$)/.test(f);

/* --------------------------------------------------------------- helpers */
const norm = (s) => String(s).replace(/[‎‏⁦-⁩]/g, "").replace(/\s+/g, " ").trim();
const LATIN_RUN = /[A-Za-z][A-Za-z0-9.'’&+#/@_:-]*(?:[ ,]+[A-Za-z0-9][A-Za-z0-9.'’&+#/@_:-]*)*/g;
const MONTH = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b|\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/;

function sourceOf(text) {
  /* innerText carries CSS text-transform, so labels set in capitals arrive
     upper-cased: match without case. */
  const t = norm(text).toLowerCase();
  const lc = (x) => norm(x).toLowerCase();
  // 1. The API, exact, then containment either way (markdown splits a body into nodes).
  let hit = apiStrings.find((a) => lc(a.s) === t);
  if (!hit && t.length >= 12) hit = apiStrings.find((a) => lc(a.s).includes(t));
  if (!hit && t.length >= 6) hit = apiStrings.find((a) => a.s.length >= 6 && t.includes(lc(a.s)) && /[A-Za-z]{3}/.test(a.s));
  if (hit) return { kind: "api", ep: hit.ep, path: hit.path };
  // 2. A string literal in the source.
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`["'\`>]\\s*${esc}\\s*["'\`<]`, "i");
  for (const { f, t: body } of srcFiles) {
    const m = re.exec(body);
    if (m) return { kind: "src", file: `${f}:${body.slice(0, m.index).split("\n").length}` };
  }
  if (t.length >= 8) {
    for (const { f, t: body, low } of srcFiles) {
      const i = low.indexOf(t);
      if (i >= 0) return { kind: "src", file: `${f}:${body.slice(0, i).split("\n").length}`, partial: true };
    }
  }
  return { kind: "unknown" };
}

function classifySource(src, rec) {
  if (rec.kind.startsWith("head:")) return "seo";
  if (src.kind === "api") {
    const { ep, path } = src;
    if (ep.startsWith("/api/github")) return "github";
    if (ep === "/api/activity") return /release|push|site/.test(path) ? "github" : "content-store";
    if (ep === "/api/areas" && /stats|docs|repo/.test(path)) return "github";
    if (ep === "/api/settings" || ep.startsWith("/api/admin/settings")) return "settings";
    if (/^\/api\/admin\/(tokens|audit|mcp|me)/.test(ep)) return "admin-data";
    return "content-store";
  }
  if (src.kind === "src") {
    if (/backend\/src\/(routes|controllers|services|middlewares|schemas)/.test(src.file) && !/seo/.test(src.file)) return "api-error";
    if (/web\/src\/data\//.test(src.file) || /content\/seed\.ts/.test(src.file)) return "content-store";
    return isTable(src.file.split(":")[0]) ? "ui-table" : "hard-coded";
  }
  if (MONTH.test(rec.text)) return "format";
  return "unknown";
}

/* Latin that is the same in both languages: names, marks, code. Seeded from
   the glossary's category A; anything else in a run makes it a candidate. */
const GLOSSARY = process.env.GLOSSARY ?? join(REPO, "docs/i18n/glossary.json");
const glossary = existsSync(GLOSSARY) ? JSON.parse(readFileSync(GLOSSARY, "utf8")) : null;
const KEEP = new Set(
  [
    ...(glossary?.allowLatin ?? []),
    "Yehuda", "Briskman", "Yehuda Briskman", "GitHub", "LinkedIn", "WindoM", "Bothy", "Icaros", "MCP", "RSS", "API", "Claude", "Claude Code",
    "claude.ai", "Claude Desktop", "React", "TypeScript", "JavaScript", "Node", "Node.js", "Vite", "Docker", "Kubernetes", "Postgres", "PostgreSQL",
    "CouchDB", "Express", "Fastify", "Chrome", "Gmail", "WCAG", "AA", "OAuth", "JSON", "URL", "HTTP", "HTTPS", "CI", "PR", "SSO", "Tel Aviv",
  ].map((s) => s.toLowerCase()),
);
const looksLikeCode = (t) =>
  /^(https?:\/\/|www\.|\/[\w./-]*$|[\w.-]+@[\w.-]+$|v?\d+(\.\d+)+\S*$|[\w-]+\.(com|app|io|dev|org|md|json|ts|tsx|xml|txt)\b|#[\w-]+$|[a-z0-9]+(-[a-z0-9]+)+$|`)/.test(t) ||
  /^(npm|npx|node|claude|docker|git|curl|xh) /.test(t);

function treatmentOf(rec, source, src) {
  const t = norm(rec.latin ?? rec.text);
  if (rec.kind.startsWith("head:hreflang")) return "keep-latin";
  if (rec.code || looksLikeCode(t)) return "keep-latin";
  const runs = (t.replace(/[\u0590-\u05FF\u05BE]+/g, " ").match(LATIN_RUN) ?? []).map((r) => r.replace(/[ ,.:]+$/, ""));
  const allKept = runs.length > 0 && runs.every((r) => KEEP.has(r.toLowerCase()) || looksLikeCode(r) || /^[A-Z0-9]{2,6}$/.test(r) || r.split(/\s+/).every((w) => KEEP.has(w.toLowerCase())));
  if (allKept) return "keep-latin";
  if (source === "format") return "locale-format";
  if (source === "github") return "keep-latin";
  if (source === "content-store") {
    const p = src.path ?? "";
    if (/\.en$/.test(p) || /(^|\.)(title|subtitle|excerpt|body|tagline|description)$/.test(p)) return "translate";
    return "needs-he-field";
  }
  if (source === "settings") return "needs-he-field";
  return "translate";
}

/* ------------------------------------------------------------ the folding */
const findings = new Map();
for (const r of records) {
  if (!r.text || !/[A-Za-z]/.test(r.text)) continue;
  if (r.kind.startsWith("head:") && /^head:(og:locale|og:type|og:image|twitter:card|og:url)/.test(r.kind)) continue;
  const key = `${r.kind.startsWith("head:") ? "head" : r.kind}|${norm(r.text)}`;
  let f = findings.get(key);
  if (!f) {
    f = { key, kind: r.kind, text: norm(r.text), latin: norm(r.latin ?? r.text), routes: new Set(), runs: new Set(), states: new Set(), marked: new Set(), visible: false, ariaHiddenOnly: true, code: false, sel: new Set(), audience: "public", lang: new Set(), dir: new Set() };
    findings.set(key, f);
  }
  f.routes.add(r.route);
  f.runs.add(r.run);
  f.states.add(r.state.startsWith("open:") ? `open:${r.state.slice(5, 40)}` : r.state);
  const marked = r.kind.startsWith("head:") ? "n/a" : r.marked ?? String(String(r.lang ?? "").startsWith("en") && r.direction === "ltr");
  f.marked.add(marked);
  if (r.lang) f.lang.add(r.lang);
  if (r.direction) f.dir.add(r.direction);
  if (r.visible) f.visible = true;
  if (!r.ariaHidden) f.ariaHiddenOnly = false;
  if (r.code) f.code = true;
  if (f.sel.size < 3 && r.sel) f.sel.add(r.sel);
  if (/\/admin/.test(r.route)) f.audience = "admin";
  else if (/developers/.test(r.route) && f.audience !== "admin") f.audience = f.audience === "public" && f.routes.size > 1 ? "public" : "developers";
}

const out = [];
let n = 0;
for (const f of findings.values()) {
  const src = sourceOf(/[\u0590-\u05FF]/.test(f.text) ? f.latin : f.text);
  const source = classifySource(src, f);
  const marked = f.marked.has("n/a") ? "n/a" : f.marked.has("true") && f.marked.has("false") ? "mixed" : f.marked.has("true");
  // A mixed Hebrew + Latin string inside a Hebrew element is a bidi risk unless the Latin is isolated.
  const hasHebrew = /[֐-׿]/.test(f.text);
  const bidi =
    hasHebrew && /[A-Za-z]/.test(f.text) && f.kind.startsWith("attr")
      ? "mixed run in an attribute (cannot be isolated with markup)"
      : hasHebrew && /[A-Za-z0-9]["'”)\]:]?$/.test(f.text)
        ? "Latin/number at the end of an RTL run (punctuation may mirror)"
        : !hasHebrew && f.dir.has("rtl") && marked !== true && /[A-Za-z].*[.:;!?)]$|^\(|\d/.test(f.text)
          ? "Latin with punctuation/digits laid out RTL (unmarked): ends may flip"
          : "none";
  const treatment = treatmentOf(f, source, src);
  out.push({
    id: `D${String(++n).padStart(4, "0")}`,
    text: f.text,
    kind: f.kind,
    source,
    origin: src.kind === "api" ? `${src.ep} ${src.path}` : src.file ?? null,
    routes: [...f.routes].sort(),
    route_count: f.routes.size,
    audience: f.audience,
    states: [...f.states],
    runs: [...f.runs],
    marked_en: marked,
    visible: f.visible,
    aria_hidden_only: f.ariaHiddenOnly,
    in_code: f.code,
    bidi,
    treatment,
    sel: [...f.sel],
  });
}
out.sort((a, b) => (a.audience === b.audience ? b.route_count - a.route_count : a.audience === "public" ? -1 : 1));
writeFileSync(OUTFILE, JSON.stringify(out, null, 1));
const count = (k) => out.reduce((m, f) => ((m[f[k]] = (m[f[k]] ?? 0) + 1), m), {});
console.log("findings", out.length);
console.log("source", count("source"));
console.log("treatment", count("treatment"));
console.log("marked", count("marked_en"));
console.log("audience", count("audience"));
