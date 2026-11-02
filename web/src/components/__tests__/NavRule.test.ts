import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * #117: over a dark act the bar's full-width bottom rule read as a grey line
 * across the page on a phone. The dark material draws no rule; paper keeps
 * one. jsdom resolves no CSS modules, so this reads the sheet — the same way
 * `ground/__tests__/DarkAct.test.tsx` holds the act's own edges.
 */
const CSS = readFileSync(resolve(__dirname, "../Nav.module.css"), "utf8");

const block = (selector: string) => {
  const at = CSS.indexOf(`${selector} {`);
  expect(at, `${selector} exists`).toBeGreaterThan(-1);
  return CSS.slice(at, CSS.indexOf("\n}", at));
};

describe("the bar's bottom rule", () => {
  it("is drawn from --bar-rule, falling back to the paper rule", () => {
    expect(block(".bar")).toMatch(/border-bottom:\s*1px solid var\(--bar-rule, rgb\(var\(--rule-firm\)\)\)/);
  });

  it("is absent in the dark material", () => {
    expect(block(".dock[data-material='dark']")).toMatch(/--bar-rule:\s*transparent;/);
  });
});
