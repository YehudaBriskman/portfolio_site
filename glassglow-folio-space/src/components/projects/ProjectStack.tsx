import { Fragment } from "react";

/*
 * What it is built with, as a line of type.
 *
 * Eight technologies used to be eight `.chip` capsules, which on top of the
 * action pills, the status pill and five repository-fact pills made twelve
 * near-identical 12px mono capsules on one page. At that density a capsule
 * stops reading as "this is a distinct thing you can act on" and starts
 * reading as decoration, and the reader loses the only shape that was telling
 * them where the buttons are.
 *
 * So the stack keeps the mono voice and loses the outline. Separated by a
 * middot rather than a comma because the list has no grammar — it is a set,
 * not a sentence — and the dot says so without pretending otherwise.
 */
export default function ProjectStack({ tech, className = "" }: { tech: string[]; className?: string }) {
  if (tech.length === 0) return null;

  return (
    <div className={className}>
      <h2 className="mono text-xs uppercase tracking-[0.18em] text-clay">Built with</h2>
      <p className="mono mt-4 flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5 text-sm leading-relaxed text-bone/85">
        {tech.map((t, i) => (
          <Fragment key={t}>
            {i > 0 && (
              <span aria-hidden="true" className="text-clay/60">
                ·
              </span>
            )}
            <span>{t}</span>
          </Fragment>
        ))}
      </p>
    </div>
  );
}
