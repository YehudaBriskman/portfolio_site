import { useBudget, whenOf } from "../sender/useBudget";
import { useBudgetWords } from "../sender/budgetWords";

/*
 * One line about the mail budget for a campaign with `remaining` people still
 * to send to: it fits today, or it needs N days and finishes about a date, or
 * it waits for the budget. The days and the date are the server's estimate,
 * never worked out here. Renders nothing while there is nothing to say.
 */
export default function BudgetPlan({ remaining }: { remaining: number }) {
  const w = useBudgetWords();
  const b = useBudget(remaining);
  if (remaining <= 0 || b === null || b === "failed" || b.plan === undefined) return null;
  const plan = b.plan;
  const text =
    plan === null ? w.planNone
    : plan.days <= 1 && b.waiting === null ? w.planFits
    : plan.days <= 1 ? w.planWaiting(whenOf(plan.finishAt))
    : w.planDays(plan.days, whenOf(plan.finishAt));
  return (
    <p className={`text-sm tabular-nums ${plan === null ? "a-error" : "a-hint font-bold"} !mt-0`} role="status" data-testid="budget-plan">
      {text}
    </p>
  );
}
