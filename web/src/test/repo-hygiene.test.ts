// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WEB = path.resolve(__dirname, "../..");

describe("web package files", () => {
  it("keeps local env files out of the image build context", () => {
    const ignored = fs.readFileSync(path.join(WEB, ".dockerignore"), "utf8").split("\n");
    expect(ignored).toContain(".env");
    expect(ignored).toContain(".env.*");
  });

  it("has one lockfile", () => {
    expect(fs.existsSync(path.join(WEB, "package-lock.json"))).toBe(true);
    for (const other of ["bun.lockb", "bun.lock"]) expect(fs.existsSync(path.join(WEB, other)), other).toBe(false);
  });
});
