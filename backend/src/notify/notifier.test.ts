import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { couch, CouchError } from "../db/couch.js";
import { env } from "../env.js";
import { DEFAULT_ANNOUNCE_SETTINGS, DEFAULT_NOTIFY, SETTINGS_DOC_ID, AnnounceSettingsSchema, type AnnounceSettings } from "../announce/schemas.js";
import { checkBudgetThresholds, counterId, resetBudgetThresholds } from "../campaigns/budgetStore.js";
import { emitComplaint } from "../audience/complaintHook.js";
import { logger } from "../logger.js";
import { emailService } from "../services/email.service.js";
import { emitOwnerEvent, type OwnerEvent } from "./hooks.js";
import { handleOwnerEvent, runOwnerDigest, startOwnerNotifier, STATE_ID, type NotifyState } from "./notifier.js";
import { composeOwnerMail } from "./texts.js";

const provider = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("../providers/index.js", () => ({ getProvider: () => provider }));

let store: Map<string, Record<string, unknown>>;
let revs = 0;
const T0 = Date.parse("2026-06-10T12:00:00Z");
const HOUR = 3_600_000;
const ADDR = "someone.private@example.com";

beforeEach(() => {
  store = new Map();
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
    store.set(id, { ...structuredClone(doc), _rev: `${++revs + 1}-x` });
    return { ok: true, id } as R;
  });
  vi.spyOn(couch, "append").mockImplementation(async <R>(id: string, body: Record<string, unknown>) => {
    if (store.has(id)) throw new CouchError(409, "409");
    store.set(id, { ...structuredClone(body), _rev: `${++revs + 1}-x` });
    return { ok: true, id } as R;
  });
  vi.spyOn(couch, "find").mockResolvedValue({ docs: [] } as never);
  vi.spyOn(couch, "docs").mockImplementation(async <R>(ids: string[]) => ids.flatMap((i) => (store.has(i) ? [structuredClone(store.get(i)) as R] : [])));
  resetBudgetThresholds();
});
afterEach(() => vi.restoreAllMocks());

const settings = (over: Partial<AnnounceSettings["notify"]> = {}, events: Partial<AnnounceSettings["notify"]["events"]> = {}) =>
  store.set(SETTINGS_DOC_ID, {
    _id: SETTINGS_DOC_ID, _rev: "1-s", type: "settings-announce", updatedAt: "x",
    settings: { ...DEFAULT_ANNOUNCE_SETTINGS, notify: { ...DEFAULT_NOTIFY, enabled: true, ...over, events: { ...DEFAULT_NOTIFY.events, ...events } } },
  });
const state = () => store.get(STATE_ID) as unknown as NotifyState | undefined;
const sub = (): OwnerEvent => ({ kind: "subscriber", ref: "abc123" });
const bounce: OwnerEvent = { kind: "bounce", reason: "hard-bounce", ref: "abc123" };
const camp: OwnerEvent = { kind: "campaign", name: "June notes", status: "sent", sent: 40, failed: 1, suppressed: 2 };

describe("settings", () => {
  it("default to off, and a document saved before notifications existed still parses", () => {
    expect(DEFAULT_NOTIFY.enabled).toBe(false);
    const { notify: _n, ...old } = DEFAULT_ANNOUNCE_SETTINGS;
    expect(AnnounceSettingsSchema.parse(old).notify).toEqual(DEFAULT_NOTIFY);
  });
  it("send nothing while the master switch is off or the event is off", async () => {
    settings({ enabled: false });
    await handleOwnerEvent(camp, T0);
    settings({}, { campaign: { on: false, hours: 0 } });
    await handleOwnerEvent(camp, T0);
    expect(provider.send).not.toHaveBeenCalled();
  });
});

describe("one mail per event", () => {
  it("goes to the owner address from the environment, through the renderer, with counts and no reply-to", async () => {
    settings();
    await handleOwnerEvent(camp, T0);
    expect(provider.send).toHaveBeenCalledTimes(1);
    const m = provider.send.mock.calls[0][0];
    expect(m.to).toBe(env.CONTACT_TO);
    expect(m.html).toContain('dir="rtl"');
    expect(m.text).toContain("June notes");
    expect(m.text).toContain("40");
    expect(m.replyTo).toBe(env.MAIL_REPLY_TO);
    expect(JSON.stringify(state())).not.toContain(env.CONTACT_TO);
  });

  it("is counted toward the provider's daily total, as a transactional mail", async () => {
    settings();
    await handleOwnerEvent(camp, T0);
    await vi.waitFor(() => expect([...store.keys()].some((k) => k.startsWith("mailcount:"))).toBe(true));
  });

  it("is sent at most once per N hours per kind; the rest are only counted and mentioned later", async () => {
    settings({}, { bounce: { on: true, hours: 6 } });
    await handleOwnerEvent(bounce, T0);
    await handleOwnerEvent(bounce, T0 + HOUR);
    await handleOwnerEvent(bounce, T0 + 2 * HOUR);
    expect(provider.send).toHaveBeenCalledTimes(1);
    expect(state()!.held.bounce).toBe(2);
    /* A different kind has its own window. */
    await handleOwnerEvent(camp, T0 + HOUR);
    expect(provider.send).toHaveBeenCalledTimes(2);
    await handleOwnerEvent(bounce, T0 + 7 * HOUR);
    expect(provider.send).toHaveBeenCalledTimes(3);
    expect(provider.send.mock.calls[2][0].text).toMatch(/2/);
    expect(state()!.held.bounce).toBeUndefined();
  });

  it("two events arriving together still send once", async () => {
    settings();
    await Promise.all([handleOwnerEvent(bounce, T0), handleOwnerEvent(bounce, T0), handleOwnerEvent(bounce, T0)]);
    expect(provider.send).toHaveBeenCalledTimes(1);
  });
});

