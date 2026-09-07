import { about } from "@/data/site";
import Scenery from "@/components/scene/Scenery";

export default function Approach() {
  return (
    <section id="approach" className="isolate relative mx-auto max-w-6xl px-6 py-28 sm:py-36">
      <Scenery variant="copse" />
      <p className="eyebrow">Team lead — Israel Defense Forces</p>
      <h2 className="display-tight mt-5 text-section">{about.heading}</h2>

      <div className="mt-14 grid gap-14 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          {/* No frame and no caption: the cutout carries its own edge and fades
              into the page, so a border would only draw a box around nothing. */}
          <img
            src="/img/yehuda-cut.webp"
            srcSet="/img/yehuda-cut-sm.webp 365w, /img/yehuda-cut.webp 551w"
            sizes="(min-width: 1024px) 30vw, 62vw"
            alt="Yehuda Briskman"
            width={551}
            height={845}
            loading="lazy"
            decoding="async"
            className="pointer-events-none -mt-6 w-full max-w-[340px] select-none lg:-mt-10 lg:max-w-none"
          />

          <div className="-mt-4 space-y-5">
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
