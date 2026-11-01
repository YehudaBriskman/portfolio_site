import { describe, expect, it } from "vitest";
import {
  buildFeed,
  buildRobots,
  buildSitemap,
  clampDescription,
  markdownToFallbackHtml,
  renderShellWithMeta,
  type PageMeta,
} from "./seo.js";
import type { Collection, Post } from "../schemas/content.js";

const post = (over: Partial<Post> = {}): Post =>
  ({
    type: "post",
    slug: "a-post",
    title: "A post",
    subtitle: null,
    excerpt: "An excerpt.",
    body: "# A post\n\nSome words.",
    bodyFormat: "markdown",
    status: "published",
    publishedAt: "2026-01-02T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z",
    tags: ["infra"],
    collection: "site",
    source: "authored",
    coverImage: null,
    links: [],
    readingMinutes: 3,
    seo: { title: null, description: null, canonical: null, noindex: false },
    ...over,
  }) as Post;

const collection = (over: Partial<Collection> = {}): Collection =>
  ({
    type: "collection",
    slug: "bothy",
    title: "Bothy",
    description: "",
    coverImage: null,
    links: [],
    order: 10,
    status: "published",
    kind: "project",
    tagline: "",
    repo: null,
    stats: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-04T00:00:00.000Z",
    ...over,
  }) as Collection;

const SHELL = `<!DOCTYPE html><html><head><title>Old</title><meta name="description" content="old" /><meta property="og:title" content="old" /></head><body><div id="root"></div></body></html>`;

const meta = (over: Partial<PageMeta> = {}): PageMeta => ({
  title: "New title",
  description: "New description.",
  canonical: "https://yehudabriskman.com/blog/a-post",
  image: "https://yehudabriskman.com/og.png",
  imageAlt: "alt",
  type: "article",
  ...over,
});

describe("clampDescription", () => {
  it("leaves short text alone", () => {
    expect(clampDescription("Short.")).toBe("Short.");
  });

  it("cuts to the limit on a word boundary", () => {
    const out = clampDescription("word ".repeat(80));
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("buildSitemap", () => {
  it("lists static routes, projects and posts as absolute URLs", () => {
    const xml = buildSitemap([post()], [collection()]);
    expect(xml).toContain("<loc>https://yehudabriskman.com/</loc>");
    expect(xml).toContain("<loc>https://yehudabriskman.com/blog/a-post</loc>");
    expect(xml).toContain("<loc>https://yehudabriskman.com/projects/bothy</loc>");
  });

  it("lists the seeded project pages, which exist with or without a database row", () => {
    const xml = buildSitemap([], []);
    expect(xml).toContain("<loc>https://yehudabriskman.com/projects/windom</loc>");
    expect(xml).toContain("<loc>https://yehudabriskman.com/projects/bothy</loc>");
  });

  it("does not list a project twice once it has a real collection", () => {
    const xml = buildSitemap([], [collection({ slug: "windom", title: "WindoM" })]);
    const hits = xml.match(/\/projects\/windom</g) ?? [];
    expect(hits).toHaveLength(1);
  });

  it("omits noindex posts, so the sitemap never contradicts the meta tag", () => {
    const hidden = post({
      slug: "hidden",
      seo: { title: null, description: null, canonical: null, noindex: true },
    });
    expect(buildSitemap([hidden], [])).not.toContain("/blog/hidden");
  });
});

describe("buildFeed", () => {
  it("emits an item per post with an absolute permalink", () => {
    const xml = buildFeed([post()]);
    expect(xml).toContain("<guid isPermaLink=\"true\">https://yehudabriskman.com/blog/a-post</guid>");
    expect(xml).toContain("<title>A post</title>");
  });
});

describe("buildRobots", () => {
  // nginx now serves /robots.txt from this function on every host, so the
  // Sitemap line is the only thing telling preprod apart from production. If
  // it ever stopped coming from SITE_URL, every host would be back to
  // advertising production's sitemap with nothing to notice it.
  it("names the sitemap on SITE_URL's own host and keeps /admin out", () => {
    const txt = buildRobots();
    expect(txt).toContain("Sitemap: https://yehudabriskman.com/sitemap.xml");
    expect(txt).toContain("Disallow: /admin");
  });
});

describe("renderShellWithMeta", () => {
  it("replaces the shell's title and description rather than duplicating them", () => {
    const html = renderShellWithMeta(SHELL, meta());
    expect(html).toContain("<title>New title</title>");
    expect(html).not.toContain("<title>Old</title>");
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html).not.toContain('content="old"');
  });

  it("writes both og: and twitter: image tags", () => {
    const html = renderShellWithMeta(SHELL, meta());
    expect(html).toContain('property="og:image" content="https://yehudabriskman.com/og.png"');
    expect(html).toContain('name="twitter:image" content="https://yehudabriskman.com/og.png"');
  });

  it("marks noindex pages and leaves the rest indexable", () => {
    expect(renderShellWithMeta(SHELL, meta({ noindex: true }))).toContain('content="noindex, follow"');
    expect(renderShellWithMeta(SHELL, meta())).toContain('content="index, follow, max-image-preview:large"');
  });

  it("puts fallback content inside #root for clients without JavaScript", () => {
    const html = renderShellWithMeta(SHELL, meta({ bodyHtml: "<h1>Hello</h1>" }));
    expect(html).toContain('<div id="root"><h1>Hello</h1></div>');
  });

  it("escapes a closing script tag inside JSON-LD", () => {
    const html = renderShellWithMeta(SHELL, meta({ jsonLd: { name: "</script><b>x</b>" } }));
    expect(html).not.toContain("</script><b>");
  });
});

describe("markdownToFallbackHtml", () => {
  it("keeps headings, paragraphs and list items", () => {
    const html = markdownToFallbackHtml("## Heading\n\nA paragraph.\n\n- one\n- two\n");
    expect(html).toContain("<h2>Heading</h2>");
    expect(html).toContain("<p>A paragraph.</p>");
    expect(html).toContain("<li>one</li>");
  });

  it("drops fenced code and strips inline markup", () => {
    const html = markdownToFallbackHtml("```\nrm -rf /\n```\n\nSome **bold** and a [link](https://x.test).");
    expect(html).not.toContain("rm -rf");
    expect(html).toContain("<p>Some bold and a link.</p>");
  });

  it("escapes HTML so stored content cannot inject markup", () => {
    const html = markdownToFallbackHtml("A <script>alert(1)</script> line.");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
