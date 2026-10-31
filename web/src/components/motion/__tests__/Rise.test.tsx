import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import Rise, { riseOnLoad } from "@/components/motion/Rise";

/*
 * The motion is 14px of CSS that jsdom will not lay out, so what is testable
 * here is the contract around it — and every one of these four is a bug this
 * component exists to not have.
 *
 * It must fire once: content that re-hides itself on the way back up is a
 * defect, not an effect. It must trigger inside the viewport rather than at
 * the fold. It must stop observing the moment it has fired, because an
 * observer still watching is one state change away from un-revealing the page.
 * And it must show the content when there is no observer to ask.
 *
 * `setupTests.ts` installs an IntersectionObserver that never calls back,
 * which is right for every other suite and useless here, so each test that
 * needs to drive the observer installs its own and puts the original back.
 */

type Watcher = {
  fire: (isIntersecting: boolean) => void;
  options: IntersectionObserverInit | undefined;
  disconnects: number;
};

const originalIO = globalThis.IntersectionObserver;

/** Replaces the global observer with one the test can fire by hand. */
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
});

describe("Rise", () => {
  it("holds its children back until the group is in view, then lets them go", () => {
    const { watchers } = captureObserver();
    const { container } = render(
      <Rise>
        <p>One</p>
        <p>Two</p>
      </Rise>
    );

    const group = container.firstElementChild;
    const before = (group?.className ?? "").split(" ").filter(Boolean).length;

    /* The content is in the document the whole time — this is a reveal, not a
       conditional render, so a reader with no motion and a crawler with no
       JavaScript are reading the same page. */
    expect(screen.getByText("One")).toBeInTheDocument();

    watchers[0].fire(true);

    expect((group?.className ?? "").split(" ").filter(Boolean).length).toBe(before + 1);
  });

  it("waits until the group is properly inside the viewport", () => {
    const { watchers } = captureObserver();
    render(
      <Rise>
        <p>One</p>
      </Rise>
    );

    /* Not `0px`. Firing as the first pixel clears the fold finishes the reveal
       below the reader's eyeline, which is the same as not having one. */
    expect(watchers[0].options?.rootMargin).toBe("0px 0px -12% 0px");
  });

  it("stops watching after the first crossing, and does not take it back", () => {
    const { watchers } = captureObserver();
    const { container } = render(
      <Rise>
        <p>One</p>
      </Rise>
    );

    watchers[0].fire(true);
    const shown = container.firstElementChild?.className;
    expect(watchers[0].disconnects).toBeGreaterThan(0);

    /* A late "you have left the viewport" must change nothing. This is the
       assertion that "fires once" is really once. */
    watchers[0].fire(false);
    expect(container.firstElementChild?.className).toBe(shown);
  });

  it("shows everything when there is no observer to ask", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(
      <Rise>
        <p>One</p>
      </Rise>
    );

    const group = container.firstElementChild;
    /* Two module classes rather than one: the group and the shown state. The
       fallback has to be the finished page, never a blank one. */
    expect((group?.className ?? "").split(" ").filter(Boolean)).toHaveLength(2);
  });

  it("exports the same two classes for a group that is already on screen", () => {
    /* The title plate uses these directly so the first screen runs no
       JavaScript at all; if they ever stop matching what the component
       applies, the plate and the wall text stop arriving alike. */
    expect(riseOnLoad.split(" ").filter(Boolean)).toHaveLength(2);
  });
});
