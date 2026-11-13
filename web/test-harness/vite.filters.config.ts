// Test-only: builds the filters-kit screenshot harness. `npx vite build -c test-harness/vite.filters.config.ts`
import { defineConfig, mergeConfig } from "vite";
import base from "../vite.config";

export default defineConfig((env) =>
  mergeConfig(typeof base === "function" ? base(env) : base, {
    root: "test-harness",
    build: {
      outDir: "../dist-harness-filters",
      emptyOutDir: true,
      rollupOptions: { input: "test-harness/filters.html" },
    },
  }),
);
