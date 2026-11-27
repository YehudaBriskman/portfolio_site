import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { DEFAULT_ANNOUNCE_SETTINGS, SETTINGS_DOC_ID, type AnnounceEvent } from "../announce/schemas.js";
import { hashEmail } from "../audience/store.js";
import { ledgerPut, memoryLedgerStore, resetLedgerCache, useLedgerStore } from "../audience/ledger.js";
import { emailService } from "../services/email.service.js";
import { resetGuard } from "./guard.js";
import { resetHold, runSenderTick, type Deliver } from "./sender.js";
import { resetBudgetThresholds } from "./budgetStore.js";
import { buildIssue, compileIssue } from "./issue.js";
import { contentFingerprint } from "./readiness.js";
import type { Campaign } from "./schemas.js";

/* Issue #594: an issue mixes notes and releases, and nobody may receive a topic they switched off. */
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
  resetHold();
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

const NOW = Date.parse("2026-12-01T09:00:00Z");
const SINCE = "2026-11-01T00:00:00.000Z";
type Topics = { blog: boolean; releases: boolean };
const BOTH: Topics = { blog: true, releases: true };
const NOTES: Topics = { blog: true, releases: false };
const RELEASES: Topics = { blog: false, releases: true };

const ev = (kind: "post" | "release" | "project", ref: string, title: string, at: string, over: Partial<AnnounceEvent> = {}): AnnounceEvent => ({
  _id: `announce:${kind}:${ref}`, type: "announce", kind, ref, title, summary: `About ${title}`, tags: [], url: `https://example.org/${ref}`, langs: ["en"], publishedAt: at, createdAt: at, done: {}, ...over,
});
const note = ev("post", "n1", "SecretNote", "2026-11-10T00:00:00.000Z", { titleHe: "פוסטסודי", summaryHe: "תקציר" });
const release = ev("release", "v1.2.0", "SecretTool v1.2.0", "2026-11-20T00:00:00.000Z", { version: "v1.2.0", notes: ["SecretChange"] });
const patch = ev("release", "v1.2.1", "PatchTool v1.2.1", "2026-11-21T00:00:00.000Z", { version: "v1.2.1" });
const RELEASE_WORDS = /SecretTool|SecretChange|PatchTool|v1\.2\.[01]/;
const NOTE_WORDS = /SecretNote|פוסטסודי/;

const admin = (req: request.Test) => req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);
const addr = (name: string) => `${name}@example.com`;
const seedContact = (name: string, topics: Topics, lang: "en" | "he" = "en") => {
  const h = hashEmail(addr(name));
  const now = new Date(NOW).toISOString();
  store.set(`contact:${h}`, {
    _id: `contact:${h}`, _rev: "1-a", type: "contact", email: addr(name), lang, groups: ["subscribers"], status: "active", source: "site",
    consentAt: now, consentNote: "site-form-v2", topics, createdAt: now, updatedAt: now,
  });
};
const setSender = () =>
  store.set(SETTINGS_DOC_ID, {
    _id: SETTINGS_DOC_ID, _rev: "1-s", type: "settings-announce", updatedAt: "x",
    settings: { ...DEFAULT_ANNOUNCE_SETTINGS, sender: { ...DEFAULT_ANNOUNCE_SETTINGS.sender, warmup: false, quietHours: undefined, footerIdentity: "Yehuda", identityEmail: "me@example.org", throttlePerHour: 3600, dailyCap: 10000 } },
  });
const seedEvents = (events: AnnounceEvent[]) => events.forEach((e) => store.set(e._id, { ...e }));
const schedule = (c: Campaign) => store.set(c._id, { ...(store.get(c._id) ?? c), status: "scheduled", sendAt: "2000-01-01T00:00:00.000Z" });
const compiled = async (events = [note, release, patch]) => {
  seedEvents(events);
  return (await compileIssue(new Date(NOW), { since: SINCE }))!;
};
async function drain(d: Deliver = deliver) {
  for (let i = 0; i < 12; i++) {
    const before = sent.length;
    await runSenderTick({ now: () => NOW, deliver: d });
    if (sent.length === before && i > 0) return;
  }
}
type Mail = { to: string; subject: string; text: string; html: string };
const mails = () => sent as unknown as Mail[];
const mailTo = (name: string) => mails().find((m) => m.to === addr(name));
const whole = (m: Mail) => `${m.subject}\n${m.text}\n${m.html}`;
const stored = (c: Campaign) => store.get(c._id) as unknown as Campaign;
const docsOf = (c: Campaign) => [...store.keys()].filter((k) => k.startsWith(`send:${c._id.slice(9)}:`));

