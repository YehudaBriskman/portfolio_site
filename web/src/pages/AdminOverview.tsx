import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import OverviewPhone from "@/components/admin/overview/OverviewPhone";
import { usePhone } from "@/hooks/usePhone";
import { PageHeader } from "@/components/ui/PageHeader";
import { ICON } from "@/components/ui/icons";
import OverviewDesktop from "@/components/admin/overview/OverviewDesktop";
import { type PillState } from "@/components/admin/ui";
import { useAdminWords, type AdminWords } from "@/i18n/admin";
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

export default function AdminOverview() {
  const w = useAdminWords();
  const phone = usePhone();
  const go = useNavigate();
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
  const areas = d?.areas?.ok ? d.areas.value : null;
  const lib = d?.media?.ok ? d.media.value : null;
  const grants = d?.grants?.ok ? d.grants.value : null;
  const active = grants?.filter((g) => g.status === "active") ?? [];

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
          primary={{ id: "new", label: w.newNote, icon: ICON.add, onSelect: () => go("/admin/posts/new") }}
        />

        {phone ? (
          <OverviewPhone posts={posts} areas={areas} media={lib} grants={grants} feed={feed} loading={d === null} />
        ) : (
          <OverviewDesktop posts={posts} areas={areas} media={lib} grants={grants} feed={feed} loading={d === null} />
        )}
      </div>
    </AdminShell>
  );
}
