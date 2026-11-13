import { describe, expect, it } from "vitest";
import { csvCell, parseCsv, toCsv } from "./csv.js";

describe("csv export", () => {
  it("round-trips an address whose local part starts with '+' unchanged", () => {
    const [[cell]] = parseCsv(toCsv([["+news@example.com", "Dana"]]));
    expect(cell).toBe("+news@example.com");
  });

  it("still neutralises formula starters in cells that are not a valid address", () => {
    for (const v of ["=1+1", "+1+1", "-1+1", "@SUM(A1)", "\tcmd", "\rcmd", "=cmd|' /C calc'!A0", "+x@y", '=HYPERLINK("http://x")@example.com']) {
      expect(csvCell(v).replace(/^"/, "").startsWith("'")).toBe(true);
    }
  });

  it("quotes cells with commas, quotes and newlines", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });
});
