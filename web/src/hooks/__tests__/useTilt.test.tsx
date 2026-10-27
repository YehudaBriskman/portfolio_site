import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { useTilt } from "@/hooks/useTilt";

/*
 * What is worth testing here is the hook's policy, not the browser: which
 * pointers it listens to, what it writes, and when it gives up and goes back
 * to rest. Geometry is checked at one known point rather than swept, because
 * the formula is the thing under test and a second sample only restates it.
 */

/* The element is measured with getBoundingClientRect, which jsdom answers with
   zeroes — and a zero-width rect is the one case the hook deliberately skips.
   Every test therefore gives the slab a size to be measured against. */
const RECT = { left: 0, top: 0, width: 400, height: 300 } as const;

/*
 * requestAnimationFrame is queued rather than run inline. Running the callback
 * the moment it is scheduled would let the hook's own in-flight frame id be
 * assigned after the frame had already cleared it, which wedges every later
 * write — an artefact of the stub, not of the hook.
 */
let frames: FrameRequestCallback[] = [];
const flush = () => {
  const queued = frames;
  frames = [];
  for (const cb of queued) cb(0);
};

function Probe() {
  const ref = useTilt<HTMLDivElement>();
  return <div ref={ref} data-testid="slab" />;
}

function mountSlab() {
  const { getByTestId } = render(<Probe />);
  const el = getByTestId("slab");
  el.getBoundingClientRect = () =>
    ({ ...RECT, right: RECT.width, bottom: RECT.height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  return el;
}

function pointerMove(x: number, y: number, pointerType = "mouse") {
  const event = new MouseEvent("pointermove", { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  window.dispatchEvent(event);
  flush();
}

/* jsdom has no matchMedia at all, so its absence is the default state and the
   reduced-motion case has to install one. */
function stubReducedMotion(matches: boolean) {
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useTilt", () => {
  it("writes the tilt custom properties for a mouse pointer", () => {
    const el = mountSlab();

    // Centre is (200, 150); the pointer sits right of it and above it, so the
    // slab turns to the right and tips its top toward the viewer.
    pointerMove(400, 0);

    expect(el.style.getPropertyValue("--tilt-y")).toBe("2.69deg");
    expect(el.style.getPropertyValue("--tilt-x")).toBe("2.23deg");
  });

  it("clamps the lean at the configured maximum far from the element", () => {
    const el = mountSlab();

    pointerMove(100000, -100000);

    expect(el.style.getPropertyValue("--tilt-y")).toBe("7.00deg");
    expect(el.style.getPropertyValue("--tilt-x")).toBe("7.00deg");
  });

  it("writes nothing for a touch pointer", () => {
    const el = mountSlab();

    pointerMove(400, 0, "touch");

    expect(el.style.getPropertyValue("--tilt-y")).toBe("");
    expect(el.style.getPropertyValue("--tilt-x")).toBe("");
  });

  it("returns to rest when the pointer leaves the document", () => {
    const el = mountSlab();
    pointerMove(400, 0);

    document.dispatchEvent(new Event("pointerleave"));

    expect(el.style.getPropertyValue("--tilt-y")).toBe("");
    expect(el.style.getPropertyValue("--tilt-x")).toBe("");
  });

  it("writes nothing while reduced motion is preferred", () => {
    stubReducedMotion(true);
    const el = mountSlab();

    pointerMove(400, 0);

    expect(el.style.getPropertyValue("--tilt-y")).toBe("");
    expect(el.style.getPropertyValue("--tilt-x")).toBe("");
  });
});
