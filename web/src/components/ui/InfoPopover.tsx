import { useRef, useState } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMobileWords } from "@/i18n/mobile";
import styles from "@/components/ui/InfoPopover.module.css";

/*
 * The long help for one setting, behind an info button. Opened by tap, Enter
 * or Space, closed by Escape or an outside press, focus back on the button
 * (all Radix's popover). The text is in the DOM only while it is open, so the
 * row stays one line; SettingsRow gives the switch the first sentence as its
 * description so a screen reader still hears the gist. Never hover-only.
 */

export interface InfoPopoverProps {
  /** The setting's name; the button is "About <label>". */
  label: string;
  /** The long help. */
  text: string;
  className?: string;
}

export function InfoPopover({ label, text, className }: InfoPopoverProps) {
  const w = useMobileWords().settings;
  const btn = useRef<HTMLButtonElement>(null);
  /* Inside a sheet (a modal <dialog>) the panel must live in the dialog, or the top layer hides it. */
  const [host, setHost] = useState<HTMLElement | null>(null);
  return (
    <Popover onOpenChange={(o) => o && setHost(btn.current?.closest("dialog") ?? null)}>
      <PopoverTrigger asChild>
        <button ref={btn} type="button" className={[styles.button, className].filter(Boolean).join(" ")} aria-label={w.about(label)}>
          <Info size={20} strokeWidth={2} aria-hidden="true" focusable="false" />
        </button>
      </PopoverTrigger>
      <PopoverContent container={host} className={styles.panel} align="end" collisionPadding={12} aria-label={w.about(label)}>
        <p className={styles.text} dir="auto">
          {text}
        </p>
      </PopoverContent>
    </Popover>
  );
}
