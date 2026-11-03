import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import MediaPicker, { PickedPreview } from "@/components/admin/MediaPicker";
import LinkEditor, { toLinkRows, type LinkRow } from "@/components/LinkEditor";
import BodyEditor, { type WikiTarget } from "@/components/admin/noteEditor/BodyEditor";
import ReviewDialog from "@/components/admin/noteEditor/ReviewDialog";
import { useEditorWords } from "@/components/admin/noteEditor/words";
import styles from "@/components/admin/noteEditor/NoteEditor.module.css";
import NoteMarkdown, { PROSE } from "@/components/notes/reader/NoteMarkdown";
import { useContent } from "@/content/store";
import { admin, slugify, AdminValidationError, type AdminCollection, type AdminPost, type PostContent } from "@/services/admin";

/*
 * The note editor (#250), the way Bothy edits files: write on one side, read
 * on the other through the very renderer the public page uses, and nothing
 * reaches a reader until Publish.
 *
 *  - Autosave writes a server-side draft a moment after typing stops. On a
 *    published note that draft sits beside the note and the public keeps
 *    reading the published words (backend: PUT /posts/:slug/draft).
 *  - Publish opens a review: every changed field, a line diff of the body,
 *    and a "what changed" line that the reader shows beside Updated.
 *  - The toolbar, shortcuts, `[[` autocomplete and picture upload live in
 *    BodyEditor; this page holds the note's fields and the save cycle.
 *  - Leaving with an edit that has not reached the server asks first.
 */

type Form = {
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  body: string;
  tags: string[];
  collection: string;
  coverImage: string;
  featured: string;
  publishedAt: string;
  links: LinkRow[];
  seoTitle: string;
  seoDescription: string;
  canonical: string;
  noindex: boolean;
  heTitle: string;
  heSubtitle: string;
  heExcerpt: string;
  heBody: string;
};

const EMPTY: Form = {
  slug: "", title: "", subtitle: "", excerpt: "", body: "", tags: [], collection: "site", coverImage: "",
  featured: "", publishedAt: "", links: [], seoTitle: "", seoDescription: "", canonical: "", noindex: false,
  heTitle: "", heSubtitle: "", heExcerpt: "", heBody: "",
};

type Save =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "failed"; message: string }
  | { kind: "conflict" };

/** The editable content of a stored note: its draft when it has one. */
function contentOf(p: AdminPost, useDraft: boolean): PostContent {
  if (useDraft && p.draft) return p.draft;
  return {
    title: p.title, subtitle: p.subtitle, excerpt: p.excerpt, body: p.body, tags: p.tags, collection: p.collection,
    coverImage: p.coverImage, links: p.links, featured: p.featured, publishedAt: p.publishedAt, seo: p.seo,
    he: p.he ?? null,
  };
}

function toForm(slug: string, c: PostContent): Form {
  return {
    slug,
    title: c.title ?? "",
    subtitle: c.subtitle ?? "",
    excerpt: c.excerpt ?? "",
    body: c.body ?? "",
    tags: c.tags ?? [],
    collection: c.collection ?? "site",
    coverImage: c.coverImage ?? "",
    featured: c.featured == null ? "" : String(c.featured),
    publishedAt: c.publishedAt ?? "",
    links: toLinkRows(c.links ?? []),
    seoTitle: c.seo?.title ?? "",
    seoDescription: c.seo?.description ?? "",
    canonical: c.seo?.canonical ?? "",
    noindex: c.seo?.noindex ?? false,
    heTitle: c.he?.title ?? "",
    heSubtitle: c.he?.subtitle ?? "",
    heExcerpt: c.he?.excerpt ?? "",
    heBody: c.he?.body ?? "",
  };
}

function toContent(f: Form): PostContent {
  const featured = Number(f.featured);
  const he = { title: f.heTitle, subtitle: f.heSubtitle, excerpt: f.heExcerpt, body: f.heBody };
  return {
    title: f.title.trim(),
    subtitle: f.subtitle.trim() || null,
    excerpt: f.excerpt,
    body: f.body,
    tags: f.tags,
    collection: f.collection,
    coverImage: f.coverImage.trim() || null,
    links: f.links.filter((l) => l.label && l.url),
    featured: f.featured.trim() && Number.isInteger(featured) ? featured : null,
    publishedAt: f.publishedAt || null,
    seo: {
      title: f.seoTitle.trim() || null,
      description: f.seoDescription.trim() || null,
      canonical: f.canonical.trim() || null,
      noindex: f.noindex,
    },
    he: Object.values(he).some((v) => v.trim()) ? he : null,
  };
}

