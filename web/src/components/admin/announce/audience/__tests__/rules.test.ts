import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CONSENT_NOTE_MAX, CONSENT_NOTE_MIN } from "../rules";

const server = readFileSync(resolve(__dirname, "../../../../../../../backend/src/audience/schemas.ts"), "utf8");

describe("audience rules match the server", () => {
  it("uses the server's email chain", () => {
    expect(server).toContain("export const Email = z.string().trim().toLowerCase().max(254).email();");
    expect(readFileSync(resolve(__dirname, "../rules.ts"), "utf8")).toContain("z.string().trim().toLowerCase().max(254).email()");
  });
  it("uses the server's consent note length", () => {
    expect(server).toContain(`consentNote: z.string().trim().min(${CONSENT_NOTE_MIN}).max(${CONSENT_NOTE_MAX})`);
  });
});
