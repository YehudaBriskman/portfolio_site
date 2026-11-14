import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import {
  LIMITS,
  blobSrc,
  checkFile,
  formatBytes,
  media,
  type MediaItem,
  type MediaKind,
} from "@/services/media";
import { useMediaUploadWords } from "./mediaUploadWords";
import styles from "./Media.module.css";

/*
 * Upload one item: choose or drop a file, then say what it shows. Alt text
 * is required before the upload button does anything, because the library
 * refuses an item without it and a picture without it is no use on a page.
 *
 * The kind is read from the file (a video is a video) except where one file
 * could be two things: an SVG or a PNG may be a picture or an icon, so the
 * choice is offered and the picker's own kind is the default. A video also
 * asks for its poster, which is required — the server makes none, see
 * backend/src/services/mediaVideo.ts — and optionally a captions file.
 *
 * One file at a time on purpose. Each item needs its own words, and a batch
 * of ten with ten empty alt fields is ten items nobody describes.
 */

type Pending = { file: File; url: string; kind: MediaKind };

const ALL_ACCEPT = [LIMITS.image.accept, LIMITS.icon.accept, LIMITS.video.accept].join(",");

function kindOf(file: File, prefer: MediaKind): MediaKind {
  if (file.type.startsWith("video/")) return "video";
  if (prefer === "icon" && LIMITS.icon.accept.split(",").includes(file.type) && file.size <= LIMITS.icon.bytes) return "icon";
  return "image";
}

