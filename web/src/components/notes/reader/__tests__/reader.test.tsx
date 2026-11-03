import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NoteMarkdown from "../NoteMarkdown";
import { parseWikiTarget, internalTarget, wikiTargets } from "../wikilinks";
import { sanitizeSvg, svgDataUrl, isSvgSrc } from "../svgSafe";
import { clampScale, parsePrefs, prefsVars } from "../readingPrefs";
import { resetLinkCache } from "../NoteLink";

/*
 * Reader mode (#249): the parts that decide what a note's markdown may turn
 * into. Each is a place stored content could reach the DOM, so each is held
 * by a test rather than by a look at the page.
 */

describe("wikilinks", () => {
  it("names a note, an area or a project, with an optional heading and label", () => {
    expect(parseWikiTarget("some-note")).toMatchObject({ kind: "note", href: "/blog/some-note", label: null });
    expect(parseWikiTarget("area:bothy")).toMatchObject({ kind: "area", href: "/blog/area/bothy" });
    expect(parseWikiTarget("project:windom")).toMatchObject({ kind: "project", href: "/projects/windom" });
    expect(parseWikiTarget("a-note#setup", "Set up")).toMatchObject({ href: "/blog/a-note#setup", label: "Set up" });
  });

  it("refuses anything that is not a slug", () => {
    for (const bad of ["<script>", "javascript:alert(1)", "../etc", "Some Note", "evil:thing", "a/b", "a#<x>"]) {
      expect(parseWikiTarget(bad)).toBeNull();
    }
  });

  it("finds every target in a body", () => {
    expect(wikiTargets("See [[a-b]] and [[area:c|C]], not [[Bad One]].").map((t) => t.href)).toEqual([
      "/blog/a-b",
      "/blog/area/c",
    ]);
  });

  it("recognises internal addresses and nothing else", () => {
    expect(internalTarget("/blog/a-note")).toEqual({ kind: "note", slug: "a-note" });
    expect(internalTarget("/blog/area/site")).toEqual({ kind: "area", slug: "site" });
    expect(internalTarget("/projects/bothy#x")).toEqual({ kind: "project", slug: "bothy" });
    expect(internalTarget("/blog/log")).toBeNull();
    expect(internalTarget("https://example.com/blog/a-note")).toBeNull();
    expect(internalTarget("/admin/posts")).toBeNull();
  });
});

describe("svgSafe", () => {
  it("keeps the drawing and drops script, handlers, foreign objects and outside references", () => {
    const out = sanitizeSvg(
      `<svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(1)</script>` +
        `<rect width="10" height="10" fill="url(#g)" onclick="x()"/>` +
        `<foreignObject><div>hi</div></foreignObject>` +
        `<use href="https://evil.example/x.svg#a"/><use href="#ok"/>` +
        `<a href="javascript:alert(1)"><circle r="2"/></a>` +
        `<path d="M0 0L10 10" style="fill:url(https://evil.example/x)"/>` +
        `<image href="https://evil.example/p.png"/></svg>`,
    );
    expect(out).not.toBeNull();
    expect(out).toContain("<rect");
    expect(out).toContain('fill="url(#g)"');
    expect(out).toContain('href="#ok"');
    for (const bad of ["script", "onload", "onclick", "foreignObject", "evil.example", "javascript", "<a", "<image"]) {
      expect(out).not.toContain(bad);
    }
  });

  it("refuses what is not an svg, and anything with a doctype", () => {
    expect(sanitizeSvg("<div>no</div>")).toBeNull();
    expect(sanitizeSvg("not xml at all <")).toBeNull();
    expect(sanitizeSvg('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>')).toBeNull();
  });

  it("is drawn through a data: URL, never inserted as markup", () => {
    expect(svgDataUrl('<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>')).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(isSvgSrc("/api/images/media/a.svg")).toBe(true);
    expect(isSvgSrc("/x.png")).toBe(false);
  });
});

describe("reading prefs", () => {
  it("clamps to the steps it offers and survives junk", () => {
    expect(clampScale(9)).toBe(1.375);
    expect(clampScale(0.1)).toBe(0.875);
    expect(parsePrefs("{nope")).toEqual({ scale: 1, wide: false });
    expect(parsePrefs('{"scale":1.12,"wide":true}')).toEqual({ scale: 1.125, wide: true });
    expect(prefsVars({ scale: 1.25, wide: true })).toEqual({ "--note-scale": "1.25", "--note-measure": "46rem" });
  });
});

describe("NoteMarkdown", () => {
  beforeEach(() => {
    resetLinkCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const body = url.includes("/posts")
          ? { items: [{ slug: "other-note", title: "The other note", subtitle: null, excerpt: "Its excerpt.", publishedAt: null, tags: [], collection: "site", coverImage: null, readingMinutes: 1 }] }
          : { items: [] };
        return new Response(JSON.stringify(body), { status: 200 });
      }),
    );
  });

  const draw = (body: string, pen = false) =>
    render(
      <MemoryRouter>
        <NoteMarkdown body={body} pen={pen} />
      </MemoryRouter>,
    );

  it("renders no raw HTML", () => {
    const { container } = draw('Hello <img src=x onerror="alert(1)"> <script>alert(1)</script>');
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img[onerror]")).toBeNull();
  });

  it("turns a wikilink into a link with a preview on focus", async () => {
    draw("Read [[other-note]] next.");
    const link = screen.getByRole("link", { name: "Other note" });
    expect(link.getAttribute("href")).toBe("/blog/other-note");
    expect(link.getAttribute("data-wikilink")).toBe("note");
    fireEvent.focus(link);
    await waitFor(() => expect(screen.getByRole("tooltip").textContent).toContain("The other note"));
    expect(link.getAttribute("aria-describedby")).toBe(screen.getByRole("tooltip").id);
  });

  it("marks an outbound link for a screen reader", () => {
    draw("[Elsewhere](https://example.com/)");
    const a = screen.getByRole("link", { name: /Elsewhere/ });
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
    expect(a.textContent).toContain("opens on another site");
  });

  it("frames a code block with its language and a copy button", () => {
    draw("```ts\nconst a = 1;\n```");
    expect(screen.getByText("ts")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy the code" })).toBeTruthy();
  });

  it("draws an svg fence as a picture, and a bad one as code", () => {
    const { container } = draw('```svg\n<svg viewBox="0 0 4 4"><title>Boxes</title><rect width="4" height="4"/></svg>\n```');
    const img = container.querySelector('img[alt="Boxes"]') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
    expect(screen.getByRole("button", { name: "Open the diagram: Boxes" })).toBeTruthy();

    const bad = draw("```svg\n<div>not a diagram</div>\n```");
    expect(bad.container.querySelector("pre")?.textContent).toContain("not a diagram");
  });

  it("opens a picture in the picture view", () => {
    const show = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.showModal = show;
    draw('![A cabin](/api/images/media/cabin "Under the aurora")');
    fireEvent.click(screen.getByRole("button", { name: "Open the picture: A cabin" }));
    expect(show).toHaveBeenCalled();
    expect(screen.getByText("Under the aurora", { selector: "#lightbox-caption" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeTruthy();
  });
});
