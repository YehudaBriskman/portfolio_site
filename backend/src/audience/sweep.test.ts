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
import { hashEmail, MINIMISE_AFTER_DAYS, resetPurgeClock } from "./store.js";
import { ledgerGet } from "./ledger.js";
import { ledgerGuard } from "../campaigns/guard.js";
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
  vi.spyOn(couch, "docs").mockImplementation(async <R>(ids: string[]) => ids.flatMap((i) => (store.has(i) ? [structuredClone(store.get(i)) as R] : [])));
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
    expect(await runAudienceSweep()).toEqual({ purged: 1, minimised: 0 });
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

const admin = (req: request.Test) => req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
const unsubscribed = (email: string, daysAgo: number, over: Record<string, unknown> = {}) => {
  const at = new Date(Date.now() - daysAgo * DAY).toISOString();
  const consent = { textId: "site-form-v1", textHash: "abc", lang: "he", at: "2026-01-01T00:00:00.000Z", confirmedAt: "2026-01-01T00:05:00.000Z", source: "site", note: "met at a talk" };
  return put(email, { status: "unsubscribed", unsubscribedAt: at, updatedAt: at, name: "Dana", lang: "he", consent, consentHistory: [consent], ...over });
};

describe("minimisation after unsubscribing", () => {
  it("keeps only the hash, status, times and consent text id after the grace period", async () => {
    const h = unsubscribed("gone@example.com", MINIMISE_AFTER_DAYS + 1);
    expect(await runAudienceSweep()).toMatchObject({ minimised: 1 });
    const c = store.get(`contact:${h}`)!;
    expect(c).toMatchObject({ _id: `contact:${h}`, status: "unsubscribed", email: "", groups: [], consentNote: "site-form-v1" });
    expect(c.name).toBeUndefined();
    expect(c.lang).toBeUndefined();
    expect(c.unsubscribedAt).toBeDefined();
    expect(c.minimisedAt).toBeDefined();
    expect(c.consentHistory).toEqual([{ textId: "site-form-v1", textHash: "abc", at: "2026-01-01T00:00:00.000Z", confirmedAt: "2026-01-01T00:05:00.000Z", source: "site" }]);
    expect(JSON.stringify(c)).not.toContain("gone@example.com");
    expect(JSON.stringify(c)).not.toContain("met at a talk");
    expect((await ledgerGet(h))?.kind).toBe("unsubscribed");
    expect(await getSweepReport()).toMatchObject({ lastMinimised: 1, totalMinimised: 1 });
  });

  it("leaves recent unsubscribes, active, pending and suppressed contacts alone, and is idempotent", async () => {
    const recent = unsubscribed("recent@example.com", MINIMISE_AFTER_DAYS - 1);
    const active = put("act@example.com", { status: "active" });
    const sup = put("sup@example.com", { status: "suppressed" });
    for (const h of [recent, active, sup]) expect((store.get(`contact:${h}`) as { email: string }).email).not.toBe("");
    await runAudienceSweep();
    for (const h of [recent, active, sup]) expect((store.get(`contact:${h}`) as { email: string }).email).not.toBe("");
    unsubscribed("old@example.com", 60);
    expect((await runAudienceSweep())?.minimised).toBe(1);
    expect((await runAudienceSweep())?.minimised).toBe(0);
  });

  it("keeps the address when the ledger cannot be written", async () => {
    const h = unsubscribed("held@example.com", 90);
    const ledger = memoryLedgerStore();
    useLedgerStore(ledger);
    ledger.down = true;
    await runAudienceSweep();
    expect((store.get(`contact:${h}`) as { email: string }).email).toBe("held@example.com");
  });

  it("a person who signs up again after minimisation gets a fresh pending record with their new details", async () => {
    const h = unsubscribed("back@example.com", 90);
    await runAudienceSweep();
    const r = await request(createApp()).post("/api/subscribe").send({ email: "Back@Example.com", name: "Dana", lang: "en" });
    expect(r.status).toBe(202);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(store.get(`contact:${h}`)).toMatchObject({ status: "pending", email: "back@example.com", name: "Dana", lang: "en" });
    expect((store.get(`contact:${h}`) as { minimisedAt?: string }).minimisedAt).toBeUndefined();
  });

  it("the ledger guard still blocks a returning address: a restored active copy is put back to unsubscribed", async () => {
    const h = unsubscribed("restored@example.com", 90);
    await runAudienceSweep();
    // A restore brings the old, active document back.
    put("restored@example.com", { status: "active", _rev: undefined });
    expect(await ledgerGuard(Date.now() + 11 * 60_000)).toMatchObject({ ok: true, repaired: 1 });
    expect((store.get(`contact:${h}`) as { status: string }).status).toBe("unsubscribed");
  });

  it("the admin cannot edit a minimised contact", async () => {
    const h = unsubscribed("nope@example.com", 90);
    await runAudienceSweep();
    const r = await admin(request(createApp()).patch(`/api/admin/audience/contacts/${h}`)).send({ name: "X" });
    expect(r.status).toBe(409);
  });

  it("logs no address", async () => {
    unsubscribed("quiet.person@example.com", 90);
    await runAudienceSweep();
    expect(logged.join("\n")).not.toContain("quiet.person");
  });
});

