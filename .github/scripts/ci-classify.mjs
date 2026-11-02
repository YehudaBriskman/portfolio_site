#!/usr/bin/env node
// Which CI jobs does this change need? (#203)
//
//   node ci-classify.mjs        (in a checkout with history; reads env, below)
//
// The answer is a selection of the jobs in ci.yml, written to $GITHUB_OUTPUT
// and read by their `if:`s and by the CI gate (ci-gate.mjs). The rules live
// here, in one table with tests, rather than as path filters scattered over
// the workflow.
//
// What changed, and from where:
//   - pull_request: `git diff` from the merge-base of base and head, to head.
//     Local git, never the API's changed-file list: that list is paginated and
//     capped, and a truncated list reads exactly like a small change.
//   - push: before..after. An all-zero `before` (a new branch or tag), a force
//     push, a `before` this clone does not have, or any git error selects
//     everything.
//   - anything else (workflow_dispatch, ...): everything.
// A rename or a copy counts both paths, a deletion its old path.
//
// What a path selects:
//   - web/**      -> web (Frontend, Scan image web)
//   - backend/**  -> backend (Backend, Scan image api)
//   - docs/**, root *.md -> docs, which selects nothing beyond Static
//   - widening paths -> everything: workflows and CI scripts, lockfiles and
//     package manifests, Dockerfiles and .dockerignore, nginx config, Compose,
//     the Makefile, tsconfig and eslint config, the Trivy ignore file
//   - any path no rule names -> everything. A new top-level file is a reason
//     to add a rule, not a reason to skip a check.
// Static runs on every change, docs-only included.
//
// Release refs select everything. Publish image and Deploy run on main and
// v* tags, and Deploy sets BOTH images to this commit's sha, so a main push
// that touched only the api must still build web. Narrowing there waits for
// digest reuse (#205); until then only pull requests are narrowed. The diff
// is still computed and reported on a release ref, so the step summary shows
// what it would have selected.

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ZERO_SHA = /^0+$/;

