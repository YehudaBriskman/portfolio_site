import { randomBytes } from "node:crypto";
import { Router, type Response } from "express";
import { z } from "zod";
import { couch, CouchError } from "../db/couch.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { logger } from "../logger.js";
import { parseCsv, toCsv } from "./csv.js";
import {
  ContactCreate,
  ContactPatch,
  ContactsQuery,
  Email,
  GroupBody,
  Hash,
  ImportBody,
  Slug,
  SuppressBody,
  SuppressBulkBody,
  SUPPRESS_BULK_MAX,
  SYSTEM_GROUP,
  type Consent,
  type Contact,
  type Group,
  type Lang,
} from "./schemas.js";
import {
  backfillConsent,
  consentHistoryOf,
  consentOf,
  contactId,
  createContact,
  deleteContact,
  ensureSystemGroup,
  getContact,
  getGroup,
  groupId,
  hashEmail,
  listGroups,
  purgeExpiredPending,
  scanContacts,
  updateContact,
  deleteSendDocs,
  listSendDocs,
  MINIMISE_AFTER_DAYS,
} from "./store.js";
import { ledgerGuard } from "../campaigns/guard.js";
import { getSweepReport } from "./sweep.js";
import { loadSettings } from "../announce/store.js";
import { acknowledgeReport, ledgerClear, ledgerEntries, ledgerGet, ledgerPut, ledgerReport, type LedgerKind } from "./ledger.js";

/*
 * Under /api/admin/audience: behind requireAdmin and auditWrites (admin.route.ts).
 * res.locals.audit carries documents; the audit log stores only their hashes,
 * and the targets here are ids made of hashes, never addresses.
 */
const router = Router();
const bad = (res: Response, error: string, status = 400) => res.status(status).json({ ok: false, error });
const invalid = (res: Response) => bad(res, "Check the fields and try again.");

/* What an admin sees of a contact. `hash` is the id every other route takes. */
const view = (c: Contact) => ({
  hash: c._id.slice("contact:".length),
  email: c.email,
  name: c.name ?? null,
  lang: c.lang,
  groups: c.groups,
  status: c.status,
  source: c.source,
  consentAt: c.consentAt,
  consentNote: c.consentNote,
  consent: consentOf(c),
  consentHistory: consentHistoryOf(c),
  topics: c.topics,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
  confirmedAt: c.confirmedAt ?? null,
  unsubscribedAt: c.unsubscribedAt ?? null,
});

/* One history entry in one export cell: when, which wording (or the batch note), where it came from, when confirmed. */
const historyCell = (e: Consent) => [e.at, e.textId ?? e.note ?? "", e.source, e.confirmedAt ?? ""].join("|");

const hashParam = (raw: unknown) => {
  const p = Hash.safeParse(raw);
  return p.success ? p.data : null;
};
const groupView = (g: Group) => ({ slug: g._id.slice("audience:".length), name: g.name, kind: g.kind, createdAt: g.createdAt });

/* ---------------------------------------------------------------- groups -- */

router.get(
  "/groups",
  asyncHandler(async (_req, res) => {
    await ensureSystemGroup();
    void backfillConsent();
    void purgeExpiredPending();
    const counts = new Map<string, { total: number; active: number }>();
    for await (const c of scanContacts()) {
      for (const g of c.groups) {
        const n = counts.get(g) ?? { total: 0, active: 0 };
        n.total++;
        if (c.status === "active") n.active++;
        counts.set(g, n);
      }
    }
    const groups = (await listGroups()).map((g) => {
      const v = groupView(g);
      return { ...v, ...(counts.get(v.slug) ?? { total: 0, active: 0 }) };
    });
    res.json({ ok: true, groups });
  }),
);

function slugify(name: string): string {
  const s = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
  return s || `g-${randomBytes(3).toString("hex")}`;
}

