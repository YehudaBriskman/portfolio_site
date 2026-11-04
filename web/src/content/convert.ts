import type { LabelField } from "@/components/gallery/objectLabel";
import type { Lang } from "@/components/dashboard/i18n";
import { links as seedLinks, type SocialLink } from "@/data/links";
import { projects as seedProjects, type Project } from "@/data/projects";
import { about, contact, footer, heroHebrew, heroPhrases, plate, plateTitle, type ApproachPrinciple, type ApproachSection } from "@/data/site";
import { PROJECTS_HE, SITE_HE, STORY_HE } from "@/data/hebrew";
import { IMAGES, INTERLUDES, LAYOUTS, LINES, ROLES, START, type BeatLayout, type Interlude, type StoryHand, type StoryImage } from "@/data/story";
import { ltrFallback } from "@/i18n/words";
import { stateKey, type ContentBundle, type Project as StoreProject, type Text } from "./schema";

/*
 * The two directions between the content store and the site (#163).
 *
 * `seedBundle()` is the store's shape built from `data/*.ts`. It is the
 * offline fallback the site renders before, or without, the API, and it is
 * what the backend seeds the store with: `backend/src/content/seed.ts` is this
 * function's output, written out and held to it by a test, so the store's
 * first state and the fallback are the same bytes.
 *
 * `localize()` is the other way: the store's bilingual shape flattened into
 * the types the components already read, in one language. Hebrew falls back
 * to English per field, which is what every Hebrew page shows today.
 */

const t = (en: string): Text => ({ en });
/** English with the Hebrew the owner approved, where there is one. */
const tt = (en: string, he: string | undefined): Text => (he ? { en, he } : { en });

function projectToStore(p: Project): StoreProject {
  /* The Hebrew beside it (data/hebrew.ts), by slug; arrays by position. */
  const he = PROJECTS_HE[p.slug];
  return {
    slug: p.slug,
    title: p.title,
    fact: tt(p.fact, he?.fact),
    fields: p.fields.map((f) => ({ kind: f.kind as StoreProject["fields"][number]["kind"], value: f.kind === "state" ? stateKey(f.value) : f.value })),
    description: tt(p.description, he?.description),
    tech: [...p.tech],
    image: p.image ?? null,
    tint: [p.tint[0], p.tint[1], p.tint[2]],
    link: p.link ?? null,
    linkLabel: p.linkLabel ?? null,
    links: (p.links ?? []).map((l, i) => ({ label: tt(l.label, he?.links?.[i]), url: l.url })),
    github: p.github ?? null,
    year: p.year,
    status: tt(p.status, he?.status),
    state: stateKey(p.state),
    highlights: p.highlights.map((h, i) => tt(h, he?.highlights[i])),
    problem: p.problem ? tt(p.problem, he?.problem) : null,
    role: p.role ? tt(p.role, he?.role) : null,
    outcome: p.outcome ? tt(p.outcome, he?.outcome) : null,
    decisions: (p.decisions ?? []).map((d, i) => ({
      title: tt(d.title, he?.decisions?.[i]?.title),
      body: tt(d.body, he?.decisions?.[i]?.body),
    })),
    order: p.order,
    storyLine: tt(LINES[p.slug] ?? "", he?.storyLine),
  };
}

/** The store's content, built from the data files. */
export function seedBundle(): ContentBundle {
  return {
    projects: { items: seedProjects.map(projectToStore) },
    story: {
      start: { title: tt(START.title, STORY_HE.start.title), lines: START.lines.map((l, i) => tt(l, STORY_HE.start.lines[i])) },
      roles: ROLES.map((r) => {
        const he = STORY_HE.roles[r.id];
        return { id: r.id, when: tt(r.when, he?.when), title: tt(r.title, he?.title), lines: r.lines.map((l, i) => tt(l, he?.lines[i])) };
      }),
      layouts: { ...LAYOUTS },
      images: Object.fromEntries(Object.entries(IMAGES).map(([id, img]) => [id, { src: img.src, alt: t(img.alt) }])),
      interludes: INTERLUDES.map((i) => ({ id: i.id, after: i.after, words: { en: i.words.en, he: i.words.he } })),
    },
    siteCopy: {
      hero: {
        name: plate.name,
        where: tt(plate.where, heroHebrew.where),
        shippingSince: plate.shippingSince,
        title: t(plateTitle.name),
        fact: tt(plateTitle.fact, heroHebrew.fact),
        phrases: heroPhrases.map((p) => tt(p, heroHebrew.phrases[p] ?? SITE_HE.phrases[p])),
      },
      about: {
        heading: tt(about.heading, heroHebrew.aboutHeading),
        intro: about.intro.map((s, i) => ({
          label: tt(s.label, SITE_HE.intro[i]?.label),
          lines: s.lines.map((l, j) => tt(l, SITE_HE.intro[i]?.lines[j])),
        })),
        principles: about.principles.map((p, i) => ({
          claim: tt(p.claim, SITE_HE.principles[i]?.claim),
          lines: p.lines.map((l, j) => tt(l, SITE_HE.principles[i]?.lines[j])),
        })),
      },
      contact: {
        email: contact.email,
        location: tt(contact.location, SITE_HE.location),
        availability: tt(contact.availability, SITE_HE.availability),
        replyWithin: tt(contact.replyWithin, heroHebrew.replyWithin),
      },
      profiles: seedLinks.map((l) => ({ name: l.name, url: l.url, icon: l.icon, label: l.label })),
      footer: {
        work: footer.work.map((w, i) => ({ label: t(w.label), url: w.url, note: tt(w.note, SITE_HE.workNotes[i]) })),
        colophon: tt(footer.colophon, SITE_HE.colophon),
        colophonNote: tt(footer.colophonNote, SITE_HE.colophonNote),
        place: tt(footer.place, SITE_HE.place),
      },
    },
  };
}

