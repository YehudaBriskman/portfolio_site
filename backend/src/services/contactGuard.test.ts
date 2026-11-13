import type { Mock } from "vitest";
import request from "supertest";
import express from "express";
import emailRoutes from "../routes/email.route.js";
import * as providers from "../providers/index.js";
import { logger } from "../logger.js";
import { env } from "../env.js";
import { resetContactGuard, CLIENT_LIMIT, GLOBAL_LIMIT, ADDRESS_WINDOW_MS, allowAutoReply, reserveNotice, reserveAutoReply } from "./contactGuard.js";

const body = (replyTo: string, extra: Record<string, unknown> = {}) => ({
  subject: "Hi",
  text: "Hello there",
  replyTo,
  ...extra,
});

let send: Mock;
let app: express.Express;

const post = (payload: object, ip = "203.0.113.7") =>
  request(app).post("/api/email/send").set("X-Forwarded-For", `${ip}, 10.42.0.17`).send(payload);
const sentTo = () => send.mock.calls.map((c) => c[0].to as string);
const settle = () => new Promise((r) => setTimeout(r, 20));

beforeEach(() => {
  resetContactGuard();
  send = vi.fn().mockResolvedValue({ ok: true, messageId: "m" });
  vi.spyOn(providers, "getProvider").mockReturnValue({ send } as never);
  // The route alone, with the proxy depth the real app sets: the limits under test live in the route.
  app = express();
  app.set("trust proxy", 2);
  app.use(express.json());
  app.use("/api/email", emailRoutes);
});
afterEach(() => vi.restoreAllMocks());

