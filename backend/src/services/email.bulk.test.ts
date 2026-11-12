import { describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("../providers/index.js", () => ({ getProvider: () => ({ send }) }));

import { sendBulk } from "./email.service.js";

describe("sendBulk", () => {
  it("sends one message per recipient with its own To and headers, and reports each result", async () => {
    send.mockResolvedValueOnce({ ok: true, messageId: "1" }).mockResolvedValueOnce({ ok: false, error: "boom" }).mockRejectedValueOnce(new Error("thrown"));
    const msgs = ["a", "b", "c"].map((x) => ({ to: `${x}@example.com`, subject: "s", text: "t", html: "h", headers: { "List-Unsubscribe": `<https://x/${x}>` } }));
    const r = await sendBulk(msgs, { from: "F <f@example.com>", replyTo: "r@example.com" });
    expect(r).toEqual([{ ok: true }, { ok: false, error: "boom" }, { ok: false, error: "thrown" }]);
    expect(send.mock.calls.map(([m]) => [m.to, m.headers["List-Unsubscribe"], m.from, m.replyTo])).toEqual([
      ["a@example.com", "<https://x/a>", "F <f@example.com>", "r@example.com"],
      ["b@example.com", "<https://x/b>", "F <f@example.com>", "r@example.com"],
      ["c@example.com", "<https://x/c>", "F <f@example.com>", "r@example.com"],
    ]);
  });
});
