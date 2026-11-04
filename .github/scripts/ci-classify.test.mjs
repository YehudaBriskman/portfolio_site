// Table tests for ci-classify.mjs (#203). Run: node --test .github/scripts/ci-classify.test.mjs
// Cases follow the CI plan's acceptance matrix, sections 7.1 to 7.5.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JOBS, classify, classifyPath, outputs, parseNameStatus, planDiff, run } from "./ci-classify.mjs";

const PR = { EVENT_NAME: "pull_request", REF: "refs/pull/9/merge", SHA: "9".repeat(40), BASE_SHA: "b".repeat(40), HEAD_SHA: "h".repeat(40) };
const PUSH = { EVENT_NAME: "push", REF: "refs/heads/main", SHA: "2".repeat(40), BEFORE: "1".repeat(40), AFTER: "2".repeat(40), FORCED: "false" };

// A fake git that answers a diff with the given name-status records.
const fakeGit = (records, { fail, tag } = {}) => (args) => {
  if (fail && fail(args)) throw new Error(`fatal: ${args.join(" ")} failed`);
  if (args[0] === "rev-parse" && tag) return tag + "\n";
  if (args[0] === "cat-file") return "";
  if (args[0] === "merge-base") return "m".repeat(40) + "\n";
  if (args[0] === "diff") return records.map((r) => r.join("\0") + "\0").join("");
  throw new Error(`unexpected git ${args.join(" ")}`);
};
const pr = (...records) => run(PR, fakeGit(records));
const selected = (r) => JOBS.filter((j) => r.jobs[j]);
const scanned = (r) => r.scanMatrix.map((m) => m.image);

// --- 7.2: what each kind of path selects, on a pull request -------------------

const cases = [
  // [name, records, jobs selected, images scanned, widened]
  ["7.1 docs only", [["M", "docs/story/README.md"], ["A", "docs/story/shot.png"]], ["static"], [], false],
  ["7.1 root README", [["M", "README.md"]], ["static"], [], false],
  ["7.1 docs build script is still docs", [["M", "docs/hero-portrait/build.sh"]], ["static"], [], false],
  ["web only", [["M", "web/src/App.tsx"], ["A", "web/public/img/x.webp"]], ["static", "frontend", "browser", "scan"], ["web"], false],
  ["web config that is not shared", [["M", "web/vite.config.ts"]], ["static", "frontend", "browser", "scan"], ["web"], false],
  ["backend only", [["M", "backend/src/server.ts"]], ["static", "backend", "scan"], ["api"], false],
  ["web and backend", [["M", "web/src/a.ts"], ["M", "backend/src/b.ts"]], ["static", "frontend", "browser", "backend", "scan"], ["web", "api"], false],
  ["web and docs", [["M", "web/src/a.ts"], ["M", "docs/a.md"]], ["static", "frontend", "browser", "scan"], ["web"], false],
  ["mcp only: its own job, no image", [["M", "mcp/src/server.ts"], ["A", "mcp/README.md"]], ["static", "mcp"], [], false],
  ["mcp and backend", [["M", "mcp/src/api.ts"], ["M", "backend/src/app.ts"]], ["static", "backend", "mcp", "scan"], ["api"], false],
];
const ALL_PR = ["static", "frontend", "browser", "backend", "mcp", "scan"];
const widening = [
  ["Dockerfile (web)", "web/Dockerfile"],
  ["Dockerfile (backend)", "backend/Dockerfile"],
  ["dockerignore", "backend/.dockerignore"],
  ["web lockfile (dependency only)", "web/package-lock.json"],
  ["backend lockfile (dependency only)", "backend/package-lock.json"],
  ["bun lockfile", "web/bun.lockb"],
  ["package manifest", "backend/package.json"],
  ["mcp package manifest", "mcp/package.json"],
  ["mcp tsconfig", "mcp/tsconfig.json"],
  ["nginx template", "web/nginx.conf.template"],
  ["security headers", "web/security-headers.conf"],
  ["proxy headers", "web/proxy-headers.conf"],
  ["compose", "docker-compose.yml"],
  ["compose overlay", "docker-compose.dev.yml"],
  ["Makefile", "Makefile"],
  ["workflow", ".github/workflows/ci.yml"],
  ["CI script", ".github/scripts/supersede-select.mjs"],
  ["CI script test", ".github/scripts/ci-classify.test.mjs"],
  ["dependabot config", ".github/dependabot.yml"],
  ["tsconfig (web)", "web/tsconfig.app.json"],
  ["tsconfig (backend)", "backend/tsconfig.json"],
  ["eslint config", "web/eslint.config.js"],
  ["trivy ignores", ".trivyignore.yaml"],
  ["gitleaks ignores", ".gitleaksignore"],
  ["unknown top-level file", "renovate.json"],
  ["unknown top-level dir", "infra/main.tf"],
  ["unknown dotfile", ".gitattributes"],
  // Only .github's own top level and ISSUE_TEMPLATE are prose: markdown
  // deeper in it, or any other file, is still CI configuration.
  ["markdown under .github/scripts", ".github/scripts/NOTES.md"],
  ["markdown under .github/workflows", ".github/workflows/README.md"],
  ["a .github file that is not markdown", ".github/zizmor.yml"],
  ["markdown outside docs, root and .github", "tools/NOTES.md"],
];
// The community files and templates GitHub renders, which nothing in CI reads.
cases.push(
  ["docs: .github community files", [["M", ".github/CONTRIBUTING.md"], ["A", ".github/SECURITY.md"], ["M", ".github/pull_request_template.md"]], ["static"], [], false],
  ["docs: issue templates", [["A", ".github/ISSUE_TEMPLATE/bug.yml"], ["A", ".github/ISSUE_TEMPLATE/config.yml"]], ["static"], [], false],
);
for (const [name, path] of widening) cases.push([`widens: ${name}`, [["M", path]], ALL_PR, ["web", "api"], true]);
// A widening path widens even when it rides with a narrow change.
cases.push(["web change plus a workflow edit", [["M", "web/src/a.ts"], ["M", ".github/workflows/ci.yml"]], ALL_PR, ["web", "api"], true]);

