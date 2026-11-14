import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import NotificationsMenu from "@/components/admin/NotificationsMenu";
import { toast, __resetToasts } from "@/lib/toast";

beforeEach(() => {
  __resetToasts();
  document.documentElement.lang = "en";
});
afterEach(cleanup);

describe("NotificationsMenu", () => {
  it("lists what the toasts said, flags new ones, clears on request", () => {
    render(<NotificationsMenu />);
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    act(() => {
      toast.success("Saved");
      toast.error("Could not publish", { description: "Try again.", details: "private detail" });
    });
    const bell = screen.getByRole("button", { name: "Notifications, 2 new" });
    fireEvent.click(bell);
    expect(screen.getByText("Could not publish")).toBeTruthy();
    expect(screen.getByText("Saved")).toBeTruthy();
    expect(screen.queryByText("private detail")).toBeNull();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("Nothing yet this session.")).toBeTruthy();
  });

  it("speaks Hebrew", () => {
    document.documentElement.lang = "he";
    render(<NotificationsMenu />);
    expect(screen.getByRole("button", { name: "התראות" })).toBeTruthy();
  });
});
