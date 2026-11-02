#!/usr/bin/env node
// Which open Dependabot PRs does a newly opened one supersede? (#201)
//
//   node supersede-select.mjs <new-pr.json> <open-prs.json>
//
// Each PR is { number, headRefName, title, body, labels } as `gh pr ... --json`
// prints it. Prints the numbers to close, one per line.
//
// Rules:
//   - Only lower-numbered PRs in the same ecosystem (`dependabot/<eco>/...`).
//   - A version-update PR closes, as before: the newer PR rebuilt the group.
//   - A security-update PR closes ONLY when the new PR is proven to bump every
//     dependency it bumps, in the same directory, to the same or a higher
//     version. Anything unparseable or incomparable stays open.
//
// What counts as a security update. Dependabot's security PRs carry no marker
// of their own: no label unless one is configured (none is), and a body that
// reads like a version update's. So a PR is treated as security when ANY of:
//   - a label mentions "security";
//   - title or body mentions security, a vulnerability, a GHSA id or a CVE id
//     (a security PR's footer offers to disable "automated security fix PRs");
//   - it is not a group PR. dependabot.yml groups every dependency of every
//     ecosystem, so a version update from the current config is always a group
//     PR. A single-dependency PR is a security update (they open outside the
//     groups) or a leftover from an older config, and either way it is closed
//     only once the new PR provably contains it.
// When in doubt it is security, and it stays open.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SECURITY_TEXT = /security|vulnerab|\bGHSA(?:-[0-9a-z]{4}){3}\b|\bCVE-\d{4}-\d{4,}\b/i;
const GROUP_TITLE = /\bbump the \S+ group\b|\bin the \S+ group\b/i;
const GROUP_HEADER = /^Bumps the \S+ group\b(.*?):(.*)$/;

export function ecosystem(headRefName) {
  const m = /^dependabot\/([^/]+)\//.exec(headRefName ?? "");
  return m ? m[1] : null;
}

export function isGroup(pr) {
  return GROUP_TITLE.test(pr.title ?? "") || /^Bumps the \S+ group\b/m.test(pr.body ?? "");
}

export function isSecurity(pr) {
  const labels = (pr.labels ?? []).map((l) => (typeof l === "string" ? l : (l?.name ?? "")));
  if (labels.some((l) => /security/i.test(l))) return true;
  if (SECURITY_TEXT.test(pr.title ?? "") || SECURITY_TEXT.test(pr.body ?? "")) return true;
  return !isGroup(pr);
}

const clean = (s) => s.replace(/^`|`$/g, "").replace(/[.,]$/, "");
const normDir = (d) => (d ? d.replace(/\/+$/, "") || "/" : null);