describe("contact form limits", () => {
  it("answers a send, a honeypot hit, a client limit and a daily ceiling with the same body", async () => {
    const ok = await post(body("a1@example.invalid"));
    const bot = await post(body("a2@example.invalid", { website: "http://spam.invalid" }));
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ ok: true });
    expect(bot.status).toBe(200);
    expect(bot.body).toEqual(ok.body);

    for (let i = 0; i < CLIENT_LIMIT; i++) await post(body(`c${i}@example.invalid`));
    const limited = await post(body("z@example.invalid"));
    expect(limited.status).toBe(200);
    expect(limited.body).toEqual(ok.body);
  });

  it("drops a honeypot hit without sending anything or counting it", async () => {
    for (let i = 0; i < CLIENT_LIMIT + 2; i++) await post(body("bot@example.invalid", { website: "x" }));
    await settle();
    expect(send).not.toHaveBeenCalled();
    // The honeypot did not use the client's allowance.
    await post(body("real@example.invalid"));
    expect(sentTo()).toContain(env.CONTACT_TO);
  });

  it("limits one client, and another client is unaffected", async () => {
    for (let i = 0; i < CLIENT_LIMIT + 3; i++) await post(body(`u${i}@example.invalid`));
    await settle();
    const ownerNotices = sentTo().filter((t) => t === env.CONTACT_TO);
    expect(ownerNotices).toHaveLength(CLIENT_LIMIT);
    await post(body("other@example.invalid"), "198.51.100.9");
    expect(sentTo().filter((t) => t === env.CONTACT_TO)).toHaveLength(CLIENT_LIMIT + 1);
  });

  it("limits the whole form across clients", async () => {
    for (let i = 0; i < GLOBAL_LIMIT + 5; i++) {
      // No address, so no auto-reply: only the global limit is in play, not the daily ceiling.
      await post({ subject: "Hi", text: "Hello there" }, `192.0.2.${i + 1}`);
    }
    await settle();
    expect(sentTo().filter((t) => t === env.CONTACT_TO)).toHaveLength(GLOBAL_LIMIT);
  });

  it("sends the owner notice every time but at most one auto-reply an hour to one address", async () => {
    await post(body("Same@Example.invalid"));
    await post(body("same@example.invalid"));
    await settle();
    expect(sentTo().filter((t) => t === env.CONTACT_TO)).toHaveLength(2);
    expect(sentTo().filter((t) => t === "Same@Example.invalid" || t === "same@example.invalid")).toHaveLength(1);
  });

  it("allows the address again after the window", () => {
    const t0 = 1_000_000;
    expect(allowAutoReply("x@example.invalid", t0)).toBe(true);
    expect(allowAutoReply("X@example.invalid", t0 + ADDRESS_WINDOW_MS - 1)).toBe(false);
    expect(allowAutoReply("x@example.invalid", t0 + ADDRESS_WINDOW_MS + 1)).toBe(true);
  });

  it("at the mail ceiling stops auto-replies first and still sends every owner notice", async () => {
    // Default 30 mails: 15 messages use it up with a reply each; the next 5 get a notice only.
    for (let i = 0; i < 20; i++) {
      const res = await post(body(`d${i}@example.invalid`), `192.0.2.${i + 1}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    }
    await settle();
    expect(env.CONTACT_DAILY_MAIL_CEILING).toBe(30);
    expect(sentTo().filter((t) => t === env.CONTACT_TO)).toHaveLength(20);
    expect(send).toHaveBeenCalledTimes(35);
  });

  it("past the notice ceiling sends nothing and answers the same", async () => {
    const e = env as { CONTACT_DAILY_NOTICE_CEILING: number };
    const was = e.CONTACT_DAILY_NOTICE_CEILING;
    e.CONTACT_DAILY_NOTICE_CEILING = 3;
    try {
      let first: request.Response | undefined;
      for (let i = 0; i < 5; i++) {
        const res = await post({ subject: "Hi", text: "Hello there" }, `192.0.2.${i + 1}`);
        first ??= res;
        expect(res.status).toBe(200);
        expect(res.body).toEqual(first.body);
      }
      await settle();
      expect(send).toHaveBeenCalledTimes(3);
    } finally {
      e.CONTACT_DAILY_NOTICE_CEILING = was;
    }
  });

  it("starts both counters again on the next UTC day", () => {
    const e = env as { CONTACT_DAILY_NOTICE_CEILING: number };
    const was = e.CONTACT_DAILY_NOTICE_CEILING;
    e.CONTACT_DAILY_NOTICE_CEILING = 1;
    try {
      const d1 = Date.UTC(2026, 0, 1, 23, 59);
      expect(reserveNotice(d1)).toBe(true);
      expect(reserveNotice(d1)).toBe(false);
      expect(reserveNotice(d1 + 2 * 60_000)).toBe(true);
    } finally {
      e.CONTACT_DAILY_NOTICE_CEILING = was;
    }
    resetContactGuard();
    for (let i = 0; i < env.CONTACT_DAILY_MAIL_CEILING; i++) expect(reserveAutoReply(5)).toBe(true);
    expect(reserveAutoReply(5)).toBe(false);
    expect(reserveAutoReply(5 + 86_400_000)).toBe(true);
  });

  it("never puts an address in a log line", async () => {
    const lines: string[] = [];
    for (const m of ["warn", "error", "info", "debug"] as const) {
      vi.spyOn(logger, m).mockImplementation(((...a: unknown[]) => void lines.push(JSON.stringify(a))) as never);
    }
    send.mockResolvedValueOnce({ ok: true, messageId: "1" }).mockResolvedValueOnce({ ok: false, error: "550 rejected stranger@example.invalid", kind: "recipient" });
    await post(body("stranger@example.invalid"));
    await settle();
    // Same address again (auto-reply window) and a client over its limit.
    for (let i = 0; i < CLIENT_LIMIT + 1; i++) await post(body("stranger@example.invalid"));
    await settle();
    const all = lines.join("\n");
    expect(all).toContain("auto-reply failed");
    expect(all).not.toMatch(/stranger@example\.invalid/);
    expect(all).not.toContain(env.CONTACT_TO);
  });
});
