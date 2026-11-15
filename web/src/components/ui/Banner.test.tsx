import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Banner } from "@/components/ui/Banner";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("Banner", () => {
  it("info and warning are polite status, danger is an alert", () => {
    const { rerender } = render(<Banner tone="info">Draft waiting</Banner>);
    expect(screen.getByRole("status")).toHaveTextContent("Draft waiting");
    rerender(<Banner tone="warning">Careful</Banner>);
    expect(screen.getByRole("status")).toHaveAttribute("data-tone", "warning");
    rerender(<Banner tone="danger">Sending failed</Banner>);
    expect(screen.getByRole("alert")).toHaveTextContent("Sending failed");
  });

  it("draws a glyph per tone (colour is never the only channel)", () => {
    const { container, rerender } = render(<Banner tone="info">x</Banner>);
    const a = container.querySelector("svg")?.getAttribute("class");
    rerender(<Banner tone="warning">x</Banner>);
    const b = container.querySelector("svg")?.getAttribute("class");
    rerender(<Banner tone="danger">x</Banner>);
    const c = container.querySelector("svg")?.getAttribute("class");
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("shows the title and one action", async () => {
    const onSelect = vi.fn();
    render(
      <Banner tone="warning" title="Sending is paused" action={{ label: "Resume sending", onSelect }}>
        Nothing goes out until you resume.
      </Banner>,
    );
    expect(screen.getByText("Sending is paused")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Resume sending" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("has no dismiss button unless it can be dismissed", () => {
    render(<Banner>Plain</Banner>);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("dismisses, calls onDismiss and takes itself away", async () => {
    const onDismiss = vi.fn();
    render(
      <Banner onDismiss={onDismiss} dismissLabel="Dismiss">
        Hello
      </Banner>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Hello")).toBeNull();
  });

  it("remembers a dismissal under its key, across mounts", async () => {
    const first = render(
      <Banner dismissKey="tips" dismissLabel="Dismiss">
        Tip
      </Banner>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(window.localStorage.getItem("admin.banner.tips")).toBe("1");
    first.unmount();
    render(
      <Banner dismissKey="tips" dismissLabel="Dismiss">
        Tip
      </Banner>,
    );
    expect(screen.queryByText("Tip")).toBeNull();
  });

  it("still renders and dismisses when storage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(
      <Banner dismissKey="x" dismissLabel="Dismiss">
        Stays
      </Banner>,
    );
    expect(screen.getByText("Stays")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Stays")).toBeNull();
  });

  it("works right to left with Hebrew words", () => {
    render(
      <div dir="rtl">
        <Banner tone="warning" title="השליחה מושהית" action={{ label: "המשך שליחה", onSelect: () => {} }} onDismiss={() => {}} dismissLabel="סגירה">
          דבר לא יוצא עד שתמשיך.
        </Banner>
      </div>,
    );
    expect(screen.getByRole("button", { name: "המשך שליחה" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "סגירה" })).toBeInTheDocument();
  });
});
