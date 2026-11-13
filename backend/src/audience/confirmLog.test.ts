import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ANNOUNCE_SETTINGS } from "../announce/schemas.js";
import { logger } from "../logger.js";
import { emailService } from "../services/email.service.js";
import type { Contact } from "./schemas.js";

vi.mock("../announce/store.js", () => ({ loadSettings: async () => DEFAULT_ANNOUNCE_SETTINGS }));
vi.mock("./tokens.js", () => ({ signToken: async () => "tok", expiresIn: () => 1 }));

import { sendConfirmMail } from "./mail.js";

afterEach(() => vi.restoreAllMocks());

describe("confirmation mail failure log", () => {
  it("never carries the provider's error text, which can quote the address", async () => {
    vi.spyOn(emailService, "sendTo").mockResolvedValue({ ok: false, error: "550 5.1.1 <victim@example.org>: rejected", kind: "hard" } as never);
    const spy = vi.spyOn(logger, "warn");
    const ok = await sendConfirmMail({ email: "victim@example.org", lang: "en" } as Contact, "a".repeat(32));
    expect(ok).toBe(false);
    expect(spy).toHaveBeenCalled();
    expect(JSON.stringify(spy.mock.calls)).not.toContain("victim");
  });
});