for (const [name, records, jobs, images, full] of cases) {
  test(`PR: ${name}`, () => {
    const r = pr(...records);
    assert.deepEqual(selected(r), jobs);
    assert.deepEqual(scanned(r), images);
    assert.equal(r.full, full);
    assert.equal(r.jobs.images, false, "a pull request never publishes");
    assert.equal(r.jobs.deploy, false);
    assert.equal(r.jobs.static, true, "Static runs on every change");
  });
}

test("every path in the repository has a deliberate rule (unknown paths are the exception)", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  let files;
  try {
    files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    return; // not a checkout
  }
  const unknown = files.filter((f) => classifyPath(f).why === "no rule names this path");
  assert.deepEqual(unknown, [], "add a rule for these, or accept that they select everything");
});

// --- 7.3: renames, deletions, large diffs, history ---------------------------

test("7.3 a rename counts both paths: docs -> web selects web", () => {
  const r = pr(["R100", "docs/a.ts", "web/src/a.ts"]);
  assert.deepEqual(selected(r), ["static", "frontend", "browser", "scan"]);
});
test("7.3 a rename counts both paths: web -> docs still selects web", () => {
  const r = pr(["R087", "web/src/old.md", "docs/old.md"]);
  assert.deepEqual(selected(r), ["static", "frontend", "browser", "scan"]);
  assert.equal(r.components.docs, true);
});
test("7.3 a rename out of backend into web selects both", () => {
  assert.deepEqual(scanned(pr(["R100", "backend/src/x.ts", "web/src/x.ts"])), ["web", "api"]);
});
test("7.3 a copy counts both paths", () => {
  assert.deepEqual(scanned(pr(["C075", "backend/src/x.ts", "web/src/x.ts"])), ["web", "api"]);
});
test("7.3 a deletion counts its path", () => {
  assert.deepEqual(selected(pr(["D", "backend/src/gone.ts"])), ["static", "backend", "scan"]);
  assert.equal(pr(["D", "web/Dockerfile"]).full, true);
});
test("7.3 a large diff is read whole: one backend path among 5000 web paths", () => {
  const recs = Array.from({ length: 5000 }, (_, i) => ["M", `web/src/f${i}.ts`]);
  recs.push(["M", "backend/src/late.ts"]);
  assert.deepEqual(scanned(pr(...recs)), ["web", "api"]);
});
test("7.3 an empty diff selects everything rather than nothing", () => {
  const r = pr();
  assert.equal(r.full, true);
  assert.deepEqual(selected(r), ALL_PR);
});
test("7.3 paths with spaces, tabs and newlines survive -z", () => {
  assert.deepEqual(parseNameStatus("M\0docs/a b.md\0R100\0web/x\ty\0docs/new\nline.md\0"), [
    "docs/a b.md",
    "web/x\ty",
    "docs/new\nline.md",
  ]);
});
test("7.3 unparseable diff output is an error, not an empty list", () => {
  assert.throws(() => parseNameStatus("Q\0web/a\0"));
  assert.throws(() => parseNameStatus("R100\0web/a\0"));
  const r = run(PR, () => "garbage\0");
  assert.equal(r.full, true);
});

