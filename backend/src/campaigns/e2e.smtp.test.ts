import { createHmac } from "node:crypto";
import net, { type AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { DEFAULT_ANNOUNCE_SETTINGS, SETTINGS_DOC_ID, type AnnounceSettings } from "../announce/schemas.js";
import { memoryLedgerStore, resetLedgerCache, useLedgerStore } from "../audience/ledger.js";
import { hashEmail } from "../audience/store.js";
import { resetSecretCache } from "../audience/tokens.js";
import { resetGuard } from "./guard.js";
import { runSenderTick } from "./sender.js";

/*
 * The release gate's end-to-end run (#583 G1, G6), over the REAL mail path: the
 * SMTP provider talks to a tiny sink on 127.0.0.1, so what the assertions read is
 * the bytes a server would receive (headers, encoding, Hebrew), not a mock of the
 * mailer. Only the store is in memory. Nothing leaves the machine: the sink is the
 * only SMTP server and every address is example.invalid.
 */
vi.mock("../mcp/router.js", () => ({ createMcpRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("../mcp/oauth/provider.js", () => ({ grantDocId: (i: string) => `mcpgrant:${i}`, grantLive: () => false, revokeGrant: async () => {} }));
vi.mock("../services/mediaImage.js", () => ({}));
vi.mock("../services/svgSanitize.js", () => ({}));
vi.mock("../routes/images.route", () => ({ createImagesRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("../routes/media.admin.route.js", async () => ({ default: (await import("express")).Router() }));

/* --- the sink ---------------------------------------------------------------- */

type Mail = { to: string; raw: string; headers: Record<string, string>; body: string };
let mails: Mail[] = [];
let sink: net.Server;

function startSink(): Promise<number> {
  sink = net.createServer((sock) => {
    let to = "";
    let data = false;
    let buf = "";
    let acc = "";
    const say = (s: string) => sock.write(`${s}\r\n`);
    say("220 sink ESMTP");
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      for (;;) {
        if (data) {
          const end = buf.indexOf("\r\n.\r\n");
          if (end < 0) return;
          acc = buf.slice(0, end);
          buf = buf.slice(end + 5);
          data = false;
          const split = acc.indexOf("\r\n\r\n");
          const head = acc.slice(0, split).replace(/\r\n[ \t]+/g, " ");
          const headers: Record<string, string> = Object.fromEntries(head.split("\r\n").map((l) => [l.slice(0, l.indexOf(":")).toLowerCase(), l.slice(l.indexOf(":") + 1).trim()]));
          mails.push({ to, raw: acc, headers, body: acc.slice(split + 4) });
          say("250 queued");
          continue;
        }
        const nl = buf.indexOf("\r\n");
        if (nl < 0) return;
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === "EHLO" || cmd === "HELO") sock.write("250-sink\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n");
        else if (cmd === "AUTH") say("235 ok");
        else if (cmd === "MAIL") say("250 ok");
        else if (cmd === "RCPT") (to = /<([^>]+)>/.exec(line)![1]), say("250 ok");
        else if (cmd === "DATA") (data = true), say("354 go");
        else if (cmd === "QUIT") (say("221 bye"), sock.end());
        else say("250 ok");
      }
    });
    sock.on("error", () => {});
  });
  return new Promise((res) => sink.listen(0, "127.0.0.1", () => res((sink.address() as AddressInfo).port)));
}

beforeAll(async () => {
  /* The transport is created on first send and cached, so this must run before any mail. */
  const port = await startSink();
  Object.assign(env, { SMTP_HOST: "127.0.0.1", SMTP_PORT: port, SMTP_SECURE: false, EMAIL_PROVIDER: "smtp" });
});
afterAll(() => new Promise<void>((res) => sink.close(() => res())));

/* --- in-memory store ---------------------------------------------------------- */

let store: Map<string, Record<string, unknown>>;
let revs = 0;
beforeEach(() => {
  store = new Map();
  mails = [];
  resetSecretCache();
  resetGuard();
  resetLedgerCache();
  useLedgerStore(memoryLedgerStore());
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
    const { selector: s, limit = 25 } = q as { selector: { _id?: { $gt: string; $lt: string }; type?: string; status?: string | { $in: string[] }; at?: { $gte: string } }; limit?: number };
    const statusOk = (d: Record<string, unknown>) => !s.status || (typeof s.status === "string" ? d.status === s.status : s.status.$in.includes(d.status as string));
    const docs = [...store.entries()]
      .filter(([id, d]) => (s._id ? id > s._id.$gt && id < s._id.$lt : s.type === undefined || d.type === s.type) && statusOk(d) && (!s.at || String(d.at) >= s.at.$gte))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(0, limit)
      .map(([, d]) => structuredClone(d));
    return { docs: docs as never[] };
  });
  vi.spyOn(couch, "docs").mockImplementation(async <R>(ids: string[]) => ids.flatMap((i) => (store.has(i) ? [structuredClone(store.get(i)) as R] : [])));
});
afterEach(() => {
  vi.restoreAllMocks();
  useLedgerStore();
  env.SEND_ENABLED = undefined;
  (env as { RESEND_WEBHOOK_SECRET?: string }).RESEND_WEBHOOK_SECRET = undefined;
});

const admin = (req: request.Test) => req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
const C = "/api/admin/campaigns";
const EN = "ann@example.invalid";
const HE = "dana@example.invalid";
const setSender = (over: Partial<AnnounceSettings["sender"]> = {}) =>
  store.set(SETTINGS_DOC_ID, {
    _id: SETTINGS_DOC_ID, _rev: "1-s", type: "settings-announce", updatedAt: "x",
    settings: { ...DEFAULT_ANNOUNCE_SETTINGS, sender: { ...DEFAULT_ANNOUNCE_SETTINGS.sender, footerIdentity: "Yehuda, Tel Aviv", identityEmail: "me@example.invalid", testRecipients: ["me@example.invalid"], ...over } },
  });
const waitMails = (n: number) => vi.waitFor(() => expect(mails.length).toBeGreaterThanOrEqual(n), { timeout: 5000 });
const signup = (email: string, lang: "en" | "he") => request(createApp()).post("/api/subscribe").send({ email, lang });
const tokenFrom = (m: Mail) => decodeURIComponent(/token=([^\s"&=]+(?:=+)?)/.exec(m.raw.replace(/=\r\n/g, "").replace(/=3D/g, "="))![1]);
const decoded = (m: Mail) => m.raw.replace(/=\r\n/g, "").replace(/=3D/gi, "=");
const contact = (email: string) => store.get(`contact:${hashEmail(email)}`) as Record<string, unknown> | undefined;
const tick = async (n = 3) => { for (let i = 0; i < n; i++) await runSenderTick(); };
const mk = async (subject: string) => (await admin(request(createApp()).post(C).send({ name: subject, subject, bodyText: "Hello there", groups: ["subscribers"] }))).body.campaign.id as string;
/* The owner's real path: a test send to themselves, the audience count read from the server, then send with that count confirmed. */
const sendNow = async (subject: string, body: object = {}) => {
  const id = await mk(subject);
  const t = await admin(request(createApp()).post(`${C}/${id}/test`));
  expect(t.body).toMatchObject({ ok: true, failed: 0 });
  const { count } = (await admin(request(createApp()).get(`${C}/${id}/audience`))).body as { count: number };
  const r = await admin(request(createApp()).post(`${C}/${id}/send-now`).send({ confirmCount: count, ...body }));
  return { id, r };
};
const campaignMails = () => mails.filter((m) => m.to !== "me@example.invalid" && !/confirm/i.test(m.headers.subject ?? "") && m.headers["list-unsubscribe"]);

describe("G1: signup to unsubscribe over a real SMTP wire", () => {
  it("signup he+en: same answer for new and existing, one confirm mail each, confirm activates, a second confirm is harmless", async () => {
    const first = await signup(EN, "en");
    const hePost = await signup(HE, "he");
    const again = await signup(EN, "en");
    expect([first.status, hePost.status, again.status]).toEqual([202, 202, 202]);
    expect(first.body).toEqual(again.body);
    await waitMails(2);
    await new Promise((r) => setTimeout(r, 150));
    expect(mails.map((m) => m.to).sort()).toEqual([EN, HE]);
    const he = mails.find((m) => m.to === HE)!;
    expect(decoded(he)).toMatch(/dir="rtl"/);
    for (const m of mails) {
      const t = tokenFrom(m);
      const r = await request(createApp()).post("/api/subscribe/confirm").send({ token: t });
      expect([r.status, r.body.ok]).toEqual([200, true]);
      expect((await request(createApp()).post("/api/subscribe/confirm").send({ token: t })).status).toBe(200);
    }
    expect(contact(EN)).toMatchObject({ status: "active", lang: "en" });
    expect(contact(HE)).toMatchObject({ status: "active", lang: "he" });
    expect(JSON.stringify(first.body) + JSON.stringify(hePost.body)).not.toContain("example.invalid");
  });

  it("a campaign goes out over SMTP once per person with the one-click headers, and the one-click POST stops the next one", async () => {
    for (const [e, l] of [[EN, "en"], [HE, "he"]] as const) {
      await signup(e, l);
    }
    await waitMails(2);
    for (const m of mails) await request(createApp()).post("/api/subscribe/confirm").send({ token: tokenFrom(m) });
    mails = [];
    setSender();
    const { id, r } = await sendNow("Spring");
    expect(r.status).toBe(200);
    store.set(`campaign:${id}`, { ...store.get(`campaign:${id}`)!, sendAt: "2000-01-01T00:00:00.000Z" });
    await tick();
    await waitMails(2);
    expect(campaignMails().map((m) => m.to).sort()).toEqual([EN, HE]);
    for (const m of campaignMails()) {
      expect(m.headers["list-unsubscribe-post"]).toBe("List-Unsubscribe=One-Click");
      expect(m.headers["list-unsubscribe"]).toMatch(/^<https?:\/\/[^>]+\/api\/subscribe\/unsubscribe\?token=[^>]+>$/);
      expect(m.headers.to).toBe(m.to);
      expect(m.raw).not.toMatch(/\/api\/track|pixel|utm_/i);
    }
    await tick();
    expect(campaignMails()).toHaveLength(2);

    const heMail = campaignMails().find((m) => m.to === HE)!;
    const url = /<([^>]+)>/.exec(heMail.headers["list-unsubscribe"])![1];
    const path = url.replace(env.SITE_URL, "");
    const oc = await request(createApp()).post(path).type("form").send("List-Unsubscribe=One-Click");
    expect(oc.status).toBe(200);
    expect(contact(HE)).toMatchObject({ status: "unsubscribed" });

    mails = [];
    const second = await sendNow("Summer");
    store.set(`campaign:${second.id}`, { ...store.get(`campaign:${second.id}`)!, sendAt: "2000-01-01T00:00:00.000Z" });
    await tick();
    await waitMails(1);
    await new Promise((r2) => setTimeout(r2, 150));
    expect(campaignMails().map((m) => m.to)).toEqual([EN]);
  });

  it("the monthly limit: the fifth campaign in 30 days is refused with a count until the owner skips or overrides", async () => {
    await signup(EN, "en");
    await waitMails(1);
    await request(createApp()).post("/api/subscribe/confirm").send({ token: tokenFrom(mails[0]) });
    mails = [];
    setSender({ throttlePerHour: 100, dailyCap: 1000 });
    for (let i = 1; i <= 4; i++) {
      const { id, r } = await sendNow(`N${i}`);
      expect(r.status).toBe(200);
      store.set(`campaign:${id}`, { ...store.get(`campaign:${id}`)!, sendAt: "2000-01-01T00:00:00.000Z" });
      await tick();
      await vi.waitFor(() => expect(campaignMails()).toHaveLength(i), { timeout: 5000 });
    }
    const fifth = await sendNow("N5");
    expect([fifth.r.status, fifth.r.body.code, fifth.r.body.capped]).toEqual([409, "cap", 1]);
    expect(campaignMails()).toHaveLength(4);
  });

  it("the budget stops a campaign at its limit over the wire, and waits instead of failing", async () => {
    for (let i = 1; i <= 20; i++) {
      const email = `p${i}@example.invalid`;
      store.set(`contact:${hashEmail(email)}`, {
        _id: `contact:${hashEmail(email)}`, _rev: "1-a", type: "contact", email, lang: "en", groups: ["subscribers"], status: "active", source: "site",
        consentAt: new Date().toISOString(), consentNote: "site-form-v1", topics: { blog: true, releases: true }, createdAt: "x", updatedAt: "x",
      });
    }
    /* Usable 24 a day, 10 kept back for confirmations: 14 newsletters to 20 people, then it waits. */
    setSender({ dailyLimit: 30, monthlyLimit: 300, safety: 0.8, reserveShare: 0.2, throttlePerHour: 100, dailyCap: 1000 });
    const { id, r } = await sendNow("Budget");
    expect(r.status).toBe(200);
    store.set(`campaign:${id}`, { ...store.get(`campaign:${id}`)!, sendAt: "2000-01-01T00:00:00.000Z" });
    await tick(5);
    await vi.waitFor(() => expect(campaignMails()).toHaveLength(14), { timeout: 8000 });
    await tick(3);
    expect(campaignMails()).toHaveLength(14);
    expect((store.get(`campaign:${id}`) as { status: string }).status).toBe("sending");
  }, 20000);
});

describe("G6: nothing real goes out against the owner's pause", () => {
  const seedActive = (email: string) =>
    store.set(`contact:${hashEmail(email)}`, {
      _id: `contact:${hashEmail(email)}`, _rev: "1-a", type: "contact", email, lang: "en", groups: ["subscribers"], status: "active", source: "site",
      consentAt: new Date().toISOString(), consentNote: "site-form-v1", topics: { blog: true, releases: true }, createdAt: "x", updatedAt: "x",
    });

  it("pause all sending: queued campaigns hold at the sink, resume releases them, nobody twice", async () => {
    seedActive(EN);
    setSender();
    const { id } = await sendNow("Held");
    mails = [];
    store.set(`campaign:${id}`, { ...store.get(`campaign:${id}`)!, sendAt: "2000-01-01T00:00:00.000Z" });
    expect((await admin(request(createApp()).post(`${C}/sending`).send({ paused: true }))).body.blocked).toBe(true);
    await tick();
    await new Promise((r) => setTimeout(r, 200));
    expect(mails).toHaveLength(0);
    await admin(request(createApp()).post(`${C}/sending`).send({ paused: false }));
    await tick();
    await vi.waitFor(() => expect(mails).toHaveLength(1), { timeout: 5000 });
    await tick();
    expect(mails).toHaveLength(1);
  });

  it("SEND_ENABLED=false: not a single mail reaches the sink, not even a confirmation or a test, and the tick leaves the campaign alone", async () => {
    seedActive(EN);
    setSender();
    const { id } = await sendNow("Env");
    mails = [];
    store.set(`campaign:${id}`, { ...store.get(`campaign:${id}`)!, sendAt: "2000-01-01T00:00:00.000Z" });
    env.SEND_ENABLED = "false";
    await tick();
    const t = await admin(request(createApp()).post(`${C}/${id}/test`));
    expect(t.status).toBe(423);
    const s = await signup("new@example.invalid", "en");
    expect(s.status).toBe(202);
    await new Promise((r) => setTimeout(r, 300));
    expect(mails).toHaveLength(0);
    expect((store.get(`campaign:${id}`) as { status: string }).status).toBe("scheduled");
    env.SEND_ENABLED = undefined;
    await tick();
    await vi.waitFor(() => expect(mails.filter((m) => m.to === EN)).toHaveLength(1), { timeout: 5000 });
  });
});

describe("G6: the webhook over HTTP", () => {
  const KEY = Buffer.from("0123456789abcdef0123456789abcdef");
  const sign = (id: string, ts: number, body: string) => `v1,${createHmac("sha256", KEY).update(`${id}.${ts}.${body}`).digest("base64")}`;
  const now = () => Math.floor(Date.now() / 1000);
  const post = (body: string, o: { id?: string; ts?: number; sig?: string } = {}) => {
    const id = o.id ?? "msg_e2e";
    const ts = o.ts ?? now();
    return request(createApp()).post("/api/webhooks/resend").set("content-type", "application/json")
      .set("svix-id", id).set("svix-timestamp", String(ts)).set("svix-signature", o.sig ?? sign(id, ts, body)).send(body);
  };

  it("refuses unsigned, wrong and old requests; a signed complaint suppresses at once and replay changes nothing", async () => {
    (env as { RESEND_WEBHOOK_SECRET?: string }).RESEND_WEBHOOK_SECRET = `whsec_${KEY.toString("base64")}`;
    await signup(EN, "en");
    await waitMails(1);
    await request(createApp()).post("/api/subscribe/confirm").send({ token: tokenFrom(mails[0]) });
    const body = JSON.stringify({ type: "email.complained", created_at: "x", data: { to: [EN] } });
    expect((await request(createApp()).post("/api/webhooks/resend").set("content-type", "application/json").send(body)).status).toBe(400);
    expect((await post(body, { sig: "v1,AAAA" })).status).toBe(400);
    expect((await post(body, { ts: now() - 3600 })).status).toBe(400);
    expect(contact(EN)).toMatchObject({ status: "active" });
    expect((await post(body)).status).toBe(200);
    expect(contact(EN)).toMatchObject({ status: "suppressed" });
    expect((await post(body)).status).toBe(200);
    /* A suppressed person who signs up again is not mailed and not re-added. */
    mails = [];
    expect((await signup(EN, "en")).status).toBe(202);
    await new Promise((r) => setTimeout(r, 200));
    expect(mails).toHaveLength(0);
    expect(contact(EN)).toMatchObject({ status: "suppressed" });
  });
});
