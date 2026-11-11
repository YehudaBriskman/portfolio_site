import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminAnnounce from "@/pages/AdminAnnounce";
import { setUnread } from "@/services/adminAnnounce";
import { allWordTables, hasHebrew } from "@/i18n/words";
import "@/components/admin/announce/words";

/*
 * /admin/announce (#474): the inbox and its kit, with the API mocked. The
 * captions are plain text, copying and opening are clicks, and the nav badge
 * follows the unread count.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const summary = (over: Record<string, unknown> = {}) => ({
  id: "announce:post:hello:1",
  kind: "post",
  ref: "hello",
  title: "Hello <b>world</b>",
  url: "https://example.com/blog/hello",
  langs: ["en", "he"],
  createdAt: "2026-11-10T10:00:00.000Z",
  readAt: null,
  done: {},
  dismissed: null,
  ...over,
});

const item = (text: string, limit: number | null) => ({ text, subject: "New on the blog: Hello", limit, length: [...text].length, over: limit !== null && [...text].length > limit });
const detailOf = (s = summary()) => ({
  ok: true,
  event: { ...s, summary: "A summary", tags: ["a"], version: null },
  kit: {
    en: {
      linkedin: item("New on the blog: Hello\n\nhttps://example.com/blog/hello", 3000),
      instagram: item("Insta caption", 2200),
      email: item("Email body", null),
      gmail: item("Gmail body", null),
      x: item("x".repeat(300), 280),
    },
    he: { linkedin: item("חדש בבלוג: שלום", 3000) },
  },
});

const settings = {
  enabled: true,
  email: { enabled: false, events: ["post", "release"] },
  hashtags: [],
  signature: "",
  channels: ["linkedin", "instagram", "email", "gmail", "x"],
  templates: { en: {}, he: {} },
};

type Call = { url: string; method: string; body: Record<string, unknown> | null };

function stub(opts: { items?: unknown[]; putStatus?: number; fail?: boolean } = {}) {
  const calls: Call[] = [];
  const items = opts.items ?? [summary()];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (opts.fail && url === "/api/admin/announce") return json({ ok: false }, 500);
      if (url === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
      if (url === "/api/admin/announce") return json({ ok: true, unread: items.filter((i) => !(i as { readAt: unknown }).readAt).length, items });
      if (url === "/api/admin/announce/settings") {
        if (method === "PUT") return opts.putStatus && opts.putStatus !== 200 ? json({ ok: false }, opts.putStatus) : json({ ok: true, exists: true, _rev: "2-b", updatedAt: "2026-11-11T00:00:00Z", settings: calls.at(-1)!.body!.settings });
        return json({ ok: true, exists: true, _rev: "1-a", updatedAt: "2026-11-11T00:00:00Z", settings });
      }
      if (url.endsWith("/read")) return json({ ok: true, event: summary({ readAt: "2026-11-11T00:00:00Z" }) });
      if (url.endsWith("/done")) return json({ ok: true, event: summary({ readAt: "2026-11-11T00:00:00Z", done: { [String(calls.at(-1)!.body!.channel)]: "2026-11-11T00:00:00Z" } }) });
      if (url.endsWith("/dismiss")) return json({ ok: true, event: summary({ dismissed: "x" }) });
      if (url.includes("/preview")) return json({ ok: true, title: "Hello", description: "A summary", image: "https://example.com/og.png", imageWidth: 1200, imageHeight: 630, siteName: "Site", url: "https://example.com/blog/hello", lang: url.endsWith("he") ? "he" : "en", issues: [] });
      if (url.startsWith("/api/admin/announce/")) return json(detailOf());
      return json({});
    }),
  );
  return calls;
}

const page = () => render(<MemoryRouter><AdminAnnounce /></MemoryRouter>);

beforeEach(() => setUnread(null));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("/admin/announce inbox", () => {
  it("shows an empty state", async () => {
    stub({ items: [] });
    page();
    expect(await screen.findByText("Nothing to announce")).toBeTruthy();
  });

  it("shows an error state with a retry", async () => {
    stub({ fail: true });
    page();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("opens the first unread event, marks it read, and renders the title as text", async () => {
    const calls = stub();
    page();
    const caption = (await screen.findByLabelText("Caption for LinkedIn")) as HTMLTextAreaElement;
    expect(caption.value).toContain("New on the blog: Hello");
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/read") && c.method === "POST")).toBe(true));
    const title = screen.getByText("Hello <b>world</b>");
    expect(title.querySelector("b")).toBeNull();
  });

  it("counts characters against the platform limit and flags an overrun", async () => {
    stub();
    page();
    await screen.findByLabelText("Caption for LinkedIn");
    expect(screen.getByText(/of 3000 characters/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /^X/ }));
    const box = (await screen.findByLabelText("Caption for X")) as HTMLTextAreaElement;
    expect(box.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText(/over the limit/)).toBeTruthy();
    /* The send button is held while the caption does not fit. */
    expect((screen.getByRole("button", { name: "Open X with the caption" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(box, { target: { value: "short" } });
    expect(screen.queryByText(/over the limit/)).toBeNull();
    expect(screen.getByText(/5 of 280 characters/)).toBeTruthy();
  });

  it("LinkedIn copies the caption, opens the share dialog and says to paste", async () => {
    stub();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    page();
    await screen.findByLabelText("Caption for LinkedIn");
    fireEvent.click(screen.getByRole("button", { name: "Copy caption and open LinkedIn" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("New on the blog: Hello")));
    expect(open).toHaveBeenCalledWith(
      "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent("https://example.com/blog/hello"),
      "_blank",
      "noopener,noreferrer",
    );
    expect(await screen.findByText(/paste the caption/)).toBeTruthy();
  });

  it("uses the edited caption, and the Hebrew link under /he", async () => {
    stub();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    page();
    await screen.findByLabelText("Caption for LinkedIn");
    fireEvent.click(screen.getByRole("button", { name: /^EN|^עב/ , pressed: false }));
    const box = (await screen.findByLabelText("Caption for LinkedIn")) as HTMLTextAreaElement;
    expect(box.dir).toBe("rtl");
    fireEvent.change(box, { target: { value: "ערוך" } });
    fireEvent.click(screen.getByRole("button", { name: "Copy caption and open LinkedIn" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("ערוך"));
    expect(String(open.mock.calls[0][0])).toContain(encodeURIComponent("https://example.com/he/blog/hello"));
  });

  it("Gmail opens a prefilled compose window and the mail app link is a mailto", async () => {
    stub();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    page();
    await screen.findByLabelText("Caption for LinkedIn");
    fireEvent.click(screen.getByRole("tab", { name: /^Email/ }));
    fireEvent.click(screen.getByRole("button", { name: "Open in Gmail" }));
    const href = String(open.mock.calls[0][0]);
    expect(href.startsWith("https://mail.google.com/mail/?view=cm&fs=1&su=")).toBe(true);
    expect(href).toContain(encodeURIComponent("Email body"));
    expect(screen.getByRole("link", { name: "Open in your mail app" }).getAttribute("href")).toMatch(/^mailto:\?subject=/);
  });

  it("Instagram downloads the card and copies the caption", async () => {
    stub();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.getAttribute("href") + "|" + this.download);
    });
    page();
    await screen.findByLabelText("Caption for LinkedIn");
    fireEvent.click(screen.getByRole("tab", { name: /^Instagram/ }));
    fireEvent.click(screen.getByRole("button", { name: "Download square card and copy caption" }));
    expect(clicked).toEqual(["/api/seo/og/blog/hello.png?format=square|hello-square.png"]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Insta caption"));
  });

  it("marks a channel done, and dismisses", async () => {
    const calls = stub();
    page();
    await screen.findByLabelText("Caption for LinkedIn");
    fireEvent.click(screen.getByRole("button", { name: "Mark as done" }));
    await waitFor(() => expect(calls.find((c) => c.url.endsWith("/done"))?.body).toEqual({ channel: "linkedin" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/dismiss"))).toBe(true));
    expect(await screen.findByText("Nothing to announce")).toBeTruthy();
  });

  it("arrow keys move between the channel tabs", async () => {
    stub();
    page();
    await screen.findByLabelText("Caption for LinkedIn");
    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabs[1]);
  });
});

describe("/admin/announce settings", () => {
  const open = async () => {
    const calls = stub({ items: [] });
    page();
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    await screen.findByLabelText("Default hashtags");
    return calls;
  };

  it("saves with the revision it read", async () => {
    const calls = await open();
    fireEvent.click(screen.getByRole("checkbox", { name: "Email me about new events" }));
    fireEvent.change(screen.getByLabelText("Default hashtags"), { target: { value: "#dev, notes" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved");
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.body!._rev).toBe("1-a");
    expect((put.body!.settings as { hashtags: string[]; email: { enabled: boolean } }).hashtags).toEqual(["#dev", "notes"]);
    expect((put.body!.settings as { email: { enabled: boolean } }).email.enabled).toBe(true);
  });

  it("explains a conflict and offers a reload", async () => {
    stub({ items: [], putStatus: 409 });
    page();
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    fireEvent.change(await screen.findByLabelText("Signature"), { target: { value: "— Y" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/changed elsewhere/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
  });
});

describe("the announce words", () => {
  it("have a Hebrew for every English entry", () => {
    const t = allWordTables().find((x) => x.name === "adminAnnounce")!;
    expect(t).toBeTruthy();
    const walk = (en: unknown, he: unknown, path: string) => {
      if (en && typeof en === "object") for (const k of Object.keys(en)) walk((en as Record<string, unknown>)[k], (he as Record<string, unknown>)?.[k], `${path}.${k}`);
      else {
        expect(he, path).toBeDefined();
        const s = typeof he === "function" ? String((he as (...a: unknown[]) => unknown)(3, "X")) : String(he);
        if (path !== "adminAnnounce.channels.x" && path !== "adminAnnounce.platforms.x") expect(hasHebrew(s), path).toBe(true);
      }
    };
    walk(t.en, t.he, t.name);
  });
});
