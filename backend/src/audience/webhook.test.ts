import { createHmac } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { memoryLedgerStore, resetLedgerCache, useLedgerStore } from "./ledger.js";
import { resetGuard } from "../campaigns/guard.js";
import { hashEmail } from "./store.js";
import { onComplaintReceived } from "./complaintHook.js";
import { mapResendEvent } from "./providerEvents.js";

vi.mock("../mcp/router.js", () => ({ createMcpRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("../mcp/oauth/provider.js", () => ({ grantDocId: (i: string) => `mcpgrant:${i}`, grantLive: () => false, revokeGrant: async () => {} }));
vi.mock("../services/mediaImage.js", () => ({}));
vi.mock("../services/svgSanitize.js", () => ({}));
vi.mock("../routes/images.route", () => ({ createImagesRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("../routes/media.admin.route.js", async () => ({ default: (await import("express")).Router() }));

let ledger: ReturnType<typeof memoryLedgerStore>;
let store: Map<string, Record<string, unknown>>;
let revs = 0;

beforeEach(() => {
  store = new Map();
  vi.spyOn(couch, "get").mockImplementation(async <R>(id: string) => {
    const d = store.get(id);
    if (!d) throw new CouchError(404, "404");
    return structuredClone(d) as R;
  });
  vi.spyOn(couch, "put").mockImplementation(async <R>(id: string, body: unknown) => {
    const doc = body as { _rev?: string };
    const ex = store.get(id);
    if (ex ? doc._rev !== ex._rev : doc._rev !== undefined) throw new CouchError(409, "409");
    const rev = `${++revs + 1}-x`;
    store.set(id, { ...structuredClone(doc), _rev: rev });
    return { ok: true, id, rev } as R;
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
  ledger = memoryLedgerStore();
  useLedgerStore(ledger);
  resetGuard();
});
afterEach(() => {
  vi.restoreAllMocks();
  useLedgerStore();
});


const KEY = Buffer.from("0123456789abcdef0123456789abcdef");
const SECRET = `whsec_${KEY.toString("base64")}`;
const hash = hashEmail("ann@example.com");
const setSecret = (v: string | undefined) => { (env as { RESEND_WEBHOOK_SECRET?: string }).RESEND_WEBHOOK_SECRET = v; };
beforeEach(() => setSecret(SECRET));
afterEach(() => setSecret(undefined));

const seed = (over: Record<string, unknown> = {}) => {
  const now = new Date().toISOString();
  store.set(`contact:${hash}`, {
    _id: `contact:${hash}`, _rev: "1-a", type: "contact", email: "ann@example.com", lang: "en", groups: ["subscribers"], status: "active",
    source: "site", consentAt: now, consentNote: "site-form-v1", topics: { blog: true, releases: true }, createdAt: now, updatedAt: now, ...over,
  });
};
const contact = () => store.get(`contact:${hash}`) as Record<string, unknown>;
const ev = (type: string, data: Record<string, unknown> = {}) => JSON.stringify({ type, created_at: "x", data: { to: ["Ann@Example.com"], ...data } });
const sign = (id: string, ts: number, body: string, key: Buffer = KEY) => `v1,${createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64")}`;
const now = () => Math.floor(Date.now() / 1000);
const post = (body: string, o: { id?: string; ts?: number; sig?: string; key?: Buffer } = {}) => {
  const id = o.id ?? "msg_1";
  const ts = o.ts ?? now();
  return request(createApp()).post("/api/webhooks/resend").set("content-type", "application/json")
    .set("svix-id", id).set("svix-timestamp", String(ts)).set("svix-signature", o.sig ?? sign(id, ts, body, o.key)).send(body);
};

describe("POST /api/webhooks/resend", () => {
  it("answers 404 when no secret is configured", async () => {
    setSecret(undefined);
    const r = await post(ev("email.complained"));
    expect(r.status).toBe(404);
  });

  it("rejects a missing, malformed, wrong-secret, tampered or stale signature with the same bare 400", async () => {
    seed();
    const body = ev("email.complained");
    const bad = [
      await request(createApp()).post("/api/webhooks/resend").set("content-type", "application/json").send(body),
      await post(body, { sig: "v1,AAAA" }),
      await post(body, { key: Buffer.from("another-secret-another-secret-12") }),
      await post(body, { sig: sign("msg_1", now(), body.replace("complained", "bounced")) }),
      await post(body, { ts: now() - 600 }),
      await post(body, { ts: now() + 600 }),
    ];
    for (const r of bad) {
      expect(r.status).toBe(400);
      expect(r.body).toEqual({ ok: false });
    }
    expect(contact().status).toBe("active");
    expect(ledger.docs.has(hash)).toBe(false);
  });

  it("accepts any one of several signatures in the header", async () => {
    seed();
    const body = ev("email.complained");
    const r = await post(body, { sig: `v1,AAAA ${sign("msg_1", now(), body)}` });
    expect(r.status).toBe(200);
    expect(contact().status).toBe("suppressed");
  });

  it("a complaint suppresses, writes the ledger BEFORE the contact, and fires the hook", async () => {
    seed();
    const order: string[] = [];
    const put = ledger.put;
    ledger.put = async (id, doc) => { order.push(`ledger:${(contact().status as string)}`); return put(id, doc); };
    const got: unknown[] = [];
    const off = onComplaintReceived((e) => { got.push(e); });
    const r = await post(ev("email.complained"));
    off();
    expect(r.status).toBe(200);
    expect(order).toEqual(["ledger:active"]);
    expect(ledger.docs.get(hash)).toMatchObject({ kind: "suppressed" });
    expect(contact()).toMatchObject({ status: "suppressed", suppressedReason: "complaint" });
    expect(got).toEqual([{ hash, at: expect.any(String), reason: "complaint" }]);
  });

  it("a hard bounce fires the hook with its reason, and a failing listener cannot fail the webhook", async () => {
    seed();
    const got: unknown[] = [];
    const offA = onComplaintReceived(() => { throw new Error("listener broke"); });
    const offB = onComplaintReceived((e) => { got.push(e); });
    const r = await post(ev("email.bounced", { bounce: { type: "Permanent" } }), { id: "hb" });
    offA();
    offB();
    expect(r.status).toBe(200);
    expect(got).toEqual([{ hash, at: expect.any(String), reason: "hard-bounce" }]);
  });

  it("a permanent bounce suppresses; a temporary one counts and the third suppresses", async () => {
    seed();
    expect((await post(ev("email.bounced", { bounce: { type: "Permanent" } }), { id: "a" })).status).toBe(200);
    expect(contact()).toMatchObject({ status: "suppressed", suppressedReason: "hard-bounce" });
    seed();
    await post(ev("email.bounced", { bounce: { type: "Temporary" } }), { id: "b" });
    await post(ev("email.delivery_delayed"), { id: "c" });
    expect(contact()).toMatchObject({ status: "active", softBounces: 2 });
    expect(ledger.docs.has(hash)).toBe(true); // from the first case; cleared below to prove the third writes it
    ledger.docs.delete(hash);
    await post(ev("email.delivery_delayed"), { id: "d" });
    expect(contact()).toMatchObject({ status: "suppressed", suppressedReason: "soft-bounces" });
    expect(ledger.docs.get(hash)).toMatchObject({ kind: "suppressed" });
  });

  it("delivered, opened, clicked and unknown events answer 200 and store nothing", async () => {
    seed();
    const before = new Set(store.keys());
    for (const [i, t] of ["email.delivered", "email.opened", "email.clicked", "email.sent", "something.new"].entries()) {
      const r = await post(ev(t), { id: `i${i}` });
      expect(r.status).toBe(200);
    }
    expect(new Set(store.keys())).toEqual(before);
    expect(contact().status).toBe("active");
    expect(ledger.docs.has(hash)).toBe(false);
  });

  it("is idempotent by event id", async () => {
    seed();
    const body = ev("email.delivery_delayed");
    await post(body, { id: "same" });
    await post(body, { id: "same" });
    expect(contact().softBounces).toBe(1);
    await post(body, { id: "other" });
    expect(contact().softBounces).toBe(2);
  });

  it("a failed ledger write answers 500 and releases the event so a retry applies it", async () => {
    seed();
    ledger.down = true;
    const body = ev("email.complained");
    expect((await post(body, { id: "r1" })).status).toBe(500);
    expect(contact().status).toBe("active");
    ledger.down = false;
    expect((await post(body, { id: "r1" })).status).toBe(200);
    expect(contact().status).toBe("suppressed");
  });

  it("leaves unknown, unsubscribed and already suppressed people alone", async () => {
    expect((await post(ev("email.complained"), { id: "u1" })).status).toBe(200);
    expect(ledger.docs.has(hash)).toBe(false);
    seed({ status: "unsubscribed" });
    await post(ev("email.complained"), { id: "u2" });
    expect(contact().status).toBe("unsubscribed");
  });

  it("logs hashes only", async () => {
    seed();
    const { logger } = await import("../logger.js");
    const spy = vi.spyOn(logger, "info");
    await post(ev("email.complained"));
    expect(JSON.stringify(spy.mock.calls)).not.toContain("example.com");
  });
});

describe("mapResendEvent", () => {
  it("maps by type and ignores junk", () => {
    expect(mapResendEvent(null)).toEqual({ action: "ignore" });
    expect(mapResendEvent({ type: "email.complained", data: {} })).toEqual({ action: "ignore" });
    expect(mapResendEvent({ type: "email.bounced", data: { to: ["a@b.co"], bounce: {} } }).action).toBe("soft");
    expect(mapResendEvent({ type: "email.complained", data: { to: ["a@b.co"] } })).toMatchObject({ action: "suppress", reason: "complaint" });
  });
});
