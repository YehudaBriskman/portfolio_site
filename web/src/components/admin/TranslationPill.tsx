import { useAdminWords } from "@/i18n/admin";
import type { TranslationStatus } from "@/services/translations";

/*
 * The Hebrew pill (#302, design §7.2): one component in every list row, every
 * editor header and the Translations page. Text plus a shape, never colour
 * alone: `HE ✓`, `HE stale`, `HE draft`, `HE —`. The colour is a wash behind
 * the words (index.css, "the Hebrew pill"); unverified Hebrew reads as done,
 * with a dashed outline.
 *
 * The visible text is a code; the full sentence is what a screen reader hears
 * and what the tooltip shows. `null` (nothing to translate) renders nothing.
 */
export default function TranslationPill({ status, className = "" }: { status: TranslationStatus | null | undefined; className?: string }) {
  const w = useAdminWords();
  if (!status) return null;
  return (
    <span className={`a-pill a-he ${className}`.trimEnd()} data-he={status} title={w.heLong[status]}>
      <span aria-hidden="true" lang="en">
        {w.he[status]}
      </span>
      <span className="sr-only">{w.heLong[status]}</span>
    </span>
  );
}
