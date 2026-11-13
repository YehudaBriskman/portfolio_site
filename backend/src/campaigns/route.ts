import { randomBytes } from "node:crypto";
import { Router, type Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { toIssues } from "../schemas/site-content.js";
import { listRecipients, hashEmail } from "../audience/store.js";
import { loadSettings } from "../announce/store.js";
import { missingIdentity, validateSenderTexts } from "../announce/schemas.js";
import { emailService } from "../services/email.service.js";
import { logger } from "../logger.js";
import { budgetLimits, budgetNow } from "./budgetStore.js";
import { estimateFinish, nextWindowAt, thresholdsReached } from "./budget.js";
import { resolveSender } from "./config.js";
import { ledgerWritable } from "../audience/ledger.js";
import { isTested, contentFingerprint } from "./readiness.js";
import { campaignsBlocked, sendingState, setPaused } from "./killSwitch.js";
import { renderCampaignMail } from "./render.js";
import { AudienceBody, SendingBody, CampaignCreate, CampaignId, CampaignPatch, PreviewBody, ScheduleBody, SendNowBody, type Campaign } from "./schemas.js";
import { CAP_WINDOW_MS } from "./sender.js";
import { campaignId, createCampaign, deleteCampaign, getCampaign, isStatus, listCampaigns, mutateCampaign, sentCounts } from "./store.js";

/*
 * Under /api/admin/campaigns, behind requireAdmin and auditWrites. A campaign
 * doc holds no addresses, so it can be audited whole; a test send and an
 * audience sample answer with counts and masked addresses only.
 */
const router = Router();
const bad = (res: Response, error: string, status = 400) => res.status(status).json({ ok: false, error });
const conflict = (res: Response) => bad(res, "This changed elsewhere. Reload and reapply your edit.", 409);
/* 423 Locked: the owner's pause or SEND_ENABLED=false. Nothing is queued or sent until it is lifted. */
const heldBy = (res: Response) => res.status(423).json({ ok: false, code: "paused", error: "Sending is paused. Resume sending in Campaigns first." });
const notFound = (res: Response) => bad(res, "No such campaign.", 404);

const mask = (email: string) => {
  const [local = "", domain = ""] = email.split("@");
  const dot = domain.lastIndexOf(".");
  return `${local.slice(0, 1)}***@${domain.slice(0, 1)}***${dot > 0 ? domain.slice(dot) : ""}`;
};

const view = (c: Campaign) => ({
  id: c._id.slice("campaign:".length), _rev: c._rev ?? null, name: c.name, subject: c.subject, preheader: c.preheader ?? "",
  bodyText: c.bodyText, blocks: c.blocks ?? null, groups: c.groups, lang: c.lang ?? "all", topic: c.topic ?? null,
  status: c.status, sendAt: c.sendAt ?? null, counters: c.counters, capOverride: c.capOverride ?? null, eventId: c.eventId ?? null,
  pausedReason: c.pausedReason ?? null, testedAt: isTested(c) ? c.tested!.at : null, startedAt: c.startedAt ?? null, finishedAt: c.finishedAt ?? null, createdAt: c.createdAt, updatedAt: c.updatedAt,
});

const idOf = (raw: unknown) => {
  const p = CampaignId.safeParse(raw);
  return p.success ? p.data : null;
};

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.set("Cache-Control", "no-store").json({ ok: true, campaigns: (await listCampaigns()).map(view) });
  }),
);

/*
 * The kill switch. GET says whether sending is held (by the owner's pause, by
 * SEND_ENABLED=false, or both); POST {paused} is the one click that holds or
 * releases every campaign. Registered before /:id. The environment value cannot
 * be lifted from here, on purpose.
 */
router.get(
  "/sending",
  asyncHandler(async (_req, res) => {
    res.set("Cache-Control", "no-store").json({ ok: true, ...(await sendingState()) });
  }),
);

router.post(
  "/sending",
  asyncHandler(async (req, res) => {
    const b = SendingBody.safeParse(req.body);
    if (!b.success) return res.status(400).json({ ok: false, error: "Check the fields and try again.", issues: toIssues(b.error) });
    const before = await sendingState();
    await setPaused(b.data.paused);
    const after = await sendingState();
    res.locals.audit = { target: "sender:switch", before: { paused: before.paused }, after: { paused: after.paused } };
    res.json({ ok: true, ...after });
  }),
);

