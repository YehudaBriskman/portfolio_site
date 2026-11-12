import { z } from "zod";
import { Slug } from "../audience/schemas.js";
import { sanitizeHtml } from "./sanitize.js";

export const CAMPAIGN_STATUSES = ["draft", "scheduled", "sending", "sent", "failed", "canceled"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export type Campaign = {
  _id: string;
  _rev?: string;
  type: "campaign";
  name: string;
  subject: string;
  preheader?: string;
  bodyHtml: string;
  bodyText: string;
  groups: string[];
  lang?: "en" | "he" | "all";
  topic?: "blog" | "releases";
  status: CampaignStatus;
  sendAt?: string;
  counters: { queued: number; sent: number; failed: number; suppressed: number };
  eventId?: string;
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
  status: "attempting" | "sent" | "failed" | "suppressed";
  at: string;
  error?: string;
};

export const CampaignId = z.string().regex(/^[a-z0-9-]{1,40}$/);

const NoLineBreak = (s: string) => !/[\r\n\u2028\u2029\u0000]/.test(s);
const Name = z.string().trim().min(1).max(120);
const Subject = z.string().trim().min(1).max(200).refine(NoLineBreak, "One line");
const Preheader = z.string().trim().max(200).refine(NoLineBreak, "One line");
/* The cleaned copy is what is stored, so what the owner previews is what is sent. */
const BodyHtml = z.string().max(200_000).transform(sanitizeHtml);
const BodyText = z.string().max(100_000);
const Groups = z.array(Slug).min(1).max(20);

const Fields = {
  name: Name,
  subject: Subject,
  preheader: Preheader.optional(),
  bodyHtml: BodyHtml,
  bodyText: BodyText,
  groups: Groups,
  lang: z.enum(["en", "he", "all"]),
  topic: z.enum(["blog", "releases"]),
};

export const CampaignCreate = z
  .object({ ...Fields, lang: Fields.lang.default("all"), topic: Fields.topic.optional(), eventId: z.string().max(200).optional() })
  .strict();
export const CampaignPatch = z
  .object({ ..._partial(), _rev: z.string().optional() })
  .strict();
function _partial() {
  return {
    name: Fields.name.optional(),
    subject: Fields.subject.optional(),
    preheader: Fields.preheader,
    bodyHtml: Fields.bodyHtml.optional(),
    bodyText: Fields.bodyText.optional(),
    groups: Fields.groups.optional(),
    lang: Fields.lang.optional(),
    topic: Fields.topic.nullable().optional(),
  };
}
export const ScheduleBody = z.object({ sendAt: z.string().datetime({ offset: true }).nullable() }).strict();
