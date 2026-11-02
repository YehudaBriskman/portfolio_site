#!/usr/bin/env node
// Every accepted scanner finding stays a decision somebody owns (#206).
//
//   yq -o=json .trivyignore.yaml | node .github/scripts/exceptions-check.mjs
//
// .trivyignore.yaml is read by every Trivy scan CI runs (Scan image, Promote
// release, the scheduled rescan). Trivy itself only enforces `expired_at`,
// and only by starting to fail again on that date, which is the worst moment
// to find out an entry had no reason and nobody to ask. So Static checks each
// entry, in every section Trivy reads, for:
//
//   - `id`: one finding, never a wildcard. An exception that matches more
//     than the finding it was written for is how a scan goes quietly blind.
//   - `statement`: why it cannot be fixed now, or why it is unreachable here.
//   - `owner`: who decides again when it expires (a GitHub login).
//   - `expired_at`: a date after today and at most three months ahead (92
//     days), so an expired entry fails here, in review, before it fails a
//     release, and none is accepted for longer than a quarter.
//
// An entry expiring within 14 days is a warning, not a failure.
// Prints one annotation per problem and exits 1 on any.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SECTIONS = ["vulnerabilities", "misconfigurations", "secrets", "licenses"];
const MAX_DAYS = 92;
const WARN_DAYS = 14;
const DAY = 86_400_000;

const isText = (v) => typeof v === "string" && v.trim().length > 0;

// `today` is a "YYYY-MM-DD" string in UTC: Trivy stops honouring an entry
// from the first instant of its `expired_at` date.
export function check(doc, today) {
  const problems = [];
  const warnings = [];
  const t = Date.parse(`${today}T00:00:00Z`);
  if (doc === null || doc === undefined) return { problems, warnings };
  if (typeof doc !== "object" || Array.isArray(doc)) {
    return { problems: ["the file is not a mapping of sections"], warnings };
  }
  for (const key of Object.keys(doc)) {
    if (!SECTIONS.includes(key)) problems.push(`unknown section \`${key}\` (Trivy reads ${SECTIONS.join(", ")})`);
  }
  for (const section of SECTIONS) {
    const entries = doc[section];
    if (entries === undefined || entries === null) continue;
    if (!Array.isArray(entries)) {
      problems.push(`\`${section}\` is not a list`);
      continue;
    }
    entries.forEach((e, i) => {
      const name = `${section}[${i}]${isText(e?.id) ? ` ${e.id}` : ""}`;
      if (!e || typeof e !== "object") return problems.push(`${name}: not a mapping`);
      if (!isText(e.id)) problems.push(`${name}: no \`id\``);
      else if (/[*?]/.test(e.id)) problems.push(`${name}: \`id\` is a wildcard; name the one finding`);
      if (!isText(e.statement)) problems.push(`${name}: no \`statement\` saying why it is accepted`);
      if (!isText(e.owner)) problems.push(`${name}: no \`owner\` to decide again when it expires`);
      const raw = e.expired_at;
      if (raw === undefined || raw === null || raw === "") {
        problems.push(`${name}: no \`expired_at\``);
        return;
      }
      const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(raw));
      const d = m ? Date.parse(`${m[1]}T00:00:00Z`) : NaN;
      if (Number.isNaN(d)) {
        problems.push(`${name}: \`expired_at\` ${JSON.stringify(raw)} is not a date`);
        return;
      }
      const days = Math.round((d - t) / DAY);
      if (days <= 0) problems.push(`${name}: expired on ${m[1]}; fix it, or decide again with a new reason and date`);
      else if (days > MAX_DAYS) problems.push(`${name}: expires ${m[1]}, ${days} days ahead; the most is ${MAX_DAYS}`);
      else if (days <= WARN_DAYS) warnings.push(`${name}: expires ${m[1]}, in ${days} day(s)`);
    });
  }
  return { problems, warnings };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const file = process.argv[2] ?? ".trivyignore.yaml";
  const text = readFileSync(0, "utf8").trim();
  const doc = text === "" ? null : JSON.parse(text);
  const today = process.env.TODAY ?? new Date().toISOString().slice(0, 10);
  const { problems, warnings } = check(doc, today);
  for (const w of warnings) console.log(`::warning file=${file},title=Exception expiring soon::${w}`);
  for (const p of problems) console.log(`::error file=${file},title=Scanner exception::${p}`);
  const n = SECTIONS.reduce((s, k) => s + (Array.isArray(doc?.[k]) ? doc[k].length : 0), 0);
  console.log(`${n} exception(s) checked against ${today}: ${problems.length} problem(s), ${warnings.length} expiring soon`);
  process.exit(problems.length ? 1 : 0);
}