/* ------------------------------------------------------------- localize -- */

export type SiteCopyView = {
  plate: { name: string; where: string; shippingSince: number };
  plateTitle: { name: string; fact: string };
  heroPhrases: string[];
  about: { heading: string; intro: ApproachSection[]; principles: ApproachPrinciple[] };
  contact: { email: string; location: string; availability: string; replyWithin: string };
  links: SocialLink[];
  footer: { work: { label: string; url: string; note: string }[]; colophon: string; colophonNote: string; place: string };
};

export type StoryView = {
  lines: Record<string, string>;
  images: Record<string, StoryImage>;
  interludes: Interlude[];
  layouts: Record<string, BeatLayout>;
  hand: StoryHand;
};

export type ContentView = { projects: Project[]; story: StoryView; site: SiteCopyView };

/*
 * The one place a missing Hebrew becomes its English. That English is wrapped
 * in a left-to-right isolate (`ltrFallback`), so it reads left to right on a
 * Hebrew page on every surface it reaches, not only those that spread
 * `inEnglish` on their element.
 */
const pick = (lang: Lang) => (x: Text) => (lang !== "he" ? x.en : x.he ? x.he : ltrFallback(x.en));

/*
 * Absent and empty are written back as absent, the way the data files write
 * them, so a project read from the store is the same object the table held
 * and nothing downstream can tell which it came from.
 */
function projectFromStore(p: StoreProject, tx: (x: Text) => string): Project {
  const out: Project = {
    slug: p.slug,
    title: p.title,
    fact: tx(p.fact),
    fields: p.fields.map((f): LabelField => ({ kind: f.kind, value: f.value })),
    description: tx(p.description),
    tech: [...p.tech],
    tint: [p.tint[0], p.tint[1], p.tint[2]],
    year: p.year,
    status: tx(p.status),
    state: p.state,
    highlights: p.highlights.map(tx),
    order: p.order,
  };
  if (p.image) out.image = p.image;
  if (p.link) out.link = p.link;
  if (p.linkLabel) out.linkLabel = p.linkLabel;
  if (p.links.length > 0) out.links = p.links.map((l) => ({ label: tx(l.label), url: l.url }));
  if (p.github) out.github = p.github;
  if (p.problem) out.problem = tx(p.problem);
  if (p.role) out.role = tx(p.role);
  if (p.outcome) out.outcome = tx(p.outcome);
  if (p.decisions.length > 0) out.decisions = p.decisions.map((d) => ({ title: tx(d.title), body: tx(d.body) }));
  return out;
}

/** The store's bundle, in one language, in the shapes the components read. */
export function localize(bundle: ContentBundle, lang: Lang): ContentView {
  const tx = pick(lang);
  const { projects, story, siteCopy: s } = bundle;
  return {
    projects: projects.items.map((p) => projectFromStore(p, tx)),
    story: {
      lines: Object.fromEntries(projects.items.map((p) => [p.slug, tx(p.storyLine)])),
      images: Object.fromEntries(Object.entries(story.images).map(([id, img]) => [id, { src: img.src, alt: tx(img.alt) }])),
      interludes: story.interludes.map((i) => ({ id: i.id, after: i.after, words: { en: i.words.en, he: i.words.he } })),
      layouts: { ...story.layouts },
      hand: {
        start: { title: tx(story.start.title), lines: story.start.lines.map(tx) },
        roles: story.roles.map((r) => ({ id: r.id, when: tx(r.when), title: tx(r.title), lines: r.lines.map(tx) })),
        shippingSince: s.hero.shippingSince,
      },
    },
    site: {
      plate: { name: s.hero.name, where: tx(s.hero.where), shippingSince: s.hero.shippingSince },
      plateTitle: { name: tx(s.hero.title), fact: tx(s.hero.fact) },
      heroPhrases: s.hero.phrases.map(tx),
      about: {
        heading: tx(s.about.heading),
        intro: s.about.intro.map((x) => ({ label: tx(x.label), lines: x.lines.map(tx) })),
        principles: s.about.principles.map((x) => ({ claim: tx(x.claim), lines: x.lines.map(tx) })),
      },
      contact: {
        email: s.contact.email,
        location: tx(s.contact.location),
        availability: tx(s.contact.availability),
        replyWithin: tx(s.contact.replyWithin),
      },
      links: s.profiles.map((p) => ({ name: p.name, url: p.url, icon: p.icon, label: p.label })),
      footer: {
        work: s.footer.work.map((w) => ({ label: tx(w.label), url: w.url, note: tx(w.note) })),
        colophon: tx(s.footer.colophon),
        colophonNote: tx(s.footer.colophonNote),
        place: tx(s.footer.place),
      },
    },
  };
}
