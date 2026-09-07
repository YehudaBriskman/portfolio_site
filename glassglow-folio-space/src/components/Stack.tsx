import { stackGroups } from "@/data/stack";

export default function Stack() {
  return (
    <section id="stack" className="relative mx-auto max-w-6xl px-6 py-28 sm:py-36">
      <p className="eyebrow">Everything below is in a repository you can open</p>
      <h2 className="display-tight mt-5 text-section">Stack</h2>

      <div className="mt-16 grid gap-12 md:grid-cols-3">
        {stackGroups.map((g) => (
          <div key={g.title}>
            <h3 className="mono text-xs uppercase tracking-[0.22em] text-sodium">{g.title}</h3>
            <p className="mono mt-2 text-[0.6875rem] text-bone/40">{g.note}</p>
            <ul className="mt-7 space-y-2.5">
              {g.items.map((i) => (
                <li key={i} className="text-sm text-bone/80">
                  {i}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
