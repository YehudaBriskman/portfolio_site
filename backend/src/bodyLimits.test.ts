import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app";

// Stubbed only so this file loads on a box without those optional deps; CI has them.
vi.mock("./mcp/router.js", () => ({ createMcpRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("./mcp/oauth/provider.js", () => ({ grantDocId: (i: string) => `mcpgrant:${i}`, grantLive: () => false, revokeGrant: async () => {} }));
vi.mock("./services/mediaImage.js", () => ({}));
vi.mock("./services/svgSanitize.js", () => ({}));
vi.mock("./routes/images.route", () => ({ createImagesRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("./routes/media.admin.route.js", async () => ({ default: (await import("express")).Router() }));

const big = (n: number) => JSON.stringify({ email: "a@example.org", lang: "en", website: "x".repeat(n) });

describe("public write routes read small bodies", () => {
  it("refuses a signup body over the small limit before it is parsed as a 1 MB document", async () => {
    const r = await request(createApp()).post("/api/subscribe").set("Content-Type", "application/json").send(big(20_000));
    expect(r.status).toBe(413);
  });

  it("refuses an oversized contact-form body", async () => {
    const r = await request(createApp()).post("/api/email/send").set("Content-Type", "application/json").send(big(100_000));
    expect(r.status).toBe(413);
  });

  it("still takes a normal signup body", async () => {
    const r = await request(createApp()).post("/api/subscribe").set("Content-Type", "application/json").send(JSON.stringify({ email: "a@example.org", lang: "en", website: "bot" }));
    expect(r.status).toBe(202);
  });
});
