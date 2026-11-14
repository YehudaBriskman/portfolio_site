import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Clock, FileText, FolderKanban, Image, Pencil, Plug, Plus, Settings, Shapes, Type, Upload } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import OverviewPhone from "@/components/admin/overview/OverviewPhone";
import { usePhone } from "@/hooks/usePhone";
import { Empty, PageHeader, RelTime, StatePill, type PillState } from "@/components/admin/ui";
import { bytes } from "@/components/admin/format";
import { useAdminWords, type AdminWords } from "@/i18n/admin";
import { relative, useLang } from "@/components/dashboard/i18n";
import { admin, type AdminCollection, type AdminPost, type McpGrant } from "@/services/admin";
import { adminContent, type ContentView } from "@/services/adminContent";
import { adminSettings, type SettingsView } from "@/services/adminSettings";
import { media, type MediaItem } from "@/services/media";
import type { ContentKey } from "@/content/schema";
import { titleOf } from "@/lib/safeTitle";

/*
 * The admin's landing page (#288): what is on the site, in numbers, and
 * what changed last. Every figure is counted from a list the admin already
 * loads for its own screens; nothing here asks the API anything new, and a
 * source that fails shows a dash rather than a zero, because a zero would be
 * a claim. There is no "last deploy": the admin has no source for one.
 */

type Loaded<T> = { ok: true; value: T } | { ok: false } | null;

const settle = <T,>(p: Promise<T>): Promise<Loaded<T>> =>
  p.then(
    (value) => ({ ok: true as const, value }),
    () => ({ ok: false as const }),
  );

type Data = {
  posts: Loaded<AdminPost[]>;
  areas: Loaded<AdminCollection[]>;
  media: Loaded<MediaItem[]>;
  grants: Loaded<McpGrant[]>;
  settings: Loaded<SettingsView>;
  content: Partial<Record<ContentKey, Loaded<ContentView<unknown>>>>;
};

const KEYS: ContentKey[] = ["projects", "story", "site-copy"];

type Event = {
  id: string;
  at: string;
  kind: keyof AdminWords["kind"];
  did: keyof AdminWords["did"];
  title: string;
  to: string;
  state?: PillState;
};

const ICON: Record<Event["kind"], typeof FileText> = {
  post: FileText,
  projects: FolderKanban,
  story: BookOpen,
  "site-copy": Type,
  settings: Settings,
  media: Image,
  app: Plug,
};

function events(d: Data, w: AdminWords): Event[] {
  const out: Event[] = [];
  if (d.posts?.ok) {
    for (const p of d.posts.value) {
      const changes = p.status === "published" && Boolean(p.draft);
      out.push({
        id: `post:${p.slug}`,
        at: p.draftSavedAt && changes ? p.draftSavedAt : p.updatedAt,
        kind: "post",
        did: changes ? "draftSaved" : p.status === "archived" ? "archived" : p.status === "draft" ? "edited" : "published",
        title: titleOf(p.title, p.slug),
        to: `/admin/posts/${p.slug}`,
        state: changes ? "changes" : p.status,
      });
    }
  }
  for (const key of KEYS) {
    const v = d.content[key];
    if (v?.ok && v.value.updatedAt) {
      out.push({
        id: `content:${key}`,
        at: v.value.updatedAt,
        kind: key,
        did: v.value.draft ? "draftSaved" : "published",
        title: w.kind[key],
        to: `/admin/${key}`,
        state: v.value.draft ? "changes" : "published",
      });
    }
  }
  if (d.settings?.ok && d.settings.value.updatedAt) {
    out.push({
      id: "settings",
      at: d.settings.value.updatedAt,
      kind: "settings",
      did: "saved",
      title: w.settingsVersion(d.settings.value.version),
      to: "/admin/settings",
    });
  }
  if (d.media?.ok) {
    for (const m of d.media.value) {
      out.push({ id: `media:${m.id}`, at: m.createdAt, kind: "media", did: "uploaded", title: m.alt || m.name, to: `/admin/media?id=${encodeURIComponent(m.id)}` });
    }
  }
  if (d.grants?.ok) {
    for (const g of d.grants.value) {
      out.push({ id: `app:${g.id}`, at: g.createdAt, kind: "app", did: "connected", title: g.client, to: "/admin/connections" });
    }
  }
  return out.filter((e) => !Number.isNaN(Date.parse(e.at))).sort((a, b) => b.at.localeCompare(a.at));
}

