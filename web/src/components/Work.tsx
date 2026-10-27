import Action from "@/components/ui/Action";
import ProjectCarousel from "@/components/carousel/ProjectCarousel";
import { useProjects } from "@/hooks/useProjects";

/*
 * The landing page argues; /projects catalogues.
 *
 * What this section used to be, and why it is not that any more
 * -------------------------------------------------------------
 * Two projects, each laid out as a screenshot beside a column carrying the
 * year, the status, the title, the tagline, a three-line description, three
 * bulleted highlights, eight technology chips and three buttons. Thirty-six
 * pieces of content before a reader had scrolled past the second item, and
 * every one of them printed again on the detail page the section is
 * supposed to be sending people to. A reader who has been told everything
 * has no reason to click, and the clicks were the point: the detail pages
 * were written and nobody was reading them.
 *
 * So the argument is made by a shelf instead. Four cards, each showing the
 * screenshot, the name, one line and two or three small facts, and one way
 * in. Scroll the shelf and the card in the middle comes square-on to you
 * while its neighbours fall away. The cut is in CarouselCard.tsx, field by
 * field, with the place each cut thing still lives.
 *
 * Four rather than two
 * --------------------
 * The old section carried only the two projects that are in use, on the
 * argument that a third dilutes them. That argument was about a section
 * where each item cost five hundred pixels of page; on a shelf a card costs
 * one slot, and two cards is not a shelf. The two in use still come first
 * and are still read first — the ordering is unchanged — and each card
 * prints its own state, so nothing is being passed off as something it is
 * not. The eyebrow says plainly that this is four of however many there
 * are, and `All projects` goes to the rest.
 */

/*
 * How many fit on the home page.
 *
 * Four is the point where the shelf is obviously a shelf — three visible at
 * the desktop measure with a fourth under the frame's edge — and the point
 * past which the home page starts doing the catalogue's job.
 */
const HOME_COUNT = 4;

/* The hero's portrait is plate one, so the first screenshot in this section
   is plate two. Numbering runs across the page a reader sees rather than
   across a component, which is why the offset is written here. */
const FIRST_PLATE = 2;

export default function Work() {
  const { items } = useProjects();
  const shown = items.slice(0, HOME_COUNT);

  return (
    <section id="work" className="wrap section-y isolate relative">
      {/*
        The section head stacks on a phone.

        Heading, hairline and eyebrow on one row is a desktop figure: the
        heading is display type that will not shrink below its glyphs and the
        eyebrow is a sentence that must not wrap mid-phrase, so on a 390px
        screen the row simply ran off the side. Below `sm` it is two lines,
        which is what the hairline between them was standing in for anyway.
      */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:gap-6">
        <h2 className="display text-section leading-[0.9]">Work</h2>
        <span className="mb-2 hidden h-px flex-1 bg-[rgb(var(--rule-firm))] sm:block" aria-hidden="true" />
        {/* The eyebrow used to read "In use", which was true of the two items
            the section carried and is not true of four. A count is the
            honest version and it is also the more useful one: it says there
            is more, which is what the link at the foot is for. */}
        <p className="eyebrow shrink-0 tabular-nums sm:mb-3">
          {shown.length} of {items.length}
        </p>
      </div>

      <div className="mt-12">
        <ProjectCarousel entries={shown} label="Selected work" heading="h3" firstPlate={FIRST_PLATE} />
      </div>

      <div className="mt-section-sm">
        <Action tone="text" glyph="onward" to="/projects">
          All projects
        </Action>
      </div>
    </section>
  );
}
