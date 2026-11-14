import { vi } from "vitest";

/*
 * Shared by the phone-screen tests (overview, connections, translations,
 * settings). jsdom has no layout, so a test asks what it can see: the rows,
 * the controls inside each, the sheet, the focus. Sizes are measured in a
 * real browser for the PR.
 */

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Below 600px: the one media query the admin phone screens ask. Returns the undo. */
export function phone(on: boolean): () => void {
  const real = window.matchMedia;
  window.matchMedia = ((q: string) => ({
    ...real(q),
    matches: on && /max-width:\s*599px/.test(q),
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = real;
  };
}

/** The page's own language, as routing.ts sets it. */
export function lang(l: "en" | "he") {
  document.documentElement.lang = l;
  if (l === "he") document.documentElement.setAttribute("dir", "rtl");
  else document.documentElement.removeAttribute("dir");
}

/** Every phone row on the page. */
export const rows = () => [...document.querySelectorAll<HTMLElement>("[data-record-row]")];

/** A row's item: its <li> (or wrapper), where nothing but the row's one button may live. */
export const itemOf = (row: HTMLElement) => (row.closest("li") ?? row.parentElement) as HTMLElement;

/** The controls inside a row's item: a row is one button, so this is 1. */
export const controlsIn = (row: HTMLElement) => itemOf(row).querySelectorAll("button, a, input, select, textarea").length;

/** The text facts a row prints, beside its title and its one glyph. */
export const factsOf = (row: HTMLElement) => [...row.querySelectorAll(".rr-fact")].map((f) => f.textContent ?? "");

type Reply = Response | Promise<Response> | undefined;

export function stubFetch(handler: (url: string, init: RequestInit | undefined) => Reply) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url === "/api/admin/me") return json({ ok: true, login: "owner", email: null });
      return handler(url, init) ?? json({ error: "not found" }, 404);
    }),
  );
  return calls;
}