/** A date input's day, kept with the stored time when the day is unchanged. */
function dayOf(iso: string) {
  return iso ? iso.slice(0, 10) : "";
}
function withDay(stored: string, day: string) {
  if (!day) return "";
  if (stored.startsWith(day)) return stored;
  return new Date(`${day}T12:00:00.000Z`).toISOString();
}

const TAG = /^[a-z0-9-]{1,40}$/;

function TagsField({
  id, tags, known, onChange, words,
}: {
  id: string;
  tags: string[];
  known: string[];
  onChange: (tags: string[]) => void;
  words: ReturnType<typeof useEditorWords>[0];
}) {
  const [text, setText] = useState("");
  const listId = useId();
  const helpId = useId();
  const add = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (TAG.test(t) && !tags.includes(t) && tags.length < 8) onChange([...tags, t]);
    setText("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && text.trim()) {
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && !text && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };
  return (
    <div>
      <label className="a-label" htmlFor={id}>{words.tags}</label>
      <div className={styles.tags}>
        <ul className="contents" aria-label={words.tags}>
          {tags.map((t) => (
            <li key={t} className={styles.tag}>
              <span dir="ltr">#{t}</span>
              <button type="button" className={styles.tagRemove} aria-label={words.removeTag(t)} onClick={() => onChange(tags.filter((x) => x !== t))}>
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <input
          id={id}
          className={styles.tagInput}
          value={text}
          list={listId}
          dir="ltr"
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          placeholder={words.addTag}
          aria-describedby={helpId}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value.slice(0, -1)) : setText(e.target.value))}
          onKeyDown={onKey}
          onBlur={() => text.trim() && add(text)}
        />
        <datalist id={listId}>
          {known.filter((k) => !tags.includes(k)).map((k) => <option key={k} value={k} />)}
        </datalist>
      </div>
      <span id={helpId} className="a-hint">{words.tagsHelp}</span>
    </div>
  );
}

