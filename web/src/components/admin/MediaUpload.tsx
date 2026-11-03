import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import {
  KIND_LABEL,
  LIMITS,
  blobSrc,
  checkFile,
  formatBytes,
  media,
  type MediaItem,
  type MediaKind,
} from "@/services/media";
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
  const says = kinds.map((k) => KIND_LABEL[k].many.toLowerCase()).join(", ");

  function take(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const kind = kindOf(file, kinds[0] ?? "image");
    const problem = kinds.includes(kind) ? checkFile(file, kind) : `${file.name} is not one of: ${says}.`;
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
      setError("Choose a poster image: it is what shows before the video plays, and instead of it with motion off.");
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
      setError(e instanceof Error ? e.message : "Upload failed");
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
    const noun = KIND_LABEL[pending.kind].one.toLowerCase();
    return (
      <form
        className={`a-card p-4 ${styles.pending}`}
        aria-label={`Describe the new ${noun}`}
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
          <p className="mono text-[0.75rem] text-clay">
            <span className="text-bone">{pending.file.name}</span> · {formatBytes(pending.file.size)}
          </p>
          {switchable && (
            <fieldset className={styles.kinds}>
              <legend className="a-label">Use it as</legend>
              {(["image", "icon"] as const).map((k) => (
                <label key={k}>
                  <input
                    type="radio"
                    name={`${id}-kind`}
                    checked={pending.kind === k}
                    onChange={() => setPending({ ...pending, kind: k })}
                  />{" "}
                  {k === "image" ? "A picture (resized to AVIF and WebP)" : "An icon (kept as drawn)"}
                </label>
              ))}
            </fieldset>
          )}
          <label className="block" htmlFor={`${id}-alt`}>
            <span className="a-label">Alt text (required)</span>
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
              {altMissing
                ? `Say what the ${noun} shows before uploading.`
                : `What the ${noun} shows, for someone who cannot see it.`}
            </span>
          </label>
          {pending.kind === "video" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="a-label">Poster image (required)</span>
                <input
                  type="file"
                  accept={LIMITS.poster.accept}
                  className="a-input"
                  onChange={(e) => pickSide(e.target.files?.[0] ?? null, "poster")}
                />
                <span className="a-hint">A still from the video. JPEG, PNG, WebP or AVIF, up to 5 MB.</span>
              </label>
              <label className="block">
                <span className="a-label">Captions (optional)</span>
                <input
                  type="file"
                  accept={LIMITS.captions.accept}
                  className="a-input"
                  onChange={(e) => pickSide(e.target.files?.[0] ?? null, "captions")}
                />
                <span className="a-hint">A WebVTT (.vtt) file.</span>
              </label>
              {captions && (
                <label className="block">
                  <span className="a-label">Captions language</span>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="a-label">Caption</span>
              <input value={caption} onChange={(e) => setCaption(e.target.value)} className="a-input" maxLength={500} />
            </label>
            <label className="block">
              <span className="a-label">Credit</span>
              <input value={credit} onChange={(e) => setCredit(e.target.value)} className="a-input" maxLength={200} />
            </label>
          </div>
          <p className="a-hint">
            {pending.kind === "video"
              ? "Location, device and date tags are removed on upload. It plays muted, and never by itself with motion off."
              : pending.kind === "icon"
                ? "Kept as drawn. An SVG with scripts, events or outside links is refused; a one-colour one takes the text colour."
                : "Location and camera data are removed on upload. AVIF and WebP sizes are made from it."}
          </p>
          {error && <p className="a-error" role="alert">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="a-btn a-btn-primary" disabled={busy}>
              {busy ? "Uploading" : "Upload"}
            </button>
            <button type="button" className="a-btn" onClick={reset} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  const choose = kinds.length === 1 ? `Choose ${kinds[0] === "icon" ? "an icon" : kinds[0] === "video" ? "a video" : "a picture"}` : "Choose a file";
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
      <p className="text-[0.8125rem] leading-normal text-bone/80">
        or drop one here.
        {kinds.includes("image") && " Pictures: JPEG, PNG, WebP, AVIF or plain SVG, up to 10 MB."}
        {kinds.includes("icon") && " Icons: SVG or PNG, up to 64 KB."}
        {kinds.includes("video") && " Videos: MP4 or WebM, up to 25 MB and a minute, with a poster."}
      </p>
      {error && <p className="a-error w-full" role="alert">{error}</p>}
    </div>
  );
}
