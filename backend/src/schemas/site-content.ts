import { z } from "zod";
import { Fingerprint } from "./i18n.js";
import { SlugSchema } from "./content.js";

/*
 * The site's own content, as stored (#163).
 *
 * Until #163 every word on /, /story and /projects was a constant in
 * `web/src/data/*.ts`, and changing one was a deploy. These schemas are the
 * shape that content takes in the store, one per editable type:
 *
 *   projects    the project table: every field a project page prints
 *   story       the hand-written beats of /story, and how each beat sits
 *   site-copy   the hero, "How I work", the contact copy and the footer
 *
 * Each is one CouchDB document (`content:<key>`) holding the published
 * version and, while the owner is working on it, a draft beside it.
 *
 * WHAT IS BILINGUAL
 * -----------------
 * Prose is `Text`: English, which is required, and Hebrew, which is optional
 * and falls back to the English when absent, which is what every Hebrew page
 * shows today. Names (a project's title, a tool, a `where` store) stay one
 * string. Link labels are prose and are `Text` (#306); a document saved before
 * that holds a plain string, which `textOrString` reads as `{ en }`. The state
 * chip is a KEY (`in-use`, `archive`, see STATE_KEYS), translated where it is
 * shown; a label saved before #306 ("In use") is read as its key, and a
 * release tag (`v1.2.0`) stays as it is.
 *
 * WHAT THE BUILD USED TO GUARANTEE
 * --------------------------------
 * `buildStory()` threw on a project with no story line, on a picture or a
 * layout filed under a beat that does not exist, and on an interlude that
 * follows nothing or is missing a language. Those checks now run on save, in
 * `checkContent` below, against the other two documents as they will be once
 * the save lands, so the store can never hold a combination the site would
 * have refused to build.
 */

export const CONTENT_KEYS = ["projects", "story", "site-copy"] as const;
export type ContentKey = (typeof CONTENT_KEYS)[number];
export const ContentKeySchema = z.enum(CONTENT_KEYS);

/** English required, Hebrew optional; an empty Hebrew string is absent. */
export const text = (max: number) =>
  z.object({
    en: z.string().trim().min(1, "English is required").max(max, `At most ${max} characters`),
    he: z
      .string()
      .trim()
      .max(max, `At most ${max} characters`)
      .transform((v) => (v ? v : undefined))
      .optional(),
    /*
     * The fingerprint of the English the Hebrew was written against (#303).
     * Accepted so a round trip through the admin keeps it, but never trusted:
     * the save routes restamp it (schemas/i18n.ts `stampTexts`), and the public
     * reads drop it. Absent on Hebrew written before #303: "unverified".
     */
    heSrc: Fingerprint.optional(),
  });

export type Text = z.infer<ReturnType<typeof text>>;

/**
 * A field that became `Text` in #306. A document saved before it holds a
 * plain string, read as English: the read shim of design §4.2/§4.3. Every save
 * writes the new shape.
 */
export const textOrString = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? { en: v } : v), text(max));

/*
 * The state chip's keys (#306). The site shows a word per language for each
 * (web/src/components/work/words.ts `stateWord`). `archive` is the one the
 * site reads: a project in it is not counted as live. A release tag
 * (`v1.2.0`) is a name and stays as written.
 */
export const STATE_KEYS = ["live", "in-use", "open-source", "in-progress", "released", "archive"] as const;
export type StateKey = (typeof STATE_KEYS)[number];

/** A stored state, as its key when it is one: "In use" and "in-use" are both `in-use`. */
export function stateKey(value: string): string {
  const k = value.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (k === "archived") return "archive";
  return (STATE_KEYS as readonly string[]).includes(k) ? k : value.trim();
}

const StateSchema = z.string().trim().min(1, "A state is required").max(30).transform(stateKey);

/*
 * Images stay URL strings until the media library (#253): a path under the
 * site's own public folder, or an https URL.
 */
export const ImageRefSchema = z
  .string()
  .trim()
  .max(500)
  .regex(/^(\/[^\s]*|https:\/\/\S+)$/, "A path starting with / or an https:// URL");

const Url = z.string().trim().url("A full URL, with https://").max(500);
const Byte = z.number().int().min(0, "0 to 255").max(255, "0 to 255");

export const FIELD_KINDS = ["state", "tech", "where", "when", "count"] as const;

