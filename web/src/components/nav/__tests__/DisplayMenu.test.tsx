import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DisplayMenu, { DisplayPanel, type NavControls } from "@/components/nav/DisplayMenu";

/*
 * The promises of the one display control: a single trigger, a popover that
 * holds labelled radio groups and a switch, and the keyboard behaviour that
 * goes with them. Visual layout is checked in a browser, not here.
 */

const controls = (over: Partial<NavControls> = {}): NavControls => ({
  locale: "en",
  onSelectLocale: vi.fn(),
  motionPaused: false,
  onToggleMotion: vi.fn(),
  ...over,
});

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

describe("the display control", () => {
  it("is one trigger that opens one panel with a group per setting and a switch", async () => {
    const user = userEvent.setup();
    render(<DisplayMenu controls={controls()} />);

    const trigger = screen.getByRole("button", { name: /change display/i });
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await user.click(trigger);

    const groups = screen.getAllByRole("radiogroup").map((g) => g.getAttribute("aria-labelledby"));
    const names = screen.getAllByRole("radiogroup").map((g) => g.getAttribute("aria-labelledby") && document.getElementById(g.getAttribute("aria-labelledby")!)?.textContent);
    expect(groups).toHaveLength(4);
    expect(names).toEqual(["Language", "Theme", "Text size", "Contrast"]);
    expect(screen.getByRole("switch", { name: "Pause motion" })).toHaveAttribute("aria-checked", "false");
  });

  it("keeps one tab stop per group and moves the choice with the arrow keys", async () => {
    const user = userEvent.setup();
    const c = controls();
    render(<DisplayPanel controls={c} />);

    const lang = screen.getAllByRole("radiogroup")[0];
    const [en, he] = within(lang).getAllByRole("radio");
    expect(en).toHaveAttribute("aria-checked", "true");
    expect(en).toHaveAttribute("tabindex", "0");
    expect(he).toHaveAttribute("tabindex", "-1");

    en.focus();
    await user.keyboard("{ArrowRight}");
    expect(c.onSelectLocale).toHaveBeenCalledWith("he");
    expect(he).toHaveFocus();
  });

  it("throws the motion switch on press and on Space", async () => {
    const user = userEvent.setup();
    const c = controls();
    render(<DisplayPanel controls={c} />);
    const sw = screen.getByRole("switch", { name: "Pause motion" });
    await user.click(sw);
    sw.focus();
    await user.keyboard(" ");
    expect(c.onToggleMotion).toHaveBeenCalledTimes(2);
  });

  it("closes on Escape and gives focus back to the trigger", async () => {
    const user = userEvent.setup();
    render(<DisplayMenu controls={controls()} />);
    const trigger = screen.getByRole("button", { name: /change display/i });
    await user.click(trigger);
    expect(screen.getByRole("switch")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("leaves out language and motion where the page has neither (the admin shell)", () => {
    render(<DisplayPanel />);
    expect(screen.getAllByRole("radiogroup")).toHaveLength(3);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
