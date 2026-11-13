// Test-only: builds the selection screenshot harness. `npx vite build -c test-harness/vite.selection.config.ts`
import { defineConfig, mergeConfig } from "vite";
import base from "../vite.config";

export default defineConfig((env) =>
  mergeConfig(typeof base === "function" ? base(env) : base, {
    root: "test-harness",
    build: {
      outDir: "../dist-harness-selection",
      emptyOutDir: true,
      rollupOptions: { input: "test-harness/selection.html" },
    },
  }),
);
