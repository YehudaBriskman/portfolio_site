import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MediaIcon from "@/components/media/MediaIcon";
import MediaVideo from "@/components/media/MediaVideo";

/*
 * <MediaVideo> (#253) and the motion contract: muted and inline always, a
 * poster always, and it plays by itself only when asked to AND motion is on —
 * neither prefers-reduced-motion nor the site's Pause (body.motion-paused).
 */

let reduced = false;
let play: ReturnType<typeof vi.fn>;
let pause: ReturnType<typeof vi.fn>;

beforeEach(() => {
  reduced = false;
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("reduce") ? reduced : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  // jsdom has no media playback.
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: pause });
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.classList.remove("motion-paused");
});

const props = {
  src: "/api/images/m/tour-abc123/video-aaaaaaaaaaaaaaaa.mp4",
  type: "video/mp4",
  poster: "/api/images/m/tour-abc123/w1200-bbbbbbbbbbbbbbbb.webp",
  label: "A walk through the dashboard",
};

describe("MediaVideo", () => {
  it("is muted, inline, has its poster and controls, and loads nothing until asked", () => {
    render(<MediaVideo {...props} />);
    const v = screen.getByLabelText(props.label) as HTMLVideoElement;
    expect(v.muted).toBe(true);
    expect(v).toHaveAttribute("playsinline");
    expect(v).toHaveAttribute("poster", props.poster);
    expect(v).toHaveAttribute("controls");
    expect(v).toHaveAttribute("preload", "none");
    expect(play).not.toHaveBeenCalled();
  });

  it("plays by itself when asked and motion is on", () => {
    render(<MediaVideo {...props} autoPlay />);
    expect(play).toHaveBeenCalled();
    expect(screen.getByLabelText(props.label)).toHaveAttribute("data-motion", "on");
  });

  it("does not, under prefers-reduced-motion", () => {
    reduced = true;
    render(<MediaVideo {...props} autoPlay />);
    expect(play).not.toHaveBeenCalled();
    expect(screen.getByLabelText(props.label)).toHaveAttribute("preload", "none");
  });

  it("does not under the site's Pause, and stops when Pause is thrown while it plays", async () => {
    document.body.classList.add("motion-paused");
    const { unmount } = render(<MediaVideo {...props} autoPlay />);
    expect(play).not.toHaveBeenCalled();
    unmount();
    document.body.classList.remove("motion-paused");

    render(<MediaVideo {...props} autoPlay />);
    expect(play).toHaveBeenCalledTimes(1);
    await act(async () => {
      document.body.classList.add("motion-paused");
      await Promise.resolve(); // MutationObserver delivers on a microtask
    });
    expect(pause).toHaveBeenCalled();
    expect(screen.getByLabelText(props.label)).toHaveAttribute("data-motion", "off");
  });

  it("carries captions as a default track when there are any", () => {
    render(<MediaVideo {...props} captions={{ src: "/c.vtt", lang: "he", label: "עברית" }} />);
    const track = screen.getByLabelText(props.label).querySelector("track")!;
    expect(track).toHaveAttribute("kind", "captions");
    expect(track).toHaveAttribute("srclang", "he");
    expect(track).toHaveAttribute("default");
  });
});

describe("MediaIcon", () => {
  it("a monochrome icon is a currentColor mask; another is an image", () => {
    const { container } = render(
      <>
        <MediaIcon src="/i.svg" monochrome label="Leaf" />
        <MediaIcon src="/j.svg" label="Logo" />
        <MediaIcon src="/k.svg" monochrome />
      </>,
    );
    const mask = screen.getByRole("img", { name: "Leaf" });
    expect(mask.tagName).toBe("SPAN");
    expect(mask.style.backgroundColor).toBe("currentcolor");
    expect(screen.getByRole("img", { name: "Logo" }).tagName).toBe("IMG");
    // No label: decorative, hidden from assistive tech.
    expect(container.querySelector('span[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("captions per language (#306)", () => {
  const tracks = [
    { src: "/c-en.vtt", lang: "en", label: "English" },
    { src: "/c-he.vtt", lang: "he", label: "עברית" },
  ];
  it("shows every track, the page's language by default", () => {
    const { container } = render(<MediaVideo {...props} tracks={tracks} lang="he" />);
    const els = [...container.querySelectorAll("track")];
    expect(els.map((t) => t.getAttribute("srclang"))).toEqual(["en", "he"]);
    expect(els.map((t) => t.hasAttribute("default"))).toEqual([false, true]);
  });
  it("falls back to the first track when none is in the page's language", () => {
    const { container } = render(<MediaVideo {...props} tracks={[tracks[1]]} lang="en" />);
    expect(container.querySelector("track")).toHaveAttribute("default");
  });
});
