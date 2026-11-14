import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Settings, Type, type LucideIcon } from "lucide-react";
import { relative, useLang } from "@/components/dashboard/i18n";
import { Disclosure } from "@/components/ui/Disclosure";
import { ICON } from "@/components/ui/icons";
import { MiniBar } from "@/components/ui/MiniBar";
import { RecordRow } from "@/components/ui/RecordRow";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import { bytes } from "@/components/admin/format";
import { useAdminWords, type AdminWords } from "@/i18n/admin";
import { usePhoneAdminWords } from "@/i18n/adminPhone";
import { numberIn } from "@/i18n/words";
import type { AdminCollection, AdminPost, McpGrant } from "@/services/admin";
import { adminAnnounce } from "@/services/adminAnnounce";
import { adminCampaigns, type Campaign } from "@/services/adminCampaigns";
import type { MediaItem } from "@/services/media";
import styles from "@/components/admin/phone/phone.module.css";

/*
 * /admin below 600px. The page answers one question, "what needs me?": the
 * unread inbox, drafts waiting and campaigns with failed sends are rows, one
 * button each, drawn only while there is something to do. The figures that are
 * only information are small tiles (a bar where the number has parts); the
 * activity feed is one closed Disclosure. The inbox and campaign counts are
 * asked for here, so a desktop visit makes no extra request.
 */

export type FeedItem = {
  id: string;
  at: string;
  kind: keyof AdminWords["kind"];
  did: keyof AdminWords["did"];
  title: string;
  to: string;
};

const KIND_ICON: Record<FeedItem["kind"], LucideIcon> = {
  post: ICON.note,
  projects: ICON.project,
  story: BookOpen,
  "site-copy": Type,
  settings: Settings,
  media: ICON.image,
  app: ICON.connectedApp,
};

const failedSends = (c: Campaign) => c.status === "failed" || (c.status !== "draft" && c.counters.failed > 0);

export default function OverviewPhone({
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
  const lang = useLang();
  const go = useNavigate();
  const [now] = useState(() => Date.now());
  const [unread, setUnread] = useState<number | null>(null);
  const [failed, setFailed] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    adminAnnounce.inbox().then((r) => live && setUnread(typeof r.unread === "number" ? r.unread : null), () => {});
    adminCampaigns.list().then((list) => live && setFailed(list.filter(failedSends).length), () => {});
    return () => {
      live = false;
    };
  }, []);

  const published = posts?.filter((x) => x.status === "published") ?? [];
  const drafts = posts?.filter((x) => x.status === "draft") ?? [];
  const changes = published.filter((x) => x.draft);
  const waiting = [...drafts, ...changes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const active = grants?.filter((g) => g.status === "active") ?? [];
  const num = (n: number) => numberIn(lang, n);

  const needs: React.ReactNode[] = [];
  if (unread !== null && unread > 0) {
    const what = p.unread(unread);
    needs.push(
      <RecordRow
        key="inbox" as="li" icon={ICON.announcement} title={p.inboxTitle} unread
        facts={[{ text: what }]}
        openLabel={`${p.openItem(p.inboxTitle)} ${what}`}
        onOpen={() => go("/admin/marketing")}
      />,
    );
  }
  if (waiting.length > 0) {
    const what = p.waiting(waiting.length);
    const whenText = relative(waiting[0].draftSavedAt ?? waiting[0].updatedAt, now, lang);
    needs.push(
      <RecordRow
        key="drafts" as="li" icon={ICON.draft} title={p.draftsTitle}
        facts={[{ text: what }, { icon: ICON.when, text: whenText }]}
        openLabel={`${p.openItem(p.draftsTitle)} ${what} ${whenText}`}
        onOpen={() => go("/admin/posts?status=draft")}
      />,
    );
  }
  if (failed !== null && failed > 0) {
    const what = p.failedSends(failed);
    needs.push(
      <RecordRow
        key="failed" as="li" icon={ICON.announcement} title={p.campaignsTitle}
        facts={[{ text: what }]}
        status={<StatusGlyph kind="failed" />}
        openLabel={`${p.openItem(p.campaignsTitle)} ${what}`}
        onOpen={() => go("/admin/marketing?tab=campaigns")}
      />,
    );
  }
  const settled = !loading && unread !== null && failed !== null;

  const tile = (to: string, Icon: LucideIcon, label: string, value: string, bar?: React.ReactNode) => (
    <li key={to}>
      <Link to={to} className={styles.tile}>
        <span className={styles.tileLabel}>
          <Icon size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" />
          <span>{label}</span>
        </span>
        <span className={styles.figure}>{value}</span>
        <span className={styles.tileSlot}>{bar}</span>
      </Link>
    </li>
  );

  return (
    <div className={styles.page} data-testid="overview-phone">
      <p className="sr-only" role="status">{loading ? p.loading : ""}</p>

      <section className={styles.section} aria-labelledby="ov-needs">
        <h2 id="ov-needs" className={styles.heading}>{p.needsYou}</h2>
        {needs.length > 0 ? (
          <ul className={styles.list}>{needs}</ul>
        ) : settled ? (
          <p className={styles.note}>{p.nothingNeeds}</p>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="ov-glance">
        <h2 id="ov-glance" className={styles.heading}>{p.glance}</h2>
        <ul className={styles.tiles}>
          {tile(
            "/admin/posts?status=published", ICON.note, p.tileNotes, posts ? num(published.length) : "—",
            posts && (
              <MiniBar
                total={posts.length}
                label={p.notesBar(published.length - changes.length, changes.length, drafts.length)}
                parts={[
                  { value: published.length - changes.length, tone: "ok" },
                  { value: changes.length, tone: "attention" },
                  { value: drafts.length, tone: "muted" },
                ]}
              />
            ),
          )}
          {tile(
            "/admin/areas", ICON.area, p.tileAreas, areas ? num(areas.length) : "—",
            areas && (
              <MiniBar
                total={areas.length}
                label={p.areasBar(areas.filter((a) => a.status !== "hidden").length, areas.filter((a) => a.status === "hidden").length)}
                parts={[{ value: areas.filter((a) => a.status !== "hidden").length, tone: "ok" }, { value: areas.filter((a) => a.status === "hidden").length, tone: "muted" }]}
              />
            ),
          )}
          {tile("/admin/media", ICON.image, p.tileMedia, media ? num(media.length) : "—", media && <span className={styles.note}>{bytes(media.reduce((sum, m) => sum + m.bytes, 0))}</span>)}
          {tile(
            "/admin/connections", ICON.connectedApp, p.tileApps, grants ? num(active.length) : "—",
            grants && (
              <MiniBar
                total={grants.length}
                label={p.appsBar(active.length, grants.length - active.length)}
                parts={[{ value: active.length, tone: "ok" }, { value: grants.length - active.length, tone: "muted" }]}
              />
            ),
          )}
        </ul>
      </section>

      <Disclosure summary={p.recent} meta={p.recentMeta(Math.min(feed.length, 8))} testid="overview-feed">
        <ul className={styles.list}>
          {feed.slice(0, 8).map((e) => {
            const did = w.did[e.did];
            const at = relative(e.at, now, lang);
            return (
              <RecordRow
                key={e.id} as="li" icon={KIND_ICON[e.kind]} title={e.title}
                facts={[{ text: did }, { icon: ICON.when, text: at }]}
                openLabel={`${p.openItem(e.title)} ${did} ${at}`}
                onOpen={() => go(e.to)}
              />
            );
          })}
        </ul>
      </Disclosure>
    </div>
  );
}
