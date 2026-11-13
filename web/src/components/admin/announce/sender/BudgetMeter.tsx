import { useId } from "react";
import { useBudget, whenOf } from "./useBudget";
import { useBudgetWords } from "./budgetWords";

const nf = new Intl.NumberFormat("en-GB");

/*
 * Settings > Mail budget: what the last 24 hours and this month have used of
 * what campaigns may use. Numbers are the server's, counts only. Numerals are
 * tabular and left-to-right in both languages.
 */
export default function BudgetMeter({ refresh = 0 }: { refresh?: number }) {
  const w = useBudgetWords();
  const uid = useId();
  const b = useBudget(undefined, refresh);
  if (b === null) return <p className="a-hint !mt-0" role="status">{w.loading}</p>;
  if (b === "failed") return <p className="a-error !mt-0" role="alert">{w.loadFailed}</p>;
  const row = (id: string, label: string, used: number, usable: number, extra?: string) => (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span id={`${uid}-${id}`} className="a-label !mt-0">{label}</span>
        <span className="font-bold tabular-nums">{w.of(nf.format(used), nf.format(usable))}</span>
      </div>
      <progress className="h-3 w-full" max={Math.max(usable, 1)} value={Math.min(used, Math.max(usable, 1))} aria-labelledby={`${uid}-${id}`} />
      {extra && <p className="a-hint !mt-0 tabular-nums">{extra}</p>}
    </div>
  );
  return (
    <div className="a-box space-y-3 p-3" data-testid="budget-meter">
      <p className="font-bold">{w.meterHeading}</p>
      {row("d", w.today, b.today.used, b.today.usable, w.reserved(b.today.reserve))}
      {row("m", w.month, b.month.used, b.month.usable)}
      <p className="text-sm tabular-nums" role="status" data-testid="budget-room">
        {b.waiting === "day" && b.resumeAt ? w.waitDay(whenOf(b.resumeAt)) : b.waiting === "month" && b.resumeAt ? w.waitMonth(whenOf(b.resumeAt)) : w.room(b.capacity)}
      </p>
      {b.thresholds.length > 0 && <p className="text-sm font-bold" role="status" data-testid="budget-threshold">{b.thresholds.includes(90) ? w.t90 : w.t70}</p>}
      <p className="a-hint !mt-0">{w.meterNote}</p>
    </div>
  );
}
