import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ShareMenu from "../ShareMenu";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/settings/schema";
import { resetSettings, setSettings } from "@/settings/store";

const entity = { slug: "a-note", title: "A note", summary: "Why it works", tags: ["ci"] };
const settings = (sharing: Partial<SiteSettings["sharing"]> = {}): SiteSettings => ({
  ...DEFAULT_SETTINGS,
  sharing: { ...DEFAULT_SETTINGS.sharing, ...sharing },
});

const coarse = (on: boolean) =>
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: on && q.includes("coarse"), media: q, addEventListener() {}, removeEventListener() {} }));

async function openMenu(name = /Share/) {
  const trigger = screen.getByRole("button", { name });
  fireEvent.keyDown(trigger, { key: "Enter" });
  return screen.findByRole("menu");
}

let writeText: ReturnType<typeof vi.fn>;
let open: ReturnType<typeof vi.fn>;

beforeEach(() => {
  document.documentElement.lang = "en";
  coarse(false);
  writeText = vi.fn(async () => {});
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  open = vi.fn();
  vi.stubGlobal("open", open);
  resetSettings();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetSettings();
});

describe("ShareMenu menu", () => {
  it("lists the channels; the ones that send open a preview first", async () => {
    render(<ShareMenu kind="note" entity={entity} />);
    const menu = await openMenu();
    const names = within(menu).getAllByRole("menuitem").map((i) => i.textContent);
    expect(names.map((n) => n?.replace(/\s*\(.*\)/, "").trim())).toEqual(["Copy link", "LinkedIn", "Email", "Gmail", "X", "WhatsApp", "Save image"]);
    // None of them is a link: nothing can leave the page from the menu itself.
    expect(within(menu).queryAllByRole("link")).toHaveLength(0);
    expect(within(menu).getAllByRole("menuitem").some((i) => i.hasAttribute("href"))).toBe(false);
  });

  it("sends nothing and opens nothing before a click", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<ShareMenu kind="note" entity={entity} />);
    await openMenu();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the address", async () => {
    render(<ShareMenu kind="note" entity={entity} />);
    const menu = await openMenu();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Copy link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain(`${window.location.origin}/blog/a-note`);
  });

  it("is a keyboard menu: arrow keys move, Escape closes and returns focus", async () => {
    render(<ShareMenu kind="note" entity={entity} />);
    const trigger = screen.getByRole("button", { name: /Share/ });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    const menu = await openMenu();
    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    expect(trigger).toHaveFocus();
  });

  it("opens right-to-left in Hebrew, in Hebrew words", async () => {
    document.documentElement.lang = "he";
    render(<ShareMenu kind="note" entity={{ ...entity, title: "רשימה" }} />);
    const menu = await openMenu(/שיתוף/);
    expect(menu).toHaveAttribute("dir", "rtl");
    expect(within(menu).getByRole("menuitem", { name: "העתקת קישור" })).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("menuitem", { name: /LinkedIn/ }));
    const sheet = await screen.findByRole("dialog", { name: /שיתוף/ });
    expect(sheet).toHaveAttribute("dir", "rtl");
    expect(within(sheet).getByRole("link", { name: /שליחה/ }).getAttribute("href")).toContain(encodeURIComponent("/he/blog/a-note"));
  });
});

describe("ShareMenu settings", () => {
  it("renders nothing when sharing is off or the surface is not enabled", () => {
    setSettings(settings({ enabled: false }));
    const { container, rerender } = render(<ShareMenu kind="note" entity={entity} />);
    expect(container).toBeEmptyDOMElement();
    act(() => setSettings(settings({ surfaces: ["project"] })));
    rerender(<ShareMenu kind="note" entity={entity} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ShareMenu kind="project" entity={entity} />);
    expect(screen.getByRole("button", { name: /Share/ })).toBeInTheDocument();
  });

  it("hides a disabled channel", async () => {
    setSettings(settings({ channels: ["copy", "x"] }));
    render(<ShareMenu kind="note" entity={entity} />);
    const menu = await openMenu();
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(2);
    expect(within(menu).queryByRole("menuitem", { name: /LinkedIn/ })).toBeNull();
    expect(within(menu).queryByRole("menuitem", { name: /Gmail/ })).toBeNull();
  });

  it("renders nothing when only the native channel is on and the browser has no share sheet", () => {
    setSettings(settings({ channels: ["native"] }));
    const { container } = render(<ShareMenu kind="note" entity={entity} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ShareMenu native sheet", () => {
  it("on a touch device calls navigator.share first, with the card file when files are accepted", async () => {
    coarse(true);
    const share = vi.fn(async (_data: unknown) => {});
    const canShare = vi.fn(() => true);
    vi.stubGlobal("navigator", { clipboard: { writeText }, share, canShare });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["png"]), { status: 200 })));
    render(<ShareMenu kind="note" entity={entity} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Share/ }), { key: "Enter" });
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const data = share.mock.calls[0][0] as { url: string; files?: File[] };
    expect(data.url).toContain("/blog/a-note");
    expect(data.files).toHaveLength(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("shares without the file when the browser will not take files", async () => {
    coarse(true);
    const share = vi.fn(async (_data: unknown) => {});
    vi.stubGlobal("navigator", { clipboard: { writeText }, share, canShare: (d: { files?: File[] }) => !d.files });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["png"]))));
    render(<ShareMenu kind="note" entity={entity} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Share/ }), { key: "Enter" });
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect((share.mock.calls[0][0] as { files?: File[] }).files).toBeUndefined();
  });

  it("falls back to the menu when the sheet refuses", async () => {
    coarse(true);
    const share = vi.fn(async (_data: unknown) => Promise.reject(new Error("denied")));
    vi.stubGlobal("navigator", { clipboard: { writeText }, share });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    render(<ShareMenu kind="note" entity={entity} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Share/ }), { key: "Enter" });
    expect(await screen.findByRole("menu")).toBeInTheDocument();
  });

  it("does not use the sheet on a pointer device, even where it exists", async () => {
    const share = vi.fn(async (_data: unknown) => {});
    vi.stubGlobal("navigator", { clipboard: { writeText }, share });
    render(<ShareMenu kind="note" entity={entity} />);
    await openMenu();
    expect(share).not.toHaveBeenCalled();
  });
});
