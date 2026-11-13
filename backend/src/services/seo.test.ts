import { describe, expect, it } from "vitest";
import {
  buildFeed,
  buildRobots,
  buildSitemap,
  clampDescription,
  FALLBACK_ATTR,
  FALLBACK_REVEAL_MS,
  markdownToFallbackHtml,
  renderShellWithMeta,
  routePreloadLinks,
  robotsStance,
  verificationTags,
  type PageMeta,
} from "./seo.js";
import { env } from "../env.js";
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

  it("lists the content store's project pages, which exist with or without a database row", () => {
    const xml = buildSitemap([], [], { projects: [{ slug: "windom", hebrew: true }, { slug: "icaros", hebrew: true }] });
    expect(xml).toContain("<loc>https://yehudabriskman.com/projects/windom</loc>");
    expect(xml).toContain("<loc>https://yehudabriskman.com/projects/icaros</loc>");
  });

  it("lists every static page, and every published collection as an area (#308)", () => {
    const xml = buildSitemap([], [collection({ slug: "windom", title: "WindoM" })]);
    for (const p of ["/story", "/accessibility", "/privacy", "/blog/log", "/developers/mcp", "/blog/area/windom"]) {
      expect(xml).toContain(`<loc>https://yehudabriskman.com${p}</loc>`);
      expect(xml).toContain(`<loc>https://yehudabriskman.com/he${p}</loc>`);
    }
  });

  it("does not list a project twice once it has a real collection", () => {
    const xml = buildSitemap([], [collection({ slug: "windom", title: "WindoM" })], { projects: [{ slug: "windom", hebrew: true }] });
    // Once per language (#248): the English address and its Hebrew twin.
    expect(xml.match(/<loc>[^<]*\/projects\/windom<\/loc>/g) ?? []).toHaveLength(2);
    expect(xml.match(/<loc>[^<]*\/he\/projects\/windom<\/loc>/g) ?? []).toHaveLength(1);
  });

  it("lists every page in both languages, each naming the other (#248)", () => {
    const xml = buildSitemap([], []);
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toMatch(/<loc>[^<]*\/he\/blog<\/loc>/);
    expect(xml).toMatch(/<loc>[^<]*\/he<\/loc>/);
    expect(xml).toMatch(/<xhtml:link rel="alternate" hreflang="he" href="[^"]*\/he\/blog" \/>/);
    expect(xml).toMatch(/<xhtml:link rel="alternate" hreflang="x-default" href="[^"]*\/blog" \/>/);
  });

  it("lists a page with no published Hebrew in English only, with no alternates (#304)", () => {
    const xml = buildSitemap([post()], [], { projects: [{ slug: "icaros", hebrew: false }], postHebrew: () => false });
    expect(xml).toContain("<loc>https://yehudabriskman.com/projects/icaros</loc>");
    expect(xml).not.toContain("/he/projects/icaros");
    expect(xml).toContain("<loc>https://yehudabriskman.com/blog/a-post</loc>");
    expect(xml).not.toContain("/he/blog/a-post");
    const entry = xml.slice(xml.indexOf("<loc>https://yehudabriskman.com/blog/a-post</loc>"));
    expect(entry.slice(0, entry.indexOf("</url>"))).not.toContain("hreflang");
    // A hub page keeps its pair whatever its items are.
    expect(xml).toContain("<loc>https://yehudabriskman.com/he/blog</loc>");
  });

  it("omits noindex posts, so the sitemap never contradicts the meta tag", () => {
    const hidden = post({
      slug: "hidden",
      seo: { title: null, description: null, canonical: null, noindex: true },
    });
    expect(buildSitemap([hidden], [])).not.toContain("/blog/hidden");
  });
});

