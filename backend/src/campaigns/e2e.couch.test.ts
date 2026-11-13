import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch, couchConfig } from "../db/couch.js";
import { env } from "../env.js";
import { DEFAULT_ANNOUNCE_SETTINGS, SETTINGS_DOC_ID } from "../announce/schemas.js";
import { ensureLedger } from "../audience/ledger.js";
import { hashEmail, getContact } from "../audience/store.js";
import { emailService } from "../services/email.service.js";
import { ensureSendIndex } from "./store.js";
import { runSenderTick } from "./sender.js";

/*
 * The same journey against a REAL CouchDB, which is what the in-memory fake in
 * the other tests cannot prove: Mango selectors and the send index, _all_docs by
 * keys, revision conflicts, the separate ledger database.
 *
 * Skipped unless REAL_COUCH=1. To run it (local only, nothing else is touched):
 *   docker run -d --rm --name g1-couch -p 127.0.0.1:15984:5984 -e COUCHDB_USER=admin -e COUCHDB_PASSWORD=gate-test-only couchdb:3.4
 *   REAL_COUCH=1 COUCHDB_URL=http://127.0.0.1:15984 COUCHDB_USER=admin COUCHDB_PASSWORD=gate-test-only npx vitest run src/campaigns/e2e.couch.test.ts
 * It DELETES and recreates the databases it uses, so it refuses any URL that is not 127.0.0.1/localhost.
 */