const fullCases = [
  ["7.3 initial push / new tag: all-zero before", { ...PUSH, BEFORE: "0".repeat(40) }, /no previous commit/],
  ["7.3 force push", { ...PUSH, FORCED: "true" }, /force push/],
  ["push without shas", { ...PUSH, BEFORE: "" }, /without before/],
  ["PR without shas", { ...PR, BASE_SHA: "" }, /without base/],
  ["workflow_dispatch", { EVENT_NAME: "workflow_dispatch", REF: "refs/heads/main", SHA: "2".repeat(40) }, /workflow_dispatch/],
  ["unknown event", { EVENT_NAME: "merge_group", REF: "refs/heads/gh-readonly-queue/main/x", SHA: "2".repeat(40) }, /merge_group/],
];
for (const [name, env, why] of fullCases) {
  test(name, () => {
    const r = run(env, fakeGit([["M", "docs/a.md"]]));
    assert.equal(r.full, true);
    assert.match(r.reasons.join("\n"), why);
    assert.equal(r.jobs.frontend && r.jobs.backend && r.jobs.scan, true);
  });
}
// A push to a non-release branch, so that the release rule does not mask the
// result. (ci.yml pushes only on main and tags; this is for the diff logic.)
const BRANCH_PUSH = { ...PUSH, REF: "refs/heads/feature" };
const gitFailures = [
  ["7.3 missing history: base not in the clone", PR, (a) => a[0] === "cat-file" && a[2].startsWith("b")],
  ["7.3 missing history: no merge-base", PR, (a) => a[0] === "merge-base"],
  ["7.3 diff error", PR, (a) => a[0] === "diff"],
  ["7.3 missing history: before not in the clone", BRANCH_PUSH, (a) => a[0] === "cat-file" && a[2].startsWith("1")],
  ["7.3 diff error", BRANCH_PUSH, (a) => a[0] === "diff"],
];
for (const [name, env, fail] of gitFailures) {
  {
    test(`${name} (${env.EVENT_NAME})`, () => {
      assert.equal(run(env, fakeGit([["M", "docs/a.md"]])).full, false, "the same change narrows when git works");
      const r = run(env, fakeGit([["M", "docs/a.md"]], { fail }));
      assert.equal(r.full, true, r.reasons.join("; "));
      assert.match(r.reasons.join("\n"), /could not diff/);
      assert.deepEqual(scanned(r), ["web", "api"]);
    });
  }
}

test("PR diffs from the merge-base, push from before", () => {
  const seen = [];
  const git = (a) => (seen.push(a), fakeGit([["M", "docs/a.md"]])(a));
  run(PR, git);
  assert.deepEqual(seen.at(-1), ["diff", "--name-status", "-z", "-M", "m".repeat(40), PR.HEAD_SHA]);
  seen.length = 0;
  run(PUSH, git);
  assert.equal(seen.some((a) => a[0] === "merge-base"), false);
  assert.deepEqual(seen.at(-1), ["diff", "--name-status", "-z", "-M", PUSH.BEFORE, PUSH.AFTER]);
});

// --- release refs ------------------------------------------------------------

