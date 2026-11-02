import { afterEach, describe, expect, it } from "vitest";
import { Suspense, lazy, type ComponentType, type ReactNode } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import SiteChrome from "@/components/SiteChrome";
import { usePageCommitted } from "@/components/nav/pageCommit";
import { DARK_PANEL_SELECTOR } from "@/components/nav/useDarkChrome";

/*
 * #63: the chrome is mounted once for the visit, not once per page.
 *
 * The pages here are stand-ins, and deliberately two *different* components.
 * That is the shape that broke: `Index` and `PageShell` were different element
 * types at the same `<Routes>` position, so React unmounted one bar and
 * mounted the other. Two stand-ins of different types reproduce that exactly
 * without dragging the whole home page — the city, the pile, the API — into
 * jsdom to prove a fact about the tree.
 *
 * What "survives" means is asserted on DOM identity, not on what the bar
 * shows: a freshly mounted bar renders the same markup, so a test that only
 * read text would pass against the bug. A node that is `toBe` the node from
 * before the navigation cannot have been remounted.
 */

function Home() {
  usePageCommitted();
  return (
    <main id="content">
      <h1>Home</h1>
      <section data-chrome="dark">the pile</section>
    </main>
  );
}

function Notes() {
  usePageCommitted();
  return (
    <main id="content">
      <h1>Notes</h1>
    </main>
  );
}

const site = (lazyRoute?: ReactNode) =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <TooltipProvider>
        <Routes>
          <Route element={<SiteChrome />}>
            <Route path="/" element={<Home />} />
            <Route path="/blog" element={<Notes />} />
            {lazyRoute}
          </Route>
        </Routes>
      </TooltipProvider>
    </MemoryRouter>
  );

/* The bar's own route link, by name. The sheet repeats the routes, and the
   one in the bar is first in document order. */
const routeLink = (name: string) => screen.getAllByRole("link", { name })[0];

describe("the chrome across a route change", () => {
  it("keeps the same bar, toggle and skip link when the page under it changes", async () => {
    const user = userEvent.setup();
    site();

    const bar = screen.getByRole("banner");
    const toggle = screen.getByRole("button", { name: /^Menu/ });
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();

    await user.click(routeLink("All notes"));

    /* The navigation happened — a different page component is mounted… */
    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Home" })).toBeNull();

    /* …and the chrome is the same elements, not equal-looking new ones. */
    expect(screen.getByRole("banner")).toBe(bar);
    expect(screen.getByRole("button", { name: /^Menu/ })).toBe(toggle);
    expect(screen.getByRole("link", { name: "Skip to content" })).toBe(skip);
    expect(bar.isConnected).toBe(true);

    /* And it re-rendered for the new route rather than freezing on the old
       one: the room it marks as current followed the reader. */
    expect(routeLink("All notes")).toHaveAttribute("aria-current", "page");
    expect(routeLink("Home")).not.toHaveAttribute("aria-current");
  });

  it("closes an open sheet on navigation, now that nothing destroys it", async () => {
    const user = userEvent.setup();
    site();

    const toggle = screen.getByRole("button", { name: /^Menu/ });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    /* The sheet's own copy of the link — the one a phone reader taps. */
    const links = screen.getAllByRole("link", { name: "All notes", hidden: true });
    await user.click(links[links.length - 1]);

    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    /* Same toggle, so this is the state of the surviving bar — not the
       default of a new one. */
    expect(screen.getByRole("button", { expanded: false, name: /^Menu/ })).toBe(toggle);
    expect(document.getElementById("nav-menu")).not.toBeVisible();
  });
});

/*
 * The cost of the hoist, held.
 *
 * Mounted with its page, the dark-chrome observer always found the page's
 * panels on its first pass. Above the routes, the pathname can change while a
 * lazy page is still a pending chunk, and the first pass finds an empty
 * Suspense. The page-commit signal is what makes it look again; without it the
 * bar would wait for the 900ms late read, or miss a slow chunk entirely. This
 * asserts the panel is observed as soon as the page commits — with real
 * timers, well inside that 900ms, so the late read cannot be what passed it.
 */
describe("the dark-chrome observer under a hoisted chrome", () => {
  const RealIO = globalThis.IntersectionObserver;
  afterEach(() => {
    globalThis.IntersectionObserver = RealIO;
  });

  it("observes a lazy page's dark panel when the page commits, not on a timer", async () => {
    const observed: Element[] = [];
    globalThis.IntersectionObserver = class extends RealIO {
      observe(target: Element) {
        observed.push(target);
      }
    } as typeof IntersectionObserver;

    let arrive!: (m: { default: ComponentType }) => void;
    const Rooms = lazy(
      () => new Promise<{ default: ComponentType }>((resolve) => (arrive = resolve))
    );
    function RoomsPage() {
      usePageCommitted();
      return (
        <main id="content">
          <h1>Rooms</h1>
          <div data-chrome="dark">the plates</div>
        </main>
      );
    }

    const user = userEvent.setup();
    site(
      <Route
        path="/projects"
        element={
          <Suspense fallback={null}>
            <Rooms />
          </Suspense>
        }
      />
    );

    const bar = screen.getByRole("banner");
    await user.click(routeLink("All work"));

    /* The address has moved and the page has not: the bar is still here, and
       nothing on the page is dark yet. */
    expect(screen.getByRole("banner")).toBe(bar);
    expect(document.querySelector(DARK_PANEL_SELECTOR)).toBeNull();
    observed.length = 0;

    const started = performance.now();
    await act(async () => arrive({ default: RoomsPage }));

    const panel = document.querySelector(DARK_PANEL_SELECTOR);
    expect(panel).not.toBeNull();
    expect(observed).toContain(panel);
    expect(performance.now() - started).toBeLessThan(900);
  });
});
