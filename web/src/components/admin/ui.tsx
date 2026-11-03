import { useState, type ReactNode } from "react";
import { fullDate, relative, useLang } from "@/components/dashboard/i18n";
import { useAdminWords } from "@/i18n/admin";

/*
 * The admin's shared parts (#288): the page header, the status pill, a
 * relative time with the absolute one beside it, and the three states every
 * list has besides its rows. One of each, so a draft looks like a draft on
 * every screen and "loading" reads the same everywhere.
 *
 * The look is in index.css under "admin": GitHub's density and structure,
 * the site's own tokens, so it follows the theme and the accent preset.
 */

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Right-hand buttons; they wrap under the title on a phone. */
  actions?: ReactNode;
  /** A line under the title: a status pill, a path. */
  meta?: ReactNode;
}) {
  return (
    <div className="a-page-head">
      <div className="min-w-0 flex-[1_1_18rem]">
        <h1 className="a-h1">{title}</h1>
        {meta && <div className="a-page-meta">{meta}</div>}
        {description && <p className="a-page-desc">{description}</p>}
      </div>
      {actions && <div className="a-page-actions">{actions}</div>}
    </div>
  );
}

export type PillState = "published" | "draft" | "archived" | "hidden" | "changes" | "active" | "revoked" | "expired";

/** A status in a word and a shape, never colour alone. */
export function StatePill({ state, className = "" }: { state: PillState; className?: string }) {
  const w = useAdminWords();
  return (
    <span className={`a-pill ${className}`.trimEnd()} data-state={state}>
      <span className="a-pill-mark" aria-hidden="true" />
      {w.status[state]}
    </span>
  );
}

/** "3 hours ago", with the date and time in its title and its datetime. */
export function RelTime({ iso, now }: { iso: string | null | undefined; now?: number }) {
  const lang = useLang();
  const [mounted] = useState(() => Date.now());
  const w = useAdminWords();
  if (!iso || Number.isNaN(Date.parse(iso))) return <Empty label={w.notSet} />;
  return (
    <time dateTime={iso} title={fullDate(iso, lang)} className="tabular-nums">
      {relative(iso, now ?? mounted, lang)}
    </time>
  );
}

/** The one empty placeholder: a dash with a name a screen reader can say. */
export function Empty({ label }: { label?: string }) {
  const w = useAdminWords();
  return (
    <span className="a-empty-value" role="img" aria-label={label ?? w.none}>
      —
    </span>
  );
}

export function LoadingRows({ rows = 4, label }: { rows?: number; label?: string }) {
  const w = useAdminWords();
  return (
    <div className="a-box" aria-busy="true">
      <p className="sr-only" role="status">
        {label ?? w.loading}
      </p>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="a-skel-row" aria-hidden="true">
          <span className="a-skel" style={{ width: `${40 + ((i * 17) % 35)}%` }} />
          <span className="a-skel a-skel-sm" style={{ width: `${18 + ((i * 11) % 20)}%` }} />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const w = useAdminWords();
  return (
    <div className="a-box a-blank" role="alert">
      <p className="a-blank-title">{w.loadFailed}</p>
      <p className="a-blank-text">{message}</p>
      {onRetry && (
        <button type="button" className="a-btn mt-3" onClick={onRetry}>
          {w.retry}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="a-box a-blank">
      <p className="a-blank-title">{title}</p>
      {children && <div className="a-blank-text">{children}</div>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/** The count beside a nav item or a tab: GitHub's Counter. */
export function Counter({ n }: { n: number | undefined }) {
  if (n === undefined) return null;
  return <span className="a-counter">{new Intl.NumberFormat("en-GB").format(n)}</span>;
}
