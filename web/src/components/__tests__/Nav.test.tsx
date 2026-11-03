import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import Nav from "@/components/Nav";
import { NAV_ROUTES } from "@/components/nav/navRoutes";
import { TUCK_SLACK } from "@/components/nav/useTuckedBar";

/*
 * What is worth testing in the chrome is the promises, not the markup.
 *
 * The promise this file was written around has changed: the bar used to be an
 * index generated from the project table, and most of these tests were about
 * what happened when a plate was or was not in the document. The bar now
 * carries three rooms, two marks and two switches, and the thing most likely
 * to rot is the *absence* — a chrome that quietly grows an object link again,
 * or a sheet that keeps one after the bar has dropped it. So the assertions
 * are about the set, and they are written so that anything added to it fails
 * them rather than slipping past.
 *
 * jsdom has no layout, which is why the tab trap is not tested here: the trap
 * filters its focus stops by `offsetParent !== null`, and in jsdom that is
 * null for every element, so the trap correctly declines to act and there is
 * nothing to assert. It is measured in a browser instead.
 */

const chrome = (at = "/") =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <TooltipProvider>
        <Nav />
      </TooltipProvider>
    </MemoryRouter>
  );

describe("the chrome as the main links only", () => {
  it("carries the four rooms and nothing else you can navigate to", () => {
    chrome();
    const pages = screen.getAllByRole("navigation", { name: "Pages" })[0];
    const labels = within(pages)
      .getAllByRole("link")
      .map((a) => a.textContent);
    /* The owner's words in the owner's order (#222). The routes under them
       did not move, so the order is asserted with the addresses too. */
    expect(labels).toEqual(["Home", "Journey", "Work", "Blogs"]);
    expect(within(pages).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/",
      "/story",
      "/projects",
      "/blog",
    ]);

    /* The index landmark is gone rather than emptied: an empty `nav` that a
       screen reader still announces is the half-finished version of this. */
    expect(screen.queryAllByRole("navigation", { name: "Index" })).toHaveLength(0);
  });

  it("holds no link to an object's plate anywhere in the chrome", () => {
    const { container } = chrome();
    /* The whole header, bar and sheet together, including the sheet while it
       is hidden — the failure this guards against is an object index that
       survives on a phone after being taken out of the bar. */
    const hrefs = [...container.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
    expect(hrefs.filter((h) => h?.includes("#object-"))).toEqual([]);
    /* No in-page fragment at all: every destination in the chrome is a room,
       an outbound profile or a mailto. "Home" is the one exception and it is
       a route — the hop back to the title plate is done in code so that the
       same link is a route change from anywhere else. */
    expect(hrefs.filter((h) => h?.startsWith("#"))).toEqual([]);
  });

  it("carries a Hebrew label for every room, in the same order", () => {
    /* The Hebrew locale is still disabled (see locale.ts), so this is checked
       on the table rather than on screen: when it is switched on, every room
       has to have its word already, and no two rooms may share one. */
    expect(NAV_ROUTES.map((r) => r.label.he)).toEqual(["בית", "מסלול מקצועי", "פרויקטים", "בלוג"]);
  });

  it("marks the room you are in as the page, and marks nothing as a location", () => {
    chrome("/projects/icaros");
    const pages = screen.getAllByRole("navigation", { name: "Pages" })[0];
    /* The prefix match is what marks the room from inside it: a project page
       is still "Work". */
    expect(within(pages).getByRole("link", { name: "Work" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(pages).getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");

    /*
     * `aria-current="location"` has one less meaning than it had.
     *
     * It used to track which object the reader was standing on, through the
     * pile, and the decision to let that go rather than replace it is written
     * out at the head of Nav.tsx. A stray `location` here would mean a
     * current-object indicator had come back without that decision being
     * revisited.
     */
    expect(document.querySelectorAll('[aria-current="location"]')).toHaveLength(0);
  });

  it("has no wordmark anywhere in the chrome", () => {
    const { container } = chrome();
    expect(container.textContent).not.toMatch(/Y\.B/);
  });

  it("names the marks, because a logotype is not a name", () => {
    chrome();
    const elsewhere = screen.getAllByRole("navigation", { name: "Elsewhere" })[0];
    const github = within(elsewhere).getByRole("link", { name: "GitHub" });
    expect(github).toHaveAttribute("href", expect.stringContaining("github.com"));
    /* A tab opened with target=_blank can reach back through window.opener. */
    expect(github).toHaveAttribute("rel", "noreferrer noopener");
    expect(within(elsewhere).getByRole("link", { name: "LinkedIn" })).toBeInTheDocument();
  });

  it("collapses to one word, and the open menu is what marks the room", async () => {
    chrome("/blog");
    /* #161: the control is "Menu" and nothing else — the room's name was the
       second line of a cramped pill and is said by the page's h1 and by the
       sheet's inked row. Its accessible name is exactly its visible text. */
    const toggle = screen.getByRole("button", { name: "Menu" });
    for (const r of NAV_ROUTES) expect(toggle).not.toHaveTextContent(r.label.en);
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    const sheet = document.getElementById("nav-menu");
    expect(sheet).toHaveAttribute("hidden");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(sheet).not.toHaveAttribute("hidden");
    expect(within(sheet!).getByRole("link", { name: "Blogs" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    /* Escape closes one layer and hands focus back to the control that opened
       it; without the second half the keyboard reader is left on <body>. */
    await userEvent.keyboard("{Escape}");
    expect(sheet).toHaveAttribute("hidden");
    expect(document.activeElement).toBe(toggle);
  });

  /*
   * The scroll lock, asserted on the element it is actually on.
   *
   * This read `document.body.style.overflow` and passed while the lock did
   * nothing: measured in Chromium at 390x844, `body`'s overflow left the page
   * scrolling freely under the open panel and took 15.01px off `#root`,
   * because `body` carries `scrollbar-gutter: stable` and is not the
   * scrollport. The two properties below are the pair that holds the page
   * still *and* holds its width — the long version is in Nav.tsx. `body`
   * is asserted untouched because that is where the fifteen pixels went.
   */
  it("locks the scrollport, not the body, and puts both properties back", async () => {
    chrome();
    const toggle = screen.getByRole("button", { name: /Menu/ });
    const root = document.documentElement;

    await userEvent.click(toggle);
    expect(root.style.overflow).toBe("hidden");
    expect(root.style.getPropertyValue("scrollbar-gutter")).toBe("stable");
    expect(document.body.style.overflow).toBe("");

    await userEvent.keyboard("{Escape}");
    expect(root.style.overflow).toBe("");
    expect(root.style.getPropertyValue("scrollbar-gutter")).toBe("");
  });

  /*
   * The scrim: the dim, the way out, and the half of the lock that is CSS.
   *
   * Queried structurally because it is deliberately not in the accessibility
   * tree — it is a pointer affordance for something Escape and the toggle
   * already do — and it is the only direct child of the header carrying
   * `aria-hidden`. Whether it dims or absorbs a wheel is a question for a
   * browser; what belongs here is that it appears and disappears with the
   * panel and that dismissing it puts the reader back on the control.
   */
  it("opens a scrim with the panel, and a tap on it closes and hands focus back", async () => {
    const { container } = chrome();
    const scrim = container.querySelector("header > div[aria-hidden='true']");
    expect(scrim).not.toBeNull();
    expect(scrim).toHaveAttribute("hidden");

    const toggle = screen.getByRole("button", { name: /Menu/ });
    await userEvent.click(toggle);
    expect(scrim).not.toHaveAttribute("hidden");

    await userEvent.click(scrim as HTMLElement);
    expect(scrim).toHaveAttribute("hidden");
    expect(document.getElementById("nav-menu")).toHaveAttribute("hidden");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(toggle);
  });

  it("gives the sheet the same set the bar carries", async () => {
    chrome();
    await userEvent.click(screen.getByRole("button", { name: /Menu/ }));
    const sheet = document.getElementById("nav-menu");
    expect(sheet).not.toBeNull();
    const inSheet = within(sheet as HTMLElement);

    for (const r of NAV_ROUTES) {
      expect(inSheet.getByRole("link", { name: r.label.en })).toBeInTheDocument();
    }
    /* The marks become words here, where there is room for both, and the
       address is the one thing the sheet carries that the bar does not — see
       the note on `EMAIL` in nav/social.ts. */
    expect(inSheet.getByRole("link", { name: "GitHub" })).toBeInTheDocument();
    expect(inSheet.getByRole("link", { name: "Email" })).toBeInTheDocument();

    /* Four rooms (the story joined in #46), two profiles, one address: seven
       links and no eighth. The
       count is the assertion — an index put back in the sheet would pass every
       check above this line. */
    expect(inSheet.getAllByRole("link")).toHaveLength(7);
  });
});

/*
 * #161: the bar tucks away on the way down and comes back on the way up.
 *
 * jsdom has no scrolling, so `scrollY` is set by hand and the event fired; the
 * travel and the fade are CSS and are measured in a browser (docs/nav/). What
 * is asserted is the promise the script makes: when `data-tucked` is set.
 */
describe("the bar getting out of the way", () => {
  const scrollTo = (y: number) =>
    act(() => {
      Object.defineProperty(window, "scrollY", { value: y, configurable: true });
      window.dispatchEvent(new Event("scroll"));
    });
  const dock = () => document.querySelector("header")!;

  afterEach(() => {
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  it("tucks on the way down and comes back on the way up", () => {
    chrome();
    expect(dock()).not.toHaveAttribute("data-tucked");
    scrollTo(400);
    expect(dock()).toHaveAttribute("data-tucked");
    scrollTo(400 - TUCK_SLACK);
    expect(dock()).not.toHaveAttribute("data-tucked");
  });

  it("ignores a settle shorter than the slack", () => {
    chrome();
    scrollTo(400);
    scrollTo(399);
    expect(dock()).toHaveAttribute("data-tucked");
  });

  it("never tucks within its own height of the top", () => {
    chrome();
    scrollTo(40);
    expect(dock()).not.toHaveAttribute("data-tucked");
    scrollTo(400);
    scrollTo(500);
    scrollTo(20);
    expect(dock()).not.toHaveAttribute("data-tucked");
  });

  it("comes back when anything in it takes focus", () => {
    chrome();
    scrollTo(400);
    expect(dock()).toHaveAttribute("data-tucked");
    act(() => screen.getAllByRole("link", { name: "Work" })[0].focus());
    expect(dock()).not.toHaveAttribute("data-tucked");
  });

  it("stays while the panel is open", async () => {
    chrome();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    scrollTo(400);
    scrollTo(800);
    expect(dock()).not.toHaveAttribute("data-tucked");
  });
});
