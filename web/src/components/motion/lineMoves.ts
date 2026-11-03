/*
 * The living line's geometry, composed from moves (#191). No DOM in it.
 *
 * `LivingLine.tsx` measures boxes and reads each one's moves; this turns
 * them into one path and its scroll map. Kept apart so the three rules the
 * line lives under are held by a test without a browser (jsdom has no
 * layout): the path is continuous, its tangent is continuous (no corner
 * anywhere), and it never crosses a text box.
 *
 * MOVES ARE DATA
 * --------------
 * A station is a measured box and a list of moves, written in data beside
 * the content they belong to (`data/story.ts`, `data/site.ts`) and carried
 * to the DOM as JSON on `data-line`. The composer runs the stations in
 * document order and each move draws from the pen's current point. The
 * vocabulary:
 *
 *   origin         start here, at the box's centre (or its top); `dot`
 *                  marks the start with a dot. Only the first origin
 *                  starts the line; a later one is a turn to the centre.
 *   line-to        straight down a lane — `start`, `end`, `centre` of the
 *                  box, or `here` — to the box's foot (`until: "top"` for
 *                  its head, or a measured `y`). If the pen is in another
 *                  lane it turns there first, in the gap above the box.
 *   round          turn to a lane in circular arcs, in the gap above the
 *                  box (or, if the pen is already beside the box, within
 *                  the box's height). `line-to` and `circle-around` call it
 *                  themselves; written alone it moves the line without
 *                  running anywhere.
 *   enter          come in from the edge of the page (2026-11-03): the
 *                  box is full-bleed, so its sides are the page's edges.
 *                  The line starts `overhang` px off the `side` edge
 *                  (`start`, mirrored in a right-to-left page) on the
 *                  box's middle line, runs straight in across the page
 *                  and turns down into `lane` on a quarter circle of
 *                  radius `r`. It is the one move that does not start
 *                  heading down, which is why it can only be the first.
 *                  What it draws is the line's LEAD: drawn before the
 *                  scroll map starts, and uncovered instead by a soft
 *                  window from that edge (`LivingLine.module.css`), the
 *                  way the work run's aurora appears.
 *   circle-around  go once round the box: in down the circle's vertical
 *                  tangent, once round, out down the same tangent. `pad`
 *                  is the clearance; `side` picks the tangent (`near`, the
 *                  default, is the one nearer the pen). A `hold` box round
 *                  it — a principle round its figure — is spent straight
 *                  down that tangent, so the text beside it is never
 *                  crossed.
 *
 * Anything else can be added with `defineMove`; an unknown name runs down
 * the start lane, so content written before its move exists still draws a
 * line that keeps out of the text.
 *
 * THE ONE INVARIANT THAT MAKES IT SMOOTH
 * --------------------------------------
 * Every move starts and ends travelling straight down. Inside a move every
 * change of direction is a circular arc whose ends are tangent to what is
 * either side of it. So two moves always meet tangent to each other, and
 * the path has no corner anywhere — the owner's "never two hard cuts".
 *
 * A turn between lanes is the largest circle the gap allows: two arcs of
 * radius g/2 with a straight between them when the lanes are further apart
 * than the gap is tall, otherwise one S of two arcs and no straight at all.
 * The turn always sits in the gap between two boxes, and the gap is margin:
 * nothing in it is text.
 *
 * THE SCROLL MAP
 * --------------
 * The tip of the line sits on the middle of the window, so the composer
 * also says how much of the path is drawn by the time the middle reaches
 * each height. Length is not height (a turn is longer than its drop; a loop
 * is a circumference spent on one diameter), so every move hands over its
 * pieces with a span of height, and the length is linear inside each span:
 * a turn owns its own drop; a loop's way in and its circle share the
 * circle's height, so the circle is drawn while it crosses the middle.
 * `stops` samples that at `STOPS + 1` evenly spaced heights as dash offsets
 * on the path's normalised length.
 */

export type Box = { top: number; bottom: number; left: number; right: number };

/** A move as data: its name and its parameters. */
export type LineMove = { move: string; [param: string]: string | number | boolean | undefined };

export type Station = {
  box: Box;
  moves: readonly LineMove[];
  /** A taller box round this one whose height a loop spends on its tangent. */
  hold?: Box;
};

export type Lanes = { left: number; right: number };

