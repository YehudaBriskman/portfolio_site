import { z } from "zod";
import { Slug } from "../audience/schemas.js";
import { safeHref, safeImage } from "./body.js";
import type { SmtpErrorKind } from "../providers/classifySmtpError.js";

export const CAMPAIGN_STATUSES = ["draft", "scheduled", "sending", "sent", "failed", "canceled", "paused"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
/** Why the sender stopped a campaign by itself. Only the owner resumes it. */
export type PauseReason = "auth" | "consecutive" | "failure-rate" | "hard-bounce-rate";
/** Results since the campaign started or was last resumed: what the auto-pause rules are judged on. */
export type Health = { sent: number; failed: number; hard: number; streak: number };

export type Block = { type: "p" | "h2" | "ul" | "cta" | "image"; text?: string; items?: string[]; url?: string; label?: string };

export type Campaign = {
  _id: string;
  _rev?: string;
  type: "campaign";
  name: string;
  subject: string;
  preheader?: string;
  /** Plain text; blank lines are paragraphs. The mail HTML is rendered from this (or `blocks`) on the server. */
  bodyText: string;
  blocks?: Block[];
  groups: string[];
  lang?: "en" | "he" | "all";
  topic?: "blog" | "releases";
  status: CampaignStatus;
  sendAt?: string;
  counters: { queued: number; sent: number; failed: number; suppressed: number };
  eventId?: string;
  pausedReason?: PauseReason;
  health?: Health;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type SendResult = {
  _id: string;
  _rev?: string;
  type: "send";
  campaignId: string;
  contact: string;
  /** `deferred`: a transient failure, tried again at `retryAt` (not final, not counted as failed). */
  status: "attempting" | "sent" | "failed" | "suppressed" | "deferred";
  at: string;
  error?: string;
  /** From classifySmtpError: the kind of failure and the numeric SMTP reply. Never an address. */
  kind?: SmtpErrorKind;
  code?: number;
  tries?: number;
  retryAt?: string;
};

export const CampaignId = z.string().regex(/^[a-z0-9-]{1,40}$/);

const NoLineBreak = (s: string) => !/[\r\n\u2028\u2029\u0000]/.test(s);
const Name = z.string().trim().min(1).max(120);
const Subject = z.string().trim().min(1).max(200).refine(NoLineBreak, "One line");
const Preheader = z.string().trim().max(200).refine(NoLineBreak, "One line");
/* The cleaned copy is what is stored, so what the owner previews is what is sent. */
const Url = z.string().max(2000);
const Blocks = z
  .array(
    z.discriminatedUnion("type", [
      z.object({ type: z.literal("p"), text: z.string().min(1).max(5000) }).strict(),
      z.object({ type: z.literal("h2"), text: z.string().min(1).max(300) }).strict(),
      z.object({ type: z.literal("ul"), items: z.array(z.string().min(1).max(1000)).min(1).max(50) }).strict(),
      z.object({ type: z.literal("cta"), url: Url.refine((u) => safeHref(u) !== null, "A http(s) or mailto link"), label: z.string().min(1).max(100) }).strict(),
      z.object({ type: z.literal("image"), url: Url.refine((u) => safeImage(u) !== null, "An https image on this site"), text: z.string().max(300).optional() }).strict(),
    ]),
  )
  .max(100);
const BodyText = z.string().max(100_000);
const Groups = z.array(Slug).min(1).max(20);

const Fields = {
  name: Name,
  subject: Subject,
  preheader: Preheader.optional(),
  bodyText: BodyText,
  blocks: Blocks,
  groups: Groups,
  lang: z.enum(["en", "he", "all"]),
  topic: z.enum(["blog", "releases"]),
};

export const CampaignCreate = z
  .object({ ...Fields, lang: Fields.lang.default("all"), topic: Fields.topic.optional(), eventId: z.string().max(200).optional(), blocks: Blocks.optional() })
  .strict();
export const CampaignPatch = z
  .object({ ..._partial(), _rev: z.string().optional() })
  .strict();
function _partial() {
  return {
    name: Fields.name.optional(),
    subject: Fields.subject.optional(),
    preheader: Fields.preheader,
    bodyText: Fields.bodyText.optional(),
    blocks: Fields.blocks.nullable().optional(),
    groups: Fields.groups.optional(),
    lang: Fields.lang.optional(),
    topic: Fields.topic.nullable().optional(),
  };
}
export const ScheduleBody = z.object({ sendAt: z.string().datetime({ offset: true }).nullable() }).strict();

/* Unsaved draft text, rendered exactly as it would be sent. Lenient on emptiness (a half-typed draft still previews), strict on shape. */
export const PreviewBody = z
  .object({
    subject: z.string().max(200),
    preheader: z.string().max(200).optional(),
    bodyText: BodyText,
    blocks: Blocks.nullable().optional(),
    lang: z.enum(["en", "he"]).default("en"),
  })
  .strict();
/* The audience selection of a draft that may not be saved yet. */
export const AudienceBody = z
  .object({ groups: Groups, lang: Fields.lang.default("all"), topic: Fields.topic.nullable().optional() })
  .strict();
