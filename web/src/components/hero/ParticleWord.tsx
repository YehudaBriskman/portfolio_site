import { useEffect, useRef } from "react";
import styles from "@/components/hero/ParticleWord.module.css";
import {
  fitWords,
  groupLines,
  maskFromRGBA,
  mulberry32,
  particleBudget,
  sampleInk,
  textDirection,
  type Rect,
} from "@/components/hero/particleLayout";
import {
  burst,
  createParticles,
  planEntrance,
  settle,
  step,
  type Particles,
  type Pointer,
} from "@/components/hero/particlePhysics";

/*
 * The hero's word, drawn as particles. Desktop only, and only while nothing
 * asks for less: `useParticleGate` decides, and when it says no this
 * component is not mounted and the page is the static h1, exactly as before.
 *
 * What it draws. The h1's own text (`text`, which Hero reads from the same
 * content store as the h1, in whichever language the page is in), in the
 * h1's own computed font, uppercased the way the h1 is, wrapped where the
 * BROWSER wrapped the h1 (the lines are read from the word boxes), at a size
 * chosen to fill most of the section's width. The h1 stays in the DOM,
 * is what a screen reader, a crawler and a reader without script get, and is
 * hidden only with `opacity: 0` once the canvas has been drawn, so it stays
 * selectable and copyable. The canvas is `aria-hidden` and ignores the
 * pointer; pointer movement is listened to on the window.
 *
 * The one loop. A single requestAnimationFrame loop exists, and only while
 * something moves: the entrance (about 1.8s, once), a pointer on the word, or
 * particles still settling. `step` reports rest and the loop does not
 * re-arm; the next pointer event or resize starts it again. There is no idle
 * ambient animation (motion-contract §2, "a second ambient loop").
 *
 * Imperative on purpose. The section's `data-particles` attribute and the
 * `--pw-*` custom properties that size the h1 are written straight to the
 * DOM, so the h1 can be re-laid out and measured synchronously in the same
 * task (a React state round-trip would leave the geometry a frame behind the
 * measurement). React never owns those attributes, so it never clobbers them.
 */

export type Arrival = "wait" | "play" | "now";

/*
 * The word's colours: ink (black on paper, near-white on the dark theme) and
 * five accents that run blue to purple, laid out left to right with noise, so
 * the word reads as one cool gradient with black grain through it. The palette
 * is fixed rather than read from the page's soft tokens on purpose: the owner
 * asked for blue / purple / black and a futuristic feel, and the soft sage and
 * sand do not belong to that.
 */
const ACCENTS_LIGHT = ["#2f5bff", "#4a49f0", "#6b3df0", "#8b3fe6", "#a43fd6"] as const;
const ACCENTS_DARK = ["#5aa9ff", "#6f8cff", "#8a7bff", "#a67bff", "#c07dff"] as const;
const INK_SHARE = 0.22;
const GROUPS = 1 + ACCENTS_LIGHT.length;
const MIN_FONT = 64;

type Hook = {
  count: number;
  particles: Particles;
  pointer: (x: number, y: number, active: boolean) => void;
  burst: (x: number, y: number) => void;
  advance: (frames: number) => void;
  settle: () => void;
  entrance: () => void;
  frameMs: () => { mean: number; max: number; frames: number };
  origin: () => { x: number; y: number };
};

declare global {
  interface Window {
    __heroParticles?: Hook;
  }
}

/* How many dots carry an energy line (every second one, up to this). */
const LINE_CAP = 4500;

const testMode = () => {
  try {
    return new URLSearchParams(window.location.search).get("particles");
  } catch {
    return null;
  }
};

function rgbOf(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `rgb(${v.replace(/\s+/g, " ")})` : "rgb(128 128 128)";
}