/*
 * The mail budget for the settings meter, the confirm step and the progress
 * panel: today (rolling 24 h) and this month, what newsletters may still send,
 * and, given `remaining` recipients, how many days a campaign needs. Counts
 * only. Registered before /:id so "budget" is never read as a campaign id.
 */
router.get(
  "/budget",
  asyncHandler(async (req, res) => {
    const ms = Date.now();
    const { budget: b, newsTimes, sender: s } = await budgetNow(ms);
    const remaining = Number.parseInt(String(req.query.remaining ?? ""), 10);
    const plan = Number.isInteger(remaining) && remaining >= 0 ? estimateFinish(remaining, ms, b, s) : undefined;
    const resume = nextWindowAt(b, newsTimes, ms);
    res.set("Cache-Control", "no-store").json({
      ok: true,
      limits: budgetLimits(s),
      today: { used: b.usedDay, usable: b.usableDay, reserve: b.reserve, room: b.roomDay },
      month: { used: b.usedMonth, usable: b.usableMonth, room: b.roomMonth },
      capacity: b.capacity,
      waiting: b.waiting,
      resumeAt: resume === null ? null : new Date(resume).toISOString(),
      thresholds: thresholdsReached(b.usedMonth, b.usableMonth),
      ...(plan !== undefined ? { plan } : {}),
    });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const b = CampaignCreate.safeParse(req.body);
    if (!b.success) return res.status(400).json({ ok: false, error: "Check the fields and try again.", issues: toIssues(b.error) });
    const now = new Date().toISOString();
    const c: Campaign = {
      _id: campaignId(randomBytes(8).toString("hex")), type: "campaign", ...b.data, status: "draft",
      counters: { queued: 0, sent: 0, failed: 0, suppressed: 0 }, createdAt: now, updatedAt: now,
    };
    await createCampaign(c);
    res.locals.audit = { target: c._id, before: null, after: c };
    res.status(201).json({ ok: true, campaign: view((await getCampaign(c._id.slice(9)))!) });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idOf(req.params.id);
    const c = id && (await getCampaign(id));
    if (!c) return notFound(res);
    res.set("Cache-Control", "no-store").json({ ok: true, campaign: view(c) });
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idOf(req.params.id);
    const b = CampaignPatch.safeParse(req.body);
    if (!b.success) return res.status(400).json({ ok: false, error: "Check the fields and try again.", issues: toIssues(b.error) });
    const before = id ? await getCampaign(id) : null;
    if (!id || !before) return notFound(res);
    if (b.data._rev !== undefined && b.data._rev !== before._rev) return conflict(res);
    if (before.status !== "draft") return bad(res, "Only a draft can be edited. Cancel the schedule first.", 409);
    const { _rev, topic, blocks, ...rest } = b.data;
    void _rev;
    let after: Campaign | null;
    try {
      after = await mutateCampaign(id, (c) => {
        if (c.status !== "draft") return false;
        Object.assign(c, rest);
        if (topic === null) delete c.topic;
        else if (topic) c.topic = topic;
        if (rest.preheader === "") delete c.preheader;
        if (blocks === null) delete c.blocks;
        else if (blocks) c.blocks = blocks;
      });
    } catch (e) {
      if (isStatus(e, 409)) return conflict(res);
      throw e;
    }
    res.locals.audit = { target: before._id, before, after };
    res.json({ ok: true, campaign: view(after!) });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idOf(req.params.id);
    const before = id ? await getCampaign(id) : null;
    if (!id || !before) return notFound(res);
    if (before.status === "scheduled" || before.status === "sending" || before.status === "paused") return bad(res, "Cancel it first.", 409);
    await deleteCampaign(id);
    res.locals.audit = { target: before._id, before, after: null };
    res.json({ ok: true });
  }),
);

