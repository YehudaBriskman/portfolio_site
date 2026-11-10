import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import Hero from "@/components/Hero";
import { plateTitle } from "@/data/site";
import { topTech } from "@/components/hero/topTech";

/*
 * The gate: the particle word and the orbit constellation exist only on a
 * desktop with nothing asking for less. Everywhere else the hero is the
 * static h1 and nothing extra is in the DOM. The canvas and the orbit are
 * stubbed here (jsdom has no canvas and no layout); what is asserted is the
 * decision, and that the real h1 is in the document in every case.
 */
vi.mock("@/components/hero/ParticleWord", () => ({
  default: ({ text }: { text: string }) => <canvas data-particle-word="" data-text={text} aria-hidden="true" />,
}));
vi.mock("@/components/hero/HeroOrbit", async (orig) => ({
  ...(await orig<typeof import("@/components/hero/HeroOrbit")>()),
  default: () => <div data-hero-orbit="" aria-hidden="true" />,
}));

type Env = { width: number; coarse: boolean; hover: boolean; reduced: boolean; forced: boolean; print: boolean };
const DESKTOP: Env = { width: 1440, coarse: false, hover: true, reduced: false, forced: false, print: false };

function setEnv(e: Env) {
  Object.defineProperty(window, "innerWidth", { value: e.width, configurable: true, writable: true });
  window.matchMedia = ((q: string) => {
    const min = /min-width:\s*(\d+)px/.exec(q);
    const matches =
      (min ? e.width >= Number(min[1]) : false) ||
      (q === "(pointer: coarse)" && e.coarse) ||
      (q === "(hover: hover)" && e.hover) ||
      (q === "(prefers-reduced-motion: reduce)" && e.reduced) ||
      (q === "(forced-colors: active)" && e.forced) ||
      (q === "print" && e.print);
    return {
      matches,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

const getContext = HTMLCanvasElement.prototype.getContext;
const hasCanvas = (on: boolean) => {
  /* jsdom has neither; a real browser has both. */
  vi.stubGlobal("CanvasRenderingContext2D", class {});
  HTMLCanvasElement.prototype.getContext = (on ? () => ({}) : () => null) as unknown as typeof getContext;
};

beforeEach(() => {
  document.body.classList.remove("motion-paused");
  hasCanvas(true);
});
afterEach(() => {
  HTMLCanvasElement.prototype.getContext = getContext;
  vi.unstubAllGlobals();
  document.body.classList.remove("motion-paused");
});

const orbit = (c: HTMLElement) => c.querySelector("[data-hero-orbit]");
const word = (c: HTMLElement) => c.querySelector<HTMLElement>("canvas[data-particle-word]");

describe("the hero's desktop-only objects", () => {
  it("mount on a desktop, and the h1 stays in the document with the same text", async () => {
    setEnv(DESKTOP);
    const { container } = render(<Hero />);
    await act(async () => {});
    expect(word(container)).not.toBeNull();
    expect(orbit(container)).not.toBeNull();
    expect(word(container)?.getAttribute("aria-hidden")).toBe("true");
    expect(word(container)?.dataset.text).toBe(plateTitle.name);
    expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName(plateTitle.name);
  });

  it.each([
    ["a phone", { width: 390 }],
    ["a narrow window", { width: 1099 }],
    ["a touch screen", { coarse: true }],
    ["a device with no hover", { hover: false }],
    ["reduced motion", { reduced: true }],
    ["forced colours", { forced: true }],
    ["print", { print: true }],
  ] as [string, Partial<Env>][])("render the static word on %s", async (_n, patch) => {
    setEnv({ ...DESKTOP, ...patch });
    const { container } = render(<Hero />);
    await act(async () => {});
    expect(word(container)).toBeNull();
    expect(orbit(container)).toBeNull();
    expect(container.querySelector("#hero")?.hasAttribute("data-particles")).toBe(false);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(plateTitle.name);
  });

  it("render the static word without a 2D canvas", async () => {
    hasCanvas(false);
    setEnv(DESKTOP);
    const { container } = render(<Hero />);
    await act(async () => {});
    expect(word(container)).toBeNull();
    expect(orbit(container)).toBeNull();
  });

  it("render the static word under the site's Pause, and come back on Play", async () => {
    setEnv(DESKTOP);
    document.body.classList.add("motion-paused");
    const { container } = render(<Hero />);
    await act(async () => {});
    expect(word(container)).toBeNull();
    expect(orbit(container)).toBeNull();
    await act(async () => {
      document.body.classList.remove("motion-paused");
    });
    expect(word(container)).not.toBeNull();
    expect(orbit(container)).not.toBeNull();
  });
});

describe("the orbit's labels", () => {
  it("are the tools the projects are built with, most used first, version tails folded", () => {
    expect(
      topTech(
        [
          ["React 19", "TypeScript", "Postgres 16"],
          ["React 18", "TypeScript"],
          ["Go", "react"],
        ],
        3,
      ),
    ).toEqual(["React", "TypeScript", "Go"]);
    expect(topTech([], 4)).toEqual([]);
    expect(topTech([["  "]], 4)).toEqual([]);
  });
});
