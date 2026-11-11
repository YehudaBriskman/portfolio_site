import { z } from "zod";

/*
 * The owner's announce settings and events. Kept apart from the public
 * SiteSettings on purpose: /api/settings serves that object whole, and
 * nothing here is for visitors.
 */

export const CHANNELS = ["linkedin", "instagram", "email", "gmail", "x"] as const;
export type Channel = (typeof CHANNELS)[number];
export const EVENT_KINDS = ["post", "release"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Platform caption limits the kit reports against. */
export const LIMITS: Record<Channel, number | null> = { linkedin: 3000, instagram: 2200, email: null, gmail: null, x: 280 };

const Template = z.string().max(2000);
const Templates = z.object(Object.fromEntries(CHANNELS.map((c) => [c, Template.optional()])) as Record<Channel, z.ZodOptional<z.ZodString>>).strict();

export const AnnounceSettingsSchema = z
  .object({
    /* Off stops new events being recorded; the inbox stays readable. */
    enabled: z.boolean(),
    email: z.object({ enabled: z.boolean(), events: z.array(z.enum(EVENT_KINDS)).max(2) }).strict(),
    hashtags: z.array(z.string().regex(/^#?[\p{L}\p{N}_]{1,40}$/u)).max(10),
    signature: z.string().max(300),
    channels: z.array(z.enum(CHANNELS)).max(CHANNELS.length),
    templates: z.object({ en: Templates, he: Templates }).strict(),
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
};

export const SETTINGS_DOC_ID = "settings:announce";

export type AnnounceSettingsDoc = {
  _id: typeof SETTINGS_DOC_ID;
  _rev?: string;
  type: "settings-announce";
  settings: AnnounceSettings;
  updatedAt: string;
};

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
  createdAt: string;
  readAt?: string;
  done: Partial<Record<Channel, string>>;
  dismissed?: string;
};

export const DoneBody = z.object({ channel: z.enum(CHANNELS) }).strict();
export const SettingsSaveBody = z.object({ settings: z.unknown(), _rev: z.string().optional() }).strict();