describe("feeds and sitemap on bad stored text", () => {
  it("drops control characters XML forbids and never throws on an unparsable date", () => {
    const bad = post({ title: "a\u0001b\u000Bc", publishedAt: "not a date", createdAt: "also bad", updatedAt: "nope" });
    const feed = buildFeed([bad]);
    expect(feed).toContain("<title>abc</title>");
    // eslint-disable-next-line no-control-regex
    expect(feed).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    expect(feed).not.toContain("Invalid Date");
    const map = buildSitemap([bad], []);
    expect(map).not.toContain("<lastmod>Invalid");
    expect(map).toContain("/blog/");
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

  // /mcp answers 401 to a crawler. Search Console files that under "not
  // indexed", so the crawler is told not to go. The page *about* it must stay
  // reachable, which is why this is a prefix match on /mcp and not on /developers.
  it("keeps the MCP endpoint out and the page about it in", () => {
    const txt = buildRobots();
    expect(txt).toContain("Disallow: /mcp");
    expect(txt).not.toContain("Disallow: /developers");
  });

  // No SITE_URL and no ROBOTS_POLICY in the test environment, which is the
  // same state a deploy that configures neither is in: it must come out open,
  // because the alternative is a production host that asks to be deindexed.
  it("is open by default", () => {
    expect(buildRobots()).toContain("Allow: /");
  });

  it("disallows everything and names no sitemap when closed", () => {
    const txt = buildRobots("closed");
    expect(txt).toContain("Disallow: /");
    expect(txt).not.toContain("Allow: /");
    expect(txt).not.toContain("Sitemap:");
  });
});

/**
 * A small robots.txt matcher with Google's semantics (RFC 9309): the longest
 * matching rule wins, Allow wins a tie, `*` matches any run, `$` anchors the end.
 */
function robotsAllows(txt: string, target: string): boolean {
  let best = { len: -1, allow: true };
  for (const line of txt.split("\n")) {
    const m = /^(allow|disallow):\s*(\S+)/i.exec(line);
    if (!m) continue;
    const pat = m[2];
    const re = new RegExp(
      "^" + pat.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"),
    );
    if (!re.test(target)) continue;
    const allow = m[1].toLowerCase() === "allow";
    if (pat.length > best.len || (pat.length === best.len && allow)) best = { len: pat.length, allow };
  }
  return best.allow;
}

describe("buildRobots blog facets", () => {
  const txt = buildRobots("open");

  it.each([
    "/blog?tag=react",
    "/blog?view=feed&tag=react",
    "/blog?view=feed",
    "/blog?year=2025",
    "/blog?collection=windom",
    "/blog?open=2025-03",
    "/he/blog?tag=react",
    "/he/blog?view=feed&open=2025",
    "/blog?utm_source=x&tag=react",
    "/blog/area/windom?year=2024",
  ])("blocks %s", (url) => {
    expect(robotsAllows(txt, url)).toBe(false);
  });

  it.each([
    "/blog",
    "/he/blog",
    "/blog/some-post",
    "/he/blog/some-post",
    "/blog/area/windom",
    "/he/blog/area/windom",
    "/blog?lang=he",
    "/blog/some-post?utm_source=share&utm_medium=social",
    "/blog?utm_campaign=tag=x",
    "/blog?mytag=1",
    "/projects",
    "/",
  ])("leaves %s crawlable", (url) => {
    expect(robotsAllows(txt, url)).toBe(true);
  });

  it("does not add rules to a closed host", () => {
    expect(buildRobots("closed")).not.toContain("tag=");
  });
});

describe("robotsStance", () => {
  // Closed is correct for every host but one. The asymmetry is the point:
  // leaving preprod open costs duplicate URLs behind two other gates, while
  // closing production deindexes the site, so each case here is written as
  // "this must not close production" rather than "this should close preprod".
  it("closes a host that is not the canonical one", () => {
    expect(robotsStance("https://preprod.yehudabriskman.com", "auto")).toBe("closed");
    expect(robotsStance("http://localhost:8080", "auto")).toBe("closed");
    expect(robotsStance("https://yehudabriskman.com.example.net", "auto")).toBe("closed");
    for (const lookalike of [
      "https://evil-yehudabriskman.com.example",
      "https://yehudabriskman.com.evil.test",
      "https://evil.test/yehudabriskman.com",
      "https://evil.test/?u=yehudabriskman.com",
      "https://evil.test/#www.yehudabriskman.com",
      "https://yehudabriskman.com@evil.test",
      "https://yehudabriskmanxcom.test",
    ]) {
      expect(robotsStance(lookalike, "auto"), lookalike).toBe("closed");
    }
  });

  it("keeps the canonical host open however SITE_URL is spelled", () => {
    for (const url of [
      "https://yehudabriskman.com",
      "https://yehudabriskman.com/",
      "https://YehudaBriskman.com",
      "https://www.yehudabriskman.com",
      "https://yehudabriskman.com:443/some/base",
    ]) {
      expect(robotsStance(url, "auto")).toBe("open");
    }
  });

  it("falls open on a SITE_URL that does not parse", () => {
    expect(robotsStance("yehudabriskman.com", "auto")).toBe("open");
    expect(robotsStance("", "auto")).toBe("open");
  });

  it("lets ROBOTS_POLICY override the derivation in both directions", () => {
    expect(robotsStance("https://preprod.yehudabriskman.com", "open")).toBe("open");
    expect(robotsStance("https://yehudabriskman.com", "closed")).toBe("closed");
  });
});

describe("a page with no published Hebrew (#304)", () => {
  const head = (lang: "en" | "he", translated?: boolean) =>
    renderShellWithMeta(SHELL, { ...meta(), lang, path: "/blog/a-post", translated });

  it("is noindex in Hebrew, names no alternates and says en_US", () => {
    const html = head("he", false);
    expect(html).toContain('<meta name="robots" content="noindex, follow" />');
    expect(html).not.toContain("hreflang");
    expect(html).toContain('<meta property="og:locale" content="en_US" />');
    expect(html).not.toContain("og:locale:alternate");
  });

  it("is indexed in English, naming no Hebrew alternate", () => {
    const html = head("en", false);
    expect(html).toContain('content="index, follow, max-image-preview:large"');
    expect(html).not.toContain("hreflang");
  });

  it("flips to an indexed pair once Hebrew is published", () => {
    const html = head("he", true);
    expect(html).toContain('content="index, follow, max-image-preview:large"');
    expect(html).toContain('hreflang="en"');
    expect(html).toContain('<meta property="og:locale" content="he_IL" />');
  });
});

describe("search console verification (#308)", () => {
  it("writes a tag for each token that is set, and none otherwise", () => {
    expect(verificationTags({})).toEqual([]);
    expect(verificationTags({ GOOGLE_SITE_VERIFICATION: "abc_DEF-123456" })).toEqual([
      '<meta name="google-site-verification" content="abc_DEF-123456" />',
    ]);
    expect(verificationTags({ BING_SITE_VERIFICATION: "0123456789ABCDEF" })).toEqual([
      '<meta name="msvalidate.01" content="0123456789ABCDEF" />',
    ]);
  });

  it("puts them in the served head", () => {
    const e = env as { GOOGLE_SITE_VERIFICATION?: string };
    const before = e.GOOGLE_SITE_VERIFICATION;
    e.GOOGLE_SITE_VERIFICATION = "abc_DEF-123456";
    try {
      expect(renderShellWithMeta(SHELL, meta())).toContain('<meta name="google-site-verification" content="abc_DEF-123456" />');
    } finally {
      e.GOOGLE_SITE_VERIFICATION = before;
    }
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

  // The shell's og:image:type is stripped with the rest of its og: tags, so the
  // block has to write it back or the rendered pages are the only ones without
  // it (#125). It follows the image's extension; an unknown one omits the tag.
  it("writes og:image:type back, from the image's extension", () => {
    expect(renderShellWithMeta(SHELL, meta())).toContain('<meta property="og:image:type" content="image/png" />');
    expect(renderShellWithMeta(SHELL, meta({ image: "https://yehudabriskman.com/card.JPG?v=2" }))).toContain(
      'property="og:image:type" content="image/jpeg"',
    );
    expect(renderShellWithMeta(SHELL, meta({ image: "https://yehudabriskman.com/card" }))).not.toContain("og:image:type");
  });

  it("uses socialDescription for the share tags and description for the snippet", () => {
    const html = renderShellWithMeta(SHELL, meta({ socialDescription: "Share copy." }));
    expect(html).toContain('<meta name="description" content="New description." />');
    expect(html).toContain('<meta property="og:description" content="Share copy." />');
    expect(html).toContain('<meta name="twitter:description" content="Share copy." />');
    // And without one, every page reads exactly as it did before.
    expect(renderShellWithMeta(SHELL, meta())).toContain('<meta property="og:description" content="New description." />');
  });

  it("marks noindex pages and leaves the rest indexable", () => {
    expect(renderShellWithMeta(SHELL, meta({ noindex: true }))).toContain('content="noindex, follow"');
    expect(renderShellWithMeta(SHELL, meta())).toContain('content="index, follow, max-image-preview:large"');
  });

  it("puts fallback content inside #root for clients without JavaScript", () => {
    const html = renderShellWithMeta(SHELL, meta({ bodyHtml: "<h1>Hello</h1>" }));
    expect(html).toContain(`<div id="root"><div ${FALLBACK_ATTR}><h1>Hello</h1></div></div>`);
  });

  /*
   * The owner's report: a refresh of /projects/windom painted the fallback as
   * raw text, then the entry shutter, then the page. A script-running visitor
   * must see the shutter's first frame — a fixed black sheet — and no text; a
   * reader without scripting must see the text. The DOM is the same for both.
   */
  describe("the fallback for a visitor whose browser runs the app", () => {
    const html = renderShellWithMeta(SHELL, meta({ bodyHtml: "<main><h1>WindoM</h1><p>Every new tab</p></main>" }));
    const head = html.slice(0, html.indexOf("</head>"));
    const style = /<style data-seo-fallback>([\s\S]*?)<\/style>/.exec(head)?.[1] ?? "";
    const noscript = /<noscript><style>([\s\S]*?)<\/style><\/noscript>/.exec(head)?.[1] ?? "";

    it("keeps the content in the DOM for crawlers and no-JS readers", () => {
      expect(html).toContain("<h1>WindoM</h1><p>Every new tab</p>");
    });

    it("hides the text and paints the shutter's black sheet over the viewport", () => {
      expect(style).toMatch(/\[data-seo-fallback\]\{visibility:hidden;/);
      expect(style).toMatch(
        /\[data-seo-fallback\]::before\{content:"";position:fixed;inset:0;z-index:200;background:#000;visibility:visible;/,
      );
      // No shutter under reduced motion, so no sheet either: just hidden.
      expect(style).toContain("@media (prefers-reduced-motion:reduce){[data-seo-fallback]::before{display:none}}");
    });

    it("waits long enough for a slow phone's bundle, and is never forever", () => {
      expect(FALLBACK_REVEAL_MS).toBeGreaterThanOrEqual(12000);
      expect(FALLBACK_REVEAL_MS).toBeLessThanOrEqual(30000);
    });

    it("shows the text again if the app has not replaced it in time", () => {
      expect(style).toContain(`animation:seo-fallback-show 0s ${FALLBACK_REVEAL_MS}ms forwards`);
      expect(style).toContain("@keyframes seo-fallback-show{to{visibility:visible}}");
      expect(style).toContain("@keyframes seo-fallback-hide{to{visibility:hidden}}");
    });

    it("shows the text, uncovered, when scripting is off", () => {
      expect(noscript).toContain("[data-seo-fallback]{visibility:visible;animation:none}");
      expect(noscript).toContain("[data-seo-fallback]::before{display:none}");
    });

    it("uses no inline script, so script-src 'self' still holds", () => {
      expect(html).not.toMatch(/<script(?![^>]*application\/ld\+json)[^>]*>[^<]/i);
    });
  });

  it("adds no fallback style to a page without fallback content", () => {
    const html = renderShellWithMeta(SHELL, meta());
    expect(html).not.toContain("data-seo-fallback");
    expect(html).not.toContain("<noscript>");
  });

  it("writes fallback content literally, even when it looks like a replacement pattern", () => {
    const html = renderShellWithMeta(SHELL, meta({ bodyHtml: "<p>costs $& and $1</p>" }));
    expect(html).toContain("<p>costs $& and $1</p>");
  });

  describe("the route's chunk", () => {
    const BUILT = SHELL.replace(
      "</head>",
      `<meta name="route-preload" data-route="Project" content="/assets/Project-a1.js /assets/Byline-b2.js /assets/Project-c3.css" />` +
        `<meta name="route-preload" data-route="BlogPost" content="/assets/BlogPost-d4.js" />` +
        `<meta name="route-preload" data-route="Story" content="https://evil.example/x.js /assets/../x.js /assets/Story-e5.js" /></head>`,
    );

    it("preloads this page's chunks and CSS from the head", () => {
      const html = renderShellWithMeta(BUILT, meta({ route: "Project" }));
      const head = html.slice(0, html.indexOf("</head>"));
      expect(head).toContain('<link rel="modulepreload" crossorigin href="/assets/Project-a1.js" />');
      expect(head).toContain('<link rel="modulepreload" crossorigin href="/assets/Byline-b2.js" />');
      expect(head).toContain('<link rel="preload" as="style" crossorigin href="/assets/Project-c3.css" />');
      expect(head).not.toContain("BlogPost-d4");
    });

    it("drops every route meta from the rendered page", () => {
      expect(renderShellWithMeta(BUILT, meta({ route: "Project" }))).not.toContain("route-preload");
      expect(renderShellWithMeta(BUILT, meta())).not.toContain("route-preload");
    });

    it("preloads only the build's own asset paths", () => {
      expect(routePreloadLinks(BUILT, "Story")).toEqual([
        '<link rel="modulepreload" crossorigin href="/assets/Story-e5.js" />',
      ]);
    });

    it("preloads nothing for a shell the build did not annotate", () => {
      expect(routePreloadLinks(SHELL, "Project")).toEqual([]);
    });
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
