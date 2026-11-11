import { useCallback, useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import { ErrorState, EmptyState, LoadingRows, PageHeader } from "@/components/admin/ui";
import EventCard from "@/components/admin/announce/EventCard";
import SettingsPanel from "@/components/admin/announce/SettingsPanel";
import { useAnnounceWords } from "@/components/admin/announce/words";
import { adminAnnounce, setUnread, type AnnounceSummary } from "@/services/adminAnnounce";

/*
 * /admin/announce: the owner's inbox of new notes and releases, each with a
 * kit of ready-to-send captions, and the settings that shape them. The
 * owner email links here. Nothing is sent from this page: every channel is a
 * button the owner presses.
 */

type View = "inbox" | "settings";

export default function AdminAnnounce() {
  const w = useAnnounceWords();
  const [view, setView] = useState<View>("inbox");
  const [items, setItems] = useState<AnnounceSummary[] | null>(null);
  const [error, setError] = useState<"load" | "auth" | null>(null);

  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    setError(null);
    setItems(null);
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    let live = true;
    adminAnnounce.inbox().then(
      (r) => live && setItems(r.items),
      (e: unknown) => live && setError(e instanceof Error && e.message === "not-authorised" ? "auth" : "load"),
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  /* The nav badge follows what the list now says. */
  useEffect(() => {
    if (items) setUnread(items.filter((e) => !e.readAt).length);
  }, [items]);

  const change = useCallback((id: string, next: AnnounceSummary | null) => {
    setItems((cur) => (cur ? (next ? cur.map((e) => (e.id === id ? next : e)) : cur.filter((e) => e.id !== id)) : cur));
  }, []);

  const unread = items?.filter((e) => !e.readAt).length ?? 0;

  return (
    <AdminShell title={w.title} section="announce">
      <div className="a-wrap">
        <PageHeader title={w.title} description={w.intro} />

        <div role="group" aria-label={w.title} className="a-tabs mb-4">
          {(["inbox", "settings"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} className="a-tab min-h-[44px]" onClick={() => setView(v)}>
              {v === "inbox" ? w.tabInbox : w.tabSettings}
              {v === "inbox" && unread > 0 && (
                <span className="a-counter">
                  <span aria-hidden="true">{unread}</span>
                  <span className="sr-only">{` ${w.unread}: ${unread}`}</span>
                </span>
              )}
            </button>
          ))}
        </div>

        {view === "settings" ? (
          <SettingsPanel />
        ) : error === "auth" ? (
          <p className="a-box a-box-row">{w.notAuthorised}</p>
        ) : error ? (
          <ErrorState message={w.loadFailed} onRetry={retry} />
        ) : items === null ? (
          <LoadingRows rows={3} />
        ) : items.length === 0 ? (
          <EmptyState title={w.emptyTitle}>
            <Megaphone aria-hidden="true" className="mx-auto mb-2 h-5 w-5" />
            {w.emptyText}
          </EmptyState>
        ) : (
          <ul className="space-y-3" aria-label={w.pagination(items.length)}>
            {items.map((e, i) => (
              <li key={e.id}>
                <EventCard event={e} defaultOpen={i === 0 && !e.readAt} onChange={(next) => change(e.id, next)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
