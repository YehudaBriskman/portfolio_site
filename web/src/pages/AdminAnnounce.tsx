import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import { PageHeader } from "@/components/admin/ui";
import InboxTab from "@/components/admin/announce/inbox/InboxTab";
import { useMarketingWords } from "@/components/admin/announce/inbox/words";
import CampaignsTab from "@/components/admin/announce/campaigns/CampaignsTab";
import { useCampaignWords } from "@/components/admin/announce/campaigns/words";
import { useHubIntro } from "@/components/admin/announce/hubIntro";
import LedgerBanner from "@/components/admin/announce/audience/LedgerBanner";
import AudienceTab from "@/components/admin/announce/audience/AudienceTab";
import { useAudienceWords } from "@/components/admin/announce/audience/words";
import LibraryPanel from "@/components/admin/announce/library/LibraryPanel";
import { useLibraryWords } from "@/components/admin/announce/library/words";
import SettingsPanel from "@/components/admin/announce/SettingsPanel";
import { usePhone } from "@/hooks/usePhone";
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
  const phone = usePhone();
  const lw = useLibraryWords();
  const aw = useAudienceWords();
  const cw = useCampaignWords();
  const hi = useHubIntro();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<AnnounceSummary[] | null>(null);
  const [error, setError] = useState<"load" | "auth" | null>(null);
  const [attempt, setAttempt] = useState(0);
  const uid = useId();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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

  const pick = (id: string) => setParams(id === tabs[0].id ? {} : { tab: id }, { replace: true });
  /* Arrows follow reading order, so they swap in Hebrew; the tab you land on takes focus as well as selection. */
  const onTabKey = (e: KeyboardEvent) => {
    const rtl = document.documentElement.dir === "rtl";
    const step = e.key === "ArrowRight" ? (rtl ? -1 : 1) : e.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
    const at = tabs.indexOf(current);
    const to = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : step ? (at + step + tabs.length) % tabs.length : -1;
    if (to < 0) return;
    e.preventDefault();
    pick(tabs[to].id);
    tabRefs.current[tabs[to].id]?.focus();
  };

  return (
    <AdminShell title={w.title} section="marketing">
      <div className="a-wrap">
        {/* On a phone the inbox is the screen: its intro paragraph would push the first rows down by three lines. */}
        <PageHeader title={phone ? current.label : w.title} description={phone && current.id === "inbox" ? undefined : (hi[current.id as keyof typeof hi] as string)} />

        {!phone && (
        <div role="tablist" aria-label={w.tabsLabel} className="a-tabs mb-4" onKeyDown={onTabKey}>
          {tabs.map((t) => (
            <button
              key={t.id}
              ref={(el) => void (tabRefs.current[t.id] = el)}
              id={`${uid}-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={current.id === t.id}
              aria-controls={`${uid}-panel`}
              tabIndex={current.id === t.id ? 0 : -1}
              className="a-tab min-h-[44px]"
              onClick={() => pick(t.id)}
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
        )}

        <div role="tabpanel" id={`${uid}-panel`} {...(phone ? { "aria-label": current.label } : { "aria-labelledby": `${uid}-tab-${current.id}` })}>
          {(current.id === "audience" || current.id === "campaigns") && <LedgerBanner />}
          {current.render()}
        </div>
      </div>
    </AdminShell>
  );
}
