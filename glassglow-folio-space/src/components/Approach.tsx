import { about } from "@/data/site";

export default function Approach() {
  return (
    <section id="approach" className="relative mx-auto max-w-6xl px-6 py-28 sm:py-36">
      <p className="eyebrow">Team lead — Israel Defense Forces</p>
      <h2 className="display-tight mt-5 text-section">{about.heading}</h2>

      <div className="mt-14 grid gap-14 lg:grid-cols-[1fr_1.2fr]">
        <div className="max-w-md space-y-5">
          {about.intro.map((p) => (
            <p key={p.slice(0, 24)} className="text-sm leading-relaxed text-bone/75 sm:text-base">
              {p}
            </p>
          ))}
        </div>

        <ul className="space-y-10">
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
