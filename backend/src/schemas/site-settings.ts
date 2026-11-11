import { z } from "zod";

// ---- copy below ----

/*
 * The site's settings (#254): what comes before what on the home page, what
 * is shown at all, and the few visual defaults the owner may change.
 *
 * web/src/settings/schema.ts holds a byte-for-byte copy of everything below
 * the marker above, and a test there fails when the two differ. This one is
 * the authority: the server validates every save with it.
 *
 * SAFE DEFAULTS
 * -------------
 * `DEFAULT_SETTINGS` is the site as it was built before #254: every section,
 * in the order Index.tsx used to hard-code, the theme default the build wrote
 * (System), motion on and the one accent. An empty store, an unreachable one
 * or a document that no longer parses all read as this, so the page renders
 * exactly as it did.
 *
 * WHAT IS NOT A SETTING
 * ---------------------
 * The hero. It is the page's one heading and the screen the first dark act
 * slides over, so it is always first and always shown; the list below is
 * the sections after it.
 *
 * Colour is not free. The accent is one of a few presets, each a pair of
 * values (one per theme) measured against every ground in
 * web/src/settings/accents.ts, so no choice here can take a link below AA
 * in either theme. Motion is a default for a reader who has not chosen, and
 * only ever towards less: the three off-switches (docs/motion-contract.md
 * §4) still apply on top of it, and no setting can turn motion on for a
 * reader whose system asks for less.
 *
 * THE LEDGER, ENFORCED
 * --------------------
 * docs/motion-contract.md §2: never the same device family twice in a row.
 * Order is free except for the one pair that would break it here, the two
 * dark acts (Work and the year), which both stand on the `drift` ground and
 * would read as one act with a seam in it. They may not be adjacent among
 * the sections that are shown.
 *
 * Messages are keys, not prose: the admin words them in the reader's
 * language (web/src/components/admin/settings/words.ts).
 */

export const HOME_SECTIONS = ["work", "approach", "city", "notes", "stack", "contact"] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

/** The sections on the dark ground: the ledger's `drift`, which may not repeat. */
export const DARK_SECTIONS: readonly HomeSection[] = ["work", "city"];

export const THEME_DEFAULTS = ["light", "dark", "system"] as const;
export const MOTION_DEFAULTS = ["on", "paused"] as const;
export const ACCENTS = ["ink", "pine", "plum", "rust"] as const;
export type Accent = (typeof ACCENTS)[number];

export const SETTINGS_ISSUES = {
  duplicate: "settings.sections.duplicate",
  missing: "settings.sections.missing",
  darkAdjacent: "settings.ledger.darkAdjacent",
  shareDuplicate: "settings.sharing.duplicate",
  shareTemplateLong: "settings.sharing.templateLong",
  shareTemplateTags: "settings.sharing.templateTags",
  shareSource: "settings.sharing.source",
} as const;

const SectionSchema = z.object({ id: z.enum(HOME_SECTIONS), visible: z.boolean() }).strict();

export const HomeSettingsSchema = z
  .object({ sections: z.array(SectionSchema).max(HOME_SECTIONS.length) })
  .strict()
  .superRefine((home, ctx) => {
    const seen = new Set<HomeSection>();
    home.sections.forEach((s, i) => {
      if (seen.has(s.id)) ctx.addIssue({ code: "custom", path: ["sections", i, "id"], message: SETTINGS_ISSUES.duplicate });
      seen.add(s.id);
    });
    if (seen.size !== HOME_SECTIONS.length || home.sections.length !== HOME_SECTIONS.length) {
      ctx.addIssue({ code: "custom", path: ["sections"], message: SETTINGS_ISSUES.missing });
    }
    const shown = home.sections.map((s, i) => ({ ...s, i })).filter((s) => s.visible);
    for (let k = 1; k < shown.length; k += 1) {
      if (DARK_SECTIONS.includes(shown[k].id) && DARK_SECTIONS.includes(shown[k - 1].id)) {
        ctx.addIssue({ code: "custom", path: ["sections", shown[k].i], message: SETTINGS_ISSUES.darkAdjacent });
      }
    }
  });

