import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AskBox from "@/components/dashboard/AskBox";
import { SearchField } from "@/components/gallery/FilterControl";
import { KEYBOARD_QUERY, WIDE_QUERY } from "@/hooks/useKeyboardCopy";

/*
 * The notes search box on a phone (#766). The sentence that teaches the
 * keyboard ("# picks a topic ... Enter searches") belongs to a mouse and a
 * keyboard; a touch reader never sees it, and the field carries the hints a
 * phone keyboard reads.
 */
function pointer(fine: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q === KEYBOARD_QUERY || q === WIDE_QUERY ? fine : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}
afterEach(() => vi.unstubAllGlobals());

const box = () => render(<AskBox topics={[]} areas={[]} onAsk={() => {}} />);

describe("the keyboard-instruction copy", () => {
  it("is shown for a fine pointer that can hover", () => {
    pointer(true);
    box();
    expect(screen.getByText(/Enter searches/)).toBeTruthy();
    expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBeTruthy();
  });

  it("is absent on a touch device, and the field is not described by it", () => {
    pointer(false);
    box();
    expect(screen.queryByText(/Enter searches/)).toBeNull();
    expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBeNull();
  });

  it("is absent where matchMedia does not exist", () => {
    vi.stubGlobal("matchMedia", undefined);
    box();
    expect(screen.queryByText(/Enter searches/)).toBeNull();
  });

  it("uses the short placeholder on touch, and the one that teaches # and @ on a keyboard", () => {
    pointer(false);
    const { unmount } = box();
    expect(screen.getByRole("textbox").getAttribute("placeholder")).toBe("Title, topic or phrase…");
    unmount();
    pointer(true);
    box();
    expect(screen.getByRole("textbox").getAttribute("placeholder")).toMatch(/# for a topic/);
  });
});

describe("the search field's phone hints", () => {
  it("asks the phone keyboard for a search key, no capital and no autocorrect", () => {
    pointer(false);
    box();
    const f = screen.getByRole("textbox");
    expect(f.getAttribute("enterkeyhint")).toBe("search");
    expect(f.getAttribute("inputmode")).toBe("search");
    expect(f.getAttribute("autocapitalize")).toBe("off");
    expect(f.getAttribute("autocorrect")).toBe("off");
    expect(f.getAttribute("spellcheck")).toBe("false");
  });

  it("has a search submit button and a clear button (inside the field) only once there is text", () => {
    pointer(false);
    box();
    expect(screen.getByRole("button", { name: "Search" }).getAttribute("type")).toBe("submit");
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
    const f = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(f, { target: { value: "dns" } });
    const clear = screen.getByRole("button", { name: "Clear all" });
    expect(clear.closest("[data-ask-field]")).toBeTruthy();
    fireEvent.click(clear);
    expect(f.value).toBe("");
    expect(document.activeElement).toBe(f);
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
  });

  it("the feed's SearchField has the same hints", () => {
    pointer(false);
    render(
      <MemoryRouter>
        <SearchField label="Search the notes" path="/blog" />
      </MemoryRouter>,
    );
    const f = screen.getByRole("searchbox");
    expect(f.getAttribute("inputmode")).toBe("search");
    expect(f.getAttribute("autocapitalize")).toBe("off");
    expect(f.getAttribute("autocorrect")).toBe("off");
  });
});
