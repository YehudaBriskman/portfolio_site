// Table tests for ci-gate.mjs (#203), the CI plan's section 7.5 and the gate
// half of 7.1. Run: node --test .github/scripts/ci-gate.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { gate } from "./ci-gate.mjs";
import { outputs, run } from "./ci-classify.mjs";

// `needs` as `toJSON(needs)` renders it, from a real classification of the
// given change and a result per job.
const PR = { EVENT_NAME: "pull_request", REF: "refs/pull/9/merge", SHA: "9".repeat(40), BASE_SHA: "b".repeat(40), HEAD_SHA: "h".repeat(40) };
const MAIN = { EVENT_NAME: "push", REF: "refs/heads/main", SHA: "2".repeat(40), BEFORE: "1".repeat(40), AFTER: "2".repeat(40), FORCED: "false" };
const TAG = { EVENT_NAME: "push", REF: "refs/tags/v1.2.0", SHA: "3".repeat(40), BEFORE: "0".repeat(40), AFTER: "3".repeat(40), FORCED: "false" };
const git = (path) => (a) =>
  a[0] === "diff" ? `M\0${path}\0` : a[0] === "merge-base" ? "m\n" : a[0] === "rev-parse" ? "3".repeat(40) + "\n" : "";
const needs = (env, path, results, cls = {}, omit = false) => {
  const out = outputs(run(env, git(path)));
  const n = { classify: { result: "success", outputs: out, ...cls } };
  for (const [job, result] of Object.entries(results)) n[job] = { result, outputs: {} };
  // The public phone matrix (#764) is a job of its own; unless a case says
  // otherwise it did what classification asked of it.
  if (!("public-matrix" in results) && !omit) n["public-matrix"] = { result: JSON.parse(out.jobs)["public-matrix"] ? "success" : "skipped", outputs: {} };
  return n;
};
const ALL_OK = { static: "success", frontend: "success", browser: "success", backend: "success", mcp: "success", scan: "success", images: "skipped", release: "skipped", promote: "skipped", deploy: "skipped" };

