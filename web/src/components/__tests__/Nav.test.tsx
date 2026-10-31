import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import Nav from "@/components/Nav";
import { indexLabel, NAV_INDEX } from "@/components/nav/navIndex";
import { objectAnchorId } from "@/lib/objectAnchor";
import { projects } from "@/data/projects";

/*
 * What is worth testing in the chrome is the promises, not the markup.
 *
 * jsdom has no layout and the IntersectionObserver in `setupTests.ts` is a
 * stub that never fires, which is exactly the state the nav has to survive:
 * no plate resolves, so every index item falls back to the object's own page.
 * That is the degraded path and it is the one most likely to rot, because in
 * a browser on the home page it is never taken.
 */

const chrome = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <TooltipProvider>
        <Nav />
      </TooltipProvider>
    </MemoryRouter>
  );

describe("the nav as an index", () => {
  it("prints the collection, in the collection's own order", () => {
    chrome();
    const index = screen.getAllByRole("navigation", { name: "Index" })[0];
    const names = within(index)
      .getAllByRole("link")
      .map((a) => a.textContent);

    /* Generated from the project table rather than from a list in the chrome:
       a project added to the data has to appear here without this file being
       touched, which is the whole claim the index makes. */
    const expected = [...projects]
      .sort((a, b) => a.order - b.order)
      .map((p) => indexLabel(p.title, p.fact));

    expect(names).toEqual([...expected, "Notes", "Contact"]);
  });

  it("points every object at somewhere real when no plate is on the page", () => {
    chrome();
    const index = screen.getAllByRole("navigation", { name: "Index" })[0];
    /* The failure this guards against is an index of eight `#anchor` links on
       a page that has none of them — eight clicks that do nothing at all. */
    for (const link of within(index).getAllByRole("link")) {
      /* A route, never a fragment: Contact's is "/" plus a scroll the chrome
         finishes once the collection page has painted. */
      expect(link.getAttribute("href")).toMatch(/^\//);
    }
  });

  it("gives each object the anchor the plates are told to publish", () => {
    /* The chrome and the gallery agree on one spelling through one function;
       this is the assertion that the chrome is actually using it. */
    for (const p of projects) {
      const item = NAV_INDEX.find((i) => i.key === p.slug);
      expect(item?.anchor).toBe(objectAnchorId(p.slug));
    }
  });

  it("shortens only the name that cannot fit, and never to a stub", () => {
    expect(indexLabel("WindoM", "Every new tab becomes a dashboard")).toBe("WindoM");
    expect(indexLabel("Programming with Yehuda", "Programming lessons, by concept")).toBe(
      "Programming"
    );
    /* A fact line opening on a one- or two-letter word names nothing, so the
       real title survives rather than being replaced by "A". */
    expect(indexLabel("An Extremely Long Name", "A thing that does things")).toBe(
      "An Extremely Long Name"
    );
  });

  it("carries the routes without letting them impersonate the objects", () => {
    chrome();
    const pages = screen.getAllByRole("navigation", { name: "Pages" })[0];
    const labels = within(pages)
      .getAllByRole("link")
      .map((a) => a.textContent);
    expect(labels).toEqual(["Home", "All work", "All notes"]);

    /* "All notes" rather than "Notes": the index already has an item by that
       name pointing at the shelf, and two links a hundred pixels apart with
       one label and two destinations is the thing this naming prevents. */
    const index = screen.getAllByRole("navigation", { name: "Index" })[0];
    expect(within(index).getByText("Notes")).toBeInTheDocument();
    expect(within(pages).queryByText("Notes")).toBeNull();
  });

  it("marks the room you are in as the page, and nothing as the location", () => {
    chrome();
    const pages = screen.getAllByRole("navigation", { name: "Pages" })[0];
    expect(within(pages).getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    /* Nothing is marked `location` here because no plate resolved. A stray
       `location` in this state would mean the mark was being derived from the
       route rather than from where the reader actually is. */
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

  it("collapses to the index rather than to a menu button", async () => {
    chrome();
    /* The control names what it opens and says where the reader is — with no
       plate resolved, how many objects are in the room. A control that said
       only "Open menu" would be the hamburger this replaced. */
    const toggle = screen.getByRole("button", { name: /Index/ });
    expect(toggle).toHaveTextContent(String(NAV_INDEX.length));
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    const sheet = document.getElementById("nav-index");
    expect(sheet).toHaveAttribute("hidden");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(sheet).not.toHaveAttribute("hidden");
    expect(document.body.style.overflow).toBe("hidden");

    /* Escape closes one layer and hands focus back to the control that opened
       it; without the second half the keyboard reader is left on <body>. */
    await userEvent.keyboard("{Escape}");
    expect(sheet).toHaveAttribute("hidden");
    expect(document.activeElement).toBe(toggle);
    expect(document.body.style.overflow).toBe("");
  });

  it("puts the whole index in the sheet, not just the routes", async () => {
    chrome();
    await userEvent.click(screen.getByRole("button", { name: /Index/ }));
    const sheet = document.getElementById("nav-index");
    expect(sheet).not.toBeNull();
    const inSheet = within(sheet as HTMLElement);
    for (const item of NAV_INDEX) {
      expect(inSheet.getByRole("link", { name: item.label })).toBeInTheDocument();
    }
    expect(inSheet.getByRole("link", { name: "All work" })).toBeInTheDocument();
    expect(inSheet.getByRole("link", { name: "Email" })).toBeInTheDocument();
  });
});
