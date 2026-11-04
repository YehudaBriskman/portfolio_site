import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { typedDir } from "@/lib/typedDir";
import AskBox from "@/components/dashboard/AskBox";

/*
 * An empty search field follows the page; a typed one decides for itself.
 * On /he the notes search set its Hebrew placeholder left to right because
 * `dir="auto"` reads the value, and an empty value is LTR.
 */
describe("typedDir", () => {
  it("inherits the page's direction while there is nothing to decide from", () => {
    expect(typedDir("")).toBeUndefined();
    expect(typedDir("   ")).toBeUndefined();
    /* The sigils and digits are not strong characters. */
    expect(typedDir("#")).toBeUndefined();
    expect(typedDir("@ 2026")).toBeUndefined();
  });

  it("is auto once a letter is typed, in either script", () => {
    expect(typedDir("css")).toBe("auto");
    expect(typedDir("#ci")).toBe("auto");
    expect(typedDir("רשימות")).toBe("auto");
  });
});

describe("the notes search box", () => {
  it("has no dir while empty, so its placeholder takes the page's side, and auto once typed", () => {
    render(
      <div dir="rtl">
        <AskBox topics={[]} areas={[]} onAsk={() => {}} />
      </div>,
    );
    const box = screen.getByRole("textbox");
    expect(box.hasAttribute("dir")).toBe(false);
    fireEvent.change(box, { target: { value: "dns" } });
    expect(box.getAttribute("dir")).toBe("auto");
    fireEvent.change(box, { target: { value: "" } });
    expect(box.hasAttribute("dir")).toBe(false);
  });
});
