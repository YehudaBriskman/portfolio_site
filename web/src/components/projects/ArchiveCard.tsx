import { Link } from "react-router-dom";
import Shot from "@/components/projects/Shot";
import Plate from "@/components/projects/Plate";
import type { ProjectEntry } from "@/hooks/useProjects";

/*
 * An entry in the earlier work.
 *
 * The archive had four real screenshots and was throwing all four away: each
 * was cropped to a 56px circle, pinned to the top of the frame, in a grid with
 * 8px gutters and three columns that left the fourth item alone on its own
 * row. Four dark discs are not four projects. The pictures are already built
 * and already downloaded, and at this size a teaching site, a cash tracker, a
 * car marketplace and an encryption tool genuinely do not look alike — so the
 * answer was to show them rather than to drop them.
 *
 * Two columns, not three: there are four of these, and 2 × 2 is the only
 * arrangement that does not end in an orphan. The crop is 16:9 against sources
 * that are roughly 2.1:1, so very little of the interface is lost.
 *
 * This is deliberately quieter than a featured card — no status capsule, no
 * description, a smaller title — because the archive is context for the two
 * projects above it, not a competitor to them.
 */
export default function ArchiveCard({ entry }: { entry: ProjectEntry }) {
  const { collection: c } = entry;

  return (
    <Link to={`/projects/${c.slug}`} className="card group block overflow-hidden p-2.5 sm:p-3">
      <figure className="m-0">
        {c.coverImage ? (
          <Shot
            src={c.coverImage}
            alt={`${c.title} screenshot`}
            className="aspect-[16/9]"
            sizes="(min-width: 640px) 50vw, 100vw"
          />
        ) : (
          <Plate className="aspect-[16/9]" title={c.title} tagline={c.tagline} tech={entry.tech} />
        )}
      </figure>

      <div className="flex items-baseline gap-4 px-1.5 pb-1 pt-4 sm:px-2">
        <span className="min-w-0 flex-1">
          <h3 className="display-tight truncate text-lg text-bone transition-colors group-hover:text-sodium sm:text-xl">
            {c.title}
          </h3>
          <span className="mono mt-1 block truncate text-xs text-clay">{c.tagline}</span>
        </span>
        {entry.year && (
          <span className="mono shrink-0 text-xs tabular-nums text-clay" aria-hidden="true">
            {entry.year}
          </span>
        )}
      </div>
    </Link>
  );
}
