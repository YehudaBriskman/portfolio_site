import Select from "@/components/ui/Select";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import EditorBar, { type BarAction, type BarTone } from "@/components/admin/EditorBar";
import { PageHeader, StatePill } from "@/components/admin/ui";
import MediaPicker, { PickedPreview } from "@/components/admin/MediaPicker";
import LinkEditor, { linkLabelsHe, toLinkRows, type LinkRow } from "@/components/LinkEditor";
import BodyEditor, { type WikiTarget } from "@/components/admin/noteEditor/BodyEditor";
import ReviewDialog, { type PublishScope } from "@/components/admin/noteEditor/ReviewDialog";
import StaleNotice from "@/components/admin/noteEditor/StaleNotice";
import { contentOf } from "@/components/admin/noteEditor/content";
import TranslationPill from "@/components/admin/TranslationPill";
import { useFocusField } from "@/components/admin/content/focusField";
import { useTranslationReport, type TranslationStatus } from "@/services/translations";
import { useEditorWords } from "@/components/admin/noteEditor/words";
import styles from "@/components/admin/noteEditor/NoteEditor.module.css";
import NoteMarkdown, { PROSE } from "@/components/notes/reader/NoteMarkdown";
import { useContent } from "@/content/store";
import { Disclosure } from "@/components/ui/Disclosure";
import { usePhone } from "@/hooks/usePhone";
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

