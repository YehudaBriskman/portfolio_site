import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AdminProjects from "@/pages/AdminProjects";
import AdminSiteCopy from "@/pages/AdminSiteCopy";
import AdminStory from "@/pages/AdminStory";
import { seedBundle } from "@/content/convert";

/*
 * /admin/projects, /story and /site-copy on a phone: the project list is one
 * compact row per project with a Reorder mode, the form is field groups
 * (Basics open, the rest closed), one language at a time, and leaving with an
 * edit that is not saved asks first. The payload is the desktop's, byte for byte.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const viewOf = (key: string, published: unknown) => ({
  ok: true, key, exists: true, _rev: "1-abc", published, draft: null,
  updatedAt: "2026-11-01T10:00:00.000Z", publishedAt: "2026-11-01T10:00:00.000Z", source: "admin",
});

type Call = { url: string; method: string; body: unknown };

function stubApi(key: string, published: unknown) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const call = { url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null };
      calls.push(call);
      if (url === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
      if (call.method === "GET") return json(viewOf(key, published));
      return json(viewOf(key, (call.body as { data: unknown }).data));
    }),
  );
  return calls;
}

function phone(on: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: on && /max-width:\s*599px/.test(q),
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
    onchange: null,
  })) as typeof window.matchMedia;
}

const page = (el: React.ReactElement) => render(<MemoryRouter>{el}</MemoryRouter>);
const projects = () => seedBundle().projects.items;

async function publish() {
  fireEvent.click(screen.getAllByRole("button", { name: /^(Publish|פרסום)$/ })[0]);
}

beforeEach(() => phone(true));
afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
});

describe("projects on a phone: the list", () => {
  it("is one row per project, with no per-row arrows or remove", async () => {
    stubApi("projects", seedBundle().projects);
    page(<AdminProjects />);
    const first = projects()[0];
    expect(await screen.findByRole("button", { name: `Edit ${first.title}` })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Move /i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Remove /i })).toBeNull();
  });

  it("Reorder mode shows move and remove, and moving from the keyboard announces it", async () => {
    const user = userEvent.setup();
    const calls = stubApi("projects", seedBundle().projects);
    page(<AdminProjects />);
    const [a, b] = projects();
    await user.click(await screen.findByRole("button", { name: "Reorder" }));
    expect(screen.getByRole("button", { name: "Done" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: `Move ${a.title} up` })).toBeDisabled();
    const down = screen.getByRole("button", { name: `Move ${a.title} down` });
    down.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText(`${a.title} moved to position 2 of ${projects().length}`)).toBeInTheDocument();
    // focus follows the moved row, so a second press keeps moving it
    expect(screen.getByRole("button", { name: `Move ${a.title} down` })).toHaveFocus();
    expect(screen.getByRole("button", { name: `Remove ${b.title}` })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Done" }));
    await publish();
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const sent = (calls.find((c) => c.method === "POST")!.body as { data: { items: Array<{ slug: string; order: number }> } }).data.items;
    expect(sent[0].slug).toBe(b.slug);
    expect(sent[1].slug).toBe(a.slug);
    expect(sent.map((i) => i.order)).toEqual(sent.map((_, i) => i));
  });

  it("removing a project from Reorder mode removes it from the payload", async () => {
    const user = userEvent.setup();
    const calls = stubApi("projects", seedBundle().projects);
    page(<AdminProjects />);
    const [a] = projects();
    await user.click(await screen.findByRole("button", { name: "Reorder" }));
    await user.click(screen.getByRole("button", { name: `Remove ${a.title}` }));
    await publish();
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const sent = (calls.find((c) => c.method === "POST")!.body as { data: { items: Array<{ slug: string }> } }).data.items;
    expect(sent.map((i) => i.slug)).not.toContain(a.slug);
    expect(sent).toHaveLength(projects().length - 1);
  });
});

describe("projects on a phone: field groups", () => {
  it("Basics is open and the rest are closed; each toggles with aria-expanded", async () => {
    const user = userEvent.setup();
    stubApi("projects", seedBundle().projects);
    page(<AdminProjects />);
    const basics = await screen.findByRole("button", { name: "Basics" });
    expect(basics).toHaveAttribute("aria-expanded", "true");
    for (const name of ["Links", "Media", "Details"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-expanded", "false");
    }
    const links = screen.getByRole("button", { name: "Links" });
    expect(document.getElementById(links.getAttribute("aria-controls")!)).toHaveAttribute("hidden");
    await user.click(links);
    expect(links).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(links.getAttribute("aria-controls")!)).not.toHaveAttribute("hidden");
    await user.click(links);
    expect(links).toHaveAttribute("aria-expanded", "false");
  });

  it("a group holding a field that fails the check opens by itself", async () => {
    stubApi("projects", seedBundle().projects);
    page(<AdminProjects />);
    fireEvent.change(await screen.findByLabelText("Slug"), { target: { value: "ok-slug" } });
    const links = screen.getByRole("button", { name: "Links" });
    await userEvent.setup().click(links); // open, to type in it
    fireEvent.change(await screen.findByLabelText("Main link"), { target: { value: "not a url" } });
    await userEvent.setup().click(links); // close it again
    expect(links).toHaveAttribute("aria-expanded", "false");
    await publish();
    await waitFor(() => expect(screen.getByRole("button", { name: /Links/ })).toHaveAttribute("aria-expanded", "true"));
  });
});

describe("a phone edits one language at a time", () => {
  it("shows English by default, and only the Hebrew input after switching", async () => {
    const user = userEvent.setup();
    stubApi("projects", seedBundle().projects);
    page(<AdminProjects />);
    expect(await screen.findByLabelText("One-line fact, English")).toBeInTheDocument();
    expect(screen.queryByLabelText("One-line fact, Hebrew (optional)")).toBeNull();
    const group = screen.getByRole("radiogroup", { name: "Language" });
    expect(within(group).getByRole("radio", { name: "English" })).toBeChecked();
    await user.click(within(group).getByRole("radio", { name: "Hebrew" }));
    expect(await screen.findByLabelText("One-line fact, Hebrew (optional)")).toBeInTheDocument();
    expect(screen.queryByLabelText("One-line fact, English")).toBeNull();
  });

  it("the desktop still shows both inputs together", async () => {
    phone(false);
    stubApi("projects", seedBundle().projects);
    page(<AdminProjects />);
    expect(await screen.findByLabelText("One-line fact, English")).toBeInTheDocument();
    expect(screen.getByLabelText("One-line fact, Hebrew (optional)")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Language" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reorder" })).toBeNull();
  });
});

describe("the payload does not depend on the screen size", () => {
  async function sendEdit(on: boolean) {
    phone(on);
    const calls = stubApi("projects", seedBundle().projects);
    const view = page(<AdminProjects />);
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Edited title" } });
    if (on) await userEvent.setup().click(await screen.findByRole("radio", { name: "Hebrew" }));
    fireEvent.change(await screen.findByLabelText("One-line fact, Hebrew (optional)"), { target: { value: "עובדה" } });
    await publish();
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    view.unmount();
    return JSON.stringify(calls.find((c) => c.method === "POST")!.body);
  }

  it("phone and desktop send the same bytes for the same edit", async () => {
    const desktop = await sendEdit(false);
    const mobile = await sendEdit(true);
    expect(mobile).toBe(desktop);
  });
});

describe("leaving with an edit that is not saved", () => {
  it("asks on tab close only after an edit", async () => {
    stubApi("projects", seedBundle().projects);
    page(<AdminProjects />);
    const title = await screen.findByLabelText("Title");
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    fireEvent.change(title, { target: { value: "Edited" } });
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it("asks before a link inside the app, and stays when the answer is no", async () => {
    stubApi("projects", seedBundle().projects);
    const ask = vi.spyOn(window, "confirm").mockReturnValue(false);
    const view = page(
      <>
        <a href="/admin/posts">posts</a>
        <AdminProjects />
      </>,
    );
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Edited" } });
    const link = view.getByText("posts");
    const e = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(e);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
    ask.mockRestore();
  });

  it("does not ask once the edit is published", async () => {
    stubApi("projects", seedBundle().projects);
    page(<AdminProjects />);
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Edited" } });
    await publish();
    await screen.findAllByText(/Saved/);
    const after = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});

describe("the bar stays one row", () => {
  it("has Publish as the one visible action and the rest behind More", async () => {
    stubApi("projects", seedBundle().projects);
    page(<AdminProjects />);
    await screen.findByLabelText("Title");
    expect(screen.getAllByRole("button", { name: "Publish" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "More actions" })).toHaveLength(1);
  });
});

describe("story and site copy on a phone", () => {
  it("site copy: Hero opens first, the rest wait, and search finds a group by a field name", async () => {
    const user = userEvent.setup();
    stubApi("site-copy", seedBundle().siteCopy);
    page(<AdminSiteCopy />);
    const hero = await screen.findByRole("button", { name: "Hero" });
    expect(hero).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Footer" })).toHaveAttribute("aria-expanded", "false");
    await user.type(screen.getByRole("searchbox", { name: "Search site copy" }), "colophon");
    expect(await screen.findByRole("status")).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "Footer" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("button", { name: "Hero" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(await screen.findByRole("button", { name: "Hero" })).toBeInTheDocument();
  });

  it("story: groups collapse and one language shows", async () => {
    stubApi("story", seedBundle().story);
    page(<AdminStory />);
    const opening = await screen.findByRole("button", { name: "The opening" });
    expect(opening).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByLabelText("Title, Hebrew (optional)")).toBeNull();
    expect(screen.getByLabelText("Title, English")).toBeInTheDocument();
  });
});

describe("Hebrew", () => {
  it("reads the words in Hebrew: groups, switcher, Reorder", async () => {
    document.documentElement.lang = "he";
    document.documentElement.dir = "rtl";
    stubApi("projects", seedBundle().projects);
    page(<AdminProjects />);
    expect(await screen.findByRole("button", { name: "בסיס" })).toHaveAttribute("aria-expanded", "true");
    const group = screen.getByRole("radiogroup", { name: "שפה" });
    expect(within(group).getByRole("radio", { name: "אנגלית" })).toBeInTheDocument();
    expect(within(group).getByRole("radio", { name: "עברית" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "סידור" })).toBeInTheDocument();
    expect(group.closest("[dir]")?.getAttribute("dir")).toBe("rtl");
  });
});
