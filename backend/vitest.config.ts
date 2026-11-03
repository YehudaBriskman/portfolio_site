import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // scripts/ holds the content-draft check: it reads backend/content,
    // which the image never copies, so it cannot live under src/ and compile there.
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    // src/env.ts parses process.env at import time, so the module graph fails
    // to load before a single test runs if the schema is unsatisfied. Without
    // this, `npm test` only worked on a machine that already had a filled-in
    // .env - not on a fresh clone, and not in CI.
    setupFiles: ['./src/test-env.ts'],
    coverage: { reporter: ['text', 'html'] },
  },
});