export type ComposeOptions = {
  /** The centres of the two lanes, in px from the container's left. */
  lanes: Lanes;
  /** Logical lanes: `start` is the right-hand lane in a right-to-left page. */
  rtl?: boolean;
  /** Half the ribbon's width: the clearance every move keeps from a box. */
  half?: number;
};

export type Seg =
  | { kind: "L"; x0: number; y0: number; x1: number; y1: number }
  /** A circular arc, angles in radians on screen (y down), from a0 to a1. */
  | { kind: "A"; cx: number; cy: number; r: number; a0: number; a1: number };

type Piece = { segs: Seg[]; from: number; to: number };

export type Composition = {
  segs: Seg[];
  /** SVG path data, in the container's own pixels. */
  d: string;
  length: number;
  /** Every loop: centre and radius. */
  loops: { cx: number; cy: number; r: number }[];
  /** Dots to draw: an origin's mark. */
  dots: { x: number; y: number }[];
  /** The page edge an `enter` lead comes in from, if the line has one. */
  enter: "left" | "right" | null;
  /** The path's extent, for the drawing's box. */
  top: number;
  bottom: number;
  left: number;
  right: number;
  pieces: Piece[];
};

/** One keyframe percentage per stop: 0%, 1%, … 100%. */
export const STOPS = 100;

const DOWN = Math.PI / 2;
const TAU = Math.PI * 2;

/* ── segment geometry ──────────────────────────────────────────────────── */

export function segLength(s: Seg): number {
  return s.kind === "L" ? Math.hypot(s.x1 - s.x0, s.y1 - s.y0) : Math.abs(s.a1 - s.a0) * s.r;
}

export function segPoint(s: Seg, t: number): [number, number] {
  if (s.kind === "L") return [s.x0 + (s.x1 - s.x0) * t, s.y0 + (s.y1 - s.y0) * t];
  const a = s.a0 + (s.a1 - s.a0) * t;
  return [s.cx + s.r * Math.cos(a), s.cy + s.r * Math.sin(a)];
}

/** The unit direction of travel at t. */
export function segTangent(s: Seg, t: number): [number, number] {
  if (s.kind === "L") {
    const l = Math.hypot(s.x1 - s.x0, s.y1 - s.y0) || 1;
    return [(s.x1 - s.x0) / l, (s.y1 - s.y0) / l];
  }
  const a = s.a0 + (s.a1 - s.a0) * t;
  const k = Math.sign(s.a1 - s.a0) || 1;
  return [-Math.sin(a) * k, Math.cos(a) * k];
}

const fix = (n: number) => String(Math.round(n * 100) / 100);

function segD(s: Seg): string {
  if (s.kind === "L") return `L${fix(s.x1)} ${fix(s.y1)}`;
  /* An SVG arc cannot be a whole circle, so anything over a half is split. */
  const parts = Math.ceil(Math.abs(s.a1 - s.a0) / (Math.PI - 1e-6));
  const out: string[] = [];
  const sweep = s.a1 > s.a0 ? 1 : 0;
  for (let i = 1; i <= parts; i += 1) {
    const a = s.a0 + ((s.a1 - s.a0) * i) / parts;
    out.push(`A${fix(s.r)} ${fix(s.r)} 0 0 ${sweep} ${fix(s.cx + s.r * Math.cos(a))} ${fix(s.cy + s.r * Math.sin(a))}`);
  }
  return out.join(" ");
}

/* ── the pen and the registry ──────────────────────────────────────────── */

export type Pen = {
  /** Has the line started? Until it has, there is no point to draw from. */
  started: boolean;
  x: number;
  y: number;
  /** Direction of travel in radians on screen; DOWN between moves. */
  heading: number;
};

/** What a move is handed: the pen, the station, and the ways to draw. */
export type MoveContext = {
  pen: Readonly<Pen>;
  box: Box;
  hold?: Box;
  half: number;
  /** A lane name as a physical x: `start`, `end`, `centre` (of the box), `here`. */
  laneX(lane: unknown): number;
  /** Put the pen down here (only if the line has not started), heading down unless told otherwise. */
  start(x: number, y: number, dot?: boolean, heading?: number): void;
  /** Straight down to y. */
  down(y: number): void;
  /** Turn to x, travelling down, finished by `by`. */
  turn(x: number, by: number): void;
  /** Once round a circle whose vertical tangent the pen is on, heading down. */
  loop(r: number, cx: number, cy: number): void;
  /** Group what is drawn next into one span of the scroll map. */
  span(from: number, to: number, draw: () => void): void;
  /**
   * Run straight on along a horizontal heading and turn down onto x with a
   * quarter circle of radius r, drawn as the line's lead (before the scroll
   * map starts) and coming in from `edge`. Only for a pen just started
   * heading left or right.
   */
  enterTo(x: number, r: number, edge: "left" | "right"): void;
};

