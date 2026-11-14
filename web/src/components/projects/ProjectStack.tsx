import { Fragment, useId, useState } from "react";
import { useProjectWords } from "@/i18n/pages";
import { useWords } from "@/components/dashboard/i18n";
import styles from "@/components/phone/phone.module.css";

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
 *
 * On a phone a long stack is held to two lines behind a "Show more" toggle
 * (direction A: depth is progressive). The whole list stays in the page, so
 * nothing is removed for a reader, a crawler or a screen reader; above 640px
 * the toggle is not shown and the list is as it was.
 *
 * `flat` is for a stack that already sits behind a disclosure (the phone's
 * "Details"): shown whole, with no second toggle inside the first.
 */
export default function ProjectStack({ tech, className = "", flat = false }: { tech: string[]; className?: string; flat?: boolean }) {
  const w = useProjectWords();
  const [words] = useWords();
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (tech.length === 0) return null;

  return (
    <div className={className} data-phone-stack={flat ? undefined : ""} data-collapsed={flat || open ? undefined : ""}>
      <h2 className="mono text-xs uppercase tracking-[0.18em] text-clay">{w.builtWith}</h2>
      <p id={listId} className="mono mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5 text-sm leading-relaxed text-bone/85">
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
      {!flat && tech.length > 4 && (
        <button
          type="button"
          className={styles.stackToggle}
          data-phone="stack-toggle"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? words.showLess : words.showMore}
        </button>
      )}
    </div>
  );
}
