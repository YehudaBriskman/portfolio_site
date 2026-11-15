import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SidebarNav, type NavNode } from "@/components/ui/SidebarGroup";
import { outsideNoPreference, readCss } from "@/test/noPreference";

/*
 * A group opens and closes with motion (#852): the list sits in a grid wrapper whose row track goes 0fr to 1fr
 * (the one layout collapse M3 allows), the list fades with it, the chevron turns, and every declaration lives
 * inside prefers-reduced-motion: no-preference with the shared tokens and no raw duration.
 */

const css = readCss(resolve(process.cwd(), "src/components/ui/SidebarGroup.module.css"));
const TREE: NavNode[] = [{ id: "g", label: "Content", children: [{ id: "posts", label: "Posts", to: "/admin/posts" }] }];

describe("SidebarGroup collapse motion", () => {
  it("wraps each group's list in a collapse wrapper that mirrors its open state", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <SidebarNav nodes={TREE} label="Nav" storageKey="t" />
      </MemoryRouter>,
    );
    const toggle = screen.getByRole("button", { name: /Content/ });
    const list = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    const wrap = list.parentElement!;
    expect(wrap.className).toMatch(/collapse/);
    expect(wrap.hasAttribute("data-open")).toBe(false);
    fireEvent.click(toggle);
    expect(wrap.hasAttribute("data-open")).toBe(true);
    expect(list.hasAttribute("hidden")).toBe(false);
  });

  it("animates the row track and the list's opacity, only for a viewer who has not asked for less", () => {
    const bare = outsideNoPreference(css);
    expect(bare).not.toMatch(/grid-template-rows\s*:[^;}]*\b\d+(\.\d+)?m?s\b/);
    expect(bare).not.toMatch(/transition[^;{}]*grid-template-rows/);
    const inside = css.slice(css.indexOf("@media (prefers-reduced-motion: no-preference)"));
    expect(inside).toMatch(/transition:\s*grid-template-rows var\(--a-dur-2\) var\(--a-ease-out\)/);
    expect(inside).toMatch(/grid-template-rows var\(--a-dur-1\) var\(--a-ease-in\)/);
    expect(inside).toMatch(/opacity var\(--a-dur-1\) var\(--a-ease-in\)/);
  });

  it("uses no raw duration and no keyframes", () => {
    expect(css).not.toMatch(/\b\d+(\.\d+)?m?s\b(?![^{]*\{)/);
    expect(css).not.toMatch(/@keyframes/);
    expect(css).not.toMatch(/transition[^;]*\b\d+ms\b/);
  });

  it("the first paint does not fade: the starting style is armed after mount", () => {
    expect(css).toMatch(/\[data-armed\][^{]*\{?[\s\S]*@starting-style/);
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <SidebarNav nodes={TREE} label="Nav" storageKey="t" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("navigation", { name: "Nav" }).hasAttribute("data-armed")).toBe(true);
  });

  it("is laid out with logical properties only (RTL mirrors by itself)", () => {
    expect(css).not.toMatch(/\b(?:margin|padding|border)-(?:left|right)\b|(?:^|[;{\s])(?:left|right)\s*:/m);
  });
});
