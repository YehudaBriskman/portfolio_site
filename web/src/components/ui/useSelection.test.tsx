import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, renderHook } from "@testing-library/react";
import { useSelection } from "@/components/ui/useSelection";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const IDS = ["a", "b", "c", "d"];
const setup = (ids: string[] = IDS) => renderHook(({ ids }) => useSelection(ids), { initialProps: { ids } });

/** What Back does: the entry we pushed is gone, then popstate fires. */
function pressBack() {
  window.history.replaceState(null, "");
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

describe("useSelection", () => {
  it("starts out of select mode with nothing selected", () => {
    const { result } = setup();
    expect(result.current.on).toBe(false);
    expect(result.current.count).toBe(0);
    expect(result.current.ids).toEqual([]);
  });

  it("enter(id) turns the mode on with that row selected; enter() selects nothing", () => {
    const a = setup();
    act(() => a.result.current.enter("b"));
    expect(a.result.current.on).toBe(true);
    expect(a.result.current.has("b")).toBe(true);
    expect(a.result.current.count).toBe(1);
    const b = setup();
    act(() => b.result.current.enter());
    expect(b.result.current.on).toBe(true);
    expect(b.result.current.count).toBe(0);
  });

  it("toggles, selects all and none, and counts", () => {
    const { result } = setup();
    act(() => result.current.enter());
    act(() => result.current.toggle("a"));
    act(() => result.current.toggle("c"));
    expect(result.current.ids).toEqual(["a", "c"]);
    act(() => result.current.toggle("a"));
    expect(result.current.has("a")).toBe(false);
    act(() => result.current.all());
    expect(result.current.count).toBe(4);
    expect(result.current.allSelected).toBe(true);
    act(() => result.current.none());
    expect(result.current.count).toBe(0);
    expect(result.current.on).toBe(true);
  });

  it("exit clears the selection and leaves the mode", () => {
    const { result } = setup();
    act(() => result.current.enter("a"));
    act(() => result.current.exit());
    expect(result.current.on).toBe(false);
    expect(result.current.count).toBe(0);
    act(() => result.current.enter());
    expect(result.current.count).toBe(0);
  });

  it("survives a filter change: what is no longer listed is dropped, the mode stays", () => {
    const { result, rerender } = setup();
    act(() => result.current.enter("a"));
    act(() => result.current.toggle("c"));
    rerender({ ids: ["c", "d"] });
    expect(result.current.on).toBe(true);
    expect(result.current.ids).toEqual(["c"]);
    expect(result.current.count).toBe(1);
    // It is not remembered for when the row comes back: the user chose it blind.
    rerender({ ids: IDS });
    expect(result.current.ids).toEqual(["c"]);
    expect(result.current.has("a")).toBe(false);
  });

  it("does not drop the selection when the list is re-sent with the same ids in a new array", () => {
    const { result, rerender } = setup();
    act(() => result.current.enter("a"));
    rerender({ ids: [...IDS] });
    expect(result.current.ids).toEqual(["a"]);
  });

  it("Escape leaves select mode", () => {
    const { result } = setup();
    act(() => result.current.enter("a"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(result.current.on).toBe(false);
  });

  it("Escape is left to an open dialog (the bulk sheet closes first)", () => {
    const { result } = setup();
    act(() => result.current.enter("a"));
    const d = document.createElement("dialog");
    d.setAttribute("open", "");
    document.body.append(d);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(result.current.on).toBe(true);
  });

  it("the Back button leaves select mode", () => {
    const { result } = setup();
    act(() => result.current.enter("a"));
    expect((window.history.state as { selection?: string } | null)?.selection).toBeTruthy();
    pressBack();
    expect(result.current.on).toBe(false);
  });

  it("Back with a sheet on top only closes the sheet: our own entry is still current", () => {
    const { result } = setup();
    act(() => result.current.enter("a"));
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current.on).toBe(true);
  });

  it("leaving from code pops the entry it pushed, once", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const { result } = setup();
    act(() => result.current.enter("a"));
    act(() => result.current.exit());
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("long-press and the Select button are the same entry point", () => {
    const { result } = setup();
    act(() => result.current.enter("a")); // long-press on a row
    act(() => result.current.exit());
    act(() => result.current.enter()); // the visible Select button
    expect(result.current.on).toBe(true);
  });
});
