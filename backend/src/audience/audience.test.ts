import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { emailService } from "../services/email.service.js";
import { DEFAULT_ANNOUNCE_SETTINGS, SETTINGS_DOC_ID } from "../announce/schemas.js";
import { fillTemplate, renderConfirmMail, unsubscribeUrls } from "./mail.js";
import { backfillConsent, hashEmail, getContact, purgeExpiredPending, resetConsentBackfill, resetPurgeClock } from "./store.js";
import { CURRENT_CONSENT_TEXT_ID, getConsentText } from "./consent-texts.js";
import type { Contact } from "./schemas.js";
import { expiresIn, resetSecretCache, signToken, verifyToken } from "./tokens.js";

/*
 * Runs against an in-memory couch. The MCP router and the image pipeline are
 * stubbed ONLY so this file can load on a box without those native/optional
 * deps; CI has them and the stubs change nothing under test.
 */
vi.mock("../mcp/router.js", () => ({ createMcpRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("../mcp/oauth/provider.js", () => ({ grantDocId: (i: string) => `mcpgrant:${i}`, grantLive: () => false, revokeGrant: async () => {} }));
vi.mock("../services/mediaImage.js", () => ({}));
vi.mock("../services/svgSanitize.js", () => ({}));
vi.mock("../routes/images.route", () => ({ createImagesRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("../routes/media.admin.route.js", async () => ({ default: (await import("express")).Router() }));

let store: Map<string, Record<string, unknown>>;
let revs = 0;
let sent: Array<{ to: string; subject: string; text: string; html: string }>;

beforeEach(() => {
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
  vi.spyOn(emailService, "sendTo").mockImplementation(async (m) => {
    sent.push(m);
    return { ok: true, messageId: "m" };
  });
});
afterEach(() => vi.restoreAllMocks());

const admin = (req: request.Test) => req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
const app = () => createApp();
const flush = () => vi.waitFor(() => expect(sent.length).toBeGreaterThan(0));
const tokenFrom = (mail: { text: string }) => decodeURIComponent(/token=([^\s"&]+)/.exec(mail.text)![1]);
const signup = (a: ReturnType<typeof app>, body: Record<string, unknown> = {}) =>
  request(a).post("/api/subscribe").send({ email: "Ann@Example.com", lang: "en", ...body });
const hash = hashEmail("ann@example.com");
const seed = (over: Record<string, unknown> = {}) => {
  const now = new Date().toISOString();
  store.set(`contact:${hash}`, {
    _id: `contact:${hash}`, _rev: "1-a", type: "contact", email: "ann@example.com", lang: "en", groups: ["subscribers"], status: "active",
    source: "site", consentAt: now, consentNote: "site-form-v1", topics: { blog: true, releases: true }, createdAt: now, updatedAt: now, ...over,
  });
};

describe("POST /api/subscribe", () => {
  it("answers 202 {ok:true} identically for new, pending, active, suppressed and unsubscribed addresses", async () => {
    const a = app();
    const bodies: unknown[] = [];
    const first = await signup(a);
    bodies.push([first.status, first.body]);
    await flush();
    for (const status of ["pending", "active", "suppressed", "unsubscribed"]) {
      seed({ status });
      const r = await signup(a);
      bodies.push([r.status, r.body]);
    }
    for (const b of bodies) expect(b).toEqual([202, { ok: true }]);
  });

  it("creates a pending contact with a consent record and mails a confirm link", async () => {
    await signup(app(), { name: "Ann" });
    await flush();
    expect(store.get(`contact:${hash}`)).toMatchObject({ status: "pending", source: "site", consentNote: "site-form-v1", groups: ["subscribers"], email: "ann@example.com" });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("ann@example.com");
    expect(sent[0].text).toContain(`${env.SITE_URL}/subscribe/confirm?token=`);
  });

  it("mails nobody for an active or suppressed address, and never re-adds a suppressed one", async () => {
    for (const status of ["active", "suppressed"]) {
      seed({ status });
      await signup(app());
      await new Promise((r) => setTimeout(r, 10));
      expect(sent).toHaveLength(0);
      expect((store.get(`contact:${hash}`) as { status: string }).status).toBe(status);
    }
  });

  it("an unsubscribed person who signs up again goes back to pending, not active", async () => {
    seed({ status: "unsubscribed", unsubscribedAt: "2026-01-01T00:00:00.000Z" });
    await signup(app());
    await flush();
    expect((store.get(`contact:${hash}`) as { status: string }).status).toBe("pending");
  });

  it("a filled honeypot gets the same 202 and stores and sends nothing", async () => {
    const r = await signup(app(), { website: "http://spam.example" });
    expect([r.status, r.body]).toEqual([202, { ok: true }]);
    await new Promise((r2) => setTimeout(r2, 10));
    expect([...store.keys()].filter((k) => k.startsWith("contact:"))).toEqual([]);
    expect(sent).toHaveLength(0);
  });

  it.each([["unknown field", { extra: 1 }], ["bad email", { email: "nope" }], ["bad lang", { lang: "fr" }], ["control chars in name", { name: "a\nb" }]])("rejects %s with 400", async (_n, patch) => {
    expect((await signup(app(), patch)).status).toBe(400);
  });

  it("is rate limited", async () => {
    const a = app();
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await signup(a, { email: `u${i}@example.com` })).status;
    expect(last).toBe(429);
  });

  it("re-sends to a pending contact only after the resend window", async () => {
    await signup(app());
    await flush();
    await signup(app());
    await new Promise((r) => setTimeout(r, 10));
    expect(sent).toHaveLength(1);
  });
});

describe("confirm", () => {
  it("activates a pending contact from the mailed link and is idempotent", async () => {
    await signup(app(), { lang: "he" });
    await flush();
    const token = tokenFrom(sent[0]);
    const r = await request(app()).post("/api/subscribe/confirm").send({ token });
    expect([r.status, r.body]).toEqual([200, { ok: true, lang: "he" }]);
    expect(store.get(`contact:${hash}`)).toMatchObject({ status: "active" });
    expect((store.get(`contact:${hash}`) as { confirmedAt?: string }).confirmedAt).toBeTruthy();
    expect((await request(app()).post("/api/subscribe/confirm").send({ token })).status).toBe(200);
  });

  it("a GET never confirms, with or without a valid token (scanners open links)", async () => {
    seed({ status: "pending" });
    const token = await signToken({ t: "confirm", h: hash, exp: expiresIn(3600) });
    const r = await request(app()).get("/api/subscribe/confirm").query({ token });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect((store.get(`contact:${hash}`) as { status: string }).status).toBe("pending");
    expect((await request(app()).post("/api/subscribe/confirm").send({ token })).status).toBe(200);
    expect((store.get(`contact:${hash}`) as { status: string }).status).toBe("active");
  });

  it("refuses tampered, wrong-kind, expired, unknown-contact and missing tokens with one identical answer", async () => {
    seed({ status: "pending" });
    const good = await signToken({ t: "confirm", h: hash, exp: expiresIn(3600) });
    const [body, sig] = good.split(".");
    const flipped = `${body}.${sig.slice(0, -2)}${sig.endsWith("AA") ? "BB" : "AA"}`;
    const forgedBody = Buffer.from(JSON.stringify({ t: "confirm", h: hashEmail("other@example.com"), exp: expiresIn(3600) })).toString("base64url");
    const cases = [
      flipped,
      `${forgedBody}.${sig}`,
      await signToken({ t: "unsub", h: hash, exp: expiresIn(3600) }),
      await signToken({ t: "confirm", h: hash, exp: expiresIn(-5) }),
      await signToken({ t: "confirm", h: hashEmail("nobody@example.com"), exp: expiresIn(3600) }),
      "garbage",
    ];
    const answers = [];
    for (const token of cases) {
      const r = await request(app()).post("/api/subscribe/confirm").send({ token });
      answers.push([r.status, r.body]);
    }
    for (const a of answers) expect(a).toEqual(answers[0]);
    expect(answers[0][0]).toBe(400);
    expect((await request(app()).post("/api/subscribe/confirm").send({})).status).toBe(400);
    expect((store.get(`contact:${hash}`) as { status: string }).status).toBe("pending");
  });

  it("a pending signup past the TTL cannot be confirmed and is swept", async () => {
    const old = new Date(Date.now() - 8 * 86_400_000).toISOString();
    seed({ status: "pending", createdAt: old, updatedAt: old });
    const token = await signToken({ t: "confirm", h: hash, exp: expiresIn(3600) });
    expect((await request(app()).post("/api/subscribe/confirm").send({ token })).status).toBe(400);
    await vi.waitFor(() => expect(store.has(`contact:${hash}`)).toBe(false));
  });

  it("lazy cleanup deletes expired pending contacts only", async () => {
    const old = new Date(Date.now() - 8 * 86_400_000).toISOString();
    seed({ status: "pending", updatedAt: old });
    const other = hashEmail("keep@example.com");
    store.set(`contact:${other}`, { _id: `contact:${other}`, _rev: "1-a", type: "contact", email: "keep@example.com", status: "active", updatedAt: old, groups: [] });
    expect(await purgeExpiredPending(Date.now(), true)).toBe(1);
    expect(store.has(`contact:${hash}`)).toBe(false);
    expect(store.has(`contact:${other}`)).toBe(true);
  });
});

describe("tokens", () => {
  it("round-trips, and the generated secret is stored admin-side and created once", async () => {
    const t = await signToken({ t: "manage", h: hash, exp: expiresIn(60) });
    expect(await verifyToken(t, "manage")).toMatchObject({ h: hash, t: "manage" });
    expect(await verifyToken(t, "unsub")).toBeNull();
    expect(store.has("secret:subscribe")).toBe(true);
    resetSecretCache();
    expect(await verifyToken(t, "manage")).not.toBeNull();
  });
  it("the payload holds a hash, never an address", async () => {
    const t = await signToken({ t: "confirm", h: hash, exp: expiresIn(60) });
    expect(Buffer.from(t.split(".")[0], "base64url").toString()).not.toContain("@");
  });
  it("no public route returns the secret", async () => {
    await signToken({ t: "confirm", h: hash, exp: expiresIn(60) });
    const secret = (store.get("secret:subscribe") as { secret: string }).secret;
    for (const path of ["/api/subscribe/manage?token=x", "/api/settings"]) {
      expect(JSON.stringify((await request(app()).get(path)).body)).not.toContain(secret);
    }
  });
});

describe("unsubscribe", () => {
  beforeEach(() => seed());
  it("JSON body with a token unsubscribes, idempotently", async () => {
    const token = await signToken({ t: "unsub", h: hash, exp: expiresIn(3600) });
    for (let i = 0; i < 2; i++) {
      const r = await request(app()).post("/api/subscribe/unsubscribe").send({ token });
      expect([r.status, r.body.ok]).toEqual([200, true]);
    }
    expect(store.get(`contact:${hash}`)).toMatchObject({ status: "unsubscribed" });
  });
  it("RFC 8058 one-click: form body List-Unsubscribe=One-Click with the token in the query", async () => {
    const { oneClick } = await unsubscribeUrls(hash);
    const path = oneClick.replace(env.SITE_URL, "");
    const r = await request(app()).post(path).type("form").send("List-Unsubscribe=One-Click");
    expect(r.status).toBe(200);
    expect(store.get(`contact:${hash}`)).toMatchObject({ status: "unsubscribed" });
  });
  it("a form post without the One-Click marker, or a bad token, changes nothing", async () => {
    const { oneClick } = await unsubscribeUrls(hash);
    const path = oneClick.replace(env.SITE_URL, "");
    expect((await request(app()).post(path).type("form").send("x=1")).status).toBe(400);
    expect((await request(app()).post("/api/subscribe/unsubscribe?token=bad").type("form").send("List-Unsubscribe=One-Click")).status).toBe(400);
    expect((await request(app()).post("/api/subscribe/unsubscribe").send({ token: await signToken({ t: "manage", h: hash, exp: expiresIn(60) }) })).status).toBe(400);
    expect(store.get(`contact:${hash}`)).toMatchObject({ status: "active" });
  });
  it("a GET never unsubscribes: the API has no GET for it, and the mailed link opens a page that asks for a click", async () => {
    const token = await signToken({ t: "unsub", h: hash, exp: expiresIn(3600) });
    for (const path of ["/api/subscribe/unsubscribe", "/api/subscribe/confirm"]) {
      expect((await request(app()).get(path).query({ token })).status).toBeGreaterThanOrEqual(400);
    }
    expect(store.get(`contact:${hash}`)).toMatchObject({ status: "active" });
    const { page } = await unsubscribeUrls(hash);
    expect(page.startsWith(`${env.SITE_URL}/unsubscribe?token=`)).toBe(true);
  });
  it("never lifts a suppression", async () => {
    seed({ status: "suppressed" });
    const token = await signToken({ t: "unsub", h: hash, exp: expiresIn(3600) });
    await request(app()).post("/api/subscribe/unsubscribe").send({ token });
    expect((store.get(`contact:${hash}`) as { status: string }).status).toBe("suppressed");
  });
});

describe("manage", () => {
  it("shows a masked address and saves lang and topics", async () => {
    seed();
    const token = await signToken({ t: "manage", h: hash, exp: expiresIn(60) });
    const g = await request(app()).get("/api/subscribe/manage").query({ token });
    expect(g.body).toMatchObject({ ok: true, email: "a***@e***.com", lang: "en", status: "active" });
    expect(JSON.stringify(g.body)).not.toContain("ann@example.com");
    const p = await request(app()).put("/api/subscribe/manage").send({ token, lang: "he", topics: { blog: false, releases: true } });
    expect(p.status).toBe(200);
    expect(store.get(`contact:${hash}`)).toMatchObject({ lang: "he", topics: { blog: false, releases: true } });
  });
});

describe("admin routes need the admin gate", () => {
  const routes: Array<[string, string]> = [
    ["get", "/groups"], ["post", "/groups"], ["patch", `/groups/x`], ["delete", `/groups/x`],
    ["get", "/contacts"], ["post", "/contacts"], ["patch", `/contacts/${hash}`], ["delete", `/contacts/${hash}`],
    ["post", "/contacts/import"], ["get", "/contacts/export.csv"],
    ["get", "/suppression"], ["post", "/suppression"], ["delete", `/suppression/${hash}`],
  ];
  it.each(routes)("%s /api/admin/audience%s is refused without it", async (method, path) => {
    seed();
    const r = await (request(app()) as unknown as Record<string, (p: string) => request.Test>)[method](`/api/admin/audience${path}`).send({});
    expect([401, 403]).toContain(r.status);
    expect(JSON.stringify(r.body)).not.toContain("ann@example.com");
  });
});

describe("admin audience", () => {
  const A = "/api/admin/audience";
  it("groups: system group listed with counts, manual create/rename/delete, system not deletable", async () => {
    seed();
    const list = await admin(request(app()).get(`${A}/groups`));
    expect(list.body.groups).toEqual([expect.objectContaining({ slug: "subscribers", kind: "system", total: 1, active: 1 })]);
    const made = await admin(request(app()).post(`${A}/groups`).send({ name: "Friends" }));
    expect(made.body.group).toMatchObject({ slug: "friends", kind: "manual" });
    expect((await admin(request(app()).patch(`${A}/groups/friends`).send({ name: "Close friends" }))).body.group.name).toBe("Close friends");
    expect((await admin(request(app()).delete(`${A}/groups/subscribers`))).status).toBe(409);
    expect((await admin(request(app()).delete(`${A}/groups/friends`))).status).toBe(200);
  });

  it("contacts: add manually (consent note required), list with filters, patch, hard delete", async () => {
    const noNote = await admin(request(app()).post(`${A}/contacts`).send({ email: "bob@example.com", lang: "en", groups: [] }));
    expect(noNote.status).toBe(400);
    const add = await admin(request(app()).post(`${A}/contacts`).send({ email: "Bob@example.com", name: "Bob", lang: "he", groups: ["subscribers"], consentNote: "Asked me in person" }));
    expect(add.status).toBe(201);
    expect(add.body.contact).toMatchObject({ status: "active", source: "manual", consentNote: "Asked me in person" });
    const h = add.body.contact.hash;
    expect((await admin(request(app()).post(`${A}/contacts`).send({ email: "bob@example.com", lang: "en", consentNote: "again" }))).status).toBe(409);
    const found = await admin(request(app()).get(`${A}/contacts`).query({ q: "bo", status: "active", group: "subscribers" }));
    expect(found.body.contacts).toHaveLength(1);
    expect((await admin(request(app()).get(`${A}/contacts`).query({ q: "zzz" }))).body.contacts).toHaveLength(0);
    // An admin cannot activate someone; only move them out.
    expect((await admin(request(app()).patch(`${A}/contacts/${h}`).send({ status: "active" }))).status).toBe(400);
    expect((await admin(request(app()).patch(`${A}/contacts/${h}`).send({ name: "Robert", topics: { blog: false, releases: true }, status: "unsubscribed" }))).body.contact).toMatchObject({ name: "Robert", status: "unsubscribed" });
    expect((await admin(request(app()).delete(`${A}/contacts/${h}`))).status).toBe(200);
    expect(await getContact(h)).toBeNull();
  });

  it("import: consent confirmation and note are required; rows are validated, deduped and respect suppression", async () => {
    const csv = "email,name,lang\nnew@example.com,New,he\nnot-an-email,X,en\nann@example.com,Ann,en\nnew@example.com,Dup,en\n";
    const noConsent = await admin(request(app()).post(`${A}/contacts/import`).send({ csv, consentNote: "list from 2024" }));
    expect(noConsent.status).toBe(400);
    const falseConsent = await admin(request(app()).post(`${A}/contacts/import`).send({ csv, consentNote: "list from 2024", consentConfirmed: false }));
    expect(falseConsent.status).toBe(400);
    const noNote = await admin(request(app()).post(`${A}/contacts/import`).send({ csv, consentConfirmed: true }));
    expect(noNote.status).toBe(400);
    expect([...store.keys()].filter((k) => k.startsWith("contact:"))).toEqual([]);
    seed({ status: "suppressed" });
    const ok = await admin(request(app()).post(`${A}/contacts/import`).send({ csv, consentNote: "list from 2024", consentConfirmed: true }));
    expect(ok.body).toEqual({ ok: true, added: 1, skipped: 2, invalid: [{ row: 3, reason: "Not a valid email address" }] });
    expect(store.get(`contact:${hash}`)).toMatchObject({ status: "suppressed" });
    expect(store.get(`contact:${hashEmail("new@example.com")}`)).toMatchObject({ lang: "he", source: "import", status: "active", consentNote: "list from 2024" });
  });

  it("suppression: add, list, never re-added by signup or import, lift leaves them unsubscribed", async () => {
    expect((await admin(request(app()).post(`${A}/suppression`).send({ email: "ann@example.com" }))).status).toBe(201);
    expect((await admin(request(app()).get(`${A}/suppression`))).body.suppressed).toEqual([expect.objectContaining({ hash, email: "ann@example.com" })]);
    await signup(app());
    await admin(request(app()).post(`${A}/contacts/import`).send({ csv: "ann@example.com", consentNote: "from a list", consentConfirmed: true }));
    expect((await admin(request(app()).post(`${A}/contacts`).send({ email: "ann@example.com", lang: "en", consentNote: "asked me" }))).status).toBe(409);
    expect((await admin(request(app()).delete(`${A}/contacts/${hash}`))).status).toBe(409);
    expect(sent).toHaveLength(0);
    expect((store.get(`contact:${hash}`) as { status: string }).status).toBe("suppressed");
    expect((await admin(request(app()).delete(`${A}/suppression/${hash}`))).status).toBe(200);
    expect((store.get(`contact:${hash}`) as { status: string }).status).toBe("unsubscribed");
  });

  it("export is a CSV attachment, neutralises formulas, and lists the consent record", async () => {
    seed({ name: "=HYPERLINK(1)", consentNote: "said \"yes\", twice" });
    const r = await admin(request(app()).get(`${A}/contacts/export.csv`));
    expect(r.headers["content-type"]).toContain("text/csv");
    expect(r.headers["content-disposition"]).toContain("attachment");
    expect(r.text).toContain("'=HYPERLINK(1)");
    expect(r.text).toContain('"said ""yes"", twice"');
  });
});

describe("privacy: no address in logs or the audit log", () => {
  it("admin writes audit by hash only, and the logger never sees an address", async () => {
    const spies = (["info", "warn", "error", "debug"] as const).map((l) => vi.spyOn(logger, l));
    const audits: string[] = [];
    const base = couch.append as unknown as { getMockImplementation(): (id: string, b: Record<string, unknown>) => Promise<unknown> };
    const real = base.getMockImplementation();
    vi.spyOn(couch, "append").mockImplementation(async <R>(id: string, body: Record<string, unknown>) => {
      if (id.startsWith("audit:")) audits.push(JSON.stringify({ id, body }));
      return real(id, body) as Promise<R>;
    });
    const a = app();
    await signup(a, { email: "private.person@example.com" });
    await flush();
    await admin(request(a).post("/api/admin/audience/contacts").send({ email: "other.person@example.com", lang: "en", consentNote: "asked me" }));
    await admin(request(a).post("/api/admin/audience/suppression").send({ email: "third.person@example.com" }));
    await admin(request(a).post("/api/admin/audience/contacts/import").send({ csv: "fourth.person@example.com", consentNote: "from a list", consentConfirmed: true }));
    await vi.waitFor(() => expect(audits.length).toBeGreaterThanOrEqual(3));
    const everything = JSON.stringify([...spies.flatMap((s) => s.mock.calls), audits]);
    expect(everything).not.toMatch(/person@example\.com|private\.person|other\.person|third\.person|fourth\.person/);
    expect(audits.join()).toContain("contact:");
  });
});

describe("the confirmation mail", () => {
  it("escapes a hostile name and never turns user text into markup or a placeholder", () => {
    const m = renderConfirmMail({ name: '<img src=x onerror=alert(1)> {link} "q"', lang: "en" }, "https://x.test/c?token=a&b=1", DEFAULT_ANNOUNCE_SETTINGS.sender);
    expect(m.html).not.toContain("<img");
    expect(m.html).toContain("&lt;img src=x onerror=alert(1)&gt; {link} &quot;q&quot;");
    expect(m.html).toContain('<a href="https://x.test/c?token=a&amp;b=1">');
    expect(m.html.match(/<a /g)).toHaveLength(1);
    expect(m.subject).not.toMatch(/[\r\n]/);
  });
  it("is Hebrew and right-to-left for a Hebrew contact, with the link even if the owner's edit dropped it", () => {
    const m = renderConfirmMail({ lang: "he" }, "https://x.test/c?token=t", { ...DEFAULT_ANNOUNCE_SETTINGS.sender, confirmBodyHe: "שלום {name}, אשרו" });
    expect(m.html).toContain('dir="rtl"');
    expect(m.text).toContain("https://x.test/c?token=t");
    expect(m.text).not.toContain(" ,");
  });
  it("fillTemplate substitutes in a single pass", () => {
    expect(fillTemplate("{name} {site}", { name: "{site}", site: "S", days: "7", link: "L" }, false)).toBe("{site} S");
  });
  it("uses the owner's edited wording from settings:announce", async () => {
    store.set(SETTINGS_DOC_ID, { _id: SETTINGS_DOC_ID, _rev: "1-a", type: "settings-announce", updatedAt: "x", settings: { ...DEFAULT_ANNOUNCE_SETTINGS, sender: { ...DEFAULT_ANNOUNCE_SETTINGS.sender, confirmSubjectEn: "Please confirm", pendingTtlDays: 3 } } });
    await signup(app());
    await flush();
    expect(sent[0].subject).toBe("Please confirm");
    expect(sent[0].text).toContain("3 days");
  });
});

describe("consent record", () => {
  const A = "/api/admin/audience";
  const v1 = getConsentText("site-form-v1")!;
  const doc = () => store.get(`contact:${hash}`) as unknown as Contact;

  it("a site signup records the registered text id and the server's own hash, then the confirm time", async () => {
    await signup(app(), { lang: "he", formVersion: "site-form-v1" });
    await flush();
    expect(doc().consent).toMatchObject({ textId: "site-form-v1", textHash: v1.sha256, lang: "he", source: "site" });
    expect(doc().consent?.confirmedAt).toBeUndefined();
    const r = await request(app()).post("/api/subscribe/confirm").send({ token: tokenFrom(sent[0]) });
    expect(r.status).toBe(200);
    expect(doc().consent?.confirmedAt).toBeDefined();
    expect(doc().consentHistory).toHaveLength(1);
    expect(doc().consentHistory![0].confirmedAt).toBe(doc().consent!.confirmedAt);
  });

  it("an unregistered form version is refused and stores nothing; an absent one means the current id", async () => {
    const bad = await signup(app(), { formVersion: "site-form-v99" });
    expect(bad.status).toBe(400);
    expect(store.size).toBe(0);
    // The client cannot supply a hash: the strict schema rejects the field.
    const forged = await signup(app(), { textHash: "deadbeef" });
    expect(forged.status).toBe(400);
    await signup(app());
    expect(doc().consent?.textId).toBe(CURRENT_CONSENT_TEXT_ID);
  });

  it("a re-subscribe appends to the history and never overwrites the earlier entry", async () => {
    seed({ status: "unsubscribed", unsubscribedAt: "2026-01-01T00:00:00.000Z", consentAt: "2026-01-01T00:00:00.000Z", confirmedAt: "2026-01-02T00:00:00.000Z" });
    await signup(app(), { lang: "he" });
    await flush();
    const h = doc().consentHistory!;
    expect(h).toHaveLength(2);
    expect(h[0]).toMatchObject({ textId: "site-form-v1", at: "2026-01-01T00:00:00.000Z", confirmedAt: "2026-01-02T00:00:00.000Z", lang: "en" });
    expect(h[1]).toMatchObject({ textId: "site-form-v1", lang: "he" });
    expect(h[1].confirmedAt).toBeUndefined();
    expect(doc().consent).toEqual(h[1]);
  });

  it("a legacy contact (only consentAt/consentNote) reads as a full consent without being rewritten", async () => {
    seed({ confirmedAt: "2026-01-02T00:00:00.000Z" });
    const r = await admin(request(app()).get(`${A}/contacts`));
    const item = r.body.contacts[0];
    expect(item.consent).toMatchObject({ textId: "site-form-v1", textHash: v1.sha256, source: "site", confirmedAt: "2026-01-02T00:00:00.000Z" });
    expect(item.consentHistory).toHaveLength(1);
    expect(doc().consent).toBeUndefined();
  });

  it("backfill adds consent and history to legacy contacts, keeps the old fields, and leaves updatedAt alone", async () => {
    resetConsentBackfill();
    seed({ updatedAt: "2026-01-03T00:00:00.000Z", consentNote: "list from 2024", source: "import" });
    expect(await backfillConsent()).toBe(1);
    expect(doc()).toMatchObject({
      consentNote: "list from 2024",
      updatedAt: "2026-01-03T00:00:00.000Z",
      consent: { textId: null, textHash: null, source: "import", note: "list from 2024" },
    });
    expect(doc().consentHistory).toHaveLength(1);
    resetConsentBackfill();
    expect(await backfillConsent()).toBe(0);
  });

  it("CSV import stores the per-batch note on every contact's consent", async () => {
    await admin(request(app()).post(`${A}/contacts/import`).send({ csv: "email,lang\nann@example.com,he\n", consentNote: "workshop list 2025", consentConfirmed: true }));
    expect(doc().consent).toMatchObject({ textId: null, source: "import", note: "workshop list 2025", lang: "he" });
    expect(doc().consentHistory).toHaveLength(1);
  });

  it("the export carries the consent text id, hash, language, confirm time and history", async () => {
    seed({ confirmedAt: "2026-01-02T00:00:00.000Z" });
    const r = await admin(request(app()).get(`${A}/contacts/export.csv`));
    expect(r.text).toContain("consentTextId,consentTextHash,consentLang,consentConfirmedAt,consentHistory");
    expect(r.text).toContain(v1.sha256);
    expect(r.text).toContain("site-form-v1");
  });
});
