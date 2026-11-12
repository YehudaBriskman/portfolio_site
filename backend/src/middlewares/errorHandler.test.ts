import express from "express";
import request from "supertest";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { asyncHandler } from "./asyncHandler.js";
import { errorHandler } from "./errorHandler.js";
import { requestLogger } from "./logger.js";

/*
 * The handler and the request logger on a bare app, so what is under test is
 * the middleware and not any route's own error handling.
 *
 * `env` is parsed once at import, and the handler reads NODE_ENV from it at
 * request time, so flipping the field is how production is simulated here; it
 * is put back after every test so no other file inherits it.
 */

function appThrowing(err: unknown) {
  const app = express();
  app.use(requestLogger);
  app.get("/boom", asyncHandler(async () => { throw err; }));
  app.use(errorHandler);
  return app;
}

const originalNodeEnv = env.NODE_ENV;
afterEach(() => {
  env.NODE_ENV = originalNodeEnv;
  vi.restoreAllMocks();
});

describe("errorHandler", () => {
  it("includes the stack outside production, to help whoever is debugging", async () => {
    env.NODE_ENV = "development";
    const res = await request(appThrowing(new Error("kaboom"))).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.stack).toContain("kaboom");
  });

  it("never sends a stack in production", async () => {
    env.NODE_ENV = "production";
    const res = await request(appThrowing(new Error("kaboom"))).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: "Internal Server Error" });
  });

  it("does not trust a status an error merely carries", async () => {
    // Shaped like a 404, but nothing vouched for it being the client's to see.
    const res = await request(appThrowing(Object.assign(new Error("secret path"), { status: 404 }))).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal Server Error");
  });

  it("keeps the status and message of an error that marks itself exposable", async () => {
    const err = Object.assign(new Error("Payload Too Large"), { status: 413, expose: true });
    const res = await request(appThrowing(err)).get("/boom");
    expect(res.status).toBe(413);
    expect(res.body).toMatchObject({ ok: false, error: "Payload Too Large" });
  });

  it("copes with a thrown non-Error", async () => {
    env.NODE_ENV = "development";
    const res = await request(appThrowing("just a string")).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: "Internal Server Error" });
  });

  it("logs a client mistake as a warning, not an error", async () => {
    const warn = vi.spyOn(logger, "warn");
    const error = vi.spyOn(logger, "error");
    const err = Object.assign(new Error("Bad Request"), { status: 400, expose: true });
    await request(appThrowing(err)).get("/boom");
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }), "request rejected");
    expect(error).not.toHaveBeenCalled();
  });
});

describe("requestLogger", () => {
  it("logs one structured line per request through pino, with no colour codes", async () => {
    const info = vi.spyOn(logger, "info");
    const app = express();
    app.use(requestLogger);
    app.get("/ok", (_req, res) => res.json({ ok: true }));

    await request(app).get("/ok?x=1");

    expect(info).toHaveBeenCalledTimes(1);
    const [fields, msg] = info.mock.calls[0] as unknown as [Record<string, unknown>, string];
    expect(msg).toBe("request");
    expect(fields).toMatchObject({ method: "GET", url: "/ok?x=1", status: 200 });
    expect(typeof fields.durationMs).toBe("number");
    expect(JSON.stringify(fields)).not.toMatch(/\x1b\[/);
  });

  it("drops the query string of token and admin routes, from the request line and the error line (#566)", async () => {
    const info = vi.spyOn(logger, "info");
    const warn = vi.spyOn(logger, "warn");
    const app = express();
    app.use(requestLogger);
    const ok = (_q: express.Request, res: express.Response) => res.json({ ok: true });
    app.get("/api/admin/audience/contacts", ok);
    app.get("/api/admin/campaigns", ok);
    app.get("/api/seo/render/unsubscribe", ok);
    app.get("/api/subscribe/manage", ok);
    app.get("/api/blog", ok);
    app.get("/api/admin/audience/boom", () => { throw Object.assign(new Error("nope"), { status: 400, expose: true }); });
    app.use(errorHandler);

    await request(app).get("/api/admin/audience/contacts?q=jane%40example.com&limit=5");
    await request(app).get("/api/admin/campaigns?to=jane@example.com");
    await request(app).get("/api/seo/render/unsubscribe?token=abc.def");
    await request(app).get("/api/subscribe/manage?token=abc.def");
    await request(app).get("/api/blog?lang=he");
    await request(app).get("/api/admin/audience/boom?q=jane@example.com");

    const urls = info.mock.calls.map((c) => (c[0] as { url: string }).url);
    expect(urls).toEqual([
      "/api/admin/audience/contacts",
      "/api/admin/campaigns",
      "/api/seo/render/unsubscribe",
      "/api/subscribe/manage",
      "/api/blog?lang=he",
    ]);
    // the 400 is logged twice (error handler + request line); neither holds the query
    for (const c of warn.mock.calls) expect(JSON.stringify(c[0])).not.toContain("example.com");
    expect(warn.mock.calls.length).toBeGreaterThan(0);
  });

  it("logs a 5xx at error level", async () => {
    const error = vi.spyOn(logger, "error");
    await request(appThrowing(new Error("x"))).get("/boom");
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 500, url: "/boom" }), "request");
  });
});
