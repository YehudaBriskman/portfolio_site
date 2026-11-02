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
                /*
                 * `border-clay` — --ink-soft, 7.35:1 on the chip's fill —
                 * rather than the `border-edge` that was here. A chip is a
                 * control, and WCAG 1.4.11 asks 3:1 of a control's boundary;
                 * --rule measures 1.55:1 on this fill, so the unselected
                 * chips were a row of words with nothing round them while
                 * the selected one was a solid black capsule. Half the
                 * difference between the two states was the border simply
                 * not being drawn.
                 *
                 * Written in the roles, not in paper's own names, since the
                 * rail moved onto the notes room (#179): `bg-white/70` and
                 * `text-paper` are paper whatever the ground, and on the room
                 * they made a white chip with the room's light ink on it.
                 * The raised surface (`--canvas-2`), `--ink-soft` for the
                 * edge and `--ink` for the word re-point with the ground —
                 * on the room the edge is 6.14:1 and the word 13.39:1 on the
                 * chip; selected inverts to ink with the ground's own colour
                 * in it, 15.25:1.
                 */
                className={`tap group inline-flex min-h-[44px] items-center gap-2.5 rounded-full border px-4 py-2.5 transition-colors [transition-duration:var(--dur-micro)] ${
                  on
                    ? "border-ink bg-ink text-[rgb(var(--canvas))]"
                    : "border-ink-soft bg-[rgb(var(--canvas-2))] text-ink hover:border-ink hover:bg-ink/10"
                }`}
              >
                {/* A bullet, and no longer a miniature of a sun the site no
                    longer draws. Selected inverts the whole chip, so the dot
                    takes the ground colour and the chip itself is the signal
                    — which is value doing the work a hue used to. */}
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full transition-transform [transition-duration:var(--dur-fast)] [transition-timing-function:var(--ease-settle)] motion-safe:group-hover:scale-150 ${
                    on ? "bg-[rgb(var(--canvas))]" : "bg-ink-soft"
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
