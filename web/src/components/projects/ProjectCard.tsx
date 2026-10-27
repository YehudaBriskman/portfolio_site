import { Link } from "react-router-dom";
import Shot from "@/components/projects/Shot";
import Plate from "@/components/projects/Plate";
import ProjectFacts from "@/components/projects/ProjectFacts";
import type { ProjectEntry } from "@/hooks/useProjects";

/*
 * A featured project.
 *
 * Mobile is the design, not the fallback. The card is title → tagline →
 * evidence → open: four beats in three shapes, with the description withheld
 * on the followers because it belongs on the detail page and stacking a third
 * grey paragraph on every card is exactly what made the old page read as a
 * wall.
 *
 * The whole card is the target and it leads inward, to /projects/<slug>. The
 * old landing page linked straight out to the live product, which is why the
 * project pages never got read.
 *
 * Why the first one is built differently
 * --------------------------------------
 * Every featured card used to take one grid and one aspect ratio, so the only
 * thing separating the flagship from the rest was that it happened to be
 * printed first — and position alone is not a claim, it is an accident of
 * sorting as far as a reader can tell. The lead takes the full width of the
 * card in one column, a near-cinematic 21:9 crop that is close to the
 * screenshots' own 2.1:1 and therefore barely crops them at all, display type
 * a size up, and the three highlights that make its case. The followers keep
 * the compact side-by-side. The difference is structural, so it survives being
 * skimmed.
 *
 * Why the title no longer lights up on hover
 * ------------------------------------------
 * It used to go to the accent, and with that retired the honest replacement
 * is nothing at all: the whole card is the link, `.card:hover` already lifts
 * its border and `.card:focus-visible` already rings it, so a second signal
 * inside the target was telling the reader something they had been told. A
 * title that changes on hover also implies the title is the hit area, which
 * here it has never been.
 */
export default function ProjectCard({
  entry,
  index,
  lead = false,
  eager = false,
}: {
  entry: ProjectEntry;
  index: number;
  /** Render as the flagship: one column, wide crop, highlights. */
  lead?: boolean;
  eager?: boolean;
}) {
  const { collection: c } = entry;
  const shape = lead ? "aspect-[16/10] sm:aspect-[21/9]" : "aspect-[4/3] sm:aspect-[16/10]";
  const sizes = lead ? "(min-width: 1200px) 1120px, 100vw" : "(min-width: 1024px) 45vw, 100vw";
  const highlights = lead ? entry.highlights.slice(0, 3) : [];

  const figure = (
    <figure className="relative m-0">
      {c.coverImage ? (
        <Shot src={c.coverImage} alt={`${c.title} screenshot`} className={shape} sizes={sizes} eager={eager} />
      ) : (
        <Plate className={shape} title={c.title} tagline={c.tagline} tech={entry.tech} />
      )}
      {/* The one capsule left on a card. It sits on a photograph rather than on
          the page, so it needs a ground of its own in a way a line of type
          over the surface does not. */}
      <span className="chip chip-hot absolute left-3 top-3">
        <span className="h-1.5 w-1.5 rounded-full bg-bone" aria-hidden="true" />
        {entry.state}
      </span>
    </figure>
  );

  const open = (
    <span className="tap mono mt-5 inline-flex items-center gap-2 py-2 text-xs uppercase tracking-[0.18em] text-bone">
      Open
      <span aria-hidden="true" className="transition-transform [transition-duration:var(--dur-fast)] group-hover:translate-x-1">
        →
      </span>
    </span>
  );

  if (lead) {
    return (
      <Link to={`/projects/${c.slug}`} className="card group block overflow-hidden p-3 sm:p-4">
        {figure}
        <div className="px-2 pb-1 pt-6 sm:px-4 sm:pt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-12">
          <div className="min-w-0">
            <h2 className="display-tight text-[2rem] leading-[1.02] text-bone sm:text-[2.75rem] lg:text-[3.5rem]">
              {c.title}
            </h2>
            <p className="mt-3 text-lg leading-snug text-bone/85 sm:text-xl">{c.tagline}</p>
            <p className="mt-5 max-w-[56ch] text-sm leading-relaxed text-bone/70 sm:text-base">{c.description}</p>
          </div>

          <div className="min-w-0 pt-6 lg:pt-3">
            {highlights.length > 0 && (
              <ul className="space-y-2.5 border-t border-edge pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                {highlights.map((h) => (
                  <li key={h} className="flex gap-3 text-sm leading-snug text-bone/80">
                    <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-clay" aria-hidden="true" />
                    {h}
                  </li>
                ))}
              </ul>
            )}
            <ProjectFacts c={c} className="mt-5 lg:pl-8" />
            <span className="block lg:pl-8">{open}</span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/projects/${c.slug}`} className="card group block overflow-hidden p-3 sm:p-4">
      <div className="lg:grid lg:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-8">
        <span className="mono hidden self-start pt-3 text-xs tabular-nums text-clay lg:block" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>

        {figure}

        <div className="px-2 pb-1 pt-5 sm:px-3 sm:pt-6 lg:px-0 lg:py-4 lg:pr-3">
          <h2 className="display-tight text-[1.6rem] leading-[1.05] text-bone sm:text-3xl lg:text-[2.25rem]">
            {c.title}
          </h2>
          <p className="mt-2.5 text-base leading-snug text-bone/85 sm:text-lg">{c.tagline}</p>
          <p className="mt-4 hidden max-w-[52ch] text-sm leading-relaxed text-bone/70 sm:block">{c.description}</p>

          <ProjectFacts c={c} className="mt-5" />

          {open}
        </div>
      </div>
    </Link>
  );
}
