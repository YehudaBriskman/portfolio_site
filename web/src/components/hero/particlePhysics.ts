/*
 * The hero word's physics: pure, allocation-free in the step, no DOM.
 *
 * Model. Each particle is a unit mass on a damped spring to its rest point,
 *
 *     a = K (target - p) - C v + F_pointer(p)
 *
 * integrated with semi-implicit (symplectic) Euler at a FIXED step of 1/120 s
 * with an accumulator, so the motion is identical at 60 and 144 Hz and a long
 * frame cannot blow the spring up. Stability needs omega * dt < 2 with
 * omega = sqrt(K); K = 90 gives omega = 9.5 and omega*dt = 0.08.
 * C = 2 zeta sqrt(K) with zeta = 0.62: a single soft overshoot, settled in
 * about half a second, which is what reads as "liquid" rather than "rubber".
 *
 * The pointer force is a radial push with a smooth quadratic falloff,
 *
 *     F = S (1 - d/R)^2 r_hat,   d < R
 *
 * (r_hat away from the pointer). The quadratic is zero in value AND slope at
 * d = R, so a particle entering or leaving the radius feels no jerk. The
 * particles flow AROUND the cursor because the spring still pulls them home
 * while the push holds them off: they slide round the rim of the void.
 * A tangential "swirl" term was tried and removed: it is not the gradient of
 * any potential, so it pumps energy and a still pointer kept 17 of 200
 * particles circling at ~150 px/s for ever (measured), which a loop that must
 * stop at rest cannot have. A central force plus damping always settles.
 * S = PUSH K R (PUSH 2.4) makes the static displacement of a particle at the centre well beyond R,
 * which it cannot hold (it leaves the radius), so they slide out and the
 * spring brings them home when the pointer goes.
 *
 * AT REST. The loop that calls `step` stops when `step` reports no
 * movement: every particle's speed under SPEED_EPS and, with the pointer
 * gone, every particle within POS_EPS of its target, and the entrance over. `settle`
 * then snaps to the targets, so a stopped word is exactly the sampled word.
 */

export const K = 90;
export const ZETA = 0.62;
export const C = 2 * ZETA * Math.sqrt(K);
export const FIXED_DT = 1 / 120;
export const MAX_FRAME = 0.05;
export const SPEED_EPS = 3; // px/s
export const POS_EPS = 0.12; // px
export const PUSH = 2.4;

export type Pointer = { x: number; y: number; active: boolean };

export type Particles = {
  count: number;
  /* position, velocity, rest */
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  tx: Float32Array;
  ty: Float32Array;
  /* entrance: start, bezier control, delay and duration (seconds) */
  sx: Float32Array;
  sy: Float32Array;
  cx: Float32Array;
  cy: Float32Array;
  delay: Float32Array;
  dur: Float32Array;
  /* colour group, for batching the draw */
  group: Uint8Array;
  /* seconds since the entrance began; Infinity once there is none */
  clock: number;
  /* the pointer's reach, px */
  radius: number;
  /* leftover simulated time between frames */
  acc: number;
};

export function createParticles(count: number): Particles {
  const f = () => new Float32Array(count);
  return {
    count,
    x: f(), y: f(), vx: f(), vy: f(), tx: f(), ty: f(),
    sx: f(), sy: f(), cx: f(), cy: f(), delay: f(), dur: f(),
    group: new Uint8Array(count),
    clock: Infinity,
    radius: 100,
    acc: 0,
  };
}

