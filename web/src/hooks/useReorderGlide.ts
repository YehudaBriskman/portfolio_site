import { useLayoutEffect, useRef, type RefObject } from "react";
import { EXIT_KEEP_MS, usePhoneMotion } from "@/hooks/usePhoneMotion";

/*
 * FLIP for a list that reorders in place, on a phone with motion allowed.
 *
 * The caller's state has already changed (the order is right at once). After
 * the render, each row whose content moved is drawn where its content WAS and
 * glides to its slot with a transform; the row that was moved settles with a
 * small lift. The animation is the Web Animations API: it never touches the
 * DOM's final state, and a hard timer cancels it, so rows are at rest whatever
 * the browser did with it. Without `Element.animate`, or without motion, the
 * move is simply instant.
 *
 * `note(from, to)` before the state change tells the hook which move this is
 * (rows are keyed by position, so the content of a row is what moves).
 */
const GLIDE_MS = 220;

/** The old position of the content now at `i`, after moving the item at `from` to `to`. */
export function oldIndex(i: number, from: number, to: number): number {
  if (i === to) return from;
  if (from < to) return i >= from && i < to ? i + 1 : i;
  return i > to && i <= from ? i - 1 : i;
}

export function useReorderGlide(root: RefObject<HTMLElement | null>): (from: number, to: number) => void {
  const motion = usePhoneMotion();
  const tops = useRef<number[]>([]);
  const pending = useRef<{ from: number; to: number } | null>(null);

  useLayoutEffect(() => {
    const rows = root.current ? ([...root.current.children] as HTMLElement[]) : [];
    const now = rows.map((r) => r.getBoundingClientRect().top);
    const p = pending.current;
    pending.current = null;
    if (p && motion && rows.length > 0 && typeof rows[0].animate === "function") {
      const running: Array<{ cancel: () => void }> = [];
      rows.forEach((row, i) => {
        const was = tops.current[oldIndex(i, p.from, p.to)];
        if (was === undefined) return;
        const d = was - now[i];
        if (!d) return;
        const lift = i === p.to ? " scale(1.02)" : "";
        running.push(
          row.animate(
            [{ transform: `translateY(${d}px)${lift}` }, { transform: "none" }],
            { duration: GLIDE_MS, easing: "cubic-bezier(.2, 0, 0, 1)" },
          ),
        );
      });
      if (running.length > 0) {
        // Not cleared on the next render: cancel() on a finished animation is harmless, a lost timer is not.
        setTimeout(() => running.forEach((a) => a.cancel()), Math.max(EXIT_KEEP_MS, GLIDE_MS + 100));
      }
    }
    tops.current = now;
  });

  return (from, to) => {
    pending.current = { from, to };
  };
}
