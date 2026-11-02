import styles from "@/components/dashboard/Dashboard.module.css";
import SkeletonGate from "@/components/gallery/SkeletonGate";
import SkeletonLines from "@/components/gallery/SkeletonLines";

/*
 * The dashboard's placeholders, in the shapes they stand in for: a row is
 * an icon, a title line and a meta line, in the row's own padding, so the
 * card does not change height when the rows arrive. Drawn with the site's
 * `SkeletonLines` inside `SkeletonGate`, so the sweep, the delay before it
 * shows and the reduced-motion and Pause switches are the ones every
 * placeholder on the site already has.
 */

export function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <SkeletonGate>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.skRow}>
          <span className={styles.skIcon} />
          <span className={styles.skLines}>
            <SkeletonLines lines={1} tail={i % 2 ? "70%" : "85%"} />
            <span className={styles.skMeta}>
              <SkeletonLines lines={1} tail="12rem" />
            </span>
          </span>
        </div>
      ))}
    </SkeletonGate>
  );
}

export function ListSkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <SkeletonGate>
      <span className={styles.skLines}>
        {Array.from({ length: lines }, (_, i) => (
          <SkeletonLines key={i} lines={1} tail={`${60 + ((i * 17) % 35)}%`} />
        ))}
      </span>
    </SkeletonGate>
  );
}

export function PostsSkeleton() {
  return (
    <SkeletonGate>
      <div className={styles.postsWrap}>
        <div className={styles.posts}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.post}>
              <span className={styles.skMeta}>
                <SkeletonLines lines={1} tail="7rem" />
              </span>
              <span className={styles.skLines}>
                <SkeletonLines lines={2} />
              </span>
              <span className={styles.skMeta}>
                <SkeletonLines lines={2} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </SkeletonGate>
  );
}
