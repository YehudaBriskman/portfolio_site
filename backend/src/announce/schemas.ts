import { z } from "zod";

/*
 * The owner's announce settings and events. Kept apart from the public
 * SiteSettings on purpose: /api/settings serves that object whole, and
 * nothing here is for visitors.
 */

export const CHANNELS = ["linkedin", "instagram", "email", "gmail", "x"] as const;
export type Channel = (typeof CHANNELS)[number];
export const EVENT_KINDS = ["post", "release", "note", "project", "area", "story", "home", "custom"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Platform caption limits the kit reports against. */
export const LIMITS: Record<Channel, number | null> = { linkedin: 3000, instagram: 2200, email: null, gmail: null, x: 280 };

const Template = z.string().max(2000);
const Templates = z.object(Object.fromEntries(CHANNELS.map((c) => [c, Template.optional()])) as Record<Channel, z.ZodOptional<z.ZodString>>).strict();

const Id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const Name = z.string().trim().min(1).max(60);
const Lang = z.enum(["en", "he"]);

export const SNIPPET_KINDS = ["hashtags", "signature", "cta", "links"] as const;
const Snippet = z.object({ id: Id, name: Name, kind: z.enum(SNIPPET_KINDS), text: z.string().max(1000) }).strict();
const LibraryItem = z.object({ id: Id, name: Name, channel: z.enum(CHANNELS), lang: Lang, text: z.string().max(2000), default: z.boolean().optional() }).strict();

/* A utm value is written into a link, so it is a short token, not free text. */
const UtmToken = z.string().regex(/^[a-z0-9_.-]{1,40}$/);
const Utm = z
  .object({
    enabled: z.boolean(),
    source: UtmToken,
    mediumByChannel: z.object(Object.fromEntries(CHANNELS.map((c) => [c, UtmToken.optional()])) as Record<Channel, z.ZodOptional<z.ZodString>>).strict(),
  })
  .strict();
const DEFAULT_UTM = { enabled: false, source: "announce", mediumByChannel: {} };

/*
 * The subscriber mails' owner-editable wording and retention. Only what the
 * audience module needs; the rest of "Sender & delivery" (from, footer
 * identity, throttle, quiet hours) sits beside them and is read by campaigns/.
 * Placeholders: {name} {site} {days} {link}.
 */
const SenderText = z.string().trim().min(1).max(2000);
const NoControl = (s: string) => !/[\u0000-\u001f\u007f]/.test(s);
/* "" means "use the environment default"; anything else must be a plain address. */
const OptionalAddress = z.union([z.literal(""), z.string().trim().toLowerCase().max(254).email()]);
const Hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const validZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};
export const QuietHoursSchema = z
  .object({ from: Hhmm, to: Hhmm, tz: z.string().max(60).refine(validZone, "Unknown time zone") })
  .strict();

