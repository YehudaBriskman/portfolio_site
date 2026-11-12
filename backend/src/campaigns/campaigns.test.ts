import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { DEFAULT_ANNOUNCE_SETTINGS, SETTINGS_DOC_ID, type AnnounceEvent, type AnnounceSettings } from "../announce/schemas.js";
import { hashEmail } from "../audience/store.js";
import { emailService } from "../services/email.service.js";
import { autoDraftFor } from "./autodraft.js";
import { resolveSender, senderWarnings } from "./config.js";
import { COMMERCIAL_LABEL_HE, renderCampaignMail } from "./render.js";
import { renderBody, safeHref, safeImage } from "./body.js";
import { inQuietHours, runSenderTick, type Deliver } from "./sender.js";

/* In-memory couch. The MCP/image stubs only let app.ts load on a box without those optional deps; CI has them. */
vi.mock("../mcp/router.js", () => ({ createMcpRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("../mcp/oauth/provider.js", () => ({ grantDocId: (i: string) => `mcpgrant:${i}`, grantLive: () => false, revokeGrant: async () => {} }));
vi.mock("../services/mediaImage.js", () => ({}));
vi.mock("../services/svgSanitize.js", () => ({}));
vi.mock("../routes/images.route", () => ({ createImagesRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("../routes/media.admin.route.js", async () => ({ default: (await import("express")).Router() }));

let store: Map<string, Record<string, unknown>>;
let revs = 0;
type Sent = { to: string; subject: string; text: string; html: string; headers?: Record<string, string> };
let sent: Sent[];
let putHook: ((id: string, body: { status?: string }) => void) | null;
const deliver: Deliver = async (msgs) => {
  sent.push(...msgs);
  return msgs.map(() => ({ ok: true as const }));
};

beforeEach(() => {
  store = new Map();
  sent = [];
  putHook = null;
  vi.spyOn(couch, "get").mockImplementation(async <R>(id: string) => {
    const d = store.get(id);
    if (!d) throw new CouchError(404, "404");
    return structuredClone(d) as R;
  });
  vi.spyOn(couch, "put").mockImplementation(async <R>(id: string, body: unknown) => {
    const doc = body as { _rev?: string };
    putHook?.(id, body as { status?: string });
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
    const { selector: s, limit = 25 } = q as { selector: { _id: { $gt: string; $lt: string }; status?: { $in: string[] } }; limit?: number };
    const docs = [...store.entries()]
      .filter(([id, d]) => id > s._id.$gt && id < s._id.$lt && (!s.status || s.status.$in.includes(d.status as string)))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(0, limit)
      .map(([, d]) => structuredClone(d));
    return { docs: docs as never[] };
  });
  vi.spyOn(emailService, "sendBulk").mockImplementation(async (m) => {
    sent.push(...m);
    return m.map(() => ({ ok: true as const }));
  });
});
afterEach(() => vi.restoreAllMocks());

const admin = (req: request.Test) => req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
const C = "/api/admin/campaigns";

const setSender = (over: Partial<AnnounceSettings["sender"]> = {}) =>
  store.set(SETTINGS_DOC_ID, {
    _id: SETTINGS_DOC_ID, _rev: "1-s", type: "settings-announce", updatedAt: "x",
    settings: { ...DEFAULT_ANNOUNCE_SETTINGS, sender: { ...DEFAULT_ANNOUNCE_SETTINGS.sender, footerIdentity: "Yehuda, Tel Aviv", ...over } },
  });
const addr = (i: number) => `user${i}@example.com`;
const seedContact = (i: number, over: Record<string, unknown> = {}) => {
  const h = hashEmail(addr(i));
  const now = new Date().toISOString();
  store.set(`contact:${h}`, {
    _id: `contact:${h}`, _rev: "1-a", type: "contact", email: addr(i), lang: "en", groups: ["subscribers"], status: "active", source: "site",
    consentAt: now, consentNote: "site-form-v1", topics: { blog: true, releases: true }, createdAt: now, updatedAt: now, ...over,
  });
};
const seedMany = (n: number) => { for (let i = 1; i <= n; i++) seedContact(i); };
const T0 = Date.parse("2026-06-01T12:00:00Z");
const draft = (over: Record<string, unknown> = {}) => ({ name: "n", subject: "Hello", bodyText: "Hi", groups: ["subscribers"], ...over });
const mk = async (over: Record<string, unknown> = {}) => (await admin(request(createApp()).post(C).send(draft(over)))).body.campaign as { id: string; _rev: string };
const get = (id: string) => store.get(`campaign:${id}`) as Record<string, any>;
const queued = async (n = 3, over: Partial<AnnounceSettings["sender"]> = {}) => {
  setSender(over);
  seedMany(n);
  const c = await mk();
  const r = await admin(request(createApp()).post(`${C}/${c.id}/send-now`));
  expect(r.status).toBe(200);
  /* The tests run on a fake clock; "now" at send time is the real one. */
  store.set(`campaign:${c.id}`, { ...get(c.id), sendAt: "2000-01-01T00:00:00.000Z" });
  return c.id;
};

describe("admin gate", () => {
  const routes: Array<[string, string]> = [
    ["get", ""], ["post", ""], ["get", "/abc"], ["patch", "/abc"], ["delete", "/abc"], ["get", "/abc/audience"],
    ["post", "/preview"], ["post", "/audience"], ["post", "/abc/test"], ["post", "/abc/schedule"], ["post", "/abc/send-now"], ["post", "/abc/cancel"], ["post", "/abc/resume"],
  ];
  it.each(routes)("%s /api/admin/campaigns%s is refused without it", async (method, path) => {
    seedMany(1);
    const r = await (request(createApp()) as unknown as Record<string, (p: string) => request.Test>)[method](`${C}${path}`).send({});
    expect([401, 403]).toContain(r.status);
    expect(JSON.stringify(r.body)).not.toContain("user1@example.com");
  });
});

describe("campaign routes and state machine", () => {
  it("draft -> scheduled -> draft -> canceled, and a scheduled campaign is not editable", async () => {
    setSender();
    seedMany(2);
    const c = await mk();
    expect(get(c.id).status).toBe("draft");
    const when = new Date(T0 + 3_600_000).toISOString();
    expect((await admin(request(createApp()).post(`${C}/${c.id}/schedule`).send({ sendAt: when }))).body.campaign.status).toBe("scheduled");
    expect((await admin(request(createApp()).patch(`${C}/${c.id}`).send({ name: "x" }))).status).toBe(409);
    expect((await admin(request(createApp()).post(`${C}/${c.id}/schedule`).send({ sendAt: null }))).body.campaign.status).toBe("draft");
    expect((await admin(request(createApp()).patch(`${C}/${c.id}`).send({ name: "renamed" }))).body.campaign.name).toBe("renamed");
    await admin(request(createApp()).post(`${C}/${c.id}/send-now`));
    expect((await admin(request(createApp()).post(`${C}/${c.id}/cancel`))).body.campaign.status).toBe("canceled");
    expect((await admin(request(createApp()).post(`${C}/${c.id}/cancel`))).status).toBe(409);
    expect((await admin(request(createApp()).delete(`${C}/${c.id}`))).status).toBe(200);
  });

  it("a stale _rev on edit is a 409", async () => {
    const c = await mk();
    await admin(request(createApp()).patch(`${C}/${c.id}`).send({ name: "a" }));
    expect((await admin(request(createApp()).patch(`${C}/${c.id}`).send({ name: "b", _rev: c._rev }))).status).toBe(409);
  });

  it("refuses to queue without a footer identity, or an empty audience", async () => {
    setSender({ footerIdentity: "" });
    seedMany(1);
    const c = await mk();
    expect((await admin(request(createApp()).post(`${C}/${c.id}/send-now`))).status).toBe(422);
    setSender();
    const empty = await mk({ groups: ["nobody"] });
    expect((await admin(request(createApp()).post(`${C}/${empty.id}/send-now`))).status).toBe(422);
  });

  it("validates strictly: unknown field, header injection, bad group slug", async () => {
    const a = (b: Record<string, unknown>) => admin(request(createApp()).post(C).send(draft(b)));
    expect((await a({ extra: 1 })).status).toBe(400);
    expect((await a({ subject: "x\r\nBcc: evil@example.com" })).status).toBe(400);
    expect((await a({ groups: ["Bad Slug"] })).status).toBe(400);
    expect((await a({ groups: [] })).status).toBe(400);
  });

  it("audience: a count and three masked samples, never an address", async () => {
    seedMany(8);
    seedContact(9, { status: "unsubscribed" });
    const c = await mk();
    const r = await admin(request(createApp()).get(`${C}/${c.id}/audience`));
    expect(r.body.count).toBe(8);
    expect(r.body.samples).toHaveLength(3);
    expect(JSON.stringify(r.body)).not.toContain("example.com");
  });

  it("audience of an unsaved selection: counts by groups, language and topic", async () => {
    seedMany(4);
    seedContact(5, { lang: "he" });
    seedContact(6, { topics: { blog: false, releases: true } });
    const q = (b: Record<string, unknown>) => admin(request(createApp()).post(`${C}/audience`).send(b));
    expect((await q({ groups: ["subscribers"] })).body.count).toBe(6);
    expect((await q({ groups: ["subscribers"], lang: "he" })).body.count).toBe(1);
    expect((await q({ groups: ["subscribers"], topic: "blog" })).body.count).toBe(5);
    expect((await q({ groups: [] })).status).toBe(400);
    expect(JSON.stringify((await q({ groups: ["subscribers"] })).body)).not.toContain("example.com");
  });

  it("preview renders the draft with the real renderer, escaped, with the footer", async () => {
    setSender({ footerIdentity: "Yehuda, Tel Aviv" });
    const p = (b: Record<string, unknown>) => admin(request(createApp()).post(`${C}/preview`).send(b));
    const r = await p({ subject: "Hi", bodyText: "<script>x</script>\n\nSecond", lang: "he" });
    expect(r.status).toBe(200);
    expect(r.body.html).not.toContain("<script>");
    expect(r.body.html).toContain("Yehuda, Tel Aviv");
    expect(r.body.html).toContain('dir="rtl"');
    expect(r.body.subject.startsWith(COMMERCIAL_LABEL_HE)).toBe(true);
    expect((await p({ subject: "", bodyText: "", blocks: [{ type: "cta", url: "javascript:alert(1)", label: "x" }] })).status).toBe(400);
    expect((await p({ subject: "x", bodyText: "y", extra: 1 })).status).toBe(400);
  });

  it("test send goes to settings.sender.testRecipients only", async () => {
    setSender({ testRecipients: ["me@example.org"] });
    seedMany(3);
    const c = await mk();
    const r = await admin(request(createApp()).post(`${C}/${c.id}/test`));
    expect(r.body).toEqual({ ok: true, sent: 1, failed: 0 });
    expect(sent.map((m) => m.to)).toEqual(["me@example.org"]);
    expect(sent[0].subject).toMatch(/^\[Test\] /);
    setSender();
    expect((await admin(request(createApp()).post(`${C}/${c.id}/test`))).status).toBe(422);
  });
});

describe("sender tick", () => {
  it("sends to every active contact once, with per-recipient To and one-click headers, then finishes", async () => {
    const id = await queued(3);
    await runSenderTick({ now: () => T0, deliver });
    await runSenderTick({ now: () => T0, deliver });
    expect(sent.map((m) => m.to).sort()).toEqual([addr(1), addr(2), addr(3)]);
    for (const m of sent) {
      expect(m.headers?.["List-Unsubscribe"]).toMatch(/^<https?:\/\/.+\/api\/subscribe\/unsubscribe\?token=.+>$/);
      expect(m.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    }
    expect(new Set(sent.map((m) => m.headers?.["List-Unsubscribe"])).size).toBe(3);
    expect(get(id)).toMatchObject({ status: "sent", counters: { queued: 3, sent: 3, failed: 0, suppressed: 0 } });
    expect([...store.keys()].filter((k) => k.startsWith(`send:${id}:`))).toHaveLength(3);
    await runSenderTick({ now: () => T0 + 1000, deliver });
    expect(sent).toHaveLength(3);
  });

  it("does not start before sendAt", async () => {
    setSender();
    seedMany(1);
    const c = await mk();
    await admin(request(createApp()).post(`${C}/${c.id}/schedule`).send({ sendAt: new Date(T0 + 60_000).toISOString() }));
    await runSenderTick({ now: () => T0, deliver });
    expect(sent).toHaveLength(0);
    expect(get(c.id).status).toBe("scheduled");
    await runSenderTick({ now: () => T0 + 61_000, deliver });
    expect(sent).toHaveLength(1);
  });

  it("a lost claim (another worker moved the doc, 409) sends nothing", async () => {
    const id = await queued(2);
    let raced = false;
    putHook = (docId, body) => {
      if (!raced && docId === `campaign:${id}` && body.status === "sending") {
        raced = true;
        store.set(docId, { ...store.get(docId)!, _rev: "99-other" });
      }
    };
    await runSenderTick({ now: () => T0, deliver });
    expect(raced).toBe(true);
    expect(sent).toHaveLength(0);
    expect(get(id).status).toBe("scheduled");
  });

  it("honours throttlePerHour across ticks and resets with the clock", async () => {
    const id = await queued(5, { throttlePerHour: 2 });
    await runSenderTick({ now: () => T0, deliver });
    await runSenderTick({ now: () => T0 + 60_000, deliver });
    expect(sent).toHaveLength(2);
    await runSenderTick({ now: () => T0 + 3_600_000, deliver });
    expect(sent).toHaveLength(4);
    await runSenderTick({ now: () => T0 + 7_200_000, deliver });
    await runSenderTick({ now: () => T0 + 7_200_000 + 1, deliver });
    expect(sent).toHaveLength(5);
    expect(get(id).status).toBe("sent");
  });

  it("honours dailyCap across hours, and a new day lifts it", async () => {
    await queued(5, { throttlePerHour: 100, dailyCap: 3 });
    await runSenderTick({ now: () => T0, deliver });
    await runSenderTick({ now: () => T0 + 3_600_000, deliver });
    expect(sent).toHaveLength(3);
    await runSenderTick({ now: () => T0 + 86_400_000, deliver });
    expect(sent).toHaveLength(5);
  });

  it("sends nothing inside quiet hours (window wrapping midnight, in the owner's zone) and resumes after", async () => {
    await queued(2, { quietHours: { from: "22:00", to: "07:00", tz: "Asia/Jerusalem" } });
    const night = Date.parse("2026-06-01T20:00:00Z"); // 23:00 in Jerusalem (UTC+3)
    await runSenderTick({ now: () => night, deliver });
    expect(sent).toHaveLength(0);
    await runSenderTick({ now: () => Date.parse("2026-06-02T05:00:00Z"), deliver }); // 08:00 local
    expect(sent).toHaveLength(2);
  });

  it("inQuietHours: edges", () => {
    const q = { from: "22:00", to: "07:00", tz: "UTC" };
    const at = (t: string) => Date.parse(`2026-06-01T${t}:00Z`);
    expect([inQuietHours(q, at("22:00")), inQuietHours(q, at("03:00")), inQuietHours(q, at("07:00")), inQuietHours(q, at("12:00"))]).toEqual([true, true, false, false]);
    expect(inQuietHours({ from: "09:00", to: "17:00", tz: "UTC" }, at("12:00"))).toBe(true);
    expect(inQuietHours(undefined, at("12:00"))).toBe(false);
  });

  it("resumes after a crash: finished recipients are not repeated, a stale attempt is retried, a fresh one is left", async () => {
    const id = await queued(4);
    const c = get(id);
    store.set(`campaign:${id}`, { ...c, status: "sending" });
    const res = (i: number, status: string, at: number) =>
      store.set(`send:${id}:${hashEmail(addr(i))}`, { _id: `send:${id}:${hashEmail(addr(i))}`, _rev: "1-r", type: "send", campaignId: id, contact: hashEmail(addr(i)), status, at: new Date(at).toISOString() });
    res(1, "sent", T0 - 3_600_000);
    res(2, "attempting", T0 - 3_600_000);
    res(3, "attempting", T0 - 1000);
    await runSenderTick({ now: () => T0, deliver });
    expect(sent.map((m) => m.to).sort()).toEqual([addr(2), addr(4)]);
  });

  it("never sends to pending, unsubscribed or suppressed contacts, nor to one who left between scan and send", async () => {
    setSender();
    seedContact(1);
    seedContact(2, { status: "pending" });
    seedContact(3, { status: "unsubscribed" });
    seedContact(4, { status: "suppressed" });
    seedContact(5, { groups: ["other"] });
    seedContact(6);
    const c = await mk();
    await admin(request(createApp()).post(`${C}/${c.id}/send-now`));
    store.set(`campaign:${c.id}`, { ...get(c.id), sendAt: "2000-01-01T00:00:00.000Z" });
    // contact 6 unsubscribes after the recipient list is read but before its mail.
    const orig = store.get(`contact:${hashEmail(addr(6))}`)!;
    const spy = vi.fn<Deliver>(async (msgs) => {
      if (msgs[0].to === addr(1)) store.set(orig._id as string, { ...orig, status: "unsubscribed" });
      return deliver(msgs, { from: "" });
    });
    await runSenderTick({ now: () => T0, deliver: spy });
    await runSenderTick({ now: () => T0, deliver: spy });
    expect(sent.map((m) => m.to)).toEqual([addr(1)]);
    expect(get(c.id).counters.suppressed).toBe(1);
  });

  it("cancel mid-send stops at the next recipient and stays canceled", async () => {
    const id = await queued(5);
    const spy: Deliver = async (msgs) => {
      if (sent.length === 1) await admin(request(createApp()).post(`${C}/${id}/cancel`));
      return deliver(msgs, { from: "" });
    };
    await runSenderTick({ now: () => T0, deliver: spy });
    await runSenderTick({ now: () => T0 + 1, deliver: spy });
    expect(sent).toHaveLength(2);
    expect(get(id).status).toBe("canceled");
  });

  it("a failed recipient is counted and its error is scrubbed; no address reaches logs, results or audit-able docs", async () => {
    const id = await queued(2);
    const logs: string[] = [];
    for (const l of ["info", "warn", "error", "debug"] as const) vi.spyOn(logger, l).mockImplementation(((...a: unknown[]) => void logs.push(JSON.stringify(a))) as never);
    const failing: Deliver = async (msgs) => msgs.map((m) => ({ ok: false as const, error: `550 rejected <${m.to}> mailbox user1@example.com unknown` }));
    await runSenderTick({ now: () => T0, deliver: failing });
    await runSenderTick({ now: () => T0, deliver: failing });
    expect(get(id)).toMatchObject({ status: "failed", counters: { sent: 0, failed: 2 } });
    const nonContact = JSON.stringify([...store.entries()].filter(([k]) => !k.startsWith("contact:")));
    expect(nonContact).not.toMatch(/user\d@example\.com/);
    expect(logs.join("")).not.toMatch(/user\d@example\.com/);
  });
});

/* ---- bounces: what a failed send does to the contact and to the campaign ---- */
type Fail = { kind?: "hard" | "soft" | "transient" | "policy" | "auth"; code?: number };
const HARD: Fail = { kind: "hard", code: 550 };
const SOFT: Fail = { kind: "soft", code: 452 };
const TRANSIENT: Fail = { kind: "transient", code: 421 };
const POLICY: Fail = { kind: "policy", code: 554 };
const AUTH: Fail = { kind: "auth", code: 535 };
/* The error text carries an address on purpose: it must never reach a stored doc. */
const failing = (f: Fail): Deliver => async (msgs) => msgs.map((m) => ({ ok: false as const, error: `${f.code ?? ""} rejected <${m.to}>`, ...f }));
/* One verdict per call, in call order; anything past the list is delivered. */
const script = (verdicts: Array<Fail | null>): Deliver => {
  let n = 0;
  return async (msgs) => msgs.map((m) => {
    const v = verdicts[n++] ?? null;
    return v ? { ok: false as const, error: `${v.code ?? ""} rejected <${m.to}>`, ...v } : { ok: true as const };
  });
};
const contactOf = (i: number) => store.get(`contact:${hashEmail(addr(i))}`) as Record<string, any>;
const sendDocs = (id: string) => [...store.entries()].filter(([k]) => k.startsWith(`send:${id}:`)).map(([, d]) => d as Record<string, any>);
const tick = (deliver_: Deliver, at = T0) => runSenderTick({ now: () => at, deliver: deliver_ });

describe("bounce handling", () => {
  it("a hard bounce suppresses the contact with a reason, and the next campaign never mails it", async () => {
    const id = await queued(1);
    await tick(failing(HARD));
    expect(contactOf(1)).toMatchObject({ status: "suppressed", suppressedReason: "hard-bounce" });
    expect(sendDocs(id)[0]).toMatchObject({ status: "failed", kind: "hard", code: 550 });
    const second = await mk();
    store.set(`campaign:${second.id}`, { ...get(second.id), status: "scheduled", sendAt: "2000-01-01T00:00:00.000Z" });
    await tick(deliver);
    await tick(deliver);
    expect(sent).toEqual([]);
  });

  it("a policy refusal, a login failure and an unclassified error never suppress the contact", async () => {
    for (const f of [POLICY, {} as Fail]) {
      store.clear();
      await queued(1);
      await tick(failing(f));
      expect(contactOf(1).status).toBe("active");
    }
  });

  it("three soft failures in a row, across campaigns, suppress; a delivered mail resets the count", async () => {
    await queued(1);
    await tick(failing(SOFT));
    expect(contactOf(1)).toMatchObject({ status: "active", softBounces: 1 });
    const again = async (d: Deliver) => {
      const c = await mk();
      store.set(`campaign:${c.id}`, { ...get(c.id), status: "scheduled", sendAt: "2000-01-01T00:00:00.000Z" });
      await tick(d);
      await tick(d);
    };
    await again(failing(SOFT));
    expect(contactOf(1).softBounces).toBe(2);
    await again(deliver);
    expect(contactOf(1).softBounces).toBeUndefined();
    await again(failing(SOFT));
    await again(failing(SOFT));
    expect(contactOf(1)).toMatchObject({ status: "active", softBounces: 2 });
    await again(failing(SOFT));
    expect(contactOf(1)).toMatchObject({ status: "suppressed", suppressedReason: "soft-bounces" });
    expect(contactOf(1).softBounces).toBeUndefined();
  });

  it("a transient failure is deferred and retried 15 minutes later, up to 3 tries, and the campaign waits", async () => {
    const id = await queued(1);
    await tick(failing(TRANSIENT));
    expect(sendDocs(id)[0]).toMatchObject({ status: "deferred", tries: 1, kind: "transient" });
    expect(get(id)).toMatchObject({ status: "sending", counters: { failed: 0 } });
    await tick(failing(TRANSIENT), T0 + 60_000);
    expect(sendDocs(id)[0].tries).toBe(1);
    await tick(failing(TRANSIENT), T0 + 16 * 60_000);
    expect(sendDocs(id)[0]).toMatchObject({ status: "deferred", tries: 2 });
    await tick(failing(TRANSIENT), T0 + 32 * 60_000);
    expect(sendDocs(id)[0]).toMatchObject({ status: "failed", tries: 3 });
    expect(contactOf(1)).toMatchObject({ status: "active" });
    await tick(deliver, T0 + 33 * 60_000);
    expect(get(id)).toMatchObject({ status: "failed", counters: { sent: 0, failed: 1 } });
  });

  it("a deferred mail that goes through on retry counts as sent and the campaign finishes", async () => {
    const id = await queued(1);
    await tick(failing(TRANSIENT));
    await tick(deliver, T0 + 16 * 60_000);
    await tick(deliver, T0 + 17 * 60_000);
    expect(get(id)).toMatchObject({ status: "sent", counters: { sent: 1, failed: 0 } });
    expect(sent).toHaveLength(1);
  });

  it("a login failure pauses the campaign at once, with the reason, and nobody else is tried", async () => {
    const id = await queued(5);
    const d = vi.fn(failing(AUTH));
    await tick(d);
    expect(d).toHaveBeenCalledTimes(1);
    expect(get(id)).toMatchObject({ status: "paused", pausedReason: "auth" });
    await tick(d);
    expect(d).toHaveBeenCalledTimes(1);
  });

  it("five failures in a row pause it (reason consecutive); resume restarts the window and finishes the rest", async () => {
    const id = await queued(9);
    await tick(failing(POLICY));
    expect(get(id)).toMatchObject({ status: "paused", pausedReason: "consecutive", counters: { failed: 5, sent: 0 } });
    const r = await admin(request(createApp()).post(`${C}/${id}/resume`));
    expect(r.status).toBe(200);
    expect(r.body.campaign).toMatchObject({ status: "scheduled", pausedReason: null });
    store.set(`campaign:${id}`, { ...get(id), sendAt: "2000-01-01T00:00:00.000Z" });
    await tick(deliver);
    await tick(deliver);
    expect(sent).toHaveLength(4);
    expect(get(id)).toMatchObject({ status: "failed", counters: { sent: 4, failed: 5 } });
  });

  it("10% failures after 20 attempts pause it; 9% would not", async () => {
    const id = await queued(25);
    await tick(script([null, null, null, null, POLICY, null, null, null, null, null, null, POLICY]));
    expect(get(id)).toMatchObject({ status: "paused", pausedReason: "failure-rate", counters: { sent: 18, failed: 2 } });
  });

  it("5% hard bounces after 20 attempts pause it (reason hard-bounce-rate)", async () => {
    const id = await queued(25);
    await tick(script([null, null, null, null, HARD]));
    expect(get(id)).toMatchObject({ status: "paused", pausedReason: "hard-bounce-rate", counters: { sent: 19, failed: 1 } });
  });

  it("a few failures among many do not pause it, and a mostly failed run does not end as sent", async () => {
    const id = await queued(25);
    await tick(script([null, null, null, null, POLICY, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null]));
    expect(get(id)).toMatchObject({ status: "sending", counters: { sent: 24, failed: 1 } });
    await tick(deliver);
    expect(get(id).status).toBe("sent");
    store.clear();
    const two = await queued(2);
    await tick(script([POLICY]));
    await tick(deliver);
    expect(get(two)).toMatchObject({ status: "failed", counters: { sent: 1, failed: 1 } });
  });

  it("a paused campaign can be canceled but not deleted or resumed twice; resume refuses other states", async () => {
    const id = await queued(2);
    await tick(failing(AUTH));
    expect((await admin(request(createApp()).delete(`${C}/${id}`))).status).toBe(409);
    expect((await admin(request(createApp()).post(`${C}/${id}/cancel`))).body.campaign.status).toBe("canceled");
    expect((await admin(request(createApp()).post(`${C}/${id}/resume`))).status).toBe(409);
  });

  it("no address reaches a stored doc, the audit trail or the logs", async () => {
    const id = await queued(6);
    const logs: string[] = [];
    for (const l of ["info", "warn", "error", "debug"] as const) vi.spyOn(logger, l).mockImplementation(((...a: unknown[]) => void logs.push(JSON.stringify(a))) as never);
    await tick(failing(HARD));
    expect(get(id).status).toBe("paused");
    const nonContact = JSON.stringify([...store.entries()].filter(([k]) => !k.startsWith("contact:")));
    expect(nonContact).not.toMatch(/user\d@example\.com/);
    expect(logs.join("")).not.toMatch(/user\d@example\.com/);
  });
});

describe("mail rendering", () => {
  const sender = { ...DEFAULT_ANNOUNCE_SETTINGS.sender, footerIdentity: "A <b>& Co</b>\nStreet 1" };
  it("renders from text/blocks only: every field escaped, bad links and foreign images dropped", async () => {
    const m = await renderCampaignMail(
      {
        subject: "S\r\nBcc: x@y.z", preheader: "<i>pre</i>", bodyText: "plain",
        blocks: [
          { type: "p", text: `<script>alert(1)</script> & "q"\nline2` },
          { type: "ul", items: ["<b>x</b>"] },
          { type: "cta", url: "javascript:alert(1)", label: "<bad>" },
          { type: "cta", url: "https://ok.example/?a=1&b=2", label: "Go" },
          { type: "image", url: "https://evil.example/x.png", text: "t" },
          { type: "image", url: `${env.SITE_URL}/a.png`, text: 'a"b' },
        ],
      },
      { lang: "en" }, hashEmail(addr(1)), sender,
    );
    expect(m.html).not.toMatch(/<script|<b>|<i>|javascript:|evil\.example/i);
    expect(m.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;q&quot;<br>line2");
    expect(m.html).toContain('href="https://ok.example/?a=1&amp;b=2"');
    expect(m.html).toContain(`src="${env.SITE_URL}/a.png" alt="a&quot;b"`);
    expect(m.html).toContain("A &lt;b&gt;&amp; Co&lt;/b&gt;<br>Street 1");
    expect(m.html).toContain("&lt;i&gt;pre&lt;/i&gt;");
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.text).toContain("A <b>& Co</b>");
  });

  it("Hebrew: label in subject and footer when on, absent when off, absent in English", async () => {
    const c = { subject: "שלום", bodyText: "x" };
    const on = await renderCampaignMail(c, { lang: "he" }, hashEmail(addr(1)), sender);
    expect(on.subject.startsWith(`${COMMERCIAL_LABEL_HE}: `)).toBe(true);
    expect(on.html).toContain('dir="rtl"');
    expect(on.html).toContain(`<p style="margin:0 0 8px">${COMMERCIAL_LABEL_HE}</p>`);
    const off = await renderCampaignMail(c, { lang: "he" }, hashEmail(addr(1)), { ...sender, commercialLabel: false });
    expect(off.subject).toBe("שלום");
    const en = await renderCampaignMail(c, { lang: "en" }, hashEmail(addr(1)), sender);
    expect(en.subject).toBe("שלום");
    expect(en.html).not.toContain(COMMERCIAL_LABEL_HE);
  });

  it("plain text becomes paragraphs; urls are validated with new URL", () => {
    expect(renderBody({ bodyText: "a\n\n b <i>" })).toMatch(/<p[^>]*>a<\/p>.*<p[^>]*>b &lt;i&gt;<\/p>/s);
    expect([safeHref("mailto:a@b.co"), safeHref("data:text/html,x"), safeHref("https://u:p@x.co"), safeHref("nope")]).toEqual(["mailto:a@b.co", null, null, null]);
    expect([safeImage("http://x.co/a.png"), safeImage(`${env.SITE_URL}/a.png`)]).toEqual([null, `${env.SITE_URL}/a.png`]);
  });

  it("the API refuses client HTML (bodyHtml) and unsafe block urls", async () => {
    const a = (b: Record<string, unknown>) => admin(request(createApp()).post(C).send(draft(b)));
    expect((await a({ bodyHtml: "<p>x</p>" })).status).toBe(400);
    expect((await a({ blocks: [{ type: "cta", url: "javascript:x", label: "l" }] })).status).toBe(400);
    expect((await a({ blocks: [{ type: "image", url: "https://evil.example/a.png" }] })).status).toBe(400);
    expect((await a({ blocks: [{ type: "p", text: "ok" }, { type: "cta", url: "https://x.co", label: "l" }] })).status).toBe(201);
  });
});

describe("sender settings", () => {
  const put = (sender: object) =>
    admin(request(createApp()).put("/api/admin/announce/settings").send({ settings: { ...DEFAULT_ANNOUNCE_SETTINGS, sender: { ...DEFAULT_ANNOUNCE_SETTINGS.sender, ...sender } } }));

  it("accepts the new fields and rejects bad ones", async () => {
    const ok = await put({ fromName: "Yehuda", fromAddress: "hi@example.com", replyTo: "r@example.com", throttlePerHour: 30, dailyCap: 100, quietHours: { from: "22:00", to: "07:00", tz: "Asia/Jerusalem" }, testRecipients: ["t@example.com"] });
    expect(ok.status).toBe(200);
    expect(ok.body.settings.sender.fromAddress).toBe("hi@example.com");
    for (const bad of [{ fromAddress: "nope" }, { fromName: 'a"b' }, { fromName: "a\r\nBcc: x" }, { throttlePerHour: 0 }, { dailyCap: 1e9 }, { quietHours: { from: "25:00", to: "07:00", tz: "UTC" } }, { quietHours: { from: "22:00", to: "07:00", tz: "Mars/Base" } }, { testRecipients: ["x"] }, { smtpPass: "x" }]) {
      expect((await put(bad)).status, JSON.stringify(bad)).toBe(400);
    }
  });

  it("warns, without blocking, about a domain the mail account may not send for", async () => {
    const r = await put({ fromAddress: "me@some-other-domain.invalid" });
    expect(r.status).toBe(200);
    expect(r.body.warnings).toEqual([expect.objectContaining({ field: "fromAddress", code: "domain-not-sendable" })]);
    expect(JSON.stringify(r.body)).not.toMatch(/SMTP_PASS|password/i);
  });

  it("empty fields fall back to the environment; the in-app value wins", () => {
    const s = DEFAULT_ANNOUNCE_SETTINGS.sender;
    expect(resolveSender(s)).toEqual({ from: env.MAIL_FROM, replyTo: env.MAIL_REPLY_TO || undefined });
    expect(resolveSender({ ...s, fromAddress: "a@b.co", fromName: "N", replyTo: "r@b.co" })).toEqual({ from: '"N" <a@b.co>', replyTo: "r@b.co" });
    expect(senderWarnings({ fromAddress: "" })).toEqual([]);
  });
});

describe("auto-draft", () => {
  const ev = (kind: "post" | "release"): AnnounceEvent => ({
    _id: `announce:${kind}:x:1`, type: "announce", kind, ref: "x", title: "A <b>title</b>", summary: "S", tags: [], url: "https://yehudabriskman.com/blog/x",
    langs: ["en"], createdAt: "2026-06-01T00:00:00Z", done: {},
  });
  const on = { ...DEFAULT_ANNOUNCE_SETTINGS, sender: { ...DEFAULT_ANNOUNCE_SETTINGS.sender, autoDraftCampaign: true } };

  it("is off by default, and when on makes one DRAFT per event for the subscribers group, never scheduled", async () => {
    expect(await autoDraftFor(ev("post"), DEFAULT_ANNOUNCE_SETTINGS)).toBe(false);
    expect([...store.keys()]).toEqual([]);
    expect(await autoDraftFor(ev("post"), on)).toBe(true);
    expect(await autoDraftFor(ev("post"), on)).toBe(false);
    const [doc] = [...store.values()];
    expect(doc).toMatchObject({ status: "draft", groups: ["subscribers"], topic: "blog", eventId: "announce:post:x:1" });
    expect(doc.sendAt).toBeUndefined();
    expect(doc.blocks).toContainEqual({ type: "h2", text: "A <b>title</b>" });
    expect(doc.bodyHtml).toBeUndefined();
    expect(await autoDraftFor(ev("release"), on)).toBe(true);
    expect(await autoDraftFor({ ...ev("post"), kind: "note" }, on)).toBe(false);
  });
});
