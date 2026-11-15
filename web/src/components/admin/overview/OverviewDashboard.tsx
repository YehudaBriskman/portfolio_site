import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { relative, useLang } from "@/components/dashboard/i18n";
import { CollapsibleRow, useCollapsibleRows } from "@/components/ui/CollapsibleRow";
import { Icon } from "@/components/ui/Icon";
import { ICON } from "@/components/ui/icons";
import { KpiTile } from "@/components/ui/KpiTile";
import { MiniBar } from "@/components/ui/MiniBar";
import { Panel } from "@/components/ui/Panel";
import { PanelGrid, PanelScope } from "@/components/ui/PanelGrid";
import { QuickLinks, type QuickLink } from "@/components/ui/QuickLinks";
import { RecordRow } from "@/components/ui/RecordRow";
import { StatusGlyph, type StatusKind } from "@/components/ui/StatusGlyph";
import { added, weeklyTotals } from "@/components/admin/overview/series";
import { useNeeds } from "@/components/admin/overview/useNeeds";
import { bytes } from "@/components/admin/format";
import { useAdminWords, type AdminWords } from "@/i18n/admin";
import { usePhoneAdminWords } from "@/i18n/adminPhone";
import { useOverviewWords } from "@/i18n/overview";
import { numberIn } from "@/i18n/words";
import type { AdminCollection, AdminPost, McpGrant } from "@/services/admin";
import type { Campaign } from "@/services/adminCampaigns";
import { TRANSLATION_STATUSES } from "@/services/translations";
import type { MediaItem } from "@/services/media";
import styles from "@/components/admin/overview/overview.module.css";

/*
 * /admin as a dashboard (D1, #858). Row 1: what needs the owner and seven KPI
 * tiles. Row 2: recent change, quick links, campaigns. Row 3 (closed): Hebrew
 * coverage and media use. Every panel links into its screen and expands to full
 * size (V). Nothing is drawn that the API did not give: a sparkline needs real
 * dates, a failed source shows a dash.
 */

export type FeedItem = {
  id: string;
  at: string;
  kind: keyof AdminWords["kind"];
  did: keyof AdminWords["did"];
  title: string;
  to: string;
};

const KIND_ICON: Record<FeedItem["kind"], typeof ICON.note> = {
  post: ICON.note,
  projects: ICON.project,
  story: ICON.story,
  "site-copy": ICON.language,
  settings: ICON.everyday,
  media: ICON.image,
  app: ICON.connectedApp,
};

const ROWS = { glance: true, activity: true, coverage: false };
const RECENT_SHOWN = 6;
const CAMPAIGNS_SHOWN = 5;
const RANK: Record<string, number> = { sending: 0, paused: 1, failed: 2, scheduled: 3, draft: 4, sent: 5, canceled: 6 };

