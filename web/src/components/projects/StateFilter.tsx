import { Link } from "react-router-dom";

import type { StateOption } from "@/components/projects/catalogue";

/* The argument for when this appears, and why state and not year, is in
   `catalogue.ts`. */
export default function StateFilter({
  states,
  total,
  active,
}: {
  states: StateOption[];
  total: number;
  active: string | null;
}) {
  const options: { state: string | null; label: string; count: number }[] = [
    { state: null, label: "All", count: total },
    ...states.map((s) => ({ state: s.state, label: s.state, count: s.count })),
  ];

  return (
    <nav aria-label="Filter projects by state" className="mt-12">
      <ul className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = o.state === active;
          return (
            <li key={o.state ?? "all"}>
              <Link
                to={o.state ? `/projects?state=${encodeURIComponent(o.state)}` : "/projects"}
                preventScrollReset
                aria-current={on ? "true" : undefined}
                className={`tap inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2.5 text-[0.9375rem] transition-colors [transition-duration:var(--dur-micro)] ${
                  on
                    ? "border-ink bg-ink text-paper"
                    : "border-[rgb(var(--rule-firm))] text-ink hover:border-ink hover:bg-ink/5"
                }`}
              >
                <span>{o.label}</span>
                <span className="tabular-nums opacity-80">{o.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
