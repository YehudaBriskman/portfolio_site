#!/usr/bin/env node
/*
 * The server-render half of the audit: what a crawler, a link preview and a
 * reader before hydration get for each /he page from /api/seo/render/he/*,
 * plus the Hebrew-relevant feeds. Every Latin run in the head, in JSON-LD and
 * in the pre-rendered body, with whether it sits inside lang="en".
 *
 *   BASE=http://127.0.0.1:15173 OUT=/tmp/audit node scripts/i18n-audit/seo.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:15173";
const OUT = process.env.OUT ?? "i18n-audit-out";
mkdirSync(OUT, { recursive: true });
const api = async (p) => (await fetch(BASE + p)).json();

const projects = (await api("/api/content")).projects.items.map((p) => p.slug);
const areas = (await api("/api/areas")).items.map((a) => a.slug);
const notes = (await api("/api/blog/posts")).items.map((p) => p.slug).filter((s) => !s.startsWith("fixture-"));
const routes = ["", "/blog", "/projects", "/story", "/accessibility", "/developers/mcp", "/blog/log",
  ...areas.map((s) => `/blog/area/${s}`), ...notes.map((s) => `/blog/${s}`), ...projects.map((s) => `/projects/${s}`)];

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const records = [];
for (const r of routes) {
  const res = await fetch(`${BASE}/api/seo/render/he${r}`);
  const html = await res.text();
  const route = `/he${r}`;
  const add = (kind, text, marked) => {
    if (text && /[A-Za-z]/.test(text)) records.push({ route, kind, text: decode(text).trim().slice(0, 400), marked_en: marked, status: res.status });
  };
  const htmlTag = /<html[^>]*>/.exec(html)?.[0] ?? "";
  records.push({ route, kind: "html", text: htmlTag, status: res.status });
  add("head:title", /<title>([\s\S]*?)<\/title>/.exec(html)?.[1], false);
  for (const m of html.matchAll(/<meta\s+(?:name|property)="([^"]+)"\s+content="([^"]*)"/g)) {
    if (/description|title|og:|twitter:/.test(m[1]) && !/image|url|type|card|site_name/.test(m[1])) add(`head:${m[1]}`, m[2], false);
    if (m[1] === "og:site_name" || m[1] === "og:locale") add(`head:${m[1]}`, m[2], false);
  }
  for (const m of html.matchAll(/<link[^>]+hreflang="([^"]+)"[^>]*>/g)) records.push({ route, kind: `head:hreflang-${m[1]}`, text: m[0], status: res.status });
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const walk = (o, p) => {
        if (typeof o === "string") { if (!/^https?:|^\d{4}-|^[\w.-]+@/.test(o) && !["@context", "@type", "@id"].includes(p.split(".").at(-1))) add(`jsonld:${p}`, o, false); }
        else if (Array.isArray(o)) o.forEach((v, i) => walk(v, `${p}[${i}]`));
        else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k);
      };
      walk(JSON.parse(m[1]), "");
    } catch {}
  }
  // The pre-rendered body: text between tags, with whether a lang="en" ancestor wraps it.
  const body = /<div id="root"[^>]*>([\s\S]*?)<\/div>\s*(?:<script|<\/body)/.exec(html)?.[1] ?? /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
  const stack = [];
  for (const m of body.matchAll(/<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g)) {
    if (m[4] !== undefined) {
      const t = m[4].replace(/\s+/g, " ").trim();
      if (t && /[A-Za-z]/.test(t) && !stack.some((s) => s.tag === "script" || s.tag === "style")) add("body", t, stack.some((s) => s.en));
    } else if (m[1]) {
      const i = stack.map((s) => s.tag).lastIndexOf(m[2].toLowerCase());
      if (i >= 0) stack.length = i;
    } else if (!/\/$/.test(m[3]) && !["img", "br", "meta", "link", "input", "hr", "source"].includes(m[2].toLowerCase())) {
      stack.push({ tag: m[2].toLowerCase(), en: /\blang="en"/.test(m[3]) });
      for (const a of m[3].matchAll(/(aria-label|title|alt)="([^"]*)"/g)) add(`body-attr:${a[1]}`, a[2], /\blang="en"/.test(m[3]) || stack.some((s) => s.en));
    } else {
      for (const a of m[3].matchAll(/(aria-label|title|alt)="([^"]*)"/g)) add(`body-attr:${a[1]}`, a[2], stack.some((s) => s.en));
    }
  }
}
// Feeds a Hebrew reader is offered.
for (const f of ["/api/seo/feed.xml", "/api/seo/feed/log.xml", ...areas.map((a) => `/api/seo/feed/${a}.xml`), "/api/seo/he/feed.xml"]) {
  const res = await fetch(BASE + f);
  const xml = await res.text();
  records.push({ route: f, kind: "feed:status", text: `${res.status} ${/<language>([^<]*)/.exec(xml)?.[1] ?? "no <language>"}` });
  const t = /<channel>[\s\S]*?<title>([\s\S]*?)<\/title>/.exec(xml)?.[1];
  if (t) records.push({ route: f, kind: "feed:channel-title", text: decode(t) });
}
writeFileSync(resolve(OUT, "seo.json"), JSON.stringify(records, null, 1));
console.log(`seo records ${records.length}`);
