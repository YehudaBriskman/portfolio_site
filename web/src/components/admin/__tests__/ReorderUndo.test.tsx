import { describe, expect, it } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReorderRows } from "@/components/admin/content/Reorder";

function Host() {
  const [items, setItems] = useState(["Alpha", "Beta"]);
  return (
    <div>
      <output data-testid="items">{items.join("|")}</output>
      <ReorderRows items={items} name={(x) => x} onChange={setItems} />
    </div>
  );
}

describe("phone reorder list undo", () => {
  it("Undo restores a removed item while nothing else has changed", () => {
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: /remove alpha/i }));
    fireEvent.click(screen.getByRole("button", { name: /^undo$/i }));
    expect(screen.getByTestId("items").textContent).toBe("Alpha|Beta");
  });
});
