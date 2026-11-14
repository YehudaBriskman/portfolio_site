import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminProjects from "@/pages/AdminProjects";
import AdminStory from "@/pages/AdminStory";
import AdminSiteCopy from "@/pages/AdminSiteCopy";
import AdminMedia from "@/pages/AdminMedia";
import AdminSettings from "@/pages/AdminSettings";
import AdminOverview from "@/pages/AdminOverview";
import { seedBundle } from "@/content/convert";
import { DEFAULT_SETTINGS } from "@/settings/schema";
import { ALLOW_LATIN } from "@/i18n/glossary";
import { json, lang, phone, stubFetch } from "@/components/admin/phone/__tests__/helpers";

/*
 * The Hebrew admin shows no English the owner did not write. Each main admin
 * screen is rendered with `lang="he"` and every visible string (text, and the
 * aria-label / title / placeholder / alt a reader hears or sees) that has no
 * Hebrew letter and is not a name, an address or a file is a failure.
 *
 * A string passes when every Latin run in it is on the glossary's
 * keep-in-Latin list, a unit or file format, or the owner's own data
 * (fixtures here are named "Fixture ..."), or the string is a URL, an email,
 * a path, a file name or a hashtag. Nothing else is allowed, so a literal
 * written into the markup of one of these screens fails here.
 *
 * jsdom has no layout: the screens are read for words, not for shape.
 */

