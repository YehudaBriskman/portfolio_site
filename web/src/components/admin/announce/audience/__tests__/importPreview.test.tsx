import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ImportDialog from "../ImportDialog";
import { previewCsv } from "../csv";

afterEach(() => (cleanup(), vi.unstubAllGlobals()));

/* Expected values follow POST /contacts/import in backend/src/audience/admin.route.ts: a header row exists only when a first-row cell trims to "email"; columns come from that header; commas are the only delimiter. */
describe("previewCsv agrees with the server import", () => {
  const table: [string, string, { email: string; name: string; lang: string; valid: boolean }[]][] = [
    ["no header, email first", "a@example.com,Ann,he\n", [{ email: "a@example.com", name: "Ann", lang: "he", valid: true }]],
    ["header email,name", "Email,Name\na@example.com,Ann\n", [{ email: "a@example.com", name: "Ann", lang: "", valid: true }]],
    ["header name,email (B13)", "name,email\nDana,dana@example.com\n", [{ email: "dana@example.com", name: "Dana", lang: "", valid: true }]],
    ["header with spaces and case", " Lang , NAME , E-Mail ,Email\nhe,Ann,x,a@example.com\n", [{ email: "a@example.com", name: "Ann", lang: "he", valid: true }]],
    ["header without a name column", "email\na@example.com\n", [{ email: "a@example.com", name: "", lang: "", valid: true }]],
    ["'e-mail' alone is not a header on the server", "e-mail\na@example.com\n", [{ email: "e-mail", name: "", lang: "", valid: false }, { email: "a@example.com", name: "", lang: "", valid: true }]],
    ["semicolon is not a delimiter (B14)", "dana@example.com;Dana\n", [{ email: "dana@example.com;Dana", name: "", lang: "", valid: false }]],
    ["comma inside quotes", 'a@example.com,"Smith, J"\n', [{ email: "a@example.com", name: "Smith, J", lang: "", valid: true }]],
    ["BOM and CRLF", "﻿a@example.com\r\nb@example.com\r\n", [{ email: "a@example.com", name: "", lang: "", valid: true }, { email: "b@example.com", name: "", lang: "", valid: true }]],
  ];
  it.each(table)("%s", (_n, csv, want) => expect(previewCsv(csv)).toEqual(want));
});

describe("ImportDialog limits match the server", () => {
  const fill = (note: string) => {
    render(<ImportDialog groups={[]} onClose={() => {}} onDone={() => {}} />);
    fireEvent.change(document.querySelector("textarea[aria-label='CSV']")!, { target: { value: "a@example.com" } });
    fireEvent.change(document.querySelector("textarea[maxlength='500']")!, { target: { value: note } });
    fireEvent.click(screen.getByRole("checkbox"));
    return document.querySelector("button[type='submit']") as HTMLButtonElement;
  };

  it("B11 a consent note under 3 characters keeps Import disabled, spaces do not count", () => {
    expect(fill("ok").disabled).toBe(true);
    cleanup();
    expect(fill(" ok ").disabled).toBe(true);
    cleanup();
    expect(fill("yes").disabled).toBe(false);
  });

  it("B12 a file over 900000 characters is refused before it is read", async () => {
    render(<ImportDialog groups={[]} onClose={() => {}} onDone={() => {}} />);
    const big = new File(["a@example.com\n".repeat(75_000)], "big.csv", { type: "text/csv" });
    fireEvent.change(document.querySelector("input[type='file']")!, { target: { files: [big] } });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/900/));
  });

  it("B12 pasted text over 900000 characters keeps Import disabled and says why", () => {
    const run = fill("yes");
    expect(run.disabled).toBe(false);
    fireEvent.change(document.querySelector("textarea[aria-label='CSV']")!, { target: { value: "a@example.com\n".repeat(75_000) } });
    expect(run.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toMatch(/900/);
  });
});
