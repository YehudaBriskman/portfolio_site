import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import Flow from "@/components/motion/Flow";

/*
 * The gestures are keyframes in the caller's stylesheet and jsdom will not run
 * them, so what is testable here is the contract the stylesheet is written
 * against — one attribute per item, three values, and every way of failing
 * landing on the attribute being absent.
 *
 * That last part is most of this file. The resting state of an item is its
 * finished state, so "no attribute" means readable prose: the tests that
 * matter are the ones that prove the gate lets go when it cannot do its job,
 * because a gate that stays armed is a section of invisible text.
 *
 * `setupTests.ts` installs an IntersectionObserver that never calls back,
 * which is exactly the broken observer two of these tests need. The ones that
 * drive an observer by hand install their own and put the original back.
 */

type Watcher = {
  /** Reports on the given targets, as a real observer would. */
  report: (records: { target: Element; isIntersecting: boolean }[]) => void;
  options: IntersectionObserverInit | undefined;
  observed: Element[];
  unobserved: Element[];
  disconnects: number;
};

const originalIO = globalThis.IntersectionObserver;

/** Replaces the global observer with one the test can speak through. */
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
        observed: [],
        unobserved: [],
        disconnects: 0,
        report: (records) =>
          cb(
            records.map((r) => r as unknown as IntersectionObserverEntry),
            this as unknown as IntersectionObserver
          ),
      };
      watchers.push(this.watcher);
    }

    observe(target: Element): void {
      this.watcher.observed.push(target);
    }
    unobserve(target: Element): void {
      this.watcher.unobserved.push(target);
    }
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

/** Three items, which is the shape this is actually used in. */
function threeItems() {
  return render(
    <Flow className="wall">
      <div>One</div>
      <div>Two</div>
      <div>Three</div>
    </Flow>
  );
}

function flows(container: HTMLElement): (string | null)[] {
  return Array.from(container.firstElementChild?.children ?? []).map((el) =>
    el.getAttribute("data-flow")
  );
}

afterEach(() => {
  vi.stubGlobal("IntersectionObserver", originalIO);
  vi.useRealTimers();
});

describe("Flow", () => {
  it("arms every item, and only JavaScript can arm it", () => {
    const { watchers } = captureObserver();
    const { container } = threeItems();

    /* Armed before the first paint — the attribute is what the stylesheet's
       hidden state hangs on, and a frame of finished text followed by the
       arrival starting from nothing would be a flash on every visit. */
    expect(flows(container)).toEqual(["wait", "wait", "wait"]);
    expect(watchers[0].observed).toHaveLength(3);
  });

  it("watches every item separately, 12% inside the viewport", () => {
    const { watchers } = captureObserver();
    threeItems();

    /* One observer, three targets: this is the whole difference from the
       `reveal` device, which fires once for a group. */
    expect(watchers).toHaveLength(1);
    /* Not `0px`. At the fold the arrival has already finished below the
       reader's eyeline, which is the same as not having one. */
    expect(watchers[0].options?.rootMargin).toBe("0px 0px -12% 0px");
  });

  it("releases the item that crossed and leaves the others waiting", () => {
    const { watchers } = captureObserver();
    const { container } = threeItems();
    const items = Array.from(container.firstElementChild?.children ?? []);

    watchers[0].report([{ target: items[0], isIntersecting: true }]);

    expect(flows(container)).toEqual(["in", "wait", "wait"]);
    /* Released and never watched again: an item still being observed is one
       state change away from arriving a second time. */
    expect(watchers[0].unobserved).toEqual([items[0]]);
  });

  it("does not take an arrival back", () => {
    const { watchers } = captureObserver();
    const { container } = threeItems();
    const items = Array.from(container.firstElementChild?.children ?? []);

    watchers[0].report([{ target: items[1], isIntersecting: true }]);
    /* A late "you have left the viewport" has to change nothing. Body copy
       that re-hides itself when the reader looks away is a defect dressed as
       an effect, and it is the reason this is an observer and not a view
       timeline. */
    watchers[0].report([{ target: items[1], isIntersecting: false }]);

    expect(flows(container)).toEqual(["wait", "in", "wait"]);
  });

  it("never arms anything when there is no observer to ask", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = threeItems();

    /* No attribute at all, which is the finished section: the hidden state is
       the exception here and only the gate can ask for it. */
    expect(flows(container)).toEqual([null, null, null]);
  });

  it("lets go of every item when the observer never speaks", () => {
    /* The observer from `setupTests.ts` constructs and then says nothing,
       which is the broken polyfill this deadline exists for. */
    vi.useFakeTimers();
    const { container } = threeItems();
    expect(flows(container)).toEqual(["wait", "wait", "wait"]);

    vi.advanceTimersByTime(2000);

    /* Content arriving without its arrival, which is the right way to fail. */
    expect(flows(container)).toEqual([null, null, null]);
  });

  it("lets go of only the items an observer loses", () => {
    vi.useFakeTimers();
    const { watchers } = captureObserver();
    const { container } = threeItems();
    const items = Array.from(container.firstElementChild?.children ?? []);

    /* A working observer reports on every target it is given, intersecting or
       not. This one mentions two of three and drops the last. */
    watchers[0].report([
      { target: items[0], isIntersecting: false },
      { target: items[1], isIntersecting: false },
    ]);
    vi.advanceTimersByTime(2000);

    /* The two it acknowledged stay armed and patient — the reader has simply
       not scrolled to them — and the one it lost is handed back. */
    expect(flows(container)).toEqual(["wait", "wait", null]);
  });

  it("stops watching when it is unmounted", () => {
    const { watchers } = captureObserver();
    const { unmount } = threeItems();

    unmount();
    expect(watchers[0].disconnects).toBeGreaterThan(0);
  });

  it("keeps the class it is handed and renders its children once", () => {
    const { container } = threeItems();
    const group = container.firstElementChild;

    expect(group?.className).toBe("wall");
    /* A gate, not a conditional render: the prose is in the document whether
       anything ever arrives or not. */
    expect(group?.textContent).toBe("OneTwoThree");
  });
});
