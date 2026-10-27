import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import BlurShot from "@/components/motion/BlurShot";

/*
 * Everything visible about this component hangs off one attribute, and the
 * attribute is set from two different places: the load event, and the mount
 * path that exists because a cached image never fires one. The second is
 * exactly the kind of branch that works on a cold reload and breaks on every
 * navigation afterwards, which is the hardest version of a bug to notice.
 */

const SRC = "/plates/plate-evening-1200.jpg";

function frameOf(container: HTMLElement): HTMLElement {
  const frame = container.firstElementChild;
  if (!(frame instanceof HTMLElement)) throw new Error("no frame rendered");
  return frame;
}

/** Makes the next rendered image look like one already in the cache. */
function pretendCached(complete: boolean, naturalWidth: number) {
  const proto = window.HTMLImageElement.prototype;
  const before = {
    complete: Object.getOwnPropertyDescriptor(proto, "complete"),
    naturalWidth: Object.getOwnPropertyDescriptor(proto, "naturalWidth"),
  };

  Object.defineProperty(proto, "complete", {
    configurable: true,
    get: () => complete,
  });
  Object.defineProperty(proto, "naturalWidth", {
    configurable: true,
    get: () => naturalWidth,
  });

  return () => {
    if (before.complete) Object.defineProperty(proto, "complete", before.complete);
    else Reflect.deleteProperty(proto, "complete");
    if (before.naturalWidth)
      Object.defineProperty(proto, "naturalWidth", before.naturalWidth);
    else Reflect.deleteProperty(proto, "naturalWidth");
  };
}

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
});

describe("BlurShot", () => {
  it("holds the placeholder until the image loads, then drops it", () => {
    const { container } = render(<BlurShot src={SRC} alt="A lone tree" />);
    const frame = frameOf(container);

    expect(frame.dataset.loaded).toBe("false");

    fireEvent.load(screen.getByAltText("A lone tree"));

    expect(frame.dataset.loaded).toBe("true");
  });

  it("unblurs a broken image instead of leaving a smeared placeholder", () => {
    const { container } = render(<BlurShot src={SRC} alt="A lone tree" />);

    fireEvent.error(screen.getByAltText("A lone tree"));

    expect(frameOf(container).dataset.loaded).toBe("true");
  });

  it("arrives already loaded, and without a transition, on a cache hit", () => {
    restore = pretendCached(true, 1920);

    const { container } = render(<BlurShot src={SRC} alt="A lone tree" />);
    const frame = frameOf(container);

    /* Loaded on the first commit, with no load event to be had — and the
       transition suppressor released again afterwards, so the attribute is
       not left behind to deaden anything later. */
    expect(frame.dataset.loaded).toBe("true");
    expect(frame.dataset.instant).toBeUndefined();
  });

  it("does not treat a failed cached image as loaded", () => {
    /* `complete` is true for a broken image too, which is why the mount path
       looks at the decoded width rather than trusting it. */
    restore = pretendCached(true, 0);

    const { container } = render(<BlurShot src={SRC} alt="A lone tree" />);

    expect(frameOf(container).dataset.loaded).toBe("false");
  });

  it("writes the placeholder and the frame's shape onto the wrapper", () => {
    const { container } = render(
      <BlurShot
        src={SRC}
        alt="A lone tree"
        lqip="data:image/svg+xml,%3Csvg%3E%3C/svg%3E"
        width={1920}
        height={1080}
      />
    );

    const style = frameOf(container).getAttribute("style") ?? "";
    expect(style).toContain("--shot-lqip: url(");
    expect(style).toContain("aspect-ratio: 1920 / 1080");
  });
});
