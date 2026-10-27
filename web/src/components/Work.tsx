import { Link } from "react-router-dom";
import Shot from "@/components/projects/Shot";
import Plate from "@/components/projects/Plate";
import Figure from "@/components/Figure";
import Action from "@/components/ui/Action";
import IrisPanel from "@/components/motion/IrisPanel";
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

/* The hero's portrait is plate one, so the first screenshot on the page is
   plate two. Numbering runs across the page a reader sees rather than across
   a component, which is why the offset is written here and not inside
   `Figure`. */
const PLATE_OFFSET = 2;

/*
 * min-w-0 on both grid children is load-bearing. A grid item defaults to
 * min-width:auto and will not shrink below its content's intrinsic width, which
 * pushed these to 855px inside a 350px column on a phone and clipped every line
 * of copy on the card.
 */
function Featured({ entry, index }: { entry: ProjectEntry; index: number }) {
  const { collection: c } = entry;
  const to = `/projects/${c.slug}`;
  const visit = entry.primaryLink;

  return (
    <article className="group grid items-center gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
      {/*
        The screenshot is a framed print now.

        It used to be a `Slab`: a pane leaning toward the pointer in 3D, with
        a sheen travelling across it. That was the right answer while the
        image was glass floating over a photograph. A print on paper is
        square to the reader — that is the whole premise of the frame — and
        the sheen was drawn in `--bone`, which has since become ink, so the
        highlight had already inverted into a dark smear across the picture.

        The iris stays, but inside the mount rather than around it: its
        `clip-path` would otherwise crop the frame's shadow for good, since
        the keyframe it settles on is `inset(0 0)` and that still establishes
        a clip. Opening the picture inside its own mount is also the more
        accurate gesture — the frame is already on the page, and the shutter
        reveals what is in it.
      */}
      <Figure
        index={index + PLATE_OFFSET}
        caption={c.title}
        note={entry.year ?? undefined}
        className="min-w-0"
      >
        <IrisPanel>
          <Link to={to} tabIndex={-1} aria-hidden="true" className="block">
            {c.coverImage ? (
              <Shot src={c.coverImage} alt={`${c.title} screenshot`} className={SHAPE} />
            ) : (
              /* The plate used to hardcode one project's terminal output and
               was the fallback for all of them. It now sets whatever it is
               given, so a coverless project shows its own stack. */
              <Plate className={SHAPE} title={c.title} tagline={c.tagline} tech={entry.tech} />
            )}
          </Link>
        </IrisPanel>
      </Figure>

      <div className="min-w-0">
        {/* The status is the one word in this row worth reading, so it is the
            one word at full strength. That was the accent's job here and value
            does it without introducing a colour. */}
        <div className="mono flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[rgb(var(--ink-soft))]">
          {entry.year && <span className="tabular-nums">{entry.year}</span>}
          <span className="h-px w-6 bg-[rgb(var(--rule-firm))]" aria-hidden="true" />
          <span className="text-ink">{entry.status}</span>
        </div>

        {/*
         * The title is already ink, so a hover that changed its colour had
         * nowhere left to go once the accent was retired. An underline is the
         * oldest signal a run of text is a link and it costs no hue at all.
         */}
        <h3 className="display-tight mt-3 text-3xl text-ink sm:text-4xl">
          <Link
            to={to}
            className="inline-flex min-h-11 items-center underline decoration-transparent decoration-1 underline-offset-[6px] transition-[text-decoration-color] [transition-duration:var(--dur-fast)] hover:decoration-[rgb(var(--ink-soft))] focus-visible:decoration-[rgb(var(--ink-soft))]"
          >
            {c.title}
          </Link>
        </h3>
        <p className="mt-3 text-lg text-ink/85">{c.tagline}</p>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-ink/70">{c.description}</p>

        {entry.highlights.length > 0 && (
          <ul className="mt-12 space-y-3">
            {entry.highlights.map((h) => (
              <li key={h} className="flex gap-3 text-[0.8125rem] leading-snug text-ink/85">
                <span
                  className="mt-[0.45rem] h-px w-4 shrink-0 bg-[rgb(var(--rule-firm))]"
                  aria-hidden="true"
                />
                {h}
              </li>
            ))}
          </ul>
        )}

        {entry.tech.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {/* `.chip` was drawn for a dark ground: a white border at 22% and
                a translucent `--bitumen` fill. Both of those are now invisible
                against paper, so the capsule needs a real edge and a real
                surface. The type inside it is unchanged and still measures
                6.37:1. */}
            {entry.tech.map((t) => (
              <span
                key={t}
                className="chip border-[rgb(var(--rule-firm))] bg-[rgb(var(--paper-2))] text-[rgb(var(--ink-soft))]"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-12 flex flex-wrap items-center gap-3 sm:gap-4">
          <Action tone="solid" glyph="onward" to={to}>
            The detail
          </Action>
          {visit && (
            <Action tone="outline" glyph="out" href={visit.url}>
              {visit.label}
            </Action>
          )}
          {c.repoUrl && (
            <Action tone="outline" glyph="out" href={c.repoUrl}>
              Source
            </Action>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Work() {
  const { featured } = useProjects();

  return (
    <section id="work" className="wrap section-y isolate relative">
      {/*
        The section head stacks on a phone.

        Heading, hairline and eyebrow on one row is a desktop figure: the
        heading is display type that will not shrink below its glyphs and the
        eyebrow is a sentence that must not wrap mid-phrase, so on a 390px
        screen the row simply ran off the side. Below `sm` it is two lines,
        which is what the hairline between them was standing in for anyway.
      */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:gap-6">
        <h2 className="display text-section leading-[0.9]">Work</h2>
        <span className="mb-2 hidden h-px flex-1 bg-[rgb(var(--rule-firm))] sm:block" aria-hidden="true" />
        <p className="eyebrow shrink-0 sm:mb-3">In use</p>
      </div>

      {/* Both featured items share one orientation. Alternating left/right is the
          single most recognisable portfolio-template pattern there is. */}
      <div className="mt-12 space-y-section-sm">
        {featured.map((entry, i) => (
          <Featured key={entry.collection.slug} entry={entry} index={i} />
        ))}
      </div>

      <div className="mt-section-sm">
        <Action tone="text" glyph="onward" to="/projects">
          All projects
        </Action>
      </div>
    </section>
  );
}
