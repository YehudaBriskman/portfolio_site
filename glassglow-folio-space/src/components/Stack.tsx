import { stackGroups } from "@/data/stack";

export default function Stack() {
  return (
    <section id="stack" className="relative mx-auto max-w-6xl px-6 py-28 sm:py-36">
      <div className="text-center">
        <p className="eyebrow">Everything below is in a repository you can open</p>
        <h2 className="display mx-auto mt-4 text-section leading-[0.92]">Stack</h2>
        <span className="mx-auto mt-7 block h-px w-16 bg-sodium" aria-hidden="true" />
      </div>

      <div className="mt-16 grid gap-12 md:grid-cols-3">
        {stackGroups.map((g) => (
          <div key={g.title}>
            {/* Bone, not sodium: at 12px on a ground that changes colour as you
                scroll, the accent measured 4.0:1 against the pale band. The
                sodium stays as the rule above it, where size is not the issue. */}
            <div className="rule mb-3 w-8 bg-sodium" />
            <h3 className="mono text-xs uppercase tracking-[0.22em] text-bone">{g.title}</h3>
            <p className="mono mt-2 text-[0.6875rem] text-clay">{g.note}</p>
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
