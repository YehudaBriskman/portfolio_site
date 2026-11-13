import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ContactCreate, Email } from "../audience/schemas.js";
import { AnnounceSettingsSchema, DEFAULT_ANNOUNCE_SETTINGS, QuietHoursSchema, SenderSchema, DEFAULT_SENDER } from "./schemas.js";

/*
 * The admin form checks a field before Save with web/src/components/admin/announce/sender/rules.ts.
 * That file's table is run against the real server schemas here, and against the
 * client rules in the web suite: if the two sides drift, one of them fails.
 */
const cases = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../web/src/components/admin/announce/sender/rules.cases.json", import.meta.url)), "utf8"),
) as Record<"email" | "hashtag" | "fromName" | "hhmm" | "contactName", Array<[string, boolean]>>;

const run = (name: keyof typeof cases, accepts: (v: string) => boolean, extra: Array<[string, boolean]> = []) =>
  describe(name, () => {
    for (const [value, ok] of [...cases[name], ...extra]) {
      it(`${JSON.stringify(value.length > 30 ? `${value.slice(0, 12)}…(${value.length})` : value)} -> ${ok}`, () => expect(accepts(value)).toBe(ok));
    }
  });

describe("server accepts exactly what the client rules table says", () => {
  run("email", (v) => Email.safeParse(v).success);
  run("hashtag", (v) => AnnounceSettingsSchema.safeParse({ ...DEFAULT_ANNOUNCE_SETTINGS, hashtags: [v] }).success, [["#" + "a".repeat(40), true], ["#" + "a".repeat(41), false]]);
  run("fromName", (v) => SenderSchema.safeParse({ ...DEFAULT_SENDER, fromName: v }).success, [["a".repeat(80), true], ["a".repeat(81), false]]);
  run("hhmm", (v) => QuietHoursSchema.safeParse({ from: v, to: "07:00", tz: "UTC" }).success);
  run("contactName", (v) => ContactCreate.safeParse({ email: "a@example.com", name: v, lang: "en", consentNote: "asked" }).success, [["a".repeat(80), true], ["a".repeat(81), false]]);
});
