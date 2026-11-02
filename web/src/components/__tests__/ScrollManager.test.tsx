import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter, Route, Routes, useNavigate, type NavigateFunction } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ScrollManager from "@/components/ScrollManager";

/*
 * The rules, in jsdom. jsdom has no layout, so these hold the decisions — top,
 * stay, target — and `scripts/links/land.mjs` holds the landing positions in a
 * real browser (#196).
 */

let navigate: NavigateFunction = () => {};
function Grab() {
  const nav = useNavigate();
  useEffect(() => {
    navigate = nav;
  }, [nav]);
  return null;
}

function Page({ target }: { target?: string }) {
  return <main>{target ? <h2 id={target}>Target</h2> : <h1>Page</h1>}</main>;
}

function mount(at = "/") {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <ScrollManager />
      <Grab />
      <Routes>
        <Route path="/" element={<Page target="contact" />} />
        <Route path="/projects" element={<Page />} />
        <Route path="/later" element={<Later />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** A target that is not in the first commit, like a lazy page's. */
function Later() {
  return <main id="later-root" />;
}

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("ScrollManager", () => {
  let scrollTo: ReturnType<typeof vi.fn>;
  let intoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollTo = vi.fn();
    intoView = vi.fn();
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    Element.prototype.scrollIntoView = intoView as unknown as typeof Element.prototype.scrollIntoView;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("leaves a first load alone when there is no hash", () => {
    mount("/projects");
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("puts a link to another page at the first pixel", () => {
    mount("/");
    act(() => navigate("/projects"));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "instant" });
  });

  it("keeps the place when only the query changes, as a filter does", () => {
    mount("/projects");
    act(() => navigate("/projects?state=live"));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("lands a cross-route hash on its target and moves focus there", () => {
    mount("/projects");
    act(() => navigate("/#contact"));
    expect(intoView).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
    expect(document.activeElement?.id).toBe("contact");
    expect(scrollTo).not.toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });

  it("waits for a target that arrives after the page commits", async () => {
    mount("/projects");
    act(() => navigate("/later#late"));
    expect(intoView).not.toHaveBeenCalled();
    await act(async () => {
      const el = document.createElement("h2");
      el.id = "late";
      document.getElementById("later-root")!.append(el);
      await Promise.resolve();
    });
    expect(intoView).toHaveBeenCalled();
  });

  it("restores the position an entry was left at on Back", () => {
    mount("/");
    act(() => navigate("/projects"));
    Object.defineProperty(window, "scrollY", { value: 640, configurable: true });
    act(() => navigate("/"));
    Object.defineProperty(document.documentElement, "scrollHeight", { value: 5000, configurable: true });
    act(() => navigate(-1));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 640, left: 0, behavior: "instant" });
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });
});
