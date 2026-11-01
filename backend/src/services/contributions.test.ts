import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "./../app";
import {
  __resetContributionCache,
  fetchContributionYear,
  getContributionYear,
} from "./contributions";

/*
 * What is worth asserting here is the failure design, not the happy path.
 *
 * The happy path is one `flatMap` over a payload a schema has already checked.
 * Every expensive bug in this file is on the other side: a GraphQL error that
 * arrives with a 200, a login that resolves to `null`, a token that is missing,
 * a refresh that fails after a good year is already in hand. All four produce a
 * *shape* the page has to draw, and the contract the component is written
 * against is that `error` set means `days` empty — so that is what these tests
 * hold down.
 */

/* What `src/test-env.ts` puts in the environment. Asserted against rather
   than hardcoded twice, so the two cannot drift. */
const TEST_TOKEN = "test-token";

/* The parameters are declared even though the stub ignores them: they are what
   gives `mock.calls` a type, and the token-placement test below reads it. */
function graphqlOk(body: unknown) {
  return vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status: 200 }),
  );
}

/* The smallest payload the schema accepts: two weeks, one short, as GitHub's
   own calendar reports its last week. */
const CALENDAR = {
  data: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: 7,
          weeks: [
            {
              contributionDays: [
                { date: "2026-01-04", contributionCount: 0 },
                { date: "2026-01-05", contributionCount: 5 },
              ],
            },
            { contributionDays: [{ date: "2026-01-06", contributionCount: 2 }] },
          ],
        },
      },
    },
  },
};

beforeEach(() => {
  __resetContributionCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
  __resetContributionCache();
});

describe("fetchContributionYear", () => {
  it("flattens the week grid into one day per entry, in order", async () => {
    vi.stubGlobal("fetch", graphqlOk(CALENDAR));

    const year = await fetchContributionYear("someone");

    expect(year.error).toBeNull();
    expect(year.days).toEqual([
      { date: "2026-01-04", count: 0 },
      { date: "2026-01-05", count: 5 },
      { date: "2026-01-06", count: 2 },
    ]);
    expect(year.from).toBe("2026-01-04");
    expect(year.to).toBe("2026-01-06");
    /* GitHub's own total, not the sum of the array. They agree here; the point
       is which one is read. */
    expect(year.total).toBe(7);
  });

  it("posts a GraphQL query and sends the token in the header, never in the payload", async () => {
    const fetchMock = graphqlOk(CALENDAR);
    vi.stubGlobal("fetch", fetchMock);

    await fetchContributionYear("someone");

    const [url, init] = fetchMock.mock.calls[0];
    if (!init) throw new Error("fetch was called without an init object");
    expect(url).toBe("https://api.github.com/graphql");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TEST_TOKEN}`);
    const body = String(init.body);
    expect(body).toContain("contributionCalendar");
    expect(body).not.toContain(TEST_TOKEN);
  });

  it("treats a 200 carrying GraphQL errors as unavailable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", graphqlOk({ errors: [{ message: "Bad credentials" }] }));

    const year = await fetchContributionYear("someone");

    expect(year.days).toEqual([]);
    expect(year.error).toBeTruthy();
    /* The reason is logged; the page gets one neutral line. "Bad credentials"
       is between the deploy and the operator. */
    expect(year.error).not.toContain("Bad credentials");
    expect(year.total).toBeNull();
  });

  it("treats a null user as unavailable rather than as an empty year", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", graphqlOk({ data: { user: null } }));

    const year = await fetchContributionYear("nobody");

    expect(year.days).toEqual([]);
    expect(year.error).toBeTruthy();
  });

  it("refuses to guess a shape the schema does not recognise", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      graphqlOk({
        data: {
          user: {
            contributionsCollection: {
              /* A count arriving as a string is the bug a cast would have let
                 through to the browser as a NaN column. */
              contributionCalendar: {
                totalContributions: 1,
                weeks: [{ contributionDays: [{ date: "2026-01-04", contributionCount: "1" }] }],
              },
            },
          },
        },
      }),
    );

    const year = await fetchContributionYear("someone");

    expect(year.days).toEqual([]);
    expect(year.error).toBeTruthy();
  });

  it("does not call GitHub at all when there is no token", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = graphqlOk(CALENDAR);
    vi.stubGlobal("fetch", fetchMock);

    /* Emptied and re-imported, because `env` reads process.env once at import
       time: a variable cleared after the module graph has loaded is one the
       already-parsed schema never hears about. An empty string rather than a
       delete, which is what a half-filled deploy actually looks like. */
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.resetModules();
    const fresh = await import("./contributions");
    const year = await fresh.fetchContributionYear("someone");

    expect(year.error).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the cache", () => {
  it("fills itself once on a cold read and then stops calling GitHub", async () => {
    const fetchMock = graphqlOk(CALENDAR);
    vi.stubGlobal("fetch", fetchMock);

    const [a, b, c] = await Promise.all([
      getContributionYear("someone"),
      getContributionYear("someone"),
      getContributionYear("someone"),
    ]);

    /* One call for three concurrent cold reads — the whole job of `inFlight` —
       and a fourth read after they settle still does not reach the network. */
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.days).toHaveLength(3);
    expect(b).toBe(a);
    expect(c).toBe(a);
    await getContributionYear("someone");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/github/contributions", () => {
  it("serves the year, and caches it at the edge", async () => {
    vi.stubGlobal("fetch", graphqlOk(CALENDAR));

    const res = await request(createApp()).get("/api/github/contributions");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.contributions.days).toHaveLength(3);
    expect(res.headers["cache-control"]).toBe("public, max-age=300");
  });

  it("answers an unavailable year with 200 and a reason, uncached", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", graphqlOk({ errors: [{ message: "nope" }] }));

    const res = await request(createApp()).get("/api/github/contributions");

    /*
     * 200, deliberately. The empty grid with a line under it is a designed
     * state, and a 5xx would give the client a second route to the same
     * drawing — the one the browser's console shouts about.
     */
    expect(res.status).toBe(200);
    expect(res.body.contributions.days).toEqual([]);
    expect(res.body.contributions.error).toBeTruthy();
    /* The apology is never cached: this is the state most likely to be fixed
       within the minute. */
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});
