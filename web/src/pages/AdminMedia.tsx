import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import { KindFilter, MediaGrid, Modal } from "@/components/admin/MediaGrid";
import MediaUpload from "@/components/admin/MediaUpload";
import MediaIcon from "@/components/media/MediaIcon";
import MediaVideo from "@/components/media/MediaVideo";
import styles from "@/components/admin/Media.module.css";
import {
  KIND_LABEL,
  LIMITS,
  MEDIA_KINDS,
  MediaInUseError,
  checkFile,
  filterMedia,
  formatBytes,
  formatDuration,
  media,
  type MediaItem,
  type MediaKind,
  type MediaUsage,
} from "@/services/media";

/*
 * The media library (#253): every picture, icon and short video the site can
 * use, uploaded and described here rather than committed to web/public and
 * shipped with a deploy.
 *
 * The open item is in the URL (`?id=`), so a link to one item works and Back
 * closes it; so are the search (`?q=`) and the kind shown (`?kind=`). Search
 * filters what is loaded; the library is tens of items, not thousands.
 */
export default function AdminMedia() {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const kindParam = params.get("kind");
  const kind = (MEDIA_KINDS as readonly string[]).includes(kindParam ?? "") ? (kindParam as MediaKind) : null;
  const openId = params.get("id");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    media
      .list()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  const setParam = (key: string, value: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (value) n.set(key, value);
        else n.delete(key);
        return n;
      },
      { replace: key !== "id" },
    );

  const shown = filterMedia(items ?? [], q, kind ? [kind] : null);
  const open = openId ? items?.find((m) => m.id === openId) ?? null : null;
  const noun = kind ? KIND_LABEL[kind].many.toLowerCase() : "items";

  const replaceItem = (next: MediaItem) =>
    setItems((list) => (list ?? []).map((m) => (m.id === next.id ? { ...next, usedBy: next.usedBy ?? m.usedBy } : m)));

  return (
    <AdminShell title="Media" section="media" counts={{ media: items?.length }}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display-tight text-[1.75rem] lg:text-[2.25rem]">Media</h1>
      </div>
      <p className="a-hint mt-3 max-w-prose">
        Pictures, icons and short videos for posts, areas and projects. Each is stored once and cleaned of
        camera, location and device data. Pictures are served in AVIF and WebP at the sizes a page asks for;
        icons as drawn; videos muted, with a poster, and never playing by themselves with motion off.
        Anything in use cannot be deleted.
      </p>

      <div className="mt-6">
        <MediaUpload
          kinds={kind ? [kind, ...MEDIA_KINDS.filter((k) => k !== kind)] : MEDIA_KINDS}
          onUploaded={(item) => {
            setItems((list) => [item, ...(list ?? [])]);
            setNotice(`Uploaded ${item.name}.`);
            setParam("id", item.id);
          }}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="block w-full max-w-md">
          <span className="a-label">Search</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setParam("q", e.target.value || null)}
            className="a-input"
            placeholder="Alt text, caption, credit, file name"
          />
        </label>
        <KindFilter kinds={MEDIA_KINDS} value={kind} onChange={(k) => setParam("kind", k)} />
      </div>

      <p className="sr-only" role="status">
        {notice || (items === null ? "Loading the library" : `${shown.length} of ${items.length} items`)}
      </p>

      {error && <p className="a-card mt-8 p-4 text-sm text-bone/70">{error}</p>}
      {!error && items === null && <p className="mono mt-8 text-xs text-clay">Loading…</p>}

      {items !== null && items.length === 0 && (
        <div className="a-card mt-8 p-8 text-center">
          <p className="display-tight text-2xl">Nothing here yet</p>
          <p className="a-hint mx-auto mt-3 max-w-sm">
            Upload a picture, an icon or a video above, or import the site&rsquo;s existing project pictures
            with<span className="mono"> backend/scripts/import-media.mjs</span>.
          </p>
        </div>
      )}
      {items !== null && items.length > 0 && shown.length === 0 && (
        <p className="a-hint mt-8">{q ? <>Nothing matches &ldquo;{q}&rdquo;.</> : `No ${noun} yet.`}</p>
      )}

      {shown.length > 0 && (
        <div className="mt-6">
          <MediaGrid
            items={shown}
            selected={openId}
            onSelect={(m) => setParam("id", m.id)}
            label={`${shown.length} ${kind ? noun : "pictures, icons and videos"}`}
          />
        </div>
      )}

      <Modal open={Boolean(open)} onClose={() => setParam("id", null)} title={open ? open.name : "Item"}>
        {open && (
          <MediaDetail
            key={`${open.id}:${open._rev}`}
            item={open}
            onSaved={(next, words) => {
              replaceItem(next);
              setNotice(words);
            }}
            onDeleted={(gone) => {
              setItems((list) => (list ?? []).filter((m) => m.id !== gone.id));
              setNotice(`Deleted ${gone.name}.`);
              setParam("id", null);
            }}
          />
        )}
      </Modal>
    </AdminShell>
  );
}

