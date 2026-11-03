import { describe, expect, it } from "vitest";
import { NAME_HE, withHebrewName } from "@/data/identity";
import { documentTitleFor, pageIdentityFor } from "@/lib/pageTitle";

/*
 * The Hebrew name (#308): beside the Latin one in the Hebrew home page's fact
 * line, and at the end of every Hebrew title, exactly as the server render
 * prints them (backend/src/routes/seo-identity.test.ts holds the other side).
 */
describe("the owner's Hebrew name", () => {
  it("stands beside the Latin name on a Hebrew page, and only there", () => {
    expect(withHebrewName("Yehuda Briskman — פול־סטאק, עם דגש על פרונטאנד", "he")).toBe(
      "Yehuda Briskman (יהודה בריסקמן) — פול־סטאק, עם דגש על פרונטאנד",
    );
    expect(withHebrewName("Yehuda Briskman — full-stack, mostly frontend", "en")).toBe(
      "Yehuda Briskman — full-stack, mostly frontend",
    );
    expect(withHebrewName(`${NAME_HE} — פול־סטאק`, "he")).toBe(`${NAME_HE} — פול־סטאק`);
  });

  it("ends the Hebrew titles, and the Latin name ends the English ones", () => {
    expect(documentTitleFor("פרויקטים", "he")).toBe("פרויקטים · יהודה בריסקמן");
    expect(documentTitleFor("Work", "en")).toBe("Work · Yehuda Briskman");
    expect(pageIdentityFor("/projects", "he").title).toBe("פרויקטים · יהודה בריסקמן");
    expect(pageIdentityFor("/", "he").title).toBe("יהודה בריסקמן (Yehuda Briskman) · מהנדס פול־סטאק וראש צוות טכני");
  });
});
