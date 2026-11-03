import type { ProjectDecision } from "@/data/projects";
import Written from "@/components/motion/Written";
import Ring from "@/components/motion/Ring";
import { useProjectWords } from "@/i18n/pages";

/*
 * The decisions, with the reasoning kept in.
 *
 * A list of technologies says what was used; it never says what was decided,
 * and the decisions are the only part of a side project that another engineer
 * cannot guess from the screenshot. Each of these is a claim the project
 * already makes in its own README or changelog, carried over whole — including
 * the ones that cost something, because a trade-off stated with its price is
 * the strongest thing on a portfolio and a trade-off stated without one is
 * marketing.
 *
 * Numbered, because the numbers give a reader somewhere to stop. Nothing
 * renders when a project has none, which is the usual case.
 */
export default function ProjectDecisions({
  decisions,
  className = "",
}: {
  decisions: ProjectDecision[];
  className?: string;
}) {
  const w = useProjectWords();
  if (decisions.length === 0) return null;

  return (
    <section className={className} aria-labelledby="decisions-heading">
      <h2 id="decisions-heading" className="display-tight inline-flex items-center gap-2 text-2xl sm:text-3xl">
        <Ring size={12} />
        {w.decisions}
      </h2>
      <ol className="mt-6 divide-y divide-edge border-y border-edge">
        {decisions.map((d, i) => (
          <li key={d.title} className="py-6 sm:grid sm:grid-cols-[minmax(0,2.5rem)_minmax(0,1fr)] sm:gap-6">
            {/* The ordinal in the circle motif (#251), drawn round it by
                scroll; the figure itself is there from the first frame. */}
            <Ring size={28} tone="soft">
              <span className="mono text-xs tabular-nums text-clay">{String(i + 1).padStart(2, "0")}</span>
            </Ring>
            <div className="mt-3 min-w-0 sm:mt-0">
              <h3 className="display-tight max-w-[46ch] text-lg leading-snug text-bone sm:text-xl">{d.title}</h3>
              <Written className="mt-3 max-w-[66ch] text-base leading-[1.65] text-bone/75">{d.body}</Written>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
