// Table tests for supersede-select.mjs (#201). Run: node --test .github/scripts/
import { test } from "node:test";
import assert from "node:assert/strict";
import { compareVersions, isSecurity, parseUpdates, selectToClose } from "./supersede-select.mjs";

const FOOTER_SEC =
  "\n\n---\nYou can disable automated security fix PRs for this repo from the [Security Alerts page](https://github.com/o/r/network/alerts).";

// A security update, as Dependabot opens it: single dependency, outside the group.
const sec = (number, name, from, to, dir = "/web", extra = FOOTER_SEC) => ({
  number,
  headRefName: `dependabot/npm_and_yarn${dir}/${name}-${to}`,
  title: `chore(deps): bump ${name} from ${from} to ${to}${dir === "/" ? "" : ` in ${dir}`}`,
  body: `Bumps [${name}](https://example.com/${name}) from ${from} to ${to}.${extra}`,
  labels: [{ name: "dependencies" }, { name: "javascript" }],
});

// A grouped version update, in the real body format (one table per directory).
const group = (number, dirs, eco = "npm_and_yarn") => {
  const parts = [];
  const updates = [];
  for (const [dir, rows] of Object.entries(dirs)) {
    parts.push(`Bumps the npm-all group with ${rows.length} updates in the ${dir} directory:\n`);
    parts.push("| Package | From | To |\n| --- | --- | --- |");
    for (const [name, from, to] of rows) {
      parts.push(`| [${name}](https://example.com/${name}) | \`${from}\` | \`${to}\` |`);
      updates.push(`Updates \`${name}\` from ${from} to ${to}`);
    }
    parts.push("");
  }
  return {
    number,
    headRefName: `dependabot/${eco}/npm-all-${number}`,
    title: `chore(deps): bump the npm-all group across ${Object.keys(dirs).length} directories with N updates`,
    body: `${parts.join("\n")}\n\n${updates.join("\n<details></details>\n\n")}\n`,
    labels: [{ name: "dependencies" }],
  };
};

const cases = [
  {
    name: "security PR for X stays open when the new group lacks X",
    newPr: group(200, { "/web": [["vite", "7.1.12", "8.3.5"]] }),
    open: [sec(190, "jsdom", "27.1.0", "27.1.4")],
    close: [],
  },
  {
    name: "security PR for X closes when the new group bumps X higher",
    newPr: group(200, { "/web": [["jsdom", "27.1.0", "30.1.3"], ["vite", "7.1.12", "8.3.5"]] }),
    open: [sec(190, "jsdom", "27.1.0", "27.1.4")],
    close: [190],
  },
  {
    name: "the same version counts as at or above",
    newPr: group(200, { "/web": [["jsdom", "27.1.0", "27.1.4"]] }),
    open: [sec(190, "jsdom", "27.1.0", "27.1.4")],
    close: [190],
  },
  {
    name: "security PR stays open when the group bumps X lower",
    newPr: group(200, { "/web": [["jsdom", "27.1.0", "27.1.3"]] }),
    open: [sec(190, "jsdom", "27.1.0", "27.1.4")],
    close: [],
  },
  {
    name: "security PR stays open when the group bumps X only in another directory",
    newPr: group(200, { "/backend": [["jsdom", "27.1.0", "30.1.3"]] }),
    open: [sec(190, "jsdom", "27.1.0", "27.1.4", "/web")],
    close: [],
  },
  {
    name: "security PR stays open when its name is a prefix of the group's dependency",
    newPr: group(200, { "/web": [["jsdom-global", "1.0.0", "9.0.0"]] }),
    open: [sec(190, "jsdom", "27.1.0", "27.1.4")],
    close: [],
  },
  {
    name: "a security PR with no marker in its text is still security (single dependency)",
    newPr: group(200, { "/web": [["vite", "7.1.12", "8.3.5"]] }),
    open: [sec(190, "jsdom", "27.1.0", "27.1.4", "/web", "")],
    close: [],
  },
  {
    name: "a GHSA id marks a PR as security even in a group",
    newPr: group(200, { "/web": [["vite", "7.1.12", "8.3.5"]] }),
    open: [{ ...group(190, { "/web": [["jsdom", "27.1.0", "27.1.4"]] }), body: "Fixes GHSA-abcd-efgh-ijkl." }],
    close: [],
  },
  {
    name: "unparseable PRs stay open",
    newPr: group(200, { "/web": [["vite", "7.1.12", "8.3.5"]] }),
    open: [
      { number: 191, headRefName: "dependabot/npm_and_yarn/web/x", title: "chore(deps): something odd", body: "", labels: [] },
      { number: 192, headRefName: "dependabot/npm_and_yarn/web/x", title: "chore(deps): bump vite", body: "garbled", labels: [] },
    ],
    close: [],
  },
  {
    name: "incomparable versions stay open",
    newPr: group(200, { "/web": [["jsdom", "27.1.0", "abc123"]] }),
    open: [sec(190, "jsdom", "27.1.0", "27.1.4")],
    close: [],
  },
  {
    name: "version-update group PRs still close",
    newPr: group(200, { "/web": [["vite", "7.1.12", "8.3.5"]] }),
    open: [group(150, { "/web": [["react", "18.3.1", "19.3.1"]] }), group(160, { "/backend": [["pino", "10.1.0", "10.4.0"]] })],
    close: [150, 160],
  },
  {
    name: "only lower-numbered PRs in the same ecosystem are touched",
    newPr: group(200, { "/web": [["vite", "7.1.12", "8.3.5"]] }),
    open: [
      group(210, { "/web": [["react", "18.3.1", "19.3.1"]] }),
      { ...group(150, { "/web": [["react", "18.3.1", "19.3.1"]] }), headRefName: "dependabot/docker/web/x" },
      group(140, { "/web": [["react", "18.3.1", "19.3.1"]] }),
    ],
    close: [140],
  },
];