// Main builds both images and records them; it never promotes (#205).
const MAIN_JOBS = ["static", "frontend", "browser", "backend", "mcp", "scan", "images", "release", "deploy"];
// A tag builds nothing: Static, the promotion, the deploy.
const TAG_JOBS = ["static", "promote", "deploy"];
const TAG_COMMIT = "c".repeat(40);
const TAG = { ...PUSH, REF: "refs/tags/v1.2.0", BEFORE: "0".repeat(40), AFTER: "a".repeat(40), SHA: "a".repeat(40) };

test("main push: diff is narrow, selection is not (Deploy needs both images, #205)", () => {
  const r = run(PUSH, fakeGit([["M", "backend/src/a.ts"]]));
  assert.deepEqual(r.changed, { web: false, backend: true, mcp: false, static: true, docs: false });
  assert.deepEqual(selected(r), MAIN_JOBS);
  assert.deepEqual(scanned(r), ["web", "api"]);
  assert.match(r.reasons.join("\n"), /release ref/);
  assert.equal(r.mode, "main");
  assert.equal(r.sha, PUSH.SHA);
});
test("main push, docs only: still publishes, records and deploys both images", () => {
  assert.deepEqual(selected(run(PUSH, fakeGit([["M", "docs/a.md"]]))), MAIN_JOBS);
});
test("tag push: builds nothing, promotes and deploys", () => {
  const r = run(TAG, fakeGit([], { tag: TAG_COMMIT }));
  assert.deepEqual(selected(r), TAG_JOBS);
  assert.deepEqual(scanned(r), []);
  assert.equal(r.mode, "promote");
  assert.match(r.reasons.join("\n"), /build nothing/);
});
test("tag push: the tag is resolved to its commit once, by git, peeled", () => {
  const seen = [];
  const git = (a) => (seen.push(a), fakeGit([], { tag: TAG_COMMIT })(a));
  const r = run(TAG, git);
  // The tag object's own sha (AFTER, SHA) is not the commit; the peeled one is.
  assert.equal(r.sha, TAG_COMMIT);
  assert.equal(outputs(r).sha, TAG_COMMIT);
  assert.deepEqual(seen.filter((a) => a[0] === "rev-parse"), [["rev-parse", "--verify", "--quiet", "refs/tags/v1.2.0^{commit}"]]);
});
test("tag push: a tag git cannot resolve is an error, never a guess", () => {
  assert.throws(() => run(TAG, fakeGit([], { fail: (a) => a[0] === "rev-parse" })), /cannot resolve refs\/tags\/v1.2.0/);
  assert.throws(() => run(TAG, fakeGit([], { tag: "not-a-sha" })), /not a commit sha/);
});
test("manual run on a tag without rebuild promotes, like a push", () => {
  const r = run({ EVENT_NAME: "workflow_dispatch", REF: "refs/tags/v1.2.0", SHA: "a".repeat(40), REBUILD: "false" }, fakeGit([], { tag: TAG_COMMIT }));
  assert.deepEqual(selected(r), TAG_JOBS);
  assert.equal(r.mode, "promote");
});
test("manual run on a tag with rebuild: the full, gated build, then the promotion", () => {
  const r = run({ EVENT_NAME: "workflow_dispatch", REF: "refs/tags/v1.2.0", SHA: "a".repeat(40), REBUILD: "true" }, fakeGit([], { tag: TAG_COMMIT }));
  assert.deepEqual(selected(r), JOBS);
  assert.deepEqual(scanned(r), ["web", "api"]);
  assert.equal(r.mode, "rebuild");
  assert.equal(r.sha, TAG_COMMIT);
});
test("rebuild is only a manual input: a tag push that somehow carries it still promotes", () => {
  assert.equal(run({ ...TAG, REBUILD: "true" }, fakeGit([], { tag: TAG_COMMIT })).mode, "promote");
});
test("rebuild on main changes nothing: main always builds", () => {
  const r = run({ EVENT_NAME: "workflow_dispatch", REF: "refs/heads/main", SHA: PUSH.SHA, REBUILD: "true" }, fakeGit([]));
  assert.deepEqual(selected(r), MAIN_JOBS);
});
test("manual run on main publishes, as Deploy's own `if` would", () => {
  assert.deepEqual(selected(run({ EVENT_NAME: "workflow_dispatch", REF: "refs/heads/main", SHA: PUSH.SHA }, fakeGit([]))), MAIN_JOBS);
});
test("manual run on another branch does not publish", () => {
  const r = run({ EVENT_NAME: "workflow_dispatch", REF: "refs/heads/x", SHA: PUSH.SHA }, fakeGit([]));
  assert.deepEqual(selected(r), ALL_PR);
});
test("a tag not starting with v is not a release", () => {
  assert.equal(classify({ full: "x", release: false }).jobs.images, false);
  assert.deepEqual(selected(run({ ...PUSH, REF: "refs/tags/x1", BEFORE: "0".repeat(40) }, fakeGit([]))), ALL_PR);
});
test("an event without a usable sha is an error", () => {
  assert.throws(() => run({ ...PUSH, SHA: "" }, fakeGit([])), /no commit sha/);
});

