#!/usr/bin/env node
/*
 * A compact schema.org vocabulary, for checking JSON-LD offline (#308).
 *
 *   node scripts/seo/vocab.mjs <schemaorg-current-https.jsonld> > out.json
 *
 * The input is schema.org's own release file
 * (https://schema.org/version/latest/schemaorg-current-https.jsonld). The
 * output keeps only what a validity check needs: each type's parents, and
 * each property's domains (the types it may appear on, `domainIncludes`).
 * `--only A,B,C` keeps the named types, their ancestors and the properties
 * whose domain is one of them, which is what the backend's test fixture
 * holds: a few kilobytes instead of a megabyte and a half.
 */
import { readFileSync } from "node:fs";

const [file, flag, only] = process.argv.slice(2);
if (!file) {
  console.error("usage: vocab.mjs <schemaorg.jsonld> [--only Type,Type]");
  process.exit(2);
}

const graph = JSON.parse(readFileSync(file, "utf8"))["@graph"];
const id = (x) => String(x?.["@id"] ?? x).replace(/^schema:/, "");
const list = (x) => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
const types = {};
const props = {};

for (const node of graph) {
  const kinds = list(node["@type"]);
  if (kinds.includes("rdfs:Class")) {
    types[id(node)] = list(node["rdfs:subClassOf"]).map(id).filter((p) => !p.includes(":"));
  }
  if (kinds.includes("rdf:Property")) {
    props[id(node)] = list(node["schema:domainIncludes"]).map(id);
  }
}

let out = { types, props };
if (flag === "--only" && only) {
  const keep = new Set();
  const climb = (t) => {
    if (keep.has(t) || !types[t]) return;
    keep.add(t);
    for (const p of types[t]) climb(p);
  };
  for (const t of only.split(",")) climb(t.trim());
  out = {
    types: Object.fromEntries([...keep].sort().map((t) => [t, types[t]])),
    props: Object.fromEntries(
      Object.entries(props)
        .filter(([, d]) => d.some((t) => keep.has(t)))
        .map(([p, d]) => [p, d.filter((t) => keep.has(t))])
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
}
process.stdout.write(`${JSON.stringify(out)}\n`);
