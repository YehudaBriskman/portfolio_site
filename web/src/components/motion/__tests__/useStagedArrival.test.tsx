import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useStagedArrival, type ArrivalStage } from "@/components/motion/useStagedArrival";

/*
 * The sequencer is the one part of the first screen's arrival that is not a
 * stylesheet, and it exists for one reason: four animations with four delays
 * land in the right order on the machine they were tuned on and nowhere else.
 * So what is pinned here is the waiting — that a stage begins only when the
 * previous one has reported finishing — and every way that waiting can fail.
 *
 * jsdom runs no animations at all, which is convenient rather than
 * limiting: it means the only way a stage can finish here is for a test to
 * say so, and a bug that advanced a stage on its own would have nowhere to
 * hide.
 */

const STAGES: readonly ArrivalStage[] = [
  { name: "one", endsWith: "[data-one]" },
  { name: "two", endsWith: "[data-two]" },
  { name: "three" },
];

function Harness() {
  const arrived = useStagedArrival({ stages: STAGES, publishAs: "testArrived" });
  return (
    <div data-testid="root" data-arrived={arrived}>
      <span data-one="" data-testid="first" />
      <span data-two="" data-testid="second" />
      <span data-other="" data-testid="bystander" />
    </div>
  );
}

/** What an animation ending on an element looks like from the document. */
function endAnimationOn(testId: string, type = "animationend") {
  act(() => {
    screen.getByTestId(testId).dispatchEvent(new Event(type, { bubbles: true }));
  });
}

const tokens = () => screen.getByTestId("root").getAttribute("data-arrived");

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete document.body.dataset.testArrived;
  document.body.classList.remove("motion-paused");
});

describe("a staged arrival", () => {
  it("begins the first stage and no other", () => {
    render(<Harness />);

    /* The first stage has nothing to wait for — the hero is the top of the
       document and is in view before an observer could be constructed — so it
       is running in the first painted frame and the other two are not. */
    expect(tokens()).toBe("one");
  });

  it("waits for the stage that is running, not for a stage that is not", () => {
    render(<Harness />);

    /* The gate for stage two is the second element, and stage two has not
       begun. An animation ending there while stage one is still running must
       not count — this is the difference between a sequence and four things
       that happen to be staggered. */
    endAnimationOn("second");
    expect(tokens()).toBe("one");

    /* Nor does anything else on the page that happens to be animating. The
       listener is on `document`, so every animation in the site reaches it. */
    endAnimationOn("bystander");
    expect(tokens()).toBe("one");
  });

  it("advances one stage per gate, in order", () => {
    render(<Harness />);

    endAnimationOn("first");
    expect(tokens()).toBe("one two");

    endAnimationOn("second");
    expect(tokens()).toBe("one two three");
  });

  it("stops listening once the last stage has begun", () => {
    const remove = vi.spyOn(document, "removeEventListener");
    render(<Harness />);

    endAnimationOn("first");
    endAnimationOn("second");

    /* Nothing waits for the last stage, so there is nothing left to hear. A
       listener still attached would be a listener nobody ever removes. */
    const types = remove.mock.calls.map((c) => c[0]);
    expect(types).toContain("animationend");
    expect(types).toContain("animationcancel");

    /* And a further animation changes nothing. */
    endAnimationOn("second");
    expect(tokens()).toBe("one two three");
  });

  it("treats a cancelled animation as a finished one", () => {
    render(<Harness />);

    /* Pressing Pause mid-sequence cancels whatever is running outright —
       `animation: none`, per §4 — which fires `animationcancel` and never
       `animationend`. Waiting out the seatbelt for each remaining stage
       would leave the token list minutes behind the screen. */
    endAnimationOn("first", "animationcancel");
    expect(tokens()).toBe("one two");
  });

  it("advances on its own if a stage never reports finishing", () => {
    vi.useFakeTimers();
    render(<Harness />);

    expect(tokens()).toBe("one");
    act(() => {
      vi.advanceTimersByTime(1599);
    });
    expect(tokens()).toBe("one");

    /* A background tab, an engine that fires no animation events, a
       stylesheet that failed to load. The sequence degrades to the delays it
       exists not to be, which is the right thing to degrade *to*: the page
       always finishes arriving. */
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(tokens()).toBe("one two");
  });

  it("does not fire the seatbelt for a stage that already finished", () => {
    vi.useFakeTimers();
    render(<Harness />);

    endAnimationOn("first");
    expect(tokens()).toBe("one two");

    /* The timer belonging to stage one must be cleared when stage one ends,
       or it fires later and skips stage two without stage two's gate ever
       being reached. */
    act(() => {
      vi.advanceTimersByTime(1599);
    });
    expect(tokens()).toBe("one two");
  });

  it("publishes the token list on the body, and takes it off again", () => {
    const { unmount } = render(<Harness />);

    /* The chrome is fixed, rendered by a sibling of the section that
       sequences it, and reachable from a stylesheet only through the body. */
    expect(document.body.dataset.testArrived).toBe("one");
    endAnimationOn("first");
    expect(document.body.dataset.testArrived).toBe("one two");

    /* Every other page on the site renders the same bar. Leaving the
       attribute behind would hand them this page's pre-arrival state. */
    unmount();
    expect(document.body.dataset.testArrived).toBeUndefined();
  });
});

describe("a staged arrival with the motion switched off", () => {
  it("publishes every stage at once under reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      addListener: () => {},
      removeListener: () => {},
    } as unknown as MediaQueryList);

    render(<Harness />);

    /* The stylesheets cancel every animation and restate the arrived state,
       so no stage would ever report finishing. The sequencer has to see that
       at the first render rather than wait out three seatbelts with the
       stylesheet holding a state it is never told to leave. */
    expect(tokens()).toBe("one two three");
  });

  it("publishes every stage at once when Pause is already on", () => {
    document.body.classList.add("motion-paused");
    render(<Harness />);
    expect(tokens()).toBe("one two three");
  });
});
