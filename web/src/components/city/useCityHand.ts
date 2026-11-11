import { useEffect, type RefObject } from "react";
import { motionOff } from "@/hooks/motionOff";

/*
 * The city, answering to a hand.
 *
 * What this is, and what it is careful not to be
 * ----------------------------------------------
 * Two things a hand can do to the scene:
 *
 *   **turn it** — a sideways drag orbits the city about the point the camera
 *   is looking at. Let go and it coasts on the speed it was thrown with, then
 *   settles back to where the scroll put it. The scroll owns the camera; the
 *   hand only borrows it.
 *
 *   **read it** — pointing at a column (hover with a mouse, a tap with a
 *   finger, the arrow keys once the frame has focus) stands ONE shared
 *   tooltip over that object with its date and count, and lights it. One
 *   element, moved and rewritten; not 365 tooltips, and not 365 anything.
 *
 * Since #190 the keyboard reads too, and it does so through one focus stop
 * rather than 365: the frame takes focus, and the arrows rove between days
 * inside it. The scene and the tooltip stay `aria-hidden`; what a keyboard
 * reader hears is one polite status line, written only on keyboard moves.
 * Turning the city is still the pointer's alone — it is a closer look at the
 * same data, and the caption and the month table are still the full text
 * equivalent.
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

/** The tooltip's distance from its object, and from the frame's edges, in px. */
const TIP_GAP = 8;
const TIP_EDGE = 8;

/** Where a missed hit test looks next: the point itself, then 2px round it. */
const NEAR: [number, number][] = [
  [0, 0],
  [0, -2],
  [0, 2],
  [-2, 0],
  [2, 0],
];

/** The two languages the site is written for; anything else reads as English. */
type Lang = "en" | "he";

function langOf(): Lang {
  return document.documentElement.lang.toLowerCase().startsWith("he") ? "he" : "en";
}