// Every update a PR makes, as { name, to, dir }. `dir` is null when the text
// does not say which directory that particular update is in.
export function parseUpdates(pr) {
  const out = [];
  const title = (pr.title ?? "").trim();
  const lines = (pr.body ?? "").replace(/\r\n/g, "\n").split("\n");

  // "Updates `X` from A to B": in single and group bodies alike, but not tied
  // to a directory when a group spans several.
  const tosByName = new Map();
  for (const line of lines) {
    const m = /^Updates `([^`]+)` from (\S+) to (\S+?)\.?$/.exec(line.trim());
    if (!m) continue;
    const to = clean(m[3]);
    out.push({ name: m[1], to, dir: null });
    if (!tosByName.has(m[1])) tosByName.set(m[1], []);
    tosByName.get(m[1]).push(to);
  }

  // Group headers, each attributing names to a directory:
  //   Bumps the G group with 1 update in the /backend directory: [x](..).
  //   Bumps the G group with 12 updates in the /web directory:   (table follows)
  //   Bumps the G group in /web with 10 updates:                 (table follows)
  //   Bumps the G group with 1 update: [x](..).                  (repo root)
  for (let i = 0; i < lines.length; i++) {
    const h = GROUP_HEADER.exec(lines[i].trim());
    if (!h) continue;
    const dm = /\bin (?:the )?(\/\S*?)(?: directory)?(?:\s|$)/.exec(h[1]);
    const dir = normDir(dm ? dm[1] : "/");
    const inline = h[2].trim();
    if (inline) {
      let names = [...inline.matchAll(/\[([^\]]+)\]\([^)]*\)/g)].map((m) => m[1]);
      if (names.length === 0) names = inline.split(/,\s*|\s+and\s+/).map(clean).filter(Boolean);
      for (const name of names) {
        // The version is only in the "Updates" lines: take the lowest, so a
        // claim of coverage is never inflated by another directory's bump.
        const to = minVersion(tosByName.get(name) ?? []);
        if (to) out.push({ name, to, dir });
      }
      continue;
    }
    for (let j = i + 1; j < lines.length; j++) {
      const row = lines[j].trim();
      if (row === "" && j === i + 1) continue;
      if (!row.startsWith("|")) break;
      const cells = row.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.length < 3 || /^-+$/.test(cells[0]) || /^package$/i.test(cells[0])) continue;
      const name = (/^\[([^\]]+)\]/.exec(cells[0]) ?? [null, cells[0]])[1];
      out.push({ name: clean(name), to: clean(cells[2]), dir });
    }
  }

  // Single-dependency title: "...bump X from A to B[ in /dir]". Its directory
  // is the repo root when the title names none.
  const t = /\bbump (\S+) from (\S+) to (\S+?)(?: in (\/\S*))?$/i.exec(title);
  if (t) out.push({ name: t[1], to: t[3], dir: normDir(t[4] ?? "/") });

  return out;
}

// Dotted numeric versions with an optional suffix that must match exactly
// ("24-alpine" vs "26-alpine"). Returns -1, 0 or 1, or null if incomparable.
export function compareVersions(a, b) {
  const re = /^v?(\d+(?:\.\d+)*)(.*)$/;
  const pa = re.exec(a ?? "");
  const pb = re.exec(b ?? "");
  if (!pa || !pb || pa[2] !== pb[2]) return null;
  const na = pa[1].split(".").map(Number);
  const nb = pb[1].split(".").map(Number);
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const d = (na[i] ?? 0) - (nb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

function minVersion(versions) {
  let min = null;
  for (const v of versions) {
    if (min === null) {
      min = v;
      continue;
    }
    const c = compareVersions(v, min);
    if (c === null) return null;
    if (c < 0) min = v;
  }
  return min;
}

// Does `newPr` bump every dependency `oldPr` bumps, in the same directory, to
// the same or a higher version? False whenever `oldPr` cannot be parsed.
export function covers(newPr, oldPr) {
  const need = parseUpdates(oldPr);
  if (need.length === 0) return false;
  const have = parseUpdates(newPr);
  return need.every((n) =>
    have.some(
      (h) =>
        h.name === n.name &&
        (n.dir === null || h.dir === n.dir) &&
        (compareVersions(h.to, n.to) ?? -1) >= 0,
    ),
  );
}

export function selectToClose(newPr, openPrs) {
  const eco = ecosystem(newPr.headRefName);
  if (!eco) return [];
  return openPrs
    .filter((pr) => pr.number < newPr.number && ecosystem(pr.headRefName) === eco)
    .filter((pr) => !isSecurity(pr) || covers(newPr, pr))
    .map((pr) => pr.number)
    .sort((x, y) => x - y);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [newPath, openPath] = process.argv.slice(2);
  if (!newPath || !openPath) {
    console.error("usage: supersede-select.mjs <new-pr.json> <open-prs.json>");
    process.exit(2);
  }
  const newPr = JSON.parse(readFileSync(newPath, "utf8"));
  const openPrs = JSON.parse(readFileSync(openPath, "utf8"));
  for (const n of selectToClose(newPr, openPrs)) console.log(n);
}
