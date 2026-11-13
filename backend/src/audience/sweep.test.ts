import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { emailService } from "../services/email.service.js";
import { DEFAULT_ANNOUNCE_SETTINGS, validateSenderPending } from "../announce/schemas.js";
import { memoryLedgerStore, resetLedgerCache, useLedgerStore } from "./ledger.js";
import { resetGuard } from "../campaigns/guard.js";
import { hashEmail, resetPurgeClock } from "./store.js";
import { getSweepReport, runAudienceSweep, SWEEP_ID } from "./sweep.js";
import { resetSecretCache } from "./tokens.js";

/* Same in-memory couch as audience.test.ts; the MCP router and image pipeline are stubbed only so the app loads here. */
vi.mock("../mcp/router.js", () => ({ createMcpRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("../mcp/oauth/provider.js", () => ({ grantDocId: (i: string) => `mcpgrant:${i}`, grantLive: () => false, revokeGrant: async () => {} }));
vi.mock("../services/mediaImage.js", () => ({}));
vi.mock("../services/svgSanitize.js", () => ({}));
vi.mock("../routes/images.route", () => ({ createImagesRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("../routes/media.admin.route.js", async () => ({ default: (await import("express")).Router() }));

let store: Map<string, Record<string, unknown>>;
let revs = 0;
let sent: Array<{ to: string; text: string }>;
let logged: string[];

beforeEach(() => {
  store = new Map();
  sent = [];
  logged = [];
  resetSecretCache();
  resetPurgeClock();
  resetLedgerCache();
  for (const level of ["info", "warn", "error"] as const) vi.spyOn(logger, level).mockImplementation(((...a: unknown[]) => void logged.push(JSON.stringify(a))) as never);
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
    return { ok: true, id } as R;
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
  vi.spyOn(couch, "find").mockImplementation(async (q: unknown) => {
    const { selector: s, limit = 25 } = q as { selector: { _id: { $gt: string; $lt: string } }; limit?: number };
    const docs = [...store.entries()]
      .filter(([id]) => id > s._id.$gt && id < s._id.$lt)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(0, limit)
      .map(([, d]) => structuredClone(d));
    return { docs: docs as never[] };
  });
  useLedgerStore(memoryLedgerStore());
  resetGuard();
  vi.spyOn(emailService, "sendTo").mockImplementation(async (m) => {
    sent.push(m);
    return { ok: true, messageId: "m" };
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  useLedgerStore();
});

const DAY = 86_400_000;
const put = (email: string, over: Record<string, unknown>) => {
  const h = hashEmail(email);
  const at = new Date(Date.now() - 8 * DAY).toISOString();
  store.set(`contact:${h}`, {
    _id: `contact:${h}`, _rev: "1-a", type: "contact", email, lang: "en", groups: ["subscribers"], status: "pending",
    source: "site", consentAt: at, consentNote: "site-form-v1", topics: { blog: true, releases: true }, createdAt: at, updatedAt: at, ...over,
  });
  return h;
};

describe("scheduled sweep: unconfirmed signups", () => {
  it("deletes pending contacts past the TTL, keeps fresh pending and every other status", async () => {
    const old = put("old@example.com", {});
    const fresh = put("fresh@example.com", { updatedAt: new Date().toISOString() });
    const active = put("active@example.com", { status: "active" });
    const unsub = put("unsub@example.com", { status: "unsubscribed" });
    expect(await runAudienceSweep()).toEqual({ purged: 1 });
    expect(store.has(`contact:${old}`)).toBe(false);
    for (const h of [fresh, active, unsub]) expect(store.has(`contact:${h}`)).toBe(true);
  });

  it("follows the owner's TTL setting", async () => {
    const h = put("three@example.com", { updatedAt: new Date(Date.now() - 4 * DAY).toISOString() });
    expect((await runAudienceSweep())?.purged).toBe(0);
    store.set("settings:announce", {
      _id: "settings:announce", _rev: "1-s", type: "settings-announce", updatedAt: "",
      settings: { ...DEFAULT_ANNOUNCE_SETTINGS, sender: { ...DEFAULT_ANNOUNCE_SETTINGS.sender, pendingTtlDays: 3 } },
    });
    expect((await runAudienceSweep())?.purged).toBe(1);
    expect(store.has(`contact:${h}`)).toBe(false);
  });

  it("is idempotent and records counts for the admin", async () => {
    put("a@example.com", {});
    put("b@example.com", {});
    await runAudienceSweep();
    await runAudienceSweep();
    const r = await getSweepReport();
    expect(r).toMatchObject({ lastPurged: 0, totalPurged: 2 });
    expect(store.has(SWEEP_ID)).toBe(true);
  });

  it("never mails anyone", async () => {
    put("a@example.com", {});
    put("b@example.com", { updatedAt: new Date().toISOString() });
    await runAudienceSweep();
    expect(sent).toHaveLength(0);
  });

  it("a purged address can sign up again and gets a fresh confirmation", async () => {
    const h = put("again@example.com", {});
    await runAudienceSweep();
    expect(store.has(`contact:${h}`)).toBe(false);
    const r = await request(createApp()).post("/api/subscribe").send({ email: "Again@Example.com", lang: "en" });
    expect(r.status).toBe(202);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(store.get(`contact:${h}`)).toMatchObject({ status: "pending" });
  });

  it("a failing sweep does not throw and logs no address", async () => {
    put("secret.person@example.com", {});
    vi.mocked(couch.find).mockRejectedValueOnce(new CouchError(500, "boom"));
    expect(await runAudienceSweep()).not.toBeNull();
    await runAudienceSweep();
    expect(logged.join("\n")).not.toContain("secret.person");
    expect(logged.join("\n")).not.toContain("@example.com");
  });
});

describe("pendingTtlDays on PUT", () => {
  it("accepts whole days 1 to 30 and names anything else", () => {
    for (const n of [2, 7, 30]) expect(validateSenderPending({ pendingTtlDays: n })).toEqual([]);
    for (const n of [0, 1, 31, 2.5, NaN]) expect(validateSenderPending({ pendingTtlDays: n })).toHaveLength(1);
  });
});

void env;