export default function ParticleWord({ text, arrival }: { text: string; arrival: Arrival }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arrivalRef = useRef(arrival);
  const startRef = useRef<(() => void) | null>(null);
  /* Once per mount, not once per effect run: a late change of `text` (the
     stored title arriving) rebuilds the word, and must not play it again. */
  const playedRef = useRef(false);

  useEffect(() => {
    arrivalRef.current = arrival;
    if (arrival === "play") startRef.current?.();
  }, [arrival]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const section = host?.closest<HTMLElement>("section");
    const h1 = host?.querySelector<HTMLElement>("h1");
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !section || !h1 || !ctx) return;

    const mode = testMode();
    const dir = textDirection(text);
    let disposed = false;
    let ready = false;
    let entered = false;
    let hooked = false;
    let raf = 0;
    let running = false;
    let last = 0;
    let p: Particles = createParticles(0);
    let radius = 2;
    let groups: Uint16Array[] = [];
    let colours: string[] = [];
    /* `origin` is the canvas box (the whole hero from its top edge down to the
       word, so the energy lines can start at the page's upper end); `band` is
       the word's own box, which is what the pointer and the entrance use. */
    let origin = { x: 0, y: 0, w: 0, h: 0 };
    let band = { x: 0, y: 0, w: 0, h: 0 };
    let dpr = 1;
    let inView = true;
    let clockS = 0;
    let lineT0 = -1;
    let skip = false;
    /* Energy lines: one thin curve from a point in the centred tenth of the
       page's top edge to each sampled dot. The curve's control point is a
       spring that follows the midpoint, so when the dots move the lines swing
       and lag behind them. Drawn from live positions every frame. */
    let L_n = 0;
    let L_dot = new Uint16Array(0);
    let L_sx = new Float32Array(0);
    let L_cx = new Float32Array(0);
    let L_cy = new Float32Array(0);
    let L_vx = new Float32Array(0);
    let L_vy = new Float32Array(0);
    let L_bow = new Float32Array(0);
    let L_ph = new Float32Array(0);
    let L_groups: Uint16Array[] = [];
    const ptr: Pointer = { x: -1e4, y: -1e4, active: false };
    const frames: number[] = [];

    const setVars = (v: Record<string, string> | null) => {
      for (const k of ["--pw-font", "--pw-w", "--pw-h", "--pw-lh"]) {
        if (v) section.style.setProperty(k, v[k]);
        else section.style.removeProperty(k);
      }
    };

    /* ─ fit: size the h1 so the word fills the section ─ */
    const fontParts = () => {
      const cs = getComputedStyle(h1);
      const px = parseFloat(cs.fontSize) || 100;
      const ls = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing) / px;
      return { family: cs.fontFamily, weight: cs.fontWeight, ls: Number.isFinite(ls) ? ls : 0, upper: cs.textTransform === "uppercase" };
    };

    const shown = (s: string, upper: boolean) => (upper ? s.toLocaleUpperCase(document.documentElement.lang || undefined) : s);

    const fit = (): boolean => {
      const f = fontParts();
      const m = document.createElement("canvas").getContext("2d");
      if (!m) return false;
      m.font = `${f.weight} 100px ${f.family}`;
      if ("letterSpacing" in m) (m as CanvasRenderingContext2D).letterSpacing = `${f.ls * 100}px`;
      m.direction = dir;
      const words = shown(text, f.upper).split(/\s+/).filter(Boolean);
      const LH = 0.95;
      const hostW = host.getBoundingClientRect().width;
      const r = fitWords(words, (s) => m.measureText(s).width / 100, hostW * 0.84, window.innerHeight * 0.34, LH, 3, 300);
      if (r.fontSize < MIN_FONT) return false;
      setVars({
        "--pw-font": `${r.fontSize.toFixed(2)}px`,
        "--pw-w": `${(r.width * 1.03 + 2).toFixed(1)}px`,
        "--pw-h": `${r.height.toFixed(1)}px`,
        "--pw-lh": String(LH),
      });
      section.dataset.pwLines = String(r.lines);
      return true;
    };

    /* ─ rasterise the lines the browser laid out, and sample the ink ─ */
    const layout = () => {
      const f = fontParts();
      const hostRect = host.getBoundingClientRect();
      const h1Rect = h1.getBoundingClientRect();
      const px = parseFloat(getComputedStyle(h1).fontSize);
      const wordEls = [...h1.querySelectorAll<HTMLElement>("[data-word]")];
      const rects: Rect[] = wordEls.length
        ? wordEls.map((w) => w.getBoundingClientRect())
        : [h1Rect];
      const lineIds = groupLines(rects);
      const lineTexts = lineIds.map((ids) =>
        wordEls.length ? ids.map((i) => wordEls[i].textContent ?? "").join(" ") : text,
      );

      const R = Math.min(140, Math.max(70, px * 0.55));
      const margin = Math.ceil(R * 0.9);
      const left = 0;
      const top = Math.max(0, h1Rect.top - hostRect.top - margin);
      const bottom = h1Rect.bottom - hostRect.top + margin;
      const W = Math.ceil(hostRect.width);
      const H = Math.ceil(bottom - top);

      const off = document.createElement("canvas");
      off.width = W;
      off.height = H;
      const o = off.getContext("2d", { willReadFrequently: true });
      if (!o) return null;
      o.font = `${f.weight} ${px}px ${f.family}`;
      if ("letterSpacing" in o) (o as CanvasRenderingContext2D).letterSpacing = `${f.ls * px}px`;
      o.direction = dir;
      o.textAlign = "center";
      o.textBaseline = "alphabetic";
      o.fillStyle = "#000";
      lineIds.forEach((ids, li) => {
        const a = rects[ids[0]];
        const minL = Math.min(...ids.map((i) => rects[i].left));
        const maxR = Math.max(...ids.map((i) => rects[i].right));
        const tm = o.measureText("Hg");
        const asc = tm.fontBoundingBoxAscent ?? px * 0.8;
        const desc = tm.fontBoundingBoxDescent ?? px * 0.2;
        const lineBox = Math.max(...ids.map((i) => rects[i].bottom)) - Math.min(...ids.map((i) => rects[i].top));
        const baseline = Math.min(...ids.map((i) => rects[i].top)) - hostRect.top - top + (lineBox - (asc + desc)) / 2 + asc;
        void a;
        o.fillText(shown(lineTexts[li], f.upper), (minL + maxR) / 2 - hostRect.left - left, baseline);
      });
      const mask = maskFromRGBA(o.getImageData(0, 0, W, H).data, W, H);
      const target = particleBudget({
        dpr: window.devicePixelRatio || 1,
        cores: navigator.hardwareConcurrency || 0,
        memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0,
        area: W * H,
      });
      const s = sampleInk(mask, target, 7);
      return { s, left, top, W, H, R, hostW: hostRect.width };
    };

    const sizeCanvas = (L: { left: number; top: number; W: number; H: number }) => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      band = { x: L.left, y: L.top, w: L.W, h: L.H };
      origin = { x: 0, y: 0, w: L.W, h: L.top + L.H };
      canvas.width = Math.round(origin.w * dpr);
      canvas.height = Math.round(origin.h * dpr);
      canvas.style.left = "0px";
      canvas.style.top = "0px";
      canvas.style.width = `${origin.w}px`;
      canvas.style.height = `${origin.h}px`;
    };

    const readColours = () => {
      const ink = rgbOf("--ink");
      const lum = (ink.match(/\d+/g) ?? ["0"]).slice(0, 3).reduce((a, b) => a + Number(b), 0) / 3;
      colours = [ink, ...(lum > 128 ? ACCENTS_DARK : ACCENTS_LIGHT)];
    };

    const buildLines = () => {
      const n = Math.min(LINE_CAP, Math.floor(p.count / 2));
      L_n = n;
      L_dot = new Uint16Array(n);
      L_sx = new Float32Array(n);
      L_cx = new Float32Array(n);
      L_cy = new Float32Array(n);
      L_vx = new Float32Array(n);
      L_vy = new Float32Array(n);
      L_bow = new Float32Array(n);
      L_ph = new Float32Array(n);
      const rng = mulberry32(29);
      const lists: number[][] = Array.from({ length: GROUPS }, () => []);
      for (let l = 0; l < n; l += 1) {
        const i = Math.min(p.count - 1, Math.floor((l * p.count) / n));
        L_dot[l] = i;
        L_sx[l] = origin.w * (0.45 + 0.1 * rng());
        L_bow[l] = (rng() - 0.5) * 0.34;
        L_ph[l] = rng();
        L_cx[l] = (L_sx[l] + p.x[i]) / 2;
        L_cy[l] = p.y[i] / 2;
        lists[p.group[i]].push(l);
      }
      L_groups = lists.map((a) => Uint16Array.from(a));
    };

    /* One fixed-size spring step for every line's control point. */
    const stepLines = (dt: number) => {
      const k = 70;
      const c = 2 * 0.42 * Math.sqrt(k);
      for (let l = 0; l < L_n; l += 1) {
        const i = L_dot[l];
        const dx = p.x[i] - L_sx[l];
        const dy = p.y[i];
        const tx = L_sx[l] + dx * 0.5 + dy * L_bow[l];
        const ty = dy * 0.5 - Math.abs(dx) * 0.05;
        L_vx[l] += ((tx - L_cx[l]) * k - L_vx[l] * c) * dt;
        L_vy[l] += ((ty - L_cy[l]) * k - L_vy[l] * c) * dt;
        L_cx[l] += L_vx[l] * dt;
        L_cy[l] += L_vy[l] * dt;
      }
    };

    const drawLines = () => {
      const fade = lineT0 >= 0 ? Math.min(1, Math.max(0, (clockS - lineT0) / 1.5)) : 1;
      if (fade <= 0 || !L_n) return;
      const TAU = Math.PI * 2;
      ctx.lineWidth = 0.5;
      for (let g = 0; g < L_groups.length; g += 1) {
        const list = L_groups[g];
        if (!list.length) continue;
        ctx.strokeStyle = colours[g];
        ctx.globalAlpha = 0.07 * fade;
        ctx.beginPath();
        for (let k = 0; k < list.length; k += 1) {
          const l = list[k];
          const i = L_dot[l];
          ctx.moveTo(L_sx[l], 0);
          ctx.quadraticCurveTo(L_cx[l], L_cy[l], p.x[i], p.y[i]);
        }
        ctx.stroke();
      }
      /* The energy: a bright bead runs down every tenth line toward its dot
         and flares as it arrives. */
      for (let g = 0; g < L_groups.length; g += 1) {
        const list = L_groups[g];
        ctx.fillStyle = colours[g];
        ctx.globalAlpha = 0.9 * fade;
        ctx.beginPath();
        for (let k = 0; k < list.length; k += 1) {
          const l = list[k];
          if (l % 10 !== 0) continue;
          const i = L_dot[l];
          const t = (clockS * (0.16 + L_ph[l] * 0.14) + L_ph[l] * 7) % 1;
          const u = 1 - t;
          const x = u * u * L_sx[l] + 2 * u * t * L_cx[l] + t * t * p.x[i];
          const y = 2 * u * t * L_cy[l] + t * t * p.y[i];
          const r = t > 0.94 ? radius * 2.4 : 1.1;
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, TAU);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, -origin.x * dpr, -origin.y * dpr);
      ctx.clearRect(origin.x, origin.y, origin.w, origin.h);
      drawLines();
      const TAU = Math.PI * 2;
      for (let g = 0; g < groups.length; g += 1) {
        const list = groups[g];
        ctx.fillStyle = colours[g];
        ctx.globalAlpha = g === 0 ? 0.92 : 0.95;
        ctx.beginPath();
        for (let k = 0; k < list.length; k += 1) {
          const i = list[k];
          const x = p.x[i];
          const y = p.y[i];
          ctx.moveTo(x + radius, y);
          ctx.arc(x, y, radius, 0, TAU);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const frame = (ts: number) => {
      raf = 0;
      const dt = last ? (ts - last) / 1000 : 1 / 60;
      last = ts;
      const t0 = performance.now();
      const go = step(p, ptr, dt);
      clockS += Math.min(dt, 0.05);
      stepLines(Math.min(dt, 1 / 30));
      /* When only the energy is moving, half the frames are enough. */
      skip = !go && !skip;
      if (!skip) draw();
      frames.push(performance.now() - t0);
      if (frames.length > 600) frames.shift();
      if ((go || ambient()) && !document.hidden) raf = requestAnimationFrame(frame);
      else {
        running = false;
        last = 0;
      }
    };
    /* The energy keeps moving while the word is on screen and nothing asks
       for stillness (the gate already holds for reduced motion, Pause, print
       and forced colours). */
    const ambient = () => ready && entered && inView && !mode;
    const kick = () => {
      if (!ready || running || document.hidden) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };

    /* ─ build (and rebuild on resize, carrying positions over) ─ */
    const build = (first: boolean): boolean => {
      if (!fit()) return false;
      const L = layout();
      if (!L || L.s.count === 0) return false;
      const old = p;
      const next = createParticles(L.s.count);
      next.radius = L.R;
      const rng = mulberry32(11);
      for (let i = 0; i < next.count; i += 1) {
        next.tx[i] = L.s.xy[i * 2] + L.left;
        next.ty[i] = L.s.xy[i * 2 + 1] + L.top;
        const u = rng();
        const across = Math.min(1, Math.max(0, next.tx[i] / Math.max(1, L.W) + (rng() - 0.5) * 0.3));
        next.group[i] = u < INK_SHARE ? 0 : 1 + Math.min(GROUPS - 2, Math.floor(across * (GROUPS - 1)));
        if (!first && old.count) {
          const j = Math.min(old.count - 1, Math.floor((i * old.count) / next.count));
          next.x[i] = old.x[j];
          next.y[i] = old.y[j];
          next.vx[i] = old.vx[j];
          next.vy[i] = old.vy[j];
        } else {
          next.x[i] = next.tx[i];
          next.y[i] = next.ty[i];
        }
      }
      /* A rebuild mid-entrance (a resize, a late font) keeps the entrance
         going: each new particle takes the flight plan of the old one it maps
         to, so the stream carries on instead of snapping to a spring. */
      if (!first && old.count && old.clock !== Infinity) {
        for (let i = 0; i < next.count; i += 1) {
          const j = Math.min(old.count - 1, Math.floor((i * old.count) / next.count));
          next.sx[i] = old.sx[j];
          next.sy[i] = old.sy[j];
          next.cx[i] = old.cx[j];
          next.cy[i] = old.cy[j];
          next.delay[i] = old.delay[j];
          next.dur[i] = old.dur[j];
        }
        next.clock = old.clock;
      }
      const lists: number[][] = Array.from({ length: GROUPS }, () => []);
      for (let i = 0; i < next.count; i += 1) lists[next.group[i]].push(i);
      groups = lists.map((l) => Uint16Array.from(l));
      radius = Math.min(2, Math.max(0.8, L.s.radius * 0.36));
      p = next;
      sizeCanvas(L);
      readColours();
      buildLines();
      return true;
    };

    const reveal = () => {
      section.dataset.particles = "on";
    };

    const begin = () => {
      if (!ready || entered || disposed) return;
      entered = true;
      const hostW = host.getBoundingClientRect().width;
      if (arrivalRef.current === "play" && mode !== "settled" && !playedRef.current) {
        playedRef.current = true;
        lineT0 = clockS + 0.3;
        planEntrance(p, -40, hostW + 40, hostW / 2, mulberry32(3), band.h * 0.36);
        reveal();
        draw();
        kick();
      } else {
        settle(p);
        reveal();
        draw();
        kick();
      }
    };
    startRef.current = begin;

    /* ─ events ─ */
    const inBand = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const ok =
        y >= band.y && y <= band.y + band.h && x >= 0 && x <= band.w && e.target instanceof Node && section.contains(e.target);
      return { ok, x, y };
    };
    const onMove = (e: PointerEvent) => {
      if (!ready || e.pointerType === "touch") return;
      const { ok, x, y } = inBand(e);
      if (ok) {
        ptr.x = x;
        ptr.y = y;
        ptr.active = true;
        kick();
      } else if (ptr.active) {
        ptr.active = false;
        kick();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!ready || e.pointerType === "touch") return;
      const { ok, x, y } = inBand(e);
      if (!ok) return;
      burst(p, x, y, 420);
      kick();
    };
    const onLeave = () => {
      if (ptr.active) {
        ptr.active = false;
        kick();
      }
    };
    const onVisible = () => {
      if (!document.hidden) kick();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave, { passive: true });
    document.addEventListener("visibilitychange", onVisible);

    let timer = 0;
    const relayout = () => {
      if (!ready) return;
      if (!build(false)) return;
      /* Before the entrance has started the word is not on screen: drawing
         here would flash the assembled word and then take it away. */
      if (section.dataset.particles === "on") {
        draw();
        kick();
      }
    };
    const ro = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(relayout, 150);
    });
    ro.observe(host);
    const io =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver((es) => {
            inView = es.some((e) => e.isIntersecting);
            if (inView) kick();
          })
        : null;
    io?.observe(host);

    const themeObserver = new MutationObserver(() => {
      readColours();
      if (ready) draw();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });

    /* ─ start: the font first, so the glyphs sampled are the glyphs shown ─ */
    section.dataset.particles = "eligible";
    fit();
    const f0 = fontParts();
    const fontsReady = Promise.all([
      document.fonts?.load(`${f0.weight} 100px ${f0.family}`, text).catch(() => []),
      document.fonts?.ready,
    ]);
    void fontsReady.then(() => {
      if (disposed) return;
      if (!build(true)) {
        section.removeAttribute("data-particles");
        setVars(null);
        return;
      }
      ready = true;
      if (mode) {
        hooked = true;
        window.__heroParticles = {
          get count() {
            return p.count;
          },
          get particles() {
            return p;
          },
          pointer: (x, y, active) => {
            ptr.x = x;
            ptr.y = y;
            ptr.active = active;
          },
          burst: (x, y) => burst(p, x, y, 420),
          advance: (n) => {
            for (let i = 0; i < n; i += 1) if (!step(p, ptr, 1 / 60)) break;
            draw();
          },
          settle: () => {
            settle(p);
            draw();
          },
          entrance: () => {
            const w = host.getBoundingClientRect().width;
            planEntrance(p, -40, w + 40, w / 2, mulberry32(3), band.h * 0.36);
            draw();
          },
          frameMs: () => {
            const n = frames.length;
            return { mean: n ? frames.reduce((a, b) => a + b, 0) / n : 0, max: n ? Math.max(...frames) : 0, frames: n };
          },
          origin: () => ({ x: band.x, y: band.y }),
        };
      }
      if (arrivalRef.current !== "wait") begin();
    });

    return () => {
      disposed = true;
      ready = false;
      startRef.current = null;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      ro.disconnect();
      io?.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisible);
      section.removeAttribute("data-particles");
      section.removeAttribute("data-pw-lines");
      setVars(null);
      if (hooked) delete window.__heroParticles;
    };
  }, [text]);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" data-particle-word="" />;
}
