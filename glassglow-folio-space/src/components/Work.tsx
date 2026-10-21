import { Link } from "react-router-dom";
import Scenery from "@/components/scene/Scenery";
import Shot from "@/components/projects/Shot";
import Plate from "@/components/projects/Plate";
import { useProjects, type ProjectEntry } from "@/hooks/useProjects";

/*
 * The landing page argues; /projects catalogues.
 *
 * So this holds the two things people actually use, with the highlights that
 * make the case, and nothing else. The earlier-work drawer that used to sit at
 * the foot of this section now lives on /projects, which is the only place it
 * was ever going to be read — keeping it in both was the same list twice.
 *
 * Both titles link inward. Sending the only project affordance on the home page
 * straight out to windom.app is why the project pages never got any traffic;
 * the outbound links are still here, one rank down.
 */

const SHAPE = "aspect-[4/3] sm:aspect-[16/10]";

/*
 * min-w-0 on both grid children is load-bearing. A grid item defaults to
 * min-width:auto and will not shrink below its content's intrinsic width, which
 * pushed these to 855px inside a 350px column on a phone and clipped every line
 * of copy on the card.
 */
function Featured({ entry }: { entry: ProjectEntry }) {
  const { collection: c } = entry;
  const to = `/projects/${c.slug}`;
  const visit = entry.primaryLink;

  return (
    <article className="group grid items-center gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
      <figure className="m-0 min-w-0">
        <Link to={to} tabIndex={-1} aria-hidden="true" className="block">
          {c.coverImage ? (
            <Shot src={c.coverImage} alt={`${c.title} screenshot`} className={SHAPE} />
          ) : (
            <Plate className={SHAPE} />
          )}
        </Link>
      </figure>

      <div className="min-w-0">
        <div className="mono flex items-center gap-3 text-[0.6875rem] uppercase tracking-[0.2em] text-clay">
          {entry.year && <span className="tabular-nums">{entry.year}</span>}
          <span className="h-px w-6 bg-edge" aria-hidden="true" />
          <span className="text-sodium">{entry.status}</span>
        </div>

        <h3 className="display-tight mt-4 text-3xl text-bone sm:text-4xl">
          <Link to={to} className="inline-flex min-h-11 items-center transition-colors hover:text-sodium focus-visible:text-sodium">
            {c.title}
          </Link>
        </h3>
        <p className="mt-3 text-lg text-bone/85">{c.tagline}</p>
        <p className="mt-5 max-w-md text-sm leading-relaxed text-bone/70">{c.description}</p>

        {entry.highlights.length > 0 && (
          <ul className="mt-6 space-y-2">
            {entry.highlights.map((h) => (
              <li key={h} className="flex gap-3 text-[0.8125rem] leading-snug text-bone/85">
                <span className="mt-[0.45rem] h-px w-4 shrink-0 bg-sodium" aria-hidden="true" />
                {h}
              </li>
            ))}
          </ul>
        )}

        {entry.tech.length > 0 && (
          <div className="mt-7 flex flex-wrap gap-2">
            {entry.tech.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={to} className="btn btn-solid">
            The detail <span aria-hidden="true">→</span>
          </Link>
          {visit && (
            <a href={visit.url} target="_blank" rel="noreferrer noopener" className="btn btn-quiet">
              {visit.label} <span aria-hidden="true">↗</span>
            </a>
          )}
          {c.repoUrl && (
            <a href={c.repoUrl} target="_blank" rel="noreferrer noopener" className="btn btn-quiet">
              Source <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Work() {
  const { featured } = useProjects();

  return (
    <section id="work" className="isolate relative mx-auto max-w-6xl px-5 py-28 sm:px-6 sm:py-36">
      <Scenery variant="ridge" />
      <div className="flex items-end gap-6">
        <h2 className="display text-section leading-[0.9]">Work</h2>
        <span className="mb-2 hidden h-px flex-1 bg-edge sm:block" aria-hidden="true" />
        <p className="eyebrow mb-3 shrink-0">In use</p>
      </div>

      {/* Both featured items share one orientation. Alternating left/right is the
          single most recognisable portfolio-template pattern there is. */}
      <div className="mt-16 space-y-28">
        {featured.map((entry) => (
          <Featured key={entry.collection.slug} entry={entry} />
        ))}
      </div>

      <Link to="/projects" className="btn btn-quiet mt-24">
        All projects <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