const recipientsOf = (c: Campaign) =>
  listRecipients({ groups: c.groups, ...(c.lang && c.lang !== "all" ? { lang: c.lang } : {}), ...(c.topic ? { topic: c.topic } : {}) });

/** How many mails each contact got in the monthly window (null when the limit is off). */
async function capState(max: number, except?: string): Promise<Map<string, number> | null> {
  return max > 0 ? sentCounts(Date.now() - CAP_WINDOW_MS, except) : null;
}
const limitOf = (s: { maxPerContact30d: number }) => Math.max(0, Math.floor(s.maxPerContact30d));

/* Reservoir of 3: a random sample without holding the list. Also counts who is already at the monthly limit when `counts` is given. */
async function sampleOf(recipients: ReturnType<typeof listRecipients>, counts: Map<string, number> | null = null, max = 0) {
  const sample: string[] = [];
  let n = 0;
  let over = 0;
  for await (const r of recipients) {
    n++;
    if (counts && (counts.get(r._id.slice("contact:".length)) ?? 0) >= max) over++;
    if (sample.length < 3) sample.push(r.email);
    else {
      const j = Math.floor(Math.random() * n);
      if (j < 3) sample[j] = r.email;
    }
  }
  return { count: n, samples: sample.map(mask), ...(counts ? { overCap: over, cap: max } : {}) };
}

/** The audience answer plus the limit's share of it. A failed count leaves the limit out; the audience itself still answers. */
async function audienceOf(c: Campaign, except?: string) {
  const max = limitOf((await loadSettings()).sender);
  let counts: Map<string, number> | null = null;
  try {
    counts = await capState(max, except);
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "monthly limit count failed");
  }
  return sampleOf(recipientsOf(c), counts, max);
}

router.get(
  "/:id/audience",
  asyncHandler(async (req, res) => {
    const id = idOf(req.params.id);
    const c = id && (await getCampaign(id));
    if (!c) return notFound(res);
    res.set("Cache-Control", "no-store").json({ ok: true, ...(await audienceOf(c, c._id.slice("campaign:".length))) });
  }),
);

/*
 * The same count for a selection that is not saved yet, so the number on the
 * page follows the boxes being ticked. A read, so it is not audited (it would
 * log every tick); it answers with a count and masked samples only.
 */
router.post(
  "/audience",
  asyncHandler(async (req, res) => {
    const b = AudienceBody.safeParse(req.body);
    if (!b.success) return res.status(400).json({ ok: false, error: "Check the fields and try again.", issues: toIssues(b.error) });
    res.locals.noAudit = true;
    res.set("Cache-Control", "no-store").json({ ok: true, ...(await audienceOf({ groups: b.data.groups, lang: b.data.lang, ...(b.data.topic ? { topic: b.data.topic } : {}) } as Campaign)) });
  }),
);

/*
 * The mail as it would be sent, from draft text that need not be saved: the
 * one renderer, so the preview cannot drift from the send. The unsubscribe
 * link is signed for a placeholder contact and goes nowhere real.
 */
router.post(
  "/preview",
  asyncHandler(async (req, res) => {
    const b = PreviewBody.safeParse(req.body);
    if (!b.success) return res.status(400).json({ ok: false, error: "Check the fields and try again.", issues: toIssues(b.error) });
    res.locals.noAudit = true;
    const { subject, preheader, bodyText, blocks, lang } = b.data;
    const m = await renderCampaignMail({ subject, preheader, bodyText, ...(blocks ? { blocks } : {}) }, { lang }, hashEmail("preview@example.invalid"), (await loadSettings()).sender);
    res.set("Cache-Control", "no-store").json({ ok: true, subject: m.subject, html: m.html, text: m.text });
  }),
);

