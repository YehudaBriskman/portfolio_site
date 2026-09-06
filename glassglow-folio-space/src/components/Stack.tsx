import { skillCategories } from "@/data/skils";

const total = skillCategories.reduce((n, c) => n + c.skills.length, 0);

export default function Stack() {
  return (
    <section id="stack" className="relative mx-auto max-w-6xl px-6 py-28 sm:py-36">
      <p className="eyebrow">{total} tracked</p>
      <h2 className="display-tight mt-5 text-section">Stack</h2>

      <div className="mt-16 grid gap-14 md:grid-cols-3">
        {skillCategories.map((cat) => (
          <div key={cat.title}>
            <h3 className="mono text-xs uppercase tracking-[0.22em] text-sodium">{cat.title}</h3>
            <ul className="mt-7 space-y-6">
              {cat.skills.map((s) => (
                <li key={s.name}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm text-bone">{s.name}</span>
                    <span className="mono text-[0.6875rem] tabular-nums text-clay/70">{s.level}</span>
                  </div>
                  {/* Hairline rather than a filled bar: this is self-assessment,
                      and the restraint keeps it honest. */}
                  <div className="mt-2.5 h-px w-full bg-edge">
                    <div className="h-px bg-clay" style={{ width: `${s.level}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
