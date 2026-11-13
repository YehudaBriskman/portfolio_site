// Test-only: builds the phone-parts screenshot harness. `npx vite build -c test-harness/vite.mobile.config.ts`
import { defineConfig, mergeConfig } from "vite";
import base from "../vite.config";

export default defineConfig((env) =>
  mergeConfig(typeof base === "function" ? base(env) : base, {
    root: "test-harness",
    build: {
      outDir: "../dist-harness-mobile",
      emptyOutDir: true,
      rollupOptions: { input: "test-harness/mobile.html" },
    },
  }),
);
