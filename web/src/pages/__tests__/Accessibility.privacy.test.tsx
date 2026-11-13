import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Accessibility from "@/pages/Accessibility";

afterEach(() => document.documentElement.removeAttribute("lang"));

describe("the accessibility statement's privacy block", () => {
  it.each([
    ["en", /privacy page|privacy/i, /preferences link|unsubscribe|is kept/i],
    ["he", /הפרטיות/, /קישור ההעדפות|קישור להסרה|נשמרים/],
  ] as const)("only points at /privacy, no data claims of its own (%s)", (lang, name, banned) => {
    document.documentElement.lang = lang;
    render(
      <MemoryRouter initialEntries={["/accessibility"]}>
        <Accessibility />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole("link", { name }).filter((l) => l.getAttribute("href") === "/privacy");
    expect(links.length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(banned);
  });
});
