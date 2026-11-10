import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useImageLoad } from "@/components/media/useImageLoad";
import Shot from "@/components/projects/Shot";

function Probe({ src }: { src: string }) {
  const { attach, state, onLoad, onError } = useImageLoad(src);
  return <img ref={attach} src={src} alt="p" onLoad={onLoad} onError={onError} data-state={state} />;
}

const defineImg = (complete: boolean, naturalWidth: number) => {
  Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => complete });
  Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", { configurable: true, get: () => naturalWidth });
};

describe("useImageLoad", () => {
  it("starts loading and becomes loaded on the load event", () => {
    defineImg(false, 0);
    render(<Probe src="/a.png" />);
    const img = screen.getByAltText("p");
    expect(img.dataset.state).toBe("loading");
    fireEvent.load(img);
    expect(img.dataset.state).toBe("loaded");
  });

  it("sees an image that finished before the handler was attached (a cached file)", () => {
    defineImg(true, 640);
    render(<Probe src="/cached.png" />);
    expect(screen.getByAltText("p").dataset.state).toBe("loaded");
  });

  it("calls a finished image with no width a failure, not a load", () => {
    defineImg(true, 0);
    render(<Probe src="/broken.png" />);
    expect(screen.getByAltText("p").dataset.state).toBe("failed");
  });

  it("becomes failed on the error event", () => {
    defineImg(false, 0);
    render(<Probe src="/x.png" />);
    fireEvent.error(screen.getByAltText("p"));
    expect(screen.getByAltText("p").dataset.state).toBe("failed");
  });

  it("starts over when the file changes", () => {
    defineImg(false, 0);
    const { rerender } = render(<Probe src="/a.png" />);
    fireEvent.load(screen.getByAltText("p"));
    expect(screen.getByAltText("p").dataset.state).toBe("loaded");
    rerender(<Probe src="/b.png" />);
    expect(screen.getByAltText("p").dataset.state).toBe("loading");
  });
});

describe("Shot", () => {
  it("shows a cached screenshot at once instead of holding it invisible", () => {
    defineImg(true, 800);
    const { container } = render(<Shot src="/img/p/x.png" alt="shot" />);
    const img = container.querySelector("img")!;
    expect(img.className).toContain("opacity-100");
    expect(container.querySelector("[data-image-state]")).toBeNull();
  });

  it("stops the placeholder pulsing once the image has failed, and keeps it visible", () => {
    defineImg(false, 0);
    const { container } = render(<Shot src="/img/p/x.png" alt="shot" />);
    expect(container.querySelector(".scrub-pulse")).not.toBeNull();
    act(() => {
      fireEvent.error(container.querySelector("img")!);
    });
    const ph = container.querySelector("[data-image-state]")!;
    expect(ph.getAttribute("data-image-state")).toBe("failed");
    expect(ph.className).not.toContain("scrub-pulse");
  });
});
