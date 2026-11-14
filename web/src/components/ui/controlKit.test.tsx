import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconButton } from "@/components/ui/IconButton";
import { ControlBar, type ControlItem } from "@/components/ui/ControlBar";
import { CreateMenu } from "@/components/ui/CreateMenu";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { Dock } from "@/components/ui/Dock";
import { StatChip } from "@/components/ui/StatChip";

/* Test icon: the kit takes the icon as a prop, so the tests need no icon set. */
const Glyph = (p: { className?: string; "aria-hidden"?: boolean | "true" }) => (
  <svg data-testid="glyph" className={p.className} aria-hidden={p["aria-hidden"]} />
);

const css = (name: string) => readFileSync(resolve(__dirname, name), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("IconButton", () => {
  it("names the button with its label", () => {
    render(<IconButton icon={Glyph} label="Edit post" />);
    expect(screen.getByRole("button", { name: "Edit post" })).toHaveAttribute("aria-label", "Edit post");
  });

  it("shows the label as a tooltip on hover", async () => {
    render(<IconButton icon={Glyph} label="Edit post" />);
    await userEvent.hover(screen.getByRole("button", { name: "Edit post" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Edit post");
  });

  it("never draws the word by default", () => {
    render(<IconButton icon={Glyph} label="Edit post" />);
    expect(screen.getByRole("button")).toHaveTextContent("");
  });

  it("draws the word for showLabel always, and keeps the accessible name", () => {
    render(<IconButton icon={Glyph} label="Publish" showLabel="always" />);
    const b = screen.getByRole("button", { name: "Publish" });
    expect(b).toHaveTextContent("Publish");
    expect(b).toHaveAttribute("data-label", "always");
  });

  it("draws the word for from-md and hides it below 768px in CSS", () => {
    render(<IconButton icon={Glyph} label="Publish" showLabel="from-md" />);
    expect(screen.getByRole("button", { name: "Publish" })).toHaveTextContent("Publish");
    expect(css("IconButton.module.css")).toMatch(/max-width:\s*767px[\s\S]*\.fromMd\s*\{[^}]*display:\s*none/);
  });

  it("sets aria-pressed for a toggle and fires onClick", async () => {
    const onClick = vi.fn();
    render(<IconButton icon={Glyph} label="Pin" pressed onClick={onClick} />);
    const b = screen.getByRole("button", { name: "Pin" });
    expect(b).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("will not compile without a label", () => {
    // @ts-expect-error label is required
    const el = <IconButton icon={Glyph} />;
    expect(el).toBeTruthy();
  });

  it("sizes are the control-height tokens, the phone floor is 44px, focus has a ring", () => {
    const c = css("IconButton.module.css");
    expect(c).toContain("var(--ctl-h-sm)");
    expect(c).toContain("var(--ctl-h-lg)");
    expect(c).toMatch(/pointer:\s*coarse[\s\S]*min-block-size:\s*var\(--ctl-h-lg\)/);
    expect(c).toContain(":focus-visible");
  });
});

const items = (fn = vi.fn()): ControlItem[] => [
  { id: "a", icon: Glyph, label: "Alpha", priority: 1, onSelect: fn },
  { id: "b", icon: Glyph, label: "Bravo", priority: 5, onSelect: fn },
  { id: "c", icon: Glyph, label: "Charlie", priority: 3, onSelect: fn },
  { id: "d", icon: Glyph, label: "Delta", priority: 4, onSelect: fn },
];

describe("ControlBar", () => {
  it("shows everything when it fits and draws no More button", () => {
    render(<ControlBar label="Tools" moreLabel="More" items={items()} max={4} />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });

  it("moves the lowest priority items into More, keeping the bar's order", async () => {
    render(<ControlBar label="Tools" moreLabel="More" items={items()} max={2} />);
    const bar = screen.getByRole("toolbar", { name: "Tools" });
    const names = within(bar)
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label"));
    /* Bravo (5) and Delta (4) stay, in their original order; More comes last. */
    expect(names).toEqual(["Bravo", "Delta", "More"]);
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Alpha", "Charlie"]);
  });

  it("runs onSelect from a menu item", async () => {
    const fn = vi.fn();
    render(<ControlBar label="Tools" moreLabel="More" items={items(fn)} max={1} />);
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Alpha" }));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("breaks priority ties by keeping the earlier item", () => {
    const tied = items().map((i) => ({ ...i, priority: 1 }));
    render(<ControlBar label="Tools" moreLabel="More" items={tied} max={2} />);
    const names = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual(["Alpha", "Bravo", "More"]);
  });
});

describe("CreateMenu", () => {
  it("opens a menu of the caller's items from a named button", async () => {
    const onSelect = vi.fn();
    render(
      <CreateMenu
        icon={Glyph}
        label="New"
        items={[
          { id: "post", label: "Post", onSelect },
          { id: "area", label: "Area", onSelect },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "New" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Area" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe("SegmentedControl", () => {
  const opts = [
    { value: "a", label: "Newest" },
    { value: "b", label: "Oldest" },
    { value: "c", label: "Name" },
  ];
  it("is a named radio group with one checked option", () => {
    render(<SegmentedControl label="Sort" options={opts} value="b" onChange={() => {}} />);
    const g = screen.getByRole("radiogroup", { name: "Sort" });
    expect(within(g).getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Oldest" })).toBeChecked();
  });
  it("changes on click and moves with the arrow keys", async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Sort" options={opts} value="a" onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "Name" }));
    expect(onChange).toHaveBeenLastCalledWith("c");
    screen.getByRole("radio", { name: "Newest" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("b");
  });
});

describe("Chip", () => {
  it("is a toggle with aria-pressed inside a named group", async () => {
    const onClick = vi.fn();
    render(
      <ChipRow label="Filters">
        <Chip selected onClick={onClick}>
          Open
        </Chip>
        <Chip onClick={onClick}>Closed</Chip>
      </ChipRow>,
    );
    expect(screen.getByRole("group", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Closed" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "Closed" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("Dock", () => {
  it("is a floating pill that clears the safe area", () => {
    render(
      <Dock label="Actions">
        <button type="button">Go</button>
      </Dock>,
    );
    const d = screen.getByRole("group", { name: "Actions" });
    expect(d.className).toMatch(/dock/);
    const c = css("Dock.module.css");
    expect(c).toContain("env(safe-area-inset-bottom");
    expect(c).toContain("var(--dock-inset)");
    expect(c).toContain("var(--dock-shadow)");
  });
});

describe("StatChip", () => {
  it("draws glyph and number, and names the number for a screen reader", () => {
    render(<StatChip icon={Glyph} value={1234} label="Stars" />);
    expect(screen.getByTestId("glyph")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("1234")).toBeInTheDocument();
    expect(screen.getByText("Stars").className).toMatch(/sr/);
    expect(css("StatChip.module.css")).toContain("tabular-nums");
  });
});

describe("kit guard: no icon-only control without a label", () => {
  const files = readdirSync(__dirname).filter((n) => /\.tsx$/.test(n) && !/\.test\./.test(n));
  it("every <IconButton> in components/ui passes label", () => {
    const bad: string[] = [];
    for (const f of files) {
      const src = readFileSync(resolve(__dirname, f), "utf8");
      for (const m of src.matchAll(/<IconButton\b([\s\S]*?)\/?>/g)) {
        if (!/\blabel=|\{\.\.\./.test(m[1])) bad.push(`${f}: ${m[0].slice(0, 60)}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("the IconButton's own <button> carries aria-label", () => {
    const src = readFileSync(resolve(__dirname, "IconButton.tsx"), "utf8");
    expect(src).toMatch(/<button[\s\S]*aria-label=\{label\}/);
  });
});
