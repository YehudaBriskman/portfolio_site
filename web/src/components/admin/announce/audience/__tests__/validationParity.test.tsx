import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { z } from "zod";
import AddContact from "@/components/admin/announce/audience/AddContact";
import { previewCsv } from "@/components/admin/announce/audience/csv";
import { adminAudience } from "@/services/adminAudience";

/* UI hunt h4: form state and validation parity. Each test passes once the bug is fixed. */

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("Add contact (h4)", () => {
  /* B-h4-17 */
  it("a consent note shorter than the server's 3 characters is stopped before the request", async () => {
    const add = vi.spyOn(adminAudience, "addContact").mockResolvedValue({});
    render(<AddContact groups={[]} onClose={() => undefined} onDone={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "dana@example.com" } });
    fireEvent.change(screen.getByLabelText(/consent|how did|where did/i, { selector: "textarea" }), { target: { value: "ok" } });
    fireEvent.click(screen.getByRole("button", { name: /^add/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(add).not.toHaveBeenCalled();
  });

  /* B-h4-18 */
  it("an address the server's email rule refuses must not be sent as a valid one (no field message today, only 'could not save')", async () => {
    const add = vi.spyOn(adminAudience, "addContact").mockResolvedValue({});
    render(<AddContact groups={[]} onClose={() => undefined} onDone={() => undefined} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "not an address" } });
    fireEvent.change(screen.getByLabelText(/consent|how did|where did/i, { selector: "textarea" }), { target: { value: "asked me at the meetup" } });
    fireEvent.click(screen.getByRole("button", { name: /^add/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(add).not.toHaveBeenCalled();
  });
});

describe("CSV import preview (h4)", () => {
  /* B-h4-19 */
  it("preview 'valid' must agree with the server's email rule (zod .email(): TLD of 2+ letters, no '..')", () => {
    const rule = z.string().trim().toLowerCase().max(254).email();
    const cases = ["a@b.c", "dana@example.c", "a..b@example.com", ".dana@example.com", "dana@-example.com"];
    const disagree = previewCsv(cases.join("\n"))
      .map((r) => ({ email: r.email, preview: r.valid, server: rule.safeParse(r.email).success }))
      .filter((r) => r.preview !== r.server);
    expect(disagree).toEqual([]);
  });
});