beforeEach(() => {
  (env as { SUBSCRIBE_SECRET?: string }).SUBSCRIBE_SECRET = "s".repeat(32);
  setSender();
});

describe("a compiled issue and the topics a person switched off", () => {
  it("each person gets only their topics: body, subject and preview line; one mail each", async () => {
    seedContact("both", BOTH);
    seedContact("notes", NOTES);
    seedContact("rel", RELEASES);
    seedContact("he", NOTES, "he");
    const c = await compiled();
    schedule(c);
    await drain();
    expect(sent).toHaveLength(4);
    expect(whole(mailTo("both")!)).toMatch(NOTE_WORDS);
    expect(whole(mailTo("both")!)).toMatch(RELEASE_WORDS);
    expect(mailTo("both")!.subject).toBe(c.subject);
    for (const name of ["notes", "he"]) {
      expect(whole(mailTo(name)!)).toMatch(NOTE_WORDS);
      expect(whole(mailTo(name)!)).not.toMatch(RELEASE_WORDS);
      expect(mailTo(name)!.subject).not.toMatch(/release/);
    }
    expect(mailTo("notes")!.subject).toBe("1 note since November 1, 2026");
    expect(whole(mailTo("rel")!)).toMatch(RELEASE_WORDS);
    expect(whole(mailTo("rel")!)).not.toMatch(NOTE_WORDS);
    expect(mailTo("rel")!.subject).toBe("2 releases since November 1, 2026");
    expect(stored(c).status).toBe("sent");
  });

  it("no section rule is left hanging where a section was taken out", async () => {
    const c = await compiled();
    const { viewFor } = await import("./topics.js");
    /* Releases only keeps one: between its section and its "Also shipped" line. */
    for (const [topics, rules] of [[NOTES, 0], [RELEASES, 1]] as const) {
      const types = viewFor(c, { topics, lang: "en" })!.blocks!.filter((b) => !b.lang || b.lang === "en").map((b) => b.type);
      expect(types.filter((t) => t === "rule")).toHaveLength(rules);
      expect([types[0], types.at(-1)]).not.toContain("rule");
    }
    expect(viewFor(c, { topics: BOTH, lang: "en" })).toEqual(c);
  });

  it("an owner-edited subject and preview line are kept for everyone", async () => {
    seedContact("notes", NOTES);
    const c = await compiled();
    store.set(c._id, { ...stored(c), subject: "My own subject", preheader: "My own line" });
    schedule(c);
    await drain();
    expect(mailTo("notes")!.subject).toBe("My own subject");
    expect(mailTo("notes")!.html).toContain("My own line");
  });

  it("a person whose copy would be empty is skipped: no mail, no send doc, no budget, not counted", async () => {
    seedContact("notes", NOTES);
    seedContact("rel", RELEASES);
    seedContact("none", { blog: false, releases: false });
    const c = await compiled([release]);
    schedule(c);
    await drain();
    expect(mails().map((m) => m.to)).toEqual([addr("rel")]);
    expect(docsOf(c)).toHaveLength(1);
    expect(stored(c).counters).toEqual({ queued: 1, sent: 1, failed: 0, suppressed: 0 });
    expect(stored(c).status).toBe("sent");
    expect((store.get("sender:state") as { dayCount: number }).dayCount).toBe(1);
  });

  it("a new project counts as a note", async () => {
    seedContact("notes", NOTES);
    seedContact("rel", RELEASES);
    const c = await compiled([ev("project", "p", "NewThing", "2026-11-10T00:00:00.000Z")]);
    schedule(c);
    await drain();
    expect(mails().map((m) => m.to)).toEqual([addr("notes")]);
  });

  it("a topic switched off in the middle of a batch is honoured at the next recipient", async () => {
    seedContact("a", BOTH);
    seedContact("b", BOTH);
    const c = await compiled([release]);
    schedule(c);
    await drain(async (msgs, o) => {
      for (const [id, d] of store) if (id.startsWith("contact:") && d.email !== msgs[0]!.to) store.set(id, { ...d, topics: NOTES });
      return deliver(msgs, o);
    });
    expect(sent).toHaveLength(1);
    expect(docsOf(c)).toHaveLength(1);
  });

  it("the audience that is shown, confirmed and queued counts only the people who will get it", async () => {
    seedContact("notes", NOTES);
    seedContact("rel", RELEASES);
    const c = await compiled([release]);
    store.set(c._id, { ...stored(c), tested: { at: "x", fp: contentFingerprint(stored(c)) } });
    const id = c._id.slice(9);
    const app = createApp();
    expect((await admin(request(app).get(`/api/admin/campaigns/${id}/audience`))).body.count).toBe(1);
    const unsaved = await admin(request(app).post("/api/admin/campaigns/audience")).send({ groups: ["subscribers"], blocks: c.blocks, kind: "issue" });
    expect(unsaved.body.count).toBe(1);
    vi.stubEnv("SEND_ENABLED", "true");
    const r = await admin(request(app).post(`/api/admin/campaigns/${id}/schedule`)).send({ sendAt: "2030-01-01T00:00:00.000Z" });
    expect(r.body).toMatchObject({ code: "confirm", total: 1 });
  });

  it("the editor can save the blocks back with their topics", async () => {
    const c = await compiled();
    const r = await admin(request(createApp()).patch(`/api/admin/campaigns/${c._id.slice(9)}`)).send({ blocks: c.blocks });
    expect(r.status).toBe(200);
    expect(r.body.campaign.blocks).toEqual(c.blocks);
  });
});

