import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { env } from "./env.js";

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

describe("the admin gate runs before the body is parsed", () => {
  const asAdmin = (req: request.Test) =>
    req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);

  it("answers an unauthenticated caller before reading a malformed body", async () => {
    const r = await request(createApp()).put("/api/admin/posts/x").set("Content-Type", "application/json").send("{ not json");
    expect([401, 403]).toContain(r.status);
  });

  it("answers an unauthenticated caller before reading a body over the limit", async () => {
    const r = await request(createApp())
      .put("/api/admin/posts/x")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ body: "x".repeat(2 * 1024 * 1024) }));
    expect([401, 403]).toContain(r.status);
  });

  it("still holds an authenticated caller to the 1 MB limit", async () => {
    const r = await asAdmin(request(createApp()).put("/api/admin/posts/x"))
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ body: "x".repeat(2 * 1024 * 1024) }));
    expect(r.status).toBe(413);
  });
});
