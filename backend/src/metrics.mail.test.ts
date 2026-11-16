import { beforeEach, describe, expect, it } from "vitest";
import { instrumentProvider, metricsRegistry, resetMetrics } from "./metrics.js";

const count = async (result: string) => {
  const m = await metricsRegistry.getSingleMetric("mail_send_total")!.get();
  return m.values.find((v) => v.labels.result === result)?.value ?? 0;
};

describe("mail_send_total", () => {
  beforeEach(resetMetrics);
  const wrap = (r: unknown) => instrumentProvider({ send: async () => r as never });

  it("counts ok, failed and blocked (policy) sends, and nothing about the mail", async () => {
    await wrap({ ok: true, messageId: "x" }).send({} as never);
    await wrap({ ok: false, error: "to a@b.c failed", kind: "hard" }).send({} as never);
    await wrap({ ok: false, error: "Sending is disabled", kind: "policy" }).send({} as never);
    await wrap({ ok: false, error: "x" }).send({} as never);
    expect(await count("ok")).toBe(1);
    expect(await count("failed")).toBe(2);
    expect(await count("blocked")).toBe(1);
    expect(await metricsRegistry.metrics()).not.toContain("a@b.c");
  });

  it("counts a throwing provider as failed and rethrows", async () => {
    const p = instrumentProvider({ send: async () => { throw new Error("boom"); } });
    await expect(p.send({} as never)).rejects.toThrow("boom");
    expect(await count("failed")).toBe(1);
  });
});