describe("campaigns that carry no topic marks", () => {
  /* What compileIssue stored before this fix: the same blocks, no topic on any of them. */
  const legacy = async (over: Partial<Campaign> = {}) => {
    const c = await compiled();
    const old = { ...stored(c), blocks: stored(c).blocks!.map(({ topic: _t, ...b }) => b), ...over } as Campaign & { topicLines?: unknown };
    delete old.topicLines;
    store.set(c._id, old as unknown as Record<string, unknown>);
    return old;
  };
  const seedThree = () => {
    seedContact("both", BOTH);
    seedContact("notes", NOTES);
    seedContact("rel", RELEASES);
  };

  it.each([
    ["an issue compiled before the fix", {}],
    ["its plain-text only form", { blocks: undefined }],
    ["its duplicate, which loses the kind but keeps the separators", { kind: undefined }],
  ])("%s goes only to people with both topics on", async (_name, over) => {
    seedThree();
    const c = await legacy(over);
    schedule(c);
    await drain();
    expect(mails().map((m) => m.to)).toEqual([addr("both")]);
  });

  it("a duplicate of a new issue is still filtered, and drops the preview line it cannot vouch for", async () => {
    seedContact("notes", NOTES);
    const c = await compiled();
    const copy = { ...stored(c), kind: undefined } as Campaign & { topicLines?: unknown };
    delete copy.topicLines;
    store.set(c._id, copy as unknown as Record<string, unknown>);
    schedule(c);
    await drain();
    expect(whole(mailTo("notes")!)).not.toMatch(RELEASE_WORDS);
  });

  it("a hand-written campaign is untouched", async () => {
    seedThree();
    store.set("campaign:m", { _id: "campaign:m", _rev: "1-c", type: "campaign", name: "n", subject: "Hello", bodyText: "Hi", groups: ["subscribers"], status: "scheduled", sendAt: "2000-01-01T00:00:00.000Z", counters: { queued: 0, sent: 0, failed: 0, suppressed: 0 }, createdAt: "x", updatedAt: "x" });
    await drain();
    expect(sent).toHaveLength(3);
  });
});