/** Every particle exactly on its rest point, still. */
export function settle(p: Particles): void {
  for (let i = 0; i < p.count; i += 1) {
    p.x[i] = p.tx[i];
    p.y[i] = p.ty[i];
    p.vx[i] = 0;
    p.vy[i] = 0;
  }
  p.clock = Infinity;
  p.acc = 0;
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** The longest an entrance can take: the latest delay plus its duration. */
export function entranceLength(p: Particles): number {
  let m = 0;
  for (let i = 0; i < p.count; i += 1) m = Math.max(m, p.delay[i] + p.dur[i]);
  return m;
}

/**
 * Lay out an entrance: each particle starts beyond the left or right edge of
 * the section (`left` and `right` are x coordinates beyond it), on the side
 * its rest point is nearer to (one in six crosses over, so the two streams
 * weave), and follows a quadratic bezier whose control point is pushed off
 * the straight line by 15-45% of its length, so every path is a curve.
 * Start heights spread +-`spread` px about the rest point (the caller passes
 * a share of the canvas band so no one starts clipped by its top or bottom).
 * Delays are 0-0.5 s, durations 1.1-1.3 s: nothing runs past 1.8 s.
 */
export function planEntrance(p: Particles, left: number, right: number, midX: number, rand: () => number, spread = 160): void {
  for (let i = 0; i < p.count; i += 1) {
    const fromLeft = (p.tx[i] < midX) !== (rand() < 1 / 6);
    const sx = fromLeft ? left - rand() * 120 : right + rand() * 120;
    const sy = p.ty[i] + (rand() - 0.5) * 2 * spread;
    p.sx[i] = sx;
    p.sy[i] = sy;
    const dx = p.tx[i] - sx;
    const dy = p.ty[i] - sy;
    const bend = (0.15 + rand() * 0.3) * (rand() < 0.5 ? -1 : 1);
    p.cx[i] = sx + dx * 0.5 - dy * bend;
    p.cy[i] = sy + dy * 0.5 + dx * bend;
    /* Staggered by how far from the edge the rest point is, plus a little
       noise, so the word assembles outside-in rather than all at once. */
    const edge = fromLeft ? p.tx[i] - left : right - p.tx[i];
    const span = Math.max(1, right - left);
    p.delay[i] = Math.min(0.5, (edge / span) * 0.6 + rand() * 0.1);
    p.dur[i] = 1.1 + rand() * 0.2;
    p.x[i] = sx;
    p.y[i] = sy;
    p.vx[i] = 0;
    p.vy[i] = 0;
  }
  p.clock = 0;
  p.acc = 0;
}

/** An impulse out from (x, y): a click's burst. */
export function burst(p: Particles, x: number, y: number, strength: number): void {
  const reach = p.radius * 1.6;
  for (let i = 0; i < p.count; i += 1) {
    const dx = p.x[i] - x;
    const dy = p.y[i] - y;
    const d = Math.hypot(dx, dy);
    if (d >= reach) continue;
    const f = (1 - d / reach) ** 2 * strength;
    const inv = d > 0.001 ? 1 / d : 0;
    p.vx[i] += (inv ? dx * inv : 1) * f;
    p.vy[i] += (inv ? dy * inv : 0) * f;
  }
}

/** The physics, one fixed step. Returns nothing: `moving` judges rest. */
function substep(p: Particles, ptr: Pointer, dt: number): void {
  const R = p.radius;
  const R2 = R * R;
  const S = PUSH * K * R;
  for (let i = 0; i < p.count; i += 1) {
    let ax = K * (p.tx[i] - p.x[i]) - C * p.vx[i];
    let ay = K * (p.ty[i] - p.y[i]) - C * p.vy[i];
    if (ptr.active) {
      const dx = p.x[i] - ptr.x;
      const dy = p.y[i] - ptr.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < R2) {
        const d = Math.sqrt(d2);
        const f = (1 - d / R) ** 2 * S;
        const rx = d > 0.001 ? dx / d : 1;
        const ry = d > 0.001 ? dy / d : 0;
        ax += f * rx;
        ay += f * ry;
      }
    }
    p.vx[i] += ax * dt;
    p.vy[i] += ay * dt;
    p.x[i] += p.vx[i] * dt;
    p.y[i] += p.vy[i] * dt;
  }
}

/** Positions of the entrance at the current clock; hands over to the spring. */
function entering(p: Particles): boolean {
  let any = false;
  const t = p.clock;
  for (let i = 0; i < p.count; i += 1) {
    const u = (t - p.delay[i]) / p.dur[i];
    if (u >= 1) continue;
    any = true;
    if (u <= 0) {
      p.x[i] = p.sx[i];
      p.y[i] = p.sy[i];
      continue;
    }
    const e = easeOutCubic(u);
    const m = 1 - e;
    p.x[i] = m * m * p.sx[i] + 2 * m * e * p.cx[i] + e * e * p.tx[i];
    p.y[i] = m * m * p.sy[i] + 2 * m * e * p.cy[i] + e * e * p.ty[i];
  }
  return any;
}

/** True while any particle is faster than SPEED_EPS. */
export function fast(p: Particles): boolean {
  for (let i = 0; i < p.count; i += 1) {
    if (Math.abs(p.vx[i]) > SPEED_EPS || Math.abs(p.vy[i]) > SPEED_EPS) return true;
  }
  return false;
}

/** True while anything is off its rest point or still moving. */
export function moving(p: Particles): boolean {
  for (let i = 0; i < p.count; i += 1) {
    if (Math.abs(p.vx[i]) > SPEED_EPS || Math.abs(p.vy[i]) > SPEED_EPS) return true;
    if (Math.abs(p.x[i] - p.tx[i]) > POS_EPS || Math.abs(p.y[i] - p.ty[i]) > POS_EPS) return true;
  }
  return false;
}

/**
 * Advance by `frame` seconds (wall clock, clamped). Returns whether the loop
 * should keep running: the entrance is not over, the pointer is on the word,
 * or a particle is still moving. When it returns false the particles have
 * been snapped to their rest points.
 */
export function step(p: Particles, ptr: Pointer, frame: number): boolean {
  p.acc += Math.min(Math.max(frame, 0), MAX_FRAME);
  while (p.acc >= FIXED_DT) {
    p.acc -= FIXED_DT;
    if (p.clock !== Infinity) {
      p.clock += FIXED_DT;
      if (entering(p)) continue;
      p.clock = Infinity; /* handed to the spring, velocities zero */
    }
    substep(p, ptr, FIXED_DT);
  }
  if (p.clock !== Infinity) return true;
  /* A pointer on the word holds particles at a force balance away from their
     rest points: still, but not home. The loop stops on stillness alone then
     (the next pointer move restarts it); with the pointer gone it needs
     home as well, and snaps there. */
  if (ptr.active) return fast(p);
  if (moving(p)) return true;
  settle(p);
  return false;
}
