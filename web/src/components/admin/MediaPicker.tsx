import { useState } from "react";
import { MEDIA_KINDS, filterMedia, media, mediaIdOf, type MediaItem, type MediaKind } from "@/services/media";
import { KindFilter, MediaGrid, Modal } from "./MediaGrid";
import MediaUpload from "./MediaUpload";
import { ErrorState } from "./ui";
import { useMediaUploadWords } from "./mediaUploadWords";
import styles from "./Media.module.css";

/*
 * Choose an item from the media library (#253), for any editor field that
 * holds a media URL: the post editor's cover, an area's cover and its icon,
 * and whatever #163 moves into the store next.
 *
 * `kinds` narrows what may be chosen: a cover takes a picture, an area's
 * icon takes an icon. With more than one kind the picker shows a filter.
 *
 * It hands back the item's stable URL (`https://<site>/api/images/media/<id>`),
 * never a hashed file: a stable URL keeps working when the item is replaced,
 * and it is what the library's usage index looks for, so the item shows as
 * "used by" this document and cannot be deleted from under it.
 *
 * The field stays a plain URL input beside it, so an external image still
 * works; the picker only fills it.
 */
export default function MediaPicker({
  value,
  onChange,
  label,
  kinds = ["image"],
  onPickItem,
  showCurrent = true,
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  kinds?: readonly MediaKind[];
  /* The whole item, for a caller that needs more than the URL: the note
     editor (#250) writes the alt text into the markdown it inserts. */
  onPickItem?: (item: MediaItem) => void;
  /* Off where the picker inserts rather than fills a field. */
  showCurrent?: boolean;
}) {
  const lib = useMediaUploadWords().lib;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<MediaKind | null>(null);
  const current = mediaIdOf(value);
  const allowed = MEDIA_KINDS.filter((k) => kinds.includes(k));
  const noun = allowed.length === 1 ? lib.many[allowed[0]] : lib.media;

  function load() {
    setError(null);
    media
      .list()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : lib.loadFailed));
  }

  function show() {
    setOpen(true);
    load();
  }

  function pick(item: MediaItem) {
    onChange(item.url);
    onPickItem?.(item);
    setOpen(false);
  }

  const shown = filterMedia(items ?? [], q, only ? [only] : allowed);
  const picked = current ? items?.find((m) => m.id === current) : undefined;
  const lower = noun.toLowerCase();

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" className="a-btn" onClick={show} aria-haspopup="dialog">
          {label ?? lib.choose}
        </button>
        {showCurrent && current && (
          <span className="mono text-sm text-clay">
            {lib.from} <span className="text-bone">{picked?.alt ?? current}</span>
          </span>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={allowed.length === 1 && allowed[0] === "icon" ? lib.iconsTitle : lib.title}>
        <MediaUpload onUploaded={pick} kinds={allowed} />

        <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
          <label className="block w-full max-w-md">
            <span className="a-label">{lib.search}</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="a-input"
              placeholder={lib.searchHint}
            />
          </label>
          <KindFilter kinds={allowed} value={only} onChange={setOnly} />
        </div>

        <p className="sr-only" role="status">
          {items === null ? lib.loading(lower) : lib.count(shown.length, lower)}
        </p>
        {error && <ErrorState message={error} onRetry={load} />}
        {!error && items === null && <p className="mono mt-6 text-sm text-clay">{lib.loadingShort}</p>}
        {items !== null && shown.length === 0 && (
          <p className="a-hint mt-6">
            {filterMedia(items, "", allowed).length === 0
              ? lib.none(lower)
              : lib.noMatch}
          </p>
        )}
        {shown.length > 0 && (
          <div className="mt-5">
            <MediaGrid items={shown} selected={current} onSelect={pick} label={noun === lib.media ? lib.many.image : noun} />
          </div>
        )}
      </Modal>
    </>
  );
}

/** The item a field currently points at, drawn small, so the editor sees what it chose. */
export function PickedPreview({ url, icon = false }: { url: string; icon?: boolean }) {
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      className={`mt-3 ${styles.pickedThumb}`}
      data-kind={icon ? "icon" : undefined}
      loading="lazy"
      decoding="async"
    />
  );
}
