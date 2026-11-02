import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AdminShell from "@/components/admin/AdminShell";
import StatusPill, { type SaveState } from "@/components/admin/StatusPill";
import { admin, slugify, AdminValidationError, type AdminCollection } from "@/services/admin";
import LinkEditor, { toLinkRows, type LinkRow } from "@/components/LinkEditor";

type Draft = {
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  body: string;
  status: "draft" | "published" | "archived";
  tags: string;
  collection: string;
  coverImage: string;
  links: LinkRow[];
  _rev?: string;
};

const EMPTY: Draft = {
  slug: "", title: "", subtitle: "", excerpt: "", body: "",
  status: "draft", tags: "", collection: "site", coverImage: "", links: [],
};

export default function AdminEditor() {
  const { slug } = useParams();
  const isNew = !slug || slug === "new";
  const nav = useNavigate();
  const [d, setD] = useState<Draft>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [save_, setSave] = useState<SaveState>({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [cols, setCols] = useState<AdminCollection[]>([]);

  const dirty = save_.kind === "dirty";

  useEffect(() => {
    admin.collections().then((c) => setCols(c.filter((x) => x.status === "published"))).catch(() => setCols([]));
  }, []);

  useEffect(() => {
    if (isNew) return;
    admin
      .get(slug!)
      .then((p) => {
        setD({
          slug: p.slug, title: p.title, subtitle: p.subtitle ?? "", excerpt: p.excerpt,
          body: p.body, status: p.status, tags: p.tags.join(", "), collection: p.collection,
          coverImage: p.coverImage ?? "", links: toLinkRows(p.links), _rev: p._rev,
        });
        setLoading(false);
      })
      .catch((e) => {
        setLoading(false);
        setSave({ kind: "failed", message: e instanceof Error ? e.message : "Failed to load" });
      });
  }, [slug, isNew]);

  /* Leaving with unsaved edits used to destroy them silently. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Any field edit moves the page out of a terminal state and into "dirty",
  // so the bar stops claiming the document is saved the moment it is not.
  // Done in the edit itself: an effect on the draft also fired on mount, on
  // load and on the _rev a save writes back, none of which is an edit.
  const markDirty = () => setSave((s) => (s.kind === "saving" ? s : { kind: "dirty" }));

  const set = (k: keyof Draft, v: string) => {
    setD((prev) => {
      const next = { ...prev, [k]: v };
      // Derive the slug from the title until the author edits it by hand.
      if (k === "title" && !slugTouched) next.slug = slugify(v);
      return next;
    });
    markDirty();
  };

  const commit = useCallback(
    async (status?: Draft["status"], rev?: string) => {
      setSave({ kind: "saving" });
      try {
        const saved = await admin.save(d.slug, {
          title: d.title,
          subtitle: d.subtitle || null,
          excerpt: d.excerpt,
          body: d.body,
          status: status ?? d.status,
          tags: d.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
          collection: d.collection,
          coverImage: d.coverImage.trim() || null,
          links: d.links.filter((l) => l.label && l.url),
          _rev: rev ?? d._rev,
        });
        setD((p) => ({ ...p, _rev: saved._rev, status: saved.status }));
        setSave({ kind: "saved", at: new Date() });
        if (isNew) nav(`/admin/posts/${saved.slug}`, { replace: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Save failed";
        // A 409 is a conversation, not an error message. The old copy told the
        // author to "reload and reapply" with nothing to reload with, and the
        // stale _rev meant every retry failed the same way — a dead end.
        setSave(/changed elsewhere/i.test(message) ? { kind: "conflict" } : { kind: "failed", message });
      }
    },
    [d, isNew, nav],
  );

  /** Fetch the live document, keeping the local text, to break a conflict. */
  async function resolveConflict(keepMine: boolean) {
    try {
      const live = await admin.get(d.slug);
      if (keepMine) {
        await commit(undefined, live._rev);
        return;
      }
      setD({
        slug: live.slug, title: live.title, subtitle: live.subtitle ?? "", excerpt: live.excerpt,
        body: live.body, status: live.status, tags: live.tags.join(", "), collection: live.collection,
        coverImage: live.coverImage ?? "", links: toLinkRows(live.links), _rev: live._rev,
      });
      setSave({ kind: "idle" });
    } catch (e) {
      setSave({ kind: "failed", message: e instanceof Error ? e.message : "Could not reload" });
    }
  }

  const canSave = save_.kind !== "saving" && Boolean(d.slug) && Boolean(d.title);
  const heading = isNew ? "New post" : d.title || d.slug;

  const bottomBar = (
    <div className="flex items-center gap-3 px-4 py-2">
      <StatusPill state={save_} />
      <div className="ml-auto flex gap-2">
        <button type="button" onClick={() => commit()} disabled={!canSave} className="a-btn">
          {save_.kind === "saving" ? "Saving" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => commit("published")}
          disabled={!canSave || !d.body}
          className="a-btn a-btn-primary"
        >
          Publish
        </button>
      </div>
    </div>
  );

  return (
    <AdminShell title={heading} section="posts" backTo="/admin/posts" bottomBar={bottomBar}>
      {loading ? (
        <p className="mono mt-4 text-xs text-clay">Loading…</p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (canSave) void commit(); }}>
          {/* The editor had no h1 at all — its only heading-like element was a
              "← Posts" button. */}
          <h1 className="display-tight text-[1.75rem] lg:text-[2.25rem]">{heading}</h1>

          {save_.kind === "conflict" && (
            <div className="a-card mt-6 border-l-2 border-l-sodium p-4">
              <p className="text-sm leading-relaxed text-bone">
                This post was changed somewhere else after you opened it. Saving now would
                overwrite that change.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="a-btn" onClick={() => void resolveConflict(false)}>
                  Load the other version
                </button>
                <button type="button" className="a-btn a-btn-danger" onClick={() => void resolveConflict(true)}>
                  Overwrite with mine
                </button>
                <button
                  type="button"
                  className="a-btn a-btn-ghost"
                  onClick={() => void navigator.clipboard.writeText(d.body)}
                >
                  Copy my body
                </button>
              </div>
            </div>
          )}

          <label className="mt-8 block">
            <span className="a-label">Title</span>
            <input
              value={d.title}
              onChange={(e) => set("title", e.target.value)}
              className="a-input a-input-title"
              placeholder="Every check must be able to fail"
            />
          </label>

          <div className="mt-8 flex items-center justify-between">
            <span className="a-label mb-0">Body (markdown)</span>
            <button type="button" onClick={() => setPreview((p) => !p)} className="a-btn a-btn-ghost">
              {preview ? "Write" : "Preview"}
            </button>
          </div>

          {preview ? (
            /* Same renderer as the public page, so what you see here is exactly
               what ships — no second markdown pipeline to drift apart. */
            <div className="prose prose-invert a-card mt-3 max-w-none p-5
              prose-headings:font-[Archivo] prose-p:text-bone/75 prose-a:text-sodium
              prose-code:text-sodium prose-code:before:content-none prose-code:after:content-none
              prose-pre:border prose-pre:border-edge prose-pre:bg-surface">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{d.body || "_Nothing yet._"}</ReactMarkdown>
            </div>
          ) : (
            <textarea
              value={d.body}
              onChange={(e) => set("body", e.target.value)}
              spellCheck
              className="a-textarea a-input-mono mt-3 min-h-[24rem] leading-relaxed"
              placeholder={"## A heading\n\nText, `code`, and fenced blocks all work."}
            />
          )}

          <details open className="mt-10">
            <summary className="a-summary">Details</summary>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="a-label">Status</span>
                <select value={d.status} onChange={(e) => set("status", e.target.value)} className="a-select">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="block">
                <span className="a-label">Area</span>
                <select value={d.collection} onChange={(e) => set("collection", e.target.value)} className="a-select">
                  {(cols.length ? cols : [{ slug: "site", title: "Notes" } as AdminCollection]).map((c) => (
                    <option key={c.slug} value={c.slug}>{c.title}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="a-label">Tags (comma separated)</span>
                <input value={d.tags} onChange={(e) => set("tags", e.target.value)} className="a-input a-input-mono" placeholder="ci, testing" />
              </label>
              <label className="block">
                <span className="a-label">Cover image URL</span>
                <input value={d.coverImage} onChange={(e) => set("coverImage", e.target.value)} className="a-input a-input-mono" placeholder="https://…" />
                <span className="a-hint">Must be a full https:// URL, or the save is rejected.</span>
              </label>
              <label className="block sm:col-span-2">
                <span className="a-label">Subtitle</span>
                <input value={d.subtitle} onChange={(e) => set("subtitle", e.target.value)} className="a-input" />
              </label>
              <label className="block sm:col-span-2">
                <span className="a-label">Excerpt</span>
                <textarea
                  value={d.excerpt}
                  onChange={(e) => set("excerpt", e.target.value)}
                  maxLength={320}
                  className="a-textarea min-h-[5rem]"
                />
                <span className="a-hint">
                  {d.excerpt.length}/320. Shown in the list and used for search results.
                </span>
              </label>
            </div>
          </details>

          <details className="mt-6">
            <summary className="a-summary">Advanced</summary>
            <div className="mt-4">
              <label className="block">
                <span className="a-label">Slug</span>
                <input
                  value={d.slug}
                  onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }}
                  className="a-input a-input-mono"
                  autoCapitalize="off"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="every-check-must-be-able-to-fail"
                />
                <span className="a-hint">
                  The slug is the document&rsquo;s identity. Changing it after publishing creates a
                  new document and leaves the old URL behind.
                </span>
              </label>
              <div className="mt-6">
                <LinkEditor links={d.links} onChange={(links) => { setD((p) => ({ ...p, links })); markDirty(); }} />
              </div>
            </div>
          </details>

          {/* Desktop keeps the same controls inline; the fixed bar is mobile-only. */}
          <div className="mt-10 hidden items-center gap-3 lg:flex">
            <StatusPill state={save_} />
            <div className="ml-auto flex gap-3">
              <button type="button" onClick={() => commit()} disabled={!canSave} className="a-btn">
                {save_.kind === "saving" ? "Saving" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => commit("published")}
                disabled={!canSave || !d.body}
                className="a-btn a-btn-primary"
              >
                Publish
              </button>
            </div>
          </div>
        </form>
      )}
    </AdminShell>
  );
}
