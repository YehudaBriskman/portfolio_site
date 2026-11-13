import { describe, expect, it } from "vitest";
import cases from "../sender/rules.cases.json";
import { contactNameOk, emailOk, fromNameOk, hashtagOk, hhmmOk } from "../sender/rules";

/* The same table is run against the server's schemas in backend/src/announce/rules.parity.test.ts. */
const table = (name: keyof typeof cases, fn: (v: string) => boolean, extra: Array<[string, boolean]> = []) =>
  describe(name, () => {
    for (const [value, ok] of [...(cases[name] as Array<[string, boolean]>), ...extra]) {
      it(`${JSON.stringify(value.length > 30 ? `${value.slice(0, 12)}…(${value.length})` : value)} -> ${ok}`, () => expect(fn(value)).toBe(ok));
    }
  });

describe("client rules agree with the table the server is held to", () => {
  table("email", emailOk);
  table("hashtag", hashtagOk, [["#" + "a".repeat(40), true], ["#" + "a".repeat(41), false]]);
  table("fromName", fromNameOk, [["a".repeat(80), true], ["a".repeat(81), false]]);
  table("hhmm", hhmmOk);
  table("contactName", contactNameOk, [["a".repeat(80), true], ["a".repeat(81), false]]);
});
