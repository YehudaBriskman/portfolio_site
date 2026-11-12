import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONSENT_TEXTS, CURRENT_CONSENT_TEXT_ID, consentTextHash, getConsentText } from "./consent-texts.js";

const WEB_FILE = path.resolve(__dirname, "../../../web/src/i18n/subscribe.ts");

/* The consent sentence the signup form shows, in order en then he: `consentBefore` + " " + `consentLink`. */
function shownSentences(): { en: string; he: string } {
  const src = readFileSync(WEB_FILE, "utf8");
  const grab = (key: string) => [...src.matchAll(new RegExp(`^\\s*${key}: ("(?:[^"\\\\]|\\\\.)*"),`, "gm"))].map((m) => JSON.parse(m[1]) as string);
  const before = grab("consentBefore");
  const link = grab("consentLink");
  expect(before).toHaveLength(2);
  expect(link).toHaveLength(2);
  return { en: `${before[0]} ${link[0]}`, he: `${before[1]} ${link[1]}` };
}

describe("consent text registry", () => {
  it("fails when the wording on the signup form changes without a new id being registered", () => {
    const current = getConsentText(CURRENT_CONSENT_TEXT_ID)!;
    const shown = shownSentences();
    expect(shown.en, "web/src/i18n/subscribe.ts consent wording changed: append a NEW entry to CONSENT_TEXTS, do not edit the old one").toBe(current.en);
    expect(shown.he, "web/src/i18n/subscribe.ts consent wording changed: append a NEW entry to CONSENT_TEXTS, do not edit the old one").toBe(current.he);
  });

  it("is append-only: ids are unique, each hash matches its text, and site-form-v1 is frozen", () => {
    expect(new Set(CONSENT_TEXTS.map((t) => t.id)).size).toBe(CONSENT_TEXTS.length);
    for (const t of CONSENT_TEXTS) {
      expect(t.sha256).toBe(consentTextHash(t.he, t.en));
      expect(t.firstShippedIn).toMatch(/^[0-9a-f]{7,40}$/);
    }
    // A literal copy of the hash: editing the v1 text in place must break this, not just re-derive.
    expect(getConsentText("site-form-v1")?.sha256).toBe("9071bf6e6c55960b3c335d0ad6406046463dde78b9c6dc34a5a32eb1863613c4");
    expect(CONSENT_TEXTS[0].id).toBe("site-form-v1");
  });

  it("does not resolve an unknown id", () => {
    expect(getConsentText("nope")).toBeUndefined();
    expect(getConsentText(undefined)).toBeUndefined();
  });
});