/* The content documents (#163) are one per editor: /admin/projects, /admin/story, /admin/site-copy. */
const CONTENT_EDITORS = new Set(["projects", "story", "site-copy"]);

const usageHref = (u: MediaUsage) => {
  if (!u.slug) return null;
  if (u.type === "post") return `/admin/posts/${u.slug}`;
  if (u.type === "collection") return `/admin/areas/${u.slug}`;
  if (u.type === "content" && CONTENT_EDITORS.has(u.slug)) return `/admin/${u.slug}`;
  return null;
};

function Preview({ item }: { item: MediaItem }) {
  if (item.kind === "video" && item.file) {
    return (
      <MediaVideo
        src={item.file}
        type={item.mime}
        poster={item.largest?.webp ?? item.preview ?? ""}
        label={item.alt}
        captions={item.captions ? { src: item.captions.url, lang: item.captions.lang, label: item.captions.label } : null}
        width={item.width}
        height={item.height}
        className={styles.detailImg}
      />
    );
  }
  if (item.kind === "icon" && item.file) {
    return (
      <div className={styles.iconStage}>
        <img src={item.file} alt={item.alt} width={96} height={96} className="object-contain" />
        {item.monochrome && (
          <p className="a-hint m-0 flex items-center gap-2">
            <MediaIcon src={item.file} monochrome size={24} className="text-sodium" />
            One colour: drawn in the text colour around it.
          </p>
        )}
      </div>
    );
  }
  return (
    <picture>
      <source type="image/avif" srcSet={item.srcset.avif} sizes="(min-width: 52rem) 34rem, 100vw" />
      <source type="image/webp" srcSet={item.srcset.webp} sizes="(min-width: 52rem) 34rem, 100vw" />
      <img src={item.preview ?? undefined} alt={item.alt} className={styles.detailImg} width={item.width} height={item.height} />
    </picture>
  );
}

function sizeLine(item: MediaItem) {
  const base = `${item.width} × ${item.height} · ${formatBytes(item.bytes)} · ${item.format.toUpperCase()}`;
  if (item.kind === "video") return `${base} · ${formatDuration(item.durationMs ?? 0)}${item.hasAudio ? " · has sound (plays muted)" : ""}`;
  return base;
}

