import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import Arrived from "@/components/motion/Arrived";

/*
 * The gate carries no gesture, so what is testable is the whole of it: it
 * publishes once, it stops watching, and — the one that matters most — it never
 * takes anything away.
 *
 * `setupTests.ts` installs an IntersectionObserver that never calls back, which
 * is right for every other suite and useless here, so each test that drives the
 * observer installs its own and puts the original back.
 */

type Watcher = {
  fire: (isIntersecting: boolean) => void;
  options: IntersectionObserverInit | undefined;
  disconnects: number;
};

const originalIO = globalThis.IntersectionObserver;

function captureObserver(): { watchers: Watcher[] } {
  const watchers: Watcher[] = [];

  class Recording implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = "0px";
    readonly thresholds: ReadonlyArray<number> = [0];
    private readonly watcher: Watcher;

    constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.watcher = {
        options,
        disconnects: 0,
        fire: (isIntersecting) =>
          act(() => {
            cb(
              [{ isIntersecting } as IntersectionObserverEntry],
              this as unknown as IntersectionObserver
            );
          }),
      };
      watchers.push(this.watcher);
    }

    observe(): void {}
    unobserve(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    disconnect(): void {
      this.watcher.disconnects += 1;
    }
  }

  vi.stubGlobal("IntersectionObserver", Recording as unknown as typeof IntersectionObserver);
  return { watchers };
}

afterEach(() => {
  vi.stubGlobal("IntersectionObserver", originalIO);
  vi.useRealTimers();
});

describe("Arrived", () => {
  it("publishes the attribute only once the subject has been reached", () => {
    const { watchers } = captureObserver();
    const { container } = render(
      <Arrived>
        <p>Form</p>
      </Arrived>
    );

    const gate = container.firstElementChild;
    expect(gate).not.toHaveAttribute("data-arrived");
    /* The content is never conditional. Whatever reads the attribute may only
       ever add to a page that is already complete without it. */
    expect(screen.getByText("Form")).toBeInTheDocument();

    watchers[0].fire(true);
    expect(gate).toHaveAttribute("data-arrived", "true");
  });

  it("stops watching after the first crossing, and does not take it back", () => {
    const { watchers } = captureObserver();
    const { container } = render(
      <Arrived>
        <p>Form</p>
      </Arrived>
    );

    watchers[0].fire(true);
    expect(watchers[0].disconnects).toBeGreaterThan(0);

    /* A late "you have left the viewport" must change nothing, or a reader
       scrolling back up would be shown the sequence a second time. */
    watchers[0].fire(false);
    expect(container.firstElementChild).toHaveAttribute("data-arrived", "true");
  });

  it("takes its own root margin, because 12% is a reveal's number and not a gate's", () => {
    const { watchers } = captureObserver();
    render(
      <Arrived rootMargin="0px 0px -30% 0px">
        <p>Form</p>
      </Arrived>
    );

    expect(watchers[0].options?.rootMargin).toBe("0px 0px -30% 0px");
  });

  it("arrives anyway when the observer constructs and then never speaks", () => {
    vi.useFakeTimers();
    captureObserver();
    const { container } = render(
      <Arrived>
        <p>Form</p>
      </Arrived>
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(container.firstElementChild).toHaveAttribute("data-arrived", "true");
  });

  it("arrives when there is no observer to ask", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(
      <Arrived>
        <p>Form</p>
      </Arrived>
    );

    expect(container.firstElementChild).toHaveAttribute("data-arrived", "true");
  });
});
