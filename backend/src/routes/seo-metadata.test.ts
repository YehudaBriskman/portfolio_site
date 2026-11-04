/*
 * Every rendered page's metadata, from the one template (#308).
 *
 * Each page in both languages has one title, one description and one
 * canonical, a BreadcrumbList that ends at itself, and a page node of the
 * right kind; the indexes list what they contain; the head the app fetches
 * after a client-side navigation is the head the render writes.
 */
import fs from "fs";
import path from "path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch } from "../db/couch.js";
import { resetShellCache } from "../services/seo.js";
import { PERSON_ID } from "../services/seo-entity.js";
import { TITLE_MAX, fitTitle } from "../services/seo-template.js";
import { seedFor } from "../services/site-content.js";
import { areaTitleName } from "./seo.route.js";
import type { ContentBundle } from "../schemas/site-content.js";

const INDEX_HTML = fs.readFileSync(path.resolve(__dirname, "../../../web/index.html"), "utf8");

type Node = Record<string, unknown>;

function nodes(html: string): Node[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]) as Node)
    .flatMap((b) => (Array.isArray(b["@graph"]) ? (b["@graph"] as Node[]) : [b]));
}
const byType = (html: string, type: string) => nodes(html).find((n) => n["@type"] === type);
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const canonicalOf = (html: string) => /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];

const T = "2026-10-01T00:00:00.000Z";
const note = {
  _id: "post:a-note",
  type: "post",
  slug: "a-note",
  title: "A note",
  subtitle: null,
  excerpt: "An excerpt.",
  body: "Body.",
  status: "published",
  publishedAt: T,
  createdAt: T,
  updatedAt: T,
  tags: ["frontend"],
  collection: "site",
  coverImage: null,
  readingMinutes: 1,
  seo: { title: null, description: null, canonical: null, noindex: false },
  /* Published Hebrew, so its Hebrew page is a Hebrew page (#304). */
  he: { title: "רשימה", excerpt: "תקציר.", body: "גוף." },
};

const PROJECTS = (seedFor("projects") as ContentBundle["projects"]).items;

beforeEach(() => {
  resetShellCache();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).endsWith("/index.html")) return new Response(INDEX_HTML, { status: 200 });
      throw new Error(`unexpected fetch in test: ${url}`);
    }),
  );
  vi.spyOn(couch, "find").mockImplementation(async (query: unknown) => {
    const s = (query as { selector: { type: string; slug?: string } }).selector;
    if (s.type === "post") return { docs: (s.slug && s.slug !== note.slug ? [] : [note]) as never[] };
    return { docs: [] as never[] };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetShellCache();
});

const PAGES = [
  "/blog",
  "/blog/log",
  "/blog/a-note",
  "/projects",
  `/projects/${PROJECTS[0].slug}`,
  "/story",
  "/accessibility",
  "/developers/mcp",
];
const renderPath = (p: string, lang: "en" | "he") => `/api/seo/render${lang === "he" ? "/he" : ""}${p}`;

describe("every page's head (#308)", () => {
  for (const lang of ["en", "he"] as const) {
    for (const p of ["/home", ...PAGES]) {
      it(`${lang} ${p}: one title, description and canonical; breadcrumbs that end at the page`, async () => {
        const url = p === "/home" ? (lang === "he" ? "/api/seo/render/he" : "/api/seo/render/home") : renderPath(p, lang);
        const res = await request(createApp()).get(url);
        expect(res.status).toBe(200);
        expect(count(res.text, /<title>/g)).toBe(1);
        expect(count(res.text, /<meta name="description"/g)).toBe(1);
        expect(count(res.text, /<link rel="canonical"/g)).toBe(1);
        /* The seeded projects have no Hebrew yet, so their Hebrew pages are
           the English under Hebrew chrome, and noindex (#304). */
        const fallback = lang === "he" && p.startsWith("/projects/");
        if (fallback) expect(res.text).toContain('<meta name="robots" content="noindex, follow" />');
        else expect(res.text).not.toMatch(/noindex/);
        const title = /<title>([^<]*)<\/title>/.exec(res.text)![1];
        expect(title.length).toBeLessThanOrEqual(TITLE_MAX + 20);
        if (p === "/home") return;
        const crumbs = byType(res.text, "BreadcrumbList")!;
        const items = crumbs.itemListElement as Node[];
        expect(items[0].position).toBe(1);
        expect(items.at(-1)!.item).toBe(canonicalOf(res.text));
      });
    }
  }
});

