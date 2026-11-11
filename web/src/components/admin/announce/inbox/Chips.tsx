import { AlertTriangle, Check, CircleHelp } from "lucide-react";
import type { PreviewIssue } from "@/services/adminAnnounce";
import { sortIssues, type Readiness } from "./readiness";
import { useMarketingWords } from "./words";

/* One short word per problem; the long explanation is in the Checks drawer. Colour is never the only signal: each chip carries an icon and its words. */
export function IssueChips({ issues, max = 2 }: { issues: PreviewIssue[]; max?: number }) {
  const w = useMarketingWords();
  const sorted = sortIssues(issues);
  if (sorted.length === 0)
    return (
      <span className="mk-chip" data-tone="ok" title={w.readyChipLong}>
        <Check aria-hidden="true" />
        {w.readyChip}
      </span>
    );
  const shown = sorted.slice(0, max);
  const rest = sorted.slice(max);
  return (
    <>
      {shown.map((i) => (
        <span key={i.code} className="mk-chip" data-tone={i.severity}>
          <AlertTriangle aria-hidden="true" />
          {w.chips[i.code]}
        </span>
      ))}
      {rest.length > 0 && (
        <span className="mk-chip" data-tone="more" title={rest.map((i) => w.chips[i.code]).join(", ")}>
          <span dir="ltr">{w.moreChips(rest.length)}</span>
          <span className="sr-only">{`: ${rest.map((i) => w.chips[i.code]).join(", ")}`}</span>
        </span>
      )}
    </>
  );
}

export function ReadinessChips({ readiness, max }: { readiness: Readiness | undefined; max?: number }) {
  const w = useMarketingWords();
  if (!readiness || readiness.state === "loading")
    return (
      <span className="mk-chip" data-tone="muted" role="status">
        {w.checking}
      </span>
    );
  if (readiness.state === "failed")
    return (
      <span className="mk-chip" data-tone="muted">
        <CircleHelp aria-hidden="true" />
        {w.checkFailed}
      </span>
    );
  return <IssueChips issues={readiness.issues} max={max} />;
}
