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
const LibraryItem = z.object({ id: Id, name: Name, channel: z.enum(CHANNELS), lang: Lang, text: z.string().max(2000) }).strict();

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
    library: z.array(LibraryItem).max(100).default([]),
    advanced: z.object({ utm: Utm.default(DEFAULT_UTM) }).strict().default({ utm: DEFAULT_UTM }),
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
