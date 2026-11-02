import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import Shot from "@/components/projects/Shot";
import type { ProjectEntry } from "@/hooks/useProjects";
import { kindOf, stackOf, yearOf, type Size } from "@/components/projects/catalogue";
import styles from "@/components/projects/Gallery.module.css";

/*
 * The catalogue as a gallery wall (#175): every project, image first, hung in
 * a grid where the important pieces are hung larger.
 *
 * WHY A GALLERY AND NOT #173's REGISTER
 * -------------------------------------
 * The owner's brief: bigger, more like a dashboard, "almost like an images
 * gallery". The register was right for scanning a column of years and
 * wrong for that: it held each project to a 128px thumbnail, and a
 * screenshot is the strongest thing most projects have. So the picture leads
 * here, and the reading jobs the register did by column — which year, which
 * state, which stack — moved to the filters above the wall, where they are
 * exact rather than by eye.
 *
 * SIZE IS DATA
 * ------------
 * A tile's size (`lead` 2x2, `wide` 2x1, `tile` 1x1) is decided in
 * `catalogue.ts` from what the project is, never from where it falls, and the
 * grid packs with `grid-auto-flow: dense`, so there is no hole however many
 * of each there are. Nothing here knows the count.
 *
 * THE ARRIVAL, AND THE ONE MEASUREMENT IT NEEDS
 * ---------------------------------------------
 * `assemble` (see `docs/motion-contract.md`): a tile in the left third of the
 * wall slides in from the left, one in the right third from the right, and
 * one in the middle rises — so each band of the wall closes in from its
 * edges. Scrubbed by each tile's own view timeline, so it reverses exactly.
 *
 * Which third a tile is in cannot be known from CSS once the grid packs
 * densely, so the effect below reads it from layout — once on mount, again
 * when the wall's width or contents change, never per frame — and writes it
 * as `data-from`, an attribute the stylesheet reads. No React state, so
 * measuring does not re-render. In one column every tile is in the middle;
 * there the sides alternate instead, so a phone still sees the wall come in
 * from the sides. Before the first measurement every tile rises, which is a
 * correct arrival, only a plainer one. The sides are physical, so a
 * right-to-left page mirrors for free: a tile on the left comes from the left.
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

/* A slug is not guaranteed to be a CSS identifier; the transition name must be. */
const vtName = (slug: string) => `p-${slug.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

function placeTiles(list: HTMLOListElement) {
  const box = list.getBoundingClientRect();
  if (box.width === 0) return;
  const items = [...list.children] as HTMLElement[];
  const rects = items.map((li) => li.getBoundingClientRect());
  const single = rects.every((r) => r.width > box.width * 0.8);
  rects.forEach((r, i) => {
    const centre = (r.left + r.width / 2 - box.left) / box.width;
    items[i].dataset.from = single
      ? i % 2 ? "right" : "left"
      : centre < 1 / 3 ? "left" : centre > 2 / 3 ? "right" : "mid";
  });
}

export default function Gallery({ entries, sizes, label }: GalleryProps) {
  const ref = useRef<HTMLOListElement>(null);

  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    placeTiles(list);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => placeTiles(list));
    ro.observe(list);
    return () => ro.disconnect();
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div className={styles.frame}>
    <ol ref={ref} className={styles.wall} aria-label={label}>
      {entries.map((entry) => {
        const c = entry.collection;
        const size = sizes.get(c.slug) ?? "tile";
        const year = yearOf(entry);
        const stack = stackOf(entry).slice(0, size === "tile" ? 3 : 5);
        const out = [
          ...(entry.primaryLink ? [{ label: entry.primaryLink.label, url: entry.primaryLink.url }] : []),
          ...(c.repoUrl ? [{ label: "Source", url: c.repoUrl }] : []),
        ];

        return (
          <li key={c.slug} className={styles.cell} data-size={size}>
            <article
              className={styles.tile}
              /* Through the CSSOM, so strict CSP's `style-src` has nothing to object to. */
              style={
                {
                  viewTransitionName: vtName(c.slug),
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
          </li>
        );
      })}
    </ol>
    </div>
  );
}
