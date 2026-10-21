import { Link } from "react-router-dom";
import type { ProjectEntry } from "@/hooks/useProjects";
import { projectImage } from "@/lib/projectImage";

/*
 * The archive row, and the "other projects" row on a detail page.
 *
 * A 56px circular crop of the screenshot beside a rectangle is the one shape
 * the rest of the site does not already have, and it is what keeps the earlier
 * work from reading as six more equal-weight cards. 76px tall, so the target
 * clears 44px without a helper.
 *
 * `min-w-0` and `truncate` are load-bearing: without them a long tagline blows
 * the flex row out past the viewport on a 360px screen.
 */
export default function ProjectRow({ entry }: { entry: ProjectEntry }) {
  const { collection: c } = entry;

  return (
    <Link to={`/projects/${c.slug}`} className="card group flex min-h-[76px] items-center gap-4 p-3 pr-5">
      <span className="thumb-round h-14 w-14 shrink-0 border border-edge bg-bitumen">
        {c.coverImage ? (
          <img
            src={projectImage(c.coverImage, "thumb") ?? c.coverImage}
            width={168}
            height={168}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover object-top transition-transform [transition-duration:var(--dur-settle)] [transition-timing-function:var(--ease-settle)] group-hover:scale-110"
          />
        ) : (
          <span className="mono flex h-full w-full items-center justify-center text-sm text-clay" aria-hidden="true">
            {c.title.slice(0, 1)}
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="display-tight block truncate text-lg text-bone transition-colors group-hover:text-sodium">
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
