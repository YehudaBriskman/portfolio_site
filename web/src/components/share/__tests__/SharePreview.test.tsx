import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ShareMenu from "../ShareMenu";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/settings/schema";
import { resetSettings, setSettings } from "@/settings/store";

const entity = { slug: "a-note", title: "A note", summary: "Why it works", tags: ["ci"] };
const settings = (sharing: Partial<SiteSettings["sharing"]> = {}): SiteSettings => ({
  ...DEFAULT_SETTINGS,
  sharing: { ...DEFAULT_SETTINGS.sharing, ...sharing },
});

let writeText: ReturnType<typeof vi.fn>;
let open: ReturnType<typeof vi.fn>;

beforeEach(() => {
  document.documentElement.lang = "en";
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
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

async function choose(channel: RegExp, name = /Share/) {
  fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });
  const menu = await screen.findByRole("menu");
  fireEvent.click(within(menu).getByRole("menuitem", { name: channel }));
  return screen.findByRole("dialog");
}

describe("share preview sheet", () => {
  it("opens on choosing a channel, with the card, the caption and the count, and sends nothing yet", async () => {
    render(<ShareMenu kind="note" entity={entity} />);
    const sheet = await choose(/LinkedIn/);
    expect(sheet).toHaveAttribute("aria-labelledby");
    expect(within(sheet).getByRole("heading", { name: /LinkedIn/ })).toBeInTheDocument();
    const img = within(sheet).getByRole("img", { name: /A note/ });
    expect(img.getAttribute("src")).toBe(`${window.location.origin}/api/seo/og/blog/a-note.png`);
    const caption = within(sheet).getByRole("textbox", { name: "Caption" }) as HTMLTextAreaElement;
    expect(caption.value).toContain("Look what I found: A note");
    expect(within(sheet).getByText(/of 3,000 characters/)).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("uses the square card for Instagram", async () => {
    render(<ShareMenu kind="note" entity={entity} />);
    const sheet = await choose(/Save image/);
    expect(within(sheet).getByRole("img").getAttribute("src")).toContain("?format=square");
  });

  it("counts as you type, and warns past the limit without blocking", async () => {
    render(<ShareMenu kind="note" entity={entity} />);
    const sheet = await choose(/^X/);
    const caption = within(sheet).getByRole("textbox", { name: "Caption" });
    fireEvent.change(caption, { target: { value: "hello" } });
    expect(within(sheet).getByText("5 of 280 characters")).toBeInTheDocument();
    expect(within(sheet).queryByRole("status")).toBeNull();
    fireEvent.change(caption, { target: { value: "a".repeat(285) } });
    expect(within(sheet).getByText("285 of 280 characters")).toBeInTheDocument();
    expect(within(sheet).getByRole("status")).toHaveTextContent("5 over the limit");
    expect(caption).toHaveAttribute("aria-invalid", "true");
    expect(within(sheet).getByRole("link", { name: /Send/ })).toBeInTheDocument();
  });

  it("Send is the edited caption's own address", async () => {
    render(<ShareMenu kind="note" entity={entity} />);
    const sheet = await choose(/WhatsApp/);
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Caption" }), { target: { value: "My take <b>&</b>" } });
    const send = within(sheet).getByRole("link", { name: /Send/ });
    expect(send.getAttribute("href")).toBe(`https://wa.me/?text=${encodeURIComponent("My take <b>&</b>")}`);
    expect(send).toHaveAttribute("target", "_blank");
    expect(send).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("copies the caption with LinkedIn's Send, because its dialog cannot take text", async () => {
    render(<ShareMenu kind="note" entity={entity} />);
    const sheet = await choose(/LinkedIn/);
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Caption" }), { target: { value: "edited" } });
    const send = within(sheet).getByRole("link", { name: /Send/ });
    expect(send.getAttribute("href")).toMatch(/^https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=/);
    expect(fireEvent.click(send)).toBe(true);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("edited"));
  });

  it("email goes by mailto with the edited body and no new tab", async () => {
    render(<ShareMenu kind="note" entity={entity} />);
    const sheet = await choose(/Email/);
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Caption" }), { target: { value: "line1\nline2" } });
    const send = within(sheet).getByRole("link", { name: /Send/ });
    expect(send.getAttribute("href")).toMatch(/^mailto:\?subject=.+&body=line1%0D%0Aline2$/);
    expect(send).not.toHaveAttribute("target");
  });

  it("Copy copies the edited caption and nothing opens", async () => {
    render(<ShareMenu kind="note" entity={entity} />);
    const sheet = await choose(/Gmail/);
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Caption" }), { target: { value: "mine" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Copy caption" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("mine"));
    expect(open).not.toHaveBeenCalled();
  });

  it("Cancel closes it and sends nothing", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<ShareMenu kind="note" entity={entity} />);
    const sheet = await choose(/X/);
    fireEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(open).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Instagram's button saves the card and copies the caption", async () => {
    const createObjectURL = vi.fn(() => "blob:x");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["png"]), { status: 200 })));
    render(<ShareMenu kind="note" entity={entity} />);
    const sheet = await choose(/Save image/);
    fireEvent.click(within(sheet).getByRole("button", { name: "Save image and copy caption" }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it("native share and Copy link stay one click, with no sheet", async () => {
    render(<ShareMenu kind="note" entity={entity} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Share/ }), { key: "Enter" });
    fireEvent.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Copy link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not offer a channel the settings turned off", async () => {
    setSettings(settings({ channels: ["copy", "x"] }));
    render(<ShareMenu kind="note" entity={entity} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /Share/ }), { key: "Enter" });
    const menu = await screen.findByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: /LinkedIn/ })).toBeNull();
  });
});
