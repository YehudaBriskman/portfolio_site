import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog, isOutcomeWording } from "@/components/ui/ConfirmDialog";

/* jsdom has no <dialog>.showModal and no layout: the stand-ins only flip `open`. */
let showModal: ReturnType<typeof vi.fn>;
let close: ReturnType<typeof vi.fn>;
beforeEach(() => {
  showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
  Object.assign(HTMLDialogElement.prototype, { showModal, close });
});
afterEach(() => {
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
  vi.restoreAllMocks();
});

function Harness({ onConfirm = vi.fn(), tone }: { onConfirm?: () => void; tone?: "danger" | "neutral" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Delete posts
      </button>
      <ConfirmDialog
        open={open}
        title="Delete 3 posts?"
        confirm="Delete 3 posts"
        cancel="Keep"
        tone={tone}
        onConfirm={() => {
          onConfirm();
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      >
        The 3 selected posts and their translations are removed for good.
      </ConfirmDialog>
    </>
  );
}

describe("ConfirmDialog", () => {
  it("is a modal alertdialog named by its title and described by its text", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Delete posts" }));
    expect(showModal).toHaveBeenCalledTimes(1);
    const d = screen.getByRole("alertdialog", { name: "Delete 3 posts?", hidden: true });
    expect(d).toHaveAccessibleDescription("The 3 selected posts and their translations are removed for good.");
  });

  it("puts default focus on the safe button, not the destructive one", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Delete posts" }));
    expect(screen.getByRole("button", { name: "Keep" })).toHaveFocus();
  });

  it("names the confirm button by its outcome", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Delete posts" }));
    expect(screen.getByRole("button", { name: "Delete 3 posts" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(ok|yes|confirm)$/i })).toBeNull();
  });

  it("confirm runs onConfirm and closes", async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete posts" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete 3 posts" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalled();
  });

  it("cancel closes without confirming and returns focus to the opener", async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    const opener = screen.getByRole("button", { name: "Delete posts" });
    await userEvent.click(opener);
    await userEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });

  it("Escape means keep, and the caller closes", async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    const opener = screen.getByRole("button", { name: "Delete posts" });
    await userEvent.click(opener);
    const d = screen.getByRole("alertdialog", { hidden: true });
    fireEvent(d, new Event("cancel", { cancelable: true }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });

  it("a press on the backdrop means keep; a press inside does not", async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="Revoke Zed?" confirm="Revoke Zed" cancel="Keep" onConfirm={() => {}} onCancel={onCancel}>
        It stops working.
      </ConfirmDialog>,
    );
    await userEvent.click(screen.getByText("It stops working.", { exact: false }));
    expect(onCancel).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("alertdialog", { hidden: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("while busy both buttons are off and nothing closes", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open busy title="Send?" confirm="Send to 120 people" cancel="Not yet" onConfirm={() => {}} onCancel={onCancel} />);
    expect(screen.getByRole("button", { name: "Not yet" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send to 120 people" })).toBeDisabled();
    fireEvent(screen.getByRole("alertdialog", { hidden: true }), new Event("cancel", { cancelable: true }));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("danger fills the confirm red, neutral uses the primary look", async () => {
    const { rerender } = render(<ConfirmDialog open title="t" confirm="Delete it" cancel="Keep" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("button", { name: "Delete it" }).className).not.toContain("a-btn-primary");
    rerender(<ConfirmDialog open tone="neutral" title="t" confirm="Publish post" cancel="Not yet" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("button", { name: "Publish post" }).className).toContain("a-btn-primary");
  });

  it("renders Hebrew outcome wording right to left", async () => {
    render(
      <div dir="rtl">
        <ConfirmDialog open title="למחוק 3 פוסטים?" confirm="מחיקת 3 פוסטים" cancel="להשאיר" onConfirm={() => {}} onCancel={() => {}} />
      </div>,
    );
    expect(screen.getByRole("button", { name: "מחיקת 3 פוסטים" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "להשאיר" })).toHaveFocus();
  });
});

describe("isOutcomeWording", () => {
  it("rejects generic answers and 'Are you sure'", () => {
    for (const bad of ["OK", "Yes", "Confirm", "ok.", "אישור", "כן"]) expect(isOutcomeWording(bad), bad).toBe(false);
    expect(isOutcomeWording("Delete 3 posts", "Are you sure?")).toBe(false);
    expect(isOutcomeWording("Delete 3 posts", "Delete 3 posts?")).toBe(true);
    expect(isOutcomeWording("Revoke Zed")).toBe(true);
  });
});
