import { Link } from "react-router-dom";
import type { ProjectEntry } from "@/hooks/useProjects";

/*
 * The "elsewhere" row at the foot of a detail page.
 *
 * It used to carry a 56px circular crop of the screenshot, and it was the
 * archive grid's row too. Both uses were wrong for the same reason, in
 * opposite directions. In the archive, four real screenshots shrunk to 56px
 * circles with the crop pinned to the top became four near-identical dark
 * discs — the imagery cost a download and bought no distinction at all; that
 * list now has a card of its own with the picture at a size that can be read.
 * Here, at the foot of a page that already opened with a full-width hero, a
 * second thumbnail of a different project competes with the one screenshot the
 * page is actually about. So this is type and nothing else: a title, what it
 * is, and when.
 *
 * `min-w-0` and `truncate` are load-bearing: without them a long tagline blows
 * the flex row out past the viewport on a 360px screen.
 */
export default function ProjectRow({ entry }: { entry: ProjectEntry }) {
  const { collection: c } = entry;

  return (
    <Link to={`/projects/${c.slug}`} className="card group flex min-h-[76px] items-center gap-4 px-5 py-4">
      <span className="min-w-0 flex-1">
        <span className="display-tight block truncate text-lg text-bone">
          {c.title}
        </span>
        <span className="mono block truncate text-xs text-clay">{c.tagline}</span>
      </span>

      {entry.year && (
        <span className="mono hidden text-xs tabular-nums text-clay sm:block" aria-hidden="true">
          {entry.year}
        </span>
      )}
      <span
        aria-hidden="true"
        className="mono text-xs text-clay transition-transform [transition-duration:var(--dur-fast)] group-hover:translate-x-1"
      >
        →
      </span>
    </Link>
  );
}
