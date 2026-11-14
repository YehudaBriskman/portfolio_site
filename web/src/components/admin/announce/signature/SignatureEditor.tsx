import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { usePhone } from "@/hooks/usePhone";
import { toast } from "@/lib/toast";
import { addStroke, canRedo, canUndo, clearPad, emptyPad, redo, undo, type Pad } from "@/lib/signature/padModel";
import { cleanSignature, hexToRgb, type Raster } from "@/lib/signature/ink";
import { loadRaster, rasterToBase64, rasterToDataUrl } from "@/lib/signature/canvasIO";
import { strokesToSvg, type Strokes } from "@/lib/signature/strokes";
import { ContentConflictError, ContentInvalidError } from "@/services/adminContent";
import { adminSignature, type SigLang, type SigSaveBody, type SigSlot } from "@/services/adminSignature";
import SignaturePad, { PAD_H, PAD_W } from "./SignaturePad";
import SignaturePreviews, { type PreviewArt } from "./SignaturePreviews";
import { useSignatureWords } from "./words";

/*
 * One language's signature, made one of two ways: DRAW (the pad, undo/redo,
 * pen width, ink, a guide line; re-editable from the stored strokes) or UPLOAD
 * (a photo or scan whose paper is removed here in the browser, or an SVG that
 * the server rebuilds from an allow-list). On a phone it is a bottom sheet;
 * on a desktop it opens in place. Save sends strokes, SVG text or a cleaned
 * PNG; the server writes everything that is stored. Nothing is public until a
 * use is switched on.
 */

const INKS = [
  { id: "ink", hex: "#14130f" },
  { id: "soft", hex: "#55524a" },
] as const;
const LIGHT_INK = "#f5f1ea";
const MAX_FILE = 5 * 1024 * 1024;

