import Select from "@/components/ui/Select";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Disclosure } from "@/components/ui/Disclosure";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { INTL, useLang } from "@/components/dashboard/i18n";
import { usePhone } from "@/hooks/usePhone";
import MediaPhone from "@/components/admin/MediaPhone";
import { useMediaPhoneWords } from "@/components/admin/mediaPhoneWords";
import AdminShell from "@/components/admin/AdminShell";
import { PageHeader } from "@/components/admin/ui";
import { KindFilter, MediaGrid, Modal } from "@/components/admin/MediaGrid";
import MediaUpload from "@/components/admin/MediaUpload";
import MediaIcon from "@/components/media/MediaIcon";
import MediaVideo from "@/components/media/MediaVideo";
import TranslationPill from "@/components/admin/TranslationPill";
import { useFocusField } from "@/components/admin/content/focusField";
import { useTranslationReport, type TranslationStatus } from "@/services/translations";
import { ltrValue } from "@/i18n/words";
import styles from "@/components/admin/Media.module.css";
import phoneStyles from "@/components/admin/Media.phone.module.css";
import {
  KIND_LABEL,
  LIMITS,
  MEDIA_KINDS,
  MediaInUseError,
  TRACK_LANGS,
  checkFile,
  filterMedia,
  formatBytes,
  formatDuration,
  librarySrc,
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
 *
 * Below 600px the grid is square tiles and the item is a bottom sheet (#681).
 * A sheet keeps its own history entry, so there the open item is state: a
 * link with `?id=` opens it once and the address is cleaned.
 */
export default function AdminMedia() {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const kindParam = params.get("kind");
  const kind = (MEDIA_KINDS as readonly string[]).includes(kindParam ?? "") ? (kindParam as MediaKind) : null;
  const phone = usePhone();
  const p = useMediaPhoneWords();
  const [sheetId, setSheetId] = useState<string | null>(null);
  const openId = phone ? sheetId : params.get("id");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    media
      .list()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  /* A phone's sheet is state, not an address: take a link's `?id=` into it once and clean the address. */
  const linked = params.get("id");
  const [taken, setTaken] = useState<string | null>(null);
  if (taken !== (phone ? linked : null)) {
    setTaken(phone ? linked : null);
    if (phone && linked) setSheetId(linked);
  }
  useEffect(() => {
    if (!phone || !linked) return;
    setParams((cur) => {
      const n = new URLSearchParams(cur);
      n.delete("id");
      return n;
    }, { replace: true });
  }, [phone, linked, setParams]);

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

  const openItem = (id: string | null) => (phone ? setSheetId(id) : setParam("id", id));

  const replaceItem = (next: MediaItem) =>
    setItems((list) => (list ?? []).map((m) => (m.id === next.id ? { ...next, usedBy: next.usedBy ?? m.usedBy } : m)));

  return (
    <AdminShell title={phone ? p.title : "Media"} section="media" counts={{ media: items?.length }}>
      {phone ? (
        <div className="a-page-head !mb-3 !flex-nowrap !items-center !justify-between !pb-2">
          <h1 className="a-h1 min-w-0">{p.title}</h1>
          <InfoPopover label={p.aboutLabel} text={p.explainer} />
        </div>
      ) : (
        <PageHeader
          title="Media"
          description={
            <>
              Pictures, icons and short videos for posts, areas and projects. Each is stored once and cleaned of
              camera, location and device data. Pictures are served in AVIF and WebP at the sizes a page asks for;
              icons as drawn; videos muted, with a poster, and never playing by themselves with motion off.
              Anything in use cannot be deleted.
            </>
          }
        />
      )}

      <div className={phone ? "mt-4" : "mt-6"}>
        <MediaUpload
          kinds={kind ? [kind, ...MEDIA_KINDS.filter((k) => k !== kind)] : MEDIA_KINDS}
          onUploaded={(item) => {
            setItems((list) => [item, ...(list ?? [])]);
            setNotice(phone ? p.uploaded(item.name) : `Uploaded ${item.name}.`);
            openItem(item.id);
          }}
        />
      </div>

      {!phone && (
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
      )}

      <p className="sr-only" role="status">
        {notice || (items === null ? (phone ? p.loading : "Loading the library") : phone ? p.count(shown.length, items.length) : `${shown.length} of ${items.length} items`)}
      </p>

      {error && <p className={`a-card p-4 text-sm text-bone/70 ${phone ? "mt-4" : "mt-8"}`}>{error}</p>}
      {!error && items === null && <p className={`mono text-sm text-clay ${phone ? "mt-4" : "mt-8"}`}>{phone ? p.loading : "Loading…"}</p>}

      {items !== null && items.length === 0 && (
        <div className={`a-card p-8 text-center ${phone ? "mt-4" : "mt-8"}`}>
          <p className="display-tight text-2xl">{phone ? p.empty : "Nothing here yet"}</p>
          <p className="a-hint mx-auto mt-3 max-w-sm">
            {phone ? p.emptyHint : (
              <>
                Upload a picture, an icon or a video above, or import the site&rsquo;s existing project pictures
                with<span className="mono"> backend/scripts/import-media.mjs</span>.
              </>
            )}
          </p>
        </div>
      )}

      {phone ? (
        items !== null && items.length > 0 && (
          <div className="mt-4">
            <MediaPhone
              items={items}
              q={q}
              onQ={(v) => setParam("q", v || null)}
              onOpen={(id) => setSheetId(id)}
              onDeleted={(gone) => {
                const ids = new Set(gone.map((m) => m.id));
                setItems((list) => (list ?? []).filter((m) => !ids.has(m.id)));
              }}
            />
          </div>
        )
      ) : (
        <>
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
        </>
      )}

      {phone ? (
        <BottomSheet open={Boolean(open)} onClose={() => setSheetId(null)} title={open ? open.name : p.title}>
          {open && (
            <MediaDetail
              key={`${open.id}:${open._rev}`}
              item={open}
              phone
              onSaved={(next, words) => {
                replaceItem(next);
                setNotice(words);
              }}
              onDeleted={(gone) => {
                setItems((list) => (list ?? []).filter((m) => m.id !== gone.id));
                setNotice(p.deleted(gone.name));
                setSheetId(null);
              }}
            />
          )}
        </BottomSheet>
      ) : (
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
      )}
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

type Words = ReturnType<typeof useMediaPhoneWords>;

function Preview({ item, t }: { item: MediaItem; t: Words }) {
  /* A picture that will not load is a note, not a broken-image glyph in a box sized for the real one: that box left a blank gap above the alt field. */
  const [failed, setFailed] = useState<string | null>(null);
  const file = librarySrc(item.file);
  const preview = librarySrc(item.preview);
  const captions = librarySrc(item.captions?.url);
  const tracks = (item.tracks ?? []).flatMap((t) => {
    const src = librarySrc(t.url);
    return src ? [{ src, lang: t.lang, label: t.label }] : [];
  });
  if (item.kind === "video" && file) {
    return (
      <MediaVideo
        src={file}
        type={item.mime}
        poster={librarySrc(item.largest?.webp) ?? preview ?? ""}
        label={item.alt}
        captions={item.captions && captions ? { src: captions, lang: item.captions.lang, label: item.captions.label } : null}
        tracks={tracks}
        width={item.width}
        height={item.height}
        className={styles.detailImg}
      />
    );
  }
  if (item.kind === "icon" && file) {
    return (
      <div className={styles.iconStage}>
        <img src={file} alt={item.alt} width={96} height={96} className="object-contain" />
        {item.monochrome && (
          <p className="a-hint m-0 flex items-center gap-2">
            <MediaIcon src={file} monochrome size={24} className="text-sodium" />
            {t.oneColour}
          </p>
        )}
      </div>
    );
  }
  if (failed !== null && failed === preview) {
    return (
      <p className="a-hint m-0" role="status">
        {t.previewMissing}
      </p>
    );
  }
  return (
    <picture>
      <source type="image/avif" srcSet={item.srcset.avif} sizes="(min-width: 52rem) 34rem, 100vw" />
      <source type="image/webp" srcSet={item.srcset.webp} sizes="(min-width: 52rem) 34rem, 100vw" />
      <img src={preview} alt={item.alt} className={styles.detailImg} width={item.width} height={item.height} onError={() => setFailed(preview ?? "")} />
    </picture>
  );
}

function sizeLine(item: MediaItem, t: Words) {
  const base = `${ltrValue(`${item.width} × ${item.height}`)} · ${formatBytes(item.bytes)} · ${item.format.toUpperCase()}`;
  if (item.kind === "video") return `${base} · ${formatDuration(item.durationMs ?? 0)}${item.hasAudio ? ` · ${t.sound}` : ""}`;
  return base;
}

/*
 * One item. The same state and handlers draw two layouts. At >= 600px: the
 * preview and the facts beside the forms, as before. On a phone, in a sheet:
 * the preview, then the ONE decision (alt text, English and Hebrew), then where
 * the item is used, then the rest. The facts (kind, size, added, URL) are a
 * closed Details; caption and credit sit in their own closed disclosure.
 * Without `phone` every word is the English the desktop always had.
 */
function MediaDetail({
  item,
  phone = false,
  onSaved,
  onDeleted,
}: {
  item: MediaItem;
  phone?: boolean;
  onSaved: (next: MediaItem, words: string) => void;
  onDeleted: (gone: MediaItem) => void;
}) {
  const live = useMediaPhoneWords();
  const t = phone ? live : useMediaPhoneWords.of("en");
  const lang = useLang();
  const [alt, setAlt] = useState(item.alt);
  const [caption, setCaption] = useState(item.caption);
  const [credit, setCredit] = useState(item.credit);
  /* The Hebrew beside each (#306): what a Hebrew page's reader hears and reads. */
  const [heAlt, setHeAlt] = useState(item.he?.alt ?? "");
  const [heCaption, setHeCaption] = useState(item.he?.caption ?? "");
  const { report } = useTranslationReport();
  const heUnits = report?.items.find((i) => i.type === "media" && i.id === item.id)?.units;
  const heStatus = (path: string): TranslationStatus | null => heUnits?.find((u) => u.path === path)?.status ?? null;
  /* A Translations row's link lands on the field's Hebrew (#302). */
  useFocusField(item);
  const [busy, setBusy] = useState<"save" | "replace" | "delete" | "captions" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<MediaUsage[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [replacingVideo, setReplacingVideo] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const used = item.usedBy ?? [];
  const dirty =
    alt !== item.alt || caption !== item.caption || credit !== item.credit || heAlt !== (item.he?.alt ?? "") || heCaption !== (item.he?.caption ?? "");
  const kindWord = t.kindOne[item.kind];
  const noun = kindWord.toLowerCase();
  const trackLabel = (code: string) => TRACK_LANGS.find((x) => x.lang === code)?.label ?? code;

  async function run(kind: "save" | "replace" | "delete" | "captions", job: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await job();
    } catch (e) {
      if (e instanceof MediaInUseError) setBlockers(e.usedBy);
      setError(e instanceof Error ? e.message : t.wentWrong);
    } finally {
      setBusy(null);
    }
  }

  const added = phone
    ? new Intl.DateTimeFormat(INTL[lang], { day: "numeric", month: "short", year: "numeric" }).format(new Date(item.createdAt))
    : new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const facts = (
    <>
      <dl className={phone ? phoneStyles.data : `mt-4 ${styles.data}`}>
        <dt>{t.kind}</dt>
        <dd>{kindWord}</dd>
        <dt>{t.size}</dt>
        <dd>{sizeLine(item, t)}</dd>
        <dt>{t.added}</dt>
        <dd>{added}</dd>
        <dt>{t.url}</dt>
        <dd className="mono text-sm" dir="ltr" translate="no">{item.url}</dd>
      </dl>
      <button
        type="button"
        className="a-btn mt-3"
        onClick={() => {
          void navigator.clipboard?.writeText(item.url).then(() => setCopied(true));
        }}
      >
        {copied ? t.copied : t.copyUrl}
      </button>
    </>
  );

  const altFields = (
    <div className="grid gap-4 sm:grid-cols-2" data-path="alt">
      <label className="block min-w-0">
        <span className="a-label">{t.altLabel}</span>
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
      <HebrewHalf label={t.altHe} status={heStatus("alt")}>
        <textarea value={heAlt} onChange={(e) => setHeAlt(e.target.value)} className="a-textarea" rows={3} maxLength={300} lang="he" dir="rtl" />
      </HebrewHalf>
    </div>
  );
  const captionFields = (
    <>
      <div className="grid gap-4 sm:grid-cols-2" data-path="caption">
        <label className="block min-w-0">
          <span className="a-label">{t.caption}</span>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} className="a-input" maxLength={500} />
        </label>
        <HebrewHalf label={t.captionHe} status={caption.trim() ? heStatus("caption") : null}>
          <input value={heCaption} onChange={(e) => setHeCaption(e.target.value)} className="a-input" maxLength={500} lang="he" dir="rtl" />
        </HebrewHalf>
      </div>
      <p className="a-hint mt-0">{t.hebrewHint}</p>
      <label className="block">
        <span className="a-label">{t.credit}</span>
        <input value={credit} onChange={(e) => setCredit(e.target.value)} className="a-input" maxLength={200} />
      </label>
    </>
  );
  const form = (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!alt.trim()) {
          setError(t.altRequired);
          return;
        }
        void run("save", async () => {
          const he = heAlt.trim() || heCaption.trim() ? { alt: heAlt.trim(), caption: heCaption.trim() } : null;
          const next = await media.update(item, { alt: alt.trim(), caption: caption.trim(), credit: credit.trim(), he });
          onSaved(next, t.saved);
        });
      }}
    >
      {altFields}
      {phone ? (
        <Disclosure summary={t.captionAndCredit}>
          <div className="space-y-4">{captionFields}</div>
        </Disclosure>
      ) : (
        captionFields
      )}
      <button type="submit" className="a-btn a-btn-primary" disabled={!dirty || busy !== null}>
        {busy === "save" ? t.saving : t.save}
      </button>
    </form>
  );

  const usedBy = (
    <section aria-labelledby="media-used-by">
      <h3 id="media-used-by" className="a-label">{phone ? t.usedHeading : "Used by"}</h3>
      {used.length === 0 ? (
        <p className="a-hint mt-0">{t.nothingUses[item.kind]}</p>
      ) : (
        <ul className="space-y-1 text-[0.875rem]">
          {used.map((u) => {
            const href = usageHref(u);
            return (
              <li key={`${u.id}:${u.field}`}>
                {href ? <Link to={href} className="underline underline-offset-4 hover:text-sodium">{u.title}</Link> : u.title}
                <span className="mono text-sm text-clay"> · {u.type}{u.field ? ` · ${u.field}` : ""}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const captions = item.kind === "video" && (
    <CaptionTracks
      item={item}
      w={t}
      busy={busy === "captions"}
      disabled={busy !== null}
      onPut={(code, f) =>
        void run("captions", async () => {
          const next = await media.putCaptions(item, code, f);
          onSaved(next, t.captionsSaved(trackLabel(code)));
        })
      }
      onRemove={(code) =>
        void run("captions", async () => {
          const next = await media.removeCaptions(item, code);
          onSaved(next, t.captionsRemoved);
        })
      }
      onProblem={setError}
    />
  );

  const replaceVideo = replacingVideo && (
    <ReplaceVideo
      t={t}
      busy={busy === "replace"}
      onCancel={() => setReplacingVideo(false)}
      onSubmit={(video, poster, captionsFile) =>
        void run("replace", async () => {
          const next = await media.replace(item, video, { poster, captions: captionsFile });
          setReplacingVideo(false);
          onSaved(next, t.replacedWith(video.name));
        })
      }
      onProblem={setError}
    />
  );

  const actions = (
    <div className={phone ? phoneStyles.actions : "flex flex-wrap gap-3 border-t border-edge pt-5"}>
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
            onSaved(next, t.replacedWith(f.name));
          });
        }}
      />
      <button
        type="button"
        className="a-btn"
        disabled={busy !== null || replacingVideo}
        onClick={() => (item.kind === "video" ? setReplacingVideo(true) : file.current?.click())}
      >
        {busy === "replace" ? t.replacing : t.replace}
      </button>
      <button
        type="button"
        className={`a-btn a-btn-danger ${styles.delete}`}
        disabled={busy !== null || used.length > 0}
        aria-describedby="media-delete-hint"
        onClick={() => {
          if (!window.confirm(t.deleteConfirm(item.name))) return;
          void run("delete", async () => {
            await media.remove(item);
            onDeleted(item);
          });
        }}
      >
        {busy === "delete" ? t.deletingOne : t.delete}
      </button>
      <p id="media-delete-hint" className="a-hint w-full">
        {used.length > 0 ? t.inUse(noun) : t.notInUse(noun)}
      </p>
    </div>
  );

  const problem = error && (
    <div role="alert">
      <p className="a-error">{error}</p>
      {blockers && blockers.length > 0 && (
        <ul className="a-hint">
          {blockers.map((b) => <li key={b.id}>{b.title} ({b.type})</li>)}
        </ul>
      )}
    </div>
  );

  if (phone) {
    return (
      <div className={phoneStyles.detail}>
        <div className={phoneStyles.preview}>
          <Preview item={item} t={t} />
        </div>
        {form}
        {problem}
        {usedBy}
        <Disclosure summary={t.details} meta={t.detailsMeta(kindWord, formatBytes(item.bytes))}>
          {facts}
        </Disclosure>
        {captions}
        {replaceVideo}
        {actions}
      </div>
    );
  }

  return (
    <div className={styles.detail}>
      <div>
        <Preview item={item} t={t} />
        {facts}
      </div>

      <div className="space-y-5">
        {form}
        {usedBy}
        {captions}
        {replaceVideo}
        {actions}
        {problem}
      </div>
    </div>
  );
}

/* A video is replaced whole, as it was uploaded: the video, its poster, and captions if any. */
function ReplaceVideo({
  t,
  busy,
  onCancel,
  onSubmit,
  onProblem,
}: {
  t: Words;
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
      aria-label={t.replaceVideoLabel}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!video || !poster) return onProblem(t.chooseVideoAndPoster);
        onSubmit(video, poster, captions);
      }}
    >
      <label className="block">
        <span className="a-label">{t.newVideo}</span>
        <input type="file" accept={LIMITS.video.accept} className="a-input" onChange={(e) => take(e.target.files?.[0] ?? null, "video", setVideo)} />
      </label>
      <label className="block">
        <span className="a-label">{t.poster}</span>
        <input type="file" accept={LIMITS.poster.accept} className="a-input" onChange={(e) => take(e.target.files?.[0] ?? null, "poster", setPoster)} />
      </label>
      <label className="block">
        <span className="a-label">{t.captionsOptional}</span>
        <input type="file" accept={LIMITS.captions.accept} className="a-input" onChange={(e) => take(e.target.files?.[0] ?? null, "captions", setCaptions)} />
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="a-btn a-btn-primary" disabled={busy}>
          {busy ? t.replacing : t.replaceNow}
        </button>
        <button type="button" className="a-btn" onClick={onCancel} disabled={busy}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}

/* A field's Hebrew half (#306): labelled, right to left, with its status. */
function HebrewHalf({ label, status, children }: { label: string; status: TranslationStatus | null; children: React.ReactElement }) {
  return (
    <label className="block min-w-0">
      <span className="flex items-center justify-between gap-2">
        <span className="a-label">{label}</span>
        <TranslationPill status={status} />
      </span>
      {children}
    </label>
  );
}

/*
 * A video's captions, one track per language (#306). The page shows the
 * track in its own language by default, and the first one otherwise.
 */
function CaptionTracks({
  item,
  w,
  busy,
  disabled,
  onPut,
  onRemove,
  onProblem,
}: {
  item: MediaItem;
  w: Words;
  busy: boolean;
  disabled: boolean;
  onPut: (lang: string, file: File) => void;
  onRemove: (lang: string) => void;
  onProblem: (message: string) => void;
}) {
  const tracks = item.tracks ?? (item.captions ? [item.captions] : []);
  const picker = useRef<HTMLInputElement>(null);
  const [lang, setLang] = useState<string>(() => TRACK_LANGS.find((t) => !tracks.some((x) => x.lang === t.lang))?.lang ?? "he");
  const has = tracks.some((t) => t.lang === lang);
  return (
    <section aria-labelledby="media-captions">
      <h3 id="media-captions" className="a-label">{w.captionsHeading}</h3>
      {tracks.length === 0 ? (
        <p className="a-hint mt-0">{w.noCaptions}</p>
      ) : (
        <ul className="space-y-2 text-[0.875rem]">
          {tracks.map((t) => (
            <li key={t.lang} className="flex flex-wrap items-center justify-between gap-2">
              <span lang={t.lang} dir={t.lang === "he" ? "rtl" : "ltr"}>
                {t.label}
              </span>
              <button type="button" className="a-btn a-btn-ghost" disabled={disabled} onClick={() => onRemove(t.lang)}>
                {w.remove}{" "}<span className="sr-only">{w.removeCaptions(TRACK_LANGS.find((x) => x.lang === t.lang)?.label ?? t.lang)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="a-label m-0">{w.language}</span>
          <Select value={lang} onChange={(e) => setLang(e.target.value)}>
            {TRACK_LANGS.map((t) => (
              <option key={t.lang} value={t.lang}>
                {t.label}
              </option>
            ))}
          </Select>
        </label>
        <input
          ref={picker}
          type="file"
          accept={LIMITS.captions.accept}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const problem = checkFile(f, "captions");
            if (problem) return onProblem(problem);
            onPut(lang, f);
          }}
        />
        <button type="button" className="a-btn" disabled={disabled} onClick={() => picker.current?.click()}>
          {busy ? w.uploading : has ? w.replaceCaptions : w.addCaptions}
        </button>
      </div>
    </section>
  );
}