export default function OverviewDashboard({
  posts, areas, media, grants, feed, loading,
}: {
  posts: AdminPost[] | null;
  areas: AdminCollection[] | null;
  media: MediaItem[] | null;
  grants: McpGrant[] | null;
  feed: FeedItem[];
  loading: boolean;
}) {
  const w = useAdminWords();
  const p = usePhoneAdminWords().overview;
  const o = useOverviewWords();
  const lang = useLang();
  const go = useNavigate();
  const [now] = useState(() => Date.now());
  const { unread, failed, campaigns, translations } = useNeeds();
  const rows = useCollapsibleRows("overview", ROWS);
  const num = (n: number) => numberIn(lang, n);
  const dash = "—";

  const published = posts?.filter((x) => x.status === "published") ?? [];
  const drafts = posts?.filter((x) => x.status === "draft") ?? [];
  const changes = published.filter((x) => x.draft);
  const waiting = [...drafts, ...changes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const active = grants?.filter((g) => g.status === "active") ?? [];
  const shown = areas?.filter((a) => a.status !== "hidden").length ?? 0;

  /* ---- needs you */
  const needs: ReactNode[] = [];
  if (unread !== null && unread > 0) {
    const what = p.unread(unread);
    needs.push(
      <RecordRow key="inbox" as="li" icon={ICON.announcement} title={p.inboxTitle} unread facts={[{ text: what }]}
        openLabel={`${p.openItem(p.inboxTitle)} ${what}`} onOpen={() => go("/admin/marketing")} />,
    );
  }
  if (waiting.length > 0) {
    const what = p.waiting(waiting.length);
    const when = relative(waiting[0].draftSavedAt ?? waiting[0].updatedAt, now, lang);
    needs.push(
      <RecordRow key="drafts" as="li" icon={ICON.draft} title={p.draftsTitle} facts={[{ text: what }, { icon: ICON.when, text: when }]}
        openLabel={`${p.openItem(p.draftsTitle)} ${what} ${when}`} onOpen={() => go("/admin/posts?status=draft")} />,
    );
  }
  if (failed !== null && failed > 0) {
    const what = p.failedSends(failed);
    needs.push(
      <RecordRow key="failed" as="li" icon={ICON.announcement} title={p.campaignsTitle} facts={[{ text: what }]} status={<StatusGlyph kind="failed" />}
        openLabel={`${p.openItem(p.campaignsTitle)} ${what}`} onOpen={() => go("/admin/marketing?tab=campaigns")} />,
    );
  }
  const settled = !loading && unread !== null && failed !== null;

  /* ---- KPI series from real dates */
  const postsSeries = weeklyTotals(published.flatMap((x) => (x.publishedAt ? [x.publishedAt] : [])), now);
  const postsNew = added(published.flatMap((x) => (x.publishedAt ? [x.publishedAt] : [])), now);
  const mediaDates = media?.map((m) => m.createdAt) ?? [];
  const mediaSeries = weeklyTotals(mediaDates, now);
  const mediaNew = added(mediaDates, now);
  const delta = (n: number) => (n > 0 ? { text: `+${num(n)}`, tone: "up" as const, label: o.last30(n) } : undefined);

  /* ---- quick links */
  const links: QuickLink[] = [
    { id: "new", label: o.ql.new, to: "/admin/posts/new", icon: ICON.add },
    { id: "inbox", label: o.ql.inbox, to: "/admin/marketing", icon: ICON.announcement },
    { id: "campaigns", label: o.ql.campaigns, to: "/admin/marketing?tab=campaigns", icon: ICON.sending },
    { id: "audience", label: o.ql.audience, to: "/admin/marketing?tab=audience", icon: ICON.group },
    { id: "media", label: o.ql.media, to: "/admin/media", icon: ICON.image },
    { id: "translations", label: o.ql.translations, to: "/admin/translations", icon: ICON.language },
    { id: "areas", label: o.ql.areas, to: "/admin/areas", icon: ICON.area },
    { id: "apps", label: o.ql.apps, to: "/admin/connections", icon: ICON.connectedApp },
    { id: "settings", label: o.ql.settings, to: "/admin/settings", icon: ICON.everyday },
    { id: "site", label: o.ql.site, to: "/", icon: ICON.external },
  ];

  /* ---- campaigns */
  const campaignRows = (list: Campaign[], limit: number) =>
    [...list].sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);

  /* ---- coverage */
  const used = media?.filter((m) => (m.usedBy?.length ?? 0) > 0).length ?? 0;
  const tc = translations?.counts;
  const trTotal = tc ? TRANSLATION_STATUSES.reduce((a, s) => a + tc[s], 0) : 0;

  return (
    <div className={styles.page} data-testid="overview-dashboard">
      <p className="sr-only" role="status">{loading ? p.loading : ""}</p>
      <PanelScope>
        <CollapsibleRow id="glance" title={p.glance} open={rows.open.glance} onToggle={() => rows.toggle("glance")}>
          <PanelGrid>
            <Panel id="needs" title={p.needsYou} icon={ICON.attention} span={4} meta={needs.length > 0 ? num(needs.length) : undefined}
              state={!settled ? "loading" : needs.length === 0 ? "empty" : "ready"}
              empty={<><Icon icon={ICON.published} size={16} aria-hidden="true" />{o.allClear}</>}>
              <ul className={styles.list}>{needs}</ul>
            </Panel>
            <div className={styles.tiles} data-span="8" aria-busy={loading}>
              <KpiTile to="/admin/posts?status=published" icon={ICON.note} label={p.tileNotes} value={posts ? num(published.length) : dash}
                delta={delta(postsNew)} series={{ values: postsSeries, label: o.seriesNotes }} />
              <KpiTile to="/admin/areas" icon={ICON.area} label={p.tileAreas} value={areas ? num(areas.length) : dash}>
                {areas && areas.length > 0 && (
                  <MiniBar total={areas.length} label={p.areasBar(shown, areas.length - shown)} parts={[{ value: shown, tone: "ok" }, { value: areas.length - shown, tone: "muted" }]} />
                )}
              </KpiTile>
              <KpiTile to="/admin/media" icon={ICON.image} label={p.tileMedia} value={media ? num(media.length) : dash}
                delta={delta(mediaNew)} series={{ values: mediaSeries, label: o.seriesMedia }} />
              <KpiTile to="/admin/connections" icon={ICON.connectedApp} label={p.tileApps} value={grants ? num(active.length) : dash}>
                {grants && grants.length > 0 && (
                  <MiniBar total={grants.length} label={p.appsBar(active.length, grants.length - active.length)} parts={[{ value: active.length, tone: "ok" }, { value: grants.length - active.length, tone: "muted" }]} />
                )}
              </KpiTile>
              <KpiTile to="/admin/marketing" icon={ICON.announcement} label={o.tileInbox} value={unread !== null ? num(unread) : dash} />
              <KpiTile to="/admin/posts?status=draft" icon={ICON.draft} label={o.tileDrafts} value={posts ? num(waiting.length) : dash} />
              <KpiTile to="/admin/marketing?tab=campaigns" icon={ICON.failed} label={o.tileFailed} value={failed !== null ? num(failed) : dash}
                tone={failed ? "danger" : "neutral"} />
            </div>
          </PanelGrid>
        </CollapsibleRow>

        <CollapsibleRow id="activity" title={o.rowActivity} open={rows.open.activity} onToggle={() => rows.toggle("activity")}>
          <PanelGrid>
            <Panel id="recent" title={p.recent} icon={ICON.restore} span={4} meta={feed.length > 0 ? num(feed.length) : undefined}
              state={loading ? "loading" : feed.length === 0 ? "empty" : "ready"} empty={o.noActivity}>
              {(expanded) => (
                <ul className={styles.list}>
                  {feed.slice(0, expanded ? 30 : RECENT_SHOWN).map((e) => {
                    const did = w.did[e.did];
                    const at = relative(e.at, now, lang);
                    return (
                      <RecordRow key={e.id} as="li" icon={KIND_ICON[e.kind]} title={e.title} facts={[{ text: did }, { icon: ICON.when, text: at }]}
                        openLabel={`${p.openItem(e.title)} ${did} ${at}`} onOpen={() => go(e.to)} />
                    );
                  })}
                </ul>
              )}
            </Panel>
            <QuickLinks id="quick" storageKey="admin-quick-links" links={links} defaultPinned={["new", "inbox", "campaigns", "media", "translations", "site"]} span={4} />
            <Panel id="campaigns" title={p.campaignsTitle} icon={ICON.sending} span={4} to="/admin/marketing?tab=campaigns"
              state={campaigns === null ? "loading" : campaigns.length === 0 ? "empty" : "ready"} empty={o.noCampaigns}>
              {(expanded) => (
                <ul className={styles.list}>
                  {campaignRows(campaigns ?? [], expanded ? 30 : CAMPAIGNS_SHOWN).map((c) => {
                    const c1 = c.counters;
                    const label = o.sentOf(c1.sent, c1.queued);
                    return (
                      <li key={c.id}>
                        <Link to="/admin/marketing?tab=campaigns" className={styles.campaign}>
                          <StatusGlyph kind={c.status as StatusKind} />
                          <span className={styles.name}>{c.name}</span>
                          {c1.queued > 0 && c.status !== "draft" && (
                            <span className={styles.bar}>
                              <MiniBar total={c1.queued} label={label} parts={[{ value: c1.sent, tone: "ok" }, { value: c1.failed, tone: "danger" }]} />
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </PanelGrid>
        </CollapsibleRow>

        <CollapsibleRow id="coverage" title={o.rowCoverage} open={rows.open.coverage} onToggle={() => rows.toggle("coverage")}>
          <PanelGrid>
            <Panel id="translations" title={w.nav.translations} icon={ICON.language} span={6} to="/admin/translations"
              state={translations === null ? "loading" : trTotal === 0 ? "empty" : "ready"} empty={o.noActivity}>
              {tc && translations && (
                <div className={styles.cover}>
                  <p className={styles.big}>{num(Math.round(translations.coverage))}%<span className="sr-only"> {o.hebrew}</span></p>
                  <MiniBar total={trTotal} label={`${o.hebrew}: ${num(tc.translated)} / ${num(trTotal)}`}
                    parts={[{ value: tc.translated, tone: "ok" }, { value: tc.draft + tc.stale + tc.unverified, tone: "attention" }, { value: tc.missing, tone: "muted" }]} />
                  <ul className={styles.legend}>
                    {TRANSLATION_STATUSES.map((s) => (
                      <li key={s}><StatusGlyph kind={s} showDefault size={16} /><span>{num(tc[s])}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
            <Panel id="media" title={p.tileMedia} icon={ICON.image} span={6} to="/admin/media"
              state={media === null ? "loading" : media.length === 0 ? "empty" : "ready"} empty={o.mediaEmpty}>
              {media && (
                <div className={styles.cover}>
                  <p className={styles.big}>{num(media.length)}<span className={styles.small}>{bytes(media.reduce((s, m) => s + m.bytes, 0))}</span></p>
                  <MiniBar total={media.length} label={`${o.mediaUsed}: ${num(used)} / ${num(media.length)}`}
                    parts={[{ value: used, tone: "ok" }, { value: media.length - used, tone: "muted" }]} />
                  <ul className={styles.legend}>
                    <li><StatusGlyph kind="used" size={16} /><span>{o.mediaUsed} {num(used)}</span></li>
                    <li><Icon icon={ICON.unused} size={16} aria-hidden="true" /><span>{o.mediaUnused} {num(media.length - used)}</span></li>
                  </ul>
                </div>
              )}
            </Panel>
          </PanelGrid>
        </CollapsibleRow>
      </PanelScope>
    </div>
  );
}
