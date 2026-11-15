import { useCallback, useEffect, useState, type ReactNode } from "react";
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
 * The five parts of the hub are reached from the sidebar (and the phone menu),
 * which is the one navigation; the page carries one h1, the part you are on.
 *
 * /admin/marketing (and /admin/announce, which redirects here: the owner
 * email links to the old address): new things to announce, one focused
 * composer per event, and the settings that shape the captions. Nothing is
 * sent from this page: every channel is a button the owner presses.
 */

/** One tab of the hub. Other parts of the hub add an entry here. */
type HubTab = { id: string; label: string; render: () => ReactNode };

/* These parts still draw their own visible heading (the part's name); until they stop, the page h1 stays "Marketing" over them so no heading is said twice. */
const OWN_HEADING = new Set(["audience", "campaigns", "library"]);

export default function AdminAnnounce() {
  const w = useMarketingWords();
  const phone = usePhone();
  const lw = useLibraryWords();
  const aw = useAudienceWords();
  const cw = useCampaignWords();
  const hi = useHubIntro();
  const [params] = useSearchParams();
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

  const tabs: HubTab[] = [
    {
      id: "inbox",
      label: w.tabInbox,
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
        {/* On a phone the inbox is the screen: its intro paragraph would push the first rows down by three lines. */}
        <PageHeader title={OWN_HEADING.has(current.id) ? w.title : current.label} description={phone && current.id === "inbox" ? undefined : (hi[current.id as keyof typeof hi] as string)} />

        <section aria-label={current.label}>
          {(current.id === "audience" || current.id === "campaigns") && <LedgerBanner />}
          {current.render()}
        </section>
      </div>
    </AdminShell>
  );
}
