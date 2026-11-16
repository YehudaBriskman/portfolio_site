import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import FloatingBack from "@/components/ui/FloatingBack";

const css = (name: string) => readFileSync(resolve(__dirname, name), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const tokens = () => readFileSync(resolve(__dirname, "../../index.css"), "utf8");

const mount = (to: string, label: string) =>
  render(
    <MemoryRouter>
      <FloatingBack to={to} label={label} />
    </MemoryRouter>,
  );

describe("FloatingBack", () => {
  it("is a link to the parent plus a separate menu button", () => {
    mount("/projects", "Work");
    const link = screen.getByRole("link", { name: "Work" });
    expect(link.getAttribute("href")).toBe("/projects");
    expect(link.getAttribute("title")).toBe("Work");
    const more = screen.getByRole("button", { name: /more actions/i });
    expect(more.getAttribute("aria-haspopup")).toBe("menu");
    expect(link.contains(more)).toBe(false);
  });

  it("lists each destination once: the parent, Home, Work, Blog, Share", async () => {
    mount("/projects/windom", "WindoM");
    await userEvent.click(screen.getByRole("button", { name: /more actions/i }));
    const names = screen.getAllByRole("menuitem").map((i) => i.textContent);
    expect(names).toEqual(["WindoM", "Home", "Work", "Blogs", "Share"]);
  });

  it("does not list the parent twice when it is Work", async () => {
    mount("/projects", "Work");
    await userEvent.click(screen.getByRole("button", { name: /more actions/i }));
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Work", "Home", "Blogs", "Share"]);
  });

  it("takes the box of the menu circle from shared tokens, never its own numbers", () => {
    const c = css("FloatingBack.module.css");
    expect(c).toMatch(/position:\s*fixed/);
    expect(c).toContain("var(--float-top)");
    expect(c).toContain("var(--float-h)");
    expect(c).toContain("var(--float-z)");
    /* ground, hairline and shadow are the shared glass (floatGlass.guard.test) */
    expect(c.match(/\n\.float \{[^}]*\}/)![0]).not.toMatch(/box-shadow|background:/);
    const nav = css("../Nav.module.css");
    expect(nav).toContain("inset-block-start: var(--float-top)");
    expect(nav).toContain("width: var(--float-h)");
    expect(tokens()).toMatch(/--float-h:\s*46px/);
  });

  it("truncates its label with an ellipsis, padding both sides, its own direction", () => {
    const c = css("FloatingBack.module.css");
    expect(c).toMatch(/\.name\s*\{[^}]*text-overflow:\s*ellipsis/);
    expect(c).toMatch(/\.name\s*\{[^}]*min-width:\s*0/);
    expect(c).toMatch(/\.name\s*\{[^}]*padding-inline:/);
    mount("/projects", "Work");
    /* portalled to <body>, so look there rather than in the render container */
    expect(document.querySelector("[data-back-pill]")?.getAttribute("dir")).toBe("auto");
  });
});

describe("one stack rhythm", () => {
  it("defines the stack tokens and the post footer uses them", () => {
    expect(tokens()).toMatch(/--stack-md:\s*1\.5rem/);
    const reader = css("../notes/reader/Reader.module.css");
    expect(reader).toMatch(/\.groupRows\.groupRows\s*\{[^}]*margin:\s*var\(--stack-md\) 0 0/);
    expect(reader).toMatch(/\.authorCard\.authorCard\s*\{[^}]*gap:\s*var\(--stack-sm\) var\(--stack-md\)/);
  });
});