const cases = [
  // [name, env, changed path, results, passes, problem matched]
  ["7.1 docs-only PR: everything but Static skipped", PR, "docs/a.md",
    { static: "success", frontend: "skipped", browser: "skipped", backend: "skipped", mcp: "skipped", scan: "skipped", images: "skipped", release: "skipped", promote: "skipped", deploy: "skipped" }, true],
  ["web-only PR", PR, "web/src/a.ts",
    { static: "success", frontend: "success", browser: "success", backend: "skipped", mcp: "skipped", scan: "success", images: "skipped", release: "skipped", promote: "skipped", deploy: "skipped" }, true],
  ["backend-only PR", PR, "backend/src/a.ts",
    { static: "success", frontend: "skipped", browser: "skipped", backend: "success", mcp: "skipped", scan: "success", images: "skipped", release: "skipped", promote: "skipped", deploy: "skipped" }, true],
  ["mcp-only PR", PR, "mcp/src/server.ts",
    { static: "success", frontend: "skipped", browser: "skipped", backend: "skipped", mcp: "success", scan: "skipped", images: "skipped", release: "skipped", promote: "skipped", deploy: "skipped" }, true],
  ["mcp-only PR, mcp failed", PR, "mcp/src/server.ts",
    { static: "success", frontend: "skipped", browser: "skipped", backend: "skipped", mcp: "failure", scan: "skipped", images: "skipped", release: "skipped", promote: "skipped", deploy: "skipped" }, false, /mcp: failure/],
  ["full PR", PR, ".github/workflows/ci.yml", ALL_OK, true],
  ["an unselected job that ran anyway and passed", PR, "docs/a.md", { ...ALL_OK }, true],
  ["main push, everything green", MAIN, "docs/a.md",
    { ...ALL_OK, images: "success", release: "success", deploy: "success" }, true],

  ["7.5 selected job failed", PR, "web/src/a.ts",
    { static: "success", frontend: "failure", browser: "success", backend: "skipped", mcp: "skipped", scan: "success", images: "skipped", release: "skipped", promote: "skipped", deploy: "skipped" }, false, /frontend: failure/],
  ["7.5 selected job cancelled", PR, "web/src/a.ts",
    { static: "success", frontend: "success", browser: "success", backend: "skipped", mcp: "skipped", scan: "cancelled", images: "skipped", release: "skipped", promote: "skipped", deploy: "skipped" }, false, /scan: cancelled/],
  ["7.5 Static failed on a docs-only PR", PR, "docs/a.md",
    { static: "failure", frontend: "skipped", browser: "skipped", backend: "skipped", mcp: "skipped", scan: "skipped", images: "skipped", release: "skipped", promote: "skipped", deploy: "skipped" }, false, /static: failure/],
  ["7.5 unexplained skip: selected but skipped", PR, "web/src/a.ts",
    { static: "success", frontend: "skipped", browser: "skipped", backend: "skipped", mcp: "skipped", scan: "success", images: "skipped", release: "skipped", promote: "skipped", deploy: "skipped" }, false, /frontend: selected but skipped/],
  ["7.5 an unselected job that ran and failed", PR, "docs/a.md",
    { static: "success", frontend: "failure", browser: "success", backend: "skipped", mcp: "skipped", scan: "skipped", images: "skipped", release: "skipped", promote: "skipped", deploy: "skipped" }, false, /frontend: failure/],
  ["main push: Deploy skipped because Publish failed", MAIN, "docs/a.md",
    { ...ALL_OK, images: "failure", release: "skipped", deploy: "skipped" }, false, /images: failure[\s\S]*deploy: selected but skipped/],
  ["main push: Publish skipped", MAIN, "web/src/a.ts",
    { ...ALL_OK, images: "skipped", release: "skipped", promote: "skipped", deploy: "skipped" }, false, /images: selected but skipped/],
  // A v* tag builds nothing (#205): Static, Promote release, Deploy.
  ["tag: promote and deploy, nothing built", TAG, "docs/a.md",
    { static: "success", frontend: "skipped", browser: "skipped", backend: "skipped", mcp: "skipped", scan: "skipped", images: "skipped", release: "skipped", promote: "success", deploy: "success" }, true],
  ["tag: promotion refused (no manifest), Deploy skipped", TAG, "docs/a.md",
    { static: "success", frontend: "skipped", browser: "skipped", backend: "skipped", mcp: "skipped", scan: "skipped", images: "skipped", release: "skipped", promote: "failure", deploy: "skipped" }, false, /promote: failure[\s\S]*deploy: selected but skipped/],
  ["tag: a build job that ran on a tag anyway still has to pass", TAG, "docs/a.md",
    { static: "success", frontend: "skipped", browser: "skipped", backend: "skipped", mcp: "skipped", scan: "skipped", images: "failure", release: "skipped", promote: "success", deploy: "success" }, false, /images: failure/],
  ["main: the manifest was not written, Deploy skipped", MAIN, "docs/a.md",
    { ...ALL_OK, images: "success", release: "failure", deploy: "skipped" }, false, /release: failure/],
  // A matrix job's result is every leg's: one failed a11y shard is `failure`.
  ["web PR: one Browser checks leg failed, Frontend passed", PR, "web/src/a.ts",
    { ...ALL_OK, browser: "failure" }, false, /browser: failure/],
  ["web PR: Browser checks skipped though selected", PR, "web/src/a.ts",
    { ...ALL_OK, browser: "skipped" }, false, /browser: selected but skipped/],
  // The public phone matrix (#764) is two legs of one job: a job's result is
  // every leg's, so a cancelled or failed shard, or a skip nobody asked for,
  // fails the gate the same way.
  ["web PR: a phone matrix shard was cancelled", PR, "web/src/a.ts",
    { ...ALL_OK, "public-matrix": "cancelled" }, false, /public-matrix: cancelled/],
  ["web PR: a phone matrix shard failed", PR, "web/src/a.ts",
    { ...ALL_OK, "public-matrix": "failure" }, false, /public-matrix: failure/],
  ["web PR: the phone matrix was selected but skipped", PR, "web/src/a.ts",
    { ...ALL_OK, "public-matrix": "skipped" }, false, /public-matrix: selected but skipped/],
  ["web PR: the phone matrix passed", PR, "web/src/a.ts",
    { ...ALL_OK, "public-matrix": "success" }, true],
  ["a CI change selects the phone matrix too", PR, ".github/workflows/ci.yml",
    { ...ALL_OK, "public-matrix": "skipped" }, false, /public-matrix: selected but skipped/],
  ["web config outside src/public/scripts: the phone matrix is skipped, as asked", PR, "web/vite.config.ts",
    { ...ALL_OK, backend: "skipped", mcp: "skipped", "public-matrix": "skipped" }, true],
  ["main does not run the phone matrix, and skipping it is fine", MAIN, "web/src/a.ts",
    { ...ALL_OK, images: "success", release: "success", deploy: "success", "public-matrix": "skipped" }, true],
  ["the gate does not need the phone matrix: classification selects it", PR, "web/src/a.ts",
    { static: "success", frontend: "success", browser: "success", backend: "skipped", mcp: "skipped", scan: "success", images: "skipped", release: "skipped", promote: "skipped", deploy: "skipped" }, false, /public-matrix: classification selects it/],
  ["a job the gate needs that classification does not know", PR, "web/src/a.ts",
    { ...ALL_OK, e2e: "success" }, false, /e2e: the gate needs it/],
  ["a job classification selects that the gate does not need", PR, "web/src/a.ts",
    { static: "success", frontend: "success", browser: "success", backend: "skipped", mcp: "skipped", scan: "success", images: "skipped" }, false, /deploy: classification selects it/],
];
for (const [name, env, path, results, ok, why] of cases) {
  test(name, () => {
    const r = gate(needs(env, path, results, {}, /does not need the phone matrix/.test(name)));
    assert.equal(r.ok, ok, r.problems.join("; "));
    if (why) assert.match(r.problems.join("\n"), why);
  });
}

