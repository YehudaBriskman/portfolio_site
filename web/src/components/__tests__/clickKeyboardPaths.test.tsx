import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Modal from "@/components/admin/announce/audience/Modal";

/*
 * #828: every `onClick` on something that is not a control has a keyboard way
 * to the same result. Two kinds:
 *
 *   - a press on a modal dialog's backdrop. The keyboard's way is Escape,
 *     which the platform gives to `showModal` and to nothing else (jsdom has
 *     neither, so what is held is the call, and that the dialog's own cancel
 *     closes it), plus a real close button inside.
 *   - a box that only widens the target of, or listens for the clicks of, the
 *     controls inside it. The keyboard goes to those controls; the box says it
 *     is nothing itself (`role="presentation"`).
 */

const src = (file: string) => readFileSync(resolve(__dirname, "../..", file), "utf8");

describe("backdrop presses have the Escape path", () => {
  it.each([
    "components/Contact.tsx",
    "components/admin/announce/audience/Modal.tsx",
    "components/dashboard/DashboardShell.tsx",
    "components/gallery/Rail.tsx",
    "components/notes/reader/Lightbox.tsx",
    "components/share/SharePreview.tsx",
    "pages/BlogPost.tsx",
  ])("%s opens its dialog with showModal, never show()", (file) => {
    const code = src(file).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).toMatch(/showModal\??\.?\(/);
    expect(code).not.toMatch(/\.show\??\.?\(\)/);
  });

  const showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  beforeEach(() => {
    Object.assign(HTMLDialogElement.prototype, { showModal });
  });
  afterEach(() => {
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  });

  it("the audience modal closes on the dialog's cancel (Escape) and by its button", async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <Modal title="Add" titleId="t" onClose={onClose}>
          x
        </Modal>
      </MemoryRouter>,
    );
    expect(showModal).toHaveBeenCalledTimes(1);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    screen.getByRole("button", { name: "Close" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("boxes that listen for their controls' clicks are presentational", () => {
  it.each([
    ["components/dashboard/DashboardShell.tsx", "className={styles.localBody}"],
    ["components/dashboard/DashboardShell.tsx", "className={styles.sheetBody}"],
    ["components/dashboard/Tree.tsx", "className={styles.treeRow}"],
    ["components/gallery/PhoneBrowse.tsx", "className={styles.root}"],
    ["components/notes/reader/Lightbox.tsx", "className={styles.viewerStage}"],
    ["pages/AdminEditor.tsx", "className={styles.tags}"],
  ])("%s %s", (file, marker) => {
    /* The opening tag that carries both the class and a click handler. */
    const tags = src(file)
      .split(/<(?=div|span)/)
      .filter((chunk) => chunk.includes(marker) && chunk.slice(0, chunk.search(/\n\s*>\n/)).includes("onClick"));
    expect(tags.length).toBeGreaterThan(0);
    for (const t of tags) expect(t.slice(0, t.search(/\n\s*>\n/))).toContain('role="presentation"');
  });
});
