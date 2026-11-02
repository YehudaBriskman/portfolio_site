#!/usr/bin/env node
// The one required check that does not move (#203).
//
//   NEEDS='${{ toJSON(needs) }}' node ci-gate.mjs
//
// Jobs that classification can skip cannot be required checks: a skipped job
// reports under a different name, or as skipped, and a ruleset waiting for it
// either blocks forever or reads the skip as a pass. So the ruleset requires
// `CI gate`, and this decides it from every job the gate needs:
//
//   - classification itself must have succeeded and said what it selected;
//     a failed classification is a failure, never "nothing was selected";
//   - a selected job must have succeeded;
//   - an unselected job may be skipped (or have run and succeeded);
//   - failure, cancellation, or a skip classification did not ask for fails;
//   - a job the gate needs that classification says nothing about, or the
//     reverse, fails: the gate and the selection must name the same jobs.
//
// Prints one line per job and exits 1 on any problem.

import { pathToFileURL } from "node:url";

export function gate(needs) {
  const problems = [];
  const lines = [];
  const cls = needs?.classify;
  if (!cls) return { ok: false, lines, problems: ["the gate does not need `classify`"] };
  if (cls.result !== "success") problems.push(`classify: ${cls.result}`);
  let jobs = null;
  try {
    if (cls.outputs?.ok !== "true") throw new Error("no ok=true output");
    jobs = JSON.parse(cls.outputs.jobs);
    if (!jobs || typeof jobs !== "object" || Array.isArray(jobs)) throw new Error("jobs is not an object");
  } catch (e) {
    problems.push(`classify produced no usable selection (${e.message})`);
    jobs = null;
  }
  if (!jobs) return { ok: false, lines, problems };

  const names = Object.keys(needs).filter((n) => n !== "classify");
  for (const name of names) {
    const result = needs[name]?.result;
    if (!(name in jobs)) {
      problems.push(`${name}: the gate needs it but classification does not select or unselect it`);
      continue;
    }
    const selected = jobs[name] === true;
    if (jobs[name] !== true && jobs[name] !== false) problems.push(`${name}: selection is ${JSON.stringify(jobs[name])}`);
    lines.push(`${name}: ${selected ? "selected" : "not selected"}, ${result}`);
    if (result === "success") continue;
    if (result === "skipped" && !selected) continue;
    if (result === "skipped") problems.push(`${name}: selected but skipped`);
    else problems.push(`${name}: ${result}`);
  }
  for (const name of Object.keys(jobs)) {
    if (!names.includes(name)) problems.push(`${name}: classification selects it but the gate does not need it`);
  }
  return { ok: problems.length === 0, lines, problems };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  let needs;
  try {
    needs = JSON.parse(process.env.NEEDS ?? "");
  } catch {
    console.log("::error::NEEDS is not JSON");
    process.exit(1);
  }
  const r = gate(needs);
  for (const l of r.lines) console.log(l);
  for (const p of r.problems) console.log(`::error::${p}`);
  console.log(r.ok ? "CI gate: pass" : "CI gate: FAIL");
  process.exit(r.ok ? 0 : 1);
}
