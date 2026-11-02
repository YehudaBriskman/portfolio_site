import Action from "@/components/ui/Action";
import ProjectPile from "@/components/projects/ProjectPile";
import { useProjects } from "@/hooks/useProjects";

/*
 * The peak of the page, and the first of its two dark acts.
 *
 * What this section has been, twice
 * ---------------------------------
 * First, two projects laid out as a screenshot beside a column carrying the
 * year, the status, the title, the tagline, a three-line description, three
 * bulleted highlights, eight technology chips and three buttons. Thirty-six
 * pieces of content before a reader had scrolled past the second item, every
 * one of them printed again on the detail page the section is supposed to be
 * sending people to. A reader who has been told everything has no reason to
 * click, and the clicks were the point.
 *
 * Then a shelf: four cards in a horizontal snap scroller, tilted in 3D, with
 * arrows and a position indicator. That fixed the content problem and left a
 * different one, which is that the shelf was one of three maximum-effort
 * moments competing on one page — and three peaks is none. It also could not
 * say the one thing this section has to say. A shelf shows you one card at a
 * time by design, so six projects read as six separate glances rather than as
 * a body of work.
 *
 * What it is now
 * --------------
 * A pile, and everything else on the page has been demoted so this can land.
 * It gets the dark ground, the most scroll room of any beat, and a beat of
 * silence before it. The mechanism and the two scroll-timeline traps behind it
 * are documented in `projects/ProjectPile.module.css`; the shape of the markup
 * and the reason there is exactly one link per card are in
 * `projects/ProjectPile.tsx`.
 *
 * The ground, and the trap in inverting one mid-page
 * --------------------------------------------------
 * `.on-panel` carries the whole act: it re-points `--canvas`, `--ink`,
 * `--ink-soft`, `--rule` and `--signal` at the panel palette, restates
 * `color` — which is the part that matters, because `color` inherits as a
 * computed value and redefining `--ink` on a subtree does *not* re-ink text
 * whose colour already resolved on `<body>` — and applies the three-axis type
 * compensation the dark ground needs. See the note on `--panel` in index.css.
 * Everything in here therefore reads its colour from a token and nothing
 * hardcodes one.
 *
 * It sits on the `<section>` and not on an inner box so the ground genuinely
 * drops out from under the work: the section is the full width of the page and
 * `.wrap` is moved one level in, onto a child, where previously the two were
 * the same element and a dark fill would have been a 1152px rectangle on
 * cream. `data-chrome="dark"` is the hook the nav observes to invert itself
 * while the reader is inside the act.
 *
 * The ground is now shared, and the pair is the argument
 * ------------------------------------------------------
 * There is a second dark act: the contribution year. The two are the only
 * sections on the home page whose subject is the work itself — the objects,
 * and the labour that made them — and the ceiling is two. The argument, and
 * the boundary and the drifting light that come with the ground, are in
 * `components/ground/DarkAct.tsx`, which wraps both.
 *
 * It costs this section the dark ground as a signal that it is the peak, and
 * that trade is recorded in §3 of `docs/motion-contract.md`. What makes this
 * the peak is unchanged: it is the only beat that pins, the only one with an
 * asset budget, and the one with the most scroll room.
 */

/*
 * How many fit on the home page.
 *
 * Four is the point where the pile is unmistakably a pile — three edges
 * showing above the card you are reading — and the point past which the home
 * page starts doing the catalogue's job. It is also the count the offsets are
 * tuned for: the step shrinks as the count grows so that eight would still
 * fit, but four is where each edge gets its full 20px.
 */
const HOME_COUNT = 4;

export default function Work() {
  const { items } = useProjects();
  const shown = items.slice(0, HOME_COUNT);

  return (
    <section id="work" data-chrome="dark" className="on-panel relative isolate">
      <div className="wrap section-y">
        {/*
          The section head, centred, with the eyebrow on its own line.

          The layout is `.section-head` in index.css, shared with the three
          other heads on this page; the long note there has why the one
          hairline became two and why the eyebrow moved under the heading.
          What is local is the rule itself: this head is inside the dark act,
          and a plain span in `--rule-firm` — which `.on-panel` re-points to
          the panel's own hairline colour — is what it has always drawn
          rather than the `InkRule` the cream sections use.
        */}
        <div className="section-head">
          <span className="section-head-rule h-px bg-[rgb(var(--rule-firm))]" aria-hidden="true" />
          <h2 className="display text-section leading-[0.9]">Work</h2>
          <span className="section-head-rule h-px bg-[rgb(var(--rule-firm))]" aria-hidden="true" />
          {/* A count is the honest eyebrow and it is also the more useful one:
              it says there is more, which is what the link at the foot is
              for. */}
          <p className="eyebrow section-head-note tabular-nums">
            {shown.length} of {items.length}
          </p>
        </div>

        <div className="mt-12">
          {/* No eager first card. The pile is two screens down on this page,
              so none of its screenshots is the LCP element and loading one at
              high priority would be taking bandwidth from the hero. */}
          <ProjectPile entries={shown} label="Selected work" heading="h3" />
        </div>

        {/*
          The way out of the act, and it has to be close behind the pile.

          Sticky is bounded by the rail's padding box, so the last card
          unpins as the rail's foot passes — and whatever is under it is what
          the reader sees on the last screen of the section. `mt-section-sm`
          rather than the full step: at the larger spacing the pile left the
          screen with nothing having arrived to replace it, which is the one
          ending a peak cannot have.
        */}
        <div className="mt-section-sm">
          <Action tone="text" glyph="onward" to="/projects">
            All projects
          </Action>
        </div>
      </div>
    </section>
  );
}
