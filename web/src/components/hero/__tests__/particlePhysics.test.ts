import { describe, expect, it } from "vitest";
import {
  burst,
  createParticles,
  entranceLength,
  moving,
  planEntrance,
  settle,
  step,
  type Particles,
  type Pointer,
} from "@/components/hero/particlePhysics";
import { mulberry32 } from "@/components/hero/particleLayout";

const NONE: Pointer = { x: -1e4, y: -1e4, active: false };

function grid(n = 200): Particles {
  const p = createParticles(n);
  p.radius = 100;
  for (let i = 0; i < n; i += 1) {
    p.tx[i] = 300 + (i % 20) * 8;
    p.ty[i] = 200 + Math.floor(i / 20) * 8;
  }
  settle(p);
  return p;
}
const run = (p: Particles, ptr: Pointer, seconds: number) => {
  let go = true;
  for (let t = 0; t < seconds * 60 && go; t += 1) go = step(p, ptr, 1 / 60);
  return go;
};
const dist = (p: Particles, i: number) => Math.hypot(p.x[i] - p.tx[i], p.y[i] - p.ty[i]);

describe("the spring", () => {
  it("converges from a displacement and stops the loop at rest, snapped home", () => {
    const p = grid();
    for (let i = 0; i < p.count; i += 1) {
      p.x[i] += 40;
      p.y[i] -= 25;
    }
    expect(moving(p)).toBe(true);
    const still = run(p, NONE, 3);
    expect(still).toBe(false); /* step() said: stop the loop */
    expect(moving(p)).toBe(false);
    for (let i = 0; i < p.count; i += 1) expect(dist(p, i)).toBe(0);
  });

  it("settles in about a second and overshoots at most a little (zeta 0.62)", () => {
    const p = grid(1);
    p.x[0] += 100;
    let worst = 0;
    let t = 0;
    while (step(p, NONE, 1 / 60) && t < 300) {
      t += 1;
      worst = Math.max(worst, p.x[0] < p.tx[0] ? p.tx[0] - p.x[0] : 0);
    }
    expect(t / 60).toBeLessThan(1.5);
    expect(worst).toBeLessThan(15);
  });

  it("is frame-rate independent: 30, 60 and 144 Hz land in the same place", () => {
    const at = (hz: number) => {
      const p = grid(1);
      p.x[0] += 100;
      for (let i = 0; i < hz * 0.4; i += 1) step(p, NONE, 1 / hz);
      return p.x[0];
    };
    expect(Math.abs(at(30) - at(144))).toBeLessThan(1.5);
    expect(Math.abs(at(60) - at(144))).toBeLessThan(1.5);
  });

  it("a long stalled frame cannot blow it up", () => {
    const p = grid(1);
    p.x[0] += 100;
    step(p, NONE, 10);
    expect(Math.abs(p.x[0] - p.tx[0])).toBeLessThan(150);
  });
});

