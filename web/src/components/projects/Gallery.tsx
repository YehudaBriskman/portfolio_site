import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import Wall from "@/components/gallery/Wall";
import Shot from "@/components/projects/Shot";
import type { ProjectEntry } from "@/hooks/useProjects";
import { kindOf, stackOf, yearOf, type Size } from "@/components/projects/catalogue";
import styles from "@/components/projects/Gallery.module.css";

/*
 * The catalogue as a gallery wall (#175): every project, image first. The
 * wall — grid, sizes, arrival, re-hang — is `gallery/Wall.tsx`, shared with
 * the notes since #193; this file is what one project looks like on it.
 *
 * WHY A GALLERY AND NOT #173's REGISTER
 * -------------------------------------
 * The owner's brief: bigger, "almost like an images gallery". The register
 * held each project to a 128px thumbnail, and a screenshot is the strongest
 * thing most projects have. So the picture leads here, and the reading jobs
 * the register did by column — which year, which state, which stack — moved
 * to the filter control in the rail beside the wall, where they are exact
 * rather than by eye.
 */

export type GalleryProps = {
  entries: ProjectEntry[];
  sizes: Map<string, Size>;
  label: string;
};

const SIZES: Record<Size, string> = {
  lead: "(min-width: 1100px) 680px, 100vw",
  wide: "(min-width: 1100px) 680px, (min-width: 700px) 66vw, 112px",
  tile: "(min-width: 1100px) 340px, (min-width: 700px) 33vw, 112px",
};

export default function Gallery({ entries, sizes, label }: GalleryProps) {
  return (
    <Wall
      label={label}
      name="p"
      items={entries.map((entry) => {
        const c = entry.collection;
        const size = sizes.get(c.slug) ?? "tile";
        const year = yearOf(entry);
        const stack = stackOf(entry).slice(0, size === "tile" ? 3 : 5);
        const out = [
          ...(entry.primaryLink ? [{ label: entry.primaryLink.label, url: entry.primaryLink.url }] : []),
          ...(c.repoUrl ? [{ label: "Source", url: c.repoUrl }] : []),
        ];

        const node = (
            <article
              className={styles.tile}
              data-size={size}
              /* Through the CSSOM, so strict CSP's `style-src` has nothing to object to. */
              style={
                {
                  ...(entry.tint ? { "--tint": entry.tint.join(" ") } : {}),
                } as CSSProperties
              }
            >
              <span className={styles.picture}>
                {c.coverImage ? (
                  <Shot src={c.coverImage} alt="" sizes={SIZES[size]} className={styles.shot} />
                ) : (
                  <span className={styles.swatch} aria-hidden="true">
                    {[...c.title][0]}
                  </span>
                )}
              </span>

              <div className={styles.caption}>
                <div className={styles.head}>
                  <h2 className={styles.name}>
                    <Link to={`/projects/${c.slug}`} className={styles.open}>
                      {c.title}
                    </Link>
                  </h2>
                  <span className={styles.year}>
                    {year ?? (
                      <>
                        <span aria-hidden="true">&mdash;</span>
                        <span className="sr-only">Year not recorded</span>
                      </>
                    )}
                  </span>
                </div>
                {c.tagline && <p className={styles.fact}>{c.tagline}</p>}
                <div className={styles.meta}>
                  <span className={styles.state} data-kind={kindOf(entry.state)}>
                    <span className={styles.dot} aria-hidden="true" />
                    {entry.state}
                  </span>
                  {stack.length > 0 && (
                    <ul className={styles.stack} translate="no" aria-label="Stack">
                      {stack.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {out.length > 0 && (
                  <p className={styles.links}>
                    {out.map((l) => (
                      <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className={styles.out}>
                        {l.label}{" "}
                        <span className="sr-only">for {c.title} (opens in a new tab)</span>
                      </a>
                    ))}
                  </p>
                )}
              </div>
            </article>
        );
        return { key: c.slug, size, node };
      })}
    />
  );
}
