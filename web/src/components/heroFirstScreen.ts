/*
 * What the first screen says, as two choices with their arguments attached.
 *
 * WHY THIS FILE EXISTS AT ALL, AND WHEN IT SHOULD STOP EXISTING
 * -------------------------------------------------------------
 * Issue #100 asks what the `h1` should say, and asks for *options* rather
 * than an implementation: two title treatments to choose between. So this is
 * a proposal with working code behind it. Every candidate is built, every
 * candidate renders, and the default is the one recommended rather than the
 * only one that exists.
 *
 * The moment the owner picks, this file collapses: the chosen member of the
 * union becomes the only one, `read` and the guard below are deleted, and
 * `Hero.tsx` reads a plain constant. It is written to be deleted, which is
 * the only honest shape for a switch whose whole purpose is a decision that
 * has not been made yet.
 *
 * WHY THE OVERRIDE IS A URL PARAMETER
 * -----------------------------------
 * The alternative is a build per candidate, and a screenshot set nobody can
 * reproduce without running all of them. One build that answers `?title=`
 * lets the owner stand on the real page and compare, and lets the committed
 * renders be regenerated from a single artifact. It is read once, at module
 * scope, so nothing re-reads the URL mid-session and no component takes a
 * prop it will not have after the decision.
 *
 * Unknown and absent values both fall through to the default, so a mistyped
 * parameter shows the recommendation rather than a blank screen — and the
 * guards are real type predicates rather than casts, because a string from a
 * URL is the textbook case for `unknown` narrowed by a check.
 */

/**
 * Which string the `h1` sets, from issue #100.
 *
 * `portfolio`  PORTFOLIO, very large. The owner's first option.
 * `explore`    EXPLORE MY PORTFOLIO, a little less large. The second.
 * `name`       YEHUDA BRISKMAN. What `main` ships today, kept renderable so
 *              the two proposals can be compared against the thing they
 *              would replace rather than only against each other.
 */
export type HeroTitle = "portfolio" | "explore" | "name";

const TITLES: readonly HeroTitle[] = ["portfolio", "explore", "name"];

/*
 * The recommendation, and the whole of what "one flag away" means.
 *
 * `portfolio` over `explore`: the label schema's first rule is fact and not
 * pitch, and `EXPLORE MY PORTFOLIO` is an imperative — the same objection
 * that cut the "See the work" pill, restated at 132px in the page's one
 * heading. `PORTFOLIO` is a category label, which is a weaker thing to say
 * than a name but is at least a statement rather than an instruction.
 */
const DEFAULT_TITLE: HeroTitle = "portfolio";

const isTitle = (v: string): v is HeroTitle => (TITLES as readonly string[]).includes(v);

/**
 * The query string, once, with no window at all in a test or a prerender.
 *
 * `typeof window` rather than a try/catch: this module is imported by the
 * vitest suite, which renders `Hero` in jsdom — where `window` does exist —
 * and would be imported by any prerender, where it does not. One guard
 * covers both and neither needs to know about the other.
 */
function read<T extends string>(key: string, guard: (v: string) => v is T, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = new URLSearchParams(window.location.search).get(key);
  return raw !== null && guard(raw) ? raw : fallback;
}

export const heroTitle: HeroTitle = read("title", isTitle, DEFAULT_TITLE);
