import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { AnnounceSettingsSchema, DEFAULT_ANNOUNCE_SETTINGS, SETTINGS_DOC_ID, validateSenderBudget, type AnnounceSettings } from "../announce/schemas.js";
import { hashEmail } from "../audience/store.js";
import { ledgerPut, memoryLedgerStore, resetLedgerCache, useLedgerStore } from "../audience/ledger.js";
import { emailService } from "../services/email.service.js";
import { resetGuard } from "./guard.js";
import { runSenderTick, type Deliver } from "./sender.js";
import { canSendTransactional, checkBudgetThresholds, counterId, countTransactional, onBudgetThreshold, resetBudgetThresholds } from "./budgetStore.js";

/* The same in-memory couch as campaigns.test.ts; the stubs only let app.ts load on a box without the optional deps. */
vi.mock("../mcp/router.js", () => ({ createMcpRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("../mcp/oauth/provider.js", () => ({ grantDocId: (i: string) => `mcpgrant:${i}`, grantLive: () => false, revokeGrant: async () => {} }));
vi.mock("../services/mediaImage.js", () => ({}));
vi.mock("../services/svgSanitize.js", () => ({}));
vi.mock("../routes/images.route", () => ({ createImagesRouter: () => (_q: unknown, _r: unknown, next: () => void) => next() }));
vi.mock("../routes/media.admin.route.js", async () => ({ default: (await import("express")).Router() }));
const provider = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("../providers/index.js", () => ({ getProvider: () => provider }));

let store: Map<string, Record<string, unknown>>;
let revs = 0;
let sent: Array<{ to: string }>;
const deliver: Deliver = async (msgs) => {
  sent.push(...msgs);
  return msgs.map(() => ({ ok: true as const }));
};

beforeEach(() => {
  store = new Map();
  sent = [];
  provider.send.mockReset();
  provider.send.mockResolvedValue({ ok: true, messageId: "m" });
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
  useLedgerStore(memoryLedgerStore());
  resetLedgerCache();
  resetGuard();
  resetBudgetThresholds();
});
afterEach(() => {
  vi.restoreAllMocks();
  useLedgerStore();
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T0 = Date.parse("2026-06-10T12:00:00Z");
const addr = (i: number) => `user${i}@example.com`;
const setSender = (over: Partial<AnnounceSettings["sender"]> = {}) =>
  store.set(SETTINGS_DOC_ID, {
    _id: SETTINGS_DOC_ID, _rev: "1-s", type: "settings-announce", updatedAt: "x",
    /* A wide pace so the budget, not the throttle, is what limits these tests. */
    settings: { ...DEFAULT_ANNOUNCE_SETTINGS, sender: { ...DEFAULT_ANNOUNCE_SETTINGS.sender, footerIdentity: "Yehuda, Tel Aviv", identityEmail: "me@example.org", throttlePerHour: 3600, dailyCap: 10000, ...over } },
  });
const seedContacts = (n: number) => {
  for (let i = 1; i <= n; i++) {
    const h = hashEmail(addr(i));
    const now = new Date(T0).toISOString();
    store.set(`contact:${h}`, {
      _id: `contact:${h}`, _rev: "1-a", type: "contact", email: addr(i), lang: "en", groups: ["subscribers"], status: "active", source: "site",
      consentAt: now, consentNote: "site-form-v1", topics: { blog: true, releases: true }, createdAt: now, updatedAt: now,
    });
  }
};
const seedCampaign = (id = "c1") =>
  store.set(`campaign:${id}`, {
    _id: `campaign:${id}`, _rev: "1-c", type: "campaign", name: "n", subject: "Hello", bodyText: "Hi", groups: ["subscribers"], status: "scheduled",
    sendAt: "2000-01-01T00:00:00.000Z", counters: { queued: 0, sent: 0, failed: 0, suppressed: 0 }, createdAt: "x", updatedAt: "x",
  });
const status = (id = "c1") => (store.get(`campaign:${id}`) as { status: string }).status;
const sendDocs = (id = "c1") => [...store.entries()].filter(([k]) => k.startsWith(`send:${id}:`)).map(([, d]) => d as { status: string; at: string });
/* Ticks until a pass sends nothing more. */
async function drain(now: number, d: Deliver = deliver) {
  for (let i = 0; i < 12; i++) {
    const before = sent.length;
    await runSenderTick({ now: () => now, deliver: d });
    if (sent.length === before && i > 0) return;
  }
}
const countersAt = (ms: number, n: number) => store.set(counterId(ms), { _id: counterId(ms), _rev: "1-m", type: "mailcount", day: new Date(ms).toISOString().slice(0, 10), count: n });

describe("the sender and the mail budget", () => {
  it("sends no more than usable - reserve in a day, then waits: the reserved share is never touched", async () => {
    /* limit 40 x 0.9 = 36 usable; reserve max(10, 20%) = 10; capacity 26. */
    setSender({ dailyLimit: 40 });
    seedContacts(60);
    seedCampaign();
    await drain(T0);
    expect(sent).toHaveLength(26);
    expect(status()).toBe("sending");
    /* The whole day later nothing changes until the window rolls. */
    await drain(T0 + 12 * HOUR);
    expect(sent).toHaveLength(26);
  });

  it("resumes when the rolling 24 h window frees room, and never sends the same person twice", async () => {
    setSender({ dailyLimit: 40 });
    seedContacts(60);
    seedCampaign();
    await drain(T0);
    expect(sent).toHaveLength(26);
    await drain(T0 + DAY + 1);
    expect(sent).toHaveLength(52);
    await drain(T0 + 2 * DAY + 2);
    expect(sent).toHaveLength(60);
    expect(new Set(sent.map((m) => m.to)).size).toBe(60);
    expect(status()).toBe("sent");
  });

  it("transactional mail beyond its share narrows the newsletter's room by the difference", async () => {
    setSender({ dailyLimit: 40 });
    countersAt(T0, 16);
    seedContacts(60);
    seedCampaign();
    await drain(T0);
    /* 36 - max(16, 10) = 20 */
    expect(sent).toHaveLength(20);
  });

  it("the month is a limit too: a spent month waits for the first of the next, then resumes", async () => {
    setSender({ dailyLimit: 90, monthlyLimit: 40 });
    seedContacts(60);
    seedCampaign();
    const late = Date.parse("2026-06-29T12:00:00Z");
    await drain(late);
    /* month usable 36, one day's reserve (17 of 81) held back: 19 */
    expect(sent).toHaveLength(19);
    await drain(late + 2 * DAY - 13 * HOUR);
    expect(sent).toHaveLength(19);
    await drain(Date.parse("2026-07-01T00:30:00Z"));
    expect(sent).toHaveLength(38);
  });

  it("a restart does not double count: the budget is read from the send docs, not from memory", async () => {
    setSender({ dailyLimit: 40 });
    seedContacts(60);
    seedCampaign();
    await runSenderTick({ now: () => T0, deliver });
    expect(sent.length).toBeGreaterThan(0);
    /* Everything the process knew is gone, including the pace bookkeeping. */
    store.delete("sender:state");
    resetGuard();
    await drain(T0 + 1000);
    expect(sent).toHaveLength(26);
    expect(sendDocs().filter((d) => d.status === "sent")).toHaveLength(26);
  });

  it("a person at the per-contact limit takes no budget: only mail that went out is counted", async () => {
    setSender({ dailyLimit: 40, maxPerContact30d: 1 });
    seedContacts(30);
    for (let i = 1; i <= 10; i++) {
      const h = hashEmail(addr(i));
      store.set(`send:old:${h}`, { _id: `send:old:${h}`, type: "send", campaignId: "old", contact: h, status: "sent", at: new Date(T0 - 2 * DAY).toISOString() });
    }
    seedCampaign();
    await drain(T0);
    /* 20 people were left, all within the 26 of room; the 10 capped ones were skipped without a mail. */
    expect(sent).toHaveLength(20);
    expect(sendDocs().filter((d) => d.status === "capped")).toHaveLength(10);
    const { budget } = await (await import("./budgetStore.js")).budgetNow(T0 + 1000);
    expect(budget.usedDay).toBe(20);
  });

  it("a contact on the suppression ledger is not mailed and costs nothing", async () => {
    setSender({ dailyLimit: 40 });
    seedContacts(5);
    await ledgerPut(hashEmail(addr(1)), "unsubscribed");
    seedCampaign();
    await drain(T0);
    expect(sent.map((m) => m.to)).not.toContain(addr(1));
    expect(sent).toHaveLength(4);
  });

  it("failures do not use budget, and the auto-pause rules still judge them", async () => {
    setSender({ dailyLimit: 40 });
    seedContacts(30);
    seedCampaign();
    const failing: Deliver = async (msgs) => msgs.map(() => ({ ok: false as const, error: "421 try later", kind: "soft" as const }));
    await runSenderTick({ now: () => T0, deliver: failing });
    expect(status()).toBe("paused");
    expect((store.get("campaign:c1") as { pausedReason: string }).pausedReason).toBe("consecutive");
    const { budget } = await (await import("./budgetStore.js")).budgetNow(T0 + 1000);
    expect(budget.usedDay).toBe(0);
  });
});

describe("transactional counter", () => {
  const day = new Date(T0).toISOString().slice(0, 10);
  it("counts a confirmation, the contact notice and the auto-reply: a number per day, no address", async () => {
    await emailService.sendTo({ to: "someone@example.org", subject: "s", text: "t", html: "<p>t</p>" });
    await vi.waitFor(() => expect(store.get(`mailcount:${new Date().toISOString().slice(0, 10)}`)).toMatchObject({ type: "mailcount", count: 1 }));
    await emailService.send({ subject: "Hi", text: "x", html: "<p>x</p>", replyTo: "visitor@example.org" } as never);
    await vi.waitFor(() => expect((store.get(`mailcount:${new Date().toISOString().slice(0, 10)}`) as { count: number }).count).toBe(3));
    expect(JSON.stringify([...store.values()])).not.toMatch(/@/);
  });

  it("does not count a mail the provider refused", async () => {
    provider.send.mockResolvedValue({ ok: false, error: "no" });
    await emailService.sendTo({ to: "someone@example.org", subject: "s", text: "t", html: "<p>t</p>" });
    await new Promise((r) => setTimeout(r, 20));
    expect([...store.keys()].filter((k) => k.startsWith("mailcount:"))).toHaveLength(0);
  });

  it("increments one document per UTC day and survives a revision clash", async () => {
    await countTransactional(T0);
    await countTransactional(T0 + HOUR);
    await countTransactional(T0 + DAY);
    expect((store.get(`mailcount:${day}`) as { count: number }).count).toBe(2);
    expect([...store.keys()].filter((k) => k.startsWith("mailcount:"))).toHaveLength(2);
    let clashed = false;
    const put = couch.put as unknown as ReturnType<typeof vi.fn>;
    const real = put.getMockImplementation()! as (id: string, body: unknown) => Promise<unknown>;
    put.mockImplementationOnce(async (id: string, body: unknown) => {
      clashed = true;
      store.set(id, { ...(store.get(id) as object), _rev: "9-other", count: 5 });
      return real(id, body);
    });
    await countTransactional(T0);
    expect(clashed).toBe(true);
    expect((store.get(`mailcount:${day}`) as { count: number }).count).toBe(6);
  });

  it("never throws when the store is down", async () => {
    vi.spyOn(couch, "get").mockRejectedValue(new CouchError(0, "down"));
    await expect(countTransactional(T0)).resolves.toBeUndefined();
  });

  it("canSendTransactional answers from the reserved share", async () => {
    setSender({ dailyLimit: 40 });
    seedContacts(60);
    seedCampaign();
    await drain(Date.now());
    /* Newsletters have used their room; the reserve is still there for a confirmation. */
    expect(await canSendTransactional()).toBe(true);
    countersAt(Date.now(), 9);
    expect(await canSendTransactional()).toBe(true);
    /* Past the share and past the provider's own 40 a day: no. */
    countersAt(Date.now(), 14);
    expect(await canSendTransactional()).toBe(false);
  });

  it("fails open when it cannot count", async () => {
    vi.spyOn(couch, "find").mockRejectedValue(new CouchError(0, "down"));
    expect(await canSendTransactional()).toBe(true);
  });
});

describe("threshold hook", () => {
  it("fires once per month at 70 and 90 percent, and again in the next month", async () => {
    const seen: Array<[number, string]> = [];
    onBudgetThreshold((e) => void seen.push([e.threshold, e.month]));
    const may = Date.parse("2026-06-10T00:00:00Z");
    await checkBudgetThresholds(may, { usedMonth: 100, usableMonth: 1000 });
    expect(seen).toEqual([]);
    await checkBudgetThresholds(may, { usedMonth: 700, usableMonth: 1000 });
    await checkBudgetThresholds(may, { usedMonth: 750, usableMonth: 1000 });
    expect(seen).toEqual([[70, "2026-06"]]);
    await checkBudgetThresholds(may, { usedMonth: 950, usableMonth: 1000 });
    expect(seen).toEqual([[70, "2026-06"], [90, "2026-06"]]);
    await checkBudgetThresholds(Date.parse("2026-07-02T00:00:00Z"), { usedMonth: 900, usableMonth: 1000 });
    expect(seen.slice(2)).toEqual([[70, "2026-07"], [90, "2026-07"]]);
  });

  it("a hook that throws does not stop the sender", async () => {
    onBudgetThreshold(() => {
      throw new Error("boom");
    });
    await expect(checkBudgetThresholds(T0, { usedMonth: 950, usableMonth: 1000 })).resolves.toBeUndefined();
  });

  it("the sender reports the month crossing 70 percent", async () => {
    setSender({ dailyLimit: 90, monthlyLimit: 40 });
    const seen: number[] = [];
    onBudgetThreshold((e) => void seen.push(e.threshold));
    seedContacts(30);
    seedCampaign();
    await drain(T0);
    /* month usable 36; 19 sent is 53 percent. */
    expect(seen).toEqual([]);
    countersAt(T0, 10);
    store.set("campaign:c1", { ...(store.get("campaign:c1") as object), status: "scheduled", sendAt: "2000-01-01T00:00:00.000Z" });
    await drain(T0 + DAY + 1);
    expect(seen).toContain(70);
  });
});

describe("settings and the budget route", () => {
  const admin = (req: request.Test) => req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
  const put = (sender: object) =>
    admin(request(createApp()).put("/api/admin/announce/settings").send({ settings: { ...DEFAULT_ANNOUNCE_SETTINGS, sender: { ...DEFAULT_ANNOUNCE_SETTINGS.sender, ...sender } } }));

  it("defaults are 90 a day, 2700 a month, safety 0.9, a fifth reserved", () => {
    expect(DEFAULT_ANNOUNCE_SETTINGS.sender).toMatchObject({ dailyLimit: 90, monthlyLimit: 2700, safety: 0.9, reserveShare: 0.2 });
    const { dailyLimit: _a, monthlyLimit: _b, safety: _c, reserveShare: _d, ...old } = DEFAULT_ANNOUNCE_SETTINGS.sender;
    void [_a, _b, _c, _d];
    expect(AnnounceSettingsSchema.parse({ ...DEFAULT_ANNOUNCE_SETTINGS, sender: old }).sender).toMatchObject({ dailyLimit: 90, monthlyLimit: 2700 });
  });

  it("is validated on PUT only: bad values are refused there, and a stored one still reads", async () => {
    for (const bad of [{ dailyLimit: 0 }, { dailyLimit: 1.5 }, { monthlyLimit: 50 }, { safety: 1.2 }, { safety: 0.2 }, { reserveShare: 0.9 }, { reserveShare: -1 }]) {
      const r = await put(bad);
      expect(r.status, JSON.stringify(bad)).toBe(400);
      expect(r.body.issues[0].path).toMatch(/^sender\./);
    }
    expect(validateSenderBudget(DEFAULT_ANNOUNCE_SETTINGS.sender)).toEqual([]);
    expect((await put({ dailyLimit: 100, monthlyLimit: 3000, safety: 1, reserveShare: 0 })).status).toBe(200);
    store.set(SETTINGS_DOC_ID, { ...(store.get(SETTINGS_DOC_ID) as object), settings: { ...DEFAULT_ANNOUNCE_SETTINGS, sender: { ...DEFAULT_ANNOUNCE_SETTINGS.sender, dailyLimit: 0 } } });
    expect((await admin(request(createApp()).get("/api/admin/announce/settings"))).body.settings.sender.dailyLimit).toBe(0);
  });

  it("GET /budget is admin only and answers with counts, never an address", async () => {
    expect((await request(createApp()).get("/api/admin/campaigns/budget")).status).toBeGreaterThanOrEqual(401);
    setSender({ dailyLimit: 40 });
    seedContacts(60);
    seedCampaign();
    await drain(Date.now());
    const r = await admin(request(createApp()).get("/api/admin/campaigns/budget?remaining=60"));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, capacity: 0, waiting: "day", today: { used: 26, usable: 36, reserve: 10, room: 0 }, month: { used: 26 } });
    expect(r.body.plan.days).toBeGreaterThanOrEqual(2);
    expect(typeof r.body.resumeAt).toBe("string");
    expect(JSON.stringify(r.body)).not.toContain("@");
  });
});
