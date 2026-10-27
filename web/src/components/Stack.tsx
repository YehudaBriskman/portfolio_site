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
    <section id="stack" className="relative mx-auto max-w-6xl px-5 py-28 sm:px-6 sm:py-36">
      <div className="flex items-end gap-6">
        <h2 className="display text-section leading-[0.9]">Stack</h2>
        <span className="mb-2 hidden h-px flex-1 bg-edge sm:block" aria-hidden="true" />
        <p className="eyebrow mb-3 shrink-0">All of it in a repository you can open</p>
      </div>

      <div className="mt-16 grid gap-14 md:grid-cols-3 md:gap-10">
        {stackGroups.map((g) => (
          <div key={g.title}>
            <span className="block h-px w-8 bg-sodium" aria-hidden="true" />
            {/*
             * The display face, not another 11px mono capital. The home page
             * was carrying forty-four of those; a group heading is a heading,
             * and it should look like the other headings on the page.
             */}
            <h3 className="display-tight mt-5 text-xl text-bone">{g.title}</h3>
            <p className="mt-2 text-sm text-clay">{g.note}</p>

            <p className="mt-6 text-base leading-[1.9] text-bone/80">
              {g.items.map((item, i) => (
                <span key={item}>
                  {i > 0 && (
                    <span className="mx-2 select-none text-bone/25" aria-hidden="true">
                      /
                    </span>
                  )}
                  {item}
                </span>
              ))}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
