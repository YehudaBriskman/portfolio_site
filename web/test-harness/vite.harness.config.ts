// Test-only: builds the screenshot harness. `npx vite build -c test-harness/vite.harness.config.ts`
import { defineConfig, mergeConfig } from "vite";
import base from "../vite.config";

export default defineConfig((env) =>
  mergeConfig(typeof base === "function" ? base(env) : base, {
    root: "test-harness",
    build: {
      outDir: "../dist-harness",
      emptyOutDir: true,
      rollupOptions: { input: "test-harness/disclosure.html" },
    },
  }),
);
