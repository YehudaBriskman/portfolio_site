import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readCss } from "@/test/noPreference";
import { RowActions } from "@/components/ui/RowActions";

const css = readCss(resolve(__dirname, "RowActions.module.css"));
const Glyph = ({ className }: { className?: string }) => <svg className={className} />;

function setup(extra = {}) {
  const edit = vi.fn();
  const dup = vi.fn();
  const del = vi.fn();
  render(
    <RowActions
      label="Actions for Alpha"
      moreLabel="More"
      primary={{ id: "edit", icon: Glyph, label: "Edit", onSelect: edit }}
      actions={[
        { id: "dup", icon: Glyph, label: "Duplicate", onSelect: dup },
        { id: "del", icon: Glyph, label: "Delete", onSelect: del, tone: "danger" },
      ]}
      {...extra}
    />,
  );
  return { edit, dup, del };
}

describe("RowActions", () => {
  it("draws one primary and one More, nothing else (A1, A12)", () => {
    setup();
    const bar = screen.getByRole("toolbar", { name: "Actions for Alpha" });
    expect(within(bar).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Edit", "More"]);
  });

  it("runs the primary", () => {
    const { edit } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(edit).toHaveBeenCalledTimes(1);
  });

  it("puts the rest in the menu, the destructive one last", async () => {
    setup({
      actions: [
        { id: "del", icon: Glyph, label: "Delete", onSelect: vi.fn(), tone: "danger" },
        { id: "dup", icon: Glyph, label: "Duplicate", onSelect: vi.fn() },
      ],
    });
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Duplicate", "Delete"]);
  });

  it("with no primary, only More is drawn", () => {
    render(<RowActions label="Actions" moreLabel="More" actions={[{ id: "a", icon: Glyph, label: "A", onSelect: () => {} }]} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("with nothing to do it draws nothing", () => {
    const { container } = render(<RowActions label="Actions" moreLabel="More" actions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("is inert while disabled (select mode)", () => {
    setup({ disabled: true });
    expect(screen.getByRole("toolbar", { name: "Actions for Alpha", hidden: true }).closest("[inert]")).not.toBeNull();
  });

  it("More shows on hover and focus of a fine pointer, always on touch", () => {
    expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/);
    expect(css).toMatch(/:focus-within/);
    expect(css).toMatch(/aria-expanded/);
  });
});
