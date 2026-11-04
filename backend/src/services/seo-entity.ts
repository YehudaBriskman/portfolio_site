import { absoluteUrl, type Lang } from "./seo.js";
import type { ContentBundle } from "../schemas/site-content.js";

/*
 * Who the site is by, as structured data (#308).
 *
 * One `Person` node with a stable `@id`, written in full on the pages that are
 * about the person (home, the story) and referenced by `@id` from everything
 * else (a note's author, a project's author, the WebSite's publisher). Search
 * engines join the references into one entity, which is what a knowledge
 * panel is built from: the more consistently one node is described, and the
 * more of its profiles it links to with `sameAs`, the better it is understood
 * to be one person under several spellings.
 *
 * The rules this file keeps:
 *
 *   - Every name variant is one the owner is actually known by: the Latin
 *     name, his own Hebrew spelling, the handle and the surname alone. No
 *     invented spellings and no keyword lists.
 *   - `sameAs` comes only from the profile links the site already shows (the
 *     content store's `profiles`), never from a hand-kept list here.
 *   - `knowsAbout` comes from what the site's own projects are built with,
 *     plus the fields the site says the work is in.
 *   - No employer. `worksFor` is deliberately absent, current or former.
 */

/** The name as the site displays it (the owner's choice: Latin first). */
export const NAME = "Yehuda Briskman";
/** The owner's own Hebrew spelling. */
export const NAME_HE = "יהודה בריסקמן";
/** The other names people search for him by. */
export const ALTERNATE_NAMES: readonly string[] = [NAME_HE, "yehuda.br", "Briskman"];

/**
 * The fact line under the home page's title, with the Hebrew spelling beside
 * the Latin name on a Hebrew page: "Yehuda Briskman (יהודה בריסקמן) — …".
 * The same rule as `withHebrewName` in web/src/data/identity.ts, so the
 * render and the app print one string. A line that already has the Hebrew
 * name, or does not have the Latin one, is left as it is.
 */
export function withHebrewName(text: string, lang: Lang): string {
  if (lang !== "he" || text.includes(NAME_HE) || !text.includes(NAME)) return text;
  return text.replace(NAME, `${NAME} (${NAME_HE})`);
}

/** The name a title ends with, in the page's language. */
export function siteNameIn(lang: Lang): string {
  return lang === "he" ? NAME_HE : NAME;
}

export const PERSON_ID = absoluteUrl("/#person");
export const WEBSITE_ID = absoluteUrl("/#website");
export const PORTRAIT = absoluteUrl("/img/yehuda-cut.webp");

/** A reference to the one Person, for an author or a publisher. */
export const personRef = { "@type": "Person", "@id": PERSON_ID, name: NAME } as const;

/**
 * The role, in both languages: a technical team lead, and a full-stack
 * engineer who works mostly on the frontend. Both languages on every page:
 * the entity is one person, and a Hebrew query should match it from the
 * English page as much as from the Hebrew one.
 */
const JOB_TITLE: Record<Lang, string[]> = {
  en: ["Technical team lead", "Full-stack engineer"],
  he: ["ראש צוות טכני", "מהנדס פול־סטאק"],
};

const DESCRIPTION: Record<Lang, string> = {
  en: "Technical team lead and full-stack engineer, mostly frontend, in Tel Aviv.",
  he: "ראש צוות טכני ומהנדס פול־סטאק, עם דגש על פרונטאנד, בתל אביב.",
};

/** The fields the work is in, as the site describes it. */
const FIELDS = ["Frontend development", "Full-stack development", "Technical leadership", "Web accessibility"];

/**
 * What the projects are built with, from the store's project table: each
 * `tech` entry once, version numbers dropped (`React 19` and `React` are one
 * skill), in the order they first appear.
 */
export function knowsAbout(bundle: Pick<ContentBundle, "projects">): string[] {
  const out = new Map<string, string>();
  for (const f of FIELDS) out.set(f.toLowerCase(), f);
  for (const p of [...bundle.projects.items].sort((a, b) => a.order - b.order)) {
    for (const t of p.tech) {
      const name = t.replace(/\s+v?\d+(?:\.\d+)*$/, "").trim();
      if (name && !out.has(name.toLowerCase())) out.set(name.toLowerCase(), name);
    }
  }
  return [...out.values()];
}

/** The owner's profiles, exactly as the site links them, https only. */
export function sameAs(bundle: Pick<ContentBundle, "siteCopy">): string[] {
  return [...new Set(bundle.siteCopy.profiles.map((p) => p.url).filter((u) => /^https:\/\//.test(u)))];
}

/** The Person, in full. */
export function personNode(lang: Lang, bundle: Pick<ContentBundle, "projects" | "siteCopy">) {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: NAME,
    alternateName: [...ALTERNATE_NAMES],
    givenName: "Yehuda",
    familyName: "Briskman",
    url: absoluteUrl("/"),
    image: { "@type": "ImageObject", url: PORTRAIT, width: 551, height: 845 },
    jobTitle: [...JOB_TITLE[lang], ...JOB_TITLE[lang === "en" ? "he" : "en"]],
    description: DESCRIPTION[lang],
    address: { "@type": "PostalAddress", addressLocality: lang === "he" ? "תל אביב" : "Tel Aviv", addressCountry: "IL" },
    knowsAbout: knowsAbout(bundle),
    knowsLanguage: ["he", "en"],
    sameAs: sameAs(bundle),
  };
}

/** The site itself: named for the person, under every name. */
export function websiteNode(lang: Lang) {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: absoluteUrl("/"),
    name: NAME,
    alternateName: [NAME_HE, "yehudabriskman.com"],
    inLanguage: lang,
    publisher: { "@id": PERSON_ID },
    author: { "@id": PERSON_ID },
  };
}

/**
 * A page about the person (home, the story): Google's ProfilePage, whose
 * `mainEntity` is the Person.
 */
export function profilePageNode(lang: Lang, url: string, name: string) {
  return {
    "@type": "ProfilePage",
    "@id": `${url}#page`,
    url,
    name,
    inLanguage: lang,
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: { "@id": PERSON_ID },
    about: { "@id": PERSON_ID },
  };
}
