import type { CSSProperties } from "react";
import { kindOf, type Summary } from "@/components/projects/catalogue";
import styles from "@/components/projects/StatsPanel.module.css";

/*
 * The instrument panel over the wall (#175): projects per year as bars, and
 * the count in each state.
 *
 * It is the whole catalogue's summary, not the filtered view's, so it stays
 * still while a reader narrows the wall, and the year being filtered is
 * marked on its bar instead. The bars are drawn by scroll — each grows from
 * its baseline as the panel comes up the window and shrinks again on the
 * way back (`StatsPanel.module.css`). The figures are always printed, so the
 * chart is never the only way to read a count.
 *
 * It is dark, and that is a claim with a ceiling attached: the case that it
 * is not a third dark act is in `ground/DarkAct.tsx`. `.on-panel` re-inks the
 * subtree and `data-chrome="dark"` tells the nav to change material while
 * the panel passes under it; the two are not interchangeable.
 */

export default function StatsPanel({
  summary,
  total,
  activeYear,
}: {
  summary: Summary;
  total: number;
  activeYear: string | null;
}) {
  const peak = Math.max(1, ...summary.byYear.map((y) => y.count));

  return (
    <section className={`on-panel ${styles.panel}`} data-chrome="dark" aria-labelledby="projects-summary">
      <h2 id="projects-summary" className="sr-only">
        The catalogue at a glance
      </h2>

      {summary.byYear.length > 0 && (
        <figure className={styles.chart}>
          <figcaption className={styles.caption}>Projects per year</figcaption>
          {/* Past twelve years the labels would collide, so only the ends and
              the filtered year keep one; every count is still printed. */}
          <ol className={styles.bars} data-dense={summary.byYear.length > 12 || undefined}>
            {summary.byYear.map((y) => (
              <li
                key={y.year}
                className={styles.col}
                aria-current={activeYear === String(y.year) ? "true" : undefined}
              >
                <span className={styles.count}>
                  {y.count}
                  <span className="sr-only"> in {y.year}</span>
                </span>
                <span className={styles.track} aria-hidden="true">
                  <span className={styles.bar} style={{ "--h": y.count / peak } as CSSProperties} />
                </span>
                <span className={styles.year} aria-hidden="true">
                  {y.year}
                </span>
              </li>
            ))}
          </ol>
        </figure>
      )}

      <dl className={styles.tally}>
        <div className={styles.cellTotal}>
          <dt>Projects</dt>
          <dd>{total}</dd>
        </div>
        {summary.byState.map((s) => (
          <div key={s.value}>
            <dt>
              <span className={styles.dot} data-kind={kindOf(s.value)} aria-hidden="true" />
              {s.value}
            </dt>
            <dd>{s.count}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