router.post(
  "/:id/test",
  asyncHandler(async (req, res) => {
    const id = idOf(req.params.id);
    const c = id && (await getCampaign(id));
    if (!c) return notFound(res);
    if (await campaignsBlocked()) return heldBy(res);
    const settings = (await loadSettings()).sender;
    if (settings.testRecipients.length === 0) return bad(res, "Add a test recipient in Sender & delivery first.", 422);
    const from = resolveSender(settings);
    const lang = c.lang === "he" ? "he" : "en";
    const msgs = await Promise.all(
      settings.testRecipients.map(async (to) => ({ to, ...(await renderCampaignMail(c, { lang }, hashEmail(to), settings, { subjectPrefix: "[Test] " })) })),
    );
    const results = await emailService.sendBulk(msgs, { from: from.from, replyTo: from.replyTo });
    const sent = results.filter((r) => r.ok).length;
    /* Every test recipient got it: only then is this exact content "tested". A later edit changes the fingerprint and the mark no longer counts. */
    if (sent === results.length && sent > 0 && c.status === "draft") {
      const fp = contentFingerprint(c);
      await mutateCampaign(id, (x) => {
        if (x.status !== "draft" || contentFingerprint(x) !== fp) return false;
        x.tested = { at: new Date().toISOString(), fp };
      }).catch(() => null);
    }
    if (sent < results.length) logger.warn({ campaign: id, failed: results.length - sent }, "test send had failures");
    res.locals.audit = { target: `campaign:${id}`, before: null, after: { testSent: sent, testFailed: results.length - sent } };
    res.json({ ok: true, sent, failed: results.length - sent });
  }),
);

type CapChoice = { overrideCap?: boolean; skipCapped?: boolean; confirmCount?: number };

/** The checks every route that puts a campaign in the queue shares. */
async function queueable(c: Campaign, res: Response, choice: CapChoice): Promise<boolean> {
  if (await campaignsBlocked()) {
    heldBy(res);
    return false;
  }
  if (c.status !== "draft" && c.status !== "scheduled") {
    bad(res, "Only a draft or scheduled campaign can be queued.", 409);
    return false;
  }
  const s = (await loadSettings()).sender;
  const lacks = missingIdentity(s);
  if (lacks.length) {
    bad(res, `Fill in the sender identity (${lacks.map((k) => (k === "name" ? "your name" : "a contact email")).join(" and ")}) in Sender & delivery before sending.`, 422);
    return false;
  }
  if (validateSenderTexts(s).length) {
    bad(res, "Fix the subscriber texts (the unsubscribe note must contain {link}) in Sender & delivery before sending.", 422);
    return false;
  }
  /* A ledger that cannot be read and written cannot honour the next unsubscribe: nothing is queued on it. */
  if (!(await ledgerWritable())) {
    bad(res, "The never-mail list cannot be read or written right now, so nothing can be sent. Check the suppression ledger in Audience.", 503);
    return false;
  }
  const max = limitOf(s);
  const counts = max > 0 && !choice.overrideCap && !choice.skipCapped ? await capState(max, c._id.slice("campaign:".length)) : null;
  let total = 0;
  let over = 0;
  for await (const r of recipientsOf(c)) {
    total++;
    if (counts && (counts.get(r._id.slice("contact:".length)) ?? 0) >= max) over++;
  }
  if (total === 0) {
    bad(res, "This audience has no active recipients.", 422);
    return false;
  }
  if (!isTested(c)) {
    res.status(422).json({ ok: false, code: "test", error: "Send a test to yourself first. A test counts only for the text it carried, so test again after any edit." });
    return false;
  }
  if (choice.confirmCount === undefined) {
    res.status(422).json({ ok: false, code: "confirm", total, error: "Confirm how many people this goes to before it can be sent." });
    return false;
  }
  if (choice.confirmCount !== total) {
    res.status(409).json({ ok: false, code: "count", total, error: `The audience is now ${total} ${total === 1 ? "person" : "people"}, not ${choice.confirmCount}. Check it and confirm again.` });
    return false;
  }
  if (over > 0) {
    /* The owner decides: send to the others (skipCapped), or to everyone anyway (overrideCap, recorded). */
    res.status(409).json({
      ok: false, code: "cap", capped: over, total, max,
      error: `${over} of ${total} recipient${total === 1 ? "" : "s"} already got ${max} email${max === 1 ? "" : "s"} in the last 30 days. Send to the others (they are skipped), or send to everyone anyway.`,
    });
    return false;
  }
  return true;
}