export const SenderSchema = z
  .object({
    /* Display name and address of the From header; "" falls back to MAIL_FROM. No quotes, brackets or control characters: it is spliced into a header. */
    fromName: z.string().trim().max(80).refine((s) => NoControl(s) && !/["<>\\]/.test(s), "No quotes, brackets or control characters").default(""),
    fromAddress: OptionalAddress.default(""),
    /* "" falls back to MAIL_REPLY_TO. */
    replyTo: OptionalAddress.default(""),
    /* Who sends this and where to reach them: the sender identity the law asks every commercial mail to carry. */
    footerIdentity: z.string().trim().max(500).refine((t) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(t), "No control characters").default(""),
    testRecipients: z.array(z.string().trim().toLowerCase().max(254).email()).max(5).default([]),
    throttlePerHour: z.number().int().min(1).max(3600).default(60),
    dailyCap: z.number().int().min(1).max(10000).default(200),
    quietHours: QuietHoursSchema.optional(),
    /* A post or release event makes a DRAFT campaign for the subscribers group. Never sends by itself. */
    autoDraftCampaign: z.boolean().default(false),
    confirmSubjectEn: SenderText,
    confirmSubjectHe: SenderText,
    confirmBodyEn: SenderText,
    confirmBodyHe: SenderText,
    unsubscribeNoteEn: SenderText,
    unsubscribeNoteHe: SenderText,
    /* The Hebrew spam-law label on commercial mail. */
    commercialLabel: z.boolean(),
    pendingTtlDays: z.number().int().min(1).max(30),
  })
  .strict();
export type SenderSettings = z.infer<typeof SenderSchema>;

export const DEFAULT_SENDER: SenderSettings = {
  confirmSubjectEn: "Confirm your subscription",
  confirmSubjectHe: "אישור הרשמה",
  confirmBodyEn:
    "Hi {name},\n\nSomeone (hopefully you) asked to get updates from {site}. To confirm your subscription, open this link:\n\n{link}\n\nIf this was not you, ignore this message and nothing will happen. The link works for {days} days.",
  confirmBodyHe:
    "שלום {name},\n\nמישהו (כנראה אתם) ביקש לקבל עדכונים מהאתר {site}. כדי לאשר את ההרשמה, פתחו את הקישור:\n\n{link}\n\nאם זה לא אתם, התעלמו מהודעה זו ולא יקרה דבר. הקישור תקף {days} ימים.",
  unsubscribeNoteEn: "You get this because you subscribed on {site}. To stop receiving these emails, unsubscribe here: {link}",
  unsubscribeNoteHe: "קיבלתם הודעה זו כי נרשמתם לעדכונים באתר {site}. כדי להפסיק לקבל אותה, בטלו את ההרשמה כאן: {link}",
  commercialLabel: true,
  pendingTtlDays: 7,
  fromName: "",
  fromAddress: "",
  replyTo: "",
  footerIdentity: "",
  testRecipients: [],
  throttlePerHour: 60,
  dailyCap: 200,
  autoDraftCampaign: false,
};

export const AnnounceSettingsSchema = z
  .object({
    /* Off stops new events being recorded; the inbox stays readable. */
    enabled: z.boolean(),
    email: z.object({ enabled: z.boolean(), events: z.array(z.enum(EVENT_KINDS)).max(EVENT_KINDS.length) }).strict(),
    hashtags: z.array(z.string().regex(/^#?[\p{L}\p{N}_]{1,40}$/u)).max(10),
    signature: z.string().max(300),
    channels: z.array(z.enum(CHANNELS)).max(CHANNELS.length),
    templates: z.object({ en: Templates, he: Templates }).strict(),
    /* Added later: a document saved before them parses with these defaults. */
    snippets: z.array(Snippet).max(50).default([]),
    library: z
      .array(LibraryItem)
      .max(100)
      /* Rejected, not normalised: silently dropping a flag would change which text goes out. */
      .refine((items) => {
        const seen = new Set<string>();
        return items.every((i) => !i.default || (!seen.has(`${i.channel}:${i.lang}`) && seen.add(`${i.channel}:${i.lang}`)));
      }, "At most one default per channel and language")
      .default([]),
    advanced: z.object({ utm: Utm.default(DEFAULT_UTM) }).strict().default({ utm: DEFAULT_UTM }),
    sender: SenderSchema.default(DEFAULT_SENDER),
  })
  .strict();
export type AnnounceSettings = z.infer<typeof AnnounceSettingsSchema>;

export const DEFAULT_ANNOUNCE_SETTINGS: AnnounceSettings = {
  enabled: true,
  email: { enabled: false, events: ["post", "release"] },
  hashtags: [],
  signature: "",
  channels: [...CHANNELS],
  templates: { en: {}, he: {} },
  snippets: [],
  library: [],
  advanced: { utm: DEFAULT_UTM },
  sender: DEFAULT_SENDER,
};

export const SETTINGS_DOC_ID = "settings:announce";

export type AnnounceSettingsDoc = {
  _id: typeof SETTINGS_DOC_ID;
  _rev?: string;
  type: "settings-announce";
  settings: AnnounceSettings;
  updatedAt: string;
};

export type Drafts = { en?: Partial<Record<Channel, string>>; he?: Partial<Record<Channel, string>> };

export type AnnounceEvent = {
  _id: string;
  _rev?: string;
  type: "announce";
  kind: EventKind;
  ref: string;
  title: string;
  titleHe?: string;
  summary: string;
  summaryHe?: string;
  tags: string[];
  url: string;
  /** The site path of a post, so each language's URL can be built from SITE_URL. */
  path?: string;
  version?: string;
  langs: Array<"en" | "he">;
  /** The owner's own text per language and channel; it wins over the template. */
  drafts?: Drafts;
  /** The content of a hand-made announcement (kind custom). */
  custom?: { title: string; summary: string; url?: string; imageUrl?: string };
  createdAt: string;
  readAt?: string;
  done: Partial<Record<Channel, string>>;
  dismissed?: string;
};

export const DoneBody = z.object({ channel: z.enum(CHANNELS) }).strict();
export const SettingsSaveBody = z.object({ settings: z.unknown(), _rev: z.string().optional() }).strict();

export const DRAFT_MAX = 3000;
export const DraftBody = z
  .object({ lang: Lang, channel: z.enum(CHANNELS), text: z.string().max(DRAFT_MAX).nullable(), _rev: z.string().optional() })
  .strict();

/* Where a hand-made announcement may point: the site itself, checked in route.ts. */
export const CustomBody = z
  .object({
    kind: z.enum(["custom", "story", "home"]).default("custom"),
    title: z.string().trim().min(1).max(120),
    summary: z.string().trim().max(500),
    url: z.string().max(500).optional(),
    imageUrl: z.string().max(500).optional(),
  })
  .strict();