function Stat({
  to,
  icon,
  label,
  value,
  detail,
  text,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  text?: boolean;
}) {
  return (
    <Link to={to} className="a-box a-stat">
      <span className="a-stat-label">
        {icon}
        {label}
      </span>
      <span className={text ? "a-stat-value a-stat-text" : "a-stat-value"}>{value}</span>
      {detail && <span className="a-stat-detail">{detail}</span>}
    </Link>
  );
}

const n = (v: number) => new Intl.NumberFormat("en-GB").format(v);

export default function AdminOverview() {
  const w = useAdminWords();
  const lang = useLang();
  const phone = usePhone();
  const [now] = useState(() => Date.now());
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all([
      settle(admin.list()),
      settle(admin.collections()),
      settle(media.list()),
      settle(admin.mcpGrants()),
      settle(adminSettings.get()),
      ...KEYS.map((k) => settle(adminContent.get<unknown>(k))),
    ]).then(([posts, areas, lib, grants, settings, ...content]) => {
      if (!live) return;
      setD({
        posts: posts as Loaded<AdminPost[]>,
        areas: areas as Loaded<AdminCollection[]>,
        media: lib as Loaded<MediaItem[]>,
        grants: grants as Loaded<McpGrant[]>,
        settings: settings as Loaded<SettingsView>,
        content: Object.fromEntries(KEYS.map((k, i) => [k, content[i] as Loaded<ContentView<unknown>>])),
      });
    });
    return () => {
      live = false;
    };
  }, []);

  const feed = useMemo(() => (d ? events(d, w) : []), [d, w]);
  const posts = d?.posts?.ok ? d.posts.value : null;
  const published = posts?.filter((p) => p.status === "published") ?? [];
  const drafts = posts?.filter((p) => p.status === "draft") ?? [];
  const changes = published.filter((p) => p.draft);
  const open = posts ? [...drafts, ...changes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5) : null;

  const areas = d?.areas?.ok ? d.areas.value : null;
  const lib = d?.media?.ok ? d.media.value : null;
  const grants = d?.grants?.ok ? d.grants.value : null;
  const active = grants?.filter((g) => g.status === "active") ?? [];
  const lastUsed = active.map((g) => g.lastUsedAt).filter((x): x is string => Boolean(x)).sort().at(-1);
  const projects = d?.content.projects?.ok ? (d.content.projects.value as ContentView<{ items: unknown[] }>) : null;
  const projectCount = projects ? (projects.draft ?? projects.published).items.length : null;
  const latest = feed.find((e) => e.kind !== "app");

  const icon = (I: typeof FileText) => <I aria-hidden="true" />;

  return (
    <AdminShell
      title={w.overview}
      section="overview"
      counts={{ posts: posts?.length, areas: areas?.length, media: lib?.length, connections: grants ? active.length : undefined }}
    >
      <div className="a-wrap">
        <PageHeader
          title={w.overview}
          description={phone ? undefined : w.overviewIntro}
          actions={
            <>
              {!phone && (
                <Link to="/admin/media" className="a-btn">
                  <Upload aria-hidden="true" />
                  {w.upload}
                </Link>
              )}
              <Link to="/admin/posts/new" className="a-btn a-btn-primary">
                <Plus aria-hidden="true" />
                {w.newNote}
              </Link>
            </>
          }
        />

        {phone ? (
          <OverviewPhone posts={posts} areas={areas} media={lib} grants={grants} feed={feed} loading={d === null} />
        ) : (
          <>
        <section aria-labelledby="overview-stats">
          <h2 id="overview-stats" className="sr-only">
            {w.stats}
          </h2>
          <p className="sr-only" role="status">
            {d === null ? w.loading : ""}
          </p>
          <div className="a-stats" aria-busy={d === null}>
            <Stat
              to="/admin/posts?status=published"
              icon={icon(FileText)}
              label={w.statNotes}
              value={posts ? n(published.length) : <Empty />}
              detail={posts ? w.notesDetail(changes.length) : undefined}
            />
            <Stat
              to="/admin/posts?status=draft"
              icon={icon(Pencil)}
              label={w.statDrafts}
              value={posts ? n(drafts.length) : <Empty />}
              detail={posts ? w.draftsDetail : undefined}
            />
            <Stat
              to="/admin/projects"
              icon={icon(FolderKanban)}
              label={w.statProjects}
              value={projectCount !== null ? n(projectCount) : <Empty />}
              detail={projects ? w.projectsDetail(Boolean(projects.draft)) : undefined}
            />
            <Stat
              to="/admin/areas"
              icon={icon(Shapes)}
              label={w.statAreas}
              value={areas ? n(areas.length) : <Empty />}
              detail={areas ? w.areasDetail(areas.filter((a) => a.status === "hidden").length) : undefined}
            />
            <Stat
              to="/admin/media"
              icon={icon(Image)}
              label={w.statMedia}
              value={lib ? n(lib.length) : <Empty />}
              detail={lib ? w.mediaDetail(bytes(lib.reduce((sum, m) => sum + m.bytes, 0))) : undefined}
            />
            <Stat
              to="/admin/connections"
              icon={icon(Plug)}
              label={w.statApps}
              value={grants ? n(active.length) : <Empty />}
              detail={grants ? (lastUsed ? w.appsDetail(relative(lastUsed, now, lang)) : w.appsNever) : undefined}
            />
            <Stat
              to={latest?.to ?? "/admin"}
              icon={icon(Clock)}
              label={w.statChanged}
              text
              value={latest ? <RelTime iso={latest.at} /> : <Empty />}
              detail={latest ? `${w.did[latest.did]} · ${latest.title}` : undefined}
            />
          </div>
        </section>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-labelledby="overview-activity" className="a-box min-w-0">
            <div className="a-box-head">
              <h2 id="overview-activity" className="a-box-title">
                {w.activity}
              </h2>
            </div>
            {d === null ? (
              <div className="a-box-row text-clay">{w.loading}</div>
            ) : feed.length === 0 ? (
              <p className="a-box-row text-clay">{w.activityEmpty}</p>
            ) : (
              <ol>
                {feed.slice(0, 10).map((e) => {
                  const Icon = ICON[e.kind];
                  return (
                    <li key={e.id} className="a-box-row items-start">
                      <span className="mt-0.5 text-clay" aria-hidden="true">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <Link to={e.to} className="a-row-title">
                          {e.title}
                        </Link>
                        <span className="a-row-meta">
                          <span>{w.kind[e.kind]}</span>
                          <span>{w.did[e.did]}</span>
                        </span>
                      </span>
                      {e.state && e.kind === "post" && <StatePill state={e.state} className="hidden sm:inline-flex" />}
                      <span className="a-when shrink-0 text-sm text-clay">
                        <RelTime iso={e.at} />
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section aria-labelledby="overview-open" className="a-box self-start">
            <div className="a-box-head">
              <h2 id="overview-open" className="a-box-title">
                {w.continue}
              </h2>
              <Link to="/admin/posts?status=draft" className="a-link ms-auto inline-flex min-h-11 items-center text-sm font-normal">
                {w.viewAll}
              </Link>
            </div>
            {open === null ? (
              <p className="a-box-row text-clay">{d === null ? w.loading : w.loadFailed}</p>
            ) : open.length === 0 ? (
              <p className="a-box-row text-clay">{w.continueEmpty}</p>
            ) : (
              <ul>
                {open.map((p) => (
                  <li key={p.slug} className="a-box-row">
                    <span className="min-w-0 flex-1">
                      <Link to={`/admin/posts/${p.slug}`} className="a-row-title">
                        {titleOf(p.title, p.slug)}
                      </Link>
                      <span className="a-row-meta a-plain">
                        <StatePill state={p.status === "published" ? "changes" : "draft"} />
                        <RelTime iso={p.draftSavedAt ?? p.updatedAt} />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
