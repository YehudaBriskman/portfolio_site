import { z } from "zod";
import { env } from "../env.js";

/*
 * The contribution year: one day, one count, 365 times.
 *
 * Separate from github.ts because this is GraphQL (a POST, a query, errors
 * inside a 200), not REST. Cached in-process, not in CouchDB: the year belongs to
 * no content document and is stale after a day, and that is sound only because
 * one replica runs the API. The token stays on the server; the browser gets a
 * flat array. Not scraped from the profile SVG: that surface is undocumented.
 */

/** One real day. Nothing derived, nothing filled in. */
export type ContributionDay = {
  /** `YYYY-MM-DD`, as GitHub reports it. */
  date: string;
  count: number;
};

/**
 * What the route serves, in both outcomes.
 *
 * `error` is a string the page may print and `days` is empty whenever it is
 * set, which is the whole of the failure design: there is no shape in which
 * this type carries a partial or a guessed year. A caller that renders `days`
 * and `error` is correct by construction, and the one thing it must never do
 * is substitute numbers of its own.
 */
export type ContributionYear = {
  /** First day of the window, or null when there is no window to report. */
  from: string | null;
  /** Last day of the window — GitHub's calendar ends today. */
  to: string | null;
  /** GitHub's own total for the window, which is authoritative over any sum. */
  total: number | null;
  days: ContributionDay[];
  fetchedAt: string;
  error: string | null;
};

/* No `from`/`to`: the default is the trailing year ending now, as on a profile page. */
const CONTRIBUTIONS_QUERY = `query ContributionYear($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
    }
  }
}`;

/*
 * The response is parsed, not cast: a null `weeks` or a string count would
 * otherwise reach the browser as NaN. `user` is nullable and `errors` sits
 * beside `data` because GraphQL reports failures inside a 200.
 */
const DaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contributionCount: z.number().int().min(0),
});

const CalendarSchema = z.object({
  totalContributions: z.number().int().min(0),
  weeks: z.array(z.object({ contributionDays: z.array(DaySchema) })),
});

const ResponseSchema = z.object({
  data: z
    .object({
      user: z
        .object({
          contributionsCollection: z.object({ contributionCalendar: CalendarSchema }),
        })
        .nullable(),
    })
    .nullable()
    .optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

const ENDPOINT = "https://api.github.com/graphql";
const TIMEOUT_MS = 8000;

/** Every failure prints this. The reason is logged; the page gets one line. */
const UNAVAILABLE = "The contribution year could not be read from GitHub.";

function unavailable(reason: string): ContributionYear {
  /*
   * Logged at the server and generalised for the page, deliberately. "Bad
   * credentials" and "user not found" are both useful to whoever deploys this
   * and neither is any of a visitor's business; one line that is true in every
   * failure mode is also one line a designer can lay out.
   */
  console.warn("[contributions]", reason);
  return {
    from: null,
    to: null,
    total: null,
    days: [],
    fetchedAt: new Date().toISOString(),
    error: UNAVAILABLE,
  };
}

/**
 * Reads the trailing contribution year for one login.
 *
 * Never throws and never returns a partial year: every outcome is a
 * `ContributionYear`, and the ones that failed say so in `error` and carry no
 * days at all.
 */
export async function fetchContributionYear(login: string): Promise<ContributionYear> {
  /*
   * The GraphQL endpoint is authenticated-only — there is no anonymous mode to
   * fall back to, unlike the REST calls in github.ts. A deploy with no token is
   * therefore a legitimate, permanent unavailable rather than an error, and it
   * is checked first so the common misconfiguration costs no request.
   */
  const token = env.GITHUB_TOKEN;
  if (!token) return unavailable("GITHUB_TOKEN is not set; the GraphQL API has no anonymous mode.");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "User-Agent": "yehudabriskman.com",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: CONTRIBUTIONS_QUERY, variables: { login } }),
      signal: ctrl.signal,
    });
    if (!res.ok) return unavailable(`GitHub answered ${res.status}.`);

    const parsed = ResponseSchema.safeParse(await res.json());
    if (!parsed.success) return unavailable(`Unexpected payload: ${parsed.error.message}`);
    /* A GraphQL error arrives with a 200 and a populated `errors`, so this is
       the check the status code does not do. */
    if (parsed.data.errors?.length) {
      return unavailable(`GraphQL error: ${parsed.data.errors.map((e) => e.message).join("; ")}`);
    }
    const user = parsed.data.data?.user;
    if (!user) return unavailable(`No such user: ${login}.`);

    const calendar = user.contributionsCollection.contributionCalendar;
    const days = calendar.weeks.flatMap((w) =>
      w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })),
    );
    /* An empty calendar is not a failure — a brand-new account has one — but it
       is also not a year, and the page's honest-empty state is the right
       drawing for it. Reported as unavailable rather than as 365 noughts,
       because 365 noughts is a claim and this is an absence. */
    if (days.length === 0) return unavailable(`Empty calendar for ${login}.`);

    return {
      from: days[0].date,
      to: days[days.length - 1].date,
      /* GitHub's own total, not a sum of the array. They agree today; if they
         ever disagree the authoritative one is the one the profile prints. */
      total: calendar.totalContributions,
      days,
      fetchedAt: new Date().toISOString(),
      error: null,
    };
  } catch (err) {
    return unavailable(err instanceof Error ? err.message : "Could not reach GitHub.");
  } finally {
    clearTimeout(timer);
  }
}

