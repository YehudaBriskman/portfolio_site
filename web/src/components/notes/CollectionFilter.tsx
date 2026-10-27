import { Link } from "react-router-dom";
import type { Collection } from "@/services/blog";

/*
 * The collections, as a filter rather than as an exit.
 *
 * This was a rail of links straight out to each project's own page, which made
 * sense only because the index it sat on could not show project notes at all:
 * /blog asked the API for `collection=site`, so every note filed against a
 * project was unreachable from the index of the writing. Fetching everything
 * fixed the hole and left this rail pointing away from a page that now has the
 * posts on it.
 *
 * So the chips narrow the grid in place. They are real links to a real URL
 * rather than buttons over local state, which keeps a filtered view
 * shareable, bookmarkable and reachable with the back button — and keeps
 * middle-click doing what middle-click should.
 *
 * `.rail` scrolls and snaps on a phone and wraps from `sm` up, which gives the
 * page a second axis on the screen that has the least room for a first one.
 */
export default function CollectionFilter({
  projects,
  active,
}: {
  projects: Collection[];
  /** The `collection` query parameter, or null for everything. */
  active: string | null;
}) {
  if (projects.length === 0) return null;

  const options = [
    { slug: null, title: "Everything" },
    { slug: "site", title: "The site" },
    ...projects.map((c) => ({ slug: c.slug, title: c.title })),
  ];

  return (
    <nav aria-label="Filter notes by collection" className="mt-12">
      <p className="eyebrow">Collections</p>
      <ul className="rail mt-3">
        {options.map((option) => {
          const on = option.slug === active;
          return (
            <li key={option.slug ?? "all"}>
              <Link
                to={option.slug ? `/blog?collection=${encodeURIComponent(option.slug)}` : "/blog"}
                aria-current={on ? "true" : undefined}
                className={`tap group inline-flex min-h-[44px] items-center gap-2.5 rounded-full border px-4 py-2.5 transition-colors [transition-duration:var(--dur-micro)] ${
                  on
                    ? "border-transparent bg-bone text-bitumen"
                    : "border-edge bg-surface/50 text-bone hover:border-bone/40 hover:bg-surface"
                }`}
              >
                {/* A bullet, and no longer a miniature of a sun the site no
                    longer draws. Selected inverts the whole chip, so the dot
                    takes the ground colour and the chip itself is the signal
                    — which is value doing the work a hue used to. */}
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full transition-transform [transition-duration:var(--dur-fast)] [transition-timing-function:var(--ease-settle)] motion-safe:group-hover:scale-150 ${
                    on ? "bg-bitumen" : "bg-clay"
                  }`}
                />
                <span className="text-[0.9375rem]">{option.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
