import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import LinkPreview from "../LinkPreview";
import { domainOf } from "../helpers";
import "../words";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const data = (over: Record<string, unknown> = {}) => ({
  ok: true,
  title: "Hello <b>world</b>",
  description: "A summary",
  image: "https://example.com/og.png",
  imageWidth: 1200,
  imageHeight: 630,
  siteName: "Site",
  url: "https://www.example.com/blog/hello",
  lang: "en",
  issues: [],
  ...over,
});
const stub = (res: () => Response) => {
  const f = vi.fn(async (_url: string) => res());
  vi.stubGlobal("fetch", f);
  return f;
};
afterEach(() => (cleanup(), vi.unstubAllGlobals()));

describe("LinkPreview", () => {
  it("shows a loading state, then a card per platform with domain, text only", async () => {
    const f = stub(() => json(data()));
    render(<LinkPreview eventId="announce:post:a:1" lang="en" />);
    expect(screen.getByRole("status").textContent).toMatch(/Reading the page/);
    for (const p of ["LinkedIn", "X", "WhatsApp"]) {
      const card = await screen.findByRole("figure", {
        name: `${p} link preview`,
      });
      expect(
        within(card).getByText("Hello <b>world</b>").querySelector("b"),
      ).toBeNull();
      expect(within(card).getByText("example.com")).toBeTruthy();
      expect(
        within(card)
          .getByRole("img", { name: `${p} preview image` })
          .getAttribute("src"),
      ).toBe("https://example.com/og.png");
    }
    expect(f.mock.calls[0][0]).toBe(
      "/api/admin/announce/announce%3Apost%3Aa%3A1/preview?lang=en",
    );
    expect(screen.getByText(/Nothing to fix/)).toBeTruthy();
  });

  it("lists the issues, and never renders a non-http image", async () => {
    stub(() =>
      json(
        data({
          image: "javascript:alert(1)",
          issues: [
            {
              code: "title-long",
              field: "title",
              severity: "warn",
              limit: 70,
              length: 90,
            },
            { code: "image-size", field: "image", severity: "warn" },
          ],
        }),
      ),
    );
    render(<LinkPreview eventId="e" lang="en" />);
    expect(
      await screen.findByText(/90 characters; it is cut after about 70/),
    ).toBeTruthy();
    expect(screen.getByText(/not declared as 1200 by 630/)).toBeTruthy();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(screen.getAllByText("No image")).toHaveLength(3);
  });

  it("reads the Hebrew head for Hebrew, with the card text right-to-left", async () => {
    const f = stub(() => json(data({ lang: "he", title: "שלום" })));
    render(<LinkPreview eventId="e" lang="he" />);
    const card = await screen.findByRole("figure", {
      name: /LinkedIn link preview/,
    });
    expect(f.mock.calls[0][0]).toMatch(/lang=he$/);
    expect(card.querySelector("figcaption")?.getAttribute("dir")).toBe("rtl");
  });

  it("says why when the event has no page, and offers a retry on a failure", async () => {
    stub(() => json({ ok: false }, 422));
    const a = render(<LinkPreview eventId="e" lang="en" />);
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /no page of its own/,
    );
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    a.unmount();

    const f = stub(() => json({ ok: false }, 500));
    render(<LinkPreview eventId="e" lang="en" />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(f).toHaveBeenCalledTimes(2));
  });

  it("domainOf drops www and survives junk", () => {
    expect(domainOf("https://www.a.com/x")).toBe("a.com");
    expect(domainOf("nope")).toBe("");
  });
});
