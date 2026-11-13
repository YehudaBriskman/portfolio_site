import express, { Router } from "express";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { couch, CouchError } from "../db/couch.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { emitComplaint } from "./complaintHook.js";
import { ledgerPut } from "./ledger.js";
import { mapResendEvent, type SuppressReason } from "./providerEvents.js";
import { getContact, updateContact } from "./store.js";
import { verifySvix } from "./svix.js";

/*
 * POST /api/webhooks/resend: bounce and complaint events from the mail provider.
 * Mounted in app.ts BEFORE the JSON parser, because the signature covers the
 * exact bytes sent. Unset secret: the route does not exist (404). Every failure
 * answers the same bare 400; nothing about the request is logged or returned.
 */

/* Soft failures before an address is suppressed (the same rule as campaigns/sender.ts). */
const SOFT_LIMIT = 3;
const EVENT = "webhookevent:";

const router = Router();

router.use((_req, res, next) => (env.RESEND_WEBHOOK_SECRET ? next() : res.status(404).json({ ok: false, error: "Not Found" })));
router.post(
  "/",
  express.raw({ type: () => true, limit: "64kb" }),
  asyncHandler(async (req, res) => {
    const secret = env.RESEND_WEBHOOK_SECRET;
    const raw: unknown = req.body;
    const id = req.header("svix-id");
    const fail = () => res.status(400).json({ ok: false });
    if (!secret || !Buffer.isBuffer(raw)) return fail();
    if (!verifySvix(secret, raw, { id, timestamp: req.header("svix-timestamp"), signature: req.header("svix-signature") })) return fail();
    if (!id || !/^[\w.-]{1,128}$/.test(id)) return fail();
    let event: unknown;
    try {
      event = JSON.parse(raw.toString("utf8"));
    } catch {
      return fail();
    }
    const verdict = mapResendEvent(event);
    if (verdict.action === "ignore") return res.json({ ok: true });

    // Idempotent by event id: the marker is claimed first and released if processing fails, so a retry runs again.
    const marker = `${EVENT}${id}`;
    try {
      await couch.append(marker, { type: "webhookevent", at: new Date().toISOString() });
    } catch (e) {
      if (e instanceof CouchError && e.status === 409) return res.json({ ok: true });
      throw e;
    }
    try {
      for (const hash of verdict.hashes) {
        if (verdict.action === "suppress") await suppress(hash, verdict.reason);
        else await noteSoft(hash);
      }
    } catch (err) {
      try {
        const m = await couch.get<{ _rev: string }>(marker);
        await couch.del(marker, m._rev);
      } catch {
        /* the marker stays; a retry is then answered as a duplicate */
      }
      logger.warn({ err: err instanceof Error ? err.message : String(err) }, "provider event not applied");
      return res.status(500).json({ ok: false });
    }
    res.json({ ok: true });
  }),
);

/** Ledger first, contact second: a crash between them leaves the person blocked, not mailed. Only people we hold are touched. */
async function suppress(hash: string, reason: SuppressReason): Promise<void> {
  const c = await getContact(hash);
  if (!c || (c.status !== "active" && c.status !== "pending")) return;
  await ledgerPut(hash, "suppressed");
  await updateContact(hash, (x) => {
    if (x.status !== "active" && x.status !== "pending") return false;
    x.status = "suppressed";
    x.suppressedReason = reason;
    delete x.softBounces;
  });
  logger.info({ hash, reason }, "contact suppressed by provider event");
  if (reason === "complaint" || reason === "hard-bounce") emitComplaint({ hash, at: new Date().toISOString(), reason });
}

async function noteSoft(hash: string): Promise<void> {
  let reached = false;
  await updateContact(hash, (c) => {
    if (c.status !== "active") return false;
    c.softBounces = (c.softBounces ?? 0) + 1;
    reached = c.softBounces >= SOFT_LIMIT;
  });
  if (reached) await suppress(hash, "soft-bounces");
}

export default router;
