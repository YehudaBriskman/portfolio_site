import { flushSync } from "react-dom";
import { getResolvedTheme, resolveTheme, setThemeChoice } from "@/lib/theme";
import type { ThemeChoice } from "@/lib/themeDefault";
import "./theme-wave.css";
import { motionOff } from "@/hooks/motionOff";

/*
 * The theme changing as a wave (#266): the new theme spreads from the toggle
 * as a circle until it covers the window.
 *
 * A view transition, because it is the only way to show two themes at once
 * without painting the page twice: the browser snapshots the old frame, the
 * callback switches the theme, and `::view-transition-new(root)` — the live
 * page in its new theme — is revealed through a growing `clip-path` circle
 * over the frozen old one. Every pixel inside the circle is the real new
 * page and every pixel outside is the real old one, so no element is ever
 * half-themed, nothing reflows, and text never flashes.
 *
 * The geometry is three custom properties on <html>, set through the CSSOM
 * (which the CSP does not govern; `style-src` covers markup and sheets), and
 * the clock is a keyframe in `theme-wave.css`. No Web Animations call: the
 * motion contract keeps those out of the source (scrollOnly.test.ts).
 *
 * Instant, with no transition at all, when any off-switch is on (motion
 * contract §4): no `startViewTransition`, reduced motion, or the site's
 * Pause. And instant when nothing would change — choosing System while the
 * OS already agrees — or when there is no origin to grow from. A System
 * change that comes FROM the OS never reaches here: `lib/theme.ts` applies
 * it directly, because nobody pressed anything.
 */

/** How long the circle takes to cover the window. */
export const WAVE_MS = 600;

type Origin = { x: number; y: number };

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/** The radius that reaches the window's farthest corner from (x, y). */
export function coverRadius({ x, y }: Origin, width: number, height: number): number {
  return Math.ceil(Math.hypot(Math.max(x, width - x), Math.max(y, height - y)));
}

/** Whether the wave may play: support, and none of the three off-switches. */
export function canWave(): boolean {
  const doc = document as ViewTransitionDocument;
  if (typeof doc.startViewTransition !== "function") return false;
  return !motionOff();
}

function prefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/** The centre of an element, in viewport pixels. */
export function centreOf(el: Element | null): Origin | undefined {
  if (!el) return undefined;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Choose a theme, and if it changes what the page looks like, let it spread
 * from `origin`. The choice is stored and applied exactly as
 * `setThemeChoice` does either way, so a reload agrees with the wave.
 */
export function changeTheme(next: ThemeChoice, origin?: Origin) {
  const changes = resolveTheme(next, prefersDark()) !== getResolvedTheme();
  if (!origin || !changes || !canWave()) {
    setThemeChoice(next);
    return;
  }

  const root = document.documentElement;
  root.style.setProperty("--wave-x", `${Math.round(origin.x)}px`);
  root.style.setProperty("--wave-y", `${Math.round(origin.y)}px`);
  root.style.setProperty("--wave-r", `${coverRadius(origin, window.innerWidth, window.innerHeight)}px`);
  root.setAttribute("data-theme-wave", "");

  const clear = () => {
    root.removeAttribute("data-theme-wave");
    root.style.removeProperty("--wave-x");
    root.style.removeProperty("--wave-y");
    root.style.removeProperty("--wave-r");
  };

  try {
    const transition = (document as ViewTransitionDocument).startViewTransition!(() => {
      /* Synchronously, so the new snapshot is the whole page in the new
         theme — the trigger's icon included — and not React's next tick. */
      flushSync(() => setThemeChoice(next));
    });
    transition.finished.then(clear, clear);
  } catch {
    clear();
    setThemeChoice(next);
  }
}
