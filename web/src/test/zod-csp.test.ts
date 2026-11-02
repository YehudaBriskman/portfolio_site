// @vitest-environment node
/*
 * zod's eval probe stays off, and stays off early enough to matter.
 *
 * Under `script-src 'self'` the probe is a CSP violation on every route (see
 * src/lib/zod-csp.ts). The setting only helps if it lands before the first
 * schema is constructed, so the order of main.tsx's imports is part of it.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import "../lib/zod-csp";

describe("zod under the CSP", () => {
  it("runs jitless, so it never calls new Function", () => {
    expect(z.config().jitless).toBe(true);
  });

  it("is configured by main.tsx's first import, before any schema exists", () => {
    const main = fs.readFileSync(path.resolve(__dirname, "../main.tsx"), "utf8");
    const firstImport = main.match(/^import\s+[^\n]*$/m)?.[0];
    expect(firstImport).toMatch(/['"]\.\/lib\/zod-csp['"]/);
  });
});
