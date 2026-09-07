import { about } from "@/data/site";

export default function Approach() {
  return (
    <section id="approach" className="relative mx-auto max-w-6xl px-6 py-28 sm:py-36">
      <p className="eyebrow">Team lead — Israel Defense Forces</p>
      <h2 className="display-tight mt-5 text-section">{about.heading}</h2>

      <div className="mt-14 grid gap-14 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <figure className="m-0">
            <div className="relative overflow-hidden border border-edge bg-surface">
              <img
                src="/img/yehuda.jpg"
                srcSet="/img/yehuda-sm.jpg 640w, /img/yehuda.jpg 1100w"
                sizes="(min-width: 1024px) 34vw, 88vw"
                alt="Yehuda Briskman on the Tel Aviv seafront at sunset"
                width={1100}
                height={1467}
                loading="lazy"
                decoding="async"
                className="block w-full"
                /* The photograph is bright and warm; the page is neither. Pulling
                   saturation and lifting the blacks toward the page ground lets it
                   sit in the palette instead of punching a hole in it. */
                style={{ filter: "saturate(0.72) contrast(1.04) brightness(0.86)" }}
              />
              {/* Ties the image into the page ground at its lower edge. */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to bottom, rgb(var(--bitumen) / 0.10) 0%, transparent 34%, rgb(var(--bitumen) / 0.55) 100%)",
                }}
              />
            </div>
            <figcaption className="mono mt-3 text-[0.625rem] uppercase tracking-[0.22em] text-clay/70">
              Tel Aviv
            </figcaption>
          </figure>

          <div className="mt-10 space-y-5">
            {about.intro.map((p) => (
              <p key={p.slice(0, 24)} className="text-sm leading-relaxed text-bone/75 sm:text-base">
                {p}
              </p>
            ))}
          </div>
        </div>

        <ul className="space-y-10 lg:pt-4">
          {about.principles.map((p) => (
            <li key={p.claim}>
              <div className="rule mb-5 w-10 bg-sodium" />
              <h3 className="display-tight text-lg leading-snug text-bone sm:text-xl">{p.claim}</h3>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-bone/65">{p.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
