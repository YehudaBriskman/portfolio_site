import { useEffect, type RefObject } from "react";

/*
 * The city, answering to a hand.
 *
 * What this is, and what it is careful not to be
 * ----------------------------------------------
 * Two things a pointer can do to the scene, and nothing a keyboard can:
 *
 *   **turn it** — a sideways drag orbits the city about the point the camera
 *   is looking at. Let go and it coasts on the speed it was thrown with, then
 *   settles back to where the scroll put it. The scroll owns the camera; the
 *   hand only borrows it.
 *
 *   **read it** — pointing at a column (hover with a mouse, a tap with a
 *   finger) writes that day and its count into ONE shared readout in the
 *   frame's corner, and lights the column. One element, rewritten; not 365
 *   tooltips, and not 365 anything.
 *
 * Neither is a focus stop, and that is the argument at the top of
 * `ContributionCity.tsx` kept rather than broken. The scene is still
 * `aria-hidden`, the readout is `aria-hidden` with it, and nothing here adds
 * a `tabindex`: the keyboard and screen-reader path is the caption and the
 * month table, exactly as before. What the pointer gets is a closer look at
 * a drawing whose content already has a text equivalent — the same footing
 * a zoomable map has beside its address.
 *
 * The gesture split, and why it is decided by the browser first
 * -------------------------------------------------------------
 * A phone reader scrolls the page with a vertical swipe, and that must keep
 * working with a finger that happens to land on the city. So the frame is
 * `touch-action: pan-y`: the browser keeps every vertical pan for itself and
 * hands this file only what is left — horizontal travel and taps. A vertical
 * swipe never reaches the handlers below at all; it arrives as a
 * `pointercancel` the moment the browser claims it, which is the cleanest
 * possible "not ours".
 *
 * A mouse has no `touch-action`, so the same split is made here by hand:
 * nothing happens until the pointer has travelled `SLOP` px, and then it is a
 * turn only if the travel is mostly sideways. A drag that starts vertical is
 * dropped, and a press that never travels is a tap.
 *
 * What this costs per frame, and §7 of the motion contract
 * --------------------------------------------------------
 * §7 says no motion component on the page has a scroll listener or a
 * requestAnimationFrame loop. This file has no scroll listener — the scroll
 * half of the act is still pure CSS, on the compositor — and it has a rAF
 * loop that exists ONLY between a release and the moment the city comes to
 * rest, about a second, and only after a reader threw it. A mouse hover is
 * coalesced into at most one hit test per frame while the pointer is moving
 * and none when it is not. Nothing in here runs because the page scrolled.
 *
 * Every write is to one element's inline `transform`, or one attribute on
 * one cell, or one text node. No React state: a re-render of this component
 * re-renders 371 spans, and a hover is not worth that.
 *
 * The off-switches
 * ----------------
 * Under reduced motion or Pause the drag still turns the city — that is the
 * reader's own hand moving it, which is direct manipulation and not motion
 * the page started — but nothing moves after the hand lets go: no coast and
 * no settle. The city stays where it was put. The check is made at release
 * time rather than at mount, because Pause is a toggle a reader can flip with
 * the city in view.
 */

/** How far a sideways drag turns the city, in degrees per CSS pixel. */
const DEG_PER_PX = 0.3;

/**
 * The turn's soft and hard limits, in degrees either side of the scroll's
 * own angle.
 *
 * Past `SOFT` the drag meets resistance (a rubber band, asymptotic to
 * `HARD`), so the city can be turned far enough to see the walls swing round
 * and never so far that the year's left-to-right axis — the thing a reader
 * follows across a calendar — stands on its end.
 */
const SOFT = 30;
const HARD = 48;

/** Travel, in px, before a press is a drag rather than a tap. */
const SLOP = 8;

/*
 * The settle: a damped spring back to zero offset.
 *
 * ω = 7 rad/s and ζ = 0.85 — slightly under critical damping, so a throw
 * coasts outward, turns, and comes home without a visible overshoot. It is a
 * spring rather than an ease because it has to start from whatever speed the
 * hand left it with, and an ease has no input for that.
 */
