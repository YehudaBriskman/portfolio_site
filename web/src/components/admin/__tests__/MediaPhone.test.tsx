import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ToastHost from "@/components/ui/ToastHost";
import { __resetToasts } from "@/lib/toast";
import AdminMedia from "@/pages/AdminMedia";
import type { MediaItem } from "@/services/media";

/*
 * /admin/media below 600px (#681): square tiles, one button each; a sheet with
 * the one decision (alt text) first; bulk delete for unused items only.
 * jsdom has no layout, so what it cannot see (columns, overflow) is read off
 * the CSS text here and measured in a real browser for the PR.
 */

const item = (id: string, extra: Partial<MediaItem> = {}): MediaItem => ({
  id,
  _rev: "1-a",
  name: `${id}.jpg`,
  alt: `Alt for ${id}`,
  caption: "",
  credit: "",
  kind: "image",
  format: "jpeg",
  mime: "image/jpeg",
  file: null,
  width: 1600,
  height: 900,
  bytes: 120_000,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  url: `https://yehudabriskman.com/api/images/media/${id}`,
  preview: `/api/images/m/${id}/w400-${"a".repeat(16)}.webp`,
  srcset: { avif: "", webp: "" },
  usedBy: [],
  ...extra,
});

const USE = { id: "collection:windom", type: "collection", title: "WindoM", slug: "windom", field: "coverImage" };
const fresh = (): MediaItem[] => [
  item("used-1", { alt: "A clock over the aurora", usedBy: [USE] }),
  item("free-1", { alt: "An orange sports car" }),
  item("free-2", { alt: "A quiet harbour" }),
  item("noalt-1", { alt: "" }),
  item("leaf-1", { alt: "A leaf", kind: "icon", format: "svg", mime: "image/svg+xml", file: `/api/images/m/leaf-1/icon-${"b".repeat(16)}.svg`, monochrome: true }),
  item("tour-1", { alt: "A walk through the dashboard", kind: "video", format: "mp4", mime: "video/mp4", file: `/api/images/m/tour-1/video-${"c".repeat(16)}.mp4`, durationMs: 12_000, hasAudio: false, captions: null }),
];

let stored: MediaItem[];
let calls: Array<{ url: string; method: string }>;

function phone(on: boolean) {
  const real = window.matchMedia;
  window.matchMedia = ((q: string) => ({ ...real(q), matches: on && /max-width:\s*599px/.test(q) })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = real;
  };
}

let undoPhone: () => void;
beforeEach(() => {
  window.localStorage.clear();
  stored = fresh();
  calls = [];
  undoPhone = phone(true);
  Object.assign(HTMLDialogElement.prototype, {
    showModal: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
    close: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      if (url === "/api/admin/me") return new Response(JSON.stringify({ ok: true, login: "owner", email: null }));
      if (url.startsWith("/api/admin/media") && method === "GET") return new Response(JSON.stringify({ ok: true, items: stored }));
      if (url.startsWith("/api/admin/media/") && method === "DELETE") return new Response(JSON.stringify({ ok: true }));
      return new Response(JSON.stringify({ ok: true }));
    }),
  );
});
afterEach(() => {
  __resetToasts();
  cleanup();
  undoPhone();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
  document.documentElement.lang = "en";
  document.documentElement.removeAttribute("dir");
});

const page = (path = "/admin/media") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/media" element={<AdminMedia />} />
      </Routes>
      <ToastHost />
    </MemoryRouter>,
  );
const grid = () =>
  waitFor(() => {
    const g = document.querySelector<HTMLElement>("[data-media-grid]");
    if (!g) throw new Error("no grid yet");
    return g;
  });
const tile = (name: RegExp | string) => screen.findByRole("button", { name });
const dialog = () => screen.findByRole("dialog");

