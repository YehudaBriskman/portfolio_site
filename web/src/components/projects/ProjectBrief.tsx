import type { ProjectEntry } from "@/hooks/useProjects";
import Written from "@/components/motion/Written";

/*
 * The three questions a project page has to answer.
 *
 * Before this, a detail page held strictly less than the card that linked to
 * it: a status line, a title, a two-word tagline, one sentence, a screenshot
 * and an empty Notes heading. Everything that made the case — what was wrong
 * before, who did the work, what came of it — was either on the landing page
 * or nowhere, so clicking through cost the reader something.
 *
 * Each of the three is independently optional, and absent means absent: no
 * label, no rule, no blank row. That is not defensive coding, it is the point.
 * Only the two projects with a written record of their own — a README, a
 * changelog — can fill these honestly, and the four earlier ones get a shorter
 * page rather than a padded one.
 */
export default function ProjectBrief({ entry, className = "" }: { entry: ProjectEntry; className?: string }) {
  const rows: [string, string][] = [];
  if (entry.problem) rows.push(["The problem", entry.problem]);
  if (entry.role) rows.push(["My part in it", entry.role]);
  if (entry.outcome) rows.push(["What came of it", entry.outcome]);
  if (rows.length === 0) return null;

  return (
    <dl className={`grid gap-12 border-y border-edge py-12 ${className}`}>
      {rows.map(([label, body]) => (
        <div key={label} className="sm:grid sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] sm:gap-12">
          <dt className="mono text-xs uppercase tracking-[0.18em] text-clay">{label}</dt>
          <Written as="dd" className="mt-3 max-w-[62ch] text-base leading-[1.65] text-bone/85 sm:mt-0 sm:text-lg">{body}</Written>
        </div>
      ))}
    </dl>
  );
}
