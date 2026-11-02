import { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { hrefWith, type Facet, type FacetOption, type Filters as FilterSet } from "@/components/projects/catalogue";
import styles from "@/components/projects/Filters.module.css";

/*
 * State, year and stack, as links (#175). The argument for which facets and
 * how their counts are made is in `catalogue.ts`.
 *
 * Links, not buttons or checkboxes, because each choice is a URL: it can be
 * opened in a new tab, shared, and undone with Back. Pressing the active chip
 * clears that facet. Each link asks the router for a view transition, which
 * is what lets the wall re-hang with a short glide instead of a jump; the
 * stylesheet cuts that to an instant swap under any of the off-switches.
 */

const LABEL: Record<Facet, string> = { state: "State", year: "Year", stack: "Stack" };

export default function Filters({
  filters,
  options,
}: {
  filters: FilterSet;
  options: Record<Facet, FacetOption[]>;
}) {
  const any = Object.values(filters).some(Boolean);
  const facets = (Object.keys(LABEL) as Facet[]).filter((f) => options[f].length > 0);
  const nav = useRef<HTMLElement | null>(null);

  /* On a phone each row scrolls sideways, so a chosen chip can sit out of
     sight with nothing to say a filter is on. Bring it into its row, by the
     physical distance it is out by (which is right in either direction), and
     only along the row: the page itself never moves. Again whenever a chosen
     chip changes size, because the web fonts land after the first layout and
     widen every chip ahead of it. */
  useLayoutEffect(() => {
    const root = nav.current;
    if (!root) return;
    const chosen = [...root.querySelectorAll<HTMLElement>("[aria-current]")];
    const bring = () =>
      chosen.forEach((chip) => {
        const row = chip.closest("ul");
        if (!row || row.scrollWidth <= row.clientWidth) return;
        const r = row.getBoundingClientRect();
        const c = chip.getBoundingClientRect();
        const out = c.left < r.left ? c.left - r.left : c.right > r.right ? c.right - r.right : 0;
        if (out) row.scrollLeft += out;
      });
    bring();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(bring);
    chosen.forEach((chip) => observer.observe(chip));
    return () => observer.disconnect();
  }, [filters.state, filters.year, filters.stack]);

  return (
    <nav ref={nav} aria-label="Filter projects" className={styles.filters}>
      {facets.map((facet) => (
        <div key={facet} className={styles.group} role="group" aria-labelledby={`filter-${facet}`}>
          <span id={`filter-${facet}`} className={styles.label}>
            {LABEL[facet]}
          </span>
          <ul className={styles.chips} translate={facet === "stack" ? "no" : undefined}>
            {options[facet].map((o) => {
              const on = filters[facet] === o.value;
              return (
                <li key={o.value}>
                  <Link
                    to={hrefWith(filters, facet, on ? null : o.value)}
                    preventScrollReset
                    viewTransition
                    aria-current={on ? "true" : undefined}
                    className={styles.chip}
                    data-empty={o.count === 0 || undefined}
                  >
                    <span>{o.value}</span>
                    <span className={styles.count}>{o.count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {any && (
        <Link to="/projects" preventScrollReset viewTransition className={styles.clear}>
          Clear filters
        </Link>
      )}
    </nav>
  );
}
