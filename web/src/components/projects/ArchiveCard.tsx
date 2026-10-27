import { Link } from "react-router-dom";
import Shot from "@/components/projects/Shot";
import Plate from "@/components/projects/Plate";
import Figure from "@/components/Figure";
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
export default function ArchiveCard({ entry, index }: { entry: ProjectEntry; index: number }) {
  const { collection: c } = entry;

  return (
    /* `--paper-2`, like the featured cards: the board the print is mounted
       on. `.card-paper`'s own near-white wash would put one white rectangle
       inside another and leave the mount with nothing to read against. */
    <Link to={`/projects/${c.slug}`} className="card-paper group block bg-[rgb(var(--paper-2))] p-2.5 sm:p-3">
      {/* The year was a third item in the row under the title and is now the
          far end of the caption, where every other figure on the site puts
          the same fact. */}
      <Figure index={index} caption={c.title} note={entry.year ?? undefined}>
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
      </Figure>

      <div className="px-1.5 pb-1 pt-4 sm:px-2">
        <h3 className="display-tight truncate text-lg text-ink sm:text-xl">{c.title}</h3>
        <span className="mono mt-1 block truncate text-xs text-[rgb(var(--ink-soft))]">{c.tagline}</span>
      </div>
    </Link>
  );
}
