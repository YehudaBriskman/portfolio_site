import { randomBytes } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import type { Admin } from "../middlewares/requireAdmin.js";

/*
 * How a remote MCP tool call reaches this API.
 *
 * The tools run against this very process through a private loopback
 * listener, so every write gets the admin UI's validation, lock and audit log.
 *
 * The caller's identity crosses that hop as a TICKET, never as a credential:
 * random, single-use, short-lived, redeemable only on a loopback socket. One
 * leaked in a log is useless a moment later; one sent from outside is a 401.
 *
 * The client's own address rides along in X-Forwarded-For, written so the
 * app's `trust proxy` count (2) lands on it: the per-address limiters then
 * meter the MCP caller, not one shared 127.0.0.1 bucket for everybody.
 */

const TICKET_TTL_MS = 30_000;
const tickets = new Map<string, { admin: Admin; expires: number }>();

export function issueTicket(admin: Admin): string {
  const id = randomBytes(32).toString("base64url");
  tickets.set(id, { admin, expires: Date.now() + TICKET_TTL_MS });
  setTimeout(() => tickets.delete(id), TICKET_TTL_MS).unref();
  return id;
}

/** The identity a ticket names, once. Anything else is null. */
export function redeemTicket(id: string): Admin | null {
  const t = tickets.get(id);
  tickets.delete(id);
  if (!t || t.expires < Date.now()) return null;
  return t.admin;
}

/* Captured at load: tests stub the global fetch for GitHub and CouchDB, and
   this hop must stay a real request to the private listener. */
const nodeFetch: typeof fetch = globalThis.fetch.bind(globalThis);

const listeners = new WeakMap<Express, Promise<number>>();

function internalPort(app: Express): Promise<number> {
  let port = listeners.get(app);
  if (!port) {
    port = new Promise<number>((resolve, reject) => {
      const server = http.createServer(app);
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port));
      // Never what keeps the process (or a test run) alive.
      server.unref();
    });
    listeners.set(app, port);
  }
  return port;
}

/** The base URL the tools are given; the fetch below swaps in the listener. */
export const INTERNAL_BASE = "http://mcp-internal";

/**
 * A fetch for the shared tools: same path and body, sent to the private
 * listener, carrying a fresh ticket for `admin` (when there is one) instead
 * of whatever Authorization the tool layer put on it.
 */
export function internalFetch(app: Express, admin: Admin | null, clientIp: string) {
  return async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const port = await internalPort(app);
    const headers = new Headers(init.headers);
    headers.delete("authorization");
    if (admin) headers.set("x-mcp-ticket", issueTicket(admin));
    headers.set("x-forwarded-for", `${clientIp || "0.0.0.0"}, 127.0.0.1`);
    return nodeFetch(`http://127.0.0.1:${port}${url.pathname}${url.search}`, { ...init, headers });
  };
}