async function queue(res: Response, id: string, sendAt: string | null, choice: CapChoice = {}) {
  const before = await getCampaign(id);
  if (!before) return notFound(res);
  if (sendAt !== null && !(await queueable(before, res, choice))) return;
  if (sendAt === null && before.status !== "scheduled") return bad(res, "It is not scheduled.", 409);
  let after: Campaign | null;
  try {
    after = await mutateCampaign(id, (c) => {
      if (c.status !== "draft" && c.status !== "scheduled") return false;
      if (sendAt === null) {
        c.status = "draft";
        delete c.sendAt;
        delete c.capOverride;
      } else {
        c.status = "scheduled";
        c.sendAt = sendAt;
        /* The override belongs to this decision: scheduling again without it asks again. */
        if (choice.overrideCap) c.capOverride = { at: new Date().toISOString() };
        else delete c.capOverride;
      }
    });
  } catch (e) {
    if (isStatus(e, 409)) return conflict(res);
    throw e;
  }
  if (!after || (sendAt === null ? after.status !== "draft" : after.status !== "scheduled")) return bad(res, "This campaign changed state. Reload.", 409);
  res.locals.audit = { target: before._id, before, after };
  res.json({ ok: true, campaign: view(after) });
}

router.post(
  "/:id/schedule",
  asyncHandler(async (req, res) => {
    const id = idOf(req.params.id);
    const b = ScheduleBody.safeParse(req.body);
    if (!id) return notFound(res);
    if (!b.success) return res.status(400).json({ ok: false, error: "Check the fields and try again.", issues: toIssues(b.error) });
    await queue(res, id, b.data.sendAt === null ? null : new Date(b.data.sendAt).toISOString(), { overrideCap: b.data.overrideCap, skipCapped: b.data.skipCapped, confirmCount: b.data.confirmCount });
  }),
);

router.post(
  "/:id/send-now",
  asyncHandler(async (req, res) => {
    const id = idOf(req.params.id);
    const b = SendNowBody.safeParse(req.body ?? {});
    if (!id) return notFound(res);
    if (!b.success) return res.status(400).json({ ok: false, error: "Check the fields and try again.", issues: toIssues(b.error) });
    await queue(res, id, new Date().toISOString(), b.data);
  }),
);

router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const id = idOf(req.params.id);
    const before = id ? await getCampaign(id) : null;
    if (!id || !before) return notFound(res);
    if (before.status !== "scheduled" && before.status !== "sending" && before.status !== "paused") return bad(res, "Only a scheduled, sending or paused campaign can be canceled.", 409);
    let after: Campaign | null;
    try {
      after = await mutateCampaign(id, (c) => {
        if (c.status !== "scheduled" && c.status !== "sending" && c.status !== "paused") return false;
        c.status = "canceled";
        delete c.pausedReason;
        c.finishedAt = new Date().toISOString();
      });
    } catch (e) {
      if (isStatus(e, 409)) return conflict(res);
      throw e;
    }
    res.locals.audit = { target: before._id, before, after };
    res.json({ ok: true, campaign: view(after!) });
  }),
);

/* The owner fixed the cause (credentials, a blocked domain, a stale list) and lets the campaign carry on. The health window restarts so the same old failures do not pause it again; people already done are skipped. */
router.post(
  "/:id/resume",
  asyncHandler(async (req, res) => {
    const id = idOf(req.params.id);
    const before = id ? await getCampaign(id) : null;
    if (!id || !before) return notFound(res);
    if (before.status !== "paused") return bad(res, "Only a paused campaign can be resumed.", 409);
    let after: Campaign | null;
    try {
      after = await mutateCampaign(id, (c) => {
        if (c.status !== "paused") return false;
        c.status = "scheduled";
        c.sendAt = new Date().toISOString();
        c.health = { sent: 0, failed: 0, hard: 0, streak: 0 };
        delete c.pausedReason;
      });
    } catch (e) {
      if (isStatus(e, 409)) return conflict(res);
      throw e;
    }
    if (!after || after.status !== "scheduled") return bad(res, "This campaign changed state. Reload.", 409);
    res.locals.audit = { target: before._id, before, after };
    res.json({ ok: true, campaign: view(after) });
  }),
);

export default router;
