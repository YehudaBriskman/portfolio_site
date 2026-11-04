import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MediaPicker from "@/components/admin/MediaPicker";
import AdminMedia from "@/pages/AdminMedia";
import { blobSrc, checkFile, librarySrc, mediaIdOf, type MediaItem } from "@/services/media";

/*
 * The media library's admin UI (#253): the picker hands back the stable URL,
 * a picture in use cannot be deleted from the page, and an upload needs alt
 * text before it is sent.
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

const ITEMS = [
  item("windom-abc123", { alt: "A clock over the aurora", usedBy: [{ id: "collection:windom", type: "collection", title: "WindoM", slug: "windom", field: "coverImage" }] }),
  item("icaros-def456", { alt: "An orange sports car" }),
  item("leaf-aaa111", {
    alt: "A leaf",
    kind: "icon",
    format: "svg",
    mime: "image/svg+xml",
    file: `/api/images/m/leaf-aaa111/icon-${"b".repeat(16)}.svg`,
    preview: `/api/images/m/leaf-aaa111/icon-${"b".repeat(16)}.svg`,
    monochrome: true,
  }),
  item("tour-bbb222", {
    alt: "A walk through the dashboard",
    kind: "video",
    format: "mp4",
    mime: "video/mp4",
    file: `/api/images/m/tour-bbb222/video-${"c".repeat(16)}.mp4`,
    durationMs: 12_000,
    hasAudio: false,
    captions: null,
  }),
];

let requests: Array<{ url: string; method: string; body: unknown }>;

beforeEach(() => {
  requests = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, method: init?.method ?? "GET", body: init?.body });
      if (url === "/api/admin/me") return new Response(JSON.stringify({ ok: true, login: "owner", email: null }));
      if (url.startsWith("/api/admin/media") && (init?.method ?? "GET") === "GET") {
        return new Response(JSON.stringify({ ok: true, items: ITEMS }));
      }
      return new Response(JSON.stringify({ ok: false, error: "unexpected" }), { status: 500 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("MediaPicker", () => {
  it("lists the library, filters it, and hands back the stable URL", async () => {
    const onChange = vi.fn();
    render(<MediaPicker value="" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Choose from library" }));
    const grid = await screen.findByRole("list", { name: "Pictures" });
    // A cover takes a picture: the icon and the video in the library are not offered.
    expect(within(grid).getAllByRole("button")).toHaveLength(2);

    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "sports");
    expect(within(screen.getByRole("list", { name: "Pictures" })).getAllByRole("button")).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: /An orange sports car/ }));
    expect(onChange).toHaveBeenCalledWith("https://yehudabriskman.com/api/images/media/icaros-def456");
  });

  it("an icon field offers icons only", async () => {
    const onChange = vi.fn();
    render(<MediaPicker value="" onChange={onChange} kinds={["icon"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Choose from library" }));
    const grid = await screen.findByRole("list", { name: "Icons" });
    expect(within(grid).getAllByRole("button")).toHaveLength(1);
    await userEvent.click(within(grid).getByRole("button", { name: /A leaf/ }));
    expect(onChange).toHaveBeenCalledWith("https://yehudabriskman.com/api/images/media/leaf-aaa111");
  });

  it("with several kinds, a filter narrows them", async () => {
    render(<MediaPicker value="" onChange={() => {}} kinds={["image", "icon", "video"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Choose from library" }));
    const all = await screen.findByRole("list", { name: "Pictures" });
    expect(within(all).getAllByRole("button")).toHaveLength(4);
    await userEvent.click(screen.getByRole("radio", { name: "Videos" }));
    const videos = within(screen.getByRole("list", { name: "Pictures" })).getAllByRole("button");
    expect(videos).toHaveLength(1);
    expect(videos[0]).toHaveTextContent("0:12");
  });

  it("marks the picture the field already holds", async () => {
    render(<MediaPicker value="https://yehudabriskman.com/api/images/media/windom-abc123" onChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Choose from library" }));
    const tile = await screen.findByRole("button", { name: /A clock over the aurora/ });
    expect(tile).toHaveAttribute("aria-pressed", "true");
  });
});

describe("the library page", () => {
  const page = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/media" element={<AdminMedia />} />
        </Routes>
      </MemoryRouter>,
    );

  it("cannot delete a picture something uses, and says what uses it", async () => {
    page("/admin/media?id=windom-abc123");
    const del = await screen.findByRole("button", { name: "Delete" });
    expect(del).toBeDisabled();
    expect(screen.getByRole("link", { name: "WindoM" })).toHaveAttribute("href", "/admin/areas/windom");
  });

  it("a picture a project uses links to the projects editor", async () => {
    ITEMS[1].usedBy = [{ id: "content:projects", type: "content", title: "Projects", slug: "projects", field: "draft.items.3.image" }];
    try {
      page("/admin/media?id=icaros-def456");
      const usedBy = await screen.findByRole("region", { name: "Used by" });
      expect(within(usedBy).getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/admin/projects");
      expect(screen.getByText(/draft\.items\.3\.image/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    } finally {
      ITEMS[1].usedBy = [];
    }
  });

  it("an unused one can be deleted", async () => {
    page("/admin/media?id=icaros-def456");
    expect(await screen.findByRole("button", { name: "Delete" })).toBeEnabled();
    expect(screen.getByText("Nothing uses this picture yet.")).toBeInTheDocument();
  });

  it("an upload waits for alt text", async () => {
    page("/admin/media");
    await screen.findAllByRole("list", { name: /pictures/ });
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "new.png", { type: "image/png" });
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:http://localhost:3000/1b6f0c2e-5d1a-4c3e-9f1e-2a7b8c9d0e1f", revokeObjectURL: () => {} }));
    await userEvent.upload(input, file);
    await userEvent.click(await screen.findByRole("button", { name: "Upload" }));
    expect(screen.getByText("Say what the picture shows before uploading.")).toBeInTheDocument();
    expect(requests.some((r) => r.method === "POST")).toBe(false);
  });

  it("a video upload waits for its poster", async () => {
    page("/admin/media");
    await screen.findAllByRole("list", { name: /pictures/ });
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:http://localhost:3000/9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", revokeObjectURL: () => {} }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(input, new File([new Uint8Array(16)], "clip.mp4", { type: "video/mp4" }));
    expect(await screen.findByText("Poster image (required)")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: /Alt text/ }), "A clip");
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Choose a poster image/);
    expect(requests.some((r) => r.method === "POST")).toBe(false);
  });

  it("the kind filter is in the URL", async () => {
    page("/admin/media?kind=icon");
    const grid = await screen.findByRole("list", { name: "1 icons" });
    expect(within(grid).getByRole("button", { name: /A leaf/ })).toHaveTextContent("Icon · SVG");
    expect(screen.getByRole("radio", { name: "Icons" })).toBeChecked();
  });

  it("a video opens as a video: muted, inline, with its poster", async () => {
    page("/admin/media?id=tour-bbb222");
    const video = await screen.findByLabelText("A walk through the dashboard", { selector: "video" });
    expect(video).toHaveAttribute("playsinline");
    expect((video as HTMLVideoElement).muted).toBe(true);
    expect(video.querySelector("source")).toHaveAttribute("src", `/api/images/m/tour-bbb222/video-${"c".repeat(16)}.mp4`);
    expect(screen.getByText("Nothing uses this video yet.")).toBeInTheDocument();
  });

  it("saves the Hebrew alt and caption beside the English (#306)", async () => {
    page("/admin/media?id=icaros-def456");
    const heAlt = await screen.findByRole("textbox", { name: /Alt text in Hebrew/ });
    expect(heAlt).toHaveAttribute("dir", "rtl");
    expect(heAlt).toHaveAttribute("lang", "he");
    await userEvent.type(heAlt, "מכונית ספורט כתומה");
    await userEvent.click(screen.getByRole("button", { name: "Save details" }));
    const put = requests.find((r) => r.method === "PUT");
    expect(put?.url).toBe("/api/admin/media/icaros-def456");
    expect(JSON.parse(String(put?.body))).toMatchObject({ alt: "An orange sports car", he: { alt: "מכונית ספורט כתומה", caption: "" } });
  });

  it("a video lists its captions per language, and adds one in Hebrew (#306)", async () => {
    const tracks = [{ url: `/api/images/m/tour-bbb222/captions-${"d".repeat(16)}.vtt`, lang: "en", label: "English" }];
    Object.assign(ITEMS[3], { captions: tracks[0], tracks });
    try {
      page("/admin/media?id=tour-bbb222");
      const region = await screen.findByRole("region", { name: "Captions" });
      expect(within(within(region).getByRole("list")).getByText("English")).toBeInTheDocument();
      expect(within(region).getByRole("button", { name: "Remove the English captions" })).toBeEnabled();
      /* The language not yet captioned is the one offered. */
      expect(within(region).getByRole("combobox", { name: "Language" })).toHaveValue("he");
      const picker = region.querySelector<HTMLInputElement>('input[type="file"]')!;
      await userEvent.upload(picker, new File(["WEBVTT\n"], "he.vtt", { type: "text/vtt" }));
      const put = requests.find((r) => r.method === "PUT");
      expect(put?.url).toBe("/api/admin/media/tour-bbb222/captions/he?rev=1-a");
      const video = screen.getByLabelText("A walk through the dashboard", { selector: "video" });
      expect(video.querySelector("track")).toHaveAttribute("srclang", "en");
    } finally {
      Object.assign(ITEMS[3], { captions: null, tracks: undefined });
    }
  });
});