export const ProjectSchema = z.object({
  /** Must match the area slug, or the area's notes will not attach. */
  slug: SlugSchema,
  title: z.string().trim().min(1, "A title is required").max(120),
  /** One line of fact. What the thing is, not why it is good. */
  fact: text(160),
  /** The label's field line: one to three, most identifying first. */
  fields: z
    .array(
      z
        .object({ kind: z.enum(FIELD_KINDS), value: z.string().trim().min(1, "A value is required").max(40) })
        /* A state field holds the same key as the chip. */
        .transform((f) => (f.kind === "state" ? { ...f, value: stateKey(f.value) } : f)),
    )
    .min(1, "At least one field")
    .max(3, "At most three fields"),
  description: text(600),
  tech: z.array(z.string().trim().min(1).max(40)).max(20),
  image: ImageRefSchema.nullable().default(null),
  /** The colour the work itself is, as an sRGB triple. */
  tint: z.tuple([Byte, Byte, Byte]),
  link: Url.nullable().default(null),
  linkLabel: z.string().trim().max(60).nullable().default(null),
  links: z.array(z.object({ label: textOrString(60), url: Url })).max(8).default([]),
  github: Url.nullable().default(null),
  year: z.string().regex(/^\d{4}$/, "A four-digit year"),
  /** The long form, for the detail page. */
  status: text(120),
  /** The chip, a key (STATE_KEYS) or a release tag. `archive` marks a project that is not counted as live. */
  state: StateSchema,
  highlights: z.array(text(240)).max(8).default([]),
  problem: text(1500).nullable().default(null),
  role: text(1500).nullable().default(null),
  outcome: text(1500).nullable().default(null),
  decisions: z.array(z.object({ title: text(240), body: text(2000) })).max(8).default([]),
  /** Ascending. Under 20 is featured; everything else is the archive. */
  order: z.number().int().min(0).max(999),
  /** The one sentence /story adds after the project's fact. */
  storyLine: text(240),
});

export const ProjectsContentSchema = z
  .object({ items: z.array(ProjectSchema).min(1, "At least one project").max(60) })
  .superRefine((v, ctx) => {
    const seen = new Map<string, number>();
    v.items.forEach((p, i) => {
      const first = seen.get(p.slug);
      if (first !== undefined) {
        ctx.addIssue({ code: "custom", path: ["items", i, "slug"], message: `Already used by project ${first + 1}` });
      } else seen.set(p.slug, i);
    });
  });

export const BEAT_LAYOUTS = ["beside", "under", "overlap"] as const;

const Lines = z.array(text(400)).min(1, "At least one line").max(6);

export const StoryContentSchema = z
  .object({
    /** The first beat; its year is the hero's `shippingSince`. */
    start: z.object({ title: text(80), lines: Lines }),
    /** The role beats, in order, after the projects. */
    roles: z
      .array(z.object({ id: SlugSchema, when: text(24), title: text(80), lines: Lines }))
      .max(12),
    /** Keyed by beat id; a beat not named is `beside`. */
    layouts: z.record(z.string(), z.enum(BEAT_LAYOUTS)).default({}),
    /** Keyed by beat id. */
    images: z.record(z.string(), z.object({ src: ImageRefSchema, alt: text(240) })).default({}),
    /** Moments between beats; each names the beat it follows. */
    interludes: z
      .array(
        z.object({
          id: SlugSchema,
          after: z.string().min(1),
          /* Both languages are required here, as buildStory required them:
             both are in the DOM and the stylesheet shows one. */
          words: z.object({
            en: z.string().trim().min(1, "English is required").max(120),
            he: z.string().trim().min(1, "Hebrew is required here").max(120),
          }),
        }),
      )
      .max(12),
  })
  .superRefine((v, ctx) => {
    const ids = new Set<string>();
    v.roles.forEach((r, i) => {
      if (ids.has(r.id)) ctx.addIssue({ code: "custom", path: ["roles", i, "id"], message: "Two roles share this id" });
      ids.add(r.id);
    });
    const loops = new Set<string>();
    v.interludes.forEach((l, i) => {
      if (loops.has(l.id)) ctx.addIssue({ code: "custom", path: ["interludes", i, "id"], message: "Two interludes share this id" });
      loops.add(l.id);
    });
  });

const Profile = z.object({
  /** Lowercase key; the footer prints it capitalised. */
  name: z.string().trim().regex(/^[a-z0-9-]+$/, "Lowercase letters, digits and hyphens").max(30),
  url: Url,
  icon: z.enum(["Github", "Linkedin"]),
  /** What a screen reader reads, spelled the way the company spells it. */
  label: z.string().trim().min(1).max(40),
});

