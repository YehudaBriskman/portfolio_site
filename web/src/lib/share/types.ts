/*
 * The share core's vocabulary. Settings are typed here, not imported from
 * `settings/schema.ts`: the core stays pure and the schema stays free to
 * change shape around it. The group below mirrors `SiteSettings.sharing`.
 */

export const SHARE_KINDS = ["post", "note", "project", "area", "story", "home", "release"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

export const SHARE_CHANNELS = ["native", "copy", "linkedin", "email", "gmail", "x", "whatsapp", "instagram"] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

/** `visitor` shares what they found; `owner` announces their own work. */
export type ShareAudience = "visitor" | "owner";

export type ShareLocale = "en" | "he";

/** 1200x630, 1080x1080 and 1080x1920 share cards. */
export type CardFormat = "og" | "square" | "story";

export type ShareSettingsInput = {
  enabled: boolean;
  surfaces: Array<"post" | "note" | "project" | "area" | "story" | "home">;
  channels: ShareChannel[];
  utm: { enabled: boolean; source: string };
  templates: {
    en: Partial<Record<ShareChannel, string>>;
    he: Partial<Record<ShareChannel, string>>;
  };
};

/**
 * What is being shared. Only the entity's own slug reaches the address: the
 * origin comes from the caller and the path from `kind` + `slug`.
 */
export type ShareEntity = {
  /** Required for post, note, project, area and release (the project's slug). */
  slug?: string;
  /** A project's name for a release. */
  title: string;
  summary?: string;
  tags?: readonly string[];
  /** A release's version, e.g. `v1.5.0`. */
  version?: string;
};

export type ShareInput = {
  kind: ShareKind;
  entity: ShareEntity;
  locale: ShareLocale;
  channel: ShareChannel;
  audience: ShareAudience;
  /** The site origin: `SITE_URL` on the server, `window.location.origin` in the page. */
  origin: string;
  settings?: Partial<ShareSettingsInput>;
  /** Which card to hand to image channels; defaults to square for Instagram, else og. */
  format?: CardFormat;
  /** `{site}` in templates. */
  siteName?: string;
};

export type ShareLimits = {
  /** The channel's cap, or null when it has none. */
  max: number | null;
  /** How many characters `text` counts as on that channel. */
  count: number;
  over: boolean;
};

export type ShareResult = {
  channel: ShareChannel;
  /** The entity's address, with UTM tags when enabled. */
  url: string;
  /** Where to send the click; absent for copy, native and Instagram. */
  href?: string;
  /** The caption, plain text. Never HTML. */
  text: string;
  /** Email and Gmail only. */
  subject?: string;
  /** A share card address, when this kind has one. */
  image?: string;
  /**
   * False when `href` cannot carry `text` (LinkedIn's dialog takes only a URL;
   * Instagram has no web intent at all): the caller must copy `text` for the
   * person to paste.
   */
  textPrefilled: boolean;
  limits: ShareLimits;
};
