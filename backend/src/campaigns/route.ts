import { randomBytes } from "node:crypto";
import { Router, type Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { toIssues } from "../schemas/site-content.js";
import { listRecipients, hashEmail } from "../audience/store.js";
import { loadSettings } from "../announce/store.js";
import { missingIdentity, validateSenderTexts } from "../announce/schemas.js";
import { emailService } from "../services/email.service.js";
import { logger } from "../logger.js";
import { resolveSender } from "./config.js";
import { renderCampaignMail } from "./render.js";
import { AudienceBody, CampaignCreate, CampaignId, CampaignPatch, PreviewBody, ScheduleBody, type Campaign } from "./schemas.js";
import { campaignId, createCampaign, deleteCampaign, getCampaign, isStatus, listCampaigns, mutateCampaign } from "./store.js";

/*
 * Under /api/admin/campaigns, behind requireAdmin and auditWrites. A campaign
 * doc holds no addresses, so it can be audited whole; a test send and an
 * audience sample answer with counts and masked addresses only.
 */
const router = Router();
const bad = (res: Response, error: string, status = 400) => res.status(status).json({ ok: false, error });
const conflict = (res: Response) => bad(res, "This changed elsewhere. Reload and reapply your edit.", 409);
const notFound = (res: Response) => bad(res, "No such campaign.", 404);

const mask = (email: string) => {
  const [local = "", domain = ""] = email.split("@");
  const dot = domain.lastIndexOf(".");
  return `${local.slice(0, 1)}***@${domain.slice(0, 1)}***${dot > 0 ? domain.slice(dot) : ""}`;
};

const view = (c: Campaign) => ({
  id: c._id.slice("campaign:".length), _rev: c._rev ?? null, name: c.name, subject: c.subject, preheader: c.preheader ?? "",
  bodyText: c.bodyText, blocks: c.blocks ?? null, groups: c.groups, lang: c.lang ?? "all", topic: c.topic ?? null,
  status: c.status, sendAt: c.sendAt ?? null, counters: c.counters, eventId: c.eventId ?? null,
  pausedReason: c.pausedReason ?? null, startedAt: c.startedAt ?? null, finishedAt: c.finishedAt ?? null, createdAt: c.createdAt, updatedAt: c.updatedAt,
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

/* Reservoir of 3: a random sample without holding the list. */
async function sampleOf(recipients: ReturnType<typeof listRecipients>) {
  const sample: string[] = [];
  let n = 0;
  for await (const r of recipients) {
    n++;
    if (sample.length < 3) sample.push(r.email);
    else {
      const j = Math.floor(Math.random() * n);
      if (j < 3) sample[j] = r.email;
    }
  }
  return { count: n, samples: sample.map(mask) };
}

router.get(
  "/:id/audience",
  asyncHandler(async (req, res) => {
    const id = idOf(req.params.id);
    const c = id && (await getCampaign(id));
    if (!c) return notFound(res);
    res.set("Cache-Control", "no-store").json({ ok: true, ...(await sampleOf(recipientsOf(c))) });
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
    res.set("Cache-Control", "no-store").json({ ok: true, ...(await sampleOf(recipientsOf({ groups: b.data.groups, lang: b.data.lang, ...(b.data.topic ? { topic: b.data.topic } : {}) } as Campaign))) });
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
    const settings = (await loadSettings()).sender;
    if (settings.testRecipients.length === 0) return bad(res, "Add a test recipient in Sender & delivery first.", 422);
    const from = resolveSender(settings);
    const lang = c.lang === "he" ? "he" : "en";
    const msgs = await Promise.all(
      settings.testRecipients.map(async (to) => ({ to, ...(await renderCampaignMail(c, { lang }, hashEmail(to), settings, { subjectPrefix: "[Test] " })) })),
    );
    const results = await emailService.sendBulk(msgs, { from: from.from, replyTo: from.replyTo });
    const sent = results.filter((r) => r.ok).length;
    if (sent < results.length) logger.warn({ campaign: id, failed: results.length - sent }, "test send had failures");
    res.locals.audit = { target: `campaign:${id}`, before: null, after: { testSent: sent, testFailed: results.length - sent } };
    res.json({ ok: true, sent, failed: results.length - sent });
  }),
);

/** The checks every route that puts a campaign in the queue shares. */
async function queueable(c: Campaign, res: Response): Promise<boolean> {
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
  for await (const _ of recipientsOf(c)) return true;
  bad(res, "This audience has no active recipients.", 422);
  return false;
}

async function queue(res: Response, id: string, sendAt: string | null) {
  const before = await getCampaign(id);
  if (!before) return notFound(res);
  if (sendAt !== null && !(await queueable(before, res))) return;
  if (sendAt === null && before.status !== "scheduled") return bad(res, "It is not scheduled.", 409);
  let after: Campaign | null;
  try {
    after = await mutateCampaign(id, (c) => {
      if (c.status !== "draft" && c.status !== "scheduled") return false;
      if (sendAt === null) {
        c.status = "draft";
        delete c.sendAt;
      } else {
        c.status = "scheduled";
        c.sendAt = sendAt;
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
    await queue(res, id, b.data.sendAt === null ? null : new Date(b.data.sendAt).toISOString());
  }),
);

router.post(
  "/:id/send-now",
  asyncHandler(async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) return notFound(res);
    await queue(res, id, new Date().toISOString());
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