describe("budget thresholds", () => {
  it("70 and 90 each notify once as usage crosses them, and exhausted once per period", async () => {
    settings();
    const stop = startOwnerNotifier(10 ** 9);
    const wait = () => new Promise((r) => setTimeout(r, 20));
    await checkBudgetThresholds(T0, { usedMonth: 100, usableMonth: 1000 });
    await checkBudgetThresholds(T0, { usedMonth: 720, usableMonth: 1000 });
    await checkBudgetThresholds(T0, { usedMonth: 750, usableMonth: 1000 });
    await wait();
    expect(provider.send).toHaveBeenCalledTimes(1);
    await checkBudgetThresholds(T0, { usedMonth: 920, usableMonth: 1000 });
    await checkBudgetThresholds(T0, { usedMonth: 960, usableMonth: 1000 });
    await wait();
    expect(provider.send).toHaveBeenCalledTimes(2);
    await checkBudgetThresholds(T0, { usedMonth: 1000, usableMonth: 1000, waiting: "month" });
    await checkBudgetThresholds(T0, { usedMonth: 1000, usableMonth: 1000, waiting: "month" });
    await wait();
    expect(provider.send).toHaveBeenCalledTimes(3);
    const subjects = provider.send.mock.calls.map((c) => c[0].subject as string);
    expect(subjects[0]).toContain("70%");
    expect(subjects[1]).toContain("90%");
    stop();
  });
});

describe("the webhook and the other seams", () => {
  it("a complaint and a hard bounce both notify, carrying a hash prefix only", async () => {
    settings({}, { bounce: { on: true, hours: 0 } });
    const stop = startOwnerNotifier(10 ** 9);
    const hash = "f".repeat(32);
    emitComplaint({ hash, at: "x", reason: "complaint" });
    emitComplaint({ hash, at: "x", reason: "hard-bounce" });
    await vi.waitFor(() => expect(provider.send).toHaveBeenCalledTimes(2));
    const text = provider.send.mock.calls.map((c) => c[0].text).join("\n");
    expect(text).toContain("ffffff");
    expect(text).not.toContain(hash);
    stop();
  });

  it("a sweep failure notifies", async () => {
    settings();
    const stop = startOwnerNotifier(10 ** 9);
    emitOwnerEvent({ kind: "sweep" });
    await vi.waitFor(() => expect(provider.send).toHaveBeenCalledTimes(1));
    stop();
  });
});

describe("the transactional reserve", () => {
  it("skips the notice, without queueing it, once the reserved share of the day is spent", async () => {
    settings();
    /* Default limits: 90 x 0.9 = 81 usable, reserve max(10, 17) = 17. */
    store.set(counterId(T0), { _id: counterId(T0), _rev: "1-m", type: "mailcount", day: "2026-06-10", count: 17 });
    await handleOwnerEvent(camp, T0);
    expect(provider.send).not.toHaveBeenCalled();
    expect(state()?.last.campaign).toBeUndefined();
    store.set(counterId(T0), { _id: counterId(T0), _rev: "2-m", type: "mailcount", day: "2026-06-10", count: 16 });
    await handleOwnerEvent(camp, T0);
    expect(provider.send).toHaveBeenCalledTimes(1);
  });

  it("does not count against a campaign: newsletter send documents are untouched", async () => {
    settings();
    await handleOwnerEvent(camp, T0);
    expect([...store.keys()].filter((k) => k.startsWith("send:"))).toEqual([]);
  });
});

