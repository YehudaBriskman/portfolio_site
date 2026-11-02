// Table tests for ci-gate.mjs (#203), the CI plan's section 7.5 and the gate
// half of 7.1. Run: node --test .github/scripts/ci-gate.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { gate } from "./ci-gate.mjs";
import { outputs, run } from "./ci-classify.mjs";

// `needs` as `toJSON(needs)` renders it, from a real classification of the
// given change and a result per job.
const PR = { EVENT_NAME: "pull_request", REF: "refs/pull/9/merge", BASE_SHA: "b".repeat(40), HEAD_SHA: "h".repeat(40) };
const MAIN = { EVENT_NAME: "push", REF: "refs/heads/main", BEFORE: "1".repeat(40), AFTER: "2".repeat(40), FORCED: "false" };
const git = (path) => (a) => (a[0] === "diff" ? `M\0${path}\0` : a[0] === "merge-base" ? "m\n" : "");
const needs = (env, path, results, cls = {}) => {
  const out = outputs(run(env, git(path)));
  const n = { classify: { result: "success", outputs: out, ...cls } };
  for (const [job, result] of Object.entries(results)) n[job] = { result, outputs: {} };
  return n;
};
const ALL_OK = { static: "success", frontend: "success", backend: "success", scan: "success", images: "skipped", deploy: "skipped" };

const cases = [
  // [name, env, changed path, results, passes, problem matched]
  ["7.1 docs-only PR: everything but Static skipped", PR, "docs/a.md",
    { static: "success", frontend: "skipped", backend: "skipped", scan: "skipped", images: "skipped", deploy: "skipped" }, true],
  ["web-only PR", PR, "web/src/a.ts",
    { static: "success", frontend: "success", backend: "skipped", scan: "success", images: "skipped", deploy: "skipped" }, true],
  ["backend-only PR", PR, "backend/src/a.ts",
    { static: "success", frontend: "skipped", backend: "success", scan: "success", images: "skipped", deploy: "skipped" }, true],
  ["full PR", PR, ".github/workflows/ci.yml", ALL_OK, true],
  ["an unselected job that ran anyway and passed", PR, "docs/a.md", { ...ALL_OK }, true],
  ["main push, everything green", MAIN, "docs/a.md",
    { ...ALL_OK, images: "success", deploy: "success" }, true],

  ["7.5 selected job failed", PR, "web/src/a.ts",
    { static: "success", frontend: "failure", backend: "skipped", scan: "success", images: "skipped", deploy: "skipped" }, false, /frontend: failure/],
  ["7.5 selected job cancelled", PR, "web/src/a.ts",
    { static: "success", frontend: "success", backend: "skipped", scan: "cancelled", images: "skipped", deploy: "skipped" }, false, /scan: cancelled/],
  ["7.5 Static failed on a docs-only PR", PR, "docs/a.md",
    { static: "failure", frontend: "skipped", backend: "skipped", scan: "skipped", images: "skipped", deploy: "skipped" }, false, /static: failure/],
  ["7.5 unexplained skip: selected but skipped", PR, "web/src/a.ts",
    { static: "success", frontend: "skipped", backend: "skipped", scan: "success", images: "skipped", deploy: "skipped" }, false, /frontend: selected but skipped/],
  ["7.5 an unselected job that ran and failed", PR, "docs/a.md",
    { static: "success", frontend: "failure", backend: "skipped", scan: "skipped", images: "skipped", deploy: "skipped" }, false, /frontend: failure/],
  ["main push: Deploy skipped because Publish failed", MAIN, "docs/a.md",
    { ...ALL_OK, images: "failure", deploy: "skipped" }, false, /images: failure[\s\S]*deploy: selected but skipped/],
  ["main push: Publish skipped", MAIN, "web/src/a.ts",
    { ...ALL_OK, images: "skipped", deploy: "skipped" }, false, /images: selected but skipped/],
  ["a job the gate needs that classification does not know", PR, "web/src/a.ts",
    { ...ALL_OK, e2e: "success" }, false, /e2e: the gate needs it/],
  ["a job classification selects that the gate does not need", PR, "web/src/a.ts",
    { static: "success", frontend: "success", backend: "skipped", scan: "success", images: "skipped" }, false, /deploy: classification selects it/],
];
for (const [name, env, path, results, ok, why] of cases) {
  test(name, () => {
    const r = gate(needs(env, path, results));
    assert.equal(r.ok, ok, r.problems.join("; "));
    if (why) assert.match(r.problems.join("\n"), why);
  });
}

// 7.5: a failed classification can never become a docs-only success.
const SKIPPED = { static: "success", frontend: "skipped", backend: "skipped", scan: "skipped", images: "skipped", deploy: "skipped" };
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
