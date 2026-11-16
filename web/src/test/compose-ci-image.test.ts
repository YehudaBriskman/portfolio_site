// @vitest-environment node
/*
 * The CI compose file pulls from the registry, so it must name an image by
 * digest and never by `:latest` (#876). The dev compose file's `:latest` is a
 * locally built tag and is not a pull, so the rule does not apply to it. The
 * same pattern runs in ci.yml's "Compose files parse" step.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");
const MUTABLE = /^\s*image:.*:latest/m;

describe("compose image tags", () => {
  it("the pattern catches a :latest pull", () => {
    expect(MUTABLE.test("services:\n  web:\n    image: ghcr.io/x/web:latest\n")).toBe(true);
    expect(MUTABLE.test("    image: ghcr.io/x/web@sha256:" + "0".repeat(64))).toBe(false);
  });

  it("docker-compose.ci.yml names no :latest image", () => {
    expect(MUTABLE.test(fs.readFileSync(path.join(ROOT, "docker-compose.ci.yml"), "utf8"))).toBe(false);
  });

  it("the dev file's locally built tag is outside the rule", () => {
    const dev = fs.readFileSync(path.join(ROOT, "docker-compose.yml"), "utf8");
    expect(dev).toMatch(/^\s*build:/m);
    expect(dev).toMatch(/image: portfolio_site-web:latest/);
  });
});
