import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import AdminShell from "@/components/admin/AdminShell";
import { STROKE_FOR_SIZE } from "@/components/ui/Icon";

/*
 * Admin nav v2 (#886): the animated rail, the guide lines, one icon weight, Collapse all / Expand all,
 * and the phone's floating circle and back pill. None of it waits on rAF or animationend.
 */

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

let reduce = false;
function viewport(width: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+(?:\.\d+)?)px/.exec(query);
    const max = /max-width:\s*(\d+(?:\.\d+)?)px/.exec(query);
    const matches = /prefers-reduced-motion:\s*reduce/.test(query) ? reduce : min ? width >= Number(min[1]) : max ? width <= Number(max[1]) : false;
    return { media: query, matches, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as unknown as MediaQueryList;
  });
}

beforeEach(() => {
  localStorage.clear();
  reduce = false;
  viewport(1280);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => (url === "/api/admin/me" ? json({ ok: true, login: "o", email: null }) : json({ ok: true, unread: 0, items: [] }))));
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("lang");
  document.documentElement.removeAttribute("dir");
});

const shell = (at = "/admin/posts", props: { section?: "posts" | "overview" | "areas"; backTo?: string } = {}) =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <AdminShell title="T" section={props.section ?? "posts"} backTo={props.backTo}>
        <input aria-label="field" />
      </AdminShell>
    </MemoryRouter>,
  );
const nav = () => screen.getByRole("navigation", { name: "Admin sections" });
const app = () => document.querySelector(".a-app")!;
const railBtn = () => screen.getByRole("button", { name: /^(Collapse|Expand) sidebar$/ });
const css = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const sheet = css("src/components/ui/SidebarGroup.module.css");
const index = css("src/index.css");

describe("the rail animates", () => {
  it("collapsing keeps the full tree while it slides, then draws the rail, on a timer", () => {
    vi.useFakeTimers();
    shell();
    fireEvent.click(railBtn());
    expect(app().getAttribute("data-side")).toBe("rail");
    expect(app().getAttribute("data-sliding")).toBe("out");
    /* The labels are still in the tree while the width narrows. */
    expect(within(nav()).getByText("Overview")).toBeTruthy();
    expect(document.querySelector("[data-collapsed]")).toBeNull();
    act(() => void vi.advanceTimersByTime(400));
    expect(app().hasAttribute("data-sliding")).toBe(false);
    expect(document.querySelector("[data-collapsed]")).not.toBeNull();
  });

  it("expanding draws the full tree at once and fades its labels in", () => {
    vi.useFakeTimers();
    localStorage.setItem("admin-nav-collapsed", "1");
    shell();
    expect(document.querySelector("[data-collapsed]")).not.toBeNull();
    fireEvent.click(railBtn());
    expect(app().getAttribute("data-sliding")).toBe("in");
    expect(document.querySelector("[data-collapsed]")).toBeNull();
    act(() => void vi.advanceTimersByTime(400));
    expect(app().hasAttribute("data-sliding")).toBe(false);
  });

  it("snaps with reduced motion and with the site's pause switch", () => {
    reduce = true;
    viewport(1280);
    shell();
    fireEvent.click(railBtn());
    expect(app().hasAttribute("data-sliding")).toBe(false);
    expect(document.querySelector("[data-collapsed]")).not.toBeNull();
    cleanup();
    reduce = false;
    viewport(1280);
    localStorage.clear();
    document.body.classList.add("motion-paused");
    shell();
    fireEvent.click(railBtn());
    expect(app().hasAttribute("data-sliding")).toBe(false);
    document.body.classList.remove("motion-paused");
  });

  it("the width tween is declared only for a viewer who has not asked for less, and labels never wrap while it moves", () => {
    const block = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
    const rule = block.indexOf("transition: width var(--a-dur-3)");
    expect(rule).toBeGreaterThan(0);
    expect(block.lastIndexOf("@media (prefers-reduced-motion: no-preference)", rule)).toBeGreaterThan(block.lastIndexOf("@media (prefers-reduced-motion: reduce)", rule));
    expect(sheet).toMatch(/\.a-app\[data-sliding\]\) \.text[^{]*\{[^}]*white-space:\s*nowrap/);
  });

  it("the group chevron turns with a transition, not a jump", () => {
    const disclosure = css("src/components/ui/Disclosure.module.css");
    expect(disclosure).toMatch(/\.chevron\s*\{[^}]*transition:\s*transform/);
  });
});