describe("page kinds (#308)", () => {
  it("lists every project on /projects as a CollectionPage", async () => {
    const res = await request(createApp()).get("/api/seo/render/projects");
    const page = byType(res.text, "CollectionPage")!;
    const list = (page.mainEntity as Node).itemListElement as Node[];
    expect(list.map((i) => String(i.url).split("/").pop())).toEqual(
      [...PROJECTS].sort((a, b) => a.order - b.order).map((p) => p.slug),
    );
    expect(page.about).toEqual({ "@id": PERSON_ID });
  });

  it("lists the notes on /blog as a CollectionPage", async () => {
    const res = await request(createApp()).get("/api/seo/render/he/blog");
    const list = ((byType(res.text, "CollectionPage")!.mainEntity as Node).itemListElement as Node[]);
    expect(list[0].url).toMatch(/\/he\/blog\/a-note$/);
  });

  it("writes a note as a BlogPosting by the one person", async () => {
    const res = await request(createApp()).get("/api/seo/render/blog/a-note");
    const post = byType(res.text, "BlogPosting")!;
    expect(post.author).toMatchObject({ "@id": PERSON_ID });
    expect(post.keywords).toBe("frontend");
  });

  it("writes a project as a creative work or source code, with the page's whole story in the body", async () => {
    const p = PROJECTS.find((x) => x.highlights.length > 0) ?? PROJECTS[0];
    const res = await request(createApp()).get(`/api/seo/render/projects/${p.slug}`);
    const work = nodes(res.text).find((n) => n["@type"] === "SoftwareSourceCode" || n["@type"] === "CreativeWork")!;
    expect(work.name).toBe(p.title);
    expect(work.author).toMatchObject({ "@id": PERSON_ID });
    if (work["@type"] === "SoftwareSourceCode") expect(work.codeRepository).toMatch(/^https:\/\/github\.com\//);
    const description = /<meta name="description" content="([^"]*)"/.exec(res.text)![1];
    expect(description.length).toBeGreaterThanOrEqual(70);
    if (p.highlights.length) expect(res.text).toContain("<h2>Worth knowing</h2>");
  });

  it("preloads the home page's portrait, its largest paint", async () => {
    const res = await request(createApp()).get("/api/seo/render/home");
    expect(res.text).toMatch(/<link rel="preload" as="image" href="\/img\/yehuda-cut\.webp" imagesrcset="[^"]+" imagesizes="[^"]+"/);
  });
});

describe("the head the app fetches (#308)", () => {
  it("is the render's head, as JSON", async () => {
    const [head, page] = await Promise.all([
      request(createApp()).get("/api/seo/head/he/projects"),
      request(createApp()).get("/api/seo/render/he/projects"),
    ]);
    expect(head.status).toBe(200);
    expect(head.body.lang).toBe("he");
    for (const tag of head.body.head as string[]) expect(page.text).toContain(tag);
  });

  it("answers 404 and noindex for a path that is no page", async () => {
    const res = await request(createApp()).get("/api/seo/head/no-such-page/at-all");
    expect(res.status).toBe(404);
    expect((res.body.head as string[]).some((t) => t.includes("noindex"))).toBe(true);
  });
});

describe("titles (#308)", () => {
  it("drops the name when it would push a title past what a result shows", () => {
    expect(fitTitle("Projects", "en")).toBe("Projects · Yehuda Briskman");
    const long = "A very long note title that already fills a search result";
    expect(fitTitle(long, "en")).toBe(long);
  });

  it("does not say Notes twice for the area called Notes", () => {
    expect(areaTitleName("Notes", "Notes")).toBe("Notes");
    expect(areaTitleName("WindoM", "Notes")).toBe("WindoM · Notes");
  });
});