vi.mock("../mcp/router.js", () => ({ createMcpRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("../mcp/oauth/provider.js", () => ({ grantDocId: (i: string) => `mcpgrant:${i}`, grantLive: () => false, revokeGrant: async () => {} }));
vi.mock("../services/mediaImage.js", () => ({}));
vi.mock("../services/svgSanitize.js", () => ({}));
vi.mock("../routes/images.route", () => ({ createImagesRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("../routes/media.admin.route.js", async () => ({ default: (await import("express")).Router() }));

const REAL = process.env.REAL_COUCH === "1" && /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(couchConfig.base);
const LEDGER_DB = "portfolio_suppression";
const raw = (path: string, method: string) => fetch(`${couchConfig.base}/${path}`, { method, headers: { Authorization: couchConfig.auth } });

const admin = (req: request.Test) => req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
const C = "/api/admin/campaigns";
type Mail = { to: string; subject: string; text: string; html: string; headers?: Record<string, string> };
const confirmMails: Mail[] = [];
const campaignMails: Mail[] = [];

describe.skipIf(!REAL)("G1 against a real CouchDB", () => {
  beforeAll(async () => {
    for (const d of [couchConfig.db, LEDGER_DB]) await raw(d, "DELETE");
    await couch.ensureDatabase();
    await ensureSendIndex();
    /* The ledger lives in its own database, as in production. */
    const ledger = await import("../audience/ledger.js");
    ledger.useLedgerStore();
    await ensureLedger();
    vi.spyOn(emailService, "sendTo").mockImplementation(async (m) => (confirmMails.push(m), { ok: true, messageId: "m" }));
    vi.spyOn(emailService, "sendBulk").mockImplementation(async (m) => (campaignMails.push(...m), m.map(() => ({ ok: true as const }))));
    await couch.put(SETTINGS_DOC_ID, {
      _id: SETTINGS_DOC_ID, type: "settings-announce", updatedAt: new Date().toISOString(),
      settings: { ...DEFAULT_ANNOUNCE_SETTINGS, sender: { ...DEFAULT_ANNOUNCE_SETTINGS.sender, footerIdentity: "Yehuda, Tel Aviv", identityEmail: "me@example.invalid", testRecipients: ["me@example.invalid"], throttlePerHour: 100, dailyCap: 1000 } },
    });
  }, 30000);
  afterAll(() => vi.restoreAllMocks());

  const sendCampaign = async (subject: string, body: object = {}) => {
    const created = (await admin(request(createApp()).post(C).send({ name: subject, subject, bodyText: "Hello", groups: ["subscribers"] }))).body.campaign;
    expect((await admin(request(createApp()).post(`${C}/${created.id}/test`))).body).toMatchObject({ ok: true, sent: 1 });
    const { count } = (await admin(request(createApp()).get(`${C}/${created.id}/audience`))).body as { count: number };
    const r = await admin(request(createApp()).post(`${C}/${created.id}/send-now`).send({ confirmCount: count, ...body }));
    return { id: created.id as string, r, count };
  };
  const drain = async () => {
    for (let i = 0; i < 3; i++) await runSenderTick();
  };
  const tokenFrom = (m: Mail) => decodeURIComponent(/token=([^\s"&]+)/.exec(m.text)![1]);
  const delivered = () => campaignMails.filter((m) => m.to !== "me@example.invalid");

  it("signup he+en, confirm, a campaign over the real indexes, the one-click unsubscribe, the 4/30 cap, pause", async () => {
    for (const [email, lang] of [["ann@example.invalid", "en"], ["dana@example.invalid", "he"]] as const) {
      expect((await request(createApp()).post("/api/subscribe").send({ email, lang })).status).toBe(202);
    }
    await vi.waitFor(() => expect(confirmMails).toHaveLength(2));
    for (const m of confirmMails) expect((await request(createApp()).post("/api/subscribe/confirm").send({ token: tokenFrom(m) })).body.ok).toBe(true);
    expect((await getContact(hashEmail("dana@example.invalid")))?.status).toBe("active");

    /* No test send and no count: refused by the server. */
    const bare = (await admin(request(createApp()).post(C).send({ name: "x", subject: "x", bodyText: "x", groups: ["subscribers"] }))).body.campaign;
    expect((await admin(request(createApp()).post(`${C}/${bare.id}/send-now`).send({ confirmCount: 2 }))).body.code).toBe("test");

    const first = await sendCampaign("One");
    expect([first.r.status, first.count]).toEqual([200, 2]);
    await drain();
    expect(delivered().map((m) => m.to).sort()).toEqual(["ann@example.invalid", "dana@example.invalid"]);
    expect((await admin(request(createApp()).get(`${C}/${first.id}`))).body.campaign).toMatchObject({ status: "sent", counters: { sent: 2 } });

    /* One-click POST from the mail's own header. */
    const unsub = delivered().find((m) => m.to === "dana@example.invalid")!.headers!["List-Unsubscribe"];
    const path = /<([^>]+)>/.exec(unsub)![1].replace(env.SITE_URL, "");
    expect((await request(createApp()).post(path).type("form").send("List-Unsubscribe=One-Click")).status).toBe(200);
    expect((await getContact(hashEmail("dana@example.invalid")))?.status).toBe("unsubscribed");
    const ledgerLine = await (await raw(`${LEDGER_DB}/${hashEmail("dana@example.invalid")}`, "GET")).json();
    expect(ledgerLine).toMatchObject({ kind: "unsubscribed" });

    campaignMails.length = 0;
    expect((await sendCampaign("Two")).r.status).toBe(200);
    await drain();
    expect(delivered().map((m) => m.to)).toEqual(["ann@example.invalid"]);

    /* Ann has 2 in the window; two more reach the limit of 4, the fifth is refused with a count. */
    for (const n of ["Three", "Four"]) expect((await sendCampaign(n)).r.status).toBe(200);
    await drain();
    const fifth = await sendCampaign("Five");
    expect([fifth.r.status, fifth.r.body.code, fifth.r.body.capped]).toEqual([409, "cap", 1]);

    /* The kill switch on a real store. */
    expect((await admin(request(createApp()).post(`${C}/sending`).send({ paused: true }))).body).toMatchObject({ paused: true, blocked: true });
    expect((await admin(request(createApp()).get(`${C}/sending`))).body).toMatchObject({ paused: true });
    const held = (await admin(request(createApp()).post(C).send({ name: "h", subject: "h", bodyText: "h", groups: ["subscribers"] }))).body.campaign;
    expect((await admin(request(createApp()).post(`${C}/${held.id}/test`))).status).toBe(423);
    expect((await admin(request(createApp()).post(`${C}/${held.id}/send-now`).send({ confirmCount: 1, skipCapped: true }))).status).toBe(423);
    await admin(request(createApp()).post(`${C}/sending`).send({ paused: false }));
  }, 60000);
});
