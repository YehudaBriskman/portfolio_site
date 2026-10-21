import { Link } from "react-router-dom";
import Shot from "@/components/projects/Shot";
import Plate from "@/components/projects/Plate";
import StatChips from "@/components/projects/StatChips";
import type { ProjectEntry } from "@/hooks/useProjects";

/*
 * A featured project.
 *
 * Mobile is the design, not the fallback. The card is title → tagline →
 * evidence → open: four beats in three shapes, with the description withheld
 * because it belongs on the detail page and stacking a third grey paragraph
 * here is exactly what made the old page read as a wall.
 *
 * 4:3 on a phone and 16:10 from `sm` up: a 4:3 box on a 350px card is 260px
 * tall and actually shows the interface, where a fixed 144px band showed a
 * stripe of it.
 *
 * The whole card is the target and it leads inward, to /projects/<slug>. The
 * old landing page linked straight out to the live product, which is why the
 * project pages never got read.
 */
export default function ProjectCard({ entry, index, eager = false }: { entry: ProjectEntry; index: number; eager?: boolean }) {
  const { collection: c } = entry;
  const shape = "aspect-[4/3] sm:aspect-[16/10]";

  return (
    <Link to={`/projects/${c.slug}`} className="card group block overflow-hidden p-3 sm:p-4">
      <div className="lg:grid lg:grid-cols-[2rem_minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-8">
        <span className="mono hidden self-start pt-3 text-xs tabular-nums text-clay lg:block" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>

        <figure className="relative m-0">
          {c.coverImage ? (
            <Shot src={c.coverImage} alt={`${c.title} screenshot`} className={shape} eager={eager} />
          ) : (
            <Plate className={shape} />
          )}
          <span className="chip chip-hot absolute left-3 top-3">
            <span className="h-1.5 w-1.5 rounded-full bg-sodium" aria-hidden="true" />
            {entry.state}
          </span>
        </figure>

        <div className="px-2 pb-1 pt-5 sm:px-3 sm:pt-6 lg:px-0 lg:py-4 lg:pr-3">
          <h2 className="display-tight text-[1.6rem] leading-[1.05] text-bone transition-colors [transition-duration:var(--dur-micro)] group-hover:text-sodium sm:text-3xl lg:text-[2.5rem]">
            {c.title}
          </h2>
          <p className="mt-2.5 text-base leading-snug text-bone/85 sm:text-lg">{c.tagline}</p>
          <p className="mt-4 hidden max-w-[52ch] text-sm leading-relaxed text-bone/70 sm:block">{c.description}</p>

          <StatChips c={c} className="mt-5" />

          <span className="tap mono mt-5 inline-flex items-center gap-2 py-2 text-xs uppercase tracking-[0.18em] text-sodium">
            Open
            <span aria-hidden="true" className="transition-transform [transition-duration:var(--dur-fast)] group-hover:translate-x-1">
              →
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
