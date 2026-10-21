import { Link } from "react-router-dom";
import type { Collection } from "@/services/blog";

/*
 * The way through to each project's own notes.
 *
 * This was a row of 11px uppercase links packed into a hairline band: dense,
 * under 3:1 against the ground, and nowhere near a 44px target. It is
 * navigation, so it now sits above the writing it competes with — but held to a
 * single row, so it never outranks it.
 *
 * `.rail` scrolls and snaps on a phone and wraps from `sm` up, which gives the
 * page a second axis on the screen that has the least room for a first one.
 */
export default function ProjectRail({ projects }: { projects: Collection[] }) {
  if (projects.length === 0) return null;
  return (
    <nav aria-label="Project notes" className="mt-10 sm:mt-14">
      <p className="eyebrow">Notes on the projects</p>
      <ul className="rail mt-4">
        {projects.map((c) => (
          <li key={c.slug}>
            <Link
              to={`/projects/${c.slug}`}
              className="tap group inline-flex min-h-[44px] items-center gap-2.5 rounded-full border border-edge bg-surface/50 px-4 py-2.5 transition-colors [transition-duration:var(--dur-micro)] hover:border-sodium/50 hover:bg-surface"
            >
              {/* The sun, at the size of a bullet. */}
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-sodium transition-transform [transition-duration:var(--dur-fast)] [transition-timing-function:var(--ease-settle)] motion-safe:group-hover:scale-150"
              />
              <span className="text-[0.9375rem] text-bone">{c.title}</span>
              <span aria-hidden="true" className="mono text-[0.6875rem] text-clay">
                &rarr;
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
