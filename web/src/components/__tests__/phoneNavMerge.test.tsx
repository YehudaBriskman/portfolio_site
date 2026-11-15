import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BackChip from "@/components/BackChip";
import LocalBrowseProvider from "@/components/nav/LocalBrowseProvider";
import LocalSection from "@/components/nav/LocalSection";
import { useLocalBrowse } from "@/components/nav/localBrowse";

/*
 * The phone merge (#780): what the page and the menu promise each other.
 * Geometry (px to the h1, tuck, focus) is measured in a browser by
 * scripts/a11y/public-nav.mjs; here is only the contract.
 */

function Page({ label, count = 0, seen }: { label: string | null; count?: number; seen?: (tick: number) => void }) {
  const { tick } = useLocalBrowse(label, count);
  useEffect(() => {
    seen?.(tick);
  });
  return null;
}

describe("back chip", () => {
  it("is one link to the parent, named in full, with its arrow hidden from assistive tech", () => {
    render(
      <MemoryRouter>
        <BackChip to="/projects" label="Work" />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Work" });
    expect(link.getAttribute("href")).toBe("/projects");
    expect(link.textContent).toBe("Work");
    expect(link.querySelector("svg")?.closest("[aria-hidden='true']")).not.toBeNull();
  });
});

describe("the menu's local section", () => {
  it("is one Browse row at the top with the filter count, only while a page registers one", () => {
    const { rerender } = render(
      <LocalBrowseProvider>
        <LocalSection onLeave={() => {}} />
        <Page label="Browse" count={2} />
      </LocalBrowseProvider>,
    );
    const section = document.querySelector("[data-local-browse]") as HTMLElement;
    expect(section).not.toBeNull();
    const row = within(section).getByRole("button", { name: /Browse/ });
    expect(row.getAttribute("aria-haspopup")).toBe("dialog");
    expect(row.textContent).toContain("2");
    /* No filters, no chips, no list in the menu: it is one row. */
    expect(section.querySelectorAll("a, input, [role=radio]").length).toBe(0);

    rerender(
      <LocalBrowseProvider>
        <LocalSection onLeave={() => {}} />
        <Page label={null} />
      </LocalBrowseProvider>,
    );
    expect(document.querySelector("[data-local-browse]")).toBeNull();
  });

  it("pressing it closes the menu and tells the page to open its own sheet", () => {
    let left = 0;
    const ticks: number[] = [];
    render(
      <LocalBrowseProvider>
        <LocalSection onLeave={() => left++} />
        <Page label="Browse" seen={(t) => ticks.push(t)} />
      </LocalBrowseProvider>,
    );
    const before = ticks[ticks.length - 1];
    fireEvent.click(screen.getByRole("button", { name: /Browse/ }));
    expect(left).toBe(1);
    expect(ticks[ticks.length - 1]).toBe(before + 1);
  });
});
