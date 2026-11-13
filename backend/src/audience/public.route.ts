import express, { Router, type Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { loadSettings } from "../announce/store.js";
import { sendConfirmMail } from "./mail.js";
import { CURRENT_CONSENT_TEXT_ID, getConsentText } from "./consent-texts.js";
import {
  ManagePut,
  SITE_FORM_VERSION,
  SubscribeBody,
  SYSTEM_GROUP,
  TokenBody,
  TokenQuery,
  type Consent,
  type Contact,
} from "./schemas.js";
import { ledgerClear, ledgerGet, ledgerPutQuietly } from "./ledger.js";
import { confirmConsent, contactId, createContact, getContact, hashEmail, isPendingExpired, purgeExpiredPending, recordConsent, updateContact } from "./store.js";
import { verifyToken, type TokenKind } from "./tokens.js";

/*
 * Public, unauthenticated, rate limited (app.ts). The one rule: nothing here
 * says whether an address is known. Signup answers 202 {ok:true} for a new
 * address, a known one, a suppressed one and a bot alike; a bad link is one
 * message whatever was wrong with it.
 */
const router = Router();
router.use(express.urlencoded({ extended: false, limit: "4kb" }));

const ACCEPTED = { ok: true } as const;
/** Pending contacts re-sent to within this window are not mailed again (mail-bomb guard). */
const RESEND_AFTER_MS = 2 * 60_000;
const badLink = (res: Response) => res.status(400).json({ ok: false, error: "This link is invalid or has expired." });

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = SubscribeBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: "Please check the form and try again." });
    const b = parsed.data;
    // A bot gets the same answer a person does, and nothing is stored.
    if (b.website) return res.status(202).json(ACCEPTED);

    // The server decides which wording was shown: a form version the client names must be a registered one,
    // and the hash always comes from the registry, never from the request.
    const text = getConsentText(b.formVersion ?? CURRENT_CONSENT_TEXT_ID);
    if (!text) return res.status(400).json({ ok: false, error: "Please check the form and try again." });

    const hash = hashEmail(b.email);
    void purgeExpiredPending();
    const now = new Date().toISOString();
    const consent: Consent = { textId: text.id, textHash: text.sha256, lang: b.lang, at: now, source: "site" };
    const ttl = (await loadSettings()).sender.pendingTtlDays;
    // A suppressed address stays suppressed even when its contact document is gone (a restore, a deletion): same silent answer.
    if ((await ledgerGet(hash).catch(() => null))?.kind === "suppressed") return res.status(202).json(ACCEPTED);
    let contact = await getContact(hash);
    let send = false;

    if (contact && isPendingExpired(contact, ttl)) {
      // Expired and not yet swept: treat as new.
      await updateContact(hash, (c) => {
        // Before the fields change: an old contact's earlier consent is read with its old language.
        recordConsent(c, consent);
        Object.assign(c, { status: "pending", name: b.name, lang: b.lang, topics: b.topics ?? c.topics });
      });
      contact = await getContact(hash);
      send = true;
    } else if (!contact) {
      const fresh: Contact = {
        _id: contactId(hash),
        type: "contact",
        email: b.email,
        ...(b.name ? { name: b.name } : {}),
        lang: b.lang,
        groups: [SYSTEM_GROUP],
        status: "pending",
        source: "site",
        consentAt: now,
        consentNote: consent.textId ?? SITE_FORM_VERSION,
        consent,
        consentHistory: [consent],
        topics: b.topics ?? { blog: true, releases: true },
        createdAt: now,
        updatedAt: now,
      };
      send = await createContact(fresh);
      contact = fresh;
    } else if (contact.status === "unsubscribed") {
      // The person themselves is asking again: back to pending, and it still needs the confirm click.
      await updateContact(hash, (c) => {
        recordConsent(c, consent);
        // A minimised contact has no address or name left: the person is giving them again.
        Object.assign(c, { status: "pending", email: b.email, lang: b.lang, topics: b.topics ?? c.topics, ...(b.name ? { name: b.name } : {}) });
        if (!c.groups.includes(SYSTEM_GROUP)) c.groups.push(SYSTEM_GROUP);
        delete c.unsubscribedAt;
        delete c.minimisedAt;
      });
      contact = await getContact(hash);
      send = true;
    } else if (contact.status === "pending") {
      send = Date.now() - Date.parse(contact.updatedAt) > RESEND_AFTER_MS;
      if (send) await updateContact(hash, () => true);
    }
    // active and suppressed: nothing happens, and nothing shows.

    if (send && contact) void sendConfirmMail(contact, hash);
    return res.status(202).json(ACCEPTED);
  }),
);