router.post(
  "/groups",
  asyncHandler(async (req, res) => {
    const b = GroupBody.safeParse(req.body);
    if (!b.success) return invalid(res);
    const base = slugify(b.data.name);
    for (let i = 0; i < 5; i++) {
      const slug = i === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
      const g: Group = { _id: groupId(slug), type: "audience", name: b.data.name, kind: "manual", createdAt: new Date().toISOString() };
      try {
        await couch.append(g._id, g as unknown as Record<string, unknown>);
        res.locals.audit = { target: g._id, before: null, after: g };
        return res.status(201).json({ ok: true, group: groupView(g) });
      } catch (e) {
        if (!(e instanceof CouchError && e.status === 409)) throw e;
      }
    }
    return bad(res, "Could not pick a free group id.", 409);
  }),
);

router.patch(
  "/groups/:slug",
  asyncHandler(async (req, res) => {
    const slug = Slug.safeParse(req.params.slug);
    const b = GroupBody.safeParse(req.body);
    if (!slug.success || !b.success) return invalid(res);
    const before = await getGroup(slug.data);
    if (!before) return bad(res, "No such group.", 404);
    const after = { ...before, name: b.data.name };
    const r = await couch.put<{ rev?: string }>(before._id, after);
    res.locals.audit = { target: before._id, before, after };
    res.json({ ok: true, group: groupView({ ...after, _rev: r.rev }) });
  }),
);

router.delete(
  "/groups/:slug",
  asyncHandler(async (req, res) => {
    const slug = Slug.safeParse(req.params.slug);
    if (!slug.success) return invalid(res);
    const g = await getGroup(slug.data);
    if (!g) return bad(res, "No such group.", 404);
    if (g.kind === "system" || slug.data === SYSTEM_GROUP) return bad(res, "A system group cannot be deleted.", 409);
    // Contacts keep existing; they just stop being in the group.
    for await (const c of scanContacts()) {
      if (c.groups.includes(slug.data)) await updateContact(c._id.slice("contact:".length), (x) => { x.groups = x.groups.filter((s) => s !== slug.data); });
    }
    if (g._rev) await couch.del(g._id, g._rev);
    res.locals.audit = { target: g._id, before: g, after: null };
    res.json({ ok: true });
  }),
);

async function unknownGroups(slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  const known = new Set((await listGroups()).map((g) => g._id.slice("audience:".length)));
  known.add(SYSTEM_GROUP);
  return slugs.filter((s) => !known.has(s));
}

/* -------------------------------------------------------------- contacts -- */

router.get(
  "/contacts",
  asyncHandler(async (req, res) => {
    const q = ContactsQuery.safeParse(req.query);
    if (!q.success) return invalid(res);
    void purgeExpiredPending();
    const needle = q.data.q?.toLowerCase();
    const out: ReturnType<typeof view>[] = [];
    let next: string | null = null;
    for await (const c of scanContacts(q.data.cursor)) {
      if (out.length === q.data.limit) { next = out[out.length - 1] ? `contact:${out[out.length - 1].hash}` : null; break; }
      if (q.data.group && !c.groups.includes(q.data.group)) continue;
      if (q.data.status && c.status !== q.data.status) continue;
      if (needle && !c.email.includes(needle) && !(c.name ?? "").toLowerCase().includes(needle)) continue;
      out.push(view(c));
    }
    res.json({ ok: true, contacts: out, nextCursor: next });
  }),
);

router.post(
  "/contacts",
  asyncHandler(async (req, res) => {
    const b = ContactCreate.safeParse(req.body);
    if (!b.success) return invalid(res);
    const hash = hashEmail(b.data.email);
    const existing = await getContact(hash);
    if (existing?.status === "suppressed") return bad(res, "This address is on the suppression list.", 409);
    if (existing) return bad(res, "This address is already in the audience.", 409);
    // A person who unsubscribed or was suppressed is not added back by hand; an erased one may be, and the old line goes.
    const held = await ledgerGet(hash);
    if (held && held.kind !== "erased") return bad(res, "This address asked not to be mailed.", 409);
    const missing = await unknownGroups(b.data.groups);
    if (missing.length) return bad(res, "Unknown group.");
    const now = new Date().toISOString();
    const manualConsent: Consent = { textId: null, textHash: null, lang: b.data.lang, at: now, confirmedAt: now, source: "manual", note: b.data.consentNote };
    const c: Contact = {
      _id: contactId(hash),
      type: "contact",
      email: b.data.email,
      ...(b.data.name ? { name: b.data.name } : {}),
      lang: b.data.lang,
      groups: b.data.groups,
      status: "active",
      source: "manual",
      consentAt: now,
      consentNote: b.data.consentNote,
      consent: manualConsent,
      consentHistory: [manualConsent],
      topics: { blog: true, releases: true },
      createdAt: now,
      updatedAt: now,
      confirmedAt: now,
    };
    if (held) await ledgerClear(hash);
    if (!(await createContact(c))) return bad(res, "This address is already in the audience.", 409);
    res.locals.audit = { target: c._id, before: null, after: c };
    res.status(201).json({ ok: true, contact: view(c) });
  }),
);

