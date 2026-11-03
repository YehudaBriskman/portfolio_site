import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import StatusPill, { type SaveState } from "@/components/admin/StatusPill";
import DocPathsEditor from "@/components/admin/DocPathsEditor";
import LinkEditor, { toLinkRows, type LinkRow } from "@/components/LinkEditor";
import { admin, slugify, AdminValidationError } from "@/services/admin";
import MediaPicker from "@/components/admin/MediaPicker";

type Draft = {
  slug: string;
  title: string;
  tagline: string;
  kind: "site" | "project";
  repoOwner: string;
  repoName: string;
  repoBranch: string;
  docPaths: string[];
  description: string;
  coverImage: string;
  icon: string;
  links: LinkRow[];
  order: string;
  status: "published" | "hidden";
  /* The Hebrew (#248). Empty is untranslated: the site shows the English. */
  heTitle: string;
  heTagline: string;
  heDescription: string;
  _rev?: string;
};

const EMPTY: Draft = {
  slug: "", title: "", tagline: "", kind: "project",
  repoOwner: "", repoName: "", repoBranch: "main", docPaths: [],
  description: "", coverImage: "", icon: "", links: [], order: "50", status: "published",
  heTitle: "", heTagline: "", heDescription: "",
};

export default function AdminCollection() {
  const { slug } = useParams();
  const isNew = !slug || slug === "new";
  const nav = useNavigate();
  const [d, setD] = useState<Draft>(EMPTY);
  const [save_, setSave] = useState<SaveState>({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!isNew);

  useEffect(() => {
    if (isNew) return;
    admin
      .collections()
      .then((cs) => {
        const c = cs.find((x) => x.slug === slug);
        if (!c) {
          setSave({ kind: "failed", message: "Not found" });
          return;
        }
        setStats(c.stats ?? null);
        setD({
          slug: c.slug,
          title: c.title,
          tagline: c.tagline,
          kind: c.kind,
          repoOwner: c.repo?.owner ?? "",
          repoName: c.repo?.name ?? "",
          repoBranch: c.repo?.branch ?? "main",
          docPaths: c.repo?.docPaths ?? [],
          description: c.description,
          coverImage: c.coverImage ?? "",
          icon: c.icon ?? "",
          links: toLinkRows(c.links),
          order: String(c.order),
          status: c.status,
          heTitle: c.he?.title ?? "",
          heTagline: c.he?.tagline ?? "",
          heDescription: c.he?.description ?? "",
          _rev: c._rev,
        });
      })
      .catch((e) => setSave({ kind: "failed", message: e instanceof Error ? e.message : "Failed to load" }));
  }, [slug, isNew]);

  const patch = (p: Partial<Draft>) => {
    setD((prev) => ({ ...prev, ...p }));
    setSave((s) => (s.kind === "saving" ? s : { kind: "dirty" }));
  };

  async function commit() {
    setSave({ kind: "saving" });
    setFieldErrors({});
    try {
      const saved = await admin.saveCollection(d.slug, {
        title: d.title,
        tagline: d.tagline,
        he:
          d.heTitle.trim() || d.heTagline.trim() || d.heDescription.trim()
            ? {
                title: d.heTitle.trim() || null,
                tagline: d.heTagline.trim() || null,
                description: d.heDescription.trim() || null,
              }
            : null,
        kind: d.kind,
        // Repo config is optional; an area with no repository is perfectly valid.
        // The branch and the allowlist are sent as configured — they used to be
        // hardcoded to "main" and [] here, which silently destroyed both on
        // every save of an area that had them set.
        repo:
          d.repoOwner && d.repoName
            ? {
                owner: d.repoOwner,
                name: d.repoName,
                branch: d.repoBranch.trim() || "main",
                docPaths: d.docPaths,
              }
            : null,
        description: d.description,
        coverImage: d.coverImage.trim() || null,
        icon: d.icon.trim() || null,
        links: d.links.filter((l) => l.label && l.url),
        order: Number(d.order) || 50,
        status: d.status,
        _rev: d._rev,
      });
      setD((p) => ({ ...p, _rev: saved._rev }));
      setSave({ kind: "saved", at: new Date() });
      if (isNew) nav(`/admin/areas/${saved.slug}`, { replace: true });
    } catch (e) {
      if (e instanceof AdminValidationError) {
        setFieldErrors(e.fieldErrors);
        setSave({ kind: "invalid", message: e.message });
        return;
      }
      const message = e instanceof Error ? e.message : "Save failed";
      setSave(/changed elsewhere/i.test(message) ? { kind: "conflict" } : { kind: "failed", message });
    }
  }

  const canSave = save_.kind !== "saving" && Boolean(d.slug) && Boolean(d.title);
  /** The server's complaint about one field, shown under it. */
  const fieldError = (name: string) =>
    fieldErrors[name] ? <span className="a-error">{fieldErrors[name]}</span> : null;
  const heading = isNew ? "New area" : d.title || d.slug;
  const repoLabel = d.repoOwner && d.repoName ? `${d.repoOwner}/${d.repoName}` : "";

  const bottomBar = (
    <div className="flex items-center gap-3 px-4 py-2">
      <StatusPill state={save_} />
      <button type="button" onClick={() => void commit()} disabled={!canSave} className="a-btn a-btn-primary ml-auto">
        {save_.kind === "saving" ? "Saving" : "Save"}
      </button>
    </div>
  );

  return (
    <AdminShell title={heading} section="areas" backTo="/admin/areas" bottomBar={bottomBar}>
      <form onSubmit={(e) => { e.preventDefault(); if (canSave) void commit(); }}>
        <h1 className="display-tight text-[1.75rem] lg:text-[2.25rem]">{heading}</h1>
        <p className="a-hint mt-3 max-w-prose">
          An area is a shelf of posts: the site&rsquo;s own notes, or one project&rsquo;s.
        </p>

        <label className="mt-8 block">
          <span className="a-label">Title</span>
          <input
            value={d.title}
            onChange={(e) => patch({ title: e.target.value, slug: slugTouched ? d.slug : slugify(e.target.value) })}
            className="a-input a-input-title"
            aria-invalid={fieldErrors.title ? "true" : undefined}
            placeholder="WindoM"
          />
          {fieldError("title")}
        </label>

        <label className="mt-6 block">
          <span className="a-label">Tagline</span>
          <input
            value={d.tagline}
            onChange={(e) => patch({ tagline: e.target.value })}
            className="a-input"
            placeholder="Every new tab becomes a dashboard"
          />
        </label>

        <label className="mt-6 block">
          <span className="a-label">Description</span>
          <textarea
            value={d.description}
            onChange={(e) => patch({ description: e.target.value })}
            className="a-textarea min-h-[6rem]"
          />
        </label>

        <details className="mt-10">
          <summary className="a-summary">Hebrew</summary>
          <p className="a-hint mt-2">
            Optional, field by field. A field left empty shows the English on the Hebrew page, marked
            as English.
          </p>
          <div className="mt-4 grid gap-5" lang="he" dir="rtl">
            <label className="block">
              <span className="a-label" lang="en" dir="ltr">Title</span>
              <input value={d.heTitle} onChange={(e) => patch({ heTitle: e.target.value })} className="a-input" maxLength={120} />
            </label>
            <label className="block">
              <span className="a-label" lang="en" dir="ltr">Tagline</span>
              <input value={d.heTagline} onChange={(e) => patch({ heTagline: e.target.value })} className="a-input" maxLength={160} />
            </label>
            <label className="block">
              <span className="a-label" lang="en" dir="ltr">Description</span>
              <textarea
                value={d.heDescription}
                onChange={(e) => patch({ heDescription: e.target.value })}
                className="a-textarea min-h-[6rem]"
                maxLength={400}
              />
            </label>
          </div>
        </details>

        <details open className="mt-10">
          <summary className="a-summary">Details</summary>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="a-label">Kind</span>
              <select value={d.kind} onChange={(e) => patch({ kind: e.target.value as Draft["kind"] })} className="a-select">
                <option value="project">Project</option>
                <option value="site">My blog</option>
              </select>
            </label>
            <label className="block">
              <span className="a-label">Visibility</span>
              <select value={d.status} onChange={(e) => patch({ status: e.target.value as Draft["status"] })} className="a-select">
                <option value="published">Published</option>
                <option value="hidden">Hidden</option>
              </select>
            </label>
            <label className="block">
              <span className="a-label">Order (lower comes first)</span>
              <input
                value={d.order}
                onChange={(e) => patch({ order: e.target.value })}
                className="a-input a-input-mono"
                inputMode="numeric"
              />
            </label>
            <label className="block">
              <span className="a-label">Slug (the URL)</span>
              <input
                value={d.slug}
                onChange={(e) => { setSlugTouched(true); patch({ slug: e.target.value }); }}
                onBlur={(e) => patch({ slug: slugify(e.target.value) })}
                className="a-input a-input-mono"
                autoCapitalize="off"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={fieldErrors.slug ? "true" : undefined}
                placeholder="windom"
              />
              {fieldError("slug")}
              <span className="a-hint">
                Lowercase words separated by single hyphens. No dots or spaces &mdash; this becomes
                the URL, so &ldquo;windom.app&rdquo; would not resolve. Tidied when you leave the field.
              </span>
            </label>
            <label className="block sm:col-span-2">
              <span className="a-label">Cover image URL</span>
              <input
                value={d.coverImage}
                onChange={(e) => patch({ coverImage: e.target.value })}
                className="a-input a-input-mono"
                aria-invalid={fieldErrors.coverImage ? "true" : undefined}
                placeholder="https://…"
              />
              {fieldError("coverImage")}
              <span className="a-hint">
                Must be a full https:// URL that returns an image. A GitHub{" "}
                <span className="mono">/blob/</span> link is an HTML page, not an image &mdash; it is saved as
                its <span className="mono">raw.githubusercontent.com</span> address.
              </span>
            </label>
            <div className="sm:col-span-2 -mt-3">
              <MediaPicker value={d.coverImage} onChange={(url) => patch({ coverImage: url })} />
            </div>
            <div className="block sm:col-span-2">
              <span className="a-label" id="area-icon-label">Icon</span>
              <div className="flex flex-wrap items-center gap-3" aria-labelledby="area-icon-label" role="group">
                {d.icon ? (
                  <img src={d.icon} alt="" width={32} height={32} className="rounded-[--r-sm] border border-edge object-contain p-1" />
                ) : (
                  <span className="a-hint m-0">None.</span>
                )}
                <MediaPicker
                  value={d.icon}
                  onChange={(url) => patch({ icon: url })}
                  kinds={["icon"]}
                  label={d.icon ? "Change icon" : "Choose an icon"}
                />
                {d.icon && (
                  <button type="button" className="a-btn a-btn-ghost mt-2" onClick={() => patch({ icon: "" })}>
                    Remove icon
                  </button>
                )}
              </div>
              <span className="a-hint">A small mark for this area, from the library&rsquo;s icons. A one-colour icon takes the text colour around it.</span>
            </div>
          </div>

          {d.coverImage && (
            <img src={d.coverImage} alt="" className="mt-5 max-h-56 w-full rounded-[--r-md] border border-edge object-cover" />
          )}

          <div className="mt-6">
            <LinkEditor links={d.links} onChange={(links) => patch({ links })} />
          </div>
        </details>

        <details open={Boolean(repoLabel)} className="mt-6">
          <summary className="a-summary">Repository</summary>
          <div className="mt-4 grid gap-5 sm:grid-cols-3">
            <label className="block">
              <span className="a-label">Owner</span>
              <input value={d.repoOwner} onChange={(e) => patch({ repoOwner: e.target.value })}
                className="a-input a-input-mono" autoCapitalize="off" spellCheck={false} placeholder="YehudaBriskman" />
            </label>
            <label className="block">
              <span className="a-label">Repo</span>
              <input value={d.repoName} onChange={(e) => patch({ repoName: e.target.value })}
                className="a-input a-input-mono" autoCapitalize="off" spellCheck={false} placeholder="WindoM" />
            </label>
            <label className="block">
              <span className="a-label">Branch</span>
              <input value={d.repoBranch} onChange={(e) => patch({ repoBranch: e.target.value })}
                className="a-input a-input-mono" autoCapitalize="off" spellCheck={false} placeholder="main" />
            </label>
          </div>

          <div className="mt-5">
            <span className="a-label">Published paths</span>
            <DocPathsEditor paths={d.docPaths} repoLabel={repoLabel} onChange={(docPaths) => patch({ docPaths })} />
          </div>

          {repoLabel && !isNew && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="a-btn"
                onClick={async () => {
                  setSyncing(true);
                  try {
                    const r = await admin.syncCollection(d.slug);
                    setStats(r.stats as Record<string, unknown>);
                    setSave({ kind: "saved", at: new Date() });
                  } catch (e) {
                    setSave({ kind: "failed", message: e instanceof Error ? e.message : "Sync failed" });
                  } finally {
                    setSyncing(false);
                  }
                }}
              >
                {syncing ? "Syncing" : "Sync from GitHub"}
              </button>
            </div>
          )}

          {stats && (
            <div className="a-card mt-5 p-4">
              <p className="mono text-[0.6875rem] uppercase tracking-[0.22em] text-clay">From GitHub</p>
              {stats.error ? (
                <p className="a-error">{String(stats.error)}</p>
              ) : (
                <p className="mono mt-2 text-[0.75rem] text-bone/85">
                  {`${stats.stars ?? "—"} stars · ${stats.language ?? "—"} · ${stats.license ?? "—"} · fetched ${
                    stats.fetchedAt ? new Date(String(stats.fetchedAt)).toLocaleString("en-GB") : "never"
                  }`}
                </p>
              )}
              <p className="a-hint">Refreshed automatically every 15 minutes. Never read during a page load.</p>
            </div>
          )}
        </details>

        <div className="mt-10 hidden items-center gap-3 lg:flex">
          <StatusPill state={save_} />
          <button type="button" onClick={() => void commit()} disabled={!canSave} className="a-btn a-btn-primary ml-auto">
            {save_.kind === "saving" ? "Saving" : "Save area"}
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
