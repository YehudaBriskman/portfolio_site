import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Panel } from "@/components/ui/Panel";
import { PanelGrid } from "@/components/ui/PanelGrid";
import { outsideNoPreference, readCss } from "@/test/noPreference";

afterEach(() => {
  cleanup();
  document.documentElement.lang = "en";
  document.documentElement.removeAttribute("dir");
});

const grid = (children: React.ReactNode) =>
  render(
    <MemoryRouter>
      <PanelGrid>{children}</PanelGrid>
    </MemoryRouter>,
  );

describe("Panel", () => {
  it("is a named region with a heading", () => {
    grid(<Panel id="a" title="Recent" span={6}>body</Panel>);
    expect(screen.getByRole("region", { name: "Recent" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Recent" })).toBeTruthy();
  });

  it("sizes by a col-span token on the slot", () => {
    const { container } = grid(<Panel id="a" title="A" span={4}>x</Panel>);
    expect(container.querySelector("[data-span='4']")).toBeTruthy();
  });

  it("has a visible expand button that expands and, on the same button, leaves", async () => {
    const user = userEvent.setup();
    grid(<Panel id="a" title="Recent">body</Panel>);
    const btn = screen.getByRole("button", { name: "Full size" });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    await user.click(btn);
    expect(screen.getByRole("region", { name: "Recent" }).getAttribute("data-expanded")).toBe("true");
    const back = screen.getByRole("button", { name: "Shrink" });
    expect(back).toBe(btn);
    await user.click(back);
    expect(screen.getByRole("region", { name: "Recent" }).getAttribute("data-expanded")).toBeNull();
  });

  it("V expands the panel that holds focus, Esc leaves, and focus returns to the expand button", async () => {
    const user = userEvent.setup();
    grid(
      <>
        <Panel id="a" title="One"><button>inside</button></Panel>
        <Panel id="b" title="Two">x</Panel>
      </>,
    );
    const inside = screen.getByRole("button", { name: "inside" });
    inside.focus();
    await user.keyboard("v");
    expect(screen.getByRole("region", { name: "One" }).getAttribute("data-expanded")).toBe("true");
    expect(screen.getByRole("region", { name: "Two" }).getAttribute("data-expanded")).toBeNull();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("region", { name: "One" }).getAttribute("data-expanded")).toBeNull();
    expect(document.activeElement).toBe(within1("One").getByRole("button", { name: "Full size" }));
  });

  it("Esc leaves even when focus is outside the panel", () => {
    grid(<Panel id="a" title="One">x</Panel>);
    fireEvent.click(screen.getByRole("button", { name: "Full size" }));
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.getByRole("region", { name: "One" }).getAttribute("data-expanded")).toBeNull();
  });

  it("does not take V while typing in a field", async () => {
    const user = userEvent.setup();
    grid(<Panel id="a" title="One"><input aria-label="q" /></Panel>);
    await user.click(screen.getByLabelText("q"));
    await user.keyboard("v");
    expect(screen.getByRole("region", { name: "One" }).getAttribute("data-expanded")).toBeNull();
    expect((screen.getByLabelText("q") as HTMLInputElement).value).toBe("v");
  });

  it("only one panel is expanded at a time", () => {
    grid(
      <>
        <Panel id="a" title="One">x</Panel>
        <Panel id="b" title="Two">x</Panel>
      </>,
    );
    fireEvent.click(within1("One").getByRole("button", { name: "Full size" }));
    fireEvent.click(within1("Two").getByRole("button", { name: "Full size" }));
    expect(document.querySelectorAll("[data-expanded='true']")).toHaveLength(1);
  });

  it("gives a render function the expanded flag (a bigger list when expanded)", () => {
    grid(<Panel id="a" title="One">{(open) => (open ? "ALL" : "FEW")}</Panel>);
    expect(screen.getByText("FEW")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Full size" }));
    expect(screen.getByText("ALL")).toBeTruthy();
  });

  it("menu offers View (when the panel has a screen) and Expand", async () => {
    const user = userEvent.setup();
    grid(<Panel id="a" title="Recent" to="/admin/posts">body</Panel>);
    await user.click(screen.getByRole("button", { name: "Recent, menu" }));
    expect(screen.getByRole("menuitem", { name: "View" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Expand" })).toBeTruthy();
    await user.click(screen.getByRole("menuitem", { name: "Expand" }));
    expect(screen.getByRole("region", { name: "Recent" }).getAttribute("data-expanded")).toBe("true");
  });

  it("has no View item and no stray link without a screen", async () => {
    const user = userEvent.setup();
    grid(<Panel id="a" title="Recent">body</Panel>);
    await user.click(screen.getByRole("button", { name: "Recent, menu" }));
    expect(screen.queryByRole("menuitem", { name: "View" })).toBeNull();
  });

  it("says loading, empty and error in the body, one state at a time", () => {
    const { rerender } = grid(<Panel id="a" title="One" state="loading">x</Panel>);
    expect(screen.getByRole("region", { name: "One" }).getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByText("x")).toBeNull();
    rerender(<MemoryRouter><PanelGrid><Panel id="a" title="One" state="empty" empty="Nothing yet">x</Panel></PanelGrid></MemoryRouter>);
    expect(screen.getByText("Nothing yet")).toBeTruthy();
    rerender(<MemoryRouter><PanelGrid><Panel id="a" title="One" state="error">x</Panel></PanelGrid></MemoryRouter>);
    expect(screen.getByRole("alert").textContent).toBe("Could not load");
  });

  it("speaks Hebrew in a Hebrew page", () => {
    document.documentElement.lang = "he";
    document.documentElement.setAttribute("dir", "rtl");
    grid(<Panel id="a" title="פעילות">x</Panel>);
    expect(screen.getByRole("button", { name: "מסך מלא" })).toBeTruthy();
  });

  it("works outside a grid, with its own state", () => {
    render(<MemoryRouter><Panel id="a" title="Solo">x</Panel></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Full size" }));
    expect(screen.getByRole("region", { name: "Solo" }).getAttribute("data-expanded")).toBe("true");
  });
});

function within1(name: string) {
  const region = screen.getByRole("region", { name });
  return {
    getByRole: (role: string, o: { name: string }) =>
      [...region.querySelectorAll<HTMLElement>("button")].find((b) => b.getAttribute("aria-label") === o.name || b.textContent === o.name) as HTMLElement,
  };
}

describe("Panel and PanelGrid styles", () => {
  const css = readCss(resolve(__dirname, "Panel.module.css")) + readCss(resolve(__dirname, "PanelGrid.module.css"));
  it("has a twelve-column grid and one column on a phone", () => {
    expect(css).toMatch(/repeat\(12,/);
    expect(css).toMatch(/max-width:\s*599px/);
  });
  it("moves only inside prefers-reduced-motion: no-preference", () => {
    const bare = outsideNoPreference(css);
    expect(bare).not.toMatch(/\btransition\s*:/);
    expect(bare).not.toMatch(/\banimation\s*:/);
    expect(bare).not.toMatch(/@keyframes/);
  });
  it("uses logical properties only", () => {
    expect(css).not.toMatch(/\b(margin|padding)-(left|right)\b|\b(left|right)\s*:/);
  });
});
describe("Panel fit", () => {
  it("stretches by default and sizes to its content on request", () => {
    const { container } = grid(<><Panel id="a" title="A">x</Panel><Panel id="b" title="B" fit="content">y</Panel></>);
    expect(container.querySelectorAll("[data-fit='content']").length).toBe(1);
    expect(readCss(resolve(__dirname, "Panel.module.css"))).toMatch(/\[data-fit="content"\]\s*\{[^}]*align-self:\s*start/);
  });
});