router.patch(
  "/contacts/:hash",
  asyncHandler(async (req, res) => {
    const hash = hashParam(req.params.hash);
    const b = ContactPatch.safeParse(req.body);
    if (!hash || !b.success) return invalid(res);
    const before = await getContact(hash);
    if (!before) return bad(res, "No such contact.", 404);
    if (before.status === "suppressed") return bad(res, "This address is on the suppression list.", 409);
    if (before.minimisedAt) return bad(res, "This person unsubscribed and their details were removed; there is nothing left to edit.", 409);
    if (b.data.groups && (await unknownGroups(b.data.groups)).length) return bad(res, "Unknown group.");
    const prior = structuredClone(before);
    if (b.data.status === "unsubscribed" && before.status !== "unsubscribed") await ledgerPut(hash, "unsubscribed");
    const after = await updateContact(hash, (c) => {
      if (b.data.name !== undefined) { if (b.data.name) c.name = b.data.name; else delete c.name; }
      if (b.data.lang) c.lang = b.data.lang;
      if (b.data.groups) c.groups = b.data.groups;
      if (b.data.topics) c.topics = b.data.topics;
      if (b.data.status === "unsubscribed" && c.status !== "unsubscribed") {
        c.status = "unsubscribed";
        c.unsubscribedAt = new Date().toISOString();
      }
    });
    if (!after) return bad(res, "No such contact.", 404);
    res.locals.audit = { target: after._id, before: prior, after };
    res.json({ ok: true, contact: view(after) });
  }),
);

/*
 * Everything held about one address, as one JSON file (a data-access request).
 * POST with the address in the body, never in the URL, so it reaches no access
 * log; the audit entry carries the contact id (a hash) only. The file contains
 * the address, because the person it is about asked for their own data.
 */
router.post(
  "/contacts/data-export",
  asyncHandler(async (req, res) => {
    const b = z.object({ email: Email }).strict().safeParse(req.body);
    if (!b.success) return invalid(res);
    const hash = hashEmail(b.data.email);
    const [contact, ledgerLine, sends] = await Promise.all([getContact(hash), ledgerGet(hash).catch(() => null), listSendDocs(hash)]);
    res.locals.audit = { target: contactId(hash), before: null, after: { exported: true } };
    if (!contact && !ledgerLine && sends.length === 0) return bad(res, "Nothing is held about this address.", 404);
    const strip = ({ _id: _i, _rev: _r, ...rest }: Record<string, unknown>) => rest;
    const file = {
      exportedAt: new Date().toISOString(),
      fingerprint: hash,
      note: `Unsubscribed contacts lose their address, name and language ${MINIMISE_AFTER_DAYS} days after unsubscribing; only the fingerprint, status, times and consent wording id remain.`,
      contact: contact ? { ...strip(contact as unknown as Record<string, unknown>), consentHistory: consentHistoryOf(contact) } : null,
      neverMailLine: ledgerLine ? { kind: ledgerLine.kind, at: ledgerLine.at, ...(ledgerLine.expiresAt ? { expiresAt: ledgerLine.expiresAt } : {}) } : null,
      campaignMails: sends.map((s) => {
        const { campaignId, status, at, kind, code, retryAt } = s as Record<string, unknown>;
        return { campaign: campaignId, status, at, kind, code, retryAt };
      }),
    };
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="data-${hash.slice(0, 8)}.json"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(JSON.stringify(file, null, 2));
  }),
);