// First match wins. `widen` means the path selects every component.
const RULES = [
  // CI itself: a change here can change what any job does.
  { re: /^\.github\//, widen: true, why: "CI configuration" },
  // Build and runtime inputs that are not source.
  { re: /(^|\/)package(-lock)?\.json$/, widen: true, why: "dependency manifest or lockfile" },
  { re: /(^|\/)(bun\.lockb|yarn\.lock|pnpm-lock\.yaml|npm-shrinkwrap\.json)$/, widen: true, why: "lockfile" },
  { re: /(^|\/)Dockerfile[^/]*$|(^|\/)\.dockerignore$/, widen: true, why: "Docker build" },
  { re: /^web\/[^/]*\.conf(\.template)?$/, widen: true, why: "nginx configuration" },
  { re: /^docker-compose[^/]*\.ya?ml$|^compose[^/]*\.ya?ml$/, widen: true, why: "Compose" },
  { re: /^Makefile$/, widen: true, why: "Makefile" },
  { re: /(^|\/)tsconfig[^/]*\.json$/, widen: true, why: "TypeScript configuration" },
  { re: /(^|\/)(eslint\.config\.[cm]?[jt]s|\.eslintrc[^/]*)$/, widen: true, why: "eslint configuration" },
  { re: /^\.trivyignore(\.ya?ml)?$/, widen: true, why: "image scan policy" },
  // Components.
  { re: /^web\//, component: "web" },
  { re: /^backend\//, component: "backend" },
  { re: /^docs\//, component: "docs" },
  { re: /^[^/]+\.md$/, component: "docs" },
];

export const JOBS = ["static", "frontend", "backend", "scan", "images", "deploy"];

export function classifyPath(path) {
  for (const r of RULES) {
    if (r.re.test(path)) return r.widen ? { widen: true, why: r.why } : { component: r.component };
  }
  return { widen: true, why: "no rule names this path" };
}

// `git diff --name-status -z` output to paths. Records are NUL-separated:
// status, then one path, or two for a rename (R) or copy (C).
export function parseNameStatus(out) {
  const parts = out.split("\0");
  if (parts.at(-1) === "") parts.pop();
  const paths = [];
  for (let i = 0; i < parts.length; ) {
    const status = parts[i++];
    if (!/^[ACDMRTUXB]\d*$/.test(status)) throw new Error(`unparseable diff status ${JSON.stringify(status)}`);
    const n = /^[RC]/.test(status) ? 2 : 1;
    if (i + n > parts.length) throw new Error(`diff record ${JSON.stringify(status)} is missing its path`);
    for (let k = 0; k < n; k++) paths.push(parts[i++]);
  }
  return paths;
}

export const isReleaseRef = (ref) => ref === "refs/heads/main" || (ref ?? "").startsWith("refs/tags/v");

// Which commits to compare, or why to compare none and select everything.
export function planDiff(ctx) {
  const { event } = ctx;
  if (event === "pull_request") {
    if (!ctx.baseSha || !ctx.headSha) return { full: "pull request without base or head sha" };
    return { base: ctx.baseSha, head: ctx.headSha, mergeBase: true };
  }
  if (event === "push") {
    if (!ctx.before || !ctx.after) return { full: "push without before or after sha" };
    if (ZERO_SHA.test(ctx.before)) return { full: "push with no previous commit (new branch or tag)" };
    if (String(ctx.forced) === "true") return { full: "force push" };
    return { base: ctx.before, head: ctx.after, mergeBase: false };
  }
  return { full: `${event || "unknown"} event` };
}

// The selection, from a list of changed paths (or a reason there is none).
export function classify({ paths, full, release }) {
  const changed = { web: false, backend: false, static: true, docs: false };
  const reasons = [];
  if (full) reasons.push(full);
  else if (!paths || paths.length === 0) reasons.push("diff lists no changed paths");
  else {
    for (const p of paths) {
      const c = classifyPath(p);
      if (c.widen) reasons.push(`${p}: ${c.why}`);
      else changed[c.component] = true;
    }
  }
  const all = reasons.length > 0;
  if (all) changed.web = changed.backend = true;
  // Narrowing on a pull request only; see the header.
  const web = changed.web || release;
  const backend = changed.backend || release;
  if (release && !all) reasons.push("release ref: Publish image and Deploy need both images (#205)");
  const scan = [];
  if (web) scan.push({ image: "web", context: "web" });
  if (backend) scan.push({ image: "api", context: "backend" });
  return {
    components: { web, backend, static: true, docs: changed.docs },
    changed,
    jobs: {
      static: true,
      frontend: web,
      backend,
      scan: scan.length > 0,
      images: release,
      deploy: release,
    },
    scanMatrix: scan,
    full: all,
    reasons,
  };
}

// The whole step, with git injected so the tests can make it fail.
export function run(env, git) {
  const ctx = {
    event: env.EVENT_NAME,
    ref: env.REF,
    before: env.BEFORE,
    after: env.AFTER,
    forced: env.FORCED,
    baseSha: env.BASE_SHA,
    headSha: env.HEAD_SHA,
  };
  const release = isReleaseRef(ctx.ref);
  const plan = planDiff(ctx);
  if (plan.full) return { ...classify({ full: plan.full, release }), plan };
  let paths;
  try {
    for (const sha of [plan.base, plan.head]) git(["cat-file", "-e", `${sha}^{commit}`]);
    const from = plan.mergeBase ? git(["merge-base", plan.base, plan.head]).trim() : plan.base;
    paths = parseNameStatus(git(["diff", "--name-status", "-z", "-M", from, plan.head]));
    plan.from = from;
  } catch (e) {
    const msg = String(e?.message ?? e).split("\n")[0];
    return { ...classify({ full: `could not diff ${plan.base}..${plan.head}: ${msg}`, release }), plan };
  }
  return { ...classify({ paths, release }), plan, paths };
}

export function outputs(r) {
  return {
    ok: "true",
    web: String(r.components.web),
    backend: String(r.components.backend),
    docs: String(r.components.docs),
    full: String(r.full),
    jobs: JSON.stringify(r.jobs),
    scan_matrix: JSON.stringify(r.scanMatrix),
  };
}

function summary(r) {
  const lines = ["### Change classification", ""];
  lines.push(`| Job | Selected |`, `|---|---|`);
  for (const j of JOBS) lines.push(`| ${j} | ${r.jobs[j] ? "yes" : "no"} |`);
  lines.push("");
  if (r.plan?.from) lines.push(`Diff: \`${r.plan.from}..${r.plan.head}\`, ${r.paths.length} path(s).`, "");
  if (r.reasons.length) {
    lines.push("Everything selected because:", "");
    for (const x of r.reasons.slice(0, 50)) lines.push(`- ${x}`);
    if (r.reasons.length > 50) lines.push(`- ... and ${r.reasons.length - 50} more`);
  } else {
    const c = Object.entries(r.changed).filter(([k, v]) => v && k !== "static").map(([k]) => k);
    lines.push(`Changed components: ${c.join(", ") || "none"}.`);
  }
  return lines.join("\n") + "\n";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const git = (args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 });
  const r = run(process.env, git);
  const out = outputs(r);
  const text = Object.entries(out).map(([k, v]) => `${k}=${v}\n`).join("");
  process.stdout.write(text);
  for (const x of r.reasons) console.log(`  ${x}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary(r));
}