export type MoveImpl = (ctx: MoveContext, params: LineMove) => void;

const REGISTRY = new Map<string, MoveImpl>();

/**
 * Add a move to the vocabulary. The contract: it starts and ends heading
 * straight down, and it keeps `half` clear of every box it is not inside.
 */
export function defineMove(name: string, impl: MoveImpl): void {
  REGISTRY.set(name, impl);
}

export function moveNames(): string[] {
  return [...REGISTRY.keys()];
}

defineMove("origin", (c, m) => {
  const x = (c.box.left + c.box.right) / 2;
  const y = m.at === "top" ? c.box.top : (c.box.top + c.box.bottom) / 2;
  if (!c.pen.started) c.start(x, y, m.dot === true);
  else c.turn(x, y);
});

defineMove("enter", (c, m) => {
  const startIsLeft = c.laneX("start") <= c.laneX("end");
  const fromLeft = m.side === "end" ? !startIsLeft : startIsLeft;
  const over = typeof m.overhang === "number" ? m.overhang : 0;
  const y = (c.box.top + c.box.bottom) / 2;
  const x = c.laneX(m.lane ?? "start");
  const r = typeof m.r === "number" ? m.r : 24;
  if (c.pen.started) {
    /* Not first: there is no edge to come from, so it is a plain lane change. */
    c.turn(x, Math.max(c.pen.y, c.box.bottom));
    return;
  }
  c.start(fromLeft ? c.box.left - over : c.box.right + over, y, false, fromLeft ? 0 : Math.PI);
  c.enterTo(x, r, fromLeft ? "left" : "right");
});

defineMove("round", (c, m) => {
  const x = c.laneX(m.lane ?? "start");
  c.turn(x, c.pen.y < c.box.top ? c.box.top : c.box.bottom);
});

defineMove("line-to", (c, m) => {
  const x = c.laneX(m.lane ?? "start");
  const to = typeof m.y === "number" ? m.y : m.until === "top" ? c.box.top : c.box.bottom;
  if (!c.pen.started) c.start(x, Math.min(c.box.top, to));
  if (Math.abs(c.pen.x - x) > 0.5) c.turn(x, Math.max(c.pen.y, Math.min(c.box.top, to)));
  if (to > c.pen.y) c.down(to);
});

defineMove("circle-around", (c, m) => {
  const { box, hold, half } = c;
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  const pad = typeof m.pad === "number" ? m.pad : 0;
  const r = Math.max(box.right - box.left, box.bottom - box.top) / 2 + pad + half;
  const near = c.pen.started ? c.pen.x <= cx : true;
  const left = m.side === "start" ? c.laneX("start") < cx : m.side === "end" ? c.laneX("end") < cx : near;
  const jx = left ? cx - r : cx + r;
  const top = Math.min(cy - r - half, hold?.top ?? Infinity);
  const bottom = Math.max(cy + r + half, hold?.bottom ?? -Infinity);
  if (!c.pen.started) c.start(jx, top);
  else if (Math.abs(c.pen.x - jx) > 0.5) c.turn(jx, Math.max(c.pen.y, top));
  /* The way in and the circle share the circle's height. */
  c.span(c.pen.y, cy + r, () => {
    if (cy > c.pen.y) c.down(cy);
    c.loop(r, cx, cy);
  });
  c.down(bottom);
});

/* ── composing ─────────────────────────────────────────────────────────── */

