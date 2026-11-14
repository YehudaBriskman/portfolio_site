import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import Admin from "@/pages/Admin";
import AdminAreas from "@/pages/AdminAreas";
import ReviewDialog from "@/components/admin/noteEditor/ReviewDialog";
import { useEditorWords } from "@/components/admin/noteEditor/words";
import type { PostContent } from "@/services/admin";

/*
 * Posts and Areas below 600px (#680). jsdom cannot see layout, so these pin the structure and the rules that
 * produce it; the PR carries the measured fold and the screenshots, and admin-posts-phone.mjs measures the
 * overflow in a real browser. A row is one button with at most three facts, a status is drawn only when it is
 * an exception, the filters live in the address, and nothing here can publish more than the review would.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const seo = { title: null, description: null, canonical: null, noindex: false };
const post = (slug: string, o: Record<string, unknown> = {}) => ({
  _id: `post:${slug}`, _rev: `1-${slug}`, slug, title: `Title ${slug}`, subtitle: null, excerpt: "e", body: "body", status: "published",
  publishedAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-10T10:00:00.000Z", tags: ["a", "b"], collection: "site", coverImage: null,
  links: [], readingMinutes: 3, featured: null, seo, he: null, ...o,
});
const posts = [
  post("one", { title: "Rebuilding the admin as a tool", updatedAt: "2026-11-13T10:00:00.000Z" }),
  post("two", { title: "A draft nobody has read", status: "draft", publishedAt: null }),
  post("three", { title: "Published with changes", draft: { ...post("three"), title: "Published with changes (new)" } }),
  post("four", { title: "Old and archived", status: "archived" }),
  post("five", { title: "Windom notes", collection: "windom" }),
  post("six", { title: "Hebrew is missing here" }),
  post("seven", { title: "Hebrew is stale here" }),
  post("eight", { title: "Everything translated" }),
  post("nine", { title: "Nine" }),
];
const areas = [
  { slug: "site", title: "Notes", tagline: "", kind: "site", repo: null, stats: null, description: "d", coverImage: null, links: [], order: 0, status: "published", _rev: "1-a" },
  { slug: "windom", title: "WindoM", tagline: "", kind: "project", repo: { owner: "o", name: "WindoM", branch: "main", docPaths: [] }, stats: null, description: "d", coverImage: null, links: [], order: 10, status: "published", _rev: "1-b" },
  { slug: "old", title: "Old project", tagline: "", kind: "project", repo: null, stats: null, description: "d", coverImage: null, links: [], order: 20, status: "hidden", _rev: "1-c" },
];
const unit = (path: string, status: string) => ({ path, status, primary: true, en: path, he: null, draftHe: null });
const report = {
  ok: true,
  counts: { missing: 1, draft: 0, stale: 1, unverified: 0, translated: 1 },
  coverage: 50,
  items: [
    { type: "post", id: "six", title: "t", route: "/", rank: 1, visibility: "public", status: "missing", units: [unit("title", "missing")] },
    { type: "post", id: "seven", title: "t", route: "/", rank: 1, visibility: "public", status: "stale", units: [unit("title", "stale")] },
    { type: "post", id: "eight", title: "t", route: "/", rank: 1, visibility: "public", status: "translated", units: [unit("title", "translated")] },
    { type: "area", id: "windom", title: "t", route: "/", rank: 1, visibility: "public", status: "missing", units: [unit("title", "missing")] },
  ],
};

type Call = { url: string; method: string; body?: Record<string, unknown> };
let calls: Call[];
const deletes = () => calls.filter((c) => c.method === "DELETE");

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}
function phone(on: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: on && q.includes("max-width: 599px"), media: q, addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
  }));
}
const mount = (path = "/admin/posts", el = <Admin />) =>
  render(<MemoryRouter initialEntries={[path]}>{el}<Where /></MemoryRouter>);

beforeEach(() => {
  calls = [];
  phone(true);
  try {
    window.localStorage.clear();
  } catch {
    /* none */
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
      if (url === "/api/admin/posts" && method === "GET") return json({ ok: true, items: posts });
      if (url === "/api/admin/collections" && method === "GET") return json({ ok: true, items: areas });
      if (url.startsWith("/api/admin/translations")) return json(report);
      if (method === "DELETE" || method === "PUT") return json({ ok: true, post: posts[0], collection: areas[0] });
      return json({ ok: true });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.lang = "en";
  document.documentElement.removeAttribute("dir");
});

const rows = () => [...document.querySelectorAll<HTMLElement>("[data-record-row]")];
const FIRST = "Open Rebuilding the admin as a tool";

