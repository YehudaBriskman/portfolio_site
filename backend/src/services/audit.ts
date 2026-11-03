import { createHash, randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import { couch } from "../db/couch.js";
import { logger } from "../logger.js";

/*
 * The admin audit log (#252): one document per admin write, appended and
 * never changed.
 *
 * Append-only by construction: each entry is a fresh id written without a
 * `_rev`, so CouchDB can only create it, and no route updates or deletes one.
 * Ids are `audit:<ISO time>:<random>`, so `_id` order is time order and the
 * reader can page on the primary index without a query index of its own.
 *
 * Every non-read request through /api/admin is recorded, refused ones
 * included (a 400, 403 or 409 is worth seeing too). A route that changed a
 * document says what it changed by setting `res.locals.audit`; the hashes are
 * SHA-256 over a key-sorted JSON of the document without `_rev`, so two
 * entries can be compared without the log holding the content itself.
 */

export type AuditChange = { target: string; before: unknown; after: unknown };

export type AuditEntry = {
  _id: string;
  type: "audit";
  at: string;
  actor: { login: string; via: "proxy" | "token"; tokenId: string | null };
  method: string;
  path: string;
  status: number;
  target: string | null;
  beforeHash: string | null;
  afterHash: string | null;
};

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      if (k === "_rev") continue;
      out[k] = canonical((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

export function docHash(doc: unknown): string | null {
  if (doc === null || doc === undefined) return null;
  return createHash("sha256").update(JSON.stringify(canonical(doc))).digest("hex");
}

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

export function auditEntry(input: {
  at: Date;
  actor: AuditEntry["actor"];
  method: string;
  path: string;
  status: number;
  change?: AuditChange;
}): AuditEntry {
  const at = input.at.toISOString();
  return {
    _id: `audit:${at}:${randomBytes(4).toString("hex")}`,
    type: "audit",
    at,
    actor: input.actor,
    method: input.method,
    path: input.path,
    status: input.status,
    target: input.change?.target ?? null,
    beforeHash: docHash(input.change?.before),
    afterHash: docHash(input.change?.after),
  };
}

/* Mounted after the gate, so `req.admin` is always set when it runs. */
export const auditWrites: RequestHandler = (req, res, next) => {
  if (SAFE.has(req.method)) return next();
  const path = req.originalUrl.split("?")[0];
  res.on("finish", () => {
    const a = req.admin;
    const entry = auditEntry({
      at: new Date(),
      actor: { login: a?.login ?? "unknown", via: a?.via ?? "proxy", tokenId: a?.tokenId ?? null },
      method: req.method,
      path,
      status: res.statusCode,
      change: res.locals.audit as AuditChange | undefined,
    });
    couch.append(entry._id, entry).catch((err: unknown) => {
      // The write already happened; losing its record is loud, not silent.
      logger.error({ err: err instanceof Error ? err.message : String(err), entry }, "audit entry could not be written");
    });
  });
  next();
};

/* Newest first. `before` is an entry id from a previous page (exclusive). */
export async function readAudit(opts: { limit: number; before?: string }) {
  const upper = opts.before ?? "audit:\uffff";
  const { docs } = await couch.find<AuditEntry>({
    selector: { _id: { $gt: "audit:", $lt: upper } },
    sort: [{ _id: "desc" }],
    limit: opts.limit,
  });
  return docs.map(({ _id, ...rest }) => ({ id: _id, ...rest }));
}