describe("Media on a phone: the grid", () => {
  it("draws square tiles, one button each, with nothing interactive inside and no text line under the picture", async () => {
    page();
    const g = await grid();
    const items = [...g.querySelectorAll("li")];
    expect(items.length).toBe(stored.length);
    for (const li of items) {
      expect(li.querySelectorAll("button, a, input, select, textarea").length).toBe(1);
      expect(li.querySelector("button")?.getAttribute("data-media-tile")).not.toBeNull();
      expect(li.textContent?.replace(/\s/g, "") ?? "").toBe("");
    }
    expect(screen.queryByRole("radio")).toBeNull();
    expect(document.querySelector("dl")).toBeNull();
  });

  it("names every tile with its alt text and its state, so no state is a badge alone", async () => {
    page();
    expect((await tile(/A clock over the aurora/)).getAttribute("aria-label")).toMatch(/used in 1 place/i);
    expect((await tile(/An orange sports car/)).getAttribute("aria-label")).toMatch(/not used/i);
    expect((await tile(/noalt-1\.jpg/)).getAttribute("aria-label")).toMatch(/no alt text/i);
    expect((await tile(/A leaf/)).getAttribute("aria-label")).toMatch(/icon/i);
    expect((await tile(/A walk through the dashboard/)).getAttribute("aria-label")).toMatch(/video/i);
  });

  it("draws at most one status glyph per tile (used, or no alt text) and a kind icon for a video or an icon", async () => {
    page();
    const g = await grid();
    g.querySelectorAll("li").forEach((li) => expect(li.querySelectorAll("[data-kind]").length).toBeLessThanOrEqual(1));
    expect(g.querySelector('[data-kind="attention"]')).not.toBeNull();
    const lis = [...g.querySelectorAll("li")];
    expect(lis[4].querySelector("[data-media-kind='icon']")).not.toBeNull();
    expect(lis[5].querySelector("[data-media-kind='video']")).not.toBeNull();
    expect(lis[1].querySelector("[data-media-kind]")).toBeNull();
  });

  it("an unused tile is dashed", async () => {
    page();
    const g = await grid();
    const lis = [...g.querySelectorAll("li")];
    expect(lis[1].querySelector("button")?.getAttribute("data-unused")).toBe("true");
    expect(lis[0].querySelector("button")?.getAttribute("data-unused")).toBeNull();
  });

  it("its CSS holds 3 columns at 360, 390 and 430, square tiles, and no sideways scroll", () => {
    const css = readFileSync(resolve(__dirname, "../Media.phone.module.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const cols = (width: number) => {
      let out = 0;
      for (const m of css.matchAll(/(@media\s*\(min-width:\s*([\d.]+)(rem|px)\)\s*\{)?\s*\.grid\s*\{[^}]*?grid-template-columns:\s*repeat\((\d+),/g)) {
        const min = m[2] ? Number(m[2]) * (m[3] === "rem" ? 16 : 1) : 0;
        if (min <= width) out = Number(m[4]);
      }
      return out;
    };
    for (const w of [360, 390, 430]) expect(cols(w)).toBe(3);
    expect(cols(320)).toBe(2);
    expect(css).toMatch(/\.tile\s*\{[^}]*aspect-ratio:\s*1\s*(\/\s*1)?\s*;/);
    expect(css).toMatch(/grid-template-columns:\s*repeat\(\d,\s*minmax\(0,\s*1fr\)\)/);
    expect(css).not.toMatch(/overflow-x\s*:\s*(auto|scroll)/);
    expect(css).not.toMatch(/(^|[;{\s])(width|min-width)\s*:\s*\d+px/);
    expect(css).not.toMatch(/(^|[;{\s])(margin|padding)-(left|right)\s*:/);
    expect(css).not.toMatch(/(^|[;{\s])(left|right)\s*:/);
  });

  it("collapses the explainer: it is not in the page until the info button opens it", async () => {
    page();
    await grid();
    expect(screen.queryByText(/cleaned of\s+camera/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /About/ }));
    expect(await screen.findByText(/Anything in use cannot be deleted/)).toBeTruthy();
  });

  it("leaves the desktop alone above 600px: radios, the explainer and the tile text", async () => {
    undoPhone();
    undoPhone = phone(false);
    page();
    await screen.findAllByRole("list", { name: /pictures/ });
    expect(screen.getByRole("radio", { name: "Icons" })).toBeTruthy();
    expect(screen.getByText(/Anything in use cannot be deleted/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Select$/ })).toBeNull();
  });
});

describe("Media on a phone: filters and search", () => {
  it("has chips for kind, unused and no alt text, and a chip narrows the grid and says it is on", async () => {
    page();
    await grid();
    for (const n of ["Pictures", "Icons", "Videos", "Unused", "No alt text"]) expect(screen.getByRole("button", { name: n }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Unused" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /A clock over the aurora/ })).toBeNull());
    expect(screen.getByRole("button", { name: "Unused" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /An orange sports car/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /A leaf/ })).toBeTruthy();
  });

  it("No alt text keeps only the items without alt text", async () => {
    page();
    await grid();
    fireEvent.click(screen.getByRole("button", { name: "No alt text" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /A leaf/ })).toBeNull());
    expect(screen.getByRole("button", { name: /noalt-1\.jpg/ })).toBeTruthy();
  });

  it("the kind filter keeps living in ?kind=", async () => {
    page("/admin/media?kind=icon");
    await grid();
    expect(screen.getByRole("button", { name: "Icons" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: /An orange sports car/ })).toBeNull();
    expect(screen.getByRole("button", { name: /A leaf/ })).toBeTruthy();
  });

  it("search narrows by alt text and says so when nothing matches", async () => {
    page();
    await grid();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "harbour" } });
    await waitFor(() => expect(screen.queryByRole("button", { name: /An orange sports car/ })).toBeNull());
    expect(screen.getByRole("button", { name: /A quiet harbour/ })).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(await screen.findByText(/Nothing matches/)).toBeTruthy();
  });
});

describe("Media on a phone: the sheet", () => {
  it("opens from the tile, puts the alt text first, then where it is used, then the details closed", async () => {
    page();
    const t = await tile(/A clock over the aurora/);
    t.focus();
    fireEvent.click(t);
    const d = await dialog();
    const alt = within(d).getByRole("textbox", { name: /Alt text \(required\)/ });
    const heAlt = within(d).getByRole("textbox", { name: /Alt text in Hebrew/ });
    const used = within(d).getByRole("heading", { name: "Where it is used" });
    const details = within(d).getByText("Details").closest("details")!;
    const order = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(order(alt, heAlt)).toBe(true);
    expect(order(heAlt, used)).toBe(true);
    expect(order(used, details)).toBe(true);
    expect(details.open).toBe(false);
    expect(details.textContent).toMatch(/Picture/);
    expect(details.textContent).toMatch(/\/api\/images\/media\/used-1/);
    expect(within(d).getByRole("link", { name: "WindoM" }).getAttribute("href")).toBe("/admin/areas/windom");
    expect(d.querySelector("dl")?.closest("details")).toBe(details);
  });

  it("keeps the alt text rule: an empty alt is refused with the existing words", async () => {
    page("/admin/media?id=noalt-1");
    const d = await dialog();
    fireEvent.change(within(d).getByRole("textbox", { name: /Alt text \(required\)/ }), { target: { value: " " } });
    fireEvent.click(within(d).getByRole("button", { name: "Save details" }));
    expect(await within(d).findByRole("alert")).toHaveTextContent("Alt text is required.");
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("hands focus back to the tile on close", async () => {
    page();
    const t = await tile(/An orange sports car/);
    t.focus();
    fireEvent.click(t);
    const d = await dialog();
    fireEvent.click(within(d).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(t);
  });

  it("blocks Delete for an item in use, and says why", async () => {
    page("/admin/media?id=used-1");
    const d = await dialog();
    const del = within(d).getByRole("button", { name: "Delete" });
    expect(del).toBeDisabled();
    expect(d.textContent).toMatch(/In use, so it cannot be deleted/);
    fireEvent.click(del);
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("deletes an unused item after the confirm", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    page("/admin/media?id=free-1");
    const d = await dialog();
    expect(within(d).getByText("Nothing uses this picture yet.")).toBeTruthy();
    fireEvent.click(within(d).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url.includes("free-1"))).toBe(true));
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });
});

describe("Media on a phone: bulk select", () => {
  const enterSelect = async () => {
    await grid();
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
  };

  it("lists only unused items in select mode, so an item in use cannot be chosen", async () => {
    page();
    await enterSelect();
    await waitFor(() => expect(screen.queryByRole("button", { name: /A clock over the aurora/ })).toBeNull());
    expect(screen.queryByRole("checkbox", { name: /A clock over the aurora/ })).toBeNull();
    expect(screen.getAllByRole("checkbox").length).toBe(5);
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(await screen.findByText("5 selected")).toBeTruthy();
  });

  it("deletes after a confirm that names the count, then an Undo window; Undo deletes nothing", async () => {
    page();
    await enterSelect();
    fireEvent.click(await screen.findByRole("checkbox", { name: /An orange sports car/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /A quiet harbour/ }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    fireEvent.click(await screen.findByRole("button", { name: "Delete 2 items" }));
    const undo = await screen.findByRole("button", { name: "Undo" });
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    fireEvent.click(undo);
    await waitFor(() => expect(screen.getByRole("button", { name: /An orange sports car/ })).toBeTruthy());
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("sends the delete for the chosen unused items only, once the Undo window closes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    page();
    await enterSelect();
    fireEvent.click(await screen.findByRole("button", { name: "Select all" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete 5 items" }));
    await screen.findByRole("button", { name: "Undo" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8500);
    });
    await waitFor(() => expect(calls.filter((c) => c.method === "DELETE").length).toBe(5));
    const urls = calls.filter((c) => c.method === "DELETE").map((c) => c.url);
    expect(urls.some((u) => u.includes("used-1"))).toBe(false);
    for (const id of ["free-1", "free-2", "noalt-1", "leaf-1", "tour-1"]) expect(urls.some((u) => u.includes(`/${id}?`))).toBe(true);
  });
});

describe("Media on a phone: Hebrew", () => {
  it("renders the grid, the chips and the sheet in Hebrew with no English chrome left", async () => {
    document.documentElement.lang = "he";
    document.documentElement.setAttribute("dir", "rtl");
    page();
    const t = await tile(/A clock over the aurora/);
    expect(t.getAttribute("aria-label")).toMatch(/[֐-׿]/);
    for (const n of ["Unused", "No alt text", "Select"]) expect(screen.queryByRole("button", { name: n })).toBeNull();
    t.focus();
    fireEvent.click(t);
    const d = await dialog();
    expect(within(d).getByRole("textbox", { name: /Alt text in Hebrew|טקסט חלופי בעברית/ }).getAttribute("dir")).toBe("rtl");
    const data = ["used-1.jpg", "A clock over the aurora", "WindoM", "coverImage", "collection", "https://yehudabriskman.com/api/images/media/used-1", "JPEG", "AVIF", "WebP"];
    const text = data.reduce((s, x) => s.split(x).join(""), d.textContent ?? "");
    expect(text.match(/[A-Za-z]{3,}/g) ?? []).toEqual([]);
    fireEvent.click(within(d).getByRole("button", { name: "סגירה" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(t);
  });
});
