import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageShell from "@/components/PageShell";
import LinkEditor, { type LinkRow } from "@/components/LinkEditor";
import { admin, slugify } from "@/services/admin";

type Draft = {
  slug: string;
  title: string;
  tagline: string;
  kind: "site" | "project";
  repoOwner: string;
  repoName: string;
  description: string;
  coverImage: string;
  links: LinkRow[];
  order: string;
  status: "published" | "hidden";
  _rev?: string;
};

const EMPTY: Draft = { slug: "", title: "", tagline: "", kind: "project", repoOwner: "", repoName: "", description: "", coverImage: "", links: [], order: "50", status: "published" };

export default function AdminCollection() {
  const { slug } = useParams();
  const isNew = !slug || slug === "new";
  const nav = useNavigate();
  const [d, setD] = useState<Draft>(EMPTY);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (isNew) return;
    admin
      .collections()
      .then((cs) => {
        const c = cs.find((x) => x.slug === slug);
        if (!c) return setMsg("Not found");
        setStats(c.stats ?? null);
        setD({
          slug: c.slug,
          title: c.title,
          tagline: c.tagline,
          kind: c.kind,
          repoOwner: c.repo?.owner ?? "",
          repoName: c.repo?.name ?? "",
          description: c.description,
          coverImage: c.coverImage ?? "",
          links: c.links,
          order: String(c.order),
          status: c.status,
          _rev: c._rev,
        });
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : "Failed to load"));
  }, [slug, isNew]);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const saved = await admin.saveCollection(d.slug, {
        title: d.title,
        tagline: d.tagline,
        kind: d.kind,
        // Repo config is optional; an area with no repository is perfectly valid.
        repo: d.repoOwner && d.repoName ? { owner: d.repoOwner, name: d.repoName, branch: "main", docPaths: [] } : null,
        description: d.description,
        coverImage: d.coverImage.trim() || null,
        links: d.links.filter((l) => l.label && l.url),
        order: Number(d.order) || 50,
        status: d.status,
        _rev: d._rev,
      });
      setD((p) => ({ ...p, _rev: saved._rev }));
      setMsg("Saved.");
      if (isNew) nav(`/admin/collections/${saved.slug}`, { replace: true });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const field =
    "mt-2 w-full border-0 border-b border-edge bg-transparent px-0 py-2.5 text-bone placeholder:text-bone/25 focus:border-sodium focus:outline-none";
  const label = "mono text-[0.625rem] uppercase tracking-[0.22em] text-bone/45";

  return (
    <PageShell>
      <section className="isolate relative mx-auto max-w-3xl px-6 pb-28 pt-40">
        <button onClick={() => nav("/admin")} className="mono text-[0.6875rem] uppercase tracking-[0.22em] text-bone/45 transition-colors hover:text-sodium">
          ← Admin
        </button>
        <h1 className="display-tight mt-8 text-section">{isNew ? "New area" : d.title || d.slug}</h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-bone/60">
          An area is a shelf of posts — the site&rsquo;s own notes, or one project&rsquo;s.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={label}>Title</span>
            <input
              value={d.title}
              onChange={(e) =>
                setD((p) => ({ ...p, title: e.target.value, slug: slugTouched ? p.slug : slugify(e.target.value) }))
              }
              className={`${field} text-xl`}
              placeholder="WindoM"
            />
          </label>
          <label className="block">
            <span className={label}>Slug — the URL</span>
            <input
              value={d.slug}
              onChange={(e) => { setSlugTouched(true); setD((p) => ({ ...p, slug: e.target.value })); }}
              className={`${field} mono text-sm`}
              placeholder="windom"
            />
          </label>
          <label className="block">
            <span className={label}>Order — lower comes first</span>
            <input value={d.order} onChange={(e) => setD((p) => ({ ...p, order: e.target.value }))} className={`${field} mono text-sm`} inputMode="numeric" />
          </label>
          <label className="block">
            <span className={label}>Kind</span>
            <select value={d.kind} onChange={(e) => setD((p) => ({ ...p, kind: e.target.value as Draft["kind"] }))} className={`${field} mono text-sm`}>
              <option value="project" className="bg-surface text-bone">Project</option>
              <option value="site" className="bg-surface text-bone">My blog</option>
            </select>
          </label>
          <label className="block">
            <span className={label}>Tagline</span>
            <input value={d.tagline} onChange={(e) => setD((p) => ({ ...p, tagline: e.target.value }))} className={field} placeholder="Every new tab becomes a dashboard" />
          </label>
          <label className="block">
            <span className={label}>GitHub owner</span>
            <input value={d.repoOwner} onChange={(e) => setD((p) => ({ ...p, repoOwner: e.target.value }))} className={`${field} mono text-sm`} placeholder="YehudaBriskman" />
          </label>
          <label className="block">
            <span className={label}>GitHub repo</span>
            <input value={d.repoName} onChange={(e) => setD((p) => ({ ...p, repoName: e.target.value }))} className={`${field} mono text-sm`} placeholder="WindoM" />
          </label>
          <label className="block sm:col-span-2">
            <span className={label}>Description</span>
            <input value={d.description} onChange={(e) => setD((p) => ({ ...p, description: e.target.value }))} className={field} />
          </label>
          <label className="block sm:col-span-2">
            <span className={label}>Cover image URL</span>
            <input value={d.coverImage} onChange={(e) => setD((p) => ({ ...p, coverImage: e.target.value }))} className={`${field} mono text-xs`} placeholder="https://…" />
          </label>
        </div>

        {d.coverImage && (
          <img src={d.coverImage} alt="" className="mt-6 max-h-56 w-full rounded-lg border border-edge object-cover" />
        )}

        <div className="mt-10">
          <LinkEditor links={d.links} onChange={(links) => setD((p) => ({ ...p, links }))} />
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <button
            onClick={save}
            disabled={saving || !d.slug || !d.title}
            className="pill mono border border-sodium px-6 py-3 text-xs uppercase tracking-[0.2em] text-sodium transition-colors hover:bg-sodium hover:text-bitumen disabled:opacity-40"
          >
            {saving ? "Saving" : "Save area"}
          </button>
          <button
            onClick={() => setD((p) => ({ ...p, status: p.status === "published" ? "hidden" : "published" }))}
            className="pill mono border border-edge px-6 py-3 text-xs uppercase tracking-[0.2em] text-bone/70 transition-colors hover:border-bone/50"
          >
            {d.status === "published" ? "Mark hidden" : "Mark published"}
          </button>
          {d.repoOwner && d.repoName && !isNew && (
            <button
              onClick={async () => {
                setSyncing(true);
                setMsg(null);
                try {
                  const r = await admin.syncCollection(d.slug);
                  setStats(r.stats as Record<string, unknown>);
                  setMsg("Repository numbers refreshed.");
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : "Sync failed");
                } finally {
                  setSyncing(false);
                }
              }}
              className="pill mono border border-edge px-6 py-3 text-xs uppercase tracking-[0.2em] text-bone/70 transition-colors hover:border-bone/50"
            >
              {syncing ? "Syncing" : "Sync from GitHub"}
            </button>
          )}
          <span className="mono text-[0.6875rem] uppercase tracking-[0.2em] text-bone/40">status: {d.status}</span>
          {msg && <span className="mono text-[0.6875rem] text-sodium">{msg}</span>}
        </div>

        {stats && (
          <div className="mono mt-8 border-t border-edge pt-6 text-[0.6875rem] text-bone/50">
            <p className="uppercase tracking-[0.22em] text-bone/35">From GitHub</p>
            <p className="mt-2">
              {stats.error
                ? String(stats.error)
                : `${stats.stars ?? "—"} stars · ${stats.language ?? "—"} · ${stats.license ?? "—"} · fetched ${
                    stats.fetchedAt ? new Date(String(stats.fetchedAt)).toLocaleString("en-GB") : "never"
                  }`}
            </p>
            <p className="mt-2 text-bone/35">
              Refreshed automatically every 15 minutes. Never read during a page load.
            </p>
          </div>
        )}
      </section>
    </PageShell>
  );
}
