import { useCallback, useEffect, useRef, useState, type AnimationEvent, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePublicPhone } from "@/components/nav/localBrowse";
import { stripLang } from "@/i18n/routing";

/*
 * The phone's push and pop between the help index and a topic (#803).
 *
 * The app has no route transition of its own to reuse: a page simply
 * replaces the one before. So this is small and lives where it is used. The
 * motion itself is `helpMotion.css` (the site's `--ease-settle` and
 * `--dur-fast`, `translate` and `opacity` only, phone only).
 *
 * How it works, and why it is shaped so
 * -------------------------------------
 * - Leaving: a tap on a help link first sets `data-help-motion="leave-push"`
 *   (or `leave-pop`), and the router goes `LEAVE_MS` later. A timer, never an
 *   animation event or a frame: `animationend` is not delivered when the
 *   animation is cut short, and this box's headless Chromium draws about one
 *   frame in forty seconds.
 * - Entering: the navigation carries `state.helpMotion`, and the new page
 *   mounts with `enter-push` or `enter-pop`. A page that was loaded directly,
 *   or reached by the browser's own back, has no state and plays nothing: the
 *   browser's gesture and the page's first paint are already their own motion,
 *   and a second "first appearing" would be a duplicate.
 * - Direction: toward the index or an earlier page is a pop, anything else a
 *   push. The CSS mirrors it for Hebrew.
 * - Settling: the enter state is cleared when the root's own `animationend`
 *   arrives, or `ENTER_MS` after mount, whichever is first (a timer, never a
 *   frame), so a later class change or re-render cannot replay it.
 * - Interruptible: a second tap while one is leaving goes at once, and the
 *   pending timer is dropped.
 * - Instant when it should be: a wide screen, `prefers-reduced-motion`,
 *   Pause motion, a modified click and a non-primary button are left alone.
 */

export const LEAVE_MS = 160;
/** A time-based fallback for clearing the enter state: --dur-fast (240ms) plus a margin. */
export const ENTER_MS = 400;

type Dir = "push" | "pop";
type State = `${"enter" | "leave"}-${Dir}` | null;

const idOf = (path: string): string | null | undefined => {
  const rest = /^\/help(?:\/([^/?#]+))?\/?$/.exec(path);
  return rest ? (rest[1] ?? null) : undefined;
};

function still(): boolean {
  if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  return document.body.classList.contains("motion-paused");
}

/**
 * @param current the page's own topic id, or null on the index
 * @param order the topic ids in reading order, to tell a push from a pop
 * @returns props to spread on the page's root element
 */
export function useHelpMotion(current: string | null, order: readonly string[]) {
  const phone = usePublicPhone();
  const navigate = useNavigate();
  const loc = useLocation();
  const enteredRaw = (loc.state as { helpMotion?: Dir } | null)?.helpMotion;
  /* The enter state is cleared once the animation is over (animationend, or ENTER_MS as a fallback), keyed to this navigation. */
  const [settled, setSettled] = useState<string | null>(null);
  const entered = settled === loc.key ? undefined : enteredRaw;
  /* Keyed to the address it was set on, so a page that stays mounted across the navigation (topic to topic) is not left leaving. */
  const [leave, setLeave] = useState<{ dir: Dir; at: string } | null>(null);
  const leaving = leave && leave.at === loc.pathname ? leave.dir : null;
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    if (!enteredRaw || !phone) return;
    const key = loc.key;
    const t = window.setTimeout(() => setSettled(key), ENTER_MS);
    return () => window.clearTimeout(t);
  }, [enteredRaw, phone, loc.key]);

  const onAnimationEnd = useCallback(
    (e: AnimationEvent<HTMLElement>) => {
      if (e.target === e.currentTarget) setSettled(loc.key);
    },
    [loc.key],
  );

  const onClickCapture = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (!phone || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest?.("a");
      const href = a?.getAttribute("href");
      if (!a || !href || a.target === "_blank" || a.hasAttribute("download")) return;
      const path = stripLang(href.split("#")[0].split("?")[0]);
      const target = idOf(path);
      if (target === undefined || (target === null && href.includes("#"))) return;
      const from = current === null ? -1 : order.indexOf(current);
      const dir: Dir = target === null || (current !== null && order.indexOf(target) < from) ? "pop" : "push";
      /* Interrupting: the second tap goes at once. */
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
        return;
      }
      if (still()) return;
      e.preventDefault();
      setLeave({ dir, at: loc.pathname });
      timer.current = window.setTimeout(() => {
        timer.current = null;
        navigate(path, { state: { helpMotion: dir } });
      }, LEAVE_MS);
    },
    [phone, current, order, navigate, loc.pathname],
  );

  const state: State = leaving ? `leave-${leaving}` : phone && entered ? `enter-${entered}` : null;
  return { "data-help-motion": state ?? undefined, onClickCapture, onAnimationEnd };
}