export default function MediaUpload({
  onUploaded,
  kinds = ["image", "icon", "video"],
}: {
  onUploaded: (item: MediaItem) => void;
  /** What this upload may make; the first is preferred for an SVG or PNG. */
  kinds?: readonly MediaKind[];
}) {
  const id = useId();
  const w = useMediaUploadWords();
  const input = useRef<HTMLInputElement>(null);
  const altRef = useRef<HTMLTextAreaElement>(null);
  const [over, setOver] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [credit, setCredit] = useState("");
  const [poster, setPoster] = useState<File | null>(null);
  const [captions, setCaptions] = useState<File | null>(null);
  const [captionsLang, setCaptionsLang] = useState("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [altMissing, setAltMissing] = useState(false);

  // The preview's object URL lives exactly as long as the pending file
  // (keyed on the URL: switching picture/icon makes a new object, not a new file).
  const pendingUrl = pending?.url ?? null;
  useEffect(() => {
    if (!pendingUrl) return;
    altRef.current?.focus();
    return () => URL.revokeObjectURL(pendingUrl);
  }, [pendingUrl]);

  const accept = kinds.map((k) => LIMITS[k].accept).join(",") || ALL_ACCEPT;
  const says = kinds.map((k) => w.kindsMany[k]).join(", ");

  function take(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const kind = kindOf(file, kinds[0] ?? "image");
    const problem = kinds.includes(kind) ? checkFile(file, kind) : w.notOneOf(file.name, says);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setAltMissing(false);
    setPending({ file, url: URL.createObjectURL(file), kind });
  }

  function reset() {
    setPending(null);
    setAlt("");
    setCaption("");
    setCredit("");
    setPoster(null);
    setCaptions(null);
    setAltMissing(false);
    if (input.current) input.current.value = "";
  }

  function pickSide(file: File | null, which: "poster" | "captions") {
    if (!file) return which === "poster" ? setPoster(null) : setCaptions(null);
    const problem = checkFile(file, which);
    if (problem) return setError(problem);
    setError(null);
    if (which === "poster") setPoster(file);
    else setCaptions(file);
  }

  async function upload() {
    if (!pending) return;
    if (!alt.trim()) {
      setAltMissing(true);
      altRef.current?.focus();
      return;
    }
    if (pending.kind === "video" && !poster) {
      setError(w.posterRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const item = await media.upload(
        pending.file,
        { alt: alt.trim(), caption: caption.trim(), credit: credit.trim() },
        pending.kind,
        pending.kind === "video" && poster ? { poster, captions, captionsLang, captionsLabel: undefined } : undefined,
      );
      reset();
      onUploaded(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : w.uploadFailed);
    } finally {
      setBusy(false);
    }
  }

  const onDrag = (e: DragEvent, on: boolean) => {
    e.preventDefault();
    setOver(on);
  };

  if (pending) {
    const switchable =
      pending.kind !== "video" &&
      kinds.includes("icon") &&
      kinds.includes("image") &&
      LIMITS.icon.accept.split(",").includes(pending.file.type) &&
      pending.file.size <= LIMITS.icon.bytes;
    return (
      <form
        className={`a-card p-4 ${styles.pending}`}
        aria-label={w.describe(pending.kind)}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void upload();
        }}
      >
        {pending.kind === "video" ? (
          <video src={blobSrc(pending.url)} className={styles.pendingThumb} muted playsInline preload="metadata" aria-hidden="true" />
        ) : (
          <img src={blobSrc(pending.url)} alt="" className={styles.pendingThumb} />
        )}
        <div className="space-y-4">
          <p className="mono text-sm text-clay">
            <span className="text-bone">{pending.file.name}</span> · {formatBytes(pending.file.size)}
          </p>
          {switchable && (
            <fieldset className={styles.kinds}>
              <legend className="a-label">{w.useAs}</legend>
              {(["image", "icon"] as const).map((k) => (
                <label key={k}>
                  <input
                    type="radio"
                    name={`${id}-kind`}
                    checked={pending.kind === k}
                    onChange={() => setPending({ ...pending, kind: k })}
                  />{" "}
                  {k === "image" ? w.asPicture : w.asIcon}
                </label>
              ))}
            </fieldset>
          )}
          <label className="block" htmlFor={`${id}-alt`}>
            <span className="a-label">{w.alt}</span>
            <textarea
              id={`${id}-alt`}
              ref={altRef}
              value={alt}
              onChange={(e) => {
                setAlt(e.target.value);
                if (e.target.value.trim()) setAltMissing(false);
              }}
              className="a-textarea"
              rows={2}
              maxLength={300}
              required
              aria-invalid={altMissing ? true : undefined}
              aria-describedby={`${id}-alt-hint`}
            />
            <span id={`${id}-alt-hint`} className={altMissing ? "a-error" : "a-hint"}>
              {altMissing ? w.altMissing(pending.kind) : w.altHint(pending.kind)}
            </span>
          </label>
          {pending.kind === "video" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="a-label">{w.poster}</span>
                <input
                  type="file"
                  accept={LIMITS.poster.accept}
                  className="a-input"
                  onChange={(e) => pickSide(e.target.files?.[0] ?? null, "poster")}
                />
                <span className="a-hint">{w.posterHint}</span>
              </label>
              <label className="block">
                <span className="a-label">{w.captions}</span>
                <input
                  type="file"
                  accept={LIMITS.captions.accept}
                  className="a-input"
                  onChange={(e) => pickSide(e.target.files?.[0] ?? null, "captions")}
                />
                <span className="a-hint">{w.captionsHint}</span>
              </label>
              {captions && (
                <label className="block">
                  <span className="a-label">{w.captionsLang}</span>
                  <input
                    value={captionsLang}
                    onChange={(e) => setCaptionsLang(e.target.value.trim())}
                    className="a-input"
                    maxLength={20}
                    pattern="[a-z]{2,3}(-[A-Za-z0-9]{2,8})*"
                  />
                </label>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="a-label">{w.caption}</span>
              <input value={caption} onChange={(e) => setCaption(e.target.value)} className="a-input" maxLength={500} />
            </label>
            <label className="block">
              <span className="a-label">{w.credit}</span>
              <input value={credit} onChange={(e) => setCredit(e.target.value)} className="a-input" maxLength={200} />
            </label>
          </div>
          <p className="a-hint">
            {w.note[pending.kind]}
          </p>
          {error && <p className="a-error" role="alert">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="a-btn a-btn-primary" disabled={busy}>
              {busy ? w.uploading : w.upload}
            </button>
            <button type="button" className="a-btn" onClick={reset} disabled={busy}>
              {w.cancel}
            </button>
          </div>
        </div>
      </form>
    );
  }

  const choose = kinds.length === 1 ? w.choose[kinds[0]] : w.choose.file;
  return (
    <div
      className={styles.drop}
      data-over={over}
      onDragOver={(e) => onDrag(e, true)}
      onDragEnter={(e) => onDrag(e, true)}
      onDragLeave={(e) => onDrag(e, false)}
      onDrop={(e) => {
        onDrag(e, false);
        take(e.dataTransfer.files);
      }}
    >
      {/* Out of the tab order: the button is the control, so focus is visible on it. */}
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => take(e.target.files)}
      />
      <button type="button" className="a-btn a-btn-primary" onClick={() => input.current?.click()}>
        {choose}
      </button>
      <p className="text-sm leading-normal text-bone/80">
        {w.drop}
        {kinds.includes("image") && ` ${w.limits.image}`}
        {kinds.includes("icon") && ` ${w.limits.icon}`}
        {kinds.includes("video") && ` ${w.limits.video}`}
      </p>
      {error && <p className="a-error w-full" role="alert">{error}</p>}
    </div>
  );
}