async function tokenContact(token: string, kind: TokenKind) {
  const p = await verifyToken(token, kind);
  if (!p) return null;
  const c = await getContact(p.h);
  return c ? { hash: p.h, contact: c } : null;
}

/* POST, never GET: mail scanners and link previewers open every URL in a mail, so
   a GET that confirmed would let a robot subscribe someone. The page the mail
   links to asks for a click and only the click calls this. */
router.post(
  "/confirm",
  asyncHandler(async (req, res) => {
    const q = TokenBody.safeParse(req.body);
    if (!q.success) return badLink(res);
    const found = await tokenContact(q.data.token, "confirm");
    if (!found) return badLink(res);
    const { hash, contact } = found;
    if (contact.status === "active") return res.json({ ok: true, lang: contact.lang });
    if (contact.status !== "pending") return badLink(res);
    const ttl = (await loadSettings()).sender.pendingTtlDays;
    if (isPendingExpired(contact, ttl)) {
      void purgeExpiredPending(Date.now(), true);
      return badLink(res);
    }
    // The ledger is read, and cleared, BEFORE the contact turns active: a crash between leaves a pending contact, never a mailable one the ledger still blocks.
    const held = await ledgerGet(hash);
    if (held?.kind === "suppressed") return badLink(res);
    if (held) await ledgerClear(hash);
    const now = new Date().toISOString();
    const updated = await updateContact(hash, (c) => {
      if (c.status !== "pending") return false;
      c.status = "active";
      c.confirmedAt = now;
      confirmConsent(c, now);
    });
    return updated?.status === "active" ? res.json({ ok: true, lang: updated.lang }) : badLink(res);
  }),
);

router.post(
  "/unsubscribe",
  asyncHandler(async (req, res) => {
    let token: unknown;
    if (req.is("application/x-www-form-urlencoded")) {
      // RFC 8058 one-click: the mail client POSTs `List-Unsubscribe=One-Click`; the token is in the URL.
      const body = req.body as Record<string, unknown>;
      if (body["List-Unsubscribe"] !== "One-Click") return badLink(res);
      token = req.query.token;
    } else {
      const b = TokenBody.safeParse(req.body);
      token = b.success ? b.data.token : undefined;
    }
    if (typeof token !== "string") return badLink(res);
    const found = await tokenContact(token, "unsub");
    if (!found) return badLink(res);
    const { hash, contact } = found;
    if (contact.status !== "unsubscribed" && contact.status !== "suppressed") {
      // Ledger first. A mail client's one-click POST is not retried, so an outage here must not undo the person's choice: the guard backfills it.
      await ledgerPutQuietly(hash, "unsubscribed");
      await updateContact(hash, (c) => {
        if (c.status === "suppressed" || c.status === "unsubscribed") return false;
        c.status = "unsubscribed";
        c.unsubscribedAt = new Date().toISOString();
      });
    }
    return res.json({ ok: true, lang: contact.lang });
  }),
);

const mask = (email: string) => {
  const [local = "", domain = ""] = email.split("@");
  const dot = domain.lastIndexOf(".");
  return `${local.slice(0, 1)}***@${domain.slice(0, 1)}***${dot > 0 ? domain.slice(dot) : ""}`;
};

router.get(
  "/manage",
  asyncHandler(async (req, res) => {
    const q = TokenQuery.safeParse(req.query);
    const found = q.success ? await tokenContact(q.data.token, "manage") : null;
    if (!found) return badLink(res);
    const c = found.contact;
    return res.json({ ok: true, email: mask(c.email), lang: c.lang, topics: c.topics, status: c.status });
  }),
);

router.put(
  "/manage",
  asyncHandler(async (req, res) => {
    const b = ManagePut.safeParse(req.body);
    const found = b.success ? await tokenContact(b.data.token, "manage") : null;
    if (!b.success || !found) return badLink(res);
    if (found.contact.status === "suppressed") return badLink(res);
    const updated = await updateContact(found.hash, (c) => {
      if (b.data.lang) c.lang = b.data.lang;
      if (b.data.topics) c.topics = b.data.topics;
    });
    if (!updated) return badLink(res);
    return res.json({ ok: true, email: mask(updated.email), lang: updated.lang, topics: updated.topics, status: updated.status });
  }),
);

export default router;
