import { useEffect, useState } from "react";
import { blog, type Collection } from "@/services/blog";
import { projects as seeds, seedToCollection, type Project, type ProjectDecision } from "@/data/projects";

/*
 * One list of projects for the whole site.
 *
 * The landing page used to read a hardcoded table while /projects read the
 * collections API, which meant two sources of truth, two visual languages, and
 * — because no project collections exist yet — a Projects link in the nav that
 * led to an empty page. This merges them: a published collection wins on its
 * slug, a seed fills the gap, and both come out as the same object.
 *
 * `live` is the part that matters downstream. Notes, docs and repository facts
 * only exist for a real collection, so a seed-backed page must not offer them.
 */
/* Taken from the collection schema rather than restated, so the optionality
   zod infers here stays in one place. */
type ProjectLink = NonNullable<Collection["links"]>[number];

export type ProjectEntry = {
  collection: Collection;
  /** True when a published collection backs this slug. */
  live: boolean;
  /** Short state label for a chip. Two or three words. */
  state: string;
  /** The long form, for the detail page eyebrow. */
  status: string;
  year: string | null;
  tech: string[];
  highlights: string[];
  /*
   * The brief, and the decisions behind it. All optional, and absent is the
   * normal case: only the two projects with a written record of their own can
   * fill these, and a consumer must render nothing at all when they are empty
   * rather than a heading over a blank.
   */
  problem: string | null;
  role: string | null;
  outcome: string | null;
  decisions: ProjectDecision[];
  /** The live product, never the repository — that has its own pill. */
  primaryLink: ProjectLink | null;
  /** Everything in `links` that is not the primary. */
  otherLinks: ProjectLink[];
};

export type ProjectsState = "loading" | "ok" | "error";

/* Under 20 is featured. Two featured items is the whole argument; a third
   dilutes it, which is why this is a threshold and not a flag on every row. */
export const FEATURED_BELOW = 20;

function bySlug(list: Project[]) {
  return new Map(list.map((p) => [p.slug, p]));
}

/* A repository URL is not a product link — Bothy's only outbound link is its
   repo, and promoting it twice would give the page two primary actions. */
function splitLinks(c: Collection) {
  const links = c.links ?? [];
  const outbound = links.filter((l) => l.url !== c.repoUrl);
  return { primaryLink: outbound[0] ?? null, otherLinks: outbound.slice(1) };
}

function merge(collections: Collection[]): ProjectEntry[] {
  const seedMap = bySlug(seeds);
  const live = collections.filter((c) => c.kind === "project");
  const liveSlugs = new Set(live.map((c) => c.slug));

  const fallbacks = seeds.filter((p) => !liveSlugs.has(p.slug)).map(seedToCollection);

  return [...live, ...fallbacks]
    .sort(
      (a, b) =>
        a.order - b.order ||
        Date.parse(b.stats?.pushedAt ?? "") - Date.parse(a.stats?.pushedAt ?? "") ||
        a.title.localeCompare(b.title)
    )
    .map((c) => {
      const seed = seedMap.get(c.slug) ?? null;
      const release = c.stats?.latestRelease?.tag ?? null;
      return {
        collection: c,
        live: liveSlugs.has(c.slug),
        state: seed?.state ?? release ?? (c.order < FEATURED_BELOW ? "In use" : "Archive"),
        status: seed?.status ?? (c.order < FEATURED_BELOW ? "In use" : "Earlier work"),
        year: seed?.year ?? null,
        tech: seed?.tech ?? [],
        highlights: seed?.highlights ?? [],
        problem: seed?.problem ?? null,
        role: seed?.role ?? null,
        outcome: seed?.outcome ?? null,
        decisions: seed?.decisions ?? [],
        ...splitLinks(c),
      };
    });
}

/*
 * Related projects for a detail page.
 *
 * This used to be `items.slice(0, 2)` of an order-sorted list, which handed
 * every page the same two names and told the reader nothing about the one they
 * were on. Rotating from the current project's own position means each page
 * points somewhere different, and the list stays stable between visits — which
 * a random pick would not, and which matters because these are links a reader
 * may be trying to find again.
 */
export function relatedTo(items: ProjectEntry[], slug: string, count = 2): ProjectEntry[] {
  const here = items.findIndex((e) => e.collection.slug === slug);
  if (here < 0) return items.slice(0, count);
  const rotated = [...items.slice(here + 1), ...items.slice(0, here)];
  return rotated.slice(0, count);
}

export function useProjects() {
  /*
   * Seeded, never empty. The seed table is the floor under this hook, so
   * `items.length === 0` is not a state the UI has to carry — there is no
   * skeleton grid and no empty state downstream, because neither could ever be
   * reached. `state` still reports "loading" so the live repository facts can
   * arrive late without the page having been blank in the meantime.
   */
  const [items, setItems] = useState<ProjectEntry[]>(() => merge([]));
  const [state, setState] = useState<ProjectsState>("loading");

  useEffect(() => {
    let alive = true;
    blog
      .collections()
      .then((cols) => {
        if (!alive) return;
        setItems(merge(cols));
        setState("ok");
      })
      .catch(() => {
        // The seeds are already in state, so a dead API degrades to a stale but
        // complete page rather than to an empty one.
        if (alive) setState("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  return {
    items,
    state,
    featured: items.filter((e) => e.collection.order < FEATURED_BELOW),
    archive: items.filter((e) => e.collection.order >= FEATURED_BELOW),
  };
}
