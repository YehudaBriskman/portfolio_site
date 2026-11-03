#!/usr/bin/env node
/*
 * Writes docs/i18n/english-on-hebrew-audit.json and the findings tables for
 * the audit doc from: the classified crawl (classify.mjs), the server-render
 * records (seo.mjs), the static pass (a JSON array of S-rows) and a hand
 * review (overrides: per-id or per-pattern treatment/source/note changes).
 *
 *   node scripts/i18n-audit/report.mjs <findings.json> <seo.json> <static.json> <overrides.json> <out.json> <tables.md>
 */
import { readFileSync, writeFileSync } from "node:fs";

const [FIND, SEO, STATIC, OVR, OUTJSON, OUTMD] = process.argv.slice(2);
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
let findings = read(FIND);
const seo = read(SEO);
const stat = read(STATIC);
const ovr = read(OVR);

/* Hand review: rules are applied in order; the last match wins. */
for (const f of findings) {
  for (const r of ovr.rules) {
    const re = r.text ? new RegExp(r.text, r.flags ?? "") : null;
    if ((r.id && r.id === f.id) || (re && re.test(f.text)) || (r.origin && f.origin && new RegExp(r.origin).test(f.origin)) || (r.route && f.routes.every((x) => new RegExp(r.route).test(x)))) {
      if (r.kind && !new RegExp(r.kind).test(f.kind)) continue;
      Object.assign(f, r.set);
    }
  }
}
findings = findings.filter((f) => !f.drop);

/* A note's body is one finding per note, not one per paragraph. */
const bodies = new Map();
const rest = [];
for (const f of findings) {
  /* The string may have been found first in the admin list, so key by the
     note page it was seen on. */
  const page = f.routes.find((r) => /^\/he\/blog\/(?!area\/|log$)[\w-]+$/.test(r));
  const m = ((f.origin && /(post|items\[\d+\])\.body/.test(f.origin)) || (f.source === "unknown" && f.route_count === 1)) && f.audience === "public" && page ? [null, page.slice("/he/blog/".length)] : null;
  if (m && f.kind === "text") {
    const b = bodies.get(m[1]) ?? { slug: m[1], n: 0, marked: new Set(), first: f.text, fixture: m[1].startsWith("fixture-"), routes: new Set(), bidi: new Set() };
    b.n++;
    b.marked.add(String(f.marked_en));
    f.routes.forEach((r) => b.routes.add(r));
    if (f.bidi !== "none") b.bidi.add(f.bidi);
    bodies.set(m[1], b);
  } else rest.push(f);
}
let k = 0;
for (const b of bodies.values()) {
  rest.push({
    id: `DB${String(++k).padStart(2, "0")}`,
    text: `Note body (${b.n} English blocks): "${b.first.slice(0, 80)}…"`,
    kind: "text",
    source: "content-store",
    origin: `/api/blog/posts/${b.slug} post.body`,
    routes: [`/he/blog/${b.slug}`],
    route_count: 1,
    audience: "public",
    marked_en: b.marked.size === 1 ? [...b.marked][0] === "true" : "mixed",
    bidi: [...b.bidi][0] ?? "none",
    treatment: "translate",
    note: b.fixture ? "dev fixture, not real content" : "needs he.body (the field exists; empty for every note)",
    visible: true,
  });
}
findings = rest;