for (const c of cases) {
  test(c.name, () => {
    assert.deepEqual(selectToClose(c.newPr, c.open), c.close);
  });
}

test("real formats from this repo parse (#153, #135, #137, #139)", () => {
  const g153 = {
    title: "chore(deps): bump the npm-all group across 2 directories with 12 updates",
    body: [
      "Bumps the npm-all group with 1 update in the /backend directory: [@types/node](https://x).",
      "Bumps the npm-all group with 12 updates in the /web directory:",
      "",
      "| Package | From | To |",
      "| --- | --- | --- |",
      "| [@types/node](https://x) | `22.19.0` | `26.6.6` |",
      "| [vite](https://x) | `7.1.12` | `8.3.5` |",
      "",
      "",
      "Updates `@types/node` from 22.19.0 to 26.6.6",
      "Updates `@types/node` from 22.19.0 to 26.6.6",
      "Updates `vite` from 7.1.12 to 8.3.5",
    ].join("\n"),
  };
  const u = parseUpdates(g153);
  assert.ok(u.some((x) => x.name === "@types/node" && x.dir === "/backend" && x.to === "26.6.6"));
  assert.ok(u.some((x) => x.name === "@types/node" && x.dir === "/web" && x.to === "26.6.6"));
  assert.ok(u.some((x) => x.name === "vite" && x.dir === "/web" && x.to === "8.3.5"));

  const d135 = {
    title: "chore(docker): bump the base-images group across 2 directories with 1 update",
    body: "Bumps the base-images group with 1 update in the /backend directory: node.\nBumps the base-images group with 1 update in the /web directory: node.\n\nUpdates `node` from 24-alpine to 26-alpine\n\nUpdates `node` from 24-alpine to 26-alpine\n",
  };
  assert.ok(parseUpdates(d135).some((x) => x.name === "node" && x.dir === "/web" && x.to === "26-alpine"));
  assert.equal(isSecurity(d135), false);

  const a137 = {
    title: "ci: bump hadolint/hadolint-action from 3.1.0 to 3.5.0 in the actions group",
    body: "Bumps the actions group with 1 update: [hadolint/hadolint-action](https://x).\n\nUpdates `hadolint/hadolint-action` from 3.1.0 to 3.5.0\n",
  };
  assert.ok(parseUpdates(a137).some((x) => x.name === "hadolint/hadolint-action" && x.dir === "/" && x.to === "3.5.0"));
  assert.equal(isSecurity(a137), false);

  const s139 = { title: "chore(backend): bump typescript from 5.9.3 to 7.0.2 in /backend", body: "Bumps [typescript](https://x) from 5.9.3 to 7.0.2." };
  assert.deepEqual(parseUpdates(s139), [{ name: "typescript", to: "7.0.2", dir: "/backend" }]);
  assert.equal(isSecurity(s139), true);
});

test("compareVersions", () => {
  const rows = [
    ["1.2.3", "1.2.3", 0],
    ["1.2.4", "1.2.3", 1],
    ["1.10.0", "1.9.9", 1],
    ["1.2", "1.2.0", 0],
    ["v2.0.0", "1.9.0", 1],
    ["26-alpine", "24-alpine", 1],
    ["26-alpine", "26", null],
    ["sha256abc", "1.0.0", null],
  ];
  for (const [a, b, want] of rows) assert.equal(compareVersions(a, b), want, `${a} vs ${b}`);
});
