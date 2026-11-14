import { useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast, useToastHistory } from "@/lib/toast";
import { useToastWords } from "@/i18n/toast";
import { useLang } from "@/components/dashboard/i18n";
import styles from "./NotificationsMenu.module.css";

/*
 * The admin top bar's Notifications: what the toasts said this session, in
 * case one went by too fast. Memory only (the service keeps the last 30 and
 * never their details), cleared on sign-out. A dot, not a number, for "new":
 * nothing here is urgent enough to count.
 */
export default function NotificationsMenu({ className = "" }: { className?: string }) {
  const w = useToastWords();
  const lang = useLang();
  const { entries, unread } = useToastHistory();
  const [open, setOpen] = useState(false);
  const time = new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) toast.markRead();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`a-btn a-btn-ghost a-icon-btn ${styles.trigger} ${className}`}
          aria-label={unread ? w.notificationsUnread(unread) : w.notifications}
          data-unread={unread ? "" : undefined}
        >
          <Bell aria-hidden="true" />
          {unread > 0 && <span className={styles.dot} aria-hidden="true" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-1.5rem)] p-0">
        <div className="pop-head flex items-center justify-between gap-2 px-3 py-2">
          <h2 className="m-0 text-sm font-semibold">{w.notifications}</h2>
          {entries.length > 0 && (
            <button type="button" className="a-btn a-btn-ghost" onClick={() => toast.clearHistory()}>
              {w.clear}
            </button>
          )}
        </div>
        {entries.length === 0 ? (
          <p className="m-0 px-3 py-4 text-sm">{w.none}</p>
        ) : (
          <ul className="m-0 max-h-80 list-none overflow-auto p-0">
            {entries.map((e) => (
              <li key={e.id} className="border-t px-3 py-2 text-sm" style={{ borderColor: "var(--pop-rule)" }}>
                <p className="m-0 font-semibold">
                  <span className="sr-only">{w.kind[e.kind]}: </span>
                  {e.title}
                </p>
                {e.description && <p className="m-0 opacity-80">{e.description}</p>}
                <time className="tabular-nums text-sm opacity-70" dateTime={new Date(e.at).toISOString()}>
                  {time.format(e.at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
