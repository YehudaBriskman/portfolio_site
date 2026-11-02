import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import styles from "@/components/gallery/Wall.module.css";

/*
 * The gallery wall (#175), shared by /projects and /blog since #193: a list
 * of pieces hung in a grid where the important ones are hung larger, each
 * arriving from its own side of the wall as it comes up the window.
 *
 * The wall owns the grid, the sizes' spans, the arrival and the re-hang. The
 * piece inside each cell is the page's (a project tile, a note card), and
 * knows nothing about either.
 *
 * SIZE IS DATA
 * ------------
 * A piece's size (`lead` 2x2, `wide` 2x1, `tile` 1x1) is decided by the page
 * from what the item is, never from where it falls, and the grid packs with
 * `grid-auto-flow: dense`, so there is no hole however many of each there
 * are. Nothing here knows the count.
 *
 * THE ARRIVAL, AND THE ONE MEASUREMENT IT NEEDS
 * ---------------------------------------------
 * `assemble` (see `docs/motion-contract.md`): a piece in the left third of
 * the wall slides in from the left, one in the right third from the right,
 * and one in the middle rises — so each band of the wall closes in from its
 * edges. Scrubbed by each cell's own view timeline, so it reverses exactly.
 *
 * Which third a piece is in cannot be known from CSS once the grid packs
 * densely, so the effect below reads it from layout — once on mount, again
 * when the wall's width or contents change, never per frame — and writes it
 * as `data-from`, an attribute the stylesheet reads. No React state, so
 * measuring does not re-render. In one column every piece is in the middle;
 * there the sides alternate instead, so a phone still sees the wall come in
 * from the sides. Before the first measurement every piece rises, which is a
 * correct arrival, only a plainer one. The sides are physical, so a
 * right-to-left page mirrors for free: a piece on the left comes from the left.
 */

export type Size = "lead" | "wide" | "tile";

export type WallItem = {
  key: string;
  size: Size;
  node: ReactNode;
};

/* A key is not guaranteed to be a CSS identifier; the transition name must be. */
const vtName = (prefix: string, key: string) => `${prefix}-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

function placePieces(list: HTMLOListElement) {
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

export default function Wall({
  items,
  label,
  name,
  className = "",
}: {
  items: WallItem[];
  /** The list's accessible name: what is on the wall, filtered or not. */
  label: string;
  /** The prefix of each piece's view-transition name, unique per page. */
  name: string;
  /** Sets `--wall-row` and anything else the page's pieces need from the grid. */
  className?: string;
}) {
  const ref = useRef<HTMLOListElement>(null);

  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    placePieces(list);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => placePieces(list));
    ro.observe(list);
    return () => ro.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className={styles.frame}>
      <ol ref={ref} className={`${styles.wall} ${className}`} aria-label={label}>
        {items.map((item) => (
          <li key={item.key} className={styles.cell} data-size={item.size}>
            <div
              className={styles.piece}
              /* Through the CSSOM, so strict CSP's `style-src` has nothing to object to. */
              style={{ viewTransitionName: vtName(name, item.key) } as CSSProperties}
            >
              {item.node}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The wall's own grid, empty, for a page's skeleton to fill with placeholders the shape of its pieces. */
export function WallSkeletonGrid({
  sizes,
  className = "",
  render,
}: {
  sizes: Size[];
  className?: string;
  render: (size: Size, i: number) => ReactNode;
}) {
  return (
    <div className={styles.frame}>
      <div className={`${styles.wall} ${className}`}>
        {sizes.map((size, i) => (
          <div key={i} className={styles.cell} data-size={size}>
            {render(size, i)}
          </div>
        ))}
      </div>
    </div>
  );
}