describe("the guide lines", () => {
  it("an open group's rows hang from a 1px logical-property line, and the current row lights its segment", () => {
    expect(sheet).toMatch(/\.collapse > \.children::before\s*\{[^}]*inline-size:\s*1px/);
    expect(sheet).toMatch(/\.collapse > \.children\s*\{[^}]*margin-inline-start:\s*1\.375rem/);
    expect(sheet).toMatch(/\.children \.link\[aria-current="page"\]::before\s*\{[^}]*inset-inline-start:\s*-0\.25rem/);
    const guide = sheet.slice(sheet.indexOf(".collapse > .children {"), sheet.indexOf(".children .children"));
    expect(guide).not.toMatch(/\b(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/);
  });
});

describe("icon weight equals text weight", () => {
  it("20px icons at stroke 1.75 beside 500 labels, the current row changing neither", () => {
    expect(STROKE_FOR_SIZE[20]).toBe(1.75);
    shell("/admin/posts");
    const icons = [...nav().querySelectorAll("a svg")];
    expect(icons.length).toBeGreaterThan(2);
    for (const svg of icons) {
      expect(svg.getAttribute("stroke-width")).toBe("1.75");
      expect(svg.getAttribute("width")).toBe("20");
    }
    expect(sheet).not.toMatch(/stroke-width/);
    expect(sheet).not.toMatch(/font-weight:\s*(?:[6-9]00|bold)/);
    expect(index).not.toMatch(/\.a-nav-item\[aria-current="page"\][^{]*\{[^}]*font-weight:\s*700/);
  });

  it("the drawer's own rows use Icon too (no default stroke 2)", async () => {
    viewport(390);
    shell("/admin/posts");
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const foot = document.querySelector(".a-side-foot")!;
    for (const svg of foot.querySelectorAll(".a-nav-icon svg")) expect(svg.getAttribute("stroke-width")).toBe("1.75");
  });
});

describe("Collapse all / Expand all", () => {
  it("one small control: shuts every group, then opens every group, remembered", () => {
    shell("/admin/posts");
    const groups = () => [...nav().querySelectorAll<HTMLElement>("button[data-nav-group][aria-expanded]")];
    expect(groups().some((g) => g.getAttribute("aria-expanded") === "true")).toBe(true);
    fireEvent.click(within(nav()).getByRole("button", { name: "Collapse all" }));
    expect(groups().every((g) => g.getAttribute("aria-expanded") === "false")).toBe(true);
    expect(JSON.parse(localStorage.getItem("admin-nav-open")!)).toMatchObject({ "g-content": false });
    fireEvent.click(within(nav()).getByRole("button", { name: "Expand all" }));
    expect(groups().every((g) => g.getAttribute("aria-expanded") === "true")).toBe(true);
    expect(JSON.parse(localStorage.getItem("admin-nav-open")!)).toMatchObject({ "g-content": true, marketing: true });
  });

  it("is remembered across a remount, and is not drawn in the rail", () => {
    shell("/admin/posts");
    fireEvent.click(within(nav()).getByRole("button", { name: "Collapse all" }));
    cleanup();
    shell("/admin/areas", { section: "areas" });
    /* Arriving on a route opens only the groups on its way; the rest stay as they were left. */
    expect(within(nav()).getByRole("button", { name: /Marketing/ }).getAttribute("aria-expanded")).toBe("false");
    expect(within(nav()).getByRole("button", { name: /Content/ }).getAttribute("aria-expanded")).toBe("true");
    cleanup();
    localStorage.setItem("admin-nav-collapsed", "1");
    shell("/admin/posts");
    expect(screen.queryByRole("button", { name: /all$/ })).toBeNull();
  });

  it("a group heading toggles on click and Left/Right (swapped in RTL) open and close it", () => {
    shell("/admin");
    const content = within(nav()).getByRole("button", { name: /Content/ });
    fireEvent.click(content);
    expect(content.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(content, { key: "ArrowLeft" });
    expect(content.getAttribute("aria-expanded")).toBe("false");
    fireEvent.keyDown(content, { key: "ArrowRight" });
    expect(content.getAttribute("aria-expanded")).toBe("true");
    cleanup();
    document.documentElement.setAttribute("dir", "rtl");
    shell("/admin");
    const c2 = within(nav()).getByRole("button", { name: /Content/ });
    fireEvent.click(c2);
    fireEvent.keyDown(c2, { key: "ArrowRight" });
    expect(c2.getAttribute("aria-expanded")).toBe("false");
  });

  it("Down walks the rows and Ctrl+B still toggles the rail", () => {
    shell("/admin");
    const first = nav().querySelector<HTMLElement>("[data-nav-item]")!;
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).not.toBe(first);
    expect(nav().contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.body, { key: "b", ctrlKey: true });
    expect(app().getAttribute("data-side")).toBe("rail");
  });
});

describe("the phone: floating circle and back pill", () => {
  it("is one named circle with no word, opens the nav tree, and the old Menu bar button is gone", () => {
    viewport(390);
    shell("/admin/posts");
    const header = document.querySelector("header.a-top")!;
    expect(header.querySelector(".a-top-word")).toBeNull();
    /* Outside the sticky bar, so no stacking context traps it under the scrim and the panel. */
    expect(header.querySelector("[data-floating-circle]")).toBeNull();
    expect(document.body.querySelector(":scope > [data-floating-circle]")).not.toBeNull();
    const circle = screen.getByRole("button", { name: "Menu" });
    expect(circle.getAttribute("data-floating-circle")).toBe("");
    expect(circle.textContent).toBe("");
    expect(circle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(circle);
    expect(circle.getAttribute("aria-expanded")).toBe("true");
    const panel = document.getElementById(circle.getAttribute("aria-controls")!)!;
    expect(panel.hasAttribute("data-open")).toBe(true);
    expect(within(panel).getByRole("navigation", { name: "Admin sections" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(circle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(circle);
  });

  it("opening moves focus to the first nav row, not the Collapse-all control", () => {
    viewport(390);
    shell("/admin/posts/1", { backTo: "/admin/posts" });
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(document.activeElement?.hasAttribute("data-nav-item")).toBe(true);
  });

  it("the circle is not drawn once the sidebar is docked", () => {
    shell("/admin/posts");
    expect(document.querySelector("[data-floating-circle]")).toBeNull();
  });

  it("a detail screen's back is the pill: section name drawn, the name contains it, no pill without a parent", () => {
    viewport(390);
    shell("/admin/posts/1", { backTo: "/admin/posts" });
    const pill = document.querySelector<HTMLAnchorElement>("[data-floating-pill]")!;
    expect(pill.getAttribute("href")).toBe("/admin/posts");
    expect(pill.textContent).toBe("Posts");
    expect(pill.getAttribute("aria-label")).toContain(pill.textContent!);
    cleanup();
    shell("/admin/posts");
    expect(document.querySelector("[data-floating-pill]")).toBeNull();
  });

  it("in Hebrew the arrow mirrors and the label is the Hebrew section", () => {
    document.documentElement.setAttribute("lang", "he");
    document.documentElement.setAttribute("dir", "rtl");
    viewport(390);
    shell("/admin/posts/1", { backTo: "/admin/posts" });
    const pill = document.querySelector<HTMLElement>("[data-floating-pill]")!;
    expect(pill.querySelector("svg")!.getAttribute("data-mirror-rtl")).toBe("true");
    expect(screen.getByRole("button", { name: "תפריט" })).toBeTruthy();
  });

  it("the floating controls sit above all admin layers, on glass, with safe-area insets and logical edges", () => {
    const f = css("src/components/ui/FloatingMenu.module.css");
    expect(f).toMatch(/\.circle\s*\{[^}]*position:\s*fixed[^}]*z-index:\s*var\(--float-z/);
    expect(f).toMatch(/backdrop-filter:\s*var\(--glass-blur/);
    expect(f).toMatch(/background:\s*var\(--glass-bg/);
    expect(f).toMatch(/env\(safe-area-inset-right/);
    expect(f).toMatch(/html\[dir="rtl"\]\) \.circle/);
    expect(f).not.toMatch(/\b(left|right)\s*:/);
    /* The panel and the scrim are under the circle (49). */
    expect(index).toMatch(/\.a-side\[data-open\]\s*\{[^}]*z-index:\s*48/);
    expect(index).toMatch(/\.a-scrim:not\(\[hidden\]\)\s*\{[^}]*z-index:\s*44;\s*inset:\s*0/);
  });
});