describe("Posts on a phone: the list", () => {
  it("draws rows, not a table; each row is one button with a full name and at most three facts", async () => {
    mount();
    await screen.findByRole("button", { name: FIRST });
    expect(document.querySelector("table")).toBeNull();
    expect(rows().length).toBe(posts.length);
    for (const r of rows()) {
      expect(r.tagName).toBe("BUTTON");
      expect(r.querySelector("button, a, input, select")).toBeNull();
      expect(r.getAttribute("aria-label")).toMatch(/^Open \S/);
      expect(r.querySelectorAll(".rr-fact").length).toBeLessThanOrEqual(3);
      // The area, the tags and the reading time are not on the row.
      expect(r.textContent).not.toMatch(/min read/i);
      expect(r.querySelector(".a-tag")).toBeNull();
    }
  });

  it("opens the editor on tap", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Open A draft nobody has read" }));
    expect(screen.getByTestId("where").textContent).toBe("/admin/posts/two");
  });

  it("draws a status only for an exception, one glyph per row, always with a name", async () => {
    mount();
    await screen.findByRole("button", { name: FIRST });
    const glyph = (name: string) => within(screen.getByRole("button", { name: `Open ${name}` })).queryAllByRole("img");
    expect(glyph("Rebuilding the admin as a tool").length).toBe(0); // published and translated: nothing
    expect(glyph("A draft nobody has read").map((g) => g.getAttribute("aria-label"))).toEqual(["Draft"]);
    expect(glyph("Published with changes").map((g) => g.getAttribute("aria-label"))).toEqual(["Unpublished changes"]);
    expect(glyph("Old and archived").map((g) => g.getAttribute("aria-label"))).toEqual(["Archived"]);
    await waitFor(() => expect(glyph("Hebrew is missing here").length).toBe(1));
    expect(glyph("Hebrew is stale here").length).toBe(1);
    expect(glyph("Everything translated").length).toBe(0);
    for (const r of rows()) expect(r.querySelectorAll('[role="img"]').length).toBeLessThanOrEqual(1);
  });

  it("keeps the desktop table at 600 and up", async () => {
    phone(false);
    mount();
    expect(await screen.findByRole("table")).toBeTruthy();
    expect(rows().length).toBe(0);
  });
});

describe("Posts on a phone: filters", () => {
  it("round-trips through the address: a chip writes it, the rest of the address is kept, off removes it", async () => {
    mount("/admin/posts?status=draft&area=windom");
    await screen.findByText("Nothing matches those filters"); // a draft in WindoM: none
    const chips = screen.getByRole("toolbar");
    fireEvent.click(within(chips).getByRole("button", { name: /Published/ }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toContain("status=published"));
    expect(screen.getByTestId("where").textContent).toContain("area=windom");
    expect(await screen.findByRole("button", { name: "Open Windom notes" })).toBeTruthy();
    fireEvent.click(within(screen.getByRole("toolbar")).getByRole("button", { name: /Published/ }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).not.toContain("status="));
    expect(screen.getByTestId("where").textContent).toContain("area=windom");
  });

  it("reads the area from the address and lists only its posts", async () => {
    mount("/admin/posts?area=windom");
    expect(await screen.findByRole("button", { name: "Open Windom notes" })).toBeTruthy();
    expect(rows().length).toBe(1);
  });

  it("filters to the posts whose Hebrew is missing", async () => {
    mount("/admin/posts?he=missing");
    expect(await screen.findByRole("button", { name: "Open Hebrew is missing here" })).toBeTruthy();
    await waitFor(() => expect(rows().length).toBe(1));
  });

  it("searches by title without writing the words to the address", async () => {
    mount();
    await screen.findByRole("button", { name: "Open Windom notes" });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "windom" } });
    await waitFor(() => expect(rows().length).toBe(1));
    expect(screen.getByTestId("where").textContent).not.toContain("windom");
  });
});

