/*
 * The person behind the site, as a search engine is told (#308).
 *
 * One Person under every name the owner is known by, the same node in the
 * render and in the built shell, the Hebrew spelling in Hebrew titles and on
 * the Hebrew home page, and no employer anywhere.
 */
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { couch } from "../db/couch.js";
import { resetShellCache } from "../services/seo.js";
import { ALTERNATE_NAMES, NAME_HE, PERSON_ID, knowsAbout, sameAs, withHebrewName } from "../services/seo-entity.js";
import { seedFor } from "../services/site-content.js";
import type { ContentBundle } from "../schemas/site-content.js";
import { INDEX_HTML } from "../testShell.js";

type Node = Record<string, unknown>;

/** Every JSON-LD block in a document, parsed. */
function jsonLd(html: string): Node[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]) as Node);
}

/** The nodes of a document's JSON-LD, flattened out of any @graph. */
function nodes(html: string): Node[] {
  return jsonLd(html).flatMap((b) => (Array.isArray(b["@graph"]) ? (b["@graph"] as Node[]) : [b]));
}

const byType = (html: string, type: string) => nodes(html).find((n) => n["@type"] === type);
const titleOf = (html: string) => /<title>([^<]*)<\/title>/.exec(html)?.[1];
const body = (html: string) => html.slice(html.indexOf("</head>"));

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
  tags: [],
  collection: "site",
  coverImage: null,
  readingMinutes: 1,
  seo: { title: null, description: null, canonical: null, noindex: false },
};

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

describe("the Person (#308)", () => {
  it("is one node with every name, the profiles the site links, and no employer", async () => {
    const res = await request(createApp()).get("/api/seo/render/home");
    const person = byType(res.text, "Person")!;
    expect(person["@id"]).toBe(PERSON_ID);
    expect(person.name).toBe("Yehuda Briskman");
    expect(person.alternateName).toEqual(expect.arrayContaining(["יהודה בריסקמן", "yehuda.br", "Briskman"]));
    expect(person.jobTitle).toEqual(expect.arrayContaining(["Technical team lead", "ראש צוות טכני"]));
    expect((person.image as Node).url).toMatch(/\/img\/yehuda-cut\.webp$/);
    const bundle = { siteCopy: seedFor("site-copy") } as ContentBundle;
    expect(person.sameAs).toEqual(sameAs(bundle));
    expect(person.sameAs).toEqual(expect.arrayContaining(["https://github.com/YehudaBriskman"]));
    expect(res.text).not.toContain("worksFor");
  });

  it("is written into the built shell exactly as the render writes it", async () => {
    const res = await request(createApp()).get("/api/seo/render/home");
    expect(jsonLd(INDEX_HTML)).toEqual(jsonLd(res.text));
  });

  it("is the subject of the home page's ProfilePage, and the WebSite carries the other names", async () => {
    const res = await request(createApp()).get("/api/seo/render/home");
    const profile = byType(res.text, "ProfilePage")!;
    expect(profile.mainEntity).toEqual({ "@id": PERSON_ID });
    const site = byType(res.text, "WebSite")!;
    expect(site.alternateName).toEqual(expect.arrayContaining([NAME_HE]));
    expect(site.publisher).toEqual({ "@id": PERSON_ID });
  });

  it("is the author a note points at, by @id", async () => {
    const res = await request(createApp()).get("/api/seo/render/blog/a-note");
    const post = byType(res.text, "BlogPosting")!;
    expect((post.author as Node)["@id"]).toBe(PERSON_ID);
  });
});

describe("the Hebrew name (#308)", () => {
  it("ends every Hebrew title, and leads the Hebrew home title", async () => {
    const home = await request(createApp()).get("/api/seo/render/he");
    expect(titleOf(home.text)).toMatch(/^יהודה בריסקמן \(Yehuda Briskman\) · /);
    for (const page of ["/projects", "/blog", "/story", "/accessibility", "/privacy", "/help"]) {
      const res = await request(createApp()).get(`/api/seo/render/he${page}`);
      expect(titleOf(res.text)).toMatch(/ · יהודה בריסקמן$/);
    }
    const en = await request(createApp()).get("/api/seo/render/projects");
    expect(titleOf(en.text)).toMatch(/ · Yehuda Briskman$/);
  });

  it("leads the Hebrew home page as the Latin h1, with Portfolio in the fact line (#347)", async () => {
    const res = await request(createApp()).get("/api/seo/render/he");
    expect(body(res.text)).toMatch(/<h1[^>]*>(<span[^>]*>)?Yehuda Briskman/);
    expect(body(res.text)).toContain("Portfolio — ");
    const en = await request(createApp()).get("/api/seo/render/home");
    expect(body(en.text)).not.toContain("יהודה בריסקמן");
  });
});

describe("withHebrewName", () => {
  it("adds the Hebrew spelling after the Latin name on a Hebrew page, once", () => {
    expect(withHebrewName("Yehuda Briskman — פול־סטאק", "he")).toBe("Yehuda Briskman (יהודה בריסקמן) — פול־סטאק");
    expect(withHebrewName("Yehuda Briskman — full-stack", "en")).toBe("Yehuda Briskman — full-stack");
    expect(withHebrewName("יהודה בריסקמן — פול־סטאק", "he")).toBe("יהודה בריסקמן — פול־סטאק");
    expect(withHebrewName("פול־סטאק", "he")).toBe("פול־סטאק");
  });
});

describe("knowsAbout", () => {
  it("is the fields and the projects' tech, once each, without versions", () => {
    const list = knowsAbout({
      projects: {
        items: [
          { order: 1, tech: ["React 19", "Traefik v3.7", "Manifest V3"] },
          { order: 2, tech: ["React", "PostgreSQL 17"] },
        ],
      },
    } as unknown as ContentBundle);
    expect(list).toEqual(expect.arrayContaining(["React", "Traefik", "Manifest V3", "PostgreSQL", "Frontend development"]));
    expect(list.filter((x) => x === "React")).toHaveLength(1);
    expect(ALTERNATE_NAMES).not.toContain("Yehuda Briskman");
  });
});
