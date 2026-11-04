import fs from "fs";
import path from "path";

/*
 * src/i18n/glossary.{json,ts} are byte-for-byte copies of the web app's
 * (web/src/i18n/), which is where the glossary is edited. The backend image is
 * built from backend/ alone, so it cannot import ../web; it carries the copy
 * for the MCP's glossary resource and put_translation's lint (#307).
 * If this fails: cp web/src/i18n/glossary.json web/src/i18n/glossary.ts backend/src/i18n/
 */
const WEB = path.resolve(__dirname, "../../../web/src/i18n");

describe("src/i18n is in sync with web/src/i18n", () => {
  it.each(["glossary.json", "glossary.ts"])("%s", (f) => {
    const want = fs.readFileSync(path.join(WEB, f), "utf8");
    const have = fs.readFileSync(path.join(__dirname, f), "utf8");
    expect(have === want, "stale copy: cp web/src/i18n/glossary.* backend/src/i18n/").toBe(true);
  });
});
