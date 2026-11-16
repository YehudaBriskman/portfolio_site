import { afterEach, describe, expect, it, vi } from "vitest";
import { REKEY_ENV_DEFAULTS } from "./rekey-env";

/*
 * The re-key script is run by hand, rarely, against production. It fills in
 * throwaway values for the env the schema requires but it never uses. When the
 * schema gains a required variable, this fails in CI instead of the operator.
 */
describe("rekey-ledger env defaults", () => {
  const saved = process.env;
  afterEach(() => {
    process.env = saved;
    vi.resetModules();
  });

  it("satisfy the env schema together with the two variables the operator must give", async () => {
    process.env = {
      NODE_ENV: "test",
      ...REKEY_ENV_DEFAULTS,
      COUCHDB_URL: "http://127.0.0.1:5984",
      EMAIL_HASH_KEY: "k".repeat(32),
    };
    vi.resetModules();
    const { env } = await import("../src/env");
    expect(env.EMAIL_HASH_KEY).toBe("k".repeat(32));
  });
});