// 7.5: a failed classification can never become a docs-only success.
const SKIPPED = { static: "success", frontend: "skipped", browser: "skipped", backend: "skipped", mcp: "skipped", scan: "skipped", images: "skipped", release: "skipped", promote: "skipped", deploy: "skipped" };
const broken = [
  ["classify failed", { result: "failure", outputs: {} }, /classify: failure/],
  ["classify cancelled", { result: "cancelled", outputs: {} }, /classify: cancelled/],
  ["classify skipped", { result: "skipped", outputs: {} }, /classify: skipped/],
  ["classify succeeded with no outputs", { result: "success", outputs: {} }, /no usable selection/],
  ["classify output is not JSON", { result: "success", outputs: { ok: "true", jobs: "{" } }, /no usable selection/],
  ["classify output is an array", { result: "success", outputs: { ok: "true", jobs: "[]" } }, /no usable selection/],
  ["classify failed after writing a docs-only selection", { result: "failure" }, /classify: failure/],
];
for (const [name, cls, why] of broken) {
  test(`7.5 ${name}: gate fails`, () => {
    const n = needs(PR, "docs/a.md", SKIPPED, cls);
    const r = gate(n);
    assert.equal(r.ok, false);
    assert.match(r.problems.join("\n"), why);
  });
}
test("7.5 the gate fails when it does not need classify at all", () => {
  const r = gate({ static: { result: "success" } });
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /does not need `classify`/);
});
test("7.5 a selection value that is not a boolean fails", () => {
  const n = needs(PR, "docs/a.md", SKIPPED);
  n.classify.outputs.jobs = JSON.stringify({ ...JSON.parse(n.classify.outputs.jobs), frontend: "false" });
  const r = gate(n);
  assert.equal(r.ok, false);
  assert.match(r.problems.join("\n"), /frontend: selection is "false"/);
});
