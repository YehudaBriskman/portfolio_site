import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import PhoneBrowse from "@/components/gallery/PhoneBrowse";
import type { FacetSpec } from "@/components/gallery/FilterControl";

/*
 * The phone Browse (#808): what the menu's local section is made of.
 * Geometry is measured in a browser; this is the contract: order, one popover
 * at a time, URL-driven choices, the footer.
 */

const facets: FacetSpec[] = [
  { key: "state", label: "State", options: [{ value: "Live", count: 3 }, { value: "In use", count: 2 }] },
  { key: "stack", label: "Stack", options: [{ value: "Go", count: 4 }, { value: "Rust", count: 0 }] },
  { key: "year", label: "Year", options: [{ value: "2026", count: 5 }] },
];

/* jsdom has no <dialog>.showModal: stood in for, as BottomSheet.test.tsx does. */
beforeEach(() => {
  Object.assign(HTMLDialogElement.prototype, {
    showModal: vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    }),
    close: vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    }),
  });
});
afterEach(() => {
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

const onClose = vi.fn();

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}

function Harness({ url, props }: { url: string; props: Partial<Parameters<typeof PhoneBrowse>[0]> }) {
  const l = useLocation();
  const params = new URLSearchParams(l.search);
  const selection: Record<string, string[]> = {
    state: params.getAll("state"),
    year: params.getAll("year"),
    stack: params.getAll("stack"),
  };
  void url;
  return (
    <PhoneBrowse
      open
      onClose={onClose}
      title="Browse"
      facets={facets}
      selection={selection}
      path="/projects"
      shown={5}
      search={<input aria-label="Search" />}
      sort={{
        label: "Sort by",
        options: [
          { value: "a", label: "Newest" },
          { value: "b", label: "Name" },
        ],
        value: "a",
        onChange: () => {},
      }}
      pinned={{ title: "Pinned", items: [{ key: "bothy", to: "/projects/bothy", label: "Bothy", cover: null, tone: "green" }] }}
      moreLabel="More"
      more={<a href="/blog/area/x">An area</a>}
      {...props}
    />
  );
}

function setup(url = "/projects", props: Partial<Parameters<typeof PhoneBrowse>[0]> = {}) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Harness url={url} props={props} />
      <Where />
    </MemoryRouter>,
  );
}

describe("PhoneBrowse", () => {
  beforeEach(() => onClose.mockClear());

  it("is its own sheet titled Browse, not part of the menu", () => {
    setup();
    expect(screen.getByRole("dialog", { hidden: true, name: "Browse" })).toBeTruthy();
  });

  it("orders search, sort, facet chips, pinned, More, then the footer", () => {
    const { container } = setup();
    const order = [
      screen.getByLabelText("Search"),
      screen.getByRole("radiogroup", { name: "Sort by" }),
      screen.getByRole("button", { name: /State/ }),
      screen.getByText("Pinned"),
      screen.getByText("More"),
      container.querySelector("[data-browse-foot]") as HTMLElement,
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("draws a chip per facet, each opening a small popover of options with counts", () => {
    setup();
    const chip = screen.getByRole("button", { name: /State/ });
    expect(chip.getAttribute("aria-haspopup")).toBe("dialog");
    expect(chip.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-expanded")).toBe("true");
    const live = screen.getByRole("button", { name: /Live/ });
    expect(live.textContent).toContain("3");
    expect(live.getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps one popover open at a time", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /State/ }));
    fireEvent.click(screen.getByRole("button", { name: /Stack/ }));
    expect(screen.getByRole("button", { name: /State/ }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: /Stack/ }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByRole("button", { name: /Live/ })).toBeNull();
  });

  it("a choice is the URL, and the popover stays open for the next one", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /State/ }));
    fireEvent.click(screen.getByRole("button", { name: /Live/ }));
    expect(screen.getByTestId("where").textContent).toBe("/projects?state=Live");
    expect(screen.getByRole("button", { name: /State/ }).getAttribute("aria-expanded")).toBe("true");
  });

  it("a chip with a choice is pressed and counts its choices", () => {
    setup("/projects?stack=Go");
    const chip = screen.getByRole("button", { name: /Stack/ });
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(chip.textContent).toContain("1");
  });

  it("holds the rest behind one More disclosure", () => {
    const { container } = setup();
    const more = container.querySelector("details") as HTMLDetailsElement;
    expect(more).not.toBeNull();
    expect(more.open).toBe(false);
    expect(within(more).getByText("More")).toBeTruthy();
    expect(within(more).getByRole("link", { name: "An area", hidden: true })).toBeTruthy();
    expect(container.querySelectorAll("details").length).toBe(1);
  });

  it("the footer says Show N and closes the sheet", () => {
    setup("/projects?sort=name");
    expect(screen.queryByRole("link", { name: "Clear all" })).toBeNull();
    const show = screen.getByRole("button", { name: "Show 5 results", hidden: true });
    fireEvent.click(show);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a link that leaves the page (a pinned project, an area) closes the sheet; Clear does not", () => {
    setup("/projects?state=Live");
    const pin = screen.getByRole("link", { name: /Bothy/, hidden: true });
    pin.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(pin);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("link", { name: "Clear all", hidden: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Clear appears only with a filter on and keeps the rest of the URL", () => {
    setup("/projects?sort=name&state=Live");
    const clear = screen.getByRole("link", { name: "Clear all" });
    expect(clear.getAttribute("href")).toBe("/projects?sort=name");
  });

  it("disables Show when nothing matches", () => {
    setup("/projects?state=Live", { shown: 0 });
    expect((screen.getByRole("button", { name: /Show 0/, hidden: true }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("a pinned project is a thumb link to its page", () => {
    setup();
    expect(screen.getByRole("link", { name: /Bothy/ }).getAttribute("href")).toBe("/projects/bothy");
  });
});
