import { useEffect, useState, type ReactNode } from "react";
import { CircleAlert, CircleDashed, Check, Ellipsis, Loader, TriangleAlert, type LucideIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAdminWords } from "@/i18n/admin";
import styles from "./EditorBar.module.css";

/*
 * An editor's bottom bar, always one row.
 *
 * It used to hold a status line and every button, which wrapped to three rows
 * at 320px and took a quarter of the screen. Now: where the document stands
 * (one word, when the caller has one), the save state as a glyph with its
 * words (drawn on a narrow bar only for a moment after they change, or while
 * they are a problem, and always read out), the secondary actions behind one
 * 44px menu button, and the single primary action. The row's height is set in
 * index.css (`.a-bar-row`) so it can be held to one row without measuring.
 */

export type BarTone = "idle" | "busy" | "ok" | "warn" | "bad";

export type BarAction = {
  key: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** A keyboard shortcut the action also answers to, for assistive tech. */
  shortcut?: string;
};

/** How long a narrow bar draws the save words after they change. */
export const FLASH_MS = 3000;

const GLYPH: Record<BarTone, LucideIcon> = {
  idle: CircleDashed,
  busy: Loader,
  ok: Check,
  warn: TriangleAlert,
  bad: CircleAlert,
};

type Props = {
  tone: BarTone;
  /** The save state, in words. */
  status: string;
  /** Where the document stands ("Draft", "Published"), said here and nowhere else on the page. */
  label?: string;
  /** The primary action: one button. */
  primary: ReactNode;
  /** Everything else. No menu is drawn when this is empty. */
  more?: BarAction[];
};

export default function EditorBar({ tone, status, label, primary, more = [] }: Props) {
  const w = useAdminWords();
  const problem = tone === "bad" || tone === "warn";
  const Glyph = GLYPH[tone];

  /* The words show for a moment after they change: state first, a timer drops it. */
  const [seen, setSeen] = useState(status);
  const [flash, setFlash] = useState(Boolean(status));
  if (seen !== status) {
    setSeen(status);
    setFlash(Boolean(status));
  }
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(false), FLASH_MS);
    return () => window.clearTimeout(t);
  }, [flash, status]);

  return (
    <div className="a-bar-row">
      {label && <span className={styles.doc}>{label}</span>}
      <span
        className="a-bar-status"
        data-tone={tone}
        role="status"
        aria-live={tone === "bad" ? "assertive" : "polite"}
        title={status || undefined}
      >
        {status && <Glyph className={styles.glyph} aria-hidden="true" />}
        <span className={styles.word} data-show={problem || flash || undefined}>
          {status}
        </span>
      </span>
      {more.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="a-btn a-bar-more" aria-label={w.moreActions}>
              <Ellipsis aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="min-w-[12rem]">
            {more.map((a) => (
              <DropdownMenuItem
                key={a.key}
                className="min-h-11"
                disabled={a.disabled}
                aria-keyshortcuts={a.shortcut}
                onSelect={a.onSelect}
              >
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {primary}
    </div>
  );
}
