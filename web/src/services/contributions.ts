import { z } from "zod";

/*
 * The contribution year, as the browser receives it.
 *
 * The server's contract is in `backend/src/services/contributions.ts` and the
 * one clause this file is built around is: `error` set means `days` empty, in
 * every failure mode. So there is no partial year to merge, no last-good copy
 * to keep, and nothing here decides what to draw — it either hands the caller
 * a year or hands it a sentence.
 *
 * Why the payload is parsed on this side too
 * ------------------------------------------
 * The server already parses GitHub's answer, and this parses the server's. That
 * is not the same check twice. The route can be answered by something other
 * than the API: nginx serves the SPA shell for a path it cannot proxy, so a
 * misconfigured deploy replies `200 text/html` to this request, and a cast
 * would turn that into `days.map` over `undefined` inside a 3D scene. A schema
 * turns it into the empty state the component already draws.
 *
 * The one thing this file will not do is invent a day. A request that fails,
 * a body that will not parse and a body that parses to the wrong shape all
 * come out as the same unavailable year, because all three mean the same thing
 * to a reader: the chart has nothing true to show.
 */

const DaySchema = z.object({
  /** `YYYY-MM-DD`. Not a `Date`: the only thing done with it is grouping by
      month and printing it, and parsing it into local time would move a day
      across a month boundary for a reader west of UTC. */
  date: z.string(),
  count: z.number(),
});

const YearSchema = z.object({
  from: z.string().nullable(),
  to: z.string().nullable(),
  /** GitHub's own total for the window, which the service treats as
      authoritative over any sum of `days`. The caption prints this one. */
  total: z.number().nullable(),
  days: z.array(DaySchema),
  fetchedAt: z.string(),
  error: z.string().nullable(),
});

/* The envelope, in the schema rather than reached into with a cast. `res.json()`
   is `any` by declaration, so picking `.contributions` off it in TypeScript is
   an unchecked claim about a body this process did not write — and the body
   this is most likely to be handed is an HTML document. Parsing the envelope
   makes the wrong shape a parse failure, which is a state with a drawing. */
const EnvelopeSchema = z.object({ contributions: YearSchema });

export type ContributionDay = z.infer<typeof DaySchema>;
export type ContributionYear = z.infer<typeof YearSchema>;

/** The sentence a reader gets when the request itself did not survive. It is
    deliberately the same register as the server's own `UNAVAILABLE` line: the
    reader cannot act on the difference between a dead API and a dead proxy. */
const UNREACHABLE = "The contribution year could not be read.";

function unavailable(): ContributionYear {
  return { from: null, to: null, total: null, days: [], fetchedAt: "", error: UNREACHABLE };
}

/**
 * Reads the trailing contribution year.
 *
 * Resolves rather than rejects on failure, which is the opposite of the
 * convention in `services/blog.ts` and is deliberate. The blog's callers have
 * a genuine error state to render — a card saying the notes could not be
 * loaded. This caller has something better than an error state: a flat grid
 * with nothing in it and a line saying so, which is a drawing rather than an
 * apology. Handing it a rejection would mean every call site reconstructing
 * this object to get there.
 */
export async function contributionYear(): Promise<ContributionYear> {
  try {
    const res = await fetch("/api/github/contributions");
    /* No `res.ok` branch of its own. The service answers 200 with a reason in
       every failure it knows about (see the note on the controller), so a
       non-200 here is the proxy or the rate limiter talking, and both are
       unavailable for the reader's purposes. */
    if (!res.ok) return unavailable();
    const parsed = EnvelopeSchema.safeParse(await res.json());
    return parsed.success ? parsed.data.contributions : unavailable();
  } catch {
    /* A dead network, an aborted navigation, or a body that is not JSON at
       all — which is what an nginx that cannot reach the API returns. */
    return unavailable();
  }
}
