import type { ReactElement } from "react";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { readCss } from "@/test/noPreference";
import { NewMenu, RECENT_MAX, readRecents, rememberCreated } from "@/components/ui/NewMenu";
import { PageHeader } from "@/components/ui/PageHeader";

const css = readCss(resolve(__dirname, "NewMenu.module.css"));

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}
const mount = (ui: ReactElement) =>
  render(
    <MemoryRouter>
      {ui}
      <Where />
    </MemoryRouter>,
  );

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("lang");
  vi.unstubAllGlobals();
});

describe("NewMenu (principle 15)", () => {
  it("is a split button: the page's own create, and a caret", () => {
    const own = vi.fn();
    mount(<NewMenu primary={{ id: "new", label: "New post", onSelect: own }} />);
    const root = document.querySelector("[data-new-menu]") as HTMLElement;
    expect(within(root).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["New post", "More to create"]);
  });

  it("the big half runs the page's own create", async () => {
    const own = vi.fn();
    mount(<NewMenu primary={{ id: "new", label: "New post", onSelect: own }} />);
    await userEvent.click(screen.getByRole("button", { name: "New post" }));
    expect(own).toHaveBeenCalledTimes(1);
  });

  it("the menu lists the page's own create first, then the common creates, without listing the page's own twice", async () => {
    mount(<NewMenu primary={{ id: "new", label: "New post", onSelect: vi.fn() }} />);
    await userEvent.click(screen.getByRole("button", { name: "More to create" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["New post", "New area", "Upload media", "New campaign", "Add contact"]);
  });

  it("a common create goes to its page and is remembered as Recent, newest first, three at most, once each", async () => {
    mount(<NewMenu primary={{ id: "new", label: "New post", onSelect: vi.fn() }} />);
    for (const name of ["New area", "Upload media", "New campaign", "Add contact", "New area"]) {
      await userEvent.click(screen.getByRole("button", { name: "More to create" }));
      await userEvent.click(await screen.findByRole("menuitem", { name }));
    }
    expect(screen.getByTestId("where")).toHaveTextContent("/admin/areas/new");
    expect(readRecents().map((r) => r.label)).toEqual(["New area", "Add contact", "New campaign"]);
    expect(readRecents()).toHaveLength(RECENT_MAX);
    await userEvent.click(screen.getByRole("button", { name: "More to create" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Recent")).toBeInTheDocument();
  });

  it("keeps recents it did not make itself, and survives blocked storage", () => {
    rememberCreated({ id: "p1", label: "Autumn issue", href: "/admin/marketing" });
    expect(readRecents()[0].label).toBe("Autumn issue");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => rememberCreated({ id: "p2", label: "x", href: "/x" })).not.toThrow();
  });

  it("says once that the palette reaches everything", async () => {
    mount(<NewMenu primary={{ id: "new", label: "New post", onSelect: vi.fn() }} />);
    await userEvent.click(screen.getByRole("button", { name: "More to create" }));
    expect(await screen.findByText(/finds anything/)).toBeInTheDocument();
  });

  it("speaks Hebrew with the caret on the logical end", async () => {
    document.documentElement.setAttribute("lang", "he");
    mount(<NewMenu primary={{ id: "new", label: "רשימה חדשה", onSelect: vi.fn() }} />);
    await userEvent.click(screen.getByRole("button", { name: "עוד ליצור" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((m) => m.textContent)).toContain("תחום חדש");
    expect(css.replace(/text-align:\s*right/g, "")).not.toMatch(/\b(margin|padding|inset|border)-(left|right)\b/);
    expect(css).toMatch(/border-start-end-radius/);
  });

  it("on a phone the caret opens the same list as a bottom sheet with 44px rows", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("max-width: 599px"), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    Object.assign(HTMLDialogElement.prototype, {
      showModal: vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute("open", "");
      }),
      close: vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute("open");
      }),
    });
    mount(<NewMenu primary={{ id: "new", label: "New post", onSelect: vi.fn() }} />);
    await userEvent.click(screen.getByRole("button", { name: "More to create" }));
    const rows = await screen.findAllByRole("menuitem", { hidden: true });
    expect(rows.map((r) => r.textContent)).toContain("Upload media");
    expect(css).toMatch(/\.sheetRow\s*\{[^}]*min-block-size:\s*44px/);
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
  });
});

describe("PageHeader newMenu", () => {
  it("replaces the plain primary with the split button, once", () => {
    mount(<PageHeader title="Posts" newMenu primary={{ id: "new", label: "New post", icon: () => null, onSelect: vi.fn() }} />);
    expect(screen.getAllByRole("button", { name: "New post" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "More to create" })).toBeInTheDocument();
  });

  it("without newMenu the header is unchanged", () => {
    mount(<PageHeader title="Posts" primary={{ id: "new", label: "New post", icon: () => null, onSelect: vi.fn() }} />);
    expect(screen.queryByRole("button", { name: "More to create" })).toBeNull();
  });
});
