import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "../logger.js";
import { bootLedger, ensureLedger, ledgerEntries, memoryLedgerStore, resetLedgerCache, useLedgerStore } from "./ledger.js";

/* A fake CouchDB over fetch: PUT /db is admin-only and answers 401 to a member even when the db exists. */
function fakeCouch(o: { exists: boolean; admin: boolean; marker?: boolean }) {
  const docs = new Map<string, Record<string, unknown>>();
  if (o.marker) docs.set("meta:ledger", { _id: "meta:ledger", _rev: "1-a", type: "meta" });
  const calls: string[] = [];
  const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
  let exists = o.exists;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = new URL(url).pathname.replace(/^\/[^/]+/, "") || "/";
    const method = init.method ?? "GET";
    calls.push(`${method} ${path}`);
    if (path === "/" && method === "PUT") {
      if (!o.admin) return json(401, { error: "unauthorized" });
      if (exists) return json(412, { error: "file_exists" });
      exists = true;
      return json(201, { ok: true });
    }
    if (!exists) return json(404, { error: "not_found" });
    if (path === "/") return json(200, { db_name: "x" });
    const id = decodeURIComponent(path.slice(1));
    if (id === "_all_docs") return json(200, { rows: [...docs.values()].map((doc) => ({ doc })) });
    if (method === "GET") return docs.has(id) ? json(200, docs.get(id)) : json(404);
    if (method === "PUT") {
      const doc = JSON.parse(String(init.body));
      docs.set(id, { ...doc, _id: id, _rev: "1-x" });
      return json(201, { ok: true, rev: "1-x" });
    }
    return json(405);
  }));
  return { docs, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  useLedgerStore();
  resetLedgerCache();
});

describe("ensureLedger against CouchDB's permission rules", () => {
  it("database exists and the API user is a plain member: no PUT /db, marker written, ledger readable", async () => {
    const c = fakeCouch({ exists: true, admin: false });
    await ensureLedger();
    expect(c.calls).not.toContain("PUT /");
    expect(c.docs.has("meta:ledger")).toBe(true);
    await expect(ledgerEntries()).resolves.toBeInstanceOf(Map);
  });

  it("database missing and the user is not an admin: a clear error, nothing written", async () => {
    const c = fakeCouch({ exists: false, admin: false });
    await expect(ensureLedger()).rejects.toThrow(/does not exist and this user may not create it.*docs\/newsletter\.md/);
    expect(c.docs.size).toBe(0);
  });

  it("database missing and the user is an admin: created, then marked", async () => {
    const c = fakeCouch({ exists: false, admin: true });
    await ensureLedger();
    expect(c.calls).toContain("PUT /");
    expect(c.docs.has("meta:ledger")).toBe(true);
  });

  it("marker already present: left untouched", async () => {
    const c = fakeCouch({ exists: true, admin: false, marker: true });
    await ensureLedger();
    expect(c.docs.get("meta:ledger")?._rev).toBe("1-a");
    expect(c.calls.filter((x) => x.startsWith("PUT"))).toEqual([]);
  });

  it("works with the memory store too", async () => {
    const m = memoryLedgerStore({ marker: false });
    useLedgerStore(m);
    await ensureLedger();
    expect(m.docs.has("meta:ledger")).toBe(true);
    const rev = m.docs.get("meta:ledger")?._rev;
    await ensureLedger();
    expect(m.docs.get("meta:ledger")?._rev).toBe(rev);
  });
});

describe("bootLedger (the server.ts boot path)", () => {
  it("logs 'suppression ledger ready' for an existing db and a member", async () => {
    fakeCouch({ exists: true, admin: false });
    const info = vi.spyOn(logger, "info").mockImplementation((() => {}) as never);
    await expect(bootLedger()).resolves.toBe(true);
    expect(info).toHaveBeenCalledWith("suppression ledger ready");
  });

  it("logs an error and does not throw when the db is missing and cannot be created", async () => {
    fakeCouch({ exists: false, admin: false });
    const err = vi.spyOn(logger, "error").mockImplementation((() => {}) as never);
    await expect(bootLedger()).resolves.toBe(false);
    expect(err).toHaveBeenCalled();
  });
});
