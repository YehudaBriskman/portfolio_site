import { afterEach, describe, expect, it, vi } from "vitest";
import { focusLanguageControl } from "@/components/nav/locale";

describe("focusLanguageControl", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("focuses the language trigger once it has rendered, however late", () => {
    vi.useFakeTimers();
    focusLanguageControl();
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(document.body);

    const b = document.createElement("button");
    b.setAttribute("data-language-trigger", "");
    /* jsdom has no layout; say the control is laid out. */
    b.getClientRects = () => [{}] as unknown as DOMRectList;
    document.body.append(b);
    vi.advanceTimersByTime(200);
    expect(document.activeElement).toBe(b);
  });

  it("gives up rather than looping forever when the control never appears", () => {
    vi.useFakeTimers();
    focusLanguageControl(300);
    vi.advanceTimersByTime(1000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
