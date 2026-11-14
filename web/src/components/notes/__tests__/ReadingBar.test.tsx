import { describe, expect, it } from "vitest";
import { createRef } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ReadingBar from "@/components/notes/ReadingBar";

/*
 * The phone's floating reader bar. Edit (admin only) is its fourth control:
 * the bar is a three-column grid for a visitor, four for the signed-in owner.
 */
const entity = { slug: "a-note", title: "A note", summary: "", tags: [] };

const bar = (extra: Partial<React.ComponentProps<typeof ReadingBar>> = {}) =>
  render(
    <MemoryRouter>
      <ReadingBar entity={entity} target={createRef()} contentsLabel="Contents" onContents={() => {}} {...extra} />
    </MemoryRouter>,
  ).container;

describe("ReadingBar", () => {
  it("a visitor sees the three controls and no Edit", () => {
    const root = bar();
    expect(root.querySelector("a[data-phone=reader-edit]")).toBeNull();
    expect(root.querySelector("[data-cols]")!.getAttribute("data-cols")).toBe("3");
  });

  it("the admin gets Edit as a fourth control, named, with a pencil", () => {
    const root = bar({ editTo: "/admin/posts/a-note", editLabel: "Edit this note", editWord: "Edit" });
    const link = root.querySelector<HTMLAnchorElement>("a[data-phone=reader-edit]")!;
    expect(link.getAttribute("href")).toBe("/admin/posts/a-note");
    expect(link.getAttribute("aria-label")).toBe("Edit this note");
    expect(link.querySelector("svg")).not.toBeNull();
    expect(link.textContent).toBe("Edit");
    expect(root.querySelector("[data-cols]")!.getAttribute("data-cols")).toBe("4");
  });
});