router.delete(
  "/contacts/:hash",
  asyncHandler(async (req, res) => {
    const hash = hashParam(req.params.hash);
    if (!hash) return invalid(res);
    const before = await getContact(hash);
    // Idempotent: a second erase (a retry after a dropped reply) finds nothing left and says so, still ok.
    if (!before) {
      await deleteSendDocs(hash);
      res.locals.audit = { target: contactId(hash), before: null, after: null };
      return void res.json({ ok: true, already: true });
    }
    /*
     * Ledger first, so a restore of the content database cannot bring this person back into a mailing. The line
     * never gets weaker: someone suppressed (a bounce, a complaint) or who unsubscribed stays blocked by their hash
     * alone, while the contact, its consent record and its send documents go. Only a person who never asked
     * not to be mailed gets the expiring `erased` line.
     */
    const held = await ledgerGet(hash);
    const keep: LedgerKind | null = before.status === "suppressed" ? "suppressed" : before.status === "unsubscribed" ? "unsubscribed" : null;
    const kind: LedgerKind = held && held.kind !== "erased" ? (keep === "suppressed" ? "suppressed" : held.kind) : (keep ?? "erased");
    if (!held || held.kind !== kind) await ledgerPut(hash, kind);
    await deleteContact(hash);
    await deleteSendDocs(hash);
    res.locals.audit = { target: before._id, before, after: null };
    res.json({ ok: true });
  }),
);

/* ---------------------------------------------------------------- import -- */

const IMPORT_MAX_ROWS = 5000;

router.post(
  "/contacts/import",
  asyncHandler(async (req, res) => {
    const b = ImportBody.safeParse(req.body);
    if (!b.success) return bad(res, "Confirm that these people agreed to be mailed, and add a note saying how.");
    if (b.data.group && (await unknownGroups([b.data.group])).length) return bad(res, "Unknown group.");
    const rows = parseCsv(b.data.csv);
    const first = rows[0]?.map((c) => c.trim().toLowerCase()) ?? [];
    const hasHeader = first.includes("email");
    const col = (name: string, fallback: number) => (hasHeader ? first.indexOf(name) : fallback);
    const [ie, inm, il] = [col("email", 0), col("name", 1), col("lang", 2)];
    const body = hasHeader ? rows.slice(1) : rows;
    if (body.length > IMPORT_MAX_ROWS) return bad(res, `At most ${IMPORT_MAX_ROWS} rows per import.`, 413);

    let added = 0;
    let skipped = 0;
    const invalidRows: { row: number; reason: string }[] = [];
    const now = new Date().toISOString();
    const importConsent: Consent = { textId: null, textHash: null, lang: "en", at: now, confirmedAt: now, source: "import", note: b.data.consentNote };
    const groups = [b.data.group ?? SYSTEM_GROUP].filter((g, i, a) => a.indexOf(g) === i);
    // Anyone on the ledger is skipped, erased people included: a list is exactly how a restored or stale file would revive them.
    const held = await ledgerEntries();
    for (let i = 0; i < body.length; i++) {
      const rowNo = i + (hasHeader ? 2 : 1);
      const cells = body[i];
      const email = Email.safeParse(cells[ie] ?? "");
      if (!email.success) { invalidRows.push({ row: rowNo, reason: "Not a valid email address" }); continue; }
      const name = (inm >= 0 ? cells[inm] : "")?.trim().slice(0, 80).replace(/[\u0000-\u001f\u007f]/g, "");
      const lang: Lang = (il >= 0 ? cells[il] : "")?.trim().toLowerCase() === "he" ? "he" : "en";
      const hash = hashEmail(email.data);
      if (held.has(hash)) { skipped++; continue; }
      const rowConsent: Consent = { ...importConsent, lang };
      // Suppressed and already-known addresses are never touched by an import.
      const c: Contact = {
        _id: contactId(hash),
        type: "contact",
        email: email.data,
        ...(name ? { name } : {}),
        lang,
        groups,
        status: "active",
        source: "import",
        consentAt: now,
        consentNote: b.data.consentNote,
        consent: rowConsent,
        consentHistory: [rowConsent],
        topics: { blog: true, releases: true },
        createdAt: now,
        updatedAt: now,
        confirmedAt: now,
      };
      if (await createContact(c)) added++;
      else skipped++;
    }
    res.locals.audit = { target: "contact:import", before: null, after: { added, skipped, invalid: invalidRows.length, group: groups[0], consentNote: b.data.consentNote } };
    res.json({ ok: true, added, skipped, invalid: invalidRows });
  }),
);

