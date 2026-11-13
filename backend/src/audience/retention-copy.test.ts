import { describe, expect, it } from "vitest";
import { MINIMISE_AFTER_DAYS } from "./store.js";

/* The privacy page and the unsubscribe "Done" text say "30 days"
   (web/src/i18n/privacy.ts, subscribe.ts). Changing the constant means changing them. */
describe("the retention the public texts promise", () => {
  it("drops an unsubscribed person's details after 30 days", () => {
    expect(MINIMISE_AFTER_DAYS).toBe(30);
  });
});
