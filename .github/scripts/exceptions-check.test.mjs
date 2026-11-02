// Table tests for exceptions-check.mjs (#206).
// Run: node --test .github/scripts/exceptions-check.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { check } from "./exceptions-check.mjs";

const TODAY = "2026-11-03";
const good = { id: "CVE-2026-0001", statement: "No fix upstream; unreachable here.", owner: "YehudaBriskman", expired_at: "2027-01-15" };
const vulns = (...e) => ({ vulnerabilities: e });

const cases = [
  // [name, doc, problem matched or null, warning matched or null]
  ["the empty list passes", { vulnerabilities: [] }, null, null],
  ["an empty file passes", null, null, null],
  ["a complete entry passes", vulns(good), null, null],
  ["no owner fails", vulns({ ...good, owner: undefined }), /no `owner`/, null],
  ["a blank owner fails", vulns({ ...good, owner: "  " }), /no `owner`/, null],
  ["no statement fails", vulns({ ...good, statement: "" }), /no `statement`/, null],
  ["no expiry fails", vulns({ ...good, expired_at: undefined }), /no `expired_at`/, null],
  ["a non-date expiry fails", vulns({ ...good, expired_at: "soon" }), /not a date/, null],
  ["expired yesterday fails", vulns({ ...good, expired_at: "2026-11-02" }), /expired on 2026-11-02/, null],
  ["expiring today fails (Trivy stops honouring it today)", vulns({ ...good, expired_at: TODAY }), /expired on/, null],
  ["more than 92 days ahead fails", vulns({ ...good, expired_at: "2027-03-01" }), /days ahead; the most is 92/, null],
  ["92 days ahead passes", vulns({ ...good, expired_at: "2027-02-03" }), null, null],
  ["a timestamp expiry is read by its date", vulns({ ...good, expired_at: "2027-01-15T00:00:00Z" }), null, null],
  ["within 14 days warns, does not fail", vulns({ ...good, expired_at: "2026-11-10" }), null, /in 7 day/],
  ["a wildcard id fails", vulns({ ...good, id: "CVE-2026-*" }), /wildcard/, null],
  ["no id fails", vulns({ ...good, id: undefined }), /no `id`/, null],
  ["other sections are held to the same rules", { secrets: [{ ...good, owner: undefined }] }, /secrets\[0\].*no `owner`/, null],
  ["an unknown section fails", { vulnerabilities: [], vulns: [] }, /unknown section `vulns`/, null],
  ["a section that is not a list fails", { vulnerabilities: good }, /not a list/, null],
];

for (const [name, doc, problem, warning] of cases) {
  test(name, () => {
    const { problems, warnings } = check(doc, TODAY);
    if (problem) assert.ok(problems.some((p) => problem.test(p)), `expected ${problem} in ${JSON.stringify(problems)}`);
    else assert.deepEqual(problems, []);
    if (warning) assert.ok(warnings.some((w) => warning.test(w)), `expected ${warning} in ${JSON.stringify(warnings)}`);
    else assert.deepEqual(warnings, []);
  });
}

test("every problem in an entry is reported, not just the first", () => {
  const { problems } = check(vulns({ id: "CVE-1" }), TODAY);
  assert.equal(problems.length, 3);
});
