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
//   - web/**      -> web (Frontend, Browser checks, Scan image web)
//   - backend/**  -> backend (Backend, Scan image api)
//   - mcp/**      -> mcp (MCP server: tests, typecheck, build; no image, #252)
//   - web/src, web/public, web/scripts additionally select the public phone
//     matrix (#764), a pull-request job of its own
//   - docs/**, root *.md, LICENSE* -> docs, which selects nothing beyond Static
//   - widening paths -> everything: workflows and CI scripts, lockfiles and
//     package manifests, Dockerfiles and .dockerignore, nginx config, Compose,
//     the Makefile, tsconfig and eslint config, the Trivy ignore file
//   - .github/*.md and .github/ISSUE_TEMPLATE/** -> docs: the community
//     files and the pull request and issue templates. GitHub renders them;
//     no job, script or build reads them. The rest of .github/ widens.
//   - any path no rule names -> everything. A new top-level file is a reason
//     to add a rule, not a reason to skip a check.
// Static runs on every change, docs-only included.
//
// The mode, from the event and the ref (#205):
//   - pr       a pull request: narrowed as above; publishes and deploys nothing.
//   - main     main (push or manual): everything. Publish image, Release
//              manifest and Deploy (preprod) run, and Deploy sets BOTH images
//              from the manifest, so a main push that touched only the api
//              must still build web. Reusing an unchanged component's digest
//              would need a dependency-aware proof that its effective inputs
//              are identical; #205 left that out, so main builds both.
//   - promote  a v* tag: builds NOTHING. Static, then Promote release (the
//              manifest main CI recorded for the tag's commit, re-scanned),
//              then Deploy (prod). Frontend, Backend, Scan and Publish image
//              are not selected: their evidence is main's run for that commit.
//   - rebuild  a manual run on a v* tag with `rebuild: true`: the one way to
//              release a commit main never recorded. Everything main runs,
//              then Promote release on the manifest THIS run wrote.
//   - other    a manual run on any other branch: everything, publishes nothing.
// The diff is still computed and reported on a release ref, so the step
// summary shows what it would have selected.
//
// `sha` is the commit this run is about, resolved ONCE here: for a tag, the
// commit the tag points to (an annotated tag is peeled); otherwise the
// event's sha. Every later job reads it from here.

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ZERO_SHA = /^0+$/;

// The paths that select the public phone matrix on a pull request (#764).
export const PUBLIC_MATRIX_INPUTS = /^web\/(src|public|scripts)\//;