// --- 7.4: forks and Dependabot -----------------------------------------------

// ci.yml's jobs as text, keyed by job id: every line from `  <id>:` under
// `jobs:` to the next job. Comments between jobs go with the job above.
function jobBlocks() {
  const yml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "workflows", "ci.yml"), "utf8");
  const body = yml.slice(yml.search(/^jobs:\s*$/m));
  const jobs = {};
  let cur = null;
  for (const line of body.split("\n")) {
    const m = /^ {2}([a-z][a-z0-9_-]*):\s*$/.exec(line);
    if (m) cur = m[1];
    if (cur) jobs[cur] = (jobs[cur] ?? "") + line + "\n";
  }
  return jobs;
}

test("7.4 a Dependabot lockfile PR needs no token and selects every check", () => {
  const env = { ...PR, REF: "refs/pull/77/merge" }; // no GITHUB_TOKEN, no secrets in env
  const r = run(env, fakeGit([["M", "web/package-lock.json"], ["M", "web/package.json"]]));
  assert.deepEqual(selected(r), ALL_PR);
});

test("7.4 classify, gate and the PR jobs use no secrets", () => {
  const jobs = jobBlocks();
  for (const j of ["classify", "static", "frontend", "browser", "backend", "mcp", "scan", "gate"]) {
    assert.ok(jobs[j], `job ${j} not found in ci.yml`);
    assert.doesNotMatch(jobs[j], /secrets\./, `${j} must run without secrets (fork and Dependabot PRs)`);
  }
});

test("the CI gate needs exactly classify plus every job classification selects", () => {
  const gate = /^ {4}needs:\s*\[([^\]]*)\]/m.exec(jobBlocks().gate ?? "");
  assert.ok(gate, "gate job with an inline needs list");
  const needs = gate[1].split(",").map((s) => s.trim()).sort();
  assert.deepEqual(needs, ["classify", ...JOBS].sort());
});

// Browser checks runs the a11y sweep in legs (SHARD=k/n in axe-routes.mjs).
// A leg missing from the matrix would shrink the sweep without failing
// anything, so the legs must be exactly 1..of, with one `of`, plus the links.
test("Browser checks: the a11y legs cover every shard exactly once, and links has a leg", () => {
  const block = jobBlocks().browser ?? "";
  assert.ok(block, "job browser not found in ci.yml");
  const legs = [...block.matchAll(/^\s+- \{ check: (\w+), shard: (\d+), of: (\d+) \}\s*$/gm)].map((m) => ({
    check: m[1],
    shard: Number(m[2]),
    of: Number(m[3]),
  }));
  const a11y = legs.filter((l) => l.check === "a11y");
  assert.ok(a11y.length > 0, "no a11y legs");
  const of = a11y[0].of;
  assert.ok(a11y.every((l) => l.of === of), "every a11y leg names the same `of`");
  assert.deepEqual(a11y.map((l) => l.shard).sort((a, b) => a - b), Array.from({ length: of }, (_, i) => i + 1));
  assert.deepEqual(legs.filter((l) => l.check === "links"), [{ check: "links", shard: 1, of: 1 }]);
  assert.equal(legs.length, of + 1, "a leg the test does not recognise");
  assert.match(block, /SHARD: \$\{\{ matrix\.shard \}\}\/\$\{\{ matrix\.of \}\}/);
  assert.match(block, /fail-fast: false/);
});

