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

export const SiteSettingsSchema = z
  .object({
    home: HomeSettingsSchema,
    visuals: VisualSettingsSchema,
  })
  .strict();

export type SiteSettings = z.infer<typeof SiteSettingsSchema>;

export const DEFAULT_SETTINGS: SiteSettings = {
  home: { sections: HOME_SECTIONS.map((id) => ({ id, visible: true })) },
  visuals: { theme: "system", motion: "on", accent: "ink" },
};

/** Whether a section is shown, reading a missing entry as shown. */
export function sectionVisible(settings: SiteSettings, id: HomeSection): boolean {
  return settings.home.sections.find((s) => s.id === id)?.visible ?? true;
}

/** The shown sections, in order. */
export function shownSections(settings: SiteSettings): HomeSection[] {
  return settings.home.sections.filter((s) => s.visible).map((s) => s.id);
}
