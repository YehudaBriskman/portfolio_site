import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminEditor from "@/pages/AdminEditor";
import AdminCollection from "@/pages/AdminCollection";
import AdminSettings from "@/pages/AdminSettings";
import { DEFAULT_SETTINGS } from "@/settings/schema";
import { resetSettings } from "@/settings/store";

/*
 * The admin pages' expanders use the shared Disclosure: each summary carries
 * a real, aria-hidden SVG chevron, the old CSS-only `.a-summary` glyph is
 * gone, and the area form's three summaries are translated rather than
 * hardcoded English.
 */

const post = {
  _rev: "1-a", slug: "aaa", title: "Title aaa", subtitle: null, excerpt: "", body: "", status: "draft" as const,
  publishedAt: null, updatedAt: "2026-11-01T10:00:00.000Z", tags: [], collection: "site", coverImage: null,
  links: [], readingMinutes: 1, featured: null,
};

vi.mock("@/services/admin", async (orig) => {
  const real = await orig<typeof import("@/services/admin")>();
  return {
    ...real,
    admin: { ...real.admin, get: async () => post, saveDraft: async () => post, list: async () => [], collections: async () => [] },
  };
});

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
  resetSettings();
  document.documentElement.lang = "en";
});

function stubSettings() {
  const view = { ok: true, exists: true, _rev: "1-abc", version: 1, updatedAt: "2026-11-01T10:00:00.000Z", settings: structuredClone(DEFAULT_SETTINGS), history: [] };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => (url === "/api/admin/me" ? json({ ok: true, login: "owner", email: null }) : json(view))));
}

const mountAt = (path: string, route: string, el: ReactElement) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path={route} element={el} /></Routes>
    </MemoryRouter>,
  );

function expectChevrons(container: HTMLElement, count: number) {
  const summaries = Array.from(container.querySelectorAll("summary"));
  expect(summaries).toHaveLength(count);
  for (const s of summaries) {
    expect(s.querySelector('svg[aria-hidden="true"]'), s.textContent ?? "").not.toBeNull();
  }
}

describe("admin page expanders", () => {
  it("AdminEditor: Details, SEO and Advanced each have a chevron", async () => {
    const { container } = mountAt("/admin/posts/aaa", "/admin/posts/:slug", <AdminEditor />);
    await screen.findByDisplayValue("Title aaa");
    expectChevrons(container, 3);
  });

  it("AdminCollection: Hebrew, Details and Repository each have a chevron", () => {
    const { container } = mountAt("/admin/areas/new", "/admin/areas/:slug", <AdminCollection />);
    expectChevrons(container, 3);
  });

  it("AdminSettings: each per-language share template summary has a chevron", async () => {
    stubSettings();
    const { container } = mountAt("/admin/settings", "/admin/settings", <AdminSettings />);
    await vi.waitFor(() => expect(container.querySelectorAll("summary").length).toBeGreaterThan(0));
    for (const s of Array.from(container.querySelectorAll("summary"))) {
      expect(s.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it("AdminCollection in Hebrew has no hardcoded English summaries", () => {
    document.documentElement.lang = "he";
    const { container } = mountAt("/admin/areas/new", "/admin/areas/:slug", <AdminCollection />);
    const labels = Array.from(container.querySelectorAll("summary")).map((s) => s.textContent?.trim());
    for (const english of ["Repository", "Details", "Hebrew"]) expect(labels).not.toContain(english);
    expect(labels).toEqual(["עברית", "פרטים", "מאגר"]);
  });

  it("index.css no longer defines .a-summary", () => {
    const css = readFileSync(resolve(__dirname, "../../index.css"), "utf8");
    expect(css).not.toMatch(/\.a-summary/);
  });
});
