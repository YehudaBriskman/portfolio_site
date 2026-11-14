import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Admin from "@/pages/Admin";
import AdminAreas from "@/pages/AdminAreas";
import AdminConnections from "@/pages/AdminConnections";
import AdminMedia from "@/pages/AdminMedia";

/* A 401/403 mid-session is a sentence with a way back in, never the internal token. */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
afterEach(() => (cleanup(), vi.unstubAllGlobals()));
const phone = (on: boolean) =>
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: on && q.includes("max-width: 599px"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));

const cases: [string, boolean, string, () => JSX.Element][] = [
  ["Posts phone", true, "/admin/posts", () => <Admin />],
  ["Posts desktop", false, "/admin/posts", () => <Admin />],
  ["Areas phone", true, "/admin/areas", () => <AdminAreas />],
  ["Areas desktop", false, "/admin/areas", () => <AdminAreas />],
  ["Connections", false, "/admin/connections", () => <AdminConnections />],
  ["Media", false, "/admin/media", () => <AdminMedia />],
];

for (const [name, onPhone, path, el] of cases) {
  for (const status of [401, 403]) {
    it(`${name} on ${status} says it in words and offers to sign in again`, async () => {
      phone(onPhone);
      vi.stubGlobal("fetch", vi.fn(async () => json({ error: "no" }, status)));
      render(<MemoryRouter initialEntries={[path]}>{el()}</MemoryRouter>);
      await screen.findByRole("link", { name: "Sign in again" });
      expect(document.body.textContent).not.toMatch(/not-authorised/);
    });
  }
}