router.get(
  "/contacts/export.csv",
  asyncHandler(async (_req, res) => {
    const rows: string[][] = [["email", "name", "lang", "groups", "status", "source", "consentAt", "consentNote", "createdAt", "consentTextId", "consentTextHash", "consentLang", "consentConfirmedAt", "consentHistory"]];
    for await (const c of scanContacts()) {
      const k = consentOf(c);
      rows.push([c.email, c.name ?? "", c.lang ?? "", c.groups.join(";"), c.status, c.source, c.consentAt, c.consentNote, c.createdAt, k.textId ?? "", k.textHash ?? "", k.lang ?? "", k.confirmedAt ?? "", consentHistoryOf(c).map(historyCell).join(";")]);
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="audience.csv"');
    res.setHeader("Cache-Control", "no-store");
    res.send("﻿" + toCsv(rows));
  }),
);

/* ----------------------------------------------------------- suppression -- */

router.get(
  "/suppression",
  asyncHandler(async (_req, res) => {
    const list: { hash: string; email: string; since: string }[] = [];
    for await (const c of scanContacts()) {
      if (c.status === "suppressed") list.push({ hash: c._id.slice("contact:".length), email: c.email, since: c.unsubscribedAt ?? c.updatedAt });
    }
    res.json({ ok: true, suppressed: list });
  }),
);

/** Suppresses one address: a known contact is flipped, an unknown one is created as suppressed so a later signup or import cannot add it. */
async function suppressAddress(email: string): Promise<{ hash: string; before: Contact | null; after: Contact | null }> {
  const hash = hashEmail(email);
  const now = new Date().toISOString();
  const prior = await getContact(hash);
  const before = prior ? structuredClone(prior) : null;
  await ledgerPut(hash, "suppressed");
  let after: Contact | null;
  if (prior) {
    after = await updateContact(hash, (c) => {
      c.status = "suppressed";
      c.unsubscribedAt = now;
    });
  } else {
    after = {
      _id: contactId(hash), type: "contact", email, lang: "en", groups: [], status: "suppressed", source: "manual",
      consentAt: now, consentNote: "Added to the suppression list", topics: { blog: false, releases: false },
      createdAt: now, updatedAt: now, unsubscribedAt: now,
    };
    if (!(await createContact(after))) after = await updateContact(hash, (c) => { c.status = "suppressed"; });
  }
  return { hash, before, after };
}

router.post(
  "/suppression",
  asyncHandler(async (req, res) => {
    const b = SuppressBody.safeParse(req.body);
    if (!b.success) return invalid(res);
    const { hash, before, after } = await suppressAddress(b.data.email);
    if (!after) return bad(res, "Could not suppress this address.", 409);
    res.locals.audit = { target: after._id, before, after };
    res.status(201).json({ ok: true, hash });
  }),
);

/*
 * Paste the addresses a bounce report or an inbox lists, one tool call: any
 * mix of lines, commas and "Name <a@b.c>" forms. Each is validated like the
 * single route; the rest come back (clipped) so the owner can fix them. The
 * audit record carries counts only, never an address.
 */
router.post(
  "/suppression/bulk",
  asyncHandler(async (req, res) => {
    const b = SuppressBulkBody.safeParse(req.body);
    if (!b.success) return invalid(res);
    const seen = new Set<string>();
    const todo: string[] = [];
    const invalidTokens: string[] = [];
    const reject = (t: string) => { if (invalidTokens.length < 50) invalidTokens.push(t.slice(0, 80)); };
    for (const line of b.data.text.split(/\r?\n/)) {
      let found = false;
      for (const raw of line.split(/[\s,;]+/)) {
        const t = raw.replace(/^[<("']+|[>)"'.]+$/g, "").trim();
        if (!t) continue;
        const e = Email.safeParse(t);
        if (e.success) {
          found = true;
          const h = hashEmail(e.data);
          if (!seen.has(h)) { seen.add(h); todo.push(e.data); }
        } else if (t.includes("@")) reject(t);
      }
      /* A line with no address at all (a display name, a pasted sentence) is reported whole; beside an address it is just a name. */
      if (!found && !line.includes("@") && line.trim()) reject(line.trim());
    }
    if (todo.length > SUPPRESS_BULK_MAX) return bad(res, `Paste at most ${SUPPRESS_BULK_MAX} addresses at a time.`, 413);
    let suppressed = 0, already = 0, failed = 0;
    for (const email of todo) {
      try {
        const known = await getContact(hashEmail(email));
        if (known?.status === "suppressed") { already++; continue; }
        const r = await suppressAddress(email);
        if (r.after) suppressed++; else failed++;
      } catch (err) {
        failed++;
        logger.warn({ err: err instanceof Error ? err.message : String(err) }, "bulk suppression: one address failed");
      }
    }
    res.locals.audit = { target: "audience:suppression-bulk", before: null, after: { suppressed, already, failed, invalid: invalidTokens.length } };
    res.json({ ok: true, suppressed, already, failed, invalid: invalidTokens });
  }),
);

router.delete(
  "/suppression/:hash",
  asyncHandler(async (req, res) => {
    const hash = hashParam(req.params.hash);
    if (!hash) return invalid(res);
    const before = await getContact(hash);
    if (!before || before.status !== "suppressed") return bad(res, "Not on the suppression list.", 404);
    const prior = structuredClone(before);
    // Lifted, not forgotten: the person is not mailed until they sign up and confirm again.
    await ledgerPut(hash, "unsubscribed");
    const after = await updateContact(hash, (c) => {
      c.status = "unsubscribed";
      /* The bounce that put it here is history; a fresh signup starts clean. */
      delete c.suppressedReason;
      delete c.softBounces;
    });
    logger.info({ contact: hash }, "suppression lifted");
    res.locals.audit = { target: before._id, before: prior, after };
    res.json({ ok: true });
  }),
);

/* ---------------------------------------------------------------- hygiene -- */

/* What the scheduled sweep removed: counts and times only. */
router.get(
  "/sweep",
  asyncHandler(async (_req, res) => {
    const [r, settings] = await Promise.all([getSweepReport().catch(() => null), loadSettings()]);
    res.locals.noAudit = true;
    res.json({
      ok: true,
      pendingTtlDays: settings.sender.pendingTtlDays,
      report: r ? { at: r.at, lastPurged: r.lastPurged, totalPurged: r.totalPurged, since: r.since, lastMinimised: r.lastMinimised ?? 0, totalMinimised: r.totalMinimised ?? 0 } : null,
    });
  }),
);

/* ---------------------------------------------------------------- ledger -- */

/* What the Marketing banner reads: is the ledger usable, how many lines of each kind, and what the guard last repaired. Counts only. */
router.get(
  "/ledger",
  asyncHandler(async (_req, res) => {
    const counts = { unsubscribed: 0, suppressed: 0, erased: 0 };
    try {
      for (const e of (await ledgerEntries()).values()) counts[e.kind]++;
    } catch {
      return res.json({ ok: true, ready: false, counts, report: null });
    }
    const r = await ledgerReport().catch(() => null);
    res.json({ ok: true, ready: true, counts, report: r ? { at: r.at, repaired: r.repaired, acknowledgedAt: r.acknowledgedAt ?? null } : null });
  }),
);

router.post(
  "/ledger/ack",
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, acknowledged: await acknowledgeReport() });
  }),
);

/* Runs the same check the sender runs, now: after a restore the owner does not have to wait for a campaign to see the repair. */
router.post(
  "/ledger/check",
  asyncHandler(async (_req, res) => {
    const r = await ledgerGuard();
    res.locals.noAudit = true;
    res.json({ ok: r.ok, repaired: r.ok ? r.repaired : 0 });
  }),
);

export default router;
