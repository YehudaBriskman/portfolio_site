import { useEffect, useRef } from "react";

/*
 * Leans an element in 3D toward the pointer, anywhere on the page.
 *
 * A flat rectangle beside a moving page reads as a screenshot. Leaning it
 * toward the cursor makes it an object sitting in the page rather than a
 * picture pasted onto it. The pointer does not have to be over the element:
 * the effect falls off with distance, which is what makes the thing feel like
 * it is tracking you across the page rather than reacting to being touched.
 *
 * The rotation is written to custom properties rather than to `transform`
 * directly, so the stylesheet keeps control of how they compose. That is what
 * lets the CSS add them to a resting pose instead of treating square-to-the-
 * viewer as the neutral position — and what lets a media query flatten the
 * whole thing without the hook knowing anything about viewport width.
 */
export function useTilt<T extends HTMLElement>({
  /* Maximum rotation in degrees at the far edge. */
  max = 7,
  /* How far outside the element the pointer still has an effect, in pixels. */
  reach = 320,
}: { max?: number; reach?: number } = {}) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /*
     * The matchMedia logic is duplicated from usePrefersReducedMotion rather
     * than reused, deliberately. That hook returns a state value, so the
     * preference arrives through a re-render — but this is read inside a
     * requestAnimationFrame callback that must never cause one, and a state
     * dependency would tear down and re-register every listener below each
     * time it flipped. It is also read defensively: jsdom has no matchMedia,
     * and a hook that throws at mount cannot be tested at all.
     */
    const query =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;

    let frame = 0;
    /* The last known pointer position, kept so the lean can be recomputed when
       the element moves underneath a stationary cursor. */
    let pointer: { x: number; y: number } | null = null;

    const clear = () => {
      el.style.removeProperty("--tilt-x");
      el.style.removeProperty("--tilt-y");
    };

    const apply = () => {
      frame = 0;
      if (!pointer) return;
      /* Read on every frame rather than captured once at mount: the preference
         can change while the page is open, and a lean left frozen mid-rotation
         is exactly what someone asking for less motion did not want. */
      if (query?.matches === true) {
        clear();
        return;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;

      /* -1 .. 1 across the element, continuing past its edges so the lean eases
         off with distance rather than snapping to neutral at the boundary. */
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (pointer.x - cx) / (rect.width / 2 + reach);
      const dy = (pointer.y - cy) / (rect.height / 2 + reach);

      const clamp = (v: number) => Math.max(-1, Math.min(1, v));

      /* Y rotation follows horizontal travel, X rotation follows vertical, and
         X is inverted: pointer above the centre should tip the top away. */
      el.style.setProperty("--tilt-y", `${(clamp(dx) * max).toFixed(2)}deg`);
      el.style.setProperty("--tilt-x", `${(-clamp(dy) * max).toFixed(2)}deg`);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onPointerMove = (event: PointerEvent) => {
      /* Keyed off the event rather than a `(pointer: fine)` media query. The
         query describes the *primary* input, so a laptop with a touchscreen can
         report coarse while being driven by a mouse — and on a touch device
         pointermove fires throughout a scroll, which would lean the surface as
         the page moved under the finger. */
      if (event.pointerType !== "mouse") return;

      pointer = { x: event.clientX, y: event.clientY };
      /* Coalesced to one write per frame. Writing a style on every pointer
         event is several writes a frame on a high-polling mouse, and each one
         invalidates style for everything reading the property. */
      schedule();
    };

    /*
     * The element moves even when the pointer does not.
     *
     * Scrolling or resizing changes where the surface sits relative to a
     * stationary cursor, so a lean computed once is wrong immediately after.
     * Listening for pointer movement alone leaves the element frozen mid-lean
     * as the page travels past it.
     */
    const onViewportChange = () => {
      if (pointer) schedule();
    };

    const reset = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      pointer = null;
      clear();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onViewportChange, { passive: true });
    window.addEventListener("resize", onViewportChange, { passive: true });
    /* Leaving the window and leaving the document are different events and
       neither implies the other: alt-tabbing away fires blur with the cursor
       still logically inside, and sliding off the top edge fires pointerleave
       while the window keeps focus. Both must land back at rest. */
    window.addEventListener("blur", reset);
    document.addEventListener("pointerleave", reset);
    query?.addEventListener("change", reset);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onViewportChange);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("blur", reset);
      document.removeEventListener("pointerleave", reset);
      query?.removeEventListener("change", reset);
    };
  }, [max, reach]);

  return ref;
}
