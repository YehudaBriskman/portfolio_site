import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { toast as sonner } from "sonner";
import ToastHost from "@/components/ui/ToastHost";
import { toast, __resetToasts } from "@/lib/toast";

beforeEach(() => {
  __resetToasts();
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
});
afterEach(async () => {
  cleanup();
  /* Sonner's own list is module state and outlives a test. */
  sonner.dismiss();
  await new Promise((r) => setTimeout(r, 300));
  document.body.innerHTML = "";
});

/* Sonner adds a toast on a setTimeout(0) and removes one on a frame: wait both out. */
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 60)); });

describe("ToastHost", () => {
  it("shows a raised toast, and one raised before it mounted", async () => {
    toast.success("Saved before mount", { id: "early" });
    render(<ToastHost />);
    await flush();
    expect(screen.getByText("Saved before mount", { selector: "[data-title]" })).toBeTruthy();
    act(() => void toast.info("Later"));
    await flush();
    expect(screen.getByText("Later", { selector: "[data-title]" })).toBeTruthy();
  });

  it("the same id updates in place", async () => {
    render(<ToastHost />);
    act(() => void toast.loading("Saving", { id: "s" }));
    await flush();
    act(() => void toast.success("Saved", { id: "s" }));
    await flush();
    expect(document.querySelectorAll("[data-sonner-toast]")).toHaveLength(1);
    expect(screen.getByText("Saved", { selector: "[data-title]" })).toBeTruthy();
    expect(screen.queryByText("Saving", { selector: "[data-title]" })).toBeNull();
  });

  it("Details is a real button that reveals the long text and keeps the toast open", async () => {
    render(<ToastHost />);
    act(() => void toast.error("Not saved", { description: "Try again.", details: "The server refused the change." }));
    await flush();
    const b = screen.getByRole("button", { name: "Details" });
    expect(b.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("The server refused the change.")).toBeNull();
    fireEvent.click(b);
    await flush();
    expect(screen.getByRole("button", { name: "Hide details" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("The server refused the change.")).toBeTruthy();
    expect(toast.live()[0].duration).toBe(Infinity);
  });

  it("an action runs its handler; Undo drops the commit", async () => {
    render(<ToastHost />);
    let committed = 0;
    let undone = 0;
    act(() => void toast.undoable({ title: "Archived", commit: () => void (committed += 1), onUndo: () => void (undone += 1) }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await flush();
    expect(undone).toBe(1);
    expect(committed).toBe(0);
    expect(toast.live()).toHaveLength(0);
  });

  it("says each toast once: status for good news, alert for errors, Sonner's own region off", async () => {
    render(<ToastHost />);
    act(() => void toast.success("Copied"));
    act(() => void toast.error("Broke"));
    await flush();
    expect(screen.getByRole("status").textContent).toContain("Copied");
    expect(screen.getByRole("alert").textContent).toContain("Broke");
    expect(document.querySelector("section[aria-live]")?.getAttribute("aria-live")).toBe("off");
  });

  it("lives inside an open dialog, so a modal does not make it inert, and moves back", async () => {
    document.body.innerHTML = `<dialog id="d"><button>in</button></dialog>`;
    const d = document.getElementById("d") as HTMLDialogElement;
    render(<ToastHost />);
    act(() => void toast.success("Hi"));
    await flush();
    expect(d.querySelector("[data-toast-host]")).toBeNull();
    await act(async () => {
      d.setAttribute("open", "");
    });
    await flush();
    expect(d.querySelector("[data-toast-host]")).not.toBeNull();
    expect(d.querySelectorAll("[data-sonner-toast]")).toHaveLength(1);
    await act(async () => {
      d.removeAttribute("open");
    });
    await flush();
    expect(d.querySelector("[data-toast-host]")).toBeNull();
    expect(document.querySelectorAll("[data-sonner-toast]")).toHaveLength(1);
  });

  it("registers as a host so Undo has somewhere to show", async () => {
    expect(toast.hasHost()).toBe(false);
    const { unmount } = render(<ToastHost />);
    expect(toast.hasHost()).toBe(true);
    unmount();
    expect(toast.hasHost()).toBe(false);
  });

  it("reads Hebrew and mirrors to the left in RTL", async () => {
    document.documentElement.lang = "he";
    document.documentElement.dir = "rtl";
    render(<ToastHost />);
    act(() => void toast.error("לא נשמר", { details: "פירוט" }));
    await flush();
    expect(screen.getByRole("button", { name: "פרטים" })).toBeTruthy();
    expect(document.querySelector("[data-sonner-toaster]")?.getAttribute("data-x-position")).toBe("left");
    expect(document.querySelector("[data-sonner-toaster]")?.getAttribute("dir")).toBe("rtl");
  });
});
