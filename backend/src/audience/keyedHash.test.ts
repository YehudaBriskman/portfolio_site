import { createHmac } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { emailService } from "../services/email.service.js";
import { cachedKind, ledgerClear, ledgerEntries, ledgerGet, ledgerPut, keyedHash, memoryLedgerStore, resetLedgerCache, resetUnkeyedWarning, useLedgerStore, warnIfUnkeyed } from "./ledger.js";
import { rekeyLedger } from "./rekey.js";
import { hashEmail } from "./store.js";
import { expiresIn, resetSecretCache, signToken, verifyToken } from "./tokens.js";
import { unsubscribeUrls } from "./mail.js";
import { resetGuard } from "../campaigns/guard.js";
import { resetContactGuard } from "../services/contactGuard.js";

vi.mock("../mcp/router.js", () => ({ createMcpRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("../mcp/oauth/provider.js", () => ({ grantDocId: (i: string) => `mcpgrant:${i}`, grantLive: () => false, revokeGrant: async () => {} }));
vi.mock("../services/mediaImage.js", () => ({}));
vi.mock("../services/svgSanitize.js", () => ({}));
vi.mock("../routes/images.route", () => ({ createImagesRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("../routes/media.admin.route.js", async () => ({ default: (await import("express")).Router() }));

const KEY = "k".repeat(40);
const e = env as { EMAIL_HASH_KEY?: string };
const EMAIL = "ann@example.com";
const legacy = hashEmail(EMAIL);
const keyedOf = (a: string) => createHmac("sha256", KEY).update(a.trim().toLowerCase()).digest("hex").slice(0, 32);
const DAY = 86_400_000;

let ledger: ReturnType<typeof memoryLedgerStore>;
let store: Map<string, Record<string, unknown>>;
let revs = 0;

beforeEach(() => {
  store = new Map();
  e.EMAIL_HASH_KEY = KEY;
  resetSecretCache();
  vi.spyOn(couch, "get").mockImplementation(async <R>(id: string) => {
    const d = store.get(id);
    if (!d) throw new CouchError(404, "404");
    return structuredClone(d) as R;
  });
  vi.spyOn(couch, "put").mockImplementation(async <R>(id: string, body: unknown) => {
    store.set(id, { ...structuredClone(body as object), _rev: `${++revs + 1}-x` });
    return { ok: true, id } as R;
  });
  vi.spyOn(couch, "append").mockImplementation(async <R>(id: string, body: Record<string, unknown>) => {
    if (store.has(id)) throw new CouchError(409, "409");
    store.set(id, { ...structuredClone(body), _rev: `${++revs + 1}-x` });
    return { ok: true, id } as R;
  });
  vi.spyOn(couch, "find").mockImplementation(async (q: unknown) => {
    const { selector: s, limit = 25 } = q as { selector: { _id: { $gt: string; $lt: string } }; limit?: number };
    const docs = [...store.entries()].filter(([id]) => id > s._id.$gt && id < s._id.$lt).sort(([a], [b]) => (a < b ? -1 : 1)).slice(0, limit).map(([, d]) => structuredClone(d));
    return { docs: docs as never[] };
  });
  vi.spyOn(couch, "docs").mockImplementation(async <R>(ids: string[]) => ids.flatMap((i) => (store.has(i) ? [structuredClone(store.get(i)) as R] : [])));
  vi.spyOn(emailService, "sendTo").mockResolvedValue({ ok: true, messageId: "m" });
  ledger = memoryLedgerStore();
  useLedgerStore(ledger);
  resetGuard();
  resetContactGuard();
});
afterEach(() => {
  delete e.EMAIL_HASH_KEY;
  vi.restoreAllMocks();
  useLedgerStore();
  resetUnkeyedWarning();
});

const seedContact = (email: string, status = "active") => {
  const h = hashEmail(email);
  store.set(`contact:${h}`, { _id: `contact:${h}`, _rev: "1-a", type: "contact", email, lang: "en", groups: ["subscribers"], status, source: "site", consentAt: "x", topics: { blog: true, releases: true }, createdAt: "x", updatedAt: new Date().toISOString() });
  return h;
};
const lines = () => [...ledger.docs.keys()].filter((k) => /^[0-9a-f]{32}$/.test(k));

describe("keyed hash", () => {
  it("is HMAC-SHA256 over the normalised address, 32 hex, and differs from the legacy hash", () => {
    expect(keyedHash("  Ann@Example.com ")).toBe(keyedOf(EMAIL));
    expect(keyedHash(EMAIL)).not.toBe(legacy);
  });

  it("is null when the key is unset", () => {
    delete e.EMAIL_HASH_KEY;
    expect(keyedHash(EMAIL)).toBeNull();
  });
});

describe("ledger matching, keyed and legacy both ways", () => {
  it("a legacy line blocks when the key is set", async () => {
    delete e.EMAIL_HASH_KEY;
    await ledgerPut(legacy, "suppressed");
    e.EMAIL_HASH_KEY = KEY;
    expect((await ledgerGet(legacy, EMAIL))?.kind).toBe("suppressed");
    await ledgerEntries();
    expect(cachedKind(legacy, EMAIL)).toBe("suppressed");
  });

  it("a keyed line blocks, found through the address", async () => {
    await ledgerPut(legacy, "unsubscribed", new Date(), EMAIL);
    expect(lines()).toEqual([keyedOf(EMAIL)]);
    expect((await ledgerGet(legacy, EMAIL))?.kind).toBe("unsubscribed");
    await ledgerEntries();
    expect(cachedKind(legacy, EMAIL)).toBe("unsubscribed");
  });

  it("writing keyed drops the person's legacy line; clearing removes both", async () => {
    await ledgerPut(legacy, "unsubscribed");
    await ledgerPut(legacy, "suppressed", new Date(), EMAIL);
    expect(lines()).toEqual([keyedOf(EMAIL)]);
    await ledgerPut(legacy, "unsubscribed");
    await ledgerClear(legacy, EMAIL);
    expect(lines()).toEqual([]);
  });

  it("when both exist, suppressed wins", async () => {
    ledger.docs.set(legacy, { _id: legacy, _rev: "1-x", type: "ledger", kind: "unsubscribed", at: "x" });
    ledger.docs.set(keyedOf(EMAIL), { _id: keyedOf(EMAIL), _rev: "1-x", type: "ledger", kind: "suppressed", at: "x" });
    expect((await ledgerGet(legacy, EMAIL))?.kind).toBe("suppressed");
  });

  it("signup of a legacy-suppressed address is silent: same 202, no contact, no mail", async () => {
    ledger.docs.set(legacy, { _id: legacy, _rev: "1-x", type: "ledger", kind: "suppressed", at: "x" });
    const r = await request(createApp()).post("/api/subscribe").send({ email: "Ann@Example.com", lang: "en" });
    expect(r.status).toBe(202);
    expect(r.body).toEqual({ ok: true });
    expect(store.has(`contact:${legacy}`)).toBe(false);
    expect(emailService.sendTo).not.toHaveBeenCalled();
  });

  it("signup of a keyed-suppressed address is equally silent", async () => {
    ledger.docs.set(keyedOf(EMAIL), { _id: keyedOf(EMAIL), _rev: "1-x", type: "ledger", kind: "suppressed", at: "x" });
    const r = await request(createApp()).post("/api/subscribe").send({ email: EMAIL, lang: "en" });
    expect([r.status, r.body]).toEqual([202, { ok: true }]);
    expect(store.has(`contact:${legacy}`)).toBe(false);
  });

  it("key unset: behaves as today (legacy keys only, no keyed line ever written) and warns once", async () => {
    delete e.EMAIL_HASH_KEY;
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);
    await ledgerPut(legacy, "unsubscribed", new Date(), EMAIL);
    expect(lines()).toEqual([legacy]);
    expect((await ledgerGet(legacy, EMAIL))?.kind).toBe("unsubscribed");
    warnIfUnkeyed();
    warnIfUnkeyed();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("example.com");
  });
});

describe("re-key", () => {
  it("moves legacy lines of held addresses, keeps legacy-only tombstones, is idempotent, logs no address", async () => {
    const h = seedContact(EMAIL, "unsubscribed");
    const gone = hashEmail("gone@example.com");
    delete e.EMAIL_HASH_KEY;
    await ledgerPut(h, "unsubscribed");
    await ledgerPut(gone, "erased");
    e.EMAIL_HASH_KEY = KEY;
    resetLedgerCache();
    const info = vi.spyOn(logger, "info");
    expect(await rekeyLedger({ apply: false })).toEqual({ moved: 1, legacyOnly: 2 });
    expect(lines().sort()).toEqual([h, gone].sort());

    expect(await rekeyLedger()).toEqual({ moved: 1, legacyOnly: 1 });
    expect(lines().sort()).toEqual([keyedOf(EMAIL), gone].sort());
    expect(ledger.docs.get(keyedOf(EMAIL))).toMatchObject({ kind: "unsubscribed" });

    expect(await rekeyLedger()).toEqual({ moved: 0, legacyOnly: 1 });
    expect(lines().sort()).toEqual([keyedOf(EMAIL), gone].sort());
    /* The tombstone still blocks through the legacy check. */
    expect((await ledgerGet(gone, "gone@example.com"))?.kind).toBe("erased");
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/example\.com|[0-9a-f]{32}/);
  });

  it("refuses to run without a key", async () => {
    delete e.EMAIL_HASH_KEY;
    await expect(rekeyLedger()).rejects.toThrow(/EMAIL_HASH_KEY/);
  });
});

describe("sender guard with keyed lines", () => {
  it("repairs an active contact whose keyed line says unsubscribed (a restore brought them back)", async () => {
    const { ledgerGuard } = await import("../campaigns/guard.js");
    seedContact(EMAIL, "active");
    await ledgerPut(legacy, "unsubscribed", new Date(), EMAIL);
    expect(await ledgerGuard(Date.now())).toEqual({ ok: true, repaired: 1 });
    expect((store.get(`contact:${legacy}`) as { status: string }).status).toBe("unsubscribed");
  });
});

describe("link lifetimes", () => {
  const T = 1_800_000_000_000;

  it("a confirm token is valid inside CONFIRM_TTL_DAYS and refused after", async () => {
    expect(env.CONFIRM_TTL_DAYS).toBe(30);
    const t = await signToken({ t: "confirm", h: legacy, exp: expiresIn(30 * 86_400, T) });
    expect(await verifyToken(t, "confirm", T + 29 * DAY)).toMatchObject({ h: legacy });
    expect(await verifyToken(t, "confirm", T + 31 * DAY)).toBeNull();
  });

  it("the confirm route answers an expired link with the usual bad-link answer", async () => {
    seedContact(EMAIL, "pending");
    const t = await signToken({ t: "confirm", h: legacy, exp: expiresIn(-60) });
    const r = await request(createApp()).post("/api/subscribe/confirm").send({ token: t });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/invalid or has expired/);
    expect((store.get(`contact:${legacy}`) as { status: string }).status).toBe("pending");
  });

  it("an unsubscribe token never expires: new ones carry no expiry, old 3-year ones are honoured too", async () => {
    const { oneClick } = await unsubscribeUrls(legacy);
    const t = decodeURIComponent(new URL(oneClick).searchParams.get("token")!);
    expect(JSON.parse(Buffer.from(t.split(".")[0], "base64url").toString())).toEqual({ t: "unsub", h: legacy });
    expect(await verifyToken(t, "unsub", T + 50 * 365 * DAY)).toMatchObject({ h: legacy });
    const old = await signToken({ t: "unsub", h: legacy, exp: expiresIn(3 * 365 * 86_400, T) });
    expect(await verifyToken(old, "unsub", T + 10 * 365 * DAY)).toMatchObject({ h: legacy });
  });

  it("old tokens (no expiry claim) still verify; a manage token still expires", async () => {
    const t = await signToken({ t: "manage", h: legacy });
    expect(await verifyToken(t, "manage", T)).toMatchObject({ h: legacy });
    const m = await signToken({ t: "manage", h: legacy, exp: expiresIn(60, T) });
    expect(await verifyToken(m, "manage", T + 120_000)).toBeNull();
  });
});
