import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHelpMotion, LEAVE_MS, ENTER_MS } from "../useHelpMotion";

/*
 * The phone's push and pop between the help index and a topic. Asserted on
 * state (the data attribute and where the router is), never on a frame: this
 * box's headless Chromium draws about one per 40 seconds.
 */

let phone = true;
let reduced = false;
beforeEach(() => {
  vi.useFakeTimers();
  document.body.classList.remove("motion-paused");
  window.matchMedia = ((q: string) => ({
    matches: q.includes("prefers-reduced-motion") ? reduced : q.includes("max-width") ? phone : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  vi.useRealTimers();
  phone = true;
  reduced = false;
});

function Page({ name, ids }: { name: string; ids: string[] }) {
  const m = useHelpMotion(name === "index" ? null : name, ["language", "look", "keyboard"]);
  return (
    <section data-testid="page" {...m}>
      <p>{name}</p>
      <Link to="/help">up</Link>
      {ids.map((id) => (
        <Link key={id} to={`/help/${id}`}>
          {id}
        </Link>
      ))}
    </section>
  );
}

const Where = () => <output data-testid="where">{useLocation().pathname}</output>;

const mount = (at: string) =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <Where />
      <Routes>
        <Route path="/help" element={<Page name="index" ids={["language", "look"]} />} />
        <Route path="/help/:id" element={<Page name="look" ids={["language", "keyboard"]} />} />
      </Routes>
    </MemoryRouter>,
  );

/* jsdom has no AnimationEvent, so React listens for the prefixed name there; send both (as EntryShutter.test does). */
function animationEnd(el: Element) {
  act(() => {
    el.dispatchEvent(new Event("animationend", { bubbles: true }));
    el.dispatchEvent(new Event("webkitAnimationEnd", { bubbles: true }));
  });
}

const where = () => screen.getByTestId("where").textContent;
const motion = () => screen.getByTestId("page").getAttribute("data-help-motion");

describe("help push and pop on a phone", () => {
  it("a first load plays nothing of its own", () => {
    mount("/help/look");
    expect(motion()).toBeNull();
  });

  it("leaves first, then goes: index to a topic is a push", () => {
    mount("/help");
    fireEvent.click(screen.getByText("look"));
    expect(motion()).toBe("leave-push");
    expect(where()).toBe("/help");
    act(() => void vi.advanceTimersByTime(LEAVE_MS));
    expect(where()).toBe("/help/look");
    expect(motion()).toBe("enter-push");
  });

  it("a topic back to the index is a pop, and an earlier neighbour is a pop too", () => {
    mount("/help/look");
    fireEvent.click(screen.getByText("up"));
    expect(motion()).toBe("leave-pop");
    act(() => void vi.advanceTimersByTime(LEAVE_MS));
    expect(where()).toBe("/help");
    expect(motion()).toBe("enter-pop");
  });

  it("a later neighbour is a push, an earlier one a pop", () => {
    mount("/help/look");
    fireEvent.click(screen.getByText("keyboard"));
    expect(motion()).toBe("leave-push");
    fireEvent.click(screen.getByText("language"));
    /* Interrupted: the second tap goes at once, and the first never fires. */
    expect(where()).toBe("/help/language");
    act(() => void vi.advanceTimersByTime(LEAVE_MS * 2));
    expect(where()).toBe("/help/language");
  });

  it("reduced motion, Pause motion and a wide screen go at once with no state", () => {
    for (const setup of [() => (reduced = true), () => document.body.classList.add("motion-paused"), () => (phone = false)]) {
      setup();
      const { unmount } = mount("/help");
      fireEvent.click(screen.getByText("look"));
      expect(where()).toBe("/help/look");
      expect(motion()).toBeNull();
      unmount();
      phone = true;
      reduced = false;
      document.body.classList.remove("motion-paused");
    }
  });

  it("clears the enter state when the animation ends, or after a timer if no event comes", () => {
    mount("/help");
    fireEvent.click(screen.getByText("look"));
    act(() => void vi.advanceTimersByTime(LEAVE_MS));
    expect(motion()).toBe("enter-push");
    animationEnd(screen.getByTestId("page"));
    expect(motion()).toBeNull();
    /* and with no animationend at all (cut short, hidden tab), the fallback does it */
    fireEvent.click(screen.getByText("keyboard"));
    act(() => void vi.advanceTimersByTime(LEAVE_MS));
    expect(motion()).toBe("enter-push");
    act(() => void vi.advanceTimersByTime(ENTER_MS));
    expect(motion()).toBeNull();
  });

  it("an animationend from a child does not clear it", () => {
    mount("/help");
    fireEvent.click(screen.getByText("look"));
    act(() => void vi.advanceTimersByTime(LEAVE_MS));
    animationEnd(screen.getByText("up"));
    expect(motion()).toBe("enter-push");
  });

  it("leaves a modified click to the browser", () => {
    mount("/help");
    fireEvent.click(screen.getByText("look"), { ctrlKey: true });
    expect(motion()).toBeNull();
  });
});

describe("the stylesheet", () => {
  const css = readFileSync(resolve(__dirname, "../helpMotion.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  it("has no rule outside the phone query, so a wide screen is unchanged", () => {
    const outside = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "").replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
    expect(outside.trim()).toBe("");
    expect(css).toMatch(/max-width:\s*639px/);
  });

  it("slides only with no reduced-motion preference, moves nothing but translate and opacity, and uses the site's curve", () => {
    expect(css).toMatch(/prefers-reduced-motion:\s*no-preference/);
    expect(css).toContain("var(--ease-settle)");
    expect(css).toContain("var(--dur-fast)");
    expect(css).not.toMatch(/(?<![-\w])(margin|width|height|top|left|right)\s*:/);
  });
});
