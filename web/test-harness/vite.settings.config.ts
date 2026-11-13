// Test-only: builds the settings-kit screenshot harness. `npx vite build -c test-harness/vite.settings.config.ts`
import { defineConfig, mergeConfig } from "vite";
import base from "../vite.config";

export default defineConfig((env) =>
  mergeConfig(typeof base === "function" ? base(env) : base, {
    root: "test-harness",
    build: {
      outDir: "../dist-harness-settings",
      emptyOutDir: true,
      rollupOptions: { input: "test-harness/settings.html" },
    },
  }),
);