const FORMAT: Record<Lang, { day: Intl.DateTimeFormat; num: Intl.NumberFormat; plural: Intl.PluralRules }> = {
  en: {
    day: new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
    num: new Intl.NumberFormat("en-GB"),
    plural: new Intl.PluralRules("en-GB"),
  },
  he: {
    day: new Intl.DateTimeFormat("he-IL", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
    num: new Intl.NumberFormat("he-IL"),
    plural: new Intl.PluralRules("he-IL"),
  },
};

/* Per plural category: how a count of contributions is said. */
const WORDS: Record<Lang, { none: string; one: string; two?: string; other: (n: string) => string }> = {
  en: { none: "no contributions", one: "1 contribution", other: (n) => `${n} contributions` },
  he: { none: "אין תרומות", one: "תרומה אחת", two: "שתי תרומות", other: (n) => `${n} תרומות` },
};

/**
 * What the tooltip says about one day: the date, then the count.
 *
 * UTC for the reason `cityPlan.ts` gives: the dates are calendar dates, and
 * printing one in the reader's zone moves it back a day west of Greenwich.
 * The language is the document's own (`nav/locale.ts` is the one place that
 * sets it), read at the moment of showing so a switch needs no re-render. A
 * day with nothing in it says so in words, because "0" under a flat tile
 * reads as a measurement nobody took.
 */
export function readoutText(date: string, count: number, lang: Lang = "en"): string {
  const f = FORMAT[lang];
  const w = WORDS[lang];
  const day = f.day.format(new Date(`${date}T00:00:00Z`));
  if (count === 0) return `${day} · ${w.none}`;
  const category = f.plural.select(count);
  const said =
    category === "one" ? w.one : category === "two" && w.two ? w.two : w.other(f.num.format(count));
  return `${day} · ${said}`;
}

/** The rubber band: linear to `SOFT`, then easing toward `HARD`. */
export function band(raw: number): number {
  const a = Math.abs(raw);
  if (a <= SOFT) return raw;
  const over = HARD - SOFT;
  return Math.sign(raw) * (SOFT + over * (1 - Math.exp(-(a - SOFT) / over)));
}

function stillness(): boolean {
  return motionOff();
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
  tipRef: RefObject<HTMLElement>,
  sayRef: RefObject<HTMLElement>,
  live: boolean,
) {
  useEffect(() => {
    const frame = frameRef.current;
    const orbit = orbitRef.current;
    const tip = tipRef.current;
    const say = sayRef.current;
    if (!live || !frame || !orbit || !tip || !say) return;

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

    /*
     * Stand the tooltip over the object it names.
     *
     * A cell's own box is its top face — the roof of a building, the tile of
     * a flat day; the walls are pseudo-elements and are not in it — and
     * `getBoundingClientRect` returns that face as projected through every
     * 3D transform above it. So "above the box, centred" is above the roof
     * as the reader sees it, at any tilt, turn or dolly. Physical `left`/`top`
     * because the rect is physical; the text inside still runs in the
     * document's direction. Clamped to the frame, and flipped below the
     * object when there is no room above it, so it is never cut by the
     * frame's clip. Out of flow, with `transform` only: no layout moves.
     */
    const place = (cell: HTMLElement) => {
      const f = frame.getBoundingClientRect();
      const c = cell.getBoundingClientRect();
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;
      const room = (lo: number, v: number, hi: number) => Math.max(lo, Math.min(v, hi));
      const x = room(TIP_EDGE, c.left + c.width / 2 - f.left - w / 2, f.width - w - TIP_EDGE);
      let y = c.top - f.top - TIP_GAP - h;
      if (y < TIP_EDGE) y = c.bottom - f.top + TIP_GAP;
      y = room(TIP_EDGE, y, f.height - h - TIP_EDGE);
      tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    };

    const show = (cell: HTMLElement | null, announce = false) => {
      if (cell === hot) return;
      hot?.removeAttribute("data-hot");
      hot = cell;
      if (cell) {
        cell.setAttribute("data-hot", "");
        const text = readoutText(cell.dataset.date ?? "", Number(cell.dataset.count), langOf());
        tip.textContent = text;
        frame.dataset.reading = "";
        place(cell);
        /* Only the keyboard is spoken to: a mouse crossing forty columns is
           forty announcements nobody asked for. */
        if (announce) say.textContent = text;
      } else {
        tip.textContent = "";
        delete frame.dataset.reading;
      }
    };

    /*
     * The keyboard's way in: ONE focus stop, the frame, and the arrows move
     * between days inside it — the grid pattern's roving reading rather than
     * 365 stops queued in front of the table. Up and down are the day before
     * and after (a week is a column of seven), left and right a week, and
     * those two swap in a right-to-left document because the grid itself
     * runs the other way there. Home and End are the first and last day;
     * Escape puts the tooltip away.
     */
    const days = () => Array.from(frame.querySelectorAll<HTMLElement>("[data-date]"));

    const key = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const list = days();
      if (list.length === 0) return;
      const at = hot ? list.indexOf(hot) : -1;
      const rtl = getComputedStyle(frame).direction === "rtl";
      let next: number;
      switch (e.key) {
        case "ArrowUp":
          next = at - 1;
          break;
        case "ArrowDown":
          next = at + 1;
          break;
        case "ArrowLeft":
          next = at + (rtl ? 7 : -7);
          break;
        case "ArrowRight":
          next = at + (rtl ? -7 : 7);
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = list.length - 1;
          break;
        case "Escape":
          if (hot) {
            e.preventDefault();
            show(null);
          }
          return;
        case " ":
        case "PageUp":
        case "PageDown":
          /* The page is about to scroll under a tooltip pinned to where
             its column was. */
          show(null);
          return;
        default:
          return;
      }
      e.preventDefault();
      if (at < 0) next = list.length - 1;
      show(list[Math.max(0, Math.min(list.length - 1, next))], true);
    };

    /* Arriving by Tab reads today, so the first thing focus shows is a day
       and not an instruction. A click also focuses the frame, and that is
       the pointer's business, so only a visible focus reads. */
    const focus = () => {
      if (!hot && frame.matches(":focus-visible")) {
        const list = days();
        show(list[list.length - 1] ?? null, true);
      }
    };

    const blur = () => show(null);

    /*
     * A wheel scrolls the page, and the scroll moves the scene under a
     * still pointer; the tooltip would be left naming a column that has
     * slid away. So a wheel puts it away and the next movement reads
     * again. This is an input event on the frame, not a scroll listener.
     */
    const wheel = () => {
      hover = null;
      show(null);
    };

    /*
     * Which column is under a point. `elementFromPoint` hit-tests through the
     * 3D transforms, so this is the column the reader is looking at, walls
     * included — a wall is the cell's own `::after` and hits as the cell.
     */
    const hit = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      const cell = el instanceof HTMLElement ? el.closest<HTMLElement>("[data-date]") : null;
      return cell && frame.contains(cell) ? cell : null;
    };
    /*
     * On a phone at the span, a tilted roof is a sliver two or three pixels
     * tall and the gap between two of them is a pixel; a point that lands in
     * the gap would read nothing. So a miss looks a few pixels either way
     * before giving up — never further than half a cell, so the answer is
     * still the object under the finger and not a guess. Measured with real
     * pointer moves at 390x844 (#190).
     */
    const cellAt = (x: number, y: number) => {
      for (const [dx, dy] of NEAR) {
        const cell = hit(x + dx, y + dy);
        if (cell) return cell;
      }
      return null;
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
    frame.addEventListener("keydown", key);
    frame.addEventListener("focus", focus);
    frame.addEventListener("blur", blur);
    frame.addEventListener("wheel", wheel, { passive: true });
    return () => {
      frame.removeEventListener("pointerdown", down);
      frame.removeEventListener("pointermove", move);
      frame.removeEventListener("pointerup", up);
      frame.removeEventListener("pointercancel", cancel);
      frame.removeEventListener("pointerleave", leave);
      frame.removeEventListener("keydown", key);
      frame.removeEventListener("focus", focus);
      frame.removeEventListener("blur", blur);
      frame.removeEventListener("wheel", wheel);
      cancelAnimationFrame(loop);
      cancelAnimationFrame(hoverLoop);
      show(null);
      say.textContent = "";
      orbit.style.transform = "";
      delete frame.dataset.side;
      delete frame.dataset.turning;
    };
  }, [frameRef, orbitRef, tipRef, sayRef, live]);
}
