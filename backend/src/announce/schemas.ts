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

/** The number the signup text may promise; see docs/newsletter.md before changing it. */
export const DEFAULT_MAX_PER_CONTACT_30D = 4;
export const MAX_PER_CONTACT_30D_LIMIT = 31;

export const LABEL_MODES = ["hebrew", "all", "off"] as const;
export type LabelMode = (typeof LABEL_MODES)[number];

/* A document saved with the old boolean reads as its equivalent mode; the boolean is dropped on the way in. */
const migrateLabel = (v: unknown) => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return v;
  const { commercialLabel, ...rest } = v as Record<string, unknown>;
  if (rest.labelMode === undefined && commercialLabel === false) rest.labelMode = "off";
  return rest;
};

export const SenderSchema = z.preprocess(migrateLabel, z
  .object({
    /* Display name and address of the From header; "" falls back to MAIL_FROM. No quotes, brackets or control characters: it is spliced into a header. */
    fromName: z.string().trim().max(80).refine((s) => NoControl(s) && !/["<>\\]/.test(s), "No quotes, brackets or control characters").default(""),
    fromAddress: OptionalAddress.default(""),
    /* "" falls back to MAIL_REPLY_TO. */
    replyTo: OptionalAddress.default(""),
    /* Who sends this and where to reach them: the sender identity the law asks every commercial mail to carry. */
    /* Structured identity beside footerIdentity (which stays the name line, so a document saved before these existed keeps its text). Required-ness is checked on save and at the send gate, never here: settingsOf() re-parses stored documents. */
    identityEmail: z.string().trim().toLowerCase().max(254).default(""),
    /* Optional postal or P.O. box line. Never required. */
    identityPostal: z.string().trim().max(300).refine((t) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(t), "No control characters").default(""),
    footerIdentity: z.string().trim().max(500).refine((t) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(t), "No control characters").default(""),
    testRecipients: z.array(z.string().trim().toLowerCase().max(254).email()).max(5).default([]),
    throttlePerHour: z.number().int().min(1).max(3600).default(60),
    dailyCap: z.number().int().min(1).max(10000).default(200),
    /* Most mails one person gets in any rolling 30 days; 0 = no limit. Lenient here (settingsOf() re-parses stored documents and falls back to ALL defaults on failure); the range is checked on PUT by validateSenderLimits. */
    maxPerContact30d: z.number().default(DEFAULT_MAX_PER_CONTACT_30D),
    quietHours: QuietHoursSchema.optional(),
    /* A post or release event makes a DRAFT campaign for the subscribers group. Never sends by itself. */
    autoDraftCampaign: z.boolean().default(false),
    confirmSubjectEn: SenderText,
    confirmSubjectHe: SenderText,
    confirmBodyEn: SenderText,
    confirmBodyHe: SenderText,
    unsubscribeNoteEn: SenderText,
    unsubscribeNoteHe: SenderText,
    /* The advertisement label (Israeli spam law): hebrew = Hebrew-language recipients only, all = every recipient, off = never. */
    labelMode: z.enum(LABEL_MODES).default("hebrew"),
    pendingTtlDays: z.number().int().min(1).max(30),
  })
  .strict());
export type SenderSettings = z.infer<typeof SenderSchema>;

const PLACEHOLDER_TOKEN = /\{+[^{}]*\}+|[{}]/g;
const KNOWN = new Set(["{name}", "{site}", "{days}", "{link}"]);
export const UNSUB_NOTE_MAX = 500;
const LINK_REQUIRED: Record<string, string> = {
  confirmBodyEn: "The confirmation message must contain {link}, otherwise nobody can confirm.",
  confirmBodyHe: "The confirmation message must contain {link}, otherwise nobody can confirm.",
  unsubscribeNoteEn: "The unsubscribe note must contain {link}, otherwise nobody can unsubscribe.",
  unsubscribeNoteHe: "The unsubscribe note must contain {link}, otherwise nobody can unsubscribe.",
};

/**
 * The rules for the owner-editable subscriber wording, applied when settings
 * are SAVED. Deliberately not part of SenderSchema: settingsOf() re-parses the
 * stored document with that schema and falls back to ALL defaults on failure,
 * so a stricter schema would silently wipe an older saved document at runtime.
 * Reads stay lenient; the mail renderer defends itself.
 */
export function validateSenderTexts(sender: Pick<SenderSettings, "confirmBodyEn" | "confirmBodyHe" | "confirmSubjectEn" | "confirmSubjectHe" | "unsubscribeNoteEn" | "unsubscribeNoteHe">): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  for (const f of ["confirmSubjectEn", "confirmSubjectHe", "confirmBodyEn", "confirmBodyHe", "unsubscribeNoteEn", "unsubscribeNoteHe"] as const) {
    const text = sender[f];
    const path = `sender.${f}`;
    const noteF = f.startsWith("unsubscribeNote");
    if (LINK_REQUIRED[f] && !text.includes("{link}")) {
      issues.push({ path, message: `${LINK_REQUIRED[f]} Use Reset to default to restore it.` });
      continue;
    }
    const bad = f.startsWith("confirmSubject") ? [] : (text.match(PLACEHOLDER_TOKEN) ?? []).filter((t) => !KNOWN.has(t));
    if (bad.length) {
      issues.push({ path, message: `Unknown placeholder ${bad[0]}; use {name} {site} {days} {link}.` });
      continue;
    }
    if (noteF) {
      if (text.length > UNSUB_NOTE_MAX) issues.push({ path, message: `The unsubscribe note is at most ${UNSUB_NOTE_MAX} characters.` });
      else if (/\{(name|days)\}/.test(text)) issues.push({ path, message: "{name} and {days} are empty in the unsubscribe note; use {site} and {link}." });
    }
  }
  return issues;
}

/** Applied on PUT only, like validateSenderTexts: a whole number from 0 (off) to 31. */
export function validateSenderLimits(s: Pick<SenderSettings, "maxPerContact30d">): { path: string; message: string }[] {
  const n = s.maxPerContact30d;
  return Number.isInteger(n) && n >= 0 && n <= MAX_PER_CONTACT_30D_LIMIT
    ? []
    : [{ path: "sender.maxPerContact30d", message: `The monthly limit per person is a whole number from 0 (off) to ${MAX_PER_CONTACT_30D_LIMIT}.` }];
}

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
/** What a mail's footer still lacks. Checked on PUT and at the send gate, never on read. */
export function missingIdentity(s: Pick<SenderSettings, "footerIdentity" | "identityEmail">): ("name" | "email")[] {
  const out: ("name" | "email")[] = [];
  if (!s.footerIdentity.trim()) out.push("name");
  if (!EMAIL_RE.test(s.identityEmail.trim())) out.push("email");
  return out;
}

/** Applied on PUT only: a half-filled identity may be saved (the send gate names what is missing), a malformed address may not. */
export function validateSenderIdentity(s: Pick<SenderSettings, "identityEmail">): { path: string; message: string }[] {
  const e = s.identityEmail.trim();
  return e && !EMAIL_RE.test(e) ? [{ path: "sender.identityEmail", message: "The contact email must be a plain address like name@example.org." }] : [];
}

export const DEFAULT_SENDER: SenderSettings = {
  confirmSubjectEn: "Confirm your subscription",
  confirmSubjectHe: "אישור הרשמה",
  confirmBodyEn:
    "Hi {name},\n\nSomeone (hopefully you) asked to get updates from {site}. To confirm your subscription, open this link:\n\n{link}\n\nIf this was not you, ignore this message and nothing will happen. The link works for {days} days.",
  confirmBodyHe:
    "שלום {name},\n\nמישהו (כנראה אתם) ביקש לקבל עדכונים מהאתר {site}. כדי לאשר את ההרשמה, פתחו את הקישור:\n\n{link}\n\nאם זה לא אתם, התעלמו מהודעה זו ולא יקרה דבר. הקישור תקף {days} ימים.",
  unsubscribeNoteEn: "You get this because you subscribed on {site}. To stop receiving these emails, unsubscribe here: {link}",
  unsubscribeNoteHe: "קיבלתם הודעה זו כי נרשמתם לעדכונים באתר {site}. כדי להפסיק לקבל אותה, בטלו את ההרשמה כאן: {link}",
  labelMode: "hebrew",
  pendingTtlDays: 7,
  fromName: "",
  fromAddress: "",
  replyTo: "",
  footerIdentity: "",
  identityEmail: "",
  identityPostal: "",
  testRecipients: [],
  throttlePerHour: 60,
  dailyCap: 200,
  maxPerContact30d: DEFAULT_MAX_PER_CONTACT_30D,
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
