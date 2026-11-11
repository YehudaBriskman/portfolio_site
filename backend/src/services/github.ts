import type { Collection, SiteRelease, SiteReleases } from "../schemas/content.js";
import { env } from "../env.js";
import { announceNewReleases } from "../announce/hooks.js";

/*
 * Reads public repository facts from GitHub.
 *
 * Runs on a schedule on the server, never during a request. A page load must
 * not depend on GitHub being up or on our rate-limit budget, and a number that
 * is a few minutes stale is better than a spinner or a blank card.
 *
 * Unauthenticated is 60 requests an hour, which is ample: two calls per project
 * every fifteen minutes. GITHUB_TOKEN raises it to 5000 if that ever changes.
 */
const UA = { "User-Agent": "yehudabriskman.com", Accept: "application/vnd.github+json" };

/* Through `env` rather than `process.env`, so the one variable two services
   now read is declared and validated in one place. `services/contributions.ts`
   has no choice about it — GraphQL refuses anonymous requests outright — and a
   token that is set for one of them and not the other would be the kind of
   half-configured deploy the schema exists to make visible. */
function headers() {
  const t = env.GITHUB_TOKEN;
  return t ? { ...UA, Authorization: `Bearer ${t}` } : UA;
}

async function get<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: headers(), signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type RepoResponse = {
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  license: { spdx_id: string | null } | null;
  pushed_at: string;
};

type ReleaseResponse = { tag_name: string; html_url: string; published_at: string | null };

export async function fetchRepoStats(repo: NonNullable<Collection["repo"]>) {
  const base = `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`;
  const info = await get<RepoResponse>(base);
  if (!info) {
    return {
      stars: null, forks: null, openIssues: null, language: null, license: null,
      pushedAt: null, latestRelease: null,
      fetchedAt: new Date().toISOString(),
      error: "Could not reach GitHub, or the repository is not public.",
    };
  }
  const rel = await get<ReleaseResponse>(`${base}/releases/latest`);
  return {
    stars: info.stargazers_count,
    forks: info.forks_count,
    openIssues: info.open_issues_count,
    language: info.language,
    license: info.license?.spdx_id ?? null,
    pushedAt: info.pushed_at,
    latestRelease: rel ? { tag: rel.tag_name, url: rel.html_url, publishedAt: rel.published_at } : null,
    fetchedAt: new Date().toISOString(),
    error: null,
  };
}

type ReleaseListItem = ReleaseResponse & { name: string | null; draft: boolean; prerelease: boolean };

/** Only `v*` tags count as site releases; drafts and prereleases never do. */
export function pickSiteReleases(list: ReleaseListItem[]): SiteRelease[] {
  return list
    .filter((r) => !r.draft && !r.prerelease && r.published_at && /^v/.test(r.tag_name))
    .map((r) => ({ tag: r.tag_name, name: r.name || null, url: r.html_url, publishedAt: r.published_at! }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 50);
}

/*
 * This site's own releases, as the stored document the activity feed reads.
 *
 * `previous` is the last stored list: a failed fetch keeps it and records the
 * failure, so an outage at GitHub shows stale releases rather than none.
 */
export async function fetchSiteReleases(
  repo: { owner: string; name: string },
  previous: SiteReleases | null,
): Promise<SiteReleases> {
  const url = `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/releases?per_page=50`;
  const list = await get<ReleaseListItem[]>(url);
  const base = {
    _id: "site-releases" as const,
    ...(previous?._rev ? { _rev: previous._rev } : {}),
    type: "site-releases" as const,
    repo: { owner: repo.owner, name: repo.name },
    fetchedAt: new Date().toISOString(),
  };
  if (!Array.isArray(list)) {
    return { ...base, items: previous?.items ?? [], error: "Could not reach GitHub, or the repository is not public." };
  }
  return { ...base, items: pickSiteReleases(list), error: null };
}

/*
 * Periodic refresh. One replica runs the API, so an in-process timer is enough
 * and avoids a CronJob that would need its own credentials to call back in.
 * Failures are stored on the project rather than thrown: a project whose repo
 * went private should show a stale number and an explanation, not break a page.
 */
export function startStatsRefresh(opts: {
  list: () => Promise<Collection[]>;
  save: (c: Collection) => Promise<void>;
  /* The site's own releases, refreshed on the same tick. Optional so a caller
     that only wants the area stats does not have to provide a store for them. */
  siteReleases?: {
    repo: { owner: string; name: string };
    load: () => Promise<SiteReleases | null>;
    save: (doc: SiteReleases) => Promise<void>;
  };
  everyMs?: number;
}) {
  const every = opts.everyMs ?? 15 * 60 * 1000;
  const run = async () => {
    let cols: Collection[] = [];
    try {
      cols = await opts.list();
    } catch {
      // Deliberately swallowed: a failed refresh must never take the API down.
    }
    for (const c of cols) {
      if (!c.repo) continue;
      // Per area: one failed save (a 409 because an admin edited it meanwhile)
      // must not skip every area after it for the rest of the cycle.
      try {
        const stats = await fetchRepoStats(c.repo);
        await opts.save({ ...c, stats });
      } catch {
        // Same reasoning as above.
      }
    }
    // Separately guarded, so a failure in one never starves the other.
    if (opts.siteReleases) {
      try {
        const sr = opts.siteReleases;
        const doc = await fetchSiteReleases(sr.repo, await sr.load());
        await sr.save(doc);
        await announceNewReleases(doc);
      } catch {
        // Same reasoning as above.
      }
    }
  };
  // Wait a little on boot so a restart does not race the database coming up.
  setTimeout(run, 20_000);
  const t = setInterval(run, every);
  t.unref?.();
  return () => clearInterval(t);
}