describe("export everything about an address", () => {
  const exportOf = (email: string) => admin(request(createApp()).post("/api/admin/audience/contacts/data-export")).send({ email });

  it("returns one JSON file with the record, consent history, never-mail line and campaign mails", async () => {
    const h = unsubscribed("who@example.com", 3);
    await (await import("./ledger.js")).ledgerPut(h, "unsubscribed");
    store.set(`send:camp1:${h}`, { _id: `send:camp1:${h}`, _rev: "1-a", type: "send", campaignId: "camp1", contact: h, status: "sent", at: "2026-02-01T00:00:00.000Z" });
    store.set(`send:camp1:${hashEmail("other@example.com")}`, { _id: `send:camp1:x`, type: "send", campaignId: "camp1", status: "sent", at: "z" });
    const r = await exportOf("Who@Example.com");
    expect(r.status).toBe(200);
    expect(r.headers["content-disposition"]).toContain("attachment");
    const body = JSON.parse(r.text);
    expect(body.fingerprint).toBe(h);
    expect(body.contact).toMatchObject({ email: "who@example.com", name: "Dana", status: "unsubscribed" });
    expect(body.contact._rev).toBeUndefined();
    expect(body.contact.consentHistory).toHaveLength(1);
    expect(body.neverMailLine).toMatchObject({ kind: "unsubscribed" });
    expect(body.campaignMails).toEqual([{ campaign: "camp1", status: "sent", at: "2026-02-01T00:00:00.000Z" }]);
  });

  it("answers for a minimised contact with only what is left", async () => {
    const h = unsubscribed("min@example.com", 90);
    await runAudienceSweep();
    const body = JSON.parse((await exportOf("min@example.com")).text);
    expect(body.contact).toMatchObject({ email: "", status: "unsubscribed" });
    expect(body.fingerprint).toBe(h);
  });

  it("says nothing is held for an unknown address, and keeps the address out of logs and the audit trail", async () => {
    expect((await exportOf("ghost@example.com")).status).toBe(404);
    unsubscribed("held@example.com", 3);
    await exportOf("held@example.com");
    const trail = [...store.entries()].filter(([id]) => id.startsWith("audit:")).map(([, d]) => JSON.stringify(d)).join("\n");
    expect(trail).toContain("contact:");
    for (const text of [trail, logged.join("\n")]) {
      expect(text).not.toContain("ghost@");
      expect(text).not.toContain("held@");
    }
  });

  it("is admin only and rejects a malformed address", async () => {
    expect((await request(createApp()).post("/api/admin/audience/contacts/data-export").send({ email: "a@example.com" })).status).toBeGreaterThanOrEqual(401);
    expect((await exportOf("not-an-address")).status).toBe(400);
  });
});
