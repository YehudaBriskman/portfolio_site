import { relativeTime, type Collection } from "@/services/blog";

/*
 * Repository facts as pills on a scrolling rail.
 *
 * The old treatment was three 10px grey words wrapping into a ragged block at
 * 2.9:1 — the single worst thing on the card and the reason the page read as
 * muted. Pills give each number a shape, `.rail` scrolls them on a phone rather
 * than stacking them, and `.chip` fixes the colour at --clay (7:1).
 *
 * Nothing here is invented. A seed project has no stats, so it shows none.
 */
export default function StatChips({ c, className = "" }: { c: Collection; className?: string }) {
  const s = c.stats;
  if (!s) return null;

  const release = s.latestRelease?.tag;

  return (
    <div className={`rail ${className}`}>
      {s.language && <span className="chip">{s.language}</span>}
      {typeof s.stars === "number" && (
        <span className="chip">
          <b>{s.stars}</b> stars
        </span>
      )}
      {release && <span className="chip chip-hot">{release}</span>}
      {s.license && <span className="chip">{s.license}</span>}
      {s.pushedAt && (
        <span className="chip">
          pushed <b>{relativeTime(s.pushedAt)}</b>
        </span>
      )}
    </div>
  );
}
