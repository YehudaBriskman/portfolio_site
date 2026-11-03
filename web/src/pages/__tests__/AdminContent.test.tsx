import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminSiteCopy from "@/pages/AdminSiteCopy";
import AdminProjects from "@/pages/AdminProjects";
import AdminStory from "@/pages/AdminStory";
import { seedBundle } from "@/content/convert";

/*
 * The content editors (#163): they load the document, check it with the
 * shared schema before sending anything, show each message beside its field,
 * and send what passes with the revision they read.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const viewOf = (key: string, published: unknown, draft: unknown = null) => ({
  ok: true,
  key,
  exists: true,
  _rev: "1-abc",
  published,
  draft,
  updatedAt: "2026-11-01T10:00:00.000Z",
  publishedAt: "2026-11-01T10:00:00.000Z",
  source: "admin",
});

type Call = { url: string; method: string; body: unknown };

function stubApi(key: string, published: unknown, answer?: (c: Call) => Response) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const call = { url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null };
      calls.push(call);
      if (url === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
      if (call.method === "GET") return json(viewOf(key, published));
      return answer ? answer(call) : json(viewOf(key, (call.body as { data: unknown }).data));
    }),
  );
  return calls;
}

const page = (el: React.ReactElement) => render(<MemoryRouter>{el}</MemoryRouter>);

afterEach(() => vi.unstubAllGlobals());

describe("content editors", () => {
  it("names an empty required field and sends nothing", async () => {
    const calls = stubApi("site-copy", seedBundle().siteCopy);
    page(<AdminSiteCopy />);
    const title = await screen.findByLabelText("Title, English");
    fireEvent.change(title, { target: { value: "" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Publish" })[0]);
    expect(await screen.findByText("English is required")).toBeInTheDocument();
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  });

  it("publishes an edit with the revision it read", async () => {
    const calls = stubApi("site-copy", seedBundle().siteCopy);
    page(<AdminSiteCopy />);
    fireEvent.change(await screen.findByLabelText("Title, Hebrew (optional)"), { target: { value: "ראש צוות" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Publish" })[0]);
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const sent = calls.find((c) => c.method === "POST")!;
    expect(sent.url).toBe("/api/admin/content/site-copy/publish");
    const body = sent.body as { _rev: string; data: { hero: { title: { en: string; he?: string } } } };
    expect(body._rev).toBe("1-abc");
    expect(body.data.hero.title).toEqual({ en: seedBundle().siteCopy.hero.title.en, he: "ראש צוות" });
  });

  it("shows the server's issue beside the field it names", async () => {
    stubApi("projects", seedBundle().projects, () =>
      json({ ok: false, error: "1 field needs attention", issues: [{ path: "items.0.fact.en", message: "Too close to another" }] }, 400),
    );
    page(<AdminProjects />);
    await screen.findByLabelText("One-line fact, English");
    fireEvent.click(screen.getAllByRole("button", { name: "Save draft" })[0]);
    expect(await screen.findByText("Too close to another")).toBeInTheDocument();
  });

  it("reorders projects and renumbers their order", async () => {
    const calls = stubApi("projects", seedBundle().projects);
    page(<AdminProjects />);
    const first = seedBundle().projects.items[0];
    fireEvent.click(await screen.findByRole("button", { name: `Move ${first.title} down` }));
    fireEvent.click(screen.getAllByRole("button", { name: "Save draft" })[0]);
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    const items = (calls.find((c) => c.method === "PUT")!.body as { data: { items: Array<{ slug: string; order: number }> } }).data.items;
    expect(items[1].slug).toBe(first.slug);
    expect(items.map((i) => i.order)).toEqual(items.map((_, i) => i));
  });

  it("a project's image can be picked from the media library (#253)", async () => {
    const url = "https://yehudabriskman.com/api/images/media/windom-01a68d";
    const LIBRARY = {
      ok: true,
      items: [
        {
          id: "windom-01a68d",
          name: "windom.jpg",
          alt: "WindoM's new-tab page",
          caption: "",
          credit: "",
          kind: "image",
          format: "jpeg",
          mime: "image/jpeg",
          file: null,
          width: 1600,
          height: 758,
          bytes: 136_000,
          createdAt: "2026-11-01T00:00:00.000Z",
          updatedAt: "2026-11-01T00:00:00.000Z",
          url,
          preview: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
          srcset: { avif: "", webp: "" },
          usedBy: [],
        },
      ],
    };
    const calls = stubApi("projects", seedBundle().projects);
    const content = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn((u: string, init?: RequestInit) => (u.startsWith("/api/admin/media") ? Promise.resolve(json(LIBRARY)) : content(u, init))),
    );
    page(<AdminProjects />);
    fireEvent.click(await screen.findByRole("button", { name: "Choose from library" }));
    fireEvent.click(await screen.findByRole("button", { name: /WindoM's new-tab page/ }));
    expect(screen.getByLabelText("Image")).toHaveValue(url);
    fireEvent.click(screen.getAllByRole("button", { name: "Save draft" })[0]);
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    const items = (calls.find((c) => c.method === "PUT")!.body as { data: { items: Array<{ image: string | null }> } }).data.items;
    expect(items[0].image).toBe(url);
  });

  it("reports a conflict instead of overwriting", async () => {
    stubApi("story", seedBundle().story, () => json({ ok: false, error: "changed" }, 409));
    page(<AdminStory />);
    await screen.findAllByLabelText("Title, English");
    fireEvent.click(screen.getAllByRole("button", { name: "Save draft" })[0]);
    expect((await screen.findAllByText("Changed elsewhere")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });
});