// First match wins. `widen` means the path selects every component.
const RULES = [
  // Prose GitHub renders and nothing in CI reads (see the header).
  { re: /^\.github\/([^/]+\.md|ISSUE_TEMPLATE\/.+)$/, component: "docs" },
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
  { re: /^\.gitleaksignore$/, widen: true, why: "secret scan policy" },
  // Components.
  { re: /^web\//, component: "web" },
  { re: /^backend\//, component: "backend" },
  { re: /^mcp\//, component: "mcp" },
  { re: /^docs\//, component: "docs" },
  { re: /^[^/]+\.md$/, component: "docs" },
  { re: /^LICENSE(-[A-Z]+)?$/, component: "docs" },
];

export const JOBS = ["static", "frontend", "browser", "public-matrix", "backend", "mcp", "scan", "images", "release", "promote", "deploy"];

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

export function releaseMode({ event, ref, rebuild }) {
  if (event === "pull_request") return "pr";
  if (ref === "refs/heads/main") return "main";
  if ((ref ?? "").startsWith("refs/tags/v")) {
    return event === "workflow_dispatch" && String(rebuild) === "true" ? "rebuild" : "promote";
  }
  return "other";
}

const SHA = /^[0-9a-f]{40}$/;

// The commit this run is about. A tag is peeled to its commit by git, once;
// anything git cannot answer is an error, never a guess.
export function resolveSha(ctx, mode, git) {
  if (mode === "promote" || mode === "rebuild") {
    let sha;
    try {
      sha = git(["rev-parse", "--verify", "--quiet", `${ctx.ref}^{commit}`]).trim();
    } catch (e) {
      throw new Error(`cannot resolve ${ctx.ref} to a commit: ${String(e?.message ?? e).split("\n")[0]}`);
    }
    if (!SHA.test(sha)) throw new Error(`${ctx.ref} resolved to ${JSON.stringify(sha)}, not a commit sha`);
    return sha;
  }
  if (!SHA.test(ctx.sha ?? "")) throw new Error(`no commit sha for this event (${JSON.stringify(ctx.sha)})`);
  return ctx.sha;
}

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
// `release: true` is shorthand for mode "main".
export function classify({ paths, full, release, mode }) {
  mode ??= release ? "main" : "pr";
  const changed = { web: false, backend: false, mcp: false, static: true, docs: false };
  // What the public phone matrix reads: the app's source, its static assets
  // and the scripts that measure it (#764). A web/ change elsewhere (a
  // Dockerfile, the nginx template) cannot move a measurement.
  let publicWeb = false;
  const reasons = [];
  if (full) reasons.push(full);
  else if (!paths || paths.length === 0) reasons.push("diff lists no changed paths");
  else {
    for (const p of paths) {
      const c = classifyPath(p);
      if (c.widen) reasons.push(`${p}: ${c.why}`);
      else changed[c.component] = true;
      if (PUBLIC_MATRIX_INPUTS.test(p)) publicWeb = true;
    }
  }
  const all = reasons.length > 0;
  if (all) changed.web = changed.backend = changed.mcp = true;
  // Narrowing on a pull request only; a tag builds nothing; see the header.
  const build = mode === "main" || mode === "rebuild";
  const promote = mode === "promote" || mode === "rebuild";
  const web = mode === "promote" ? false : changed.web || build;
  const backend = mode === "promote" ? false : changed.backend || build;
  // Nothing ships from mcp/, but main runs every check, as it does for docs.
  const mcp = mode === "promote" ? false : changed.mcp || build;
  if (build && !all) reasons.push("release ref: Deploy needs both images (#205)");
  if (mode === "promote") reasons.push("v* tag: promote the manifest main recorded for this commit; build nothing (#205)");
  const scan = [];
  if (web) scan.push({ image: "web", context: "web" });
  if (backend) scan.push({ image: "api", context: "backend" });
  return {
    mode,
    components: { web, backend, mcp, static: true, docs: changed.docs },
    changed,
    jobs: {
      static: true,
      frontend: web,
      // Browser checks (the a11y sweep in legs, and the link landing): the
      // same selection as Frontend, of which it used to be the second half.
      browser: web,
      // The public phone matrix (#764): its own job, two legs. On a pull
      // request only, and only when the change can move a measurement (or
      // widens to everything); main and tags do not run it, the nightly
      // workflow does (public-matrix-nightly.yml), non-gating.
      "public-matrix": mode !== "main" && mode !== "rebuild" && mode !== "promote" && (all || publicWeb),
      backend,
      mcp,
      scan: scan.length > 0,
      images: build,
      release: build,
      promote,
      deploy: build || promote,
    },
    scanMatrix: scan,
    full: all,
    reasons,
  };
}

// The whole step, with git injected so the tests can make it fail. Throws
// only when the commit itself cannot be named (a tag git cannot resolve).
export function run(env, git) {
  const ctx = {
    event: env.EVENT_NAME,
    ref: env.REF,
    sha: env.SHA,
    rebuild: env.REBUILD,
    before: env.BEFORE,
    after: env.AFTER,
    forced: env.FORCED,
    baseSha: env.BASE_SHA,
    headSha: env.HEAD_SHA,
  };
  const mode = releaseMode(ctx);
  const sha = resolveSha(ctx, mode, git);
  const plan = planDiff(ctx);
  if (plan.full) return { ...classify({ full: plan.full, mode }), plan, sha };
  let paths;
  try {
    for (const c of [plan.base, plan.head]) git(["cat-file", "-e", `${c}^{commit}`]);
    const from = plan.mergeBase ? git(["merge-base", plan.base, plan.head]).trim() : plan.base;
    paths = parseNameStatus(git(["diff", "--name-status", "-z", "-M", from, plan.head]));
    plan.from = from;
  } catch (e) {
    const msg = String(e?.message ?? e).split("\n")[0];
    return { ...classify({ full: `could not diff ${plan.base}..${plan.head}: ${msg}`, mode }), plan, sha };
  }
  return { ...classify({ paths, mode }), plan, paths, sha };
}

export function outputs(r) {
  return {
    ok: "true",
    mode: r.mode,
    sha: r.sha ?? "",
    web: String(r.components.web),
    backend: String(r.components.backend),
    mcp: String(r.components.mcp),
    docs: String(r.components.docs),
    full: String(r.full),
    jobs: JSON.stringify(r.jobs),
    scan_matrix: JSON.stringify(r.scanMatrix),
  };
}

function summary(r) {
  const lines = ["### Change classification", "", `Mode \`${r.mode}\`, commit \`${r.sha}\`.`, ""];
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
  let r;
  try {
    r = run(process.env, git);
  } catch (e) {
    console.log(`::error title=Cannot name the commit this run is about::${e.message}`);
    process.exit(1);
  }
  const out = outputs(r);
  const text = Object.entries(out).map(([k, v]) => `${k}=${v}\n`).join("");
  process.stdout.write(text);
  for (const x of r.reasons) console.log(`  ${x}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary(r));
}
