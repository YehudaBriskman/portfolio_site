import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NoteMarkdown from "../NoteMarkdown";

/* A link is internal only when its parsed origin is this site's, never by a string prefix. */
const here = () => window.location.origin;
const html = (body: string) => {
  const { container } = render(
    <MemoryRouter>
      <NoteMarkdown body={body} />
    </MemoryRouter>,
  );
  return container;
};

describe("which absolute links count as external", () => {
  it.each([
    [`${here()}.example.test/x`, "look-alike host after the origin"],
    [`${here()}@example.test/x`, "origin followed by userinfo"],
    [`${here()}:8080/x`, "same host, another port"],
  ])("treats %s as external (%s)", (href) => {
    const a = html(`[x](${href})`).querySelector("a")!;
    expect(a.hasAttribute("data-external")).toBe(true);
    expect(a.getAttribute("rel")).toContain("noopener");
  });

  it("keeps a link to this origin internal", () => {
    const a = html(`[x](${here()}/about)`).querySelector("a")!;
    expect(a.hasAttribute("data-external")).toBe(false);
  });

  it("treats another site as external", () => {
    expect(html("[x](https://example.org/)").querySelector("a")!.hasAttribute("data-external")).toBe(true);
  });
});