/** The review dialog's flow: closed, open (with the last publish error), or publishing. */
type Publish =
  | { kind: "idle" }
  | { kind: "reviewing"; error: string | null }
  | { kind: "publishing" };

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
    links: toLinkRows(c.links ?? [], c.he ?? {}),
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
  /* A link without a label or an address is dropped, and its Hebrew label with it. */
  const kept = f.links.filter((l) => l.label && l.url);
  const he = { title: f.heTitle, subtitle: f.heSubtitle, excerpt: f.heExcerpt, body: f.heBody, ...linkLabelsHe(kept) };
  return {
    title: f.title.trim(),
    subtitle: f.subtitle.trim() || null,
    excerpt: f.excerpt,
    body: f.body,
    tags: f.tags,
    collection: f.collection,
    coverImage: f.coverImage.trim() || null,
    links: kept.map(({ label, url }) => ({ label, url })),
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
      {/* The box is the target, not only the 21px input inside it; a chip's own button keeps its click. */}
      <div
        className={styles.tags}
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("button, input")) e.currentTarget.querySelector("input")?.focus();
        }}
      >
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
  /* Which body is edited (#305): one language, or both side by side. */
  const [bodyLang, setBodyLang] = useState<"en" | "he" | "both">("en");
  const [preview, setPreview] = useState(true);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [cols, setCols] = useState<AdminCollection[]>([]);
  const [all, setAll] = useState<AdminPost[]>([]);
  const [publishFlow, setPublishFlow] = useState<Publish>({ kind: "idle" });
  const loadedSlug = useRef<string | null>(null);
  const routeSlug = useRef(slug);
  routeSlug.current = slug;
  const flushOnLeave = useRef<(() => void) | null>(null);
  /* False once the editor has left the screen: a save that ends later must not navigate back to it. */
  const alive = useRef(true);
  const formRef = useRef<HTMLFormElement>(null);
  /* A save was refused for named fields: show them (open their section, say so, move focus on an explicit save). */
  const [reveal, setReveal] = useState<{ n: number; focus: boolean } | null>(null);

  const dirty = version !== savedVersion;
  /* Each field's Hebrew status as stored (#302), for the pills and the stale notices. */
  const { report: heReport } = useTranslationReport();
  const heItem = post ? heReport?.items.find((i) => i.type === "post" && i.id === post.slug) : undefined;
  const heStatus = (path: string): TranslationStatus | null => heItem?.units.find((u) => u.path === path)?.status ?? null;
  /* A Translations row's link (#302): `#field=body` opens the Hebrew body. */
  useFocusField(post, (_p, field) => {
    if (field === "body") setBodyLang("he");
    return field;
  });
  const phone = usePhone();
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
    /* Moving to another post inside the debounce: the edit belongs to the post being left. */
    flushOnLeave.current?.();
    let live = true;
    admin
      .get(slug!)
      .then((p) => {
        if (!live) return;
        adopt(p);
        /* The form now holds this post as stored; nothing of the last one is pending or failed. */
        setSavedVersion(versionRef.current);
        setSave({ kind: "idle" });
        setErrors({});
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!live) return;
        setLoading(false);
        setSave({ kind: "failed", message: e instanceof Error ? e.message : "?" });
      });
    return () => {
      live = false;
    };
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

  /* An edit by function of the field's text now (an upload that ends after typing went on). */
  const rewrite = useCallback((k: "body" | "heBody", fn: (cur: string) => string) => {
    setF((prev) => ({ ...prev, [k]: fn(prev[k]) }));
    setVersion((n) => n + 1);
    setSave((s) => (s.kind === "saving" || s.kind === "conflict" ? s : { kind: "dirty" }));
  }, []);

  /* ------------------------------------------------------------ saving */

  const versionRef = useRef(version);
  versionRef.current = version;

  const saveDraft = useCallback(async (explicit = true) => {
    if (!f.slug || !f.title.trim()) return;
    const at = versionRef.current;
    const startedOn = loadedSlug.current;
    const startedRoute = routeSlug.current;
    /* The editor left or moved to another post while the request was in flight: its answer is not for what is on screen. */
    const moved = () => !alive.current || routeSlug.current !== startedRoute || (startedOn !== null && loadedSlug.current !== startedOn);
    setSave({ kind: "saving" });
    try {
      const saved = await admin.saveDraft(f.slug, { ...content, _rev: post?._rev });
      if (moved()) return;
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
      if (moved()) return;
      if (e instanceof AdminValidationError) {
        setErrors(e.fieldErrors);
        setReveal((r) => ({ n: (r?.n ?? 0) + 1, focus: explicit }));
      }
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
    const t = window.setTimeout(() => void saveDraft(false), 1500);
    return () => window.clearTimeout(t);
  }, [dirty, stored, save.kind, version, saveDraft]);

  /* Back/Forward and in-app route changes unmount the editor inside the debounce
     window, which would drop the edit; send it on the way out. */
  flushOnLeave.current =
    dirty && (stored || Boolean(f.slug && f.title.trim())) && (save.kind === "idle" || save.kind === "dirty" || save.kind === "saved") ? () => void saveDraft(false) : null;
  useEffect(() => {
    alive.current = true;
    return () => {
      flushOnLeave.current?.();
      alive.current = false;
    };
  }, []);

  /* Show what the server refused: open the section that holds it, then (for a save
     the owner asked for, not an autosave they did not notice) put focus on it. */
  useEffect(() => {
    if (!reveal) return;
    const bad = [...(formRef.current?.querySelectorAll<HTMLElement>('[aria-invalid="true"]') ?? [])];
    for (const el of bad) {
      for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) d.open = true;
    }
    if (reveal.focus) bad[0]?.focus();
  }, [reveal]);

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

  async function publish(changeNote: string, scope: PublishScope = "both") {
    setPublishFlow({ kind: "publishing" });
    const at = versionRef.current;
    try {
      const p = await admin.publish(f.slug, { ...content, _rev: post?._rev, ...(changeNote ? { changeNote } : {}), ...(scope !== "both" ? { scope } : {}) });
      adopt(p);
      setSavedVersion(at);
      setSave({ kind: "saved", at: new Date() });
      setNotice({ text: w.published });
      setPublishFlow({ kind: "idle" });
      if (isNew) nav(`/admin/posts/${p.slug}`, { replace: true });
    } catch (e) {
      const message = e instanceof AdminValidationError ? describe(e.fieldErrors) : e instanceof Error ? e.message : "?";
      if (e instanceof AdminValidationError) setErrors(e.fieldErrors);
      setPublishFlow({ kind: "reviewing", error: message });
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

  /* One row: the status, a menu for Save draft and Discard, and Review. */
  const tone: BarTone = bad ? "bad" : save.kind === "saving" ? "busy" : save.kind === "saved" ? "ok" : "idle";
  const more: BarAction[] = [
    { key: "save", label: w.saveNow, onSelect: () => void saveDraft(), disabled: !canSave, shortcut: "Control+S" },
    ...(published && post?.draft && !dirty ? [{ key: "discard", label: w.discard, onSelect: () => void discard() }] : []),
  ];
  const bar = (
    <EditorBar
      tone={tone}
      status={[post ? w.status[post.status] : "", statusText].filter(Boolean).join(" · ")}
      more={more}
      primary={
        <button
          type="button"
          className="a-btn a-btn-primary"
          disabled={!canSave || !f.body.trim() || (published !== null && !hasDraft)}
          aria-haspopup="dialog"
          onClick={() => {
            setPublishFlow({ kind: "reviewing", error: null });
          }}
        >
          {w.review}
        </button>
      }
    />
  );

  const bodyValue = bodyLang === "he" ? f.heBody : f.body;
  const previewLang = bodyLang === "he" ? "he" : "en";
  const setBody = (v: string) => edit(bodyLang === "he" ? "heBody" : "body", v);

  const heTitleField = (
    <HebrewField id={`${ids.title}-he`} label={w.titleHebrew} status={heStatus("title")} hint={w.hebrewOptional}>
      <input id={`${ids.title}-he`} value={f.heTitle} maxLength={200} lang="he" dir="rtl" onChange={(e) => edit("heTitle", e.target.value)} className="a-input a-input-title" />
    </HebrewField>
  );

  return (
    <AdminShell title={heading} section="posts" backTo="/admin/posts" barEverywhere bottomBar={bar}>
      {loading ? (
        <p className="mono mt-4 text-sm text-clay">{w.loading}</p>
      ) : (
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) void saveDraft();
          }}
        >
          <PageHeader
            title={heading}
            meta={
              <>
                {post && <StatePill state={post.status} />}
                {hasDraft && <StatePill state="changes" />}
                {f.slug && (
                  <code dir="ltr" className="text-sm">
                    /blog/{f.slug}
                  </code>
                )}
              </>
            }
          />

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
            {published && !phone && (
              <button type="button" className="a-btn a-btn-ghost ms-3" onClick={() => void unpublish()}>{w.unpublish}</button>
            )}
          </p>
          {/* The bar shows this too, but only a few words of it on a phone. */}
          {save.kind === "failed" && <p className={styles.status} data-bad="true">{w.saveFailed(save.message)}</p>}
          {/* A refused field may sit in a section that was closed: say so, since focus alone is silent for an autosave. */}
          {reveal && save.kind === "failed" && Object.keys(errors).length > 0 && (
            <p role="alert" className="sr-only">{w.saveFailed(save.message)}</p>
          )}
          {notice && (
            <p className={styles.status} data-bad={notice.bad || undefined} role="status">{notice.text}</p>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-2" data-path="title">
            <label className="block min-w-0" htmlFor={ids.title}>
              <span className="a-label">{w.title}</span>
              <input
                id={ids.title}
                value={f.title}
                lang="en"
                dir="ltr"
                onChange={(e) => edit("title", e.target.value)}
                className="a-input a-input-title"
                placeholder={w.titlePlaceholder}
                aria-invalid={errors.title ? true : undefined}
              />
            </label>
            {!phone && heTitleField}
          </div>
          {/* The title and the body come first on a phone; the Hebrew title waits one tap away. */}
          {phone && <Disclosure summary={w.hebrewFields} className="mt-4">{heTitleField}</Disclosure>}
          {stored && (
            <StaleNotice
              statuses={{ title: heStatus("title"), subtitle: heStatus("subtitle"), excerpt: heStatus("excerpt"), body: heStatus("body") }}
              base={post?.heMeta?.bodyBase ?? null}
              english={f.body}
              words={w}
              disabled={dirty}
              slug={f.slug}
              rev={post?._rev ?? ""}
              onAcked={async () => adopt(await admin.get(f.slug))}
            />
          )}
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

          <div className={styles.box} data-path="body">
          <div className={styles.boxHead}>
            <span className="flex items-center gap-2">
              <label className="a-label mb-2 ms-1" htmlFor={ids.body}>{w.body}</label>
              {stored && <TranslationPill status={heStatus("body")} className="mb-2" />}
            </span>
            {phone ? (
              <select
                aria-label={w.editingIn}
                data-editing-language
                className="a-input min-h-[44px] w-auto"
                value={bodyLang}
                onChange={(e) => setBodyLang(e.target.value as "en" | "he" | "both")}
              >
                <option value="en">{w.bodyEnglish}</option>
                <option value="he">{w.bodyHebrew}</option>
                <option value="both">{w.bodyBoth}</option>
              </select>
            ) : (
            <div className="flex flex-wrap gap-2">
              <div role="group" aria-label={w.editingIn} className={styles.toggleGroup}>
                {(["en", "he", "both"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    className={`a-btn a-btn-ghost ${styles.toggle}`}
                    aria-pressed={bodyLang === l}
                    onClick={() => setBodyLang(l)}
                  >
                    {l === "en" ? w.bodyEnglish : l === "he" ? w.bodyHebrew : w.bodyBoth}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`a-btn a-btn-ghost ${styles.toggle}`}
                aria-pressed={preview && bodyLang !== "both"}
                disabled={bodyLang === "both"}
                aria-keyshortcuts="Control+Shift+P"
                onClick={() => setPreview((p) => !p)}
              >
                {w.preview}
              </button>
            </div>
            )}
          </div>
          {bodyLang === "both" ? (
            <div className={styles.split} data-side="true">
              <BodyEditor
                id={ids.body}
                value={f.body}
                onChange={(v) => edit("body", v)}
                onRewrite={(fn) => rewrite("body", fn)}
                lang="en"
                label={`${w.body}, ${w.bodyEnglish}`}
                targets={targets}
                words={w}
                describedBy={ids.bodyHelp}
                onStatus={(text, isBad) => setNotice({ text, bad: isBad })}
                onSave={() => canSave && void saveDraft()}
                onTogglePreview={() => setBodyLang("en")}
              />
              <BodyEditor
                id={`${ids.body}-he`}
                value={f.heBody}
                onChange={(v) => edit("heBody", v)}
                onRewrite={(fn) => rewrite("heBody", fn)}
                lang="he"
                label={`${w.body}, ${w.bodyHebrew}`}
                targets={targets}
                words={w}
                describedBy={ids.bodyHelp}
                onStatus={(text, isBad) => setNotice({ text, bad: isBad })}
                onSave={() => canSave && void saveDraft()}
                onTogglePreview={() => setBodyLang("he")}
              />
            </div>
          ) : (
          <div className={styles.split} data-side={preview && !phone}>
            <BodyEditor
              id={ids.body}
              value={bodyValue}
              onChange={setBody}
              onRewrite={(fn) => rewrite(bodyLang === "he" ? "heBody" : "body", fn)}
              lang={previewLang}
              targets={targets}
              words={w}
              describedBy={ids.bodyHelp}
              onStatus={(text, isBad) => setNotice({ text, bad: isBad })}
              onSave={() => canSave && void saveDraft()}
              onTogglePreview={() => setPreview((p) => !p)}
            />
            {preview && !phone && (
              <section aria-label={w.previewLabel} className={styles.preview} lang={previewLang} dir={previewLang === "he" ? "rtl" : "ltr"}>
                {bodyValue.trim() ? (
                  <NoteMarkdown body={bodyValue} pen={false} className={`${PROSE} !mt-0`} />
                ) : (
                  <p className="text-clay">{w.nothingYet}</p>
                )}
              </section>
            )}
          </div>
          )}
          <p id={ids.bodyHelp} className={styles.boxFoot}>{w.bodyHelp} {w.shortcuts}</p>
          </div>

          <Disclosure open={!phone || !stored} summary={w.details} meta={phone ? (cols.find((c) => c.slug === f.collection)?.title ?? f.collection) : undefined} className="mt-10">
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="a-label">{w.area}</span>
                <Select value={f.collection} onChange={(e) => edit("collection", e.target.value)}>
                  {(cols.length ? cols : [{ slug: "site", title: "Notes" } as AdminCollection]).map((c) => (
                    <option key={c.slug} value={c.slug}>{c.title}</option>
                  ))}
                </Select>
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
              <div className="grid gap-4 sm:col-span-2 md:grid-cols-2" data-path="subtitle">
                <label className="block min-w-0">
                  <span className="a-label">{w.subtitle}</span>
                  <input value={f.subtitle} lang="en" dir="ltr" onChange={(e) => edit("subtitle", e.target.value)} className="a-input" />
                </label>
                <HebrewField id={`${ids.title}-he-subtitle`} label={w.subtitleHebrew} status={stored ? heStatus("subtitle") : null}>
                  <input id={`${ids.title}-he-subtitle`} value={f.heSubtitle} maxLength={300} lang="he" dir="rtl" onChange={(e) => edit("heSubtitle", e.target.value)} className="a-input" />
                </HebrewField>
              </div>
              <div className="grid gap-4 sm:col-span-2 md:grid-cols-2" data-path="excerpt">
                <label className="block min-w-0">
                  <span className="a-label">{w.excerpt}</span>
                  <textarea value={f.excerpt} lang="en" dir="ltr" onChange={(e) => edit("excerpt", e.target.value)} maxLength={320} className="a-textarea min-h-[5rem]" />
                  <span className="a-hint">{w.excerptHelp(f.excerpt.length)}</span>
                </label>
                <HebrewField id={`${ids.title}-he-excerpt`} label={w.excerptHebrew} status={stored ? heStatus("excerpt") : null}>
                  <textarea id={`${ids.title}-he-excerpt`} value={f.heExcerpt} maxLength={320} lang="he" dir="rtl" onChange={(e) => edit("heExcerpt", e.target.value)} className="a-textarea min-h-[5rem]" />
                </HebrewField>
              </div>
            </div>
          </Disclosure>

          <Disclosure summary={w.seo} className="mt-6">
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
              <label className="flex min-h-[1.5rem] items-center gap-3 sm:col-span-2 [@media(pointer:coarse)]:min-h-[2.75rem]">
                <input type="checkbox" checked={f.noindex} onChange={(e) => edit("noindex", e.target.checked)} />
                <span className="text-sm text-bone">{w.noindex}</span>
              </label>
            </div>
          </Disclosure>

          <Disclosure summary={w.advanced} className="mt-6">
            <div className="mt-4">
              {phone && published && (
                <button type="button" className="a-btn mb-4 min-h-[44px]" onClick={() => void unpublish()}>{w.unpublish}</button>
              )}
              {stored && (
                <p className="text-sm text-bone">
                  <span className="a-label">{w.slug}</span>
                  <code dir="ltr" className="a-input-mono">{f.slug}</code>
                  <span className="a-hint">{w.slugLocked}</span>
                </p>
              )}
              <div className="mt-6">
                <LinkEditor links={f.links} onChange={(links) => edit("links", links)} hebrew />
              </div>
            </div>
          </Disclosure>

        </form>
      )}

      <ReviewDialog
        open={publishFlow.kind !== "idle"}
        onClose={() => setPublishFlow({ kind: "idle" })}
        published={published}
        next={content}
        words={w}
        busy={publishFlow.kind === "publishing"}
        error={publishFlow.kind === "reviewing" ? publishFlow.error : null}
        onPublish={(note, scope) => void publish(note, scope)}
      />
    </AdminShell>
  );
}

/* A field's Hebrew half (#305): RTL, labelled, with its status pill. */
function HebrewField({ id, label, status, hint, children }: { id: string; label: string; status: TranslationStatus | null; hint?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="flex items-center justify-between gap-2">
        <label className="a-label" htmlFor={id}>
          {label}
        </label>
        <TranslationPill status={status} />
      </span>
      {children}
      {hint && <span className="a-hint">{hint}</span>}
    </div>
  );
}
