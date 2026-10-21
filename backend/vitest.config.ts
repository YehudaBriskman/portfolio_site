import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    // src/env.ts parses process.env at import time, so the module graph fails
    // to load before a single test runs if the schema is unsatisfied. Without
    // this, `npm test` only worked on a machine that already had a filled-in
    // .env - not on a fresh clone, and not in CI.
    setupFiles: ['./src/test-env.ts'],
    coverage: { reporter: ['text', 'html'] },
  },
});
