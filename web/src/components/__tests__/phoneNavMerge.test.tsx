import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { createPortal } from "react-dom";
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

function Page({ label }: { label: string | null }) {
  const slot = useLocalBrowse(label);
  return slot ? createPortal(<a href="/blog/area/x">An area</a>, slot) : null;
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
  it("shows the page's Browse above everything, and only while a page registers one", () => {
    const { rerender } = render(
      <LocalBrowseProvider>
        <LocalSection onLeave={() => {}} />
        <Page label="Browse" />
      </LocalBrowseProvider>,
    );
    const section = document.querySelector("[data-local-browse]") as HTMLElement;
    expect(section).not.toBeNull();
    expect(within(section).getByText("Browse")).toBeTruthy();
    expect(within(section).getByRole("link", { name: "An area" })).toBeTruthy();

    rerender(
      <LocalBrowseProvider>
        <LocalSection onLeave={() => {}} />
        <Page label={null} />
      </LocalBrowseProvider>,
    );
    expect(document.querySelector("[data-local-browse]")).toBeNull();
  });

  it("closes the sheet on a link that leaves the page, not on a filter control", () => {
    let left = 0;
    render(
      <LocalBrowseProvider>
        <LocalSection onLeave={() => left++} />
        <Page label="Browse" />
      </LocalBrowseProvider>,
    );
    const a = screen.getByRole("link", { name: "An area" });
    a.addEventListener("click", (e) => e.preventDefault());
    a.click();
    expect(left).toBe(1);
  });
});