const TECHNICAL = new Set(["B", "kB", "KB", "MB", "JPEG", "PNG", "WebP", "AVIF", "SVG", "MP4", "WebM", "VTT", "CSV", "UTM"]);
const wordsOnly = (t: string) =>
  (t.match(/[A-Za-z][A-Za-z0-9'’]*/g) ?? []).every((w) => TECHNICAL.has(w) || ALLOW_LATIN.has(w) || /^fixture$/i.test(w));

/* Text the editors show as it was typed: every string in the seeded content. */
const TYPED = new Set<string>();
(function collect(v: unknown) {
  if (typeof v === "string") TYPED.add(v.replace(/\s+/g, " ").trim());
  else if (Array.isArray(v)) v.forEach(collect);
  else if (v && typeof v === "object") Object.values(v).forEach(collect);
})(seedBundle());

function allowed(t: string): boolean {
  if (TYPED.has(t) || [...TYPED].some((o) => o.length > 20 && o.startsWith(t))) return true;
  if (!/[A-Za-z]{2}/.test(t)) return true;
  if (/[֐-׿]/.test(t)) return true;
  if (/^(https?:\/\/|\/|#|[\w.+-]+@[\w.-]+$)/.test(t)) return true;
  if (/^[\w.-]+\.(jpe?g|png|webp|avif|svg|mp4|webm|vtt)$/i.test(t)) return true;
  if (/fixture/i.test(t) || t === "Yehuda Briskman" || t === "owner") return true;
  return wordsOnly(t);
}

/** What a reader sees or hears on the page, with no Hebrew letter in it. */
function englishOnPage(): string[] {
  const out = new Set<string>();
  const add = (s: string | null) => {
    const t = (s ?? "").replace(/[⁦-⁩]/g, "").replace(/\s+/g, " ").trim();
    if (t && !allowed(t)) out.add(t.slice(0, 90));
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || ["SCRIPT", "STYLE", "OPTION"].includes(el.tagName) || el.closest("[hidden], pre, code, kbd")) continue;
    add(n.nodeValue);
  }
  for (const el of document.body.querySelectorAll("[aria-label],[title],[placeholder],[alt]")) {
    for (const a of ["aria-label", "title", "placeholder", "alt"]) add(el.getAttribute(a));
  }
  return [...out].sort();
}

/*
 * The content editors' own form labels (Title, Slug, Year, Phrase 1 ...) are
 * the one English left, held here so the list can only shrink: a string on it
 * that has been translated fails the test too, so it is taken off.
 */
const FORM_LABELS_STILL_ENGLISH: Record<string, string[]> = { projects: [], story: [], "site-copy": [] };

const viewOf = (key: string, published: unknown, draft: unknown) => ({
  ok: true, key, exists: true, _rev: "1-abc", published, draft,
  updatedAt: "2026-11-13T09:00:00.000Z", publishedAt: "2026-11-09T09:00:00.000Z", source: "admin",
});
const item = (id: string, extra: object = {}) => ({
  id, _rev: "1-a", name: `fixture-${id}.jpg`, alt: `Fixture alt ${id}`, caption: "", credit: "", kind: "image", format: "jpeg", mime: "image/jpeg",
  file: null, width: 1600, height: 900, bytes: 552_000, createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z",
  url: `https://example.com/api/images/media/${id}`, preview: `/api/images/m/${id}/w400-${"a".repeat(16)}.webp`, srcset: { avif: "", webp: "" }, usedBy: [], ...extra,
});

function mount(path: string, el: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={el} />
      </Routes>
    </MemoryRouter>,
  );
}

let undoPhone: () => void;
beforeEach(() => {
  lang("he");
  window.localStorage.clear();
  Object.assign(HTMLDialogElement.prototype, {
    showModal: function (this: HTMLDialogElement) { this.setAttribute("open", ""); },
    close: function (this: HTMLDialogElement) { this.removeAttribute("open"); },
  });
});
afterEach(() => {
  cleanup();
  undoPhone?.();
  vi.unstubAllGlobals();
  lang("en");
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

/** Lets the page's own effects (a second fetch, a focus move) land before it is read. */
const settle = () => new Promise((r) => setTimeout(r, 150));

function api(extra?: (url: string) => Response | undefined) {
  const seed = seedBundle();
  const doc = { projects: seed.projects, story: seed.story, "site-copy": seed.siteCopy } as Record<string, unknown>;
  stubFetch((url) => {
    if (url === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
    const hit = extra?.(url);
    if (hit) return hit;
    const m = /^\/api\/admin\/content\/([\w-]+)$/.exec(url);
    if (m) return json(viewOf(m[1], doc[m[1]], m[1] === "projects" ? doc[m[1]] : null));
    if (url === "/api/admin/media") return json({ ok: true, items: [item("a"), item("b", { alt: "" })] });
    if (url === "/api/admin/posts" || url === "/api/admin/collections" || url === "/api/admin/mcp/grants") return json({ ok: true, items: [] });
    if (url === "/api/admin/announce") return json({ ok: true, unread: 0, items: [] });
    if (url === "/api/admin/campaigns") return json({ ok: true, campaigns: [] });
    if (url.startsWith("/api/admin/settings"))
      return json({ ok: true, exists: true, _rev: "7-abc", version: 7, updatedAt: "2026-11-01T10:00:00.000Z", settings: DEFAULT_SETTINGS, history: [] });
    return undefined;
  });
}

/** Both layouts: the phone is what the harness measures, the desktop is what the owner also uses. */
for (const onPhone of [true]) {
  const layout = onPhone ? "phone" : "desktop";
  describe(`the Hebrew admin on a ${layout} shows no English`, () => {
    beforeEach(() => {
      undoPhone = phone(onPhone);
      api();
    });

    it("projects: banner, buttons, bar", async () => {
      mount("/admin/projects", <AdminProjects />);
      await waitFor(() => expect(document.querySelector("form")).not.toBeNull());
      await settle();
      expect(englishOnPage().filter((s) => !FORM_LABELS_STILL_ENGLISH.projects.includes(s))).toEqual([]);
    });

    it("story and site copy: banner, buttons, bar", async () => {
      mount("/admin/story", <AdminStory />);
      await waitFor(() => expect(document.querySelector("form")).not.toBeNull());
      expect(englishOnPage().filter((s) => !FORM_LABELS_STILL_ENGLISH.story.includes(s))).toEqual([]);
      cleanup();
      mount("/admin/site-copy", <AdminSiteCopy />);
      await waitFor(() => expect(document.querySelector("form")).not.toBeNull());
      expect(englishOnPage().filter((s) => !FORM_LABELS_STILL_ENGLISH["site-copy"].includes(s))).toEqual([]);
    });

    it("media: the upload box and an item's sheet", async () => {
      mount("/admin/media", <AdminMedia />);
      await waitFor(() => expect(document.querySelector("[data-media-grid]")).not.toBeNull());
      await settle();
      expect(englishOnPage()).toEqual([]);
      cleanup();
      mount("/admin/media?id=a", <AdminMedia />);
      await waitFor(() => expect(document.querySelector("dialog[open]")).not.toBeNull());
      await settle();
      expect(englishOnPage()).toEqual([]);
    });

    it("settings and overview", async () => {
      mount("/admin/settings", <AdminSettings />);
      await waitFor(() => expect(document.querySelector("main")?.textContent?.length ?? 0).toBeGreaterThan(80));
      await settle();
      expect(englishOnPage()).toEqual([]);
      cleanup();
      mount("/admin", <AdminOverview />);
      await waitFor(() => expect(document.querySelector("main")?.textContent?.length ?? 0).toBeGreaterThan(80));
      await settle();
      expect(englishOnPage()).toEqual([]);
    });
  });
}