describe("helpers", () => {
  it("a media src is the library's own path or this page's blob: URL, and nothing else", () => {
    expect(librarySrc("/api/images/m/a-1/w800.webp")).toBe("/api/images/m/a-1/w800.webp");
    expect(librarySrc("https://example.com/api/images/media/a-1?w=800&f=webp")).toBe("https://example.com/api/images/media/a-1?w=800&f=webp");
    for (const bad of ["javascript:alert(1)", "data:image/svg+xml,<svg/>", "//evil.example/api/images/x", "/admin", "JAVASCRIPT:alert(1)//api/images/", null, undefined]) {
      expect(librarySrc(bad)).toBeUndefined();
    }
    expect(blobSrc("blob:http://localhost:3000/1b6f0c2e-5d1a-4c3e-9f1e-2a7b8c9d0e1f")).toBeDefined();
    for (const bad of ["javascript:alert(1)", "blob:javascript:alert(1)", "/api/images/x", ""]) expect(blobSrc(bad)).toBeUndefined();
  });

  it("checkFile refuses a type off the list and an oversize file", () => {
    expect(checkFile(new File(["x"], "a.gif", { type: "image/gif" }))).toMatch(/not a JPEG/);
    const big = new File(["x"], "b.jpg", { type: "image/jpeg" });
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    expect(checkFile(big)).toMatch(/limit is 10 MB/);
    expect(checkFile(new File(["x"], "c.webp", { type: "image/webp" }))).toBeNull();
  });

  it("checkFile holds each kind to its own rule", () => {
    const sized = (name: string, type: string, size: number) => {
      const f = new File(["x"], name, { type });
      Object.defineProperty(f, "size", { value: size });
      return f;
    };
    expect(checkFile(sized("a.svg", "image/svg+xml", 70 * 1024), "icon")).toMatch(/limit is 64 KB/);
    expect(checkFile(sized("a.jpg", "image/jpeg", 10), "icon")).toMatch(/not an SVG or PNG icon/);
    expect(checkFile(sized("a.mov", "video/quicktime", 10), "video")).toMatch(/not an MP4 or WebM/);
    expect(checkFile(sized("a.mp4", "video/mp4", 26 * 1024 * 1024), "video")).toMatch(/limit is 25 MB/);
    expect(checkFile(sized("a.vtt", "", 10), "captions")).toBeNull();
  });

  it("mediaIdOf reads the id from a stable or a hashed URL", () => {
    expect(mediaIdOf("https://yehudabriskman.com/api/images/media/windom-abc123")).toBe("windom-abc123");
    expect(mediaIdOf("/api/images/m/windom-abc123/w400-aaaaaaaaaaaaaaaa.webp")).toBe("windom-abc123");
    expect(mediaIdOf("https://raw.githubusercontent.com/x/y/main/a.png")).toBeNull();
  });
});