test("Publish image needs Browser checks, so no manifest is recorded for a commit whose sweep failed", () => {
  const needs = /^ {4}needs:\s*\[([^\]]*)\]/m.exec(jobBlocks().images ?? "");
  assert.ok(needs, "images job with an inline needs list");
  assert.ok(needs[1].split(",").map((s) => s.trim()).includes("browser"));
});

// --- outputs -------------------------------------------------------------------

test("outputs are strings the workflow can compare", () => {
  const o = outputs(pr(["M", "web/src/a.ts"]));
  assert.equal(o.ok, "true");
  assert.equal(o.web, "true");
  assert.equal(o.backend, "false");
  assert.deepEqual(JSON.parse(o.scan_matrix), [{ image: "web", context: "web" }]);
  assert.deepEqual(JSON.parse(o.jobs), { static: true, frontend: true, browser: true, backend: false, mcp: false, scan: true, images: false, release: false, promote: false, deploy: false });
  assert.equal(o.mode, "pr");
  assert.equal(o.sha, PR.SHA);
  assert.equal(outputs(pr(["M", "docs/a.md"])).scan_matrix, "[]");
});

test("planDiff", () => {
  assert.deepEqual(planDiff({ event: "pull_request", baseSha: "a", headSha: "b" }), { base: "a", head: "b", mergeBase: true });
  assert.deepEqual(planDiff({ event: "push", before: "a", after: "b", forced: false }), { base: "a", head: "b", mergeBase: false });
});

// --- against real git: renames, deletions, several commits, a moved base -------

test("7.3 real git: multi-commit PR on a moved base, with a rename and a deletion", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ci-classify-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t",
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
  };
  const git = (args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const write = (p, s) => (mkdirSync(join(dir, dirname(p)), { recursive: true }), writeFileSync(join(dir, p), s));
  const commit = (m) => (git(["add", "-A"]), git(["commit", "-qm", m]), git(["rev-parse", "HEAD"]).trim());

  git(["init", "-q", "-b", "main"]);
  write("docs/guide.md", "a long enough body for rename detection to be sure\n".repeat(5));
  write("backend/src/old.ts", "export {};\n");
  write("web/src/a.ts", "export {};\n");
  commit("root");
  git(["checkout", "-qb", "topic"]);
  renameSync(join(dir, "docs/guide.md"), join(dir, "docs/moved.md"));
  commit("rename in docs");
  write("docs/more.md", "x\n");
  const head = commit("second docs commit");
  git(["checkout", "-q", "main"]);
  write("web/src/a.ts", "export const moved = 1;\n"); // main moved on: not this PR's change
  const base = commit("main moves");

  // Docs-only PR, even though main has since changed web.
  let r = run({ ...PR, BASE_SHA: base, HEAD_SHA: head }, git);
  assert.deepEqual(r.paths.sort(), ["docs/guide.md", "docs/more.md", "docs/moved.md"]);
  assert.deepEqual(selected(r), ["static"]);

  // Delete a backend file and move a docs file into web on the topic branch.
  git(["checkout", "-q", "topic"]);
  unlinkSync(join(dir, "backend/src/old.ts"));
  mkdirSync(join(dir, "web/src"), { recursive: true });
  renameSync(join(dir, "docs/moved.md"), join(dir, "web/src/moved.md"));
  const head2 = commit("delete and move");
  r = run({ ...PR, BASE_SHA: base, HEAD_SHA: head2 }, git);
  assert.ok(r.paths.includes("backend/src/old.ts"));
  assert.ok(r.paths.includes("web/src/moved.md"));
  assert.deepEqual(scanned(r), ["web", "api"]);

  // A push range spanning several commits.
  r = run({ ...PUSH, REF: "refs/heads/topic", BEFORE: head, AFTER: head2 }, git);
  assert.deepEqual(scanned(r), ["web", "api"]);
  assert.equal(r.full, false);

  // A before this clone never had (a shallow clone, or rewritten history).
  r = run({ ...PUSH, REF: "refs/heads/topic", BEFORE: "a".repeat(40), AFTER: head2 }, git);
  assert.equal(r.full, true);
  assert.match(r.reasons[0], /could not diff/);
});