/* Server render: one row per distinct (kind, text), the routes listed. */
const seoRows = new Map();
for (const r of seo) {
  if (!r.text || r.kind === "html" || r.kind.startsWith("head:hreflang") || /og:locale|og:site_name|jsonld:.*inLanguage|addressCountry/.test(r.kind)) continue;
  if (!/[A-Za-z]/.test(r.text) || /127\.0\.0\.1|localhost/.test(r.text)) continue;
  const key = `${r.kind.replace(/^(body-attr|body).*/, "$1")}|${r.text}`;
  const x = seoRows.get(key) ?? { kind: r.kind, text: r.text, routes: new Set(), marked_en: r.marked_en };
  x.routes.add(r.route);
  seoRows.set(key, x);
}
const seoFindings = [...seoRows.values()]
  .filter((x) => !(x.kind === "body" && x.marked_en === true))
  .map((x, i) => {
    const latinOnly = /^[A-Za-z0-9 .:/@_-]+$/.test(x.text) && /^(Yehuda Briskman|RSS|GitHub|WindoM|Bothy|Icaros|MCP)$|https?:|claude /.test(x.text);
    return {
      id: `R${String(i + 1).padStart(3, "0")}`,
      text: x.text.slice(0, 200),
      kind: `server-render ${x.kind}`,
      source: "seo",
      routes: [...x.routes],
      route_count: x.routes.size,
      audience: [...x.routes].some((r) => r.includes("developers")) ? "developers" : "public",
      marked_en: x.kind.startsWith("head") || x.kind.startsWith("jsonld") || x.kind.startsWith("feed") ? "n/a" : x.marked_en,
      treatment: latinOnly || /Yehuda Briskman/.test(x.text) && !/[a-z]{3,}.*·/.test(x.text.replace("Yehuda Briskman", "")) ? "keep-latin" : /^head:|^jsonld/.test(x.kind) ? "needs-he-field" : "translate",
    };
  });

const all = [...findings, ...seoFindings];
const tally = (rows, key) => rows.reduce((m, f) => ((m[f[key]] = (m[f[key]] ?? 0) + 1), m), {});
const cross = (rows) => {
  const t = {};
  for (const f of rows) {
    t[f.source] ??= {};
    t[f.source][f.treatment] = (t[f.source][f.treatment] ?? 0) + 1;
  }
  return t;
};
const out = {
  generated: new Date().toISOString(),
  commit: ovr.commit,
  method: ovr.method,
  counts: {
    dynamic: {
      findings: all.length,
      by_source: tally(all, "source"),
      by_treatment: tally(all, "treatment"),
      by_marked: tally(all, "marked_en"),
      by_audience: tally(all, "audience"),
      source_x_treatment: cross(all),
    },
    static: { findings: stat.length, by_source: tally(stat, "source"), by_treatment: tally(stat, "treatment"), by_audience: tally(stat, "audience") },
  },
  findings: all.map(({ sel, runs, states, ...f }) => ({ ...f, states })),
  static_findings: stat,
};
writeFileSync(OUTJSON, JSON.stringify(out, null, 1) + "\n");

/* Backslash first, so the escapes added after it are not themselves escaped. */
const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " ").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const routes = (f) => (f.route_count > 3 ? `${f.route_count} routes (${f.routes.slice(0, 2).join(", ")}, …)` : f.routes.join(", "));
const order = { "ui-table": 0, "hard-coded": 1, "api-error": 2, settings: 3, "content-store": 4, github: 5, format: 6, seo: 7, "admin-data": 8, unknown: 9 };
const sorted = (rows) => [...rows].sort((a, b) => (a.audience === b.audience ? (order[a.source] ?? 9) - (order[b.source] ?? 9) || b.route_count - a.route_count : a.audience.localeCompare(b.audience) * -1));
let md = "";
for (const aud of ["public", "developers", "admin"]) {
  const rows = sorted(all.filter((f) => f.audience === aud));
  md += `\n### ${aud[0].toUpperCase() + aud.slice(1)} (${rows.length})\n\n| ID | Text | Where | Source | Routes | Marked | Treatment | Bidi / note |\n|---|---|---|---|---|---|---|---|\n`;
  for (const f of rows) {
    md += `| ${f.id} | ${esc(f.text.slice(0, 140))}${f.text.length > 140 ? "…" : ""} | ${esc(f.kind)}${f.states && f.states.some((s) => s !== "page" && s !== "head") ? ` (${esc(f.states.filter((s) => s !== "page" && s !== "head").slice(0, 2).join(", "))})` : ""} | ${f.source} | ${esc(routes(f))} | ${f.marked_en} | ${f.treatment} | ${esc([f.bidi && f.bidi !== "none" ? f.bidi : "", f.note ?? ""].filter(Boolean).join("; "))} |\n`;
  }
}
writeFileSync(OUTMD, md);
console.log(JSON.stringify(out.counts.dynamic, null, 1));
