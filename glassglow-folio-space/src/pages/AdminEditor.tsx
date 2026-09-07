import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PageShell from "@/components/PageShell";
import { admin, slugify, type AdminCollection } from "@/services/admin";
import LinkEditor, { type LinkRow } from "@/components/LinkEditor";

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

const EMPTY: Draft = { slug: "", title: "", subtitle: "", excerpt: "", body: "", status: "draft", tags: "", collection: "site", coverImage: "", links: [] };

export default function AdminEditor() {
  const { slug } = useParams();
  const isNew = !slug || slug === "new";
  const nav = useNavigate();
  const [d, setD] = useState<Draft>(EMPTY);
  const [state, setState] = useState<"loading" | "ready" | "saving">(isNew ? "ready" : "loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [cols, setCols] = useState<AdminCollection[]>([]);

  useEffect(() => {
    admin.collections().then((c) => setCols(c.filter((x) => x.status === "published"))).catch(() => setCols([]));
  }, []);

  useEffect(() => {
    if (isNew) return;
    admin
      .get(slug!)
      .then((p) =>
        setD({
          slug: p.slug,
          title: p.title,
          subtitle: p.subtitle ?? "",
          excerpt: p.excerpt,
          body: p.body,
          status: p.status,
          tags: p.tags.join(", "),
          collection: p.collection,
          coverImage: p.coverImage ?? "",
          links: p.links,
          _rev: p._rev,
        })
      )
      .then(() => setState("ready"))
      .catch((e) => setMsg(e instanceof Error ? e.message : "Failed to load"));
  }, [slug, isNew]);

  const set = (k: keyof Draft, v: string) =>
    setD((prev) => {
      const next = { ...prev, [k]: v };
      // Derive the slug from the title until the author edits it by hand.
      if (k === "title" && !slugTouched) next.slug = slugify(v);
      return next;
    });

  async function save(status?: Draft["status"]) {
    setState("saving");
    setMsg(null);
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
        _rev: d._rev,
      });
      setD((p) => ({ ...p, _rev: saved._rev, status: saved.status }));
      setMsg(status === "published" ? "Published." : "Saved.");
      if (isNew) nav(`/admin/posts/${saved.slug}`, { replace: true });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setState("ready");
    }
  }

  const field =
    "mt-2 w-full border-0 border-b border-edge bg-transparent px-0 py-2.5 text-bone placeholder:text-bone/25 focus:border-sodium focus:outline-none focus:ring-0 transition-colors";
  const label = "mono text-[0.625rem] uppercase tracking-[0.22em] text-bone/45";

  return (
    <PageShell>
      <section className="isolate relative mx-auto max-w-5xl px-6 pb-28 pt-40">
        <button onClick={() => nav("/admin")} className="mono text-[0.6875rem] uppercase tracking-[0.22em] text-bone/45 transition-colors hover:text-sodium">
          ← Posts
        </button>

        {state === "loading" ? (
          <p className="mono mt-10 text-xs text-bone/40">Loading…</p>
        ) : (
          <>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={label}>Title</span>
                <input value={d.title} onChange={(e) => set("title", e.target.value)} className={`${field} text-xl`} placeholder="Every check must be able to fail" />
              </label>
              <label className="block">
                <span className={label}>Slug</span>
                <input value={d.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }} className={`${field} mono text-sm`} placeholder="every-check-must-be-able-to-fail" />
              </label>
              <label className="block">
                <span className={label}>Tags (comma separated)</span>
                <input value={d.tags} onChange={(e) => set("tags", e.target.value)} className={`${field} mono text-sm`} placeholder="ci, testing" />
              </label>
              <label className="block">
                <span className={label}>Area</span>
                <select
                  value={d.collection}
                  onChange={(e) => set("collection", e.target.value)}
                  className={`${field} mono text-sm`}
                >
                  {(cols.length ? cols : [{ slug: "site", title: "Notes" } as AdminCollection]).map((c) => (
                    <option key={c.slug} value={c.slug} className="bg-surface text-bone">
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={label}>Cover image URL</span>
                <input value={d.coverImage} onChange={(e) => set("coverImage", e.target.value)} className={`${field} mono text-xs`} placeholder="https://…" />
              </label>
              <label className="block sm:col-span-2">
                <span className={label}>Subtitle</span>
                <input value={d.subtitle} onChange={(e) => set("subtitle", e.target.value)} className={field} />
              </label>
              <label className="block sm:col-span-2">
                <span className={label}>Excerpt — shown in the list and used for search results</span>
                <input value={d.excerpt} onChange={(e) => set("excerpt", e.target.value)} className={field} maxLength={320} />
              </label>
            </div>

            <div className="mt-10 flex items-center justify-between">
              <span className={label}>Body — markdown</span>
              <button onClick={() => setPreview((p) => !p)} className="mono text-[0.625rem] uppercase tracking-[0.2em] text-bone/45 transition-colors hover:text-sodium">
                {preview ? "Write" : "Preview"}
              </button>
            </div>

            {preview ? (
              /* Same renderer as the public page, so what you see here is exactly
                 what ships — no second markdown pipeline to drift apart. */
              <div className="prose prose-invert mt-4 max-w-none rounded panel p-6
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
                className="mono mt-4 min-h-[26rem] w-full resize-y rounded panel p-5 text-sm leading-relaxed text-bone/85 focus:border-sodium focus:outline-none"
                placeholder={"## A heading\n\nText, `code`, and fenced blocks all work."}
              />
            )}

            <div className="mt-10">
              <LinkEditor links={d.links} onChange={(links) => setD((p) => ({ ...p, links }))} />
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <button
                onClick={() => save()}
                disabled={state === "saving" || !d.slug || !d.title}
                className="pill mono border border-edge px-6 py-3 text-xs uppercase tracking-[0.2em] text-bone/80 transition-colors hover:border-bone/50 disabled:opacity-40"
              >
                {state === "saving" ? "Saving" : "Save draft"}
              </button>
              <button
                onClick={() => save("published")}
                disabled={state === "saving" || !d.slug || !d.title || !d.body}
                className="pill mono border border-sodium px-6 py-3 text-xs uppercase tracking-[0.2em] text-sodium transition-colors hover:bg-sodium hover:text-bitumen disabled:opacity-40"
              >
                Publish
              </button>
              <span className="mono text-[0.6875rem] uppercase tracking-[0.2em] text-bone/40">
                status: {d.status}
              </span>
              {msg && <span className="mono text-[0.6875rem] text-sodium">{msg}</span>}
            </div>
          </>
        )}
      </section>
    </PageShell>
  );
}
