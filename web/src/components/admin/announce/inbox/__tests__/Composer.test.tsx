import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Composer from "../Composer";
import { releaseTag } from "../../helpers";
import { buildRichEmail } from "@/lib/share/richEmail";
import type { AnnounceSummary } from "@/services/adminAnnounce";
import "../words";
import "../../words";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const SITE = "https://site.example.test";
const release: AnnounceSummary = {
  id: "announce:release:v1.6.1:1",
  kind: "release",
  ref: "v1.6.1",
  title: "portfolio_site v1.6.1",
  url: "https://github.com/YehudaBriskman/portfolio_site/releases/tag/v1.6.1",
  langs: ["en"],
  createdAt: "2026-11-01T10:00:00Z",
  readAt: "2026-11-01T11:00:00Z",
  done: {},
  dismissed: null,
};
const post: AnnounceSummary = { ...release, id: "announce:post:hello:1", kind: "post", ref: "hello", title: "Hello", url: `${SITE}/blog/hello` };

const kitItem = (text: string, subject = "") => ({ text, subject, limit: null, length: text.length, over: false });

function stub(ev: AnnounceSummary) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/preview?lang=en") || url.includes("/preview")) return ev.kind === "release" ? json({}, 422) : json({ ok: true, title: "Hello", description: "", image: "", imageWidth: null, imageHeight: null, siteName: "S", url: ev.url, lang: "en", issues: [{ code: "description-missing", field: "description", severity: "error" }] });
      if (url.includes("/api/admin/announce/")) {
        const k = { linkedin: kitItem("LI text"), instagram: kitItem("IG text"), email: kitItem("Mail text", "Subject line"), x: kitItem("X text") };
        return json({ ok: true, siteOrigin: SITE, event: { ...ev, summary: "s", tags: [], version: null }, kit: { en: k, he: {} } });
      }
      return json({}, 404);
    }),
  );
}
const renderIt = (ev: AnnounceSummary) =>
  render(
    <MemoryRouter>
      <Composer event={ev} onBack={() => undefined} onChange={() => undefined} />
    </MemoryRouter>,
  );

beforeEach(() => stub(release));
afterEach(() => (cleanup(), vi.unstubAllGlobals()));

describe("Composer on a release whose address is on GitHub", () => {
  it("builds the card from the site's origin, never from github.com", async () => {
    renderIt(release);
    fireEvent.click(await screen.findByRole("button", { name: /Checks: link preview/ }));
    const imgs = await waitFor(() => {
      const found = Array.from(document.querySelectorAll("img")).map((i) => i.getAttribute("src") ?? "");
      expect(found.some((s) => s.includes("/api/seo/og/release/"))).toBe(true);
      return found;
    });
    for (const src of imgs.filter((s) => s.includes("/api/seo/og/"))) {
      expect(src.startsWith(`${SITE}/api/seo/og/release/v1.6.1.png`)).toBe(true);
      expect(src.startsWith(window.location.origin)).toBe(false);
      expect(src).not.toContain("github.com");
    }
  });

  it("says where the link goes instead of 'no page of its own'", async () => {
    renderIt(release);
    fireEvent.click(await screen.findByRole("button", { name: /Checks: link preview/ }));
    expect(await screen.findByText(release.url)).toBeTruthy();
    expect(screen.queryByText(/no page of its own/)).toBeNull();
  });

  it("shows a human title and a numbered flow with real headings", async () => {
    renderIt(release);
    expect((await screen.findByRole("heading", { level: 2, name: "Release v1.6.1" })).textContent).toBe("Release v1.6.1");
    const steps = (await screen.findAllByRole("heading", { level: 3 })).map((h) => h.textContent);
    expect(steps).toEqual(["1What you are announcing", "2Where it goes", "3Write it", "4Send it"]);
  });

  it("draws the email block for a GitHub link and states who gets an email", async () => {
    renderIt(release);
    fireEvent.click(await screen.findByRole("tab", { name: /Email/ }));
    expect(await screen.findByText(/Goes to you only/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Campaigns" }).getAttribute("href")).toMatch(/\?tab=campaigns$/);
    expect(screen.queryByText(/could not be drawn/)).toBeNull();
  });
});

describe("Composer on a post", () => {
  it("uses the server's site origin for the card, the Instagram download and the email image, not the admin page's", async () => {
    stub(post);
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.href);
    });
    renderIt(post);
    fireEvent.click(await screen.findByRole("tab", { name: /Instagram/ }));
    await waitFor(() => expect(Array.from(document.querySelectorAll("img")).some((i) => new URL(i.getAttribute("src") ?? "", "http://x.invalid").origin === SITE)).toBe(true));
    for (const i of Array.from(document.querySelectorAll("img"))) expect(i.getAttribute("src") ?? "").not.toContain(window.location.origin);
    fireEvent.click(screen.getByRole("button", { name: /Download square card/ }));
    expect(clicked).toEqual([`${SITE}/api/seo/og/blog/hello.png?format=square`]);
  });

  it("lists what needs fixing in one line, and keeps Dismiss apart from the primary action", async () => {
    stub(post);
    renderIt(post);
    expect(await screen.findByText(/To fix: No description/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Copy and open LinkedIn/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeTruthy();
  });

  it("keeps the shortcuts behind a button", async () => {
    stub(post);
    renderIt(post);
    expect(screen.queryByText("marks it done")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Keyboard shortcuts" }));
    expect(screen.getByText("marks it done")).toBeTruthy();
  });
});

describe("releaseTag and the email block", () => {
  it("only rewrites '<repo> <tag>' titles of releases", () => {
    expect(releaseTag(release)).toBe("v1.6.1");
    expect(releaseTag({ ...release, title: "Big launch v1.6.1" })).toBeNull();
    expect(releaseTag({ ...post, title: "x v1.6.1", ref: "v1.6.1" })).toBeNull();
  });
  it("accepts a link on a listed origin only", () => {
    const base = { title: "t", origin: "https://site.test", buttonLabel: "Go", url: release.url };
    expect(() => buildRichEmail(base)).toThrow(RangeError);
    expect(buildRichEmail({ ...base, linkOrigins: ["https://github.com"] }).text).toContain(release.url);
    expect(() => buildRichEmail({ ...base, url: "https://evil.test/x", linkOrigins: ["https://github.com"] })).toThrow(RangeError);
  });
});
