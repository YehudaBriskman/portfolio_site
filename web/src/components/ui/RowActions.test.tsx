import type { ReactElement } from "react";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { outsideNoPreference, readCss } from "@/test/noPreference";
import { RowActions, type RowAction } from "@/components/ui/RowActions";
import { TableActionsContext } from "@/components/ui/useTablePrefs";

const css = readCss(resolve(__dirname, "RowActions.module.css"));
const Glyph = ({ className }: { className?: string }) => <svg className={className} />;
const act = (id: string, label: string, tone?: "danger"): RowAction => ({ id, icon: Glyph, label, onSelect: vi.fn(), tone });
const names = () => within(screen.getByRole("toolbar", { name: "Actions for Alpha" })).getAllByRole("button").map((b) => b.getAttribute("aria-label"));

function inTable(ui: ReactElement, pinned: string[] | null = null, register = vi.fn()) {
  return render(<TableActionsContext.Provider value={{ pinned, register, disabled: false }}>{ui}</TableActionsContext.Provider>);
}
const four = [act("dup", "Duplicate"), act("pub", "Publish"), act("share", "Share"), act("del", "Delete", "danger")];

describe("RowActions on its own (a list row, a card)", () => {
  it("draws the primary and one More, as before", () => {
    const edit = vi.fn();
    render(<RowActions label="Actions for Alpha" moreLabel="More" primary={{ id: "edit", icon: Glyph, label: "Edit", onSelect: edit }} actions={four} />);
    expect(names()).toEqual(["Edit", "More"]);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(edit).toHaveBeenCalledTimes(1);
  });

  it("with no primary, only More is drawn; with nothing to do, nothing", () => {
    const { container, unmount } = render(<RowActions label="Actions for Alpha" moreLabel="More" actions={[act("a", "A")]} />);
    expect(names()).toEqual(["More"]);
    unmount();
    const empty = render(<RowActions label="Actions" moreLabel="More" actions={[]} />);
    expect(empty.container.firstChild).toBeNull();
    expect(container).toBeTruthy();
  });

  it("is inert while disabled (select mode)", () => {
    render(<RowActions label="Actions for Alpha" moreLabel="More" primary={act("e", "Edit")} actions={[]} disabled />);
    expect(screen.getByRole("toolbar", { name: "Actions for Alpha", hidden: true }).closest("[inert]")).not.toBeNull();
  });
});

describe("RowActions in a table (principle 13)", () => {
  it("draws icons only: no visible word, the label is the name and the tooltip", () => {
    inTable(<RowActions label="Actions for Alpha" moreLabel="More" primary={act("edit", "Edit")} actions={four} />);
    for (const b of within(screen.getByRole("toolbar")).getAllByRole("button")) expect(b.textContent).toBe("");
  });

  it("pins the first two safe actions by default; the rest and the destructive one wait in More, destructive last", async () => {
    inTable(<RowActions label="Actions for Alpha" moreLabel="More" primary={act("edit", "Edit")} actions={four} />);
    expect(names()).toEqual(["Edit", "Duplicate", "More"]);
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Publish", "Share", "Delete"]);
  });

  it("follows the person's pins, up to four, in the row's own order", () => {
    inTable(<RowActions label="Actions for Alpha" moreLabel="More" primary={act("edit", "Edit")} actions={four} />, ["share", "edit", "pub", "dup", "gone"]);
    expect(names()).toEqual(["Edit", "Duplicate", "Publish", "Share", "More"]);
  });

  it("never draws a destructive action, even if it was pinned", () => {
    inTable(<RowActions label="Actions for Alpha" moreLabel="More" primary={act("edit", "Edit")} actions={four} />, ["del", "edit"]);
    expect(names()).toEqual(["Edit", "More"]);
  });

  it("fewer than three actions, none destructive, stay inline with no More", () => {
    inTable(<RowActions label="Actions for Alpha" moreLabel="More" primary={act("edit", "Edit")} actions={[act("dup", "Duplicate")]} />);
    expect(names()).toEqual(["Edit", "Duplicate"]);
  });

  it("with a destructive one, it goes to More even when two actions are all there is", () => {
    inTable(<RowActions label="Actions for Alpha" moreLabel="More" primary={act("edit", "Edit")} actions={[act("del", "Delete", "danger")]} />);
    expect(names()).toEqual(["Edit", "More"]);
  });

  it("tells the table what it offers, once per distinct list", () => {
    const register = vi.fn();
    const { rerender } = inTable(<RowActions label="Actions for Alpha" moreLabel="More" primary={act("edit", "Edit")} actions={four} />, null, register);
    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0][0].map((a: { id: string }) => a.id)).toEqual(["edit", "dup", "pub", "share", "del"]);
    rerender(
      <TableActionsContext.Provider value={{ pinned: null, register, disabled: false }}>
        <RowActions label="Actions for Alpha" moreLabel="More" primary={act("edit", "Edit")} actions={four} />
      </TableActionsContext.Provider>,
    );
    expect(register).toHaveBeenCalledTimes(1);
  });

  it("is inert in select mode", () => {
    render(
      <TableActionsContext.Provider value={{ pinned: null, register: vi.fn(), disabled: true }}>
        <RowActions label="Actions for Alpha" moreLabel="More" primary={act("edit", "Edit")} actions={four} />
      </TableActionsContext.Provider>,
    );
    expect(screen.getByRole("toolbar", { hidden: true }).closest("[inert]")).not.toBeNull();
  });

  it("uses the 28px size, which touch lifts to 44", () => {
    inTable(<RowActions label="Actions for Alpha" moreLabel="More" primary={act("edit", "Edit")} actions={four} />);
    for (const b of within(screen.getByRole("toolbar")).getAllByRole("button")) expect(b.getAttribute("data-size")).toBe("sm");
  });
});

describe("RowActions styles (principle 14)", () => {
  it("dims idle pinned icons on a fine pointer, never hides any, and keeps More at full strength", () => {
    expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/);
    expect(css).toMatch(/opacity:\s*0\.55/);
    expect(css).not.toMatch(/opacity:\s*0;/);
    expect(css).toMatch(/:not\(\[aria-haspopup="menu"\]\)/);
  });

  it("moves opacity only when motion is allowed", () => {
    expect(outsideNoPreference(css)).not.toMatch(/\b(transition|animation)\s*:/);
  });
});
