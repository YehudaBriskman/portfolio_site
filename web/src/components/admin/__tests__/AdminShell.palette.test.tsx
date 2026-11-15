import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";

/*
 * Ctrl+K is wired once, in the shell, beside Ctrl+B (A32, M12): it opens the
 * palette from any admin screen, the palette's Go to reaches a route, and the
 * sidebar's key still folds the sidebar. jsdom has no showModal.
 */

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const Where = () => <output data-testid="where">{useLocation().pathname + useLocation().search}</output>;

function wide() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    matches: /min-width:\s*1024px/.test(query),
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  localStorage.clear();
  wide();
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
    close(this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => (url === "/api/admin/me" ? json({ ok: true, login: "owner", email: null }) : json({ ok: true }))),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

const shell = () =>
  render(
    <MemoryRouter initialEntries={["/admin/posts"]}>
      <AdminShell title="T" section="posts">
        <p>x</p>
      </AdminShell>
      <Where />
    </MemoryRouter>,
  );

describe("AdminShell command palette", () => {
  it("opens on Ctrl+K and on Cmd+K, closes on a second press, and lists the nav and the create actions", () => {
    shell();
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.getByRole("combobox", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /New post/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Translations/ })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("works from a Hebrew layout, where the key is not the letter", () => {
    shell();
    fireEvent.keyDown(document, { key: "ל", code: "KeyK", ctrlKey: true });
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("the top-bar Search button opens it too", () => {
    shell();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("Go to navigates, and Enter on a create action reaches its route", () => {
    shell();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const box = screen.getByRole("combobox");
    fireEvent.change(box, { target: { value: "new post" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(screen.getByTestId("where")).toHaveTextContent("/admin/posts/new");
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("does not take Ctrl+B: the sidebar still folds, and Ctrl+B in a field is left to the field", () => {
    shell();
    const side = () => document.querySelector(".a-app")!.getAttribute("data-side");
    expect(side()).toBe("full");
    fireEvent.keyDown(document, { key: "b", ctrlKey: true });
    expect(side()).toBe("rail");
    expect(screen.queryByRole("combobox")).toBeNull();
    const field = document.body.appendChild(document.createElement("input"));
    fireEvent.keyDown(field, { key: "b", ctrlKey: true });
    expect(side()).toBe("rail");
    field.remove();
  });
});
