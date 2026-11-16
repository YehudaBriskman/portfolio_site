import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { createApp } from "./app";
import { couch, CouchError } from "./db/couch.js";
import { emailService } from "./services/email.service.js";
import { memoryLedgerStore, useLedgerStore } from "./audience/ledger.js";
import { resetGuard } from "./campaigns/guard.js";
import { resetContactGuard } from "./services/contactGuard.js";
import { resetSecretCache, signToken, expiresIn } from "./audience/tokens.js";
import { hashEmail, resetPurgeClock } from "./audience/store.js";
import { createMetricsApp, metricsRegistry, resetMetrics } from "./metrics.js";
import { createMailBurstLimiter } from "./rate-limit.js";

vi.mock("./mcp/router.js", () => ({ createMcpRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("./mcp/oauth/provider.js", () => ({ grantDocId: (i: string) => `mcpgrant:${i}`, grantLive: () => false, revokeGrant: async () => {} }));
vi.mock("./services/mediaImage.js", () => ({}));
vi.mock("./services/svgSanitize.js", () => ({}));
vi.mock("./routes/images.route", () => ({ createImagesRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("./routes/media.admin.route.js", async () => ({ default: (await import("express")).Router() }));

const ADDRESS = "Secret.Person@Example.com";
let store: Map<string, Record<string, unknown>>;
let revs = 0;
let sent: Array<{ to: string; text: string }>;

beforeEach(() => {
  resetMetrics();
  store = new Map();
  sent = [];
  resetSecretCache();
  resetPurgeClock();
  vi.spyOn(couch, "get").mockImplementation(async <R>(id: string) => {
    const d = store.get(id);
    if (!d) throw new CouchError(404, "404");
    return structuredClone(d) as R;
  });
  vi.spyOn(couch, "put").mockImplementation(async <R>(id: string, body: unknown) => {
    const doc = body as { _rev?: string };
    const ex = store.get(id);
    if (ex ? doc._rev !== ex._rev : doc._rev !== undefined) throw new CouchError(409, "409");
    store.set(id, { ...structuredClone(doc), _rev: `${++revs + 1}-x` });
    return { ok: true, id, rev: "x" } as R;
  });
  vi.spyOn(couch, "append").mockImplementation(async <R>(id: string, body: Record<string, unknown>) => {
    if (store.has(id)) throw new CouchError(409, "409");
    store.set(id, { ...structuredClone(body), _rev: `${++revs + 1}-x` });
    return { ok: true, id } as R;
  });
  vi.spyOn(couch, "del").mockImplementation(async (id: string) => {
    if (!store.delete(id)) throw new CouchError(404, "404");
    return { ok: true };
  });
  vi.spyOn(couch, "find").mockImplementation(async () => ({ docs: [] as never[] }));
  vi.spyOn(couch, "docs").mockImplementation(async <R>(ids: string[]) => ids.flatMap((i) => (store.has(i) ? [structuredClone(store.get(i)) as R] : [])));
  useLedgerStore(memoryLedgerStore());
  resetGuard();
  resetContactGuard();
  vi.spyOn(emailService, "sendTo").mockImplementation(async (m) => {
    sent.push(m);
    return { ok: true, messageId: "m" };
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  useLedgerStore();
});

const scrape = async () => {
  const r = await request(createMetricsApp()).get("/metrics");
  expect(r.status).toBe(200);
  return r.text;
};

describe("the metrics endpoint", () => {
  it("serves the Prometheus text format with process metrics", async () => {
    const text = await scrape();
    expect(text).toContain("process_cpu_user_seconds_total");
    expect(text).toContain("# TYPE http_requests_total counter");
  });

  it("answers nothing but GET /metrics on its own app", async () => {
    const m = createMetricsApp();
    expect((await request(m).get("/api/blog/posts")).status).toBe(404);
    expect((await request(m).post("/metrics")).status).toBe(404);
  });

  it("requires the bearer token when one is configured", async () => {
    const m = createMetricsApp("a-long-enough-token-1234");
    expect((await request(m).get("/metrics")).status).toBe(401);
    expect((await request(m).get("/metrics").set("Authorization", "Bearer nope")).status).toBe(401);
    expect((await request(m).get("/metrics").set("Authorization", "Bearer a-long-enough-token-1234")).status).toBe(200);
  });

  it("is not served by the public API app", async () => {
    const r = await request(createApp()).get("/metrics");
    expect(r.status).toBe(404);
    expect(r.text).not.toContain("http_requests_total");
  });
});

describe("http metrics", () => {
  it("labels by route template and status class, never the raw path", async () => {
    const a = createApp();
    await request(a).get("/health");
    await request(a).get("/health");
    await request(a).get("/some/path/nobody-routed/12345?q=" + encodeURIComponent(ADDRESS));
    const text = await scrape();
    expect(text).toMatch(/http_requests_total\{method="GET",route="\/health",status_class="2xx"\} 2/);
    expect(text).toMatch(/http_requests_total\{method="GET",route="unmatched",status_class="4xx"\} 1/);
    expect(text).not.toContain("nobody-routed");
    expect(text).toContain("http_request_duration_seconds_bucket");
  });
});

describe("rate limit hits", () => {
  it("counts a refusal under the limiter's name", async () => {
    const app = express();
    app.use("/x", createMailBurstLimiter(), (_q, r) => void r.json({ ok: true }));
    for (let i = 0; i < 41; i++) await request(app).get("/x");
    const text = await scrape();
    expect(text).toMatch(/rate_limit_hits_total\{route="email_burst"\} 1/);
  });
});

describe("privacy: no label ever carries a person or a credential", () => {
  it("keeps an address, its hash, a token and an IP out of the output", async () => {
    const a = createApp();
    const ip = "203.0.113.77";
    const sub = await request(a).post("/api/subscribe").set("X-Forwarded-For", `${ip}, 10.0.0.1`).send({ email: ADDRESS, name: "Zed Unique", lang: "en" });
    expect(sub.status).toBe(202);
    await vi.waitFor(() => expect(sent.length).toBeGreaterThan(0));
    const h = hashEmail(ADDRESS);
    const confirm = await signToken({ t: "confirm", h, exp: expiresIn(3600) });
    const unsub = await signToken({ t: "unsub", h, exp: expiresIn(3600) });
    await request(a).post("/api/subscribe/confirm").set("X-Forwarded-For", ip).send({ token: confirm });
    await request(a).post("/api/subscribe/unsubscribe").set("X-Forwarded-For", ip).send({ token: unsub });
    await request(a).post("/api/subscribe/unsubscribe?token=" + unsub).type("form").send("List-Unsubscribe=One-Click");
    await request(a).post("/api/subscribe").send({ email: "not-an-email" });

    const text = await scrape();
    const secrets = [ADDRESS, "secret.person", "example.com", "Zed", h, h.slice(0, 6), confirm, unsub, ip, "token", encodeURIComponent(ADDRESS)];
    for (const s of secrets) expect(text.toLowerCase(), s).not.toContain(s.toLowerCase());
    expect(text).toMatch(/signup_total\{result="created"\} 1/);
    expect(text).toMatch(/signup_total\{result="invalid"\} 1/);
    expect(text).toMatch(/signup_total\{result="confirmed"\} 1/);
    expect(text).toMatch(/signup_total\{result="unsubscribed"\} 1/);
    expect(text).toContain('route="/api/subscribe/');
  });

  it("only uses bounded mail_send_total values", async () => {
    expect(metricsRegistry.getSingleMetric("mail_send_total")).toBeDefined();
    const text = await scrape();
    for (const line of text.split("\n")) {
      const m = /^mail_send_total\{result="([^"]+)"\}/.exec(line);
      if (m) expect(["ok", "failed", "suppressed", "blocked"]).toContain(m[1]);
    }
  });
});

describe("the proxy never forwards /metrics", () => {
  it("has no nginx location that matches /metrics except the SPA fallback", () => {
    const conf = fs.readFileSync(path.resolve(__dirname, "../../web/nginx.conf.template"), "utf8");
    expect(conf).not.toMatch(/location[^{\n]*metrics/i);
    expect(conf).not.toMatch(/proxy_pass[^;]*metrics/i);
    const prefixes = [...conf.matchAll(/location \^~ (\S+)/g)].map((m) => m[1]);
    for (const p of prefixes) expect("/metrics".startsWith(p)).toBe(false);
  });
});
