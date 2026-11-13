import { describe, expect, it } from "vitest";
import { DEFAULT_SENDER, contactLines, linkedinOk, phoneOk, senderProblems, websiteOk } from "../defaults";

describe("contact block", () => {
  it("is empty by default and prints nothing", () => {
    expect(contactLines(DEFAULT_SENDER)).toEqual([]);
  });
  it("lists only what is filled, in order", () => {
    expect(contactLines({ ...DEFAULT_SENDER, footerIdentity: "Dana", identityEmail: "d@example.org", identityPhone: "050 123 4567" })).toEqual(["Dana", "d@example.org", "050 123 4567"]);
  });
  it("validates like the server", () => {
    expect([websiteOk("http://x.org"), websiteOk("https://u:p@x.org"), websiteOk("https://x.org"), websiteOk("")]).toEqual([false, false, true, true]);
    expect([linkedinOk("https://www.linkedin.com/in/a"), linkedinOk("https://notlinkedin.com/a"), linkedinOk("")]).toEqual([true, false, true]);
    expect([phoneOk("+972 50-123-4567"), phoneOk("<b>"), phoneOk("")]).toEqual([true, false, true]);
    expect(senderProblems({ ...DEFAULT_SENDER, identityWebsite: "x" }).identityWebsite).toBe("address");
  });
});