const svgUrl = (svg: string, colour: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replaceAll("currentColor", colour))}`;
/* Display size: the server renders a 2x picture of at most 480 x 240, shown at half that. */
const shown = (w: number, h: number) => {
  const k = Math.min(480 / w, 240 / h);
  return { width: Math.max(1, Math.round((w * k) / 2)), height: Math.max(1, Math.round((h * k) / 2)) };
};

type Props = { lang: SigLang; mode: "draw" | "upload"; existing: SigSlot | null; defaultAlt: string; onSaved: (slot: SigSlot) => void; onClose: () => void };

export default function SignatureEditor({ lang, mode, existing, defaultAlt, onSaved, onClose }: Props) {
  const w = useSignatureWords();
  const phone = usePhone();
  const uid = useId();
  const langName = w.langName[lang];

  const [alt, setAlt] = useState(existing?.alt || defaultAlt);
  const [ink, setInk] = useState<string>(existing?.ink ?? INKS[0].hex);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  /* Draw */
  const [pad, setPad] = useState<Pad>(() => emptyPad(existing?.mode === "drawn" && existing.strokes ? existing.strokes.strokes : []));
  const [pen, setPen] = useState(existing?.strokes?.pen ?? 4);
  const [guide, setGuide] = useState(true);

  /* Upload */
  const [file, setFile] = useState<{ kind: "svg"; text: string } | { kind: "raster"; src: Raster } | null>(null);
  const [threshold, setThreshold] = useState(25);
  const [soften, setSoften] = useState(20);
  const [keep, setKeep] = useState(false);
  const [recolor, setRecolor] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  const cleaned = useMemo(() => (file?.kind === "raster" ? cleanSignature(file.src, { threshold, soften, ink: keep ? null : hexToRgb(ink) }) : null), [file, threshold, soften, keep, ink]);
  const cleanedLight = useMemo(() => (file?.kind === "raster" && !keep ? cleanSignature(file.src, { threshold, soften, ink: hexToRgb(LIGHT_INK) }) : null), [file, threshold, soften, keep]);

  const strokes: Strokes = { w: PAD_W, h: PAD_H, pen, strokes: pad.present };
  const art: PreviewArt | null = useMemo(() => {
    if (mode === "draw") {
      if (pad.present.length === 0) return null;
      try {
        const r = strokesToSvg({ w: PAD_W, h: PAD_H, pen, strokes: pad.present });
        return { src: svgUrl(r.svg, ink), lightSrc: svgUrl(r.svg, LIGHT_INK), themeable: true, ...shown(r.width, r.height) };
      } catch {
        return null;
      }
    }
    if (file?.kind === "svg") {
      const m = /viewBox="[^"]*?([\d.]+) ([\d.]+)"/.exec(file.text);
      const { width, height } = shown(Number(m?.[1]) || 240, Number(m?.[2]) || 120);
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(file.text)}`;
      return { src: url, lightSrc: null, themeable: false, width, height };
    }
    if (cleaned) {
      const s = shown(cleaned.width, cleaned.height);
      return { src: rasterToDataUrl(cleaned), lightSrc: cleanedLight ? rasterToDataUrl(cleanedLight) : null, themeable: !keep, ...s };
    }
    return null;
  }, [mode, pad.present, pen, ink, file, cleaned, cleanedLight, keep]);

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    setError("");
    if (f.size > MAX_FILE) return setError(w.fileTooBig);
    try {
      if (f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg")) setFile({ kind: "svg", text: await f.text() });
      else setFile({ kind: "raster", src: await loadRaster(f) });
    } catch {
      setError(w.fileUnreadable);
    }
  };

  const nothing = mode === "draw" ? pad.present.length === 0 : file === null;
  const noInk = mode === "upload" && file?.kind === "raster" && cleaned === null;

  const save = async () => {
    if (!alt.trim()) return setError(w.altRequired);
    if (nothing) return setError(mode === "draw" ? w.nothingDrawn : w.fileHint);
    if (noInk) return setError(w.nothingLeft);
    setSaving(true);
    setError("");
    try {
      let body: SigSaveBody;
      if (mode === "draw") body = { kind: "strokes", alt: alt.trim(), strokes, ink, light: true };
      else if (file?.kind === "svg") body = { kind: "svg", alt: alt.trim(), svg: file.text, recolor, ink, light: true };
      else body = { kind: "png", alt: alt.trim(), png: await rasterToBase64(cleaned as Raster), light: !keep };
      const r = await adminSignature.save(lang, body);
      toast.success(w.saved(langName));
      onSaved(r.slot);
    } catch (e) {
      if (e instanceof ContentInvalidError) {
        const first = e.issues[0]?.message;
        setError(first ? (e.issues[0].path === "svg" ? w.svgRefused(first.replace(/^This SVG cannot be used: /, "")) : first) : w.saveFailed);
      } else if (e instanceof ContentConflictError) setError(w.conflict);
      else {
        setError(w.saveFailed);
        toast.error(w.saveFailed);
      }
    } finally {
      setSaving(false);
    }
  };

  const inkSwatches = (
    <div role="radiogroup" aria-label={w.ink} className="flex flex-wrap items-center gap-2">
      <span className="a-label !mt-0">{w.ink}</span>
      {INKS.map((i) => (
        <button
          key={i.id}
          type="button"
          role="radio"
          aria-checked={ink === i.hex}
          aria-label={i.id === "ink" ? w.inkDark : w.inkSoft}
          title={i.id === "ink" ? w.inkDark : w.inkSoft}
          onClick={() => setInk(i.hex)}
          className="inline-grid min-h-[44px] min-w-[44px] place-items-center rounded-full"
        >
          <span className="block h-7 w-7 rounded-full border-2" style={{ background: i.hex, borderColor: ink === i.hex ? "rgb(var(--ink))" : "rgb(var(--rule-firm))" }} />
        </button>
      ))}
    </div>
  );

  const slider = (id: string, label: string, v: number, set: (n: number) => void, min = 0, max = 100) => (
    <div>
      <label className="a-label" htmlFor={id}>{label}</label>
      <input id={id} type="range" min={min} max={max} value={v} onChange={(e) => (setError(""), set(Number(e.target.value)))} className="block min-h-[44px] w-full" />
    </div>
  );

  const body: ReactNode = (
    <div className="space-y-4">
      {mode === "draw" ? (
        <>
          <SignaturePad strokes={pad.present} onStroke={(s) => (setError(""), setPad((p) => addStroke(p, s)))} pen={pen} ink={ink} guide={guide} />
          <p id="sig-pad-note" className="a-hint !mt-0">{w.padHelp} {w.keyboardNote}</p>
          <div role="toolbar" aria-label={w.padLabel} className="flex flex-wrap items-center gap-2">
            <button type="button" className="a-btn min-h-[44px]" disabled={!canUndo(pad)} onClick={() => setPad(undo)}>{w.undo}</button>
            <button type="button" className="a-btn min-h-[44px]" disabled={!canRedo(pad)} onClick={() => setPad(redo)}>{w.redo}</button>
            <button type="button" className="a-btn a-btn-ghost min-h-[44px]" disabled={pad.present.length === 0} onClick={() => setPad(clearPad)}>{w.clear}</button>
          </div>
          {slider(`${uid}-pen`, w.penWidth, pen, setPen, 1, 12)}
          {inkSwatches}
          <label className="flex min-h-[44px] items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={guide} onChange={(e) => setGuide(e.target.checked)} />
            <span>{w.guide}</span>
          </label>
        </>
      ) : (
        <>
          <div>
            <input ref={fileInput} id={`${uid}-file`} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" className="sr-only" onChange={(e) => void pickFile(e.target.files?.[0])} aria-describedby={`${uid}-file-h`} />
            <button type="button" className="a-btn min-h-[44px]" onClick={() => fileInput.current?.click()}>{w.chooseFile}</button>
            <p id={`${uid}-file-h`} className="a-hint">{w.fileHint}</p>
          </div>
          {file?.kind === "raster" && (
            <>
              {slider(`${uid}-th`, w.threshold, threshold, setThreshold)}
              {slider(`${uid}-so`, w.softness, soften, setSoften)}
              <label className="flex min-h-[44px] items-center gap-3 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
                <span>{w.keepColours}</span>
              </label>
              {!keep && inkSwatches}
              {cleaned && art && <CheckerPreview art={art} alt={alt} />}
            </>
          )}
          {file?.kind === "svg" && (
            <>
              <label className="flex min-h-[44px] items-center gap-3 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={recolor} onChange={(e) => setRecolor(e.target.checked)} />
                <span>{w.recolourSvg}</span>
              </label>
              {recolor && inkSwatches}
              {art && <CheckerPreview art={art} alt={alt} />}
            </>
          )}
        </>
      )}
      <div>
        <label className="a-label" htmlFor={`${uid}-alt`}>{w.altLabel}</label>
        <input id={`${uid}-alt`} className="a-input" dir="auto" value={alt} maxLength={120} aria-describedby={`${uid}-alt-h`} aria-invalid={error === w.altRequired} autoComplete="off" onChange={(e) => setAlt(e.target.value)} />
        <p id={`${uid}-alt-h`} className="a-hint">{w.altHint}</p>
      </div>
      {art && <SignaturePreviews art={art} alt={alt} />}
      {error && <p role="alert" className="a-error">{error}</p>}
    </div>
  );

  const title = mode === "draw" ? w.drawTitle(langName) : w.uploadTitle(langName);
  const buttons = (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="a-btn a-btn-primary min-h-[44px]" disabled={saving} onClick={() => void save()}>{saving ? w.saving : w.save}</button>
      <button type="button" className="a-btn a-btn-ghost min-h-[44px]" onClick={onClose}>{w.cancel}</button>
    </div>
  );

  if (phone) {
    return (
      <BottomSheet open onClose={onClose} title={title} snap="full" snaps={["full"]} footer={buttons}>
        <div className="px-4 pb-3">{body}</div>
      </BottomSheet>
    );
  }
  return (
    <div className="a-box space-y-4 p-4" role="group" aria-label={title}>
      <h4 className="display-tight text-base">{title}</h4>
      {body}
      {buttons}
    </div>
  );
}

/* The cleaned picture on a checkerboard (transparent), on light and on dark. */
function CheckerPreview({ art, alt }: { art: PreviewArt; alt: string }) {
  const w = useSignatureWords();
  const checker = "repeating-conic-gradient(#d9d6cc 0% 25%, #f4f2ea 0% 50%) 0 0 / 16px 16px";
  const cell = (label: string, bg: string, src: string) => (
    <figure className="m-0 min-w-0">
      <figcaption className="mb-1 text-sm text-clay">{label}</figcaption>
      <div className="grid place-items-center rounded-[var(--a-r-ctl,12px)] border border-[rgb(var(--rule-firm)/0.5)] p-3" style={{ background: bg }}>
        <img src={src} alt={alt} style={{ maxWidth: "100%", maxHeight: 96 }} />
      </div>
    </figure>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-3" data-testid="checker-preview">
      {cell(w.previewChecker, checker, art.src)}
      {cell(w.previewOnLight, "#ffffff", art.src)}
      {cell(w.previewOnDark, "#1b1b1a", art.lightSrc ?? art.src)}
    </div>
  );
}
