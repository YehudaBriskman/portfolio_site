/*
 * What stands in for a screenshot when there is not one.
 *
 * This used to print Bothy's `$ bothy ls` service table — traefik, grafana,
 * prometheus, postgres — and it was used as the universal fallback, on the
 * cards, on the detail pages and on the landing page. So any coverless project
 * rendered Bothy's services under its own name and over its own title. A
 * fallback that is specific to one entry is not a fallback; it is a mislabel
 * waiting for the second entry to arrive.
 *
 * What replaces it is typographic and made only of what the project itself
 * already says. The stack is the strongest honest thing a console tool has to
 * show — it differentiates one plate from the next, it cannot go stale
 * independently of the data, and it never claims to be output.
 *
 * Every prop is optional because one caller passes none, and the three
 * fallbacks step down rather than off: a stack if there is one, the title's
 * initial if there is not, and a ruled field if the caller knows nothing about
 * the project at all. The last of those is the only honest thing left to draw
 * — it is a surface, not a statement — and it is still better than a blank box
 * and far better than another project's terminal output.
 */
export default function Plate({
  className = "",
  title,
  tagline,
  tech = [],
}: {
  className?: string;
  /** The project's own title. Its initial is the fallback when there is no stack. */
  title?: string;
  /** Set small under the stack, as the caption a screenshot would have had. */
  tagline?: string;
  /** Listed in two mono columns. The plate's whole content when present. */
  tech?: string[];
}) {
  const initial = title?.trim().slice(0, 1).toUpperCase() ?? "";

  return (
    <div
      className={`card-shot relative flex flex-col justify-between border border-edge p-5 sm:p-7 ${className}`}
    >
      {/* The `.sun` wash that used to sit here is gone with the accent, and
          nothing replaces it. It was borrowed from the page headers to stop
          the plate reading as an empty box, but the plate is a stand-in for a
          photograph — a coloured glow laid over one is the single clearest way
          to announce that there is no photograph. The type and the ruled field
          carry it. */}
      <span className="mono self-end text-xs uppercase tracking-[0.2em] text-clay">
        {tech.length > 0 ? "stack" : ""}
      </span>

      {tech.length > 0 ? (
        <ul className="mono grid min-w-0 grid-cols-2 gap-x-4 gap-y-1.5 text-[0.75rem] leading-relaxed text-bone/85 sm:gap-x-6 sm:text-[0.8125rem]">
          {tech.map((t) => (
            <li key={t} className="truncate">
              <span className="mr-2 text-clay" aria-hidden="true">
                ·
              </span>
              {t}
            </li>
          ))}
        </ul>
      ) : initial ? (
        <span className="display text-[clamp(3rem,14vw,6rem)] leading-none text-bone/25" aria-hidden="true">
          {initial}
        </span>
      ) : (
        /* Nothing was passed, so there is nothing true to set. A ruled field
           at least reads as a prepared surface rather than as a box that
           failed to load. */
        <span
          aria-hidden="true"
          className="block h-24 w-full opacity-60 sm:h-32"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgb(var(--edge)) 0 1px, transparent 1px 11px)",
            maskImage: "linear-gradient(to bottom, #000, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, #000, transparent)",
          }}
        />
      )}

      {tagline && <p className="mt-5 text-[0.8125rem] leading-snug text-bone/70">{tagline}</p>}
    </div>
  );
}
