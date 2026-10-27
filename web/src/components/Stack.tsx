import { stackGroups } from "@/data/stack";

/*
 * What the toolchain proves, not what is in it.
 *
 * This was three columns of bare nouns — ten of them in the first group — set
 * one per line. A vertical column of single words is a résumé keyword list,
 * and it is read the way those are read, which is not at all. The grouping was
 * always the interesting part: these are sorted by how close each tool is to
 * daily use, so the honest claim is in the group heading and the note under
 * it, and the tools themselves are evidence for that claim rather than the
 * content.
 *
 * So the note is promoted to the thing you actually read, and the items run on
 * as one wrapped line beneath it. Same information, a third of the vertical
 * space, and it scans as a sentence instead of a list.
 */
export default function Stack() {
  return (
    <section id="stack" className="wrap section-y relative">
      {/* Stacks below `sm` for the reason given in Work.tsx: a display heading
          and an unbreakable eyebrow do not share a 350px row. This is the
          longest eyebrow on the site and it was the worse of the two
          overflows it caused — 544px of content in a 375px viewport. */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:gap-6">
        <h2 className="display text-section leading-[0.9]">Stack</h2>
        <span className="mb-2 hidden h-px flex-1 bg-edge sm:block" aria-hidden="true" />
        <p className="eyebrow shrink-0 sm:mb-3">All of it in a repository you can open</p>
      </div>

      <div className="mt-12 grid gap-12 md:grid-cols-3">
        {stackGroups.map((g) => (
          /* min-w-0 is load-bearing: a grid item defaults to min-width:auto
             and will not shrink below the intrinsic width of its content, so
             the longest unbroken run of tool names pushed this column over
             its track and drew on top of the one beside it. The same trap is
             documented in Work.tsx for the same reason. */
          <div key={g.title} className="min-w-0">
            {/* Bone at low alpha rather than --edge: this rule stands on a
                photograph, and a near-black hairline over one is invisible. */}
            <span className="block h-px w-8 bg-bone/40" aria-hidden="true" />
            {/*
             * The display face, not another 11px mono capital. The home page
             * was carrying forty-four of those; a group heading is a heading,
             * and it should look like the other headings on the page.
             */}
            <h3 className="display-tight mt-3 text-xl text-bone">{g.title}</h3>
            <p className="mt-3 text-sm text-clay">{g.note}</p>

            {/*
             * A wrapping list, not a paragraph of spans.
             *
             * The first version set these as inline spans separated by a
             * slash with a margin on it. A margin is not a space: with no
             * whitespace text node between the elements the browser saw the
             * whole group as one unbreakable word, so a column of ten tools
             * laid itself out 540px wide inside a 341px track and drew on top
             * of the column beside it. Flex wraps on the gaps because the
             * gaps are real boxes.
             */}
            <ul className="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base text-bone/80">
              {g.items.map((item, i) => (
                <li key={item} className="flex items-baseline gap-x-2">
                  {item}
                  {/* The slash trails its item rather than leading the next
                      one. Leading it means a wrapped line opens on a
                      separator, which on a phone happened to three of the
                      nine rows and read as a bullet. */}
                  {i < g.items.length - 1 && (
                    <span className="select-none text-bone/25" aria-hidden="true">
                      /
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