export function compose(stations: readonly Station[], opts: ComposeOptions): Composition {
  const half = opts.half ?? 0;
  const pen: Pen = { started: false, x: 0, y: 0, heading: DOWN };
  const segs: Seg[] = [];
  const pieces: Piece[] = [];
  const loops: Composition["loops"] = [];
  const dots: Composition["dots"] = [];
  let parts: string[] = [];
  let enter: Composition["enter"] = null;
  /* Where the last span ended: every span starts at or below it, so the map is monotone. */
  let spanEnd = -Infinity;
  /* While a move groups its drawing into one span, segments collect here. */
  let group: Seg[] | null = null;

  const emit = (s: Seg) => {
    segs.push(s);
    parts.push(segD(s));
    const [x, y] = segPoint(s, 1);
    const [tx, ty] = segTangent(s, 1);
    pen.x = x;
    pen.y = y;
    pen.heading = Math.atan2(ty, tx);
    if (group) group.push(s);
    else {
      const ys = [s.kind === "L" ? s.y0 : s.cy - s.r, y];
      const from = Math.max(spanEnd, Math.min(...ys));
      const to = Math.max(from, y);
      pieces.push({ segs: [s], from, to });
      spanEnd = to;
    }
  };

  /* A turn of `delta` radians on a circle of radius r (positive: the heading's angle grows). */
  const arc = (r: number, delta: number) => {
    if (Math.abs(delta) < 1e-9 || r <= 0) return;
    const side = delta > 0 ? 1 : -1;
    const cx = pen.x + r * Math.cos(pen.heading + (side * Math.PI) / 2);
    const cy = pen.y + r * Math.sin(pen.heading + (side * Math.PI) / 2);
    const a0 = pen.heading - (side * Math.PI) / 2;
    emit({ kind: "A", cx, cy, r, a0, a1: a0 + delta });
  };

  const straight = (x: number, y: number) => {
    if (Math.hypot(x - pen.x, y - pen.y) < 1e-6) return;
    emit({ kind: "L", x0: pen.x, y0: pen.y, x1: x, y1: y });
  };

  const span = (from: number, to: number, draw: () => void) => {
    const outer = group;
    group = [];
    draw();
    const mine = group;
    group = outer;
    if (outer) {
      outer.push(...mine);
      return;
    }
    if (!mine.length) return;
    const f = Math.max(spanEnd, from);
    const t = Math.max(f, to);
    pieces.push({ segs: mine, from: f, to: t });
    spanEnd = t;
  };

  const ctx = (st: Station): MoveContext => {
    const { box, hold } = st;
    const laneX = (lane: unknown) => {
      if (lane === "centre" || lane === "center") return (box.left + box.right) / 2;
      if (lane === "here") return pen.x;
      if (typeof lane === "number") return lane;
      const left = (lane !== "end") !== !!opts.rtl;
      return left ? opts.lanes.left : opts.lanes.right;
    };
    return {
      pen,
      box,
      hold,
      half,
      laneX,
      start(x, y, dot, heading = DOWN) {
        if (pen.started) return;
        pen.started = true;
        pen.x = x;
        pen.y = y;
        pen.heading = heading;
        parts = [`M${fix(x)} ${fix(y)}`];
        spanEnd = y;
        if (dot) dots.push({ x, y });
      },
      down(y) {
        if (!pen.started || y <= pen.y) return;
        straight(pen.x, y);
      },
      turn(x, by) {
        if (!pen.started) return;
        const dx = x - pen.x;
        const w = Math.abs(dx);
        if (w < 0.5) return;
        /* The drop the turn may use: the room left above `by`, at least enough to be a curve. */
        const g = Math.max(by - pen.y, Math.min(w, 2 * half + 4), 2);
        const toward = dx > 0 ? -1 : 1; // heading angle shrinks to turn right on screen
        const y0 = pen.y;
        span(y0, y0 + g, () => {
          if (w <= g) {
            /* One S of two equal arcs, no straight. */
            const theta = 2 * Math.atan(w / g);
            const r = g / (2 * Math.sin(theta));
            arc(r, toward * theta);
            arc(r, -toward * theta);
          } else {
            /* Two quarter circles of the gap's half, and the straight between. */
            const r = g / 2;
            arc(r, (toward * Math.PI) / 2);
            straight(x - Math.sign(dx) * r, pen.y);
            arc(r, (-toward * Math.PI) / 2);
          }
        });
        /* Snap away float drift so the next move starts exactly in its lane, heading down. */
        pen.x = x;
        pen.heading = DOWN;
      },
      loop(r, cx, cy) {
        if (!pen.started) return;
        const fromLeft = pen.x < cx;
        arc(r, fromLeft ? -TAU : TAU);
        loops.push({ cx, cy, r });
        pen.heading = DOWN;
      },
      span,
      enterTo(x, r, edge) {
        if (!pen.started || segs.length) return;
        const dir = Math.sign(Math.cos(pen.heading)) || 1;
        const run = (x - pen.x) * dir;
        const rr = Math.max(0, Math.min(r, run));
        /* The lead: drawn before the clock starts, so it holds no span of
           height; the scroll map takes over from where it turns down. */
        const outer = group;
        group = [];
        straight(x - dir * rr, pen.y);
        arc(rr, dir * (Math.PI / 2));
        const mine = group;
        group = outer;
        if (mine.length) pieces.push({ segs: mine, from: -Infinity, to: -Infinity });
        spanEnd = Math.max(spanEnd, pen.y);
        enter = edge;
        pen.x = x;
        pen.heading = DOWN;
      },
    };
  };

  for (const st of stations) {
    const moves = st.moves.length ? st.moves : [{ move: "line-to" }];
    for (const m of moves) {
      const impl = REGISTRY.get(m.move) ?? REGISTRY.get("line-to")!;
      impl(ctx(st), m);
    }
  }

  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;
  for (const s of segs) {
    for (let i = 0; i <= 8; i += 1) {
      const [x, y] = segPoint(s, i / 8);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  if (!segs.length && pen.started) {
    top = bottom = pen.y;
    left = right = pen.x;
  }
  return {
    segs,
    d: pen.started ? parts.join(" ") : "",
    length: segs.reduce((n, s) => n + segLength(s), 0),
    loops,
    dots,
    enter,
    top: Number.isFinite(top) ? top : 0,
    bottom: Number.isFinite(bottom) ? bottom : 0,
    left: Number.isFinite(left) ? left : 0,
    right: Number.isFinite(right) ? right : 0,
    pieces,
  };
}

/**
 * Dash offsets (1 undrawn … 0 drawn) at `i / STOPS` of the way from `from`
 * to `to` — the drawing's box, top to foot.
 */
export function scrollStops(c: Composition, from: number, to: number): number[] {
  const lengths = c.pieces.map((p) => p.segs.reduce((n, s) => n + segLength(s), 0));
  const total = lengths.reduce((a, b) => a + b, 0);
  const drawnBy = (y: number) => {
    let done = 0;
    c.pieces.forEach((p, i) => {
      if (y >= p.to) done += lengths[i];
      else if (y > p.from) done += (lengths[i] * (y - p.from)) / (p.to - p.from);
    });
    return done;
  };
  return Array.from({ length: STOPS + 1 }, (_, i) => {
    if (total <= 0) return 0;
    const off = 1 - drawnBy(from + (i / STOPS) * (to - from)) / total;
    return Math.round(Math.min(1, Math.max(0, off)) * 1e4) / 1e4;
  });
}

/** Points along the path every `step` px, with the direction of travel. */
export type Sample = { x: number; y: number; tx: number; ty: number; s: number };

export function sample(segs: readonly Seg[], step = 4): Sample[] {
  const out: Sample[] = [];
  let s0 = 0;
  for (const seg of segs) {
    const len = segLength(seg);
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = out.length ? 1 : 0; i <= n; i += 1) {
      const t = i / n;
      const [x, y] = segPoint(seg, t);
      const [tx, ty] = segTangent(seg, t);
      out.push({ x, y, tx, ty, s: s0 + len * t });
    }
    s0 += len;
  }
  return out;
}

/** A legacy keyword or JSON on `data-line`, as moves. */
export function parseMoves(raw: string | undefined, pad?: number): LineMove[] {
  const v = (raw ?? "").trim();
  if (v === "start" || v === "end") return [{ move: "line-to", lane: v }];
  if (v === "loop") return [{ move: "circle-around", pad: pad ?? 0 }];
  if (v.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(v);
      if (Array.isArray(parsed)) {
        return parsed.filter((m): m is LineMove => !!m && typeof m === "object" && typeof (m as LineMove).move === "string");
      }
    } catch {
      /* Malformed data draws the default rather than nothing. */
    }
  }
  return [];
}

/** Moves as the `data-line` attribute carries them. */
export const lineAttr = (moves: readonly LineMove[]) => JSON.stringify(moves);