export const SiteCopySchema = z.object({
  hero: z.object({
    /** The owner's name, written once. */
    name: z.string().trim().min(1).max(80),
    /** The plate's first field. */
    where: text(40),
    /** The first year there was shipped work to point at; the story starts here. */
    shippingSince: z.number().int().min(1990).max(2100),
    /** The plate's h1. */
    title: text(40),
    /** The plate's fact line. */
    fact: text(160),
    /** The phrases in the hero's end corner; the first stands alone when motion is off. */
    phrases: z.array(text(24)).min(1, "At least one phrase").max(8),
  }),
  about: z.object({
    heading: text(60),
    intro: z.array(z.object({ label: text(40), lines: Lines })).min(1).max(8),
    principles: z.array(z.object({ claim: text(80), lines: Lines })).max(8),
  }),
  contact: z.object({
    email: z.string().trim().email("An email address"),
    location: text(80),
    availability: text(120),
    replyWithin: text(60),
  }),
  /** GitHub and LinkedIn: the nav, the contact plate and the footer. */
  profiles: z.array(Profile).max(4),
  footer: z.object({
    work: z.array(z.object({ label: textOrString(40), url: Url, note: text(40) })).max(6),
    colophon: text(400),
    colophonNote: text(200),
    place: text(60),
  }),
});

export type Project = z.infer<typeof ProjectSchema>;
export type ProjectsContent = z.infer<typeof ProjectsContentSchema>;
export type StoryContent = z.infer<typeof StoryContentSchema>;
export type SiteCopy = z.infer<typeof SiteCopySchema>;

export type ContentBundle = { projects: ProjectsContent; story: StoryContent; siteCopy: SiteCopy };

export const CONTENT_SCHEMAS = {
  projects: ProjectsContentSchema,
  story: StoryContentSchema,
  "site-copy": SiteCopySchema,
} as const;

/** The bundle property each key fills. */
export const BUNDLE_FIELD: Record<ContentKey, keyof ContentBundle> = {
  projects: "projects",
  story: "story",
  "site-copy": "siteCopy",
};

/** The stored document: what is live, and the owner's draft beside it. */
export type ContentDoc<T = unknown> = {
  _id: string;
  _rev?: string;
  type: "content";
  key: ContentKey;
  published: T;
  draft: T | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  /** Who wrote the published version: the seed, or the owner. */
  source: "seed" | "admin";
};

export type Issue = { path: string; message: string };

/** zod's issues as `items.0.fact.en: message` pairs the editor can place. */
export function toIssues(error: z.ZodError): Issue[] {
  return error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message }));
}

/** The beat ids /story will have, in order. Mirrors web/src/data/story.ts. */
export function beatIds(bundle: ContentBundle): string[] {
  const ordered = [...bundle.projects.items].sort((a, b) => Number(a.year) - Number(b.year) || a.order - b.order);
  return [
    `start-${bundle.siteCopy.hero.shippingSince}`,
    ...ordered.map((p) => p.slug),
    ...bundle.story.roles.map((r) => r.id),
  ];
}

/*
 * The guarantees `buildStory()` gave at build time, now given on save.
 *
 * Run against the bundle as it will be once the save lands, and the issues
 * are filed under the document being saved (`key`) where they can be: a
 * project removed while the story still places a picture on it is reported on
 * the project table, because that is the save that would break the page, and
 * the message says where the other half is.
 *
 * Every project carries its own story line (`storyLine`), so "a project with
 * no line" and "a line for a project that is gone" — the first two throws —
 * cannot happen by construction; the schema requiring the line is the check.
 */
export function checkContent(bundle: ContentBundle, key: ContentKey): Issue[] {
  const issues: Issue[] = [];
  const ids = beatIds(bundle);
  const set = new Set(ids);
  const where = (storyPath: string) => (key === "story" ? storyPath : "");
  const note = key === "story" ? "" : " (edit the story first)";

  if (set.size !== ids.length) {
    const dup = ids.find((id, i) => ids.indexOf(id) !== i);
    issues.push({ path: key === "story" ? "roles" : "", message: `Two beats share the id "${dup}": a role id may not be a project slug${note}` });
  }
  for (const id of Object.keys(bundle.story.layouts)) {
    if (!set.has(id)) issues.push({ path: where(`layouts.${id}`), message: `The story sets a layout for "${id}", which is not a beat${note}` });
  }
  for (const id of Object.keys(bundle.story.images)) {
    if (!set.has(id)) issues.push({ path: where(`images.${id}`), message: `The story has a picture for "${id}", which is not a beat${note}` });
  }
  bundle.story.interludes.forEach((l, i) => {
    if (!set.has(l.after)) {
      issues.push({ path: where(`interludes.${i}.after`), message: `Interlude "${l.id}" follows "${l.after}", which is not a beat${note}` });
    }
  });
  return issues;
}
