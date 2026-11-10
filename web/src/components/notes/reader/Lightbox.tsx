import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Maximize2, X } from "lucide-react";
import { useReaderWords } from "./words";
import styles from "./Reader.module.css";

/*
 * The picture view (#249): one picture or diagram from a note, the size of
 * the screen, with zoom and pan.
 *
 * A native modal `<dialog>`, like the dashboards' phone sheet and the contact
 * form: the top layer, a focus trap, an inert page behind it and Escape all
 * come from the platform, and focus goes back to the picture that opened it.
 *
 * No motion. It is shown and hidden, and the picture moves only under the
 * reader's hand (drag, wheel, the zoom buttons), which is direct
 * manipulation — `docs/motion-contract.md` §8, the picture view row. Nothing
 * eases, so nothing needs an off-switch.
 *
 * The keys: ←/→ (mirrored under `dir="rtl"`, where the next picture is to the
 * left), + and − (and = without shift), 0 to fit, the arrow keys pan once
 * zoomed. A picture's alt text is its name; its caption, when it has one, is
 * printed under it and is the dialog's description.
 */

export type Figure = { src: string; alt: string; caption: string; kind: "picture" | "diagram" };

const MIN = 1;
const MAX = 8;
const STEP = 1.5;

export default function Lightbox({
  figures,
  index,
  onIndex,
  onClose,
}: {
  figures: Figure[];
  index: number | null;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const [w] = useReaderWords();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ id: number; x: number; y: number; px: number; py: number } | null>(null);

  const open = index !== null && figures[index] !== undefined;
  const fig = open ? figures[index] : null;

  /* A new picture starts fitted, not at the last one's zoom. */
  const [shownFor, setShownFor] = useState(index);
  if (shownFor !== index) {
    setShownFor(index);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    } else if (!open && d.open) {
      if (typeof d.close === "function") d.close();
      else d.removeAttribute("open");
    }
  }, [open]);

  function zoomTo(next: number) {
    const z = Math.min(MAX, Math.max(MIN, Math.round(next * 100) / 100));
    setZoom(z);
    if (z === 1) setPan({ x: 0, y: 0 });
  }

  function go(delta: number) {
    if (index === null || figures.length < 2) return;
    onIndex((index + delta + figures.length) % figures.length);
  }

  function onKey(e: React.KeyboardEvent) {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const along = rtl ? -1 : 1;
    if (e.key === "+" || e.key === "=") zoomTo(zoom * STEP);
    else if (e.key === "-" || e.key === "_") zoomTo(zoom / STEP);
    else if (e.key === "0") zoomTo(1);
    else if (zoom > 1 && e.key.startsWith("Arrow")) {
      const d = 40;
      const dx = e.key === "ArrowLeft" ? d : e.key === "ArrowRight" ? -d : 0;
      const dy = e.key === "ArrowUp" ? d : e.key === "ArrowDown" ? -d : 0;
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    } else if (e.key === "ArrowRight") go(along);
    else if (e.key === "ArrowLeft") go(-along);
    else return;
    e.preventDefault();
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (zoom <= 1) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
  }
  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current?.id === e.pointerId) drag.current = null;
  }

  const pct = `${Math.round(zoom * 100)}%`;
  const kind = fig?.kind === "diagram" ? w.diagram : w.picture;

  return (
    <dialog
      ref={dialog}
      className={`${styles.viewer} pop-dialog pop-dialog--viewer`}
      aria-label={fig ? `${kind}: ${fig.alt || w.viewer}` : w.viewer}
      aria-describedby={fig?.caption ? "lightbox-caption" : undefined}
      onClose={() => {
        onClose();
        const back = opener.current;
        if (back instanceof HTMLElement) back.focus();
      }}
      onKeyDown={onKey}
      onClick={(e) => {
        /* A press on the backdrop is a press on the dialog itself. */
        if (e.target === e.currentTarget) dialog.current?.close();
      }}
    >
      {fig && (
        <>
          <div className={styles.viewerBar}>
            <p className={styles.viewerCount}>
              {figures.length > 1 ? w.ofCount((index ?? 0) + 1, figures.length) : kind}
            </p>
            <div className={styles.viewerTools} role="group" aria-label={w.zoomLevel(pct)}>
              <button type="button" className={styles.viewerBtn} onClick={() => zoomTo(zoom / STEP)} disabled={zoom <= MIN} aria-label={w.zoomOut} title={w.zoomOut}>
                <Minus size={18} aria-hidden="true" />
              </button>
              <output className={styles.viewerZoom} aria-live="polite">{pct}</output>
              <button type="button" className={styles.viewerBtn} onClick={() => zoomTo(zoom * STEP)} disabled={zoom >= MAX} aria-label={w.zoomIn} title={w.zoomIn}>
                <Plus size={18} aria-hidden="true" />
              </button>
              <button type="button" className={styles.viewerBtn} onClick={() => zoomTo(1)} disabled={zoom === 1} aria-label={w.zoomReset} title={w.zoomReset}>
                <Maximize2 size={16} aria-hidden="true" />
              </button>
              <button type="button" className={styles.viewerBtn} onClick={() => dialog.current?.close()} aria-label={w.close} title={w.close} autoFocus>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            className={styles.viewerStage}
            data-zoomed={zoom > 1 ? "" : undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={() => zoomTo(zoom > 1 ? 1 : 2)}
            onWheel={(e) => {
              if (e.deltaY === 0) return;
              zoomTo(e.deltaY < 0 ? zoom * 1.15 : zoom / 1.15);
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) dialog.current?.close();
            }}
          >
            <img
              src={fig.src}
              alt={fig.alt}
              draggable={false}
              className={styles.viewerImg}
              data-kind={fig.kind}
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            />
          </div>

          <div className={styles.viewerFoot}>
            {figures.length > 1 && (
              <button type="button" className={styles.viewerBtn} onClick={() => go(-1)} aria-label={w.previous} title={w.previous}>
                <ChevronLeft size={20} aria-hidden="true" className={styles.flipRtl} />
              </button>
            )}
            <div className={styles.viewerText}>
              {fig.caption && (
                <p id="lightbox-caption" className={styles.viewerCaption}>
                  {fig.caption}
                </p>
              )}
              <p className={styles.viewerHint}>{w.viewerHint}</p>
            </div>
            {figures.length > 1 && (
              <button type="button" className={styles.viewerBtn} onClick={() => go(1)} aria-label={w.next} title={w.next}>
                <ChevronRight size={20} aria-hidden="true" className={styles.flipRtl} />
              </button>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
