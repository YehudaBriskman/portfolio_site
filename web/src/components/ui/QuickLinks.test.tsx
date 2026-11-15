import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ICON } from "@/components/ui/icons";
import { QuickLinks, type QuickLink } from "@/components/ui/QuickLinks";
import { PanelGrid } from "@/components/ui/PanelGrid";

const LINKS: QuickLink[] = [
  { id: "new", label: "New post", to: "/admin/posts/new", icon: ICON.add },
  { id: "media", label: "Media", to: "/admin/media", icon: ICON.image },
  { id: "inbox", label: "Inbox", to: "/admin/marketing", icon: ICON.announcement },
];

const mount = (pinned = ["new", "media"]) =>
  render(
    <MemoryRouter>
      <PanelGrid>
        <QuickLinks id="ql" storageKey="qltest" links={LINKS} defaultPinned={pinned} />
      </PanelGrid>
    </MemoryRouter>,
  );

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  document.documentElement.lang = "en";
  document.documentElement.removeAttribute("dir");
});

describe("QuickLinks", () => {
  it("shows the pinned links, in order, as links", () => {
    mount();
    const region = screen.getByRole("region", { name: "Quick links" });
    expect(within(region).getAllByRole("link").map((a) => a.textContent)).toEqual(["New post", "Media"]);
  });

  it("edit mode lists every link as a toggle, and pinning one adds it", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const inbox = screen.getByRole("button", { name: "Pin Inbox" });
    expect(inbox.getAttribute("aria-pressed")).toBe("false");
    await user.click(inbox);
    expect(screen.getByRole("button", { name: "Unpin Inbox" }).getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["New post", "Media", "Inbox"]);
  });

  it("persists the pins in localStorage and restores them", async () => {
    const user = userEvent.setup();
    const first = mount();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Unpin Media" }));
    expect(JSON.parse(localStorage.getItem("qltest")!)).toEqual(["new"]);
    first.unmount();
    mount();
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["New post"]);
  });

  it("drops a stored id the catalogue no longer has", () => {
    localStorage.setItem("qltest", JSON.stringify(["gone", "media"]));
    mount();
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["Media"]);
  });

  it("falls back to the defaults when storage is broken", () => {
    localStorage.setItem("qltest", "{nope");
    mount();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("says so, with a way to edit, when nothing is pinned", () => {
    mount([]);
    expect(screen.getByText("Nothing pinned")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
  });

  it("is Hebrew in a Hebrew page", () => {
    document.documentElement.lang = "he";
    document.documentElement.setAttribute("dir", "rtl");
    mount();
    expect(screen.getByRole("region", { name: "קיצורים" })).toBeTruthy();
  });
});
