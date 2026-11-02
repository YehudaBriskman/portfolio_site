import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import Shot from "@/components/projects/Shot";
import type { ProjectEntry } from "@/hooks/useProjects";
import styles from "@/components/projects/ProjectIndex.module.css";

/*
 * The catalogue: every project, one row each, in a register.
 *
 * Why a register and not the home page's run
 * ------------------------------------------
 * The run (`ProjectRun`) is branding: a curated few, held in one frame while
 * the reader's scroll walks them along a curve. It buys that in scroll
 * distance — 55svh of runway per card — which is the right price for four
 * and the wrong one for forty. This page has the opposite job. A reader here
 * wants to see what exists, compare it, and open one, so the arrangement is
 * the one a catalogue raisonné uses: a column of rows with the year, the
 * name and the state in the same place on every line, so the eye can run
 * down any one of them.
 *
 * Nothing here knows how many projects there are. Each row is its own box in
 * normal flow and carries its own view timeline, so the page is exactly as
 * tall as the list, nothing is pinned, and the fortieth row moves the same
 * way the first does with no number to retune.
 *
 * The motion (`riffle`, see `docs/motion-contract.md`) is the one thing a
 * card catalogue drawer does: a row comes up out of the lower part of the
 * window tipped back on its top edge, like the next card in a drawer, and
 * stands up as the reader's scroll brings it to reading height. It is
 * scrubbed by scroll, so it reverses exactly on the way back up, and it is
 * finished before a row is anywhere a reader could be reading it.
 */

export type ProjectIndexProps = {
  entries: ProjectEntry[];
  label: string;
};

/* Four of the stack is a line on a laptop; the full list is on the page the
   row opens. */
const TECH = 4;

const THUMB_SIZES = "(min-width: 700px) 128px, 80px";

/* An API-only collection has no seeded year. Its last push is the nearest
   honest year it has, and nothing at all is better than a made-up one. */
function yearOf(entry: ProjectEntry): string | null {
  return entry.year ?? entry.collection.stats?.pushedAt?.slice(0, 4) ?? null;
}

export default function ProjectIndex({ entries, label }: ProjectIndexProps) {
  if (entries.length === 0) return null;

  return (
    <ol className={styles.index} aria-label={label}>
      {entries.map((entry) => {
        const { collection: c } = entry;
        const year = yearOf(entry);
        const tech = entry.tech.slice(0, TECH);

        return (
          <li
            key={c.slug}
            className={styles.row}
            /* The work's own colour, for the swatch that stands in for a
               missing screenshot. Set through the CSSOM by React, so strict
               CSP's `style-src` has no attribute to object to. */
            style={entry.tint ? ({ "--tint": entry.tint.join(" ") } as CSSProperties) : undefined}
          >
            <Link to={`/projects/${c.slug}`} className={styles.leaf}>
              <span className={styles.year}>
                {year ?? (
                  <>
                    <span aria-hidden="true">&mdash;</span>
                    <span className="sr-only">Year not recorded</span>
                  </>
                )}
              </span>

              <span className={styles.body}>
                <h2 className={styles.name}>{c.title}</h2>
                {c.tagline && <span className={styles.fact}>{c.tagline}</span>}
                {tech.length > 0 && (
                  <span className={styles.tech} translate="no">
                    {tech.join(", ")}
                  </span>
                )}
              </span>

              <span className={styles.state}>{entry.state}</span>

              {/* Decorative: the row's accessible name is its heading and its
                  line, and a screenshot's alt would be read before either. */}
              <span className={styles.thumb} aria-hidden="true">
                {c.coverImage ? (
                  <Shot src={c.coverImage} alt="" sizes={THUMB_SIZES} className={styles.shot} />
                ) : (
                  <span className={styles.swatch}>{[...c.title][0]}</span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