describe("Posts on a phone: bulk actions", () => {
  const select = async (...titles: string[]) => {
    await screen.findByRole("button", { name: FIRST });
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    for (const t of titles) fireEvent.click(screen.getByRole("checkbox", { name: t }));
  };
  const bar = () => screen.findByRole("toolbar", { name: "Bulk actions" });

  it("shows the bulk bar with the count once a row is chosen, and a row tap chooses instead of opening", async () => {
    mount();
    await select("A draft nobody has read", "Windom notes");
    expect(within(await bar()).getByText("2 selected")).toBeTruthy();
    expect(screen.getByTestId("where").textContent).toBe("/admin/posts");
  });

  it("offers move to drafts and archive, and no bulk Publish: a publish is reviewed one note at a time", async () => {
    mount();
    await select("Windom notes");
    fireEvent.click(within(await bar()).getByRole("button", { name: "More" }));
    expect(await screen.findByRole("button", { name: /^Move to drafts\s*\d+ items?$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Archive\s*\d+ items?$/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Publish(?!ed)/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull();
  });

  it("asks before archiving: the sheet names the object and the count, Keep does nothing", async () => {
    mount();
    await select("A draft nobody has read", "Windom notes");
    fireEvent.click(within(await bar()).getByRole("button", { name: "More" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Archive\s*\d+ items?$/ }));
    expect((await screen.findAllByText("Archive 2 posts")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(deletes()).toEqual([]);
  });

  it("archives only after the Undo window, and Undo cancels it", async () => {
    mount();
    await select("Windom notes");
    fireEvent.click(within(await bar()).getByRole("button", { name: "More" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Archive\s*\d+ items?$/ }));
    const confirm = await screen.findAllByRole("button", { name: "Archive 1 post" });
    fireEvent.click(confirm[confirm.length - 1]);
    const undo = await screen.findByRole("button", { name: "Undo" });
    expect(deletes()).toEqual([]);
    fireEvent.click(undo);
    await new Promise((r) => setTimeout(r, 50));
    expect(deletes()).toEqual([]);
    expect(screen.getByRole("button", { name: "Open Windom notes" })).toBeTruthy();
  });

  it("moves a published post to drafts with its published content, and leaves a draft alone", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
    try {
      mount();
      await select("A draft nobody has read", "Windom notes");
      fireEvent.click(within(await bar()).getByRole("button", { name: "Move to drafts" }));
      await screen.findByRole("button", { name: "Undo" });
      await vi.advanceTimersByTimeAsync(12_000);
      await waitFor(() => expect(calls.filter((c) => c.method === "PUT")).toHaveLength(1));
      const put = calls.find((c) => c.method === "PUT")!;
      expect(put.url).toBe("/api/admin/posts/five");
      expect(put.body).toMatchObject({ status: "draft", _rev: "1-five", title: "Windom notes", body: "body" });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Areas on a phone", () => {
  it("draws one-button rows with at most three facts, hidden drawn as a glyph, not a pill", async () => {
    mount("/admin/areas", <AdminAreas />);
    await screen.findByRole("button", { name: "Open WindoM" });
    expect(document.querySelector("table")).toBeNull();
    expect(rows().length).toBe(areas.length);
    for (const r of rows()) {
      expect(r.tagName).toBe("BUTTON");
      expect(r.querySelectorAll(".rr-fact").length).toBeLessThanOrEqual(3);
      expect(r.textContent).not.toContain("/windom"); // no slug on the row
    }
    expect(within(screen.getByRole("button", { name: "Open Old project" })).getByRole("img", { name: "Hidden" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Notes" }).querySelectorAll('[role="img"]').length).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Open WindoM" }));
    expect(screen.getByTestId("where").textContent).toBe("/admin/areas/windom");
  });

  it("reads the visibility filter from the address", async () => {
    mount("/admin/areas?status=hidden", <AdminAreas />);
    await screen.findByRole("button", { name: "Open Old project" });
    expect(rows().length).toBe(1);
  });

  it("hides areas only after an Undo window", async () => {
    mount("/admin/areas", <AdminAreas />);
    await screen.findByRole("button", { name: "Open WindoM" });
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "WindoM" }));
    fireEvent.click(within(await screen.findByRole("toolbar", { name: "Bulk actions" })).getByRole("button", { name: "Hide" }));
    expect(await screen.findByRole("button", { name: "Undo" })).toBeTruthy();
    expect(deletes()).toEqual([]);
  });
});

describe("The publish review on a phone", () => {
  const base: PostContent = { title: "T", subtitle: null, excerpt: "e", body: "one\ntwo\nthree", tags: [], collection: "site", coverImage: null, links: [], featured: null, publishedAt: null, seo, he: null };
  function Review() {
    const [words] = useEditorWords();
    return <ReviewDialog open onClose={() => {}} published={base} next={{ ...base, title: "T2", body: "one\nTWO\nthree\nfour" }} words={words} busy={false} error={null} onPublish={() => {}} />;
  }

  it("leads with what changes, then the diff, and keeps the field list and the options behind Disclosures", async () => {
    render(<Review />);
    const summary = await waitFor(() => {
      const s = document.querySelector("[data-review-summary]");
      if (!s) throw new Error("no summary");
      return s;
    });
    const dialog = summary.closest("dialog")!;
    const diff = dialog.querySelector("[role=group][tabindex]")!;
    expect(summary.textContent).toMatch(/2 lines added, 1 removed/);
    expect(summary.compareDocumentPosition(diff) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const details = [...dialog.querySelectorAll("details")];
    expect(details.length).toBeGreaterThanOrEqual(2);
    for (const d of details) {
      expect(d.hasAttribute("open")).toBe(false);
      expect(diff.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(within(dialog).getAllByRole("button", { name: "Publish" }).length).toBe(1);
  });

  it("is the desktop dialog at 600 and up", async () => {
    phone(false);
    render(<Review />);
    await screen.findByText("Review before publishing");
    expect(document.querySelector("[data-review-summary]")).toBeNull();
  });
});

describe("Hebrew", () => {
  it("lists posts with Hebrew names and Hebrew controls", async () => {
    document.documentElement.lang = "he";
    document.documentElement.setAttribute("dir", "rtl");
    mount();
    await screen.findByRole("button", { name: "פתיחת Rebuilding the admin as a tool" });
    expect(screen.getByRole("button", { name: "בחירה" })).toBeTruthy();
    for (const r of rows()) expect(r.getAttribute("aria-label")).toMatch(/^פתיחת /);
  });
});
