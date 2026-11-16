import type { Express } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { couch, CouchError } from "./db/couch.js";
import { env } from "./env.js";

/*
 * A GET is a read. The admin gate and the audit log both treat GET and HEAD as
 * safe: a read-scoped API token may call them and the audit log skips them, so
 * a GET handler that writes is a write nobody gated or recorded.
 *
 * This walks the real route table, calls every admin GET once against an empty
 * store, and fails on any attempt to write (a store put/append/delete, or any
 * non-GET request that leaves through fetch). A new mutating GET fails here
 * without anyone remembering to add it to a list.
 */

type Layer = {
  route?: { path: string; methods: Record<string, boolean> };
  name: string;
  regexp: RegExp & { fast_slash?: boolean };
  handle: { stack?: Layer[] };
};

/* Express 4 keeps a mount as a regexp; this reads the literal prefix back. */
function mountPrefix(layer: Layer): string {
  if (layer.regexp.fast_slash) return "";
  const src = layer.regexp.source
    .replace("^\\/", "/")
    .replace("\\/?(?=\\/|$)", "")
    .replace(/\\\//g, "/");
  return src.startsWith("/") ? src : `/${src}`;
}

function collectGets(stack: Layer[], prefix = ""): string[] {
  const out: string[] = [];
  for (const layer of stack) {
    if (layer.route) {
      if (layer.route.methods.get && typeof layer.route.path === "string") out.push(prefix + layer.route.path);
    } else if (layer.name === "router" && layer.handle.stack) {
      out.push(...collectGets(layer.handle.stack, prefix + mountPrefix(layer)));
    }
  }
  return out;
}

const routerStack = (app: Express) => (app as unknown as { _router: { stack: Layer[] } })._router.stack;
const fill = (p: string) => p.replace(/:[A-Za-z]+\??/g, "x");

const asAdmin = (req: request.Test) =>
  req.set("X-Admin-Proxy-Secret", env.ADMIN_PROXY_SECRET).set("X-Auth-Request-User", env.ADMIN_GITHUB_LOGIN);

let writes: string[];

beforeEach(() => {
  writes = [];
  vi.spyOn(couch, "get").mockRejectedValue(new CouchError(404, "404"));
  vi.spyOn(couch, "find").mockResolvedValue({ docs: [] });
  vi.spyOn(couch, "docs").mockResolvedValue([]);
  vi.spyOn(couch, "put").mockImplementation(async (id) => { writes.push(`put ${id}`); return { ok: true } as never; });
  vi.spyOn(couch, "append").mockImplementation(async (id) => { writes.push(`append ${id}`); return { ok: true } as never; });
  vi.spyOn(couch, "del").mockImplementation(async (id) => { writes.push(`del ${id}`); return { ok: true }; });
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
    const m = (init?.method ?? "GET").toUpperCase();
    if (m !== "GET" && m !== "HEAD") writes.push(`${m} ${String(url)}`);
    return new Response("{}", { status: 404 });
  }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("no GET handler in the admin API writes", () => {
  const app = createApp();
  const gets = collectGets(routerStack(app)).filter((p) => p.startsWith("/api/admin"));

  it("finds the admin route table", () => {
    expect(gets.length).toBeGreaterThan(20);
  });

  it.each(gets)("GET %s", async (path) => {
    await asAdmin(request(app).get(fill(path)));
    // Give a fire-and-forget background write (`void work()`) a turn to land.
    await new Promise((r) => setTimeout(r, 20));
    expect(writes).toEqual([]);
  });
});
