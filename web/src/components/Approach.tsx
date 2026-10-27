import { about } from "@/data/site";

export default function Approach() {
  return (
    <section id="approach" className="wrap section-y isolate relative">
      <div>
        <h2 className="display text-section leading-[0.92]">{about.heading}</h2>
        <p className="eyebrow mt-3">Team lead &middot; Israel Defense Forces</p>
      </div>

      {/* The portrait moved to the hero, so this reads as one measured column of
          prose instead of text wrapped around an image. Wider leading and a
          longer measure, because the previous setting was small type packed
          into a narrow well — technically readable, actually skipped. */}
      <div className="mt-12 max-w-2xl space-y-6">
        {about.intro.map((p) => (
          <p key={p.slice(0, 24)} className="text-lg leading-[1.7] text-bone/85">
            {p}
          </p>
        ))}
      </div>

      <ul className="mt-section-sm grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
        {about.principles.map((p, i) => (
          <li key={p.claim} className="min-w-0">
            <span className="mono block text-xs tabular-nums text-clay" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            {/* `.rule` is --edge, which is a hairline measured against the flat
                ground. This one sits on a photograph, where --edge is simply
                not there, so the divider carries bone at low alpha instead —
                the same trick the glass surfaces use to stay visible over a
                picture without becoming a bright line on one. */}
            <div className="my-3 h-px w-10 bg-bone/40" />
            <h3 className="display-tight text-xl leading-snug text-bone">{p.claim}</h3>
            <p className="mt-6 text-base leading-[1.7] text-bone/70">{p.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