/*
 * The cache, and the two things it has to get right.
 *
 * A request must never wait on GitHub — that is the rule github.ts opens with —
 * so the served value is whatever the last refresh left here. But the first
 * request after a boot would then be served an unavailable year for twenty
 * seconds, and in development, where nothing has booted long enough for a timer
 * to fire, it would be served one forever. So a cold cache fills itself on
 * first read, and `inFlight` is what stops a burst of first requests becoming a
 * burst of GraphQL calls.
 *
 * Nothing here is a stampede guard for a *warm* cache on purpose: once there is
 * a year in hand, a reader is served it immediately and the timer is the only
 * thing that ever replaces it. Stale by half an hour is the designed behaviour,
 * not a degradation.
 */
let cached: ContributionYear | null = null;
let cachedAt = 0;
let inFlight: Promise<ContributionYear> | null = null;

const REFRESH_MS = 30 * 60 * 1000;
// An errored year is retried by readers after this long, not held for a tick.
const ERROR_RETRY_MS = 30 * 1000;

async function refresh(login: string): Promise<ContributionYear> {
  const year = await fetchContributionYear(login);
  /*
   * A failed refresh does not overwrite a good year. The contract this keeps is
   * the one the whole file is for: a GitHub outage must cost the reader
   * staleness, not the chart. The failure does replace a previous *failure*, so
   * `fetchedAt` keeps moving and a permanent misconfiguration still reads as
   * one rather than as a frozen moment.
   */
  if (year.error && cached && !cached.error) return cached;
  cached = year;
  cachedAt = Date.now();
  return year;
}

/** The value the route serves. Fills a cold cache once; never blocks twice. */
export async function getContributionYear(
  login: string = env.GITHUB_LOGIN,
): Promise<ContributionYear> {
  if (cached && (!cached.error || Date.now() - cachedAt < ERROR_RETRY_MS)) return cached;
  inFlight ??= refresh(login).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Periodic refresh, in the shape `startStatsRefresh` established.
 *
 * Boot is deliberately not awaited: nothing on the server needs the year to
 * exist before it starts listening, and the first reader fills the cache
 * anyway. The interval is half an hour because a contribution calendar changes
 * a handful of times a day at most, and every call spends from the same
 * rate-limit budget the repository stats are already drawing on.
 */
export function startContributionsRefresh(opts: { login?: string; everyMs?: number } = {}) {
  const login = opts.login ?? env.GITHUB_LOGIN;
  const every = opts.everyMs ?? REFRESH_MS;
  const run = () => {
    void refresh(login).catch(() => {
      /* Deliberately swallowed: `refresh` already resolves to an unavailable
         year rather than rejecting, so reaching here means a bug in this file
         and not a GitHub outage — and neither should take the API down. */
    });
  };
  // The same twenty seconds github.ts waits, and for a weaker reason: there is
  // no database to race here, only a boot that should not spend its first
  // moment on a network call.
  setTimeout(run, 20_000);
  const t = setInterval(run, every);
  t.unref?.();
  return () => clearInterval(t);
}

/** Test seam. Resets the module cache so a case can start from cold. */
export function __resetContributionCache() {
  cached = null;
  cachedAt = 0;
  inFlight = null;
}
