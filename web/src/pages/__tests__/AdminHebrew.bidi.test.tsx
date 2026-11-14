import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminProjects from "@/pages/AdminProjects";
import AdminMedia from "@/pages/AdminMedia";
import { bytes } from "@/components/admin/format";
import { formatBytes } from "@/services/media";
import { usePhoneAdminWords } from "@/i18n/adminPhone";
import { seedBundle } from "@/content/convert";
import { json, lang, phone, stubFetch } from "@/components/admin/phone/__tests__/helpers";

/*
 * Hebrew admin, direction and order (#705): a value next to a sentence's
 * punctuation, and a number next to its unit. jsdom has no bidi engine, so
 * what is held here is the marks that make the engine do the right thing: an
 * isolate round a date (so the stop stays at the end of the sentence, not
 * pulled to the start as ".13:00"), and a left-to-right run round "552 kB"
 * (so the number stays before its unit).
 */

const FSI = "⁨";
const LRI = "⁦";
const PDI = "⁩";

let undoPhone: () => void;
beforeEach(() => {
  undoPhone = phone(true);
});
afterEach(() => {
  cleanup();
  undoPhone();
  vi.unstubAllGlobals();
  lang("en");
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

describe("a size reads number then unit in Hebrew", () => {
  it("isolates the Overview figure as a left-to-right run", () => {
    lang("he");
    expect(bytes(552_000)).toBe(`${LRI}552 kB${PDI}`);
    expect(formatBytes(184_320)).toBe(`${LRI}180 KB${PDI}`);
    expect(formatBytes(3 * 1048576)).toBe(`${LRI}3 MB${PDI}`);
  });

  it("is unchanged in English", () => {
    lang("en");
    expect(bytes(552_000)).toBe("552 kB");
    expect(formatBytes(184_320)).toBe("180 KB");
  });
});

describe("the settings row for link tagging", () => {
  it("sets the tag's own name apart from the Hebrew round it", () => {
    const he = usePhoneAdminWords.of("he").settings.sumLinks("share");
    expect(he).toContain(`${LRI}share${PDI}`);
    expect(usePhoneAdminWords.of("en").settings.sumLinks("share")).toBe("On, source share");
  });
});

describe("the draft banner on a Hebrew editor", () => {
  it("sets each date apart, so the full stop closes the sentence", async () => {
    lang("he");
    const seed = seedBundle();
    stubFetch((url) => {
      if (url === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
      if (url.startsWith("/api/admin/content/"))
        return json({ ok: true, key: "projects", exists: true, _rev: "1-a", published: seed.projects, draft: seed.projects, updatedAt: "2026-11-13T11:00:00.000Z", publishedAt: "2026-11-09T09:00:00.000Z", source: "admin" });
      return undefined;
    });
    render(
      <MemoryRouter>
        <AdminProjects />
      </MemoryRouter>,
    );
    const banner = await waitFor(() => {
      const p = document.querySelector("form")?.parentElement?.querySelector("p.min-w-0");
      if (!p) throw new Error("no banner yet");
      return p;
    });
    const text = banner.textContent ?? "";
    expect(text).toMatch(/[֐-׿]/);
    expect(text.match(new RegExp(`${FSI}[^${PDI}]+${PDI}`, "g"))).toHaveLength(2);
    expect(text.endsWith(`${PDI}.`)).toBe(true);
  });
});

describe("the media sheet when its picture will not load", () => {
  const item = {
    id: "gone", _rev: "1-a", name: "gone.jpg", alt: "A cabin", caption: "", credit: "", kind: "image", format: "jpeg", mime: "image/jpeg",
    file: null, width: 1600, height: 1200, bytes: 180_000, createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z",
    url: "https://example.com/api/images/media/gone", preview: `/api/images/m/gone/w400-${"a".repeat(16)}.webp`, srcset: { avif: "", webp: "" }, usedBy: [],
  };

  it("replaces the broken-image box with a note, so no blank area sits above the alt field", async () => {
    Object.assign(HTMLDialogElement.prototype, {
      showModal: function (this: HTMLDialogElement) { this.setAttribute("open", ""); },
      close: function (this: HTMLDialogElement) { this.removeAttribute("open"); },
    });
    stubFetch((url) => {
      if (url === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
      if (url.startsWith("/api/admin/media")) return json({ ok: true, items: [item] });
      return undefined;
    });
    render(
      <MemoryRouter initialEntries={["/admin/media?id=gone"]}>
        <Routes>
          <Route path="/admin/media" element={<AdminMedia />} />
        </Routes>
      </MemoryRouter>,
    );
    const dialog = await screen.findByRole("dialog");
    const img = await waitFor(() => {
      const el = dialog.querySelector("picture img");
      if (!el) throw new Error("no preview yet");
      return el;
    });
    fireEvent.error(img);
    await waitFor(() => expect(dialog.querySelector("picture img")).toBeNull());
    expect(within(dialog).getByRole("status")).toHaveTextContent(/could not be loaded/i);
  });
});

describe("the public footer's links", () => {
  it("are at least 44px wide on a phone and 24px wide above it, so a short word is not a 22px target", () => {
    const src = readFileSync(resolve(__dirname, "../../components/SiteFooter.tsx"), "utf8");
    const row = /const linkRow =\s*"([^"]+)"/.exec(src)?.[1] ?? "";
    expect(row).toMatch(/\bmin-w-11\b/);
    expect(row).toMatch(/\bsm:min-w-6\b/);
  });
});