describe("the pointer", () => {
  it("pushes particles away from it, and leaves those outside the radius alone", () => {
    const p = grid();
    const ptr: Pointer = { x: 350, y: 240, active: true };
    const before = Array.from({ length: p.count }, (_, i) => Math.hypot(p.tx[i] - ptr.x, p.ty[i] - ptr.y));
    run(p, ptr, 0.5);
    let pushed = 0;
    for (let i = 0; i < p.count; i += 1) {
      const d = Math.hypot(p.x[i] - ptr.x, p.y[i] - ptr.y);
      if (before[i] < 90) {
        expect(d).toBeGreaterThan(before[i]);
        pushed += 1;
      }
    }
    expect(pushed).toBeGreaterThan(5);
  });

  it("falls off smoothly: closer is pushed harder, and at the edge it is zero", () => {
    const p = createParticles(3);
    p.radius = 100;
    p.tx.set([0, 50, 99.9]);
    p.ty.set([0, 0, 0]);
    settle(p);
    step(p, { x: -0.0001, y: 0.0001, active: true }, 1 / 120);
    const speed = (i: number) => Math.hypot(p.vx[i], p.vy[i]);
    expect(speed(0)).toBeGreaterThan(speed(1));
    expect(speed(1)).toBeGreaterThan(speed(2));
    expect(speed(2)).toBeLessThan(speed(0) * 0.001);
  });

  it("they come home when it leaves, and the loop stops", () => {
    const p = grid();
    const ptr: Pointer = { x: 350, y: 240, active: true };
    run(p, ptr, 0.6);
    expect(moving(p)).toBe(true);
    ptr.active = false;
    expect(run(p, ptr, 4)).toBe(false);
    for (let i = 0; i < p.count; i += 1) expect(dist(p, i)).toBe(0);
  });

  it("with the pointer resting on the word, the loop stops on stillness, not on being home", () => {
    const p = grid();
    const ptr: Pointer = { x: 350, y: 240, active: true };
    expect(run(p, ptr, 8)).toBe(false);
    expect(moving(p)).toBe(true); /* held off its rest points by the push */
  });

  it("a click bursts particles outward, and they settle", () => {
    const p = grid();
    burst(p, 350, 240, 400);
    let outward = 0;
    for (let i = 0; i < p.count; i += 1) {
      const dx = p.x[i] - 350;
      const dy = p.y[i] - 240;
      if (p.vx[i] * dx + p.vy[i] * dy > 0) outward += 1;
    }
    expect(outward).toBeGreaterThan(10);
    expect(run(p, NONE, 6)).toBe(false);
  });
});

describe("the entrance", () => {
  it("starts beyond the edges, finishes within 1.8s on the rest points, and is not a loop", () => {
    const p = grid(300);
    planEntrance(p, -40, 1480, 740, mulberry32(3));
    expect(entranceLength(p)).toBeLessThanOrEqual(1.8);
    expect(entranceLength(p)).toBeGreaterThan(1.1);
    for (let i = 0; i < p.count; i += 1) expect(p.x[i] < 0 || p.x[i] > 1440).toBe(true);
    expect(step(p, NONE, 1 / 60)).toBe(true);
    const go = run(p, NONE, 4);
    expect(go).toBe(false);
    for (let i = 0; i < p.count; i += 1) expect(dist(p, i)).toBe(0);
    expect(p.clock).toBe(Infinity);
  });

  it("comes from the near side with some crossing over, on curved paths", () => {
    const p = grid(600);
    planEntrance(p, -40, 1480, 740, mulberry32(3));
    let near = 0;
    let curved = 0;
    for (let i = 0; i < p.count; i += 1) {
      if ((p.sx[i] < 0) === (p.tx[i] < 740)) near += 1;
      /* the control point is off the straight start-target line */
      const cross = Math.abs((p.tx[i] - p.sx[i]) * (p.cy[i] - p.sy[i]) - (p.ty[i] - p.sy[i]) * (p.cx[i] - p.sx[i]));
      if (cross > 1) curved += 1;
    }
    expect(near / p.count).toBeGreaterThan(0.7);
    expect(near / p.count).toBeLessThan(1);
    expect(curved / p.count).toBeGreaterThan(0.99);
  });

  it("ignores the pointer while it runs", () => {
    const a = grid(100);
    const b = grid(100);
    planEntrance(a, -40, 1480, 740, mulberry32(3));
    planEntrance(b, -40, 1480, 740, mulberry32(3));
    for (let i = 0; i < 30; i += 1) {
      step(a, NONE, 1 / 60);
      step(b, { x: 700, y: 240, active: true }, 1 / 60);
    }
    expect(Array.from(a.x)).toEqual(Array.from(b.x));
  });
});

describe("at rest", () => {
  it("an untouched word never asks for a frame", () => {
    const p = grid();
    expect(step(p, NONE, 1 / 60)).toBe(false);
    expect(moving(p)).toBe(false);
  });
});
