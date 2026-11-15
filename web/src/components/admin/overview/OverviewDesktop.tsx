import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { relative, useLang } from "@/components/dashboard/i18n";
import { ICON } from "@/components/ui/icons";
import { MiniBar } from "@/components/ui/MiniBar";
import { RecordRow } from "@/components/ui/RecordRow";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
import { KpiTile } from "@/components/admin/overview/KpiTile";
import { useNeeds } from "@/components/admin/overview/useNeeds";
import type { FeedItem } from "@/components/admin/overview/OverviewPhone";
import { bytes } from "@/components/admin/format";
import { useAdminWords, type AdminWords } from "@/i18n/admin";
import { usePhoneAdminWords } from "@/i18n/adminPhone";
import { numberIn } from "@/i18n/words";
import type { AdminCollection, AdminPost, McpGrant } from "@/services/admin";
import type { MediaItem } from "@/services/media";
import styles from "@/components/admin/overview/overview.module.css";

/*
 * /admin from 600px up (S5, #840). One question first, "what needs me?": the
 * unread inbox, drafts waiting and campaigns with failed sends are rows, drawn
 * only while there is something to do. Then four tiles of ONE size, each fact
 * once (a count and a bar), then one list of what changed. Nothing is said in two
 * cards: the drafts are a row in "needs you", not a second list of the same posts.
 */

const KIND_ICON: Record<keyof AdminWords["kind"], typeof ICON.note> = {
  post: ICON.note,
  projects: ICON.project,
  story: ICON.story,
  "site-copy": ICON.language,
  settings: ICON.everyday,
  media: ICON.image,
  app: ICON.connectedApp,
};

export default function OverviewDesktop({
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
  const { unread, failed } = useNeeds();

  const published = posts?.filter((x) => x.status === "published") ?? [];
  const drafts = posts?.filter((x) => x.status === "draft") ?? [];
  const changes = published.filter((x) => x.draft);
  const waiting = [...drafts, ...changes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const active = grants?.filter((g) => g.status === "active") ?? [];
  const shown = areas?.filter((a) => a.status !== "hidden").length ?? 0;
  const num = (n: number) => numberIn(lang, n);

  const needs: React.ReactNode[] = [];
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

  return (
    <div className={styles.page} data-testid="overview-desktop">
      <p className="sr-only" role="status">{loading ? p.loading : ""}</p>

      <section className={styles.section} aria-labelledby="ov-needs">
        <h2 id="ov-needs" className={styles.heading}>{p.needsYou}</h2>
        {needs.length > 0 ? <ul className={styles.list}>{needs}</ul> : settled ? <p className={styles.note}>{p.nothingNeeds}</p> : null}
      </section>

      <section className={styles.section} aria-labelledby="ov-glance">
        <h2 id="ov-glance" className={styles.heading}>{p.glance}</h2>
        <ul className={styles.tiles} aria-busy={loading}>
          <KpiTile to="/admin/posts?status=published" icon={ICON.note} label={p.tileNotes} value={posts ? num(published.length) : "—"}>
            {posts && (
              <MiniBar total={posts.length} label={p.notesBar(published.length - changes.length, changes.length, drafts.length)}
                parts={[{ value: published.length - changes.length, tone: "ok" }, { value: changes.length, tone: "attention" }, { value: drafts.length, tone: "muted" }]} />
            )}
          </KpiTile>
          <KpiTile to="/admin/areas" icon={ICON.area} label={p.tileAreas} value={areas ? num(areas.length) : "—"}>
            {areas && (
              <MiniBar total={areas.length} label={p.areasBar(shown, areas.length - shown)} parts={[{ value: shown, tone: "ok" }, { value: areas.length - shown, tone: "muted" }]} />
            )}
          </KpiTile>
          <KpiTile to="/admin/media" icon={ICON.image} label={p.tileMedia} value={media ? num(media.length) : "—"}>
            {media && bytes(media.reduce((sum, m) => sum + m.bytes, 0))}
          </KpiTile>
          <KpiTile to="/admin/connections" icon={ICON.connectedApp} label={p.tileApps} value={grants ? num(active.length) : "—"}>
            {grants && (
              <MiniBar total={grants.length} label={p.appsBar(active.length, grants.length - active.length)}
                parts={[{ value: active.length, tone: "ok" }, { value: grants.length - active.length, tone: "muted" }]} />
            )}
          </KpiTile>
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="ov-recent">
        <h2 id="ov-recent" className={styles.heading}>{p.recent}</h2>
        {feed.length === 0 ? (
          !loading && <p className={styles.note}>{w.activityEmpty}</p>
        ) : (
          <ul className={styles.list}>
            {feed.slice(0, 8).map((e) => {
              const did = w.did[e.did];
              const at = relative(e.at, now, lang);
              return (
                <RecordRow key={e.id} as="li" icon={KIND_ICON[e.kind]} title={e.title} facts={[{ text: did }, { icon: ICON.when, text: at }]}
                  openLabel={`${p.openItem(e.title)} ${did} ${at}`} onOpen={() => go(e.to)} />
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
