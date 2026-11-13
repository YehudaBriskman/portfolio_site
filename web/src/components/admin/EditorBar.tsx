import type { ReactNode } from "react";
import { Ellipsis } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAdminWords } from "@/i18n/admin";

/*
 * An editor's bottom bar, always one row.
 *
 * It used to hold a status line and every button, which wrapped to three rows
 * at 320px and took a quarter of the screen. Now: a dot with the status as
 * text (visible where there is room, always read out), the secondary actions
 * behind one 44px menu button, and the single primary action. The row's
 * height is set in index.css (`.a-bar-row`) so it can be held to one row
 * without measuring.
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

type Props = {
  tone: BarTone;
  /** The status, in words. Hidden on a narrow bar unless it is a problem. */
  status: string;
  /** The primary action: one button. */
  primary: ReactNode;
  /** Everything else. No menu is drawn when this is empty. */
  more?: BarAction[];
};

export default function EditorBar({ tone, status, primary, more = [] }: Props) {
  const w = useAdminWords();
  const problem = tone === "bad" || tone === "warn";

  return (
    <div className="a-bar-row">
      <span
        className="a-bar-status"
        data-tone={tone}
        role="status"
        aria-live={tone === "bad" ? "assertive" : "polite"}
        title={status || undefined}
      >
        <span className="a-dot a-bar-dot" aria-hidden="true" />
        <span className="a-bar-status-text" data-problem={problem || undefined}>
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