export default function AdminEditor() {
  const { slug } = useParams();
  const isNew = !slug || slug === "new";
  const nav = useNavigate();
  const [w, lang] = useEditorWords();
  const projects = useContent().projects;
  const ids = { title: useId(), body: useId(), bodyHelp: useId(), tags: useId(), slug: useId() };

  const [post, setPost] = useState<AdminPost | null>(null);
  const [f, setF] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [save, setSave] = useState<Save>({ kind: "idle" });
  const [version, setVersion] = useState(0);
  const [savedVersion, setSavedVersion] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(false);
  const [bodyLang, setBodyLang] = useState<"en" | "he">("en");
  const [preview, setPreview] = useState(true);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [cols, setCols] = useState<AdminCollection[]>([]);
  const [all, setAll] = useState<AdminPost[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const loadedSlug = useRef<string | null>(null);

  const dirty = version !== savedVersion;
  const stored = post !== null;
  const published = post?.status === "published" ? contentOf(post, false) : null;
  const content = useMemo(() => toContent(f), [f]);
  const canSave = Boolean(f.slug && f.title.trim()) && save.kind !== "saving" && save.kind !== "conflict";

  useEffect(() => {
    admin.collections().then((c) => setCols(c.filter((x) => x.status === "published"))).catch(() => setCols([]));
    admin.list().then(setAll).catch(() => setAll([]));
  }, []);

  const adopt = useCallback((p: AdminPost) => {
    setPost(p);
    setF(toForm(p.slug, contentOf(p, true)));
    setSlugTouched(true);
    loadedSlug.current = p.slug;
  }, []);

  useEffect(() => {
    if (isNew || loadedSlug.current === slug) return;
    admin
      .get(slug!)
      .then((p) => {
        adopt(p);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setLoading(false);
        setSave({ kind: "failed", message: e instanceof Error ? e.message : "?" });
      });
  }, [slug, isNew, adopt]);

  const edit = useCallback(<K extends keyof Form>(k: K, v: Form[K]) => {
    setF((prev) => {
      const next = { ...prev, [k]: v };
      if (k === "title" && !slugTouched && !stored) next.slug = slugify(String(v));
      return next;
    });
    setVersion((n) => n + 1);
    setSave((s) => (s.kind === "saving" || s.kind === "conflict" ? s : { kind: "dirty" }));
  }, [slugTouched, stored]);

  /* ------------------------------------------------------------ saving */

  const versionRef = useRef(version);
  versionRef.current = version;

  const saveDraft = useCallback(async () => {
    if (!f.slug || !f.title.trim()) return;
    const at = versionRef.current;
    setSave({ kind: "saving" });
    try {
      const saved = await admin.saveDraft(f.slug, { ...content, _rev: post?._rev });
      setPost(saved);
      setErrors({});
      setSavedVersion(at);
      setSave(at === versionRef.current ? { kind: "saved", at: new Date() } : { kind: "dirty" });
      if (loadedSlug.current !== saved.slug) {
        loadedSlug.current = saved.slug;
        setSlugTouched(true);
        nav(`/admin/posts/${saved.slug}`, { replace: true });
      }
    } catch (e) {
      if (e instanceof AdminValidationError) setErrors(e.fieldErrors);
      const message = e instanceof Error ? e.message : "?";
      setSave(/changed elsewhere/i.test(message) ? { kind: "conflict" } : { kind: "failed", message: e instanceof AdminValidationError ? describe(e.fieldErrors) : message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one save per call, with what is on screen now
  }, [f, content, post?._rev, nav]);

  function describe(fields: Record<string, string>) {
    return Object.entries(fields).map(([k, m]) => `${w.fieldNames[k] ?? k}: ${m}`).join("; ");
  }

  /* Autosave: a moment after typing stops, only once the note exists. */
  useEffect(() => {
    if (!dirty || !stored || save.kind === "saving" || save.kind === "conflict" || save.kind === "failed") return;
    const t = window.setTimeout(() => void saveDraft(), 1500);
    return () => window.clearTimeout(t);
  }, [dirty, stored, save.kind, version, saveDraft]);

  /* Leaving with an edit that has not reached the server asks first: the tab
     closing, and a link inside the app (BrowserRouter has no blocker). */
  const unsaved = dirty || save.kind === "saving";
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || a.target === "_blank" || a.origin !== window.location.origin) return;
      if (a.pathname === window.location.pathname) return;
      if (!window.confirm(w.leaveConfirm)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", click, true);
    };
  }, [unsaved, w.leaveConfirm]);

  async function resolveConflict(keepMine: boolean) {
    try {
      const live = await admin.get(f.slug);
      if (keepMine) {
        setPost(live);
        setSave({ kind: "dirty" });
        const saved = await admin.saveDraft(f.slug, { ...content, _rev: live._rev });
        setPost(saved);
        setSavedVersion(versionRef.current);
        setSave({ kind: "saved", at: new Date() });
        return;
      }
      adopt(live);
      setSavedVersion(versionRef.current);
      setSave({ kind: "idle" });
    } catch (e) {
      setSave({ kind: "failed", message: e instanceof Error ? e.message : "?" });
    }
  }

  async function discard() {
    if (!post?._rev || !window.confirm(w.discardConfirm)) return;
    try {
      const p = await admin.discardDraft(post.slug, post._rev);
      adopt(p);
      setSavedVersion(versionRef.current);
      setSave({ kind: "idle" });
    } catch (e) {
      setSave({ kind: "failed", message: e instanceof Error ? e.message : "?" });
    }
  }

  async function unpublish() {
    if (!post) return;
    try {
      const p = await admin.save(post.slug, { ...contentOf(post, false), status: "draft", _rev: post._rev });
      setPost(p);
    } catch (e) {
      setSave({ kind: "failed", message: e instanceof Error ? e.message : "?" });
    }
  }

  async function publish(changeNote: string) {
    setPublishing(true);
    setPublishError(null);
    const at = versionRef.current;
    try {
      const p = await admin.publish(f.slug, { ...content, _rev: post?._rev, ...(changeNote ? { changeNote } : {}) });
      adopt(p);
      setSavedVersion(at);
      setSave({ kind: "saved", at: new Date() });
      setNotice({ text: w.published });
      setReviewing(false);
      if (isNew) nav(`/admin/posts/${p.slug}`, { replace: true });
    } catch (e) {
      const message = e instanceof AdminValidationError ? describe(e.fieldErrors) : e instanceof Error ? e.message : "?";
      if (e instanceof AdminValidationError) setErrors(e.fieldErrors);
      setPublishError(message);
    } finally {
      setPublishing(false);
    }
  }

  /* ------------------------------------------------------------ [[ list */

  const targets = useMemo<WikiTarget[]>(() => {
    const notes = all
      .filter((p) => p.status !== "archived" && p.slug !== f.slug)
      .map((p) => ({ kind: "note" as const, target: p.slug, title: p.title }));
    const areas = cols.map((c) => ({ kind: "area" as const, target: `area:${c.slug}`, title: c.title }));
    const work = projects.map((p) => ({ kind: "project" as const, target: `project:${p.slug}`, title: p.title }));
    return [...notes, ...areas, ...work];
  }, [all, cols, projects, f.slug]);

  const knownTags = useMemo(() => [...new Set(all.flatMap((p) => p.tags))].sort(), [all]);

  /* ------------------------------------------------------------ status */

  const clock = (d: Date) => new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", { hour: "2-digit", minute: "2-digit" }).format(d);
  const statusText =
    save.kind === "saving" ? w.saving
    : save.kind === "saved" ? w.autosaved(clock(save.at))
    : save.kind === "dirty" ? w.unsaved
    : save.kind === "failed" ? w.saveFailed(save.message)
    : save.kind === "conflict" ? w.conflict
    : "";
  const bad = save.kind === "failed" || save.kind === "conflict";

  const heading = isNew && !stored ? w.newNote : f.title || f.slug;
  const hasDraft = Boolean(published && (post?.draft || dirty));

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <span className={styles.status} data-bad={bad || undefined} role="status" aria-live={bad ? "assertive" : "polite"}>
        {post && <span className="me-2 text-bone">{w.status[post.status]}</span>}
        {statusText}
      </span>
      <div className="ms-auto flex flex-wrap gap-2">
        {published && post?.draft && !dirty && (
          <button type="button" className="a-btn a-btn-ghost" onClick={() => void discard()}>{w.discard}</button>
        )}
        <button type="button" className="a-btn" disabled={!canSave} onClick={() => void saveDraft()} aria-keyshortcuts="Control+S">
          {w.saveNow}
        </button>
        <button
          type="button"
          className="a-btn a-btn-primary"
          disabled={!canSave || !f.body.trim() || (published !== null && !hasDraft)}
          aria-haspopup="dialog"
          onClick={() => {
            setPublishError(null);
            setReviewing(true);
          }}
        >
          {w.review}
        </button>
      </div>
    </div>
  );

  const bodyValue = bodyLang === "he" ? f.heBody : f.body;
  const setBody = (v: string) => edit(bodyLang === "he" ? "heBody" : "body", v);

  return (
    <AdminShell title={heading} section="posts" backTo="/admin/posts" bottomBar={<div className="px-4 py-2">{actions}</div>}>
      {loading ? (
        <p className="mono mt-4 text-xs text-clay">{w.loading}</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) void saveDraft();
          }}
        >
          <h1 className="display-tight text-[1.75rem] lg:text-[2.25rem]">{heading}</h1>

          {save.kind === "conflict" && (
            <div className={styles.notice} role="alert">
              <p>{w.conflict}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="a-btn" onClick={() => void resolveConflict(false)}>{w.loadTheirs}</button>
                <button type="button" className="a-btn a-btn-danger" onClick={() => void resolveConflict(true)}>{w.keepMine}</button>
              </div>
            </div>
          )}

          <p className={styles.notice}>
            {!stored ? w.newNoteHint
              : published ? (post?.draftSavedAt && hasDraft ? w.unpublishedSince(clock(new Date(post.draftSavedAt))) : w.status.published)
              : w.neverPublished}
            {published && (
              <button type="button" className="a-btn a-btn-ghost ms-3" onClick={() => void unpublish()}>{w.unpublish}</button>
            )}
          </p>
          {notice && (
            <p className={styles.status} data-bad={notice.bad || undefined} role="status">{notice.text}</p>
          )}

          <label className="mt-8 block" htmlFor={ids.title}>
            <span className="a-label">{w.title}</span>
            <input
              id={ids.title}
              value={f.title}
              onChange={(e) => edit("title", e.target.value)}
              className="a-input a-input-title"
              placeholder={w.titlePlaceholder}
              aria-invalid={errors.title ? true : undefined}
            />
          </label>
          {!stored && (
            <label className="mt-4 block" htmlFor={ids.slug}>
              <span className="a-label">{w.slug}</span>
              <input
                id={ids.slug}
                value={f.slug}
                dir="ltr"
                onChange={(e) => {
                  setSlugTouched(true);
                  edit("slug", slugify(e.target.value));
                }}
                className="a-input a-input-mono"
                autoCapitalize="off"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={errors.slug ? true : undefined}
              />
              <span className="a-hint">{w.slugHelp}</span>
            </label>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <label className="a-label mb-0" htmlFor={ids.body}>{w.body}</label>
            <div className="flex flex-wrap gap-2">
              <div role="group" aria-label={w.editingIn} className="flex gap-1">
                {(["en", "he"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    className={`a-btn a-btn-ghost ${styles.toggle}`}
                    aria-pressed={bodyLang === l}
                    onClick={() => setBodyLang(l)}
                  >
                    {l === "en" ? w.bodyEnglish : w.bodyHebrew}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`a-btn a-btn-ghost ${styles.toggle}`}
                aria-pressed={preview}
                aria-keyshortcuts="Control+Shift+P"
                onClick={() => setPreview((p) => !p)}
              >
                {w.preview}
              </button>
            </div>
          </div>
          <p id={ids.bodyHelp} className="a-hint">{w.bodyHelp} {w.shortcuts}</p>

          <div className={styles.split} data-side={preview}>
            <BodyEditor
              id={ids.body}
              value={bodyValue}
              onChange={setBody}
              lang={bodyLang}
              targets={targets}
              words={w}
              describedBy={ids.bodyHelp}
              onStatus={(text, isBad) => setNotice({ text, bad: isBad })}
              onSave={() => canSave && void saveDraft()}
              onTogglePreview={() => setPreview((p) => !p)}
            />
            {preview && (
              <section aria-label={w.previewLabel} className={styles.preview} lang={bodyLang} dir={bodyLang === "he" ? "rtl" : "ltr"}>
                {bodyValue.trim() ? (
                  <NoteMarkdown body={bodyValue} pen={false} className={`${PROSE} !mt-0`} />
                ) : (
                  <p className="text-clay">{w.nothingYet}</p>
                )}
              </section>
            )}
          </div>

          <details open className="mt-10">
            <summary className="a-summary">{w.details}</summary>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="a-label">{w.area}</span>
                <select value={f.collection} onChange={(e) => edit("collection", e.target.value)} className="a-select">
                  {(cols.length ? cols : [{ slug: "site", title: "Notes" } as AdminCollection]).map((c) => (
                    <option key={c.slug} value={c.slug}>{c.title}</option>
                  ))}
                </select>
              </label>
              <TagsField id={ids.tags} tags={f.tags} known={knownTags} onChange={(t) => edit("tags", t)} words={w} />
              <label className="block">
                <span className="a-label">{w.publishDate}</span>
                <input
                  type="date"
                  value={dayOf(f.publishedAt)}
                  onChange={(e) => edit("publishedAt", withDay(f.publishedAt, e.target.value))}
                  className="a-input a-input-mono"
                />
                <span className="a-hint">{w.publishDateHelp}</span>
              </label>
              <label className="block">
                <span className="a-label">{w.featured}</span>
                <input
                  value={f.featured}
                  onChange={(e) => edit("featured", e.target.value.replace(/\D/g, "").slice(0, 2))}
                  className="a-input a-input-mono"
                  inputMode="numeric"
                  placeholder={w.notFeatured}
                  aria-invalid={errors.featured ? true : undefined}
                />
                <span className="a-hint">{errors.featured ?? w.featuredHelp}</span>
              </label>
              <div className="sm:col-span-2">
                <label className="block">
                  <span className="a-label">{w.cover}</span>
                  <input
                    value={f.coverImage}
                    dir="ltr"
                    onChange={(e) => edit("coverImage", e.target.value)}
                    className="a-input a-input-mono"
                    placeholder="https://…"
                    aria-invalid={errors.coverImage ? true : undefined}
                  />
                  <span className="a-hint">{errors.coverImage ?? w.coverHelp}</span>
                </label>
                <MediaPicker value={f.coverImage} onChange={(url) => edit("coverImage", url)} />
                <PickedPreview url={f.coverImage} />
              </div>
              <label className="block sm:col-span-2">
                <span className="a-label">{w.subtitle}</span>
                <input value={f.subtitle} onChange={(e) => edit("subtitle", e.target.value)} className="a-input" />
              </label>
              <label className="block sm:col-span-2">
                <span className="a-label">{w.excerpt}</span>
                <textarea value={f.excerpt} onChange={(e) => edit("excerpt", e.target.value)} maxLength={320} className="a-textarea min-h-[5rem]" />
                <span className="a-hint">{w.excerptHelp(f.excerpt.length)}</span>
              </label>
            </div>
          </details>

          <details className="mt-6">
            <summary className="a-summary">{w.seo}</summary>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="a-label">{w.seoTitle}</span>
                <input value={f.seoTitle} maxLength={200} onChange={(e) => edit("seoTitle", e.target.value)} className="a-input" />
                <span className="a-hint">{w.seoTitleHelp}</span>
              </label>
              <label className="block">
                <span className="a-label">{w.canonical}</span>
                <input
                  value={f.canonical}
                  dir="ltr"
                  onChange={(e) => edit("canonical", e.target.value)}
                  className="a-input a-input-mono"
                  placeholder="https://…"
                  aria-invalid={errors.seo ? true : undefined}
                />
                <span className="a-hint">{w.canonicalHelp}</span>
              </label>
              <label className="block sm:col-span-2">
                <span className="a-label">{w.seoDescription}</span>
                <textarea value={f.seoDescription} maxLength={320} onChange={(e) => edit("seoDescription", e.target.value)} className="a-textarea min-h-[4rem]" />
                <span className="a-hint">{w.seoDescriptionHelp}</span>
              </label>
              <label className="flex items-center gap-3 sm:col-span-2">
                <input type="checkbox" checked={f.noindex} onChange={(e) => edit("noindex", e.target.checked)} />
                <span className="text-sm text-bone">{w.noindex}</span>
              </label>
            </div>
          </details>

          <details className="mt-6">
            <summary className="a-summary">{w.hebrew}</summary>
            <p className="a-hint mt-3">{w.hebrewHelp}</p>
            <div className="mt-4 grid gap-5" lang="he" dir="rtl">
              <label className="block">
                <span className="a-label">{`${w.title} (${w.bodyHebrew})`}</span>
                <input value={f.heTitle} maxLength={200} onChange={(e) => edit("heTitle", e.target.value)} className="a-input" />
              </label>
              <label className="block">
                <span className="a-label">{`${w.subtitle} (${w.bodyHebrew})`}</span>
                <input value={f.heSubtitle} maxLength={300} onChange={(e) => edit("heSubtitle", e.target.value)} className="a-input" />
              </label>
              <label className="block">
                <span className="a-label">{`${w.excerpt} (${w.bodyHebrew})`}</span>
                <textarea value={f.heExcerpt} maxLength={320} onChange={(e) => edit("heExcerpt", e.target.value)} className="a-textarea min-h-[4rem]" />
              </label>
            </div>
          </details>

          <details className="mt-6">
            <summary className="a-summary">{w.advanced}</summary>
            <div className="mt-4">
              {stored && (
                <p className="text-sm text-bone">
                  <span className="a-label">{w.slug}</span>
                  <code dir="ltr" className="a-input-mono">{f.slug}</code>
                  <span className="a-hint">{w.slugLocked}</span>
                </p>
              )}
              <div className="mt-6">
                <LinkEditor links={f.links} onChange={(links) => edit("links", links)} />
              </div>
            </div>
          </details>

          <div className="mt-10 hidden lg:block">{actions}</div>
        </form>
      )}

      <ReviewDialog
        open={reviewing}
        onClose={() => setReviewing(false)}
        published={published}
        next={content}
        words={w}
        busy={publishing}
        error={publishError}
        onPublish={(note) => void publish(note)}
      />
    </AdminShell>
  );
}
