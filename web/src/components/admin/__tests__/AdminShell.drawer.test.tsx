import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";

/*
 * The admin drawer is a state flag that guards <main inert>. A flag that can
 * outlive its control leaves a dead page: widening past the drawer breakpoint
 * hides the toggle, and tapping the link to the page you are on changes no URL
 * to close it on.
 */

let width = 800;
const listeners = new Set<() => void>();
function viewport(w: number) {
  width = w;
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+(?:\.\d+)?)px/.exec(query);
    const max = /max-width:\s*(\d+(?:\.\d+)?)px/.exec(query);
    return {
      media: query,
      get matches() {
        return min ? width >= Number(min[1]) : max ? width <= Number(max[1]) : false;
      },
      onchange: null,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  });
}
const resize = (w: number) => {
  width = w;
  act(() => listeners.forEach((cb) => cb()));
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

function Probe() {
  const loc = useLocation();
  const type = useNavigationType();
  return <output data-testid="nav">{`${type} ${loc.pathname}`}</output>;
}

beforeEach(() => {
  listeners.clear();
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => (url === "/api/admin/me" ? json({ ok: true, login: "owner", email: null }) : json({ ok: true }))),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const shell = () =>
  render(
    <MemoryRouter initialEntries={["/admin/posts"]}>
      <AdminShell title="T" section="posts">
        <p>x</p>
      </AdminShell>
      <Probe />
    </MemoryRouter>,
  );

const main = () => document.querySelector("main")!;
const side = () => document.querySelector(".a-side")!;

describe("the admin drawer", () => {
  it("opens, makes <main> inert and closes on the toggle", () => {
    viewport(800);
    shell();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(side().hasAttribute("data-open")).toBe(true);
    expect(main().hasAttribute("inert")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(main().hasAttribute("inert")).toBe(false);
  });

  it("widening past the sidebar breakpoint closes the drawer and drops inert", () => {
    viewport(800);
    shell();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(main().hasAttribute("inert")).toBe(true);
    resize(1280);
    expect(main().hasAttribute("inert")).toBe(false);
    expect(side().hasAttribute("data-open")).toBe(false);
    // narrowing again must not bring the old drawer back
    resize(800);
    expect(side().hasAttribute("data-open")).toBe(false);
    expect(main().hasAttribute("inert")).toBe(false);
  });

  it("is never inert at a docked width, whatever the state says", () => {
    viewport(1280);
    shell();
    expect(main().hasAttribute("inert")).toBe(false);
  });

  it("tapping the link to the page you are on closes the drawer without a new history entry", () => {
    viewport(390);
    shell();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const link = within(side() as HTMLElement).getAllByRole("link").find((a) => a.getAttribute("href") === "/admin/posts")!;
    fireEvent.click(link);
    expect(side().hasAttribute("data-open")).toBe(false);
    expect(main().hasAttribute("inert")).toBe(false);
    expect(screen.getByTestId("nav").textContent).toBe("REPLACE /admin/posts");
  });
});
