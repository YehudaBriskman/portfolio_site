import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import TagPill from "@/components/notes/TagPill";

describe("TagPill", () => {
  it("keeps the # sigil on the left of a Latin tag even in a right-to-left page", () => {
    const { container } = render(
      <div dir="rtl">
        <MemoryRouter>
          <TagPill tag="docker" />
        </MemoryRouter>
      </div>,
    );
    const mark = container.querySelector("bdi");
    expect(mark).toHaveAttribute("dir", "ltr");
    expect(mark).toHaveTextContent("#docker");
  });
});
