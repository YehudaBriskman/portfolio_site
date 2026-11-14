import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SelectionBar, SelectionHeader, type SelectionAction } from "@/components/ui/SelectionBar";
import { useSelection } from "@/components/ui/useSelection";
import { ReorderRows } from "@/components/admin/content/Reorder";
import { useState } from "react";
import { ICON } from "@/components/ui/icons";

/* Regression: select mode + history, and the phone reorder list. Each test passes once the bug is fixed. */

const IDS = ["a", "b", "c"];

function List({ run }: { run: SelectionAction<string>["run"] }) {
  const selection = useSelection(IDS);
  const actions: SelectionAction<string>[] = [
    { id: "archive", icon: ICON.archived, label: "Archive", destructive: true, confirm: (n) => `Archive ${n} posts`, run },
  ];
  return (
    <div>
      <SelectionHeader selection={selection} total={IDS.length} />
      <ul>
        {IDS.map((id) => (
          <li key={id}>
            <button onClick={() => selection.toggle(id)}>row-{id}</button>
          </li>
        ))}
      </ul>
      <SelectionBar selection={selection} actions={actions} />
    </div>
  );
}

beforeEach(() => {
  Object.assign(HTMLDialogElement.prototype, {
    showModal: function (this: HTMLDialogElement) { this.setAttribute("open", ""); },
    close: function (this: HTMLDialogElement) { this.removeAttribute("open"); },
  });
  window.history.replaceState(null, "", "/list");
});
afterEach(() => {
  cleanup();
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

describe("select mode and history ", () => {
  /* B-h4-10 */
  it("after a confirmed bulk action the select mode's history entry must be gone (one Back = leave the page)", async () => {
    const start = window.history.length;
    render(<List run={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /^select$/i }));
    fireEvent.click(screen.getByRole("button", { name: "row-a" }));
    fireEvent.click(screen.getByRole("button", { name: "row-b" }));
    expect(window.history.state?.selection).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^archive$/i }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: /archive 2 posts/i }));
    await waitFor(() => expect(screen.queryByRole("toolbar")).toBeNull());
    await new Promise((r) => setTimeout(r, 150));
    // The mode is off. Nothing of it may remain current in the history.
    expect(window.history.state?.selection).toBeUndefined();
    void start;
  });

  /* B-h4-11 */
  it("Escape leaves the mode but must not leave an orphan history entry either", async () => {
    render(<List run={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /^select$/i }));
    expect(window.history.state?.selection).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("button", { name: /^done$/i })).toBeNull());
    await new Promise((r) => setTimeout(r, 150));
    expect(window.history.state?.selection).toBeUndefined();
  });
});

describe("phone reorder list ", () => {
  function Host() {
    const [items, setItems] = useState(["Alpha", "Beta", "Gamma"]);
    return (
      <div>
        <button onClick={() => setItems((cur) => cur.map((x) => (x === "Gamma" ? "Gamma EDITED" : x)))}>edit-gamma-elsewhere</button>
        <output data-testid="items">{items.join("|")}</output>
        <ReorderRows items={items} name={(x) => x} onChange={setItems} />
      </div>
    );
  }

  /* B-h4-12 */
  it("Undo of a Remove must not roll back an edit made elsewhere after the removal", () => {
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: /remove alpha/i }));
    expect(screen.getByTestId("items").textContent).toBe("Beta|Gamma");
    // The owner edits another project in the form below the list (parent state changes).
    fireEvent.click(screen.getByText("edit-gamma-elsewhere"));
    expect(screen.getByTestId("items").textContent).toBe("Beta|Gamma EDITED");
    // The Undo button is still offered ("until something else changes" says the component's own comment).
    const undo = screen.queryByRole("button", { name: /^undo$/i });
    if (undo) {
      fireEvent.click(undo);
      expect(screen.getByTestId("items").textContent).toContain("Gamma EDITED");
    }
  });
});
