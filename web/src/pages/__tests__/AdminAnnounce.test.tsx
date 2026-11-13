import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminAnnounce from "@/pages/AdminAnnounce";
import { setUnread } from "@/services/adminAnnounce";
import { clearReadinessCache } from "@/components/admin/announce/inbox/readiness";
import { allWordTables, hasHebrew } from "@/i18n/words";
import "@/components/admin/announce/words";
import "@/components/admin/announce/inbox/words";

/*
 * /admin/marketing: the compact inbox and the one-channel composer, with the
 * API mocked. Captions are plain text, copying and opening are clicks, edits
 * save as drafts, and the nav badge follows the unread count.
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

const item = (text: string, limit: number | null, draft = false) => ({ text, subject: "New on the blog: Hello", limit, length: [...text].length, over: limit !== null && [...text].length > limit, draft });

type Drafts = Record<string, string>;
const detailOf = (s = summary(), drafts: Drafts = {}) => {
  const t = (lang: string, ch: string, text: string, limit: number | null) => item(drafts[`${lang}:${ch}`] ?? text, limit, `${lang}:${ch}` in drafts);
  return {
    ok: true,
    event: { ...s, _rev: "1-a", summary: "A summary", tags: ["a"], version: null, drafts: {}, custom: null },
    kit: {
      en: {
        linkedin: t("en", "linkedin", "New on the blog: Hello\n\nhttps://example.com/blog/hello", 3000),
        instagram: t("en", "instagram", "Insta caption", 2200),
        email: t("en", "email", "Email body", null),
        gmail: t("en", "gmail", "Gmail body", null),
        x: t("en", "x", "x".repeat(300), 280),
      },
      he: { linkedin: t("he", "linkedin", "חדש בבלוג: שלום", 3000) },
    },
  };
};

const settings = {
  enabled: true,
  email: { enabled: false, events: ["post", "release"] },
  hashtags: [],
  signature: "",
  channels: ["linkedin", "instagram", "email", "gmail", "x"],
  templates: { en: {}, he: {} },
};

type Call = { url: string; method: string; body: Record<string, unknown> | null };

function stub(opts: { items?: unknown[]; putStatus?: number; fail?: boolean; issues?: unknown[]; draftFail?: boolean } = {}) {
  const calls: Call[] = [];
  const items = opts.items ?? [summary()];
  const drafts: Drafts = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
      calls.push({ url, method, body });
      if (opts.fail && url === "/api/admin/announce") return json({ ok: false }, 500);
      if (url === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
      if (url === "/api/admin/announce" && method === "POST")
        return json({ ok: true, event: summary({ id: "announce:custom:new:1", kind: "custom", ref: "custom", title: String(body!.title), url: "https://example.com/" }) }, 201);
      if (url === "/api/admin/announce") return json({ ok: true, unread: items.filter((i) => !(i as { readAt: unknown }).readAt).length, items });
      if (url === "/api/admin/announce/settings") {
        if (method === "PUT") return opts.putStatus && opts.putStatus !== 200 ? json({ ok: false }, opts.putStatus) : json({ ok: true, exists: true, _rev: "2-b", updatedAt: "2026-11-11T00:00:00Z", settings: body!.settings });
        return json({ ok: true, exists: true, _rev: "1-a", updatedAt: "2026-11-11T00:00:00Z", settings });
      }
      if (url.endsWith("/draft") && method === "PUT") {
        if (opts.draftFail) return json({ ok: false }, 500);
        const k = `${body!.lang}:${body!.channel}`;
        if (body!.text === null) delete drafts[k];
        else drafts[k] = String(body!.text);
        return json(detailOf(summary(), drafts));
      }
      const own = decodeURIComponent(url.split("/")[4] ?? "");
      const known = items.find((i) => (i as { id: string }).id === own) as Record<string, unknown> | undefined;
      if (url.endsWith("/read")) return json({ ok: true, event: { ...(known ?? summary({ id: own, kind: "custom", title: "We launched" })), readAt: "2026-11-11T00:00:00Z" } });
      if (url.endsWith("/done")) return json({ ok: true, event: summary({ readAt: "2026-11-11T00:00:00Z", done: { [String(body!.channel)]: "2026-11-11T00:00:00Z" } }) });
      if (url.endsWith("/dismiss")) return json({ ok: true, event: summary({ dismissed: "x" }) });
      if (url.includes("/preview"))
        return json({ ok: true, title: "Hello", description: "A summary", image: "https://example.com/og.png", imageWidth: 1200, imageHeight: 630, siteName: "Site", url: "https://example.com/blog/hello", lang: url.endsWith("he") ? "he" : "en", issues: opts.issues ?? [] });
      if (url.startsWith("/api/admin/announce/")) return json(detailOf(summary(), drafts));
      return json({});
    }),
  );
  return calls;
}

const page = (at = "/admin/marketing") => render(<MemoryRouter initialEntries={[at]}><AdminAnnounce /></MemoryRouter>);
const openFirst = async () => {
  const row = await screen.findByRole("button", { name: /^Write the caption for/ });
  fireEvent.click(row);
  return (await screen.findByLabelText(/^Caption for LinkedIn/)) as HTMLTextAreaElement;
};

beforeEach(() => {
  setUnread(null);
  clearReadinessCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the inbox", () => {
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

  it("is one line per event: the title as text, the channels sent, and the readiness chips", async () => {
    stub({ issues: [{ code: "image-missing", field: "image", severity: "error" }, { code: "no-hebrew-translation", field: "translation", severity: "warn" }, { code: "title-long", field: "title", severity: "warn" }] });
    page();
    const row = (await screen.findByRole("button", { name: /^Write the caption for/ })).closest("li")!;
    expect(within(row).getByText("Hello <b>world</b>").querySelector("b")).toBeNull();
    expect(await within(row).findByText("No image")).toBeTruthy();
    expect(within(row).getByText("Long title")).toBeTruthy();
    /* The third chip folds into a count, with its name still available to a screen reader. */
    expect(within(row).getByText("+1")).toBeTruthy();
    expect(within(row).getByText(/No Hebrew/)).toBeTruthy();
    expect(within(row).getAllByRole("img").length).toBe(4);
    expect(within(row).getByRole("button", { name: /^Copy the LinkedIn caption/ })).toBeTruthy();
  });

  it("says Ready when the page has nothing to fix", async () => {
    stub();
    page();
    expect(await screen.findByText("Ready")).toBeTruthy();
  });

  it("copies the LinkedIn or X caption from the row without opening anything", async () => {
    stub();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    page();
    fireEvent.click(await screen.findByRole("button", { name: /^Copy the LinkedIn caption/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("New on the blog: Hello")));
    expect(await screen.findByText("LinkedIn caption copied.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Copy the X caption/ }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("x".repeat(300)));
    expect(screen.queryByLabelText(/^Caption for/)).toBeNull();
  });

  it("moves with j and k, copies with c and opens with o, but not while typing", async () => {
    stub({ items: [summary(), summary({ id: "announce:release:v1:2", kind: "release", ref: "v1", title: "Second" })] });
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    page();
    await screen.findByText("Second");
    const rows = () => document.querySelectorAll<HTMLElement>(".mk-row");
    expect(rows()[0].dataset.selected).toBeDefined();
    fireEvent.keyDown(document.body, { key: "j" });
    expect(rows()[1].dataset.selected).toBeDefined();
    fireEvent.keyDown(document.body, { key: "k" });
    expect(rows()[0].dataset.selected).toBeDefined();
    fireEvent.keyDown(document.body, { key: "j", ctrlKey: true });
    expect(rows()[0].dataset.selected).toBeDefined();
    /* A field swallows the keys. */
    fireEvent.click(screen.getByRole("button", { name: "New announcement" }));
    const title = await screen.findByLabelText("Title");
    fireEvent.keyDown(title, { key: "c" });
    expect(writeText).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(document.body, { key: "c" });
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    fireEvent.keyDown(document.body, { key: "o" });
    expect(await screen.findByLabelText(/^Caption for LinkedIn/)).toBeTruthy();
  });

  it("shows the keys in a visible hint", async () => {
    stub();
    page();
    expect(await screen.findByText("copies the LinkedIn caption")).toBeTruthy();
  });

  it("creates a custom announcement and opens it", async () => {
    const calls = stub({ items: [] });
    page();
    fireEvent.click(await screen.findByRole("button", { name: "New announcement" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "We launched" } });
    fireEvent.change(screen.getByLabelText("Summary"), { target: { value: "It is live" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.url === "/api/admin/announce")?.body).toEqual({ kind: "custom", title: "We launched", summary: "It is live" }));
    expect(await screen.findByLabelText(/^Caption for LinkedIn/)).toBeTruthy();
  });

  it("lists what the server refused in a new announcement", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) =>
        url === "/api/admin/announce" && init?.method === "POST"
          ? json({ ok: false, issues: [{ path: "url", message: "A link on this site (its own address)" }] }, 400)
          : url === "/api/admin/announce"
            ? json({ ok: true, unread: 0, items: [] })
            : json({ ok: true }),
      ),
    );
    page();
    fireEvent.click(await screen.findByRole("button", { name: "New announcement" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("Link on this site"), { target: { value: "https://evil.example/" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText(/its own address/)).toBeTruthy();
  });
});

describe("the composer", () => {
  it("opens one channel, marks the event read, and shows the matching preview beside the caption", async () => {
    const calls = stub();
    page();
    const caption = await openFirst();
    expect(caption.value).toContain("New on the blog: Hello");
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/read") && c.method === "POST")).toBe(true));
    expect(await screen.findByLabelText("LinkedIn post preview")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /^X/ }));
    expect(await screen.findByLabelText(/^Caption for X/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Caption for LinkedIn/)).toBeNull();
  });

  it("counts characters against the limit and holds the X button while over", async () => {
    stub();
    page();
    await openFirst();
    fireEvent.click(screen.getByRole("tab", { name: /^X/ }));
    const box = (await screen.findByLabelText(/^Caption for X/)) as HTMLTextAreaElement;
    expect(screen.getAllByText(/over the limit/).length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: "Open X with the caption" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(box, { target: { value: "short" } });
    expect(screen.getAllByText("5 of 280 characters").length).toBeGreaterThan(0);
  });

  it("autosaves an edit as a draft after a pause, says so, and can reset to the template", async () => {
    const calls = stub();
    page();
    const box = await openFirst();
    fireEvent.change(box, { target: { value: "My own words" } });
    expect(screen.getByText("Saving…")).toBeTruthy();
    expect(calls.some((c) => c.url.endsWith("/draft"))).toBe(false);
    await waitFor(() => expect(calls.find((c) => c.url.endsWith("/draft"))?.body).toEqual({ lang: "en", channel: "linkedin", text: "My own words" }), { timeout: 3000 });
    expect(await screen.findByText("Saved")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset to template" }));
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith("/draft")).at(-1)?.body).toEqual({ lang: "en", channel: "linkedin", text: null }));
    await waitFor(() => expect((screen.getByLabelText(/^Caption for LinkedIn/) as HTMLTextAreaElement).value).toContain("New on the blog: Hello"));
    expect(screen.queryByRole("button", { name: "Reset to template" })).toBeNull();
  });

  it("saves at once when the channel changes, so no edit is lost", async () => {
    const calls = stub();
    page();
    const box = await openFirst();
    fireEvent.change(box, { target: { value: "Quick" } });
    fireEvent.click(screen.getByRole("tab", { name: /^Instagram/ }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/draft") && (c.body as { text: string }).text === "Quick")).toBe(true));
  });

  it("offers a retry when the draft cannot be saved", async () => {
    stub({ draftFail: true });
    page();
    const box = await openFirst();
    fireEvent.change(box, { target: { value: "Nope" } });
    expect(await screen.findByText("Not saved.", undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save again" })).toBeTruthy();
  });

  it("switches the language, and the caption box takes its direction", async () => {
    stub();
    page();
    await openFirst();
    fireEvent.click(screen.getByRole("button", { name: /^עב/ }));
    await waitFor(() => expect((screen.getByLabelText(/^Caption for LinkedIn/) as HTMLTextAreaElement).dir).toBe("rtl"));
    expect((screen.getByLabelText(/^Caption for LinkedIn/) as HTMLTextAreaElement).value).toBe("חדש בבלוג: שלום");
  });

  it("LinkedIn copies the caption, opens the share dialog and says to paste", async () => {
    stub();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    page();
    await openFirst();
    fireEvent.click(screen.getByRole("button", { name: "Copy and open LinkedIn" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("New on the blog: Hello")));
    expect(open).toHaveBeenCalledWith("https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent("https://example.com/blog/hello"), "_blank", "noopener,noreferrer");
    expect(await screen.findByText(/paste the caption/)).toBeTruthy();
  });

  it("Email shows the email preview in a sandboxed frame and opens Gmail prefilled", async () => {
    stub();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    page();
    await openFirst();
    fireEvent.click(screen.getByRole("tab", { name: /^Email/ }));
    await screen.findByLabelText(/^Caption for Email/);
    const frame = document.querySelector("iframe")!;
    expect(frame.getAttribute("sandbox")).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Open in Gmail" }));
    const href = String(open.mock.calls[0][0]);
    expect(href.startsWith("https://mail.google.com/mail/?view=cm&fs=1&su=")).toBe(true);
    expect(href).toContain(encodeURIComponent("Email body"));
    expect(screen.getByRole("link", { name: "Open in your mail app" }).getAttribute("href")).toMatch(/^mailto:\?subject=/);
  });

  it("Instagram downloads the square card and copies the caption", async () => {
    stub();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.getAttribute("href") + "|" + this.download);
    });
    page();
    await openFirst();
    fireEvent.click(screen.getByRole("tab", { name: /^Instagram/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Download square card and copy" }));
    expect(clicked).toEqual(["https://yehudabriskman.com/api/seo/og/blog/hello.png?format=square|hello-square.png"]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Insta caption"));
  });

  it("keeps the card formats and the link check in the Checks row, and Dismiss apart", async () => {
    const calls = stub();
    page();
    await openFirst();
    fireEvent.click(screen.getByRole("button", { name: /Checks: link preview/ }));
    expect(await screen.findByText("Card images")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/dismiss"))).toBe(true));
    expect(await screen.findByText("Nothing to announce")).toBeTruthy();
  });

  it("marks done with the d key, but not while typing in the caption", async () => {
    const calls = stub();
    page();
    const box = await openFirst();
    fireEvent.keyDown(box, { key: "d" });
    expect(calls.some((c) => c.url.endsWith("/done"))).toBe(false);
    fireEvent.keyDown(document.body, { key: "d" });
    await waitFor(() => expect(calls.find((c) => c.url.endsWith("/done"))?.body).toEqual({ channel: "linkedin" }));
  });

  it("goes back to the list with Esc", async () => {
    stub();
    page();
    await openFirst();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(await screen.findByText("copies the LinkedIn caption")).toBeTruthy();
  });

  it("arrow keys move between the channel tabs", async () => {
    stub();
    page();
    await openFirst();
    const tabs = within(screen.getByRole("tablist", { name: "Channel" })).getAllByRole("tab");
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    await waitFor(() => expect(tabs[1].getAttribute("aria-selected")).toBe("true"));
  });
});

describe("the hub shell", () => {
  it("keeps the Settings tab beside the Inbox", async () => {
    const calls = stub({ items: [] });
    page();
    fireEvent.click(await screen.findByRole("tab", { name: "Settings" }));
    await screen.findByLabelText("Default hashtags");
    expect(calls.some((c) => c.url === "/api/admin/announce/settings")).toBe(true);
  });

  it("opens straight on a tab named in the address", async () => {
    stub({ items: [] });
    page("/admin/marketing?tab=settings");
    expect(await screen.findByLabelText("Default hashtags")).toBeTruthy();
  });
});

describe("the marketing words", () => {
  it("have a Hebrew for every English entry", () => {
    const t = allWordTables().find((x) => x.name === "adminMarketing")!;
    expect(t).toBeTruthy();
    const walk = (en: unknown, he: unknown, path: string) => {
      if (en && typeof en === "object") for (const k of Object.keys(en)) walk((en as Record<string, unknown>)[k], (he as Record<string, unknown>)?.[k], `${path}.${k}`);
      else {
        expect(he, path).toBeDefined();
        const s = typeof he === "function" ? String((he as (...a: unknown[]) => unknown)(3, "X")) : String(he);
        if (!/\.(x|moreChips)$/.test(path)) expect(hasHebrew(s), path).toBe(true);
      }
    };
    walk(t.en, t.he, t.name);
  });
});