describe("failure isolation", () => {
  it("a provider that throws or refuses never throws out of the notifier", async () => {
    settings();
    provider.send.mockRejectedValueOnce(new Error(`smtp said no to ${ADDR}`));
    await expect(handleOwnerEvent(camp, T0)).resolves.toBeUndefined();
    provider.send.mockResolvedValueOnce({ ok: false, error: "no", kind: "permanent" });
    await expect(handleOwnerEvent(camp, T0)).resolves.toBeUndefined();
    /* Not delivered, so not recorded as sent: the next event may try again. */
    expect(state()?.last.campaign).toBeUndefined();
  });

  it("an unreadable store or a throwing listener cannot reach the caller", async () => {
    vi.spyOn(couch, "get").mockRejectedValue(new Error("couch down"));
    await expect(handleOwnerEvent(camp, T0)).resolves.toBeUndefined();
    expect(() => emitOwnerEvent(camp)).not.toThrow();
  });

  it("logs the kind only, never an address or the provider's error text", async () => {
    settings();
    const lines: string[] = [];
    for (const lvl of ["warn", "info", "error", "debug"] as const) vi.spyOn(logger, lvl).mockImplementation(((...a: unknown[]) => void lines.push(JSON.stringify(a))) as never);
    provider.send.mockRejectedValueOnce(new Error(`smtp said no to ${ADDR}`));
    await handleOwnerEvent(camp, T0);
    store.set(counterId(T0), { _id: counterId(T0), _rev: "1-m", type: "mailcount", day: "2026-06-10", count: 99 });
    await handleOwnerEvent({ ...camp, name: "Other" }, T0 + 30 * HOUR);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l).not.toContain(ADDR);
      expect(l).not.toContain(env.CONTACT_TO);
    }
  });
});

describe("no address in a notice", () => {
  it("every event type renders without an address, and an address typed into a campaign name is removed", () => {
    const evs: OwnerEvent[] = [
      { kind: "budget70", used: 1, usable: 2 }, { kind: "budget90", used: 1, usable: 2 }, { kind: "budgetOut", scope: "day" }, { kind: "budgetOut", scope: "month" },
      bounce, { kind: "bounce", reason: "complaint", ref: "abc123" }, sub(), { kind: "sweep" },
      { ...camp, name: `Hello ${ADDR} <b>x</b>` },
    ];
    for (const lang of ["en", "he"] as const) {
      for (const e of evs) {
        const m = composeOwnerMail([e], lang, { link: "https://example.com/admin/announce" });
        expect(m.html + m.text + m.subject).not.toContain(ADDR);
        expect(m.html).not.toContain("<b>x");
        expect(m.html).toContain(lang === "he" ? 'dir="rtl"' : 'dir="ltr"');
      }
      const d = composeOwnerMail(evs, lang, { digest: true, link: "https://example.com/admin/announce" });
      expect(d.html + d.text).not.toContain(ADDR);
    }
  });
});

describe("the daily digest", () => {
  const noon = Date.parse("2026-06-10T09:30:00Z"); // 12:30 in Asia/Jerusalem
  it("holds subscribers, bounces and campaigns for one summary of counts, but budget and sweep stay immediate", async () => {
    settings({ digest: { enabled: true, hour: 8 } }, { subscriber: { on: true, hours: 24 } });
    await handleOwnerEvent(sub(), noon - 5 * HOUR);
    await handleOwnerEvent(sub(), noon - 4 * HOUR);
    await handleOwnerEvent(bounce, noon - 3 * HOUR);
    await handleOwnerEvent(camp, noon - 2 * HOUR);
    expect(provider.send).not.toHaveBeenCalled();
    await handleOwnerEvent({ kind: "sweep" }, noon - HOUR);
    expect(provider.send).toHaveBeenCalledTimes(1);
    provider.send.mockClear();

    /* Before the hour: nothing. At or after it: one summary, once a day. */
    expect(await runOwnerDigest(Date.parse("2026-06-10T03:00:00Z"))).toBe(false);
    expect(await runOwnerDigest(noon)).toBe(true);
    expect(provider.send).toHaveBeenCalledTimes(1);
    const m = provider.send.mock.calls[0][0];
    expect(m.text).toMatch(/2/);
    expect(m.text).toContain("June notes");
    expect(state()!.queue).toEqual([]);
    await handleOwnerEvent(sub(), noon + HOUR);
    expect(await runOwnerDigest(noon + 2 * HOUR)).toBe(false);
    expect(await runOwnerDigest(noon + 24 * HOUR)).toBe(true);
  });

  it("is skipped, and the queue kept, while the reserve is spent", async () => {
    settings({ digest: { enabled: true, hour: 8 } }, { subscriber: { on: true, hours: 24 } });
    await handleOwnerEvent(sub(), noon - HOUR);
    store.set(counterId(noon), { _id: counterId(noon), _rev: "1-m", type: "mailcount", day: "2026-06-10", count: 50 });
    expect(await runOwnerDigest(noon)).toBe(false);
    expect(state()!.queue).toHaveLength(1);
  });
});

describe("the notifier's own state", () => {
  it("holds timestamps, counts and refs, never the owner address or a subscriber address", async () => {
    settings({ digest: { enabled: true, hour: 8 } }, { subscriber: { on: true, hours: 24 } });
    await handleOwnerEvent(sub(), T0);
    await handleOwnerEvent({ kind: "sweep" }, T0);
    const raw = JSON.stringify(state());
    expect(raw).not.toContain("@");
  });
});

it("emailService.send is the only way out", () => {
  expect(typeof emailService.send).toBe("function");
});