export const VisualSettingsSchema = z
  .object({
    theme: z.enum(THEME_DEFAULTS),
    motion: z.enum(MOTION_DEFAULTS),
    accent: z.enum(ACCENTS),
  })
  .strict();

export const SHARE_SURFACES = ["post", "note", "project", "area", "story", "home"] as const;
export type ShareSurface = (typeof SHARE_SURFACES)[number];
export const SHARE_CHANNELS = ["native", "copy", "linkedin", "email", "gmail", "x", "whatsapp", "instagram"] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

/** A template is plain text with {title} {summary} {url} {tags} {version} {site}; markup is refused, not stripped. */
export const SHARE_TEMPLATE_MAX = 1000;
const TAG_LIKE = /<\s*\/?\s*[a-z!]/i;

const uniqueList = <T extends z.ZodType>(item: T, max: number) =>
  z.array(item).max(max).superRefine((list, ctx) => {
    const seen = new Set<unknown>();
    list.forEach((v, i) => {
      if (seen.has(v)) ctx.addIssue({ code: "custom", path: [i], message: SETTINGS_ISSUES.shareDuplicate });
      seen.add(v);
    });
  });

const TemplateSchema = z
  .string()
  .max(SHARE_TEMPLATE_MAX, { message: SETTINGS_ISSUES.shareTemplateLong })
  .refine((t) => !TAG_LIKE.test(t), { message: SETTINGS_ISSUES.shareTemplateTags });

const TemplatesByChannel = z.object(Object.fromEntries(SHARE_CHANNELS.map((c) => [c, TemplateSchema.optional()]))).strict();

/*
 * What a visitor may share and how (#475). Public: /api/settings serves the
 * whole object, so nothing owner-only belongs here. `enabled: false` hides
 * the visitor menu. Empty templates mean the defaults in web/src/lib/share.
 */
export const SharingSettingsSchema = z
  .object({
    enabled: z.boolean(),
    surfaces: uniqueList(z.enum(SHARE_SURFACES), SHARE_SURFACES.length),
    channels: uniqueList(z.enum(SHARE_CHANNELS), SHARE_CHANNELS.length),
    utm: z
      .object({
        enabled: z.boolean(),
        source: z.string().regex(/^[a-z0-9_-]{1,40}$/i, { message: SETTINGS_ISSUES.shareSource }),
      })
      .strict(),
    templates: z.object({ en: TemplatesByChannel, he: TemplatesByChannel }).strict(),
  })
  .strict();

export const DEFAULT_SHARING: z.infer<typeof SharingSettingsSchema> = {
  enabled: true,
  surfaces: [...SHARE_SURFACES],
  channels: [...SHARE_CHANNELS],
  utm: { enabled: true, source: "share" },
  templates: { en: {}, he: {} },
};

export const SiteSettingsSchema = z
  .object({
    home: HomeSettingsSchema,
    visuals: VisualSettingsSchema,
    /* A document saved before #475 has no group: the defaults fill in. */
    sharing: SharingSettingsSchema.default(() => structuredClone(DEFAULT_SHARING)),
  })
  .strict();

export type SiteSettings = z.infer<typeof SiteSettingsSchema>;

export const DEFAULT_SETTINGS: SiteSettings = {
  home: { sections: HOME_SECTIONS.map((id) => ({ id, visible: true })) },
  visuals: { theme: "system", motion: "on", accent: "ink" },
  sharing: DEFAULT_SHARING,
};

/** Whether a section is shown, reading a missing entry as shown. */
export function sectionVisible(settings: SiteSettings, id: HomeSection): boolean {
  return settings.home.sections.find((s) => s.id === id)?.visible ?? true;
}

/** The shown sections, in order. */
export function shownSections(settings: SiteSettings): HomeSection[] {
  return settings.home.sections.filter((s) => s.visible).map((s) => s.id);
}