const OMEGA = 7;
const ZETA = 0.85;
const MAX_SPEED = 260; // deg/s, so a flick cannot spin the year round

/** Within this, the city is at rest and the loop stops. */
const REST_OFFSET = 0.02;
const REST_SPEED = 0.2;

const WEEKDAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * What the shared readout says about one day.
 *
 * UTC for the reason `cityPlan.ts` gives: the dates are calendar dates, and
 * printing one in the reader's zone moves it back a day west of Greenwich.
 */
export function readoutText(date: string, count: number): string {
  const day = WEEKDAY.format(new Date(`${date}T00:00:00Z`));
  if (count === 0) return `${day} · nothing`;
  return `${day} · ${count.toLocaleString("en-GB")} contribution${count === 1 ? "" : "s"}`;
}

/** The rubber band: linear to `SOFT`, then easing toward `HARD`. */
export function band(raw: number): number {
  const a = Math.abs(raw);
  if (a <= SOFT) return raw;
  const over = HARD - SOFT;
  return Math.sign(raw) * (SOFT + over * (1 - Math.exp(-(a - SOFT) / over)));
}

function stillness(): boolean {
  if (document.body.classList.contains("motion-paused")) return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

type Gesture = {
  id: number;
  x0: number;
  y0: number;
  /** The offset the city was at when the press landed. */
  from: number;
  mode: "undecided" | "turn";
  /** Recent (time, x) pairs, for the release speed. */
  trail: [number, number][];
};

export function useCityHand(
  frameRef: RefObject<HTMLElement>,
  orbitRef: RefObject<HTMLElement>,
  readingRef: RefObject<HTMLElement>,
  live: boolean,
) {
  useEffect(() => {
    const frame = frameRef.current;
    const orbit = orbitRef.current;
    const reading = readingRef.current;
    if (!live || !frame || !orbit || !reading) return;

    /*
     * The scroll's own turn, read once. The side walls are drawn on one side
     * of each column only (see `::before` in the stylesheet), and which side
     * faces the camera is the sign of the TOTAL turn — the scroll's angle
     * plus the hand's. This is the only number from the stylesheet the
     * script needs, and it is a constant there.
     */
    const base = parseFloat(getComputedStyle(frame).getPropertyValue("--city-turn")) || 0;

    let offset = 0;
    let speed = 0;
    let loop = 0;
    let then = 0;
    let gesture: Gesture | null = null;
    let hot: HTMLElement | null = null;
    let hover: { x: number; y: number } | null = null;
    let hoverLoop = 0;

    const paint = () => {
      orbit.style.transform = offset === 0 ? "" : `rotateZ(${offset.toFixed(3)}deg)`;
      const side = base + offset > 0 ? "left" : "right";
      if (frame.dataset.side !== side) frame.dataset.side = side;
    };

    const show = (cell: HTMLElement | null) => {
      if (cell === hot) return;
      hot?.removeAttribute("data-hot");
      hot = cell;
      if (cell) {
        cell.setAttribute("data-hot", "");
        reading.textContent = readoutText(cell.dataset.date ?? "", Number(cell.dataset.count));
        frame.dataset.reading = "";
      } else {
        reading.textContent = "";
        delete frame.dataset.reading;
      }
    };

    /*
     * Which column is under a point. `elementFromPoint` hit-tests through the
     * 3D transforms, so this is the column the reader is looking at, walls
     * included — a wall is the cell's own `::after` and hits as the cell.
     */
    const cellAt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      const cell = el instanceof HTMLElement ? el.closest<HTMLElement>("[data-date]") : null;
      return cell && frame.contains(cell) ? cell : null;
    };

    const settle = (now: number) => {
      const dt = Math.min(0.032, (now - then) / 1000);
      then = now;
      const pull = -OMEGA * OMEGA * offset - 2 * ZETA * OMEGA * speed;
      speed += pull * dt;
      offset += speed * dt;
      if (Math.abs(offset) < REST_OFFSET && Math.abs(speed) < REST_SPEED) {
        offset = 0;
        speed = 0;
        loop = 0;
        paint();
        return;
      }
      paint();
      loop = requestAnimationFrame(settle);
    };

    const release = (g: Gesture) => {
      const now = performance.now();
      const recent = g.trail.filter(([t]) => now - t < 100);
      if (recent.length >= 2) {
        const [t0, x0] = recent[0];
        const [t1, x1] = recent[recent.length - 1];
        const v = t1 > t0 ? ((x1 - x0) / (t1 - t0)) * 1000 * DEG_PER_PX : 0;
        speed = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, v));
      } else {
        speed = 0;
      }
      if (stillness()) {
        speed = 0;
        return;
      }
      then = now;
      cancelAnimationFrame(loop);
      loop = requestAnimationFrame(settle);
    };

    const down = (e: PointerEvent) => {
      if (e.button !== 0 || gesture) return;
      /* Catching a coasting city stops it where it is, like a hand would. */
      cancelAnimationFrame(loop);
      loop = 0;
      speed = 0;
      gesture = { id: e.pointerId, x0: e.clientX, y0: e.clientY, from: offset, mode: "undecided", trail: [[e.timeStamp, e.clientX]] };
    };

    const move = (e: PointerEvent) => {
      if (gesture && e.pointerId === gesture.id) {
        const dx = e.clientX - gesture.x0;
        const dy = e.clientY - gesture.y0;
        if (gesture.mode === "undecided") {
          if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
          if (Math.abs(dx) <= Math.abs(dy)) {
            /* Mostly vertical: not ours. On touch the browser has already
               taken it as a scroll; on a mouse it is simply dropped. */
            gesture = null;
            return;
          }
          gesture.mode = "turn";
          frame.setPointerCapture?.(e.pointerId);
          frame.dataset.turning = "";
          show(null);
        }
        gesture.trail.push([e.timeStamp, e.clientX]);
        if (gesture.trail.length > 8) gesture.trail.shift();
        offset = band(gesture.from + dx * DEG_PER_PX);
        paint();
        return;
      }
      /* A mouse with no button down: hover reads a column, once a frame. */
      if (e.pointerType === "mouse" && !gesture) {
        hover = { x: e.clientX, y: e.clientY };
        if (!hoverLoop) {
          hoverLoop = requestAnimationFrame(() => {
            hoverLoop = 0;
            if (hover) show(cellAt(hover.x, hover.y));
          });
        }
      }
    };

    const up = (e: PointerEvent) => {
      if (!gesture || e.pointerId !== gesture.id) return;
      const g = gesture;
      gesture = null;
      delete frame.dataset.turning;
      if (g.mode === "turn") {
        frame.releasePointerCapture?.(e.pointerId);
        release(g);
      } else {
        /* A tap: read the column under it, or clear the readout if there is
           none — tapping the ground is how a finger says "put that away". */
        show(cellAt(e.clientX, e.clientY));
      }
    };

    const cancel = (e: PointerEvent) => {
      if (!gesture || e.pointerId !== gesture.id) return;
      const g = gesture;
      gesture = null;
      delete frame.dataset.turning;
      if (g.mode === "turn") release(g);
    };

    const leave = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || gesture) return;
      hover = null;
      show(null);
    };

    paint();
    frame.addEventListener("pointerdown", down);
    frame.addEventListener("pointermove", move);
    frame.addEventListener("pointerup", up);
    frame.addEventListener("pointercancel", cancel);
    frame.addEventListener("pointerleave", leave);
    return () => {
      frame.removeEventListener("pointerdown", down);
      frame.removeEventListener("pointermove", move);
      frame.removeEventListener("pointerup", up);
      frame.removeEventListener("pointercancel", cancel);
      frame.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(loop);
      cancelAnimationFrame(hoverLoop);
      show(null);
      orbit.style.transform = "";
      delete frame.dataset.side;
      delete frame.dataset.turning;
    };
  }, [frameRef, orbitRef, readingRef, live]);
}
