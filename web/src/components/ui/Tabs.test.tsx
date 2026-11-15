import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs, TabPanel } from "@/components/ui/Tabs";

const items = [
  { id: "inbox", label: "Inbox", count: 3 },
  { id: "audience", label: "Audience" },
  { id: "library", label: "Library" },
];

function Harness({ dir }: { dir?: "rtl" }) {
  const [v, setV] = useState("inbox");
  return (
    <div dir={dir}>
      <Tabs value={v} onValueChange={setV} items={items} label="Hub sections" idBase="hub" panels />
      <TabPanel idBase="hub" id="inbox" value={v}>
        inbox body
      </TabPanel>
      <TabPanel idBase="hub" id="audience" value={v}>
        audience body
      </TabPanel>
    </div>
  );
}

describe("Tabs", () => {
  it("is a named tablist of tabs, one selected, with its panel", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist", { name: "Hub sections" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    const cur = screen.getByRole("tab", { selected: true });
    expect(cur).toHaveTextContent("Inbox");
    expect(cur).toHaveAttribute("aria-controls", "hub-panel-inbox");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", cur.id);
  });

  it("has one tab stop: only the selected tab is tabbable", () => {
    render(<Harness />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
  });

  it("arrow keys move focus and select; Home and End jump; wraps", async () => {
    render(<Harness />);
    screen.getByRole("tab", { name: /Inbox/ }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Audience" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Audience" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("audience body")).toBeInTheDocument();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Library" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Inbox/ })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: /Inbox/ })).toHaveFocus();
  });

  it("mirrors the arrows in a right-to-left page", async () => {
    render(<Harness dir="rtl" />);
    screen.getByRole("tab", { name: /Inbox/ }).focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Audience" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Inbox/ })).toHaveFocus();
  });

  it("clicking selects and reports once", async () => {
    const onValueChange = vi.fn();
    render(<Tabs value="inbox" onValueChange={onValueChange} items={items} label="Sections" />);
    await userEvent.click(screen.getByRole("tab", { name: "Library" }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("library");
  });

  it("puts aria-controls only where panels exist", () => {
    render(<Tabs value="inbox" onValueChange={() => {}} items={items} label="Sections" />);
    expect(screen.getByRole("tab", { selected: true })).not.toHaveAttribute("aria-controls");
  });

  it("shows a count as part of the name", () => {
    render(<Harness />);
    expect(screen.getByRole("tab", { name: "Inbox 3" })).toBeInTheDocument();
  });

  it("falls back to the first tab when the value is unknown", () => {
    render(<Tabs value="nope" onValueChange={() => {}} items={items} label="Sections" />);
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Inbox");
  });

  it("one weight in every state, a bar and a fill for current, ellipsis not a cut (CSS)", () => {
    const css = readFileSync(resolve(__dirname, "Tabs.module.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).not.toMatch(/font-weight:\s*(6|7|8|9)00|font-weight:\s*bold/);
    expect(css).toMatch(/\.tab\[aria-selected='true'\]\s*\{[^}]*background/);
    expect(css).toMatch(/\.tab::after/);
    expect(css).toMatch(/\.text\s*\{[^}]*text-overflow:\s*ellipsis/);
    expect(css).not.toMatch(/\b\d+ms\b/);
  });
});