function MediaDetail({
  item,
  onSaved,
  onDeleted,
}: {
  item: MediaItem;
  onSaved: (next: MediaItem, words: string) => void;
  onDeleted: (gone: MediaItem) => void;
}) {
  const [alt, setAlt] = useState(item.alt);
  const [caption, setCaption] = useState(item.caption);
  const [credit, setCredit] = useState(item.credit);
  const [busy, setBusy] = useState<"save" | "replace" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<MediaUsage[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [replacingVideo, setReplacingVideo] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const used = item.usedBy ?? [];
  const dirty = alt !== item.alt || caption !== item.caption || credit !== item.credit;
  const noun = KIND_LABEL[item.kind].one.toLowerCase();

  async function run(kind: "save" | "replace" | "delete", job: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await job();
    } catch (e) {
      if (e instanceof MediaInUseError) setBlockers(e.usedBy);
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.detail}>
      <div>
        <Preview item={item} />
        <dl className={`mt-4 ${styles.data}`}>
          <dt>Kind</dt>
          <dd>{KIND_LABEL[item.kind].one}</dd>
          <dt>Size</dt>
          <dd>{sizeLine(item)}</dd>
          <dt>Added</dt>
          <dd>{new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</dd>
          <dt>URL</dt>
          <dd className="mono text-[0.75rem]" dir="ltr" translate="no">{item.url}</dd>
          {item.captions && (
            <>
              <dt>Captions</dt>
              <dd>{item.captions.label} ({item.captions.lang})</dd>
            </>
          )}
        </dl>
        <button
          type="button"
          className="a-btn mt-3"
          onClick={() => {
            void navigator.clipboard?.writeText(item.url).then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy URL"}
        </button>
      </div>

      <div className="space-y-5">
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!alt.trim()) {
              setError("Alt text is required.");
              return;
            }
            void run("save", async () => {
              const next = await media.update(item, { alt: alt.trim(), caption: caption.trim(), credit: credit.trim() });
              onSaved(next, "Saved.");
            });
          }}
        >
          <label className="block">
            <span className="a-label">Alt text (required)</span>
            <textarea
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              className="a-textarea"
              rows={3}
              maxLength={300}
              required
              aria-invalid={!alt.trim() ? true : undefined}
            />
          </label>
          <label className="block">
            <span className="a-label">Caption</span>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} className="a-input" maxLength={500} />
          </label>
          <label className="block">
            <span className="a-label">Credit</span>
            <input value={credit} onChange={(e) => setCredit(e.target.value)} className="a-input" maxLength={200} />
          </label>
          <button type="submit" className="a-btn a-btn-primary" disabled={!dirty || busy !== null}>
            {busy === "save" ? "Saving" : "Save details"}
          </button>
        </form>

        <section aria-labelledby="media-used-by">
          <h3 id="media-used-by" className="a-label">Used by</h3>
          {used.length === 0 ? (
            <p className="a-hint mt-0">Nothing uses this {noun} yet.</p>
          ) : (
            <ul className="space-y-1 text-[0.875rem]">
              {used.map((u) => {
                const href = usageHref(u);
                return (
                  <li key={`${u.id}:${u.field}`}>
                    {href ? <Link to={href} className="underline underline-offset-4 hover:text-sodium">{u.title}</Link> : u.title}
                    <span className="mono text-[0.6875rem] text-clay"> · {u.type}{u.field ? ` · ${u.field}` : ""}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {replacingVideo && (
          <ReplaceVideo
            busy={busy === "replace"}
            onCancel={() => setReplacingVideo(false)}
            onSubmit={(video, poster, captions) =>
              void run("replace", async () => {
                const next = await media.replace(item, video, { poster, captions });
                setReplacingVideo(false);
                onSaved(next, `Replaced with ${video.name}.`);
              })
            }
            onProblem={setError}
          />
        )}

        <div className="flex flex-wrap gap-3 border-t border-edge pt-5">
          <input
            ref={file}
            type="file"
            accept={LIMITS[item.kind].accept}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const problem = checkFile(f, item.kind);
              if (problem) {
                setError(problem);
                return;
              }
              void run("replace", async () => {
                const next = await media.replace(item, f);
                onSaved(next, `Replaced with ${f.name}.`);
              });
            }}
          />
          <button
            type="button"
            className="a-btn"
            disabled={busy !== null || replacingVideo}
            onClick={() => (item.kind === "video" ? setReplacingVideo(true) : file.current?.click())}
          >
            {busy === "replace" ? "Replacing" : "Replace file"}
          </button>
          <button
            type="button"
            className={`a-btn a-btn-danger ${styles.delete}`}
            disabled={busy !== null || used.length > 0}
            aria-describedby="media-delete-hint"
            onClick={() => {
              if (!window.confirm(`Delete ${item.name}? This cannot be undone.`)) return;
              void run("delete", async () => {
                await media.remove(item);
                onDeleted(item);
              });
            }}
          >
            {busy === "delete" ? "Deleting" : "Delete"}
          </button>
          <p id="media-delete-hint" className="a-hint w-full">
            {used.length > 0
              ? `In use, so it cannot be deleted. Replace keeps every reference and swaps the ${noun}.`
              : `Replace keeps the same URL, so anything that later uses it follows the new ${noun}.`}
          </p>
        </div>

        {error && (
          <div role="alert">
            <p className="a-error">{error}</p>
            {blockers && blockers.length > 0 && (
              <ul className="a-hint">
                {blockers.map((b) => <li key={b.id}>{b.title} ({b.type})</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* A video is replaced whole, as it was uploaded: the video, its poster, and captions if any. */
function ReplaceVideo({
  busy,
  onCancel,
  onSubmit,
  onProblem,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (video: File, poster: File, captions: File | null) => void;
  onProblem: (message: string) => void;
}) {
  const [video, setVideo] = useState<File | null>(null);
  const [poster, setPoster] = useState<File | null>(null);
  const [captions, setCaptions] = useState<File | null>(null);
  const take = (f: File | null, kind: "video" | "poster" | "captions", set: (f: File | null) => void) => {
    const problem = f ? checkFile(f, kind) : null;
    if (problem) return onProblem(problem);
    set(f);
  };
  return (
    <form
      className="a-card space-y-4 p-4"
      aria-label="Replace the video"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!video || !poster) return onProblem("Choose the new video and its poster.");
        onSubmit(video, poster, captions);
      }}
    >
      <label className="block">
        <span className="a-label">New video</span>
        <input type="file" accept={LIMITS.video.accept} className="a-input" onChange={(e) => take(e.target.files?.[0] ?? null, "video", setVideo)} />
      </label>
      <label className="block">
        <span className="a-label">Its poster (required)</span>
        <input type="file" accept={LIMITS.poster.accept} className="a-input" onChange={(e) => take(e.target.files?.[0] ?? null, "poster", setPoster)} />
      </label>
      <label className="block">
        <span className="a-label">Captions (optional)</span>
        <input type="file" accept={LIMITS.captions.accept} className="a-input" onChange={(e) => take(e.target.files?.[0] ?? null, "captions", setCaptions)} />
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="a-btn a-btn-primary" disabled={busy}>
          {busy ? "Replacing" : "Replace"}
        </button>
        <button type="button" className="a-btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
