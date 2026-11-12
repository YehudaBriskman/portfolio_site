import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import { PageHeader } from "@/components/admin/ui";
import InboxTab from "@/components/admin/announce/inbox/InboxTab";
import { useMarketingWords } from "@/components/admin/announce/inbox/words";
import CampaignsTab from "@/components/admin/announce/campaigns/CampaignsTab";
import { useCampaignWords } from "@/components/admin/announce/campaigns/words";
import { useHubIntro } from "@/components/admin/announce/hubIntro";
import AudienceTab from "@/components/admin/announce/audience/AudienceTab";
import { useAudienceWords } from "@/components/admin/announce/audience/words";
import LibraryPanel from "@/components/admin/announce/library/LibraryPanel";
import { useLibraryWords } from "@/components/admin/announce/library/words";
import SettingsPanel from "@/components/admin/announce/SettingsPanel";
import { adminAnnounce, setUnread, type AnnounceSummary } from "@/services/adminAnnounce";

/*
 * /admin/marketing (and /admin/announce, which redirects here: the owner
 * email links to the old address): new things to announce, one focused
 * composer per event, and the settings that shape the captions. Nothing is
 * sent from this page: every channel is a button the owner presses.
 */

/** One tab of the hub. Other parts of the hub add an entry here. */
type HubTab = { id: string; label: string; badge?: number; render: () => ReactNode };

export default function AdminAnnounce() {
  const w = useMarketingWords();
  const lw = useLibraryWords();
  const aw = useAudienceWords();
  const cw = useCampaignWords();
  const hi = useHubIntro();
  const [params, setParams] = useSearchParams();
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

  const created = useCallback((ev: AnnounceSummary) => setItems((cur) => [ev, ...(cur ?? [])]), []);

  const unread = items?.filter((e) => !e.readAt).length ?? 0;

  const tabs: HubTab[] = [
    {
      id: "inbox",
      label: w.tabInbox,
      badge: unread,
      render: () => <InboxTab items={items} error={error} onRetry={retry} onChange={change} onCreated={created} />,
    },
    { id: "audience", label: aw.tab, render: () => <AudienceTab /> },
    { id: "campaigns", label: cw.tab, render: () => <CampaignsTab /> },
    { id: "library", label: lw.tab, render: () => <LibraryPanel /> },
    { id: "settings", label: w.tabSettings, render: () => <SettingsPanel /> },
  ];
  const current = tabs.find((t) => t.id === params.get("tab")) ?? tabs[0];

  return (
    <AdminShell title={w.title} section="marketing">
      <div className="a-wrap">
        <PageHeader title={w.title} description={hi[current.id as keyof typeof hi] as string} />

        <div role="group" aria-label={w.tabsLabel} className="a-tabs mb-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={current.id === t.id}
              className="a-tab min-h-[44px]"
              onClick={() => setParams(t.id === tabs[0].id ? {} : { tab: t.id }, { replace: true })}
            >
              {t.label}
              {t.badge ? (
                <span className="a-counter">
                  <span aria-hidden="true">{t.badge}</span>
                  <span className="sr-only">{` ${w.unread}: ${t.badge}`}</span>
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {current.render()}
      </div>
    </AdminShell>
  );
}
