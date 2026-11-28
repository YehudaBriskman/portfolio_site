// Correctness rules only, no style rules (#610). The same majors as
// web/eslint.config.js.
//
// typescript-eslint needs the TypeScript compiler API, which TypeScript 7 does
// not ship. So in package.json `typescript` is the 6.x compatibility package
// (what this linter loads) and `@typescript/native` is TypeScript 7, which
// `npm run build` runs by path: the 6.x package installs a `tsc` bin too, so
// the name alone does not say which one runs. Undo both aliases once
// typescript-eslint supports TypeScript 7.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage"] },
  {
    files: ["**/*.{ts,mts,cts,js,mjs,cjs}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      // A leading underscore marks a binding that is unused on purpose, mostly
      // `const { _rev: _r, ...rest } = doc` to drop fields.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // Baseline (#610): the input validators match control characters on
      // purpose. A warning, so a new one is still seen.
      "no-control-regex": "warn",
    },
  },
  {
    // Baseline (#610): tests read loosely typed response bodies.
    files: ["**/*.test.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "warn" },
  },
  {
    // Baseline (#610): generated from mcp/src by mcp/scripts/sync-shared.mjs
    // and held identical by a test, so it cannot be edited here.
    files: ["src/mcp/shared/**/*.ts"],
    rules: { "@typescript-eslint/no-unused-expressions": "warn" },
  },
);
