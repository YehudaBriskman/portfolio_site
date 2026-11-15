import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { outsideNoPreference, readCss } from "@/test/noPreference";
import { EditableCell } from "@/components/ui/EditableCell";

const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast }));

const css = readCss(resolve(__dirname, "EditableCell.module.css"));
afterEach(() => {
  document.documentElement.removeAttribute("lang");
  toast.success.mockClear();
});

describe("EditableCell (principle 11)", () => {
  it("reads as text with a name that says what it edits; click opens the field", async () => {
    render(<EditableCell value="Hello" label="Title" onSave={vi.fn()} />);
    const open = screen.getByRole("button", { name: /Edit Title/ });
    expect(open).toHaveTextContent("Hello");
    await userEvent.click(open);
    expect(screen.getByRole("textbox", { name: "Edit Title" })).toHaveFocus();
  });

  it("Enter saves, closes, returns focus and offers Undo that restores the old value", async () => {
    const onSave = vi.fn();
    render(<EditableCell value="Hello" label="Title" onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: /Edit Title/ }));
    await userEvent.keyboard("{Control>}a{/Control}World{Enter}");
    expect(onSave).toHaveBeenCalledWith("World");
    expect(screen.queryByRole("textbox")).toBeNull();
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const opts = toast.success.mock.calls[0][1];
    expect(opts.action.label).toBe("Undo");
    opts.action.onClick();
    expect(onSave).toHaveBeenLastCalledWith("Hello");
  });

  it("Escape cancels: nothing is saved, no toast, and it is not passed on to a panel", async () => {
    const onSave = vi.fn();
    const outer = vi.fn();
    render(
      <div onKeyDown={outer}>
        <EditableCell value="Hello" label="Title" onSave={onSave} />
      </div>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Edit Title/ }));
    await userEvent.keyboard("x{Escape}");
    expect(onSave).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(outer).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Edit Title/ })).toHaveTextContent("Hello");
  });

  it("an unchanged value is not a save", async () => {
    const onSave = vi.fn();
    render(<EditableCell value="Hello" label="Title" onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: /Edit Title/ }));
    await userEvent.keyboard("{Enter}");
    expect(onSave).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("a number must be a number in range: otherwise the field stays open, marked invalid, nothing sent", async () => {
    const onSave = vi.fn();
    render(<EditableCell kind="number" value={5} min={0} max={10} label="Views" onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: /Edit Views/ }));
    await userEvent.keyboard("{Control>}a{/Control}99{Enter}");
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("spinbutton", { name: "Edit Views" })).toHaveAttribute("aria-invalid", "true");
    await userEvent.keyboard("{Control>}a{/Control}7{Enter}");
    expect(onSave).toHaveBeenCalledWith(7);
  });

  it("a select saves on choice and shows the option's label at rest", async () => {
    const onSave = vi.fn();
    render(
      <EditableCell
        kind="select"
        value="draft"
        label="Status"
        options={[
          { value: "draft", label: "Draft" },
          { value: "live", label: "Live" },
        ]}
        onSave={onSave}
      />,
    );
    expect(screen.getByRole("button", { name: /Edit Status/ })).toHaveTextContent("Draft");
    await userEvent.click(screen.getByRole("button", { name: /Edit Status/ }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Edit Status" }), "live");
    expect(onSave).toHaveBeenCalledWith("live");
  });

  it("a rejected save says nothing happened: no toast", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("no"));
    render(<EditableCell value="Hello" label="Title" onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: /Edit Title/ }));
    await userEvent.keyboard("x{Enter}");
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("a disabled cell does not open", async () => {
    render(<EditableCell value="Hello" label="Title" disabled onSave={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Edit Title/ }));
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("is a one-word field in RTL too: dir=auto on text, logical CSS, no motion outside no-preference, hover inside (hover: hover)", async () => {
    document.documentElement.setAttribute("lang", "he");
    render(<EditableCell value="שלום" label="כותרת" onSave={vi.fn()} />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("textbox")).toHaveAttribute("dir", "auto");
    expect(outsideNoPreference(css)).not.toMatch(/\b(transition|animation)\s*:/);
    expect(css.replace(/text-align:\s*right/g, "")).not.toMatch(/\b(margin|padding|inset|border)-(left|right)\b/);
    expect(css).toMatch(/@media \(hover: hover\)/);
  });

  it("is never under 24px tall and its text never under 12px", () => {
    expect(css).toMatch(/min-block-size:\s*1\.5rem/);
    expect(css).toMatch(/font-size:\s*max\(0\.75rem/);
  });
});
