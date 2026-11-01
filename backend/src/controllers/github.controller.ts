import type { Request, Response } from "express";
import type { ContributionYear } from "../services/contributions.js";

/*
 * The public face of the contribution year.
 *
 * It has one job beyond calling the service, and it is the reason this is a
 * controller rather than a closure in the route file: deciding what an
 * unavailable year is, over HTTP.
 *
 * It is 200 with a reason, not 503. The page draws the empty grid and prints
 * the line in `error`, which is a designed state rather than an error path — so
 * answering 5xx would give the client two different ways to arrive at the same
 * drawing, and the one the browser's own tooling shouts about would be the
 * ordinary one. The service already guarantees the shape: `error` set means
 * `days` empty, in every failure mode, so there is no response here in which a
 * caller could render a partial year by mistake.
 */
export class GithubController {
  constructor(private readonly contributions: () => Promise<ContributionYear>) {}

  /** GET /api/github/contributions */
  public getContributions = async (_req: Request, res: Response) => {
    const year = await this.contributions();
    /*
     * Five minutes at the edge, against a cache the service refreshes every
     * thirty. A visitor reloading the home page should not reach Node at all,
     * and the staleness this can add is bounded by a window in which the
     * underlying number has usually not moved. `stale-while-revalidate` is
     * deliberately absent: there is nothing to revalidate against: the server
     * holds one value and serves it, so a second request during the stale
     * window would be answered from the same place.
     *
     * An unavailable year gets no cache at all. A missing token or a GitHub
     * outage is the state most likely to be fixed within the minute, and
     * caching the apology is how a recovered service keeps apologising.
     */
    res.setHeader("Cache-Control", year.error ? "no-store" : "public, max-age=300");
    res.json({ ok: true, contributions: year });
  };
}
