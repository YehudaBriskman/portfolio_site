import { useEffect, useId, useRef, type ReactNode } from "react";
import { KIND_LABEL, formatBytes, formatDuration, type MediaItem, type MediaKind } from "@/services/media";
import styles from "./Media.module.css";

/*
 * Which kinds to show: All, Pictures, Icons, Videos. Native radios, so arrow
 * keys move between them and a screen reader hears one group with one choice.
 */
export function KindFilter({
  kinds,
  value,
  onChange,
}: {
  kinds: readonly MediaKind[];
  value: MediaKind | null;
  onChange: (kind: MediaKind | null) => void;
}) {
  const name = useId();
  if (kinds.length < 2) return null;
  const options: Array<[MediaKind | null, string]> = [[null, "All"], ...kinds.map((k) => [k, KIND_LABEL[k].many] as [MediaKind, string])];
  return (
    <fieldset className={styles.filter}>
      <legend className="a-label">Show</legend>
      {options.map(([k, text]) => (
        <label key={k ?? "all"} className={styles.filterOption}>
          <input type="radio" name={name} checked={value === k} onChange={() => onChange(k)} />
          <span>{text}</span>
        </label>
      ))}
    </fieldset>
  );
}

function facts(m: MediaItem): string {
  if (m.kind === "video") return `${KIND_LABEL.video.one} · ${formatDuration(m.durationMs ?? 0)} · ${formatBytes(m.bytes)}`;
  if (m.kind === "icon") return `${KIND_LABEL.icon.one} · ${m.format.toUpperCase()} · ${formatBytes(m.bytes)}`;
  return `${m.width}×${m.height} · ${formatBytes(m.bytes)}`;
}

/* A grid of library items, each one button. Shared by the library page and the picker. */
export function MediaGrid({
  items,
  selected,
  onSelect,
  label,
}: {
  items: MediaItem[];
  selected?: string | null;
  onSelect: (item: MediaItem) => void;
  label: string;
}) {
  return (
    <ul className={styles.grid} aria-label={label}>
      {items.map((m) => {
        const uses = m.usedBy?.length ?? 0;
        return (
          <li key={m.id} className="min-w-0">
            <button
              type="button"
              className={styles.tile}
              aria-pressed={selected === undefined ? undefined : selected === m.id}
              onClick={() => onSelect(m)}
            >
              {m.preview ? (
                <img
                  src={m.preview}
                  alt=""
                  className={styles.thumb}
                  data-kind={m.kind}
                  loading="lazy"
                  decoding="async"
                  width={400}
                  height={300}
                />
              ) : (
                <span className={styles.thumb} aria-hidden="true" />
              )}
              {m.kind === "video" && (
                <span className={styles.badge} aria-hidden="true">
                  ▶ {formatDuration(m.durationMs ?? 0)}
                </span>
              )}
              <span className={styles.tileText}>
                <span className={styles.tileAlt}>{m.alt}</span>
                <span className={styles.tileMeta}>
                  {facts(m)}
                  {m.usedBy ? ` · ${uses === 0 ? "unused" : `used ${uses}×`}` : ""}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/*
 * A native modal <dialog>: the browser traps focus, Escape closes it, and
 * focus returns to whatever opened it. jsdom has no showModal, so the
 * attribute stands in there.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    } else if (!open && d.open) {
      if (typeof d.close === "function") d.close();
      else d.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-label={title}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {open && (
        <>
          <div className={styles.dialogHead}>
            <h2 className="display-tight min-w-0 flex-1 truncate text-xl">{title}</h2>
            <button type="button" className="a-btn a-btn-ghost a-icon-btn" onClick={onClose} aria-label="Close">
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <div className={styles.dialogBody}>{children}</div>
        </>
      )}
    </dialog>
  );
}
