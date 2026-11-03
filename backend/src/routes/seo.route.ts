import { Router, type Response } from "express";
import { couch } from "../db/couch.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { renderCardPng } from "../services/og.js";
import {
  LOG_CHANNEL,
  SITE_URL,
  absoluteUrl,
  areaChannel,
  buildFeed,
  buildRobots,
  buildSitemap,
  clampDescription,
  fetchShell,
  markdownToFallbackHtml,
  renderShellWithMeta,
  type PageMeta,
} from "../services/seo.js";
import { rawImageUrlOrNull, type Collection, type Post } from "../schemas/content.js";
import type { ContentBundle } from "../schemas/site-content.js";
import { publishedBundleOrSeed } from "../services/site-content.js";

const router = Router();

/** Content from the database is escaped before it goes anywhere near the shell. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const SITE_TITLE = "Yehuda Briskman · Full-stack engineer & team lead";
const SITE_DESCRIPTION =
  "Full-stack engineer and team lead in Tel Aviv. I ship products end to end and build the checks that prove they still work.";
/*
 * The share-card wording, copied from og:description in web/index.html.
 *
 * The home page is the one URL that is served both ways — as the built shell
 * when the API is down and as this route's render when it is up — so the two
 * heads must say the same thing, or a link's preview depends on which of them a
 * scraper happened to catch. Until #125 the render wrote SITE_DESCRIPTION into
 * og:description as well, and the card read differently from the shell's. The
 * home-page test in seo.route.test.ts renders the real index.html through this
 * route and compares every og: and twitter: tag, so a change to either copy
 * that is not made to both fails there rather than in somebody's link preview.
 */
const SITE_SOCIAL_DESCRIPTION =
  "I ship products end to end, and build the checks that prove they work. Tel Aviv.";

async function publishedPosts(): Promise<Post[]> {
  const { docs } = await couch.find<Post>({
    selector: { type: "post", status: "published" },
    limit: 500,
  });
  return docs;
}

async function publishedCollections(): Promise<Collection[]> {
  const { docs } = await couch.find<Collection>({
    selector: { type: "collection", status: "published" },
    limit: 200,
  });
  return docs;
}

/* ------------------------------------------------------------ crawler files */

router.get(
  "/sitemap.xml",
  asyncHandler(async (_req, res) => {
    const [posts, collections] = await Promise.all([publishedPosts(), publishedCollections()]);
    res.type("application/xml").set("Cache-Control", "public, max-age=600");
    res.send(buildSitemap(posts, collections.filter((c) => c.kind === "project")));
  })
);

router.get(
  "/feed.xml",
  asyncHandler(async (_req, res) => {
    const posts = await publishedPosts();
    res.type("application/rss+xml").set("Cache-Control", "public, max-age=600");
    res.send(buildFeed(posts));
  })
);

router.get("/robots.txt", (_req, res) => {
  res.type("text/plain").set("Cache-Control", "public, max-age=3600");
  res.send(buildRobots());
});

/* ----------------------------------------------------------------- og cards */

function sendPng(res: Response, png: Buffer): void {
  res
    .type("image/png")
    // Long cache: the URL changes when the slug changes, and a card that lags a
    // title edit by an hour is a far smaller problem than rendering per request.
    .set("Cache-Control", "public, max-age=3600, s-maxage=86400")
    .send(png);
}

/** Per-post and per-project cards, rendered on demand and cached in process. */
router.get(
  "/og/:kind/:file",
  asyncHandler(async (req, res) => {
    const slug = req.params.file.replace(/\.png$/i, "");
    const kind = req.params.kind;

    if (kind === "blog") {
      const { docs } = await couch.find<Post>({
        selector: { type: "post", status: "published", slug },
        limit: 1,
      });
      const post = docs[0];
      if (!post) return res.status(404).json({ ok: false, error: "Not Found" });
      return sendPng(
        res,
        renderCardPng({
          eyebrow: post.collection === "site" ? "Note" : post.collection.replace(/-/g, " "),
          title: post.title,
          meta: `yehudabriskman.com · ${post.readingMinutes} min read`,
        })
      );
    }

    if (kind === "projects") {
      const { docs } = await couch.find<Collection>({
        selector: { type: "collection", status: "published", slug },
        limit: 1,
      });
      const collection = docs[0];
      // A seeded project is a real page, so it gets a real card. Without this
      // the two flagship projects in the sitemap had no image of their own.
      const title = collection?.title ?? (await storeProjects()).get(slug)?.title;
      if (!title) return res.status(404).json({ ok: false, error: "Not Found" });
      return sendPng(
        res,
        renderCardPng({
          eyebrow: "Project",
          title,
          meta: `yehudabriskman.com/projects/${slug}`,
        })
      );
    }

    return res.status(404).json({ ok: false, error: "Not Found" });
  })
);

/* --------------------------------------------------------- rendered shells */
/**
 * Crawler-visible copy for the home page, from the content store (#163).
 *
 * The app renders the home page from the store only after JavaScript runs,
 * so to anything that reads raw HTML the page would have no heading and
 * almost no words. This was a hand-maintained echo of `web/src/data/site.ts`
 * until #163; it now reads the same document the page does, so an edit in
 * the admin reaches a crawler on the next request rather than whenever
 * somebody remembered this file.
 *
 * The employer is never named: the copy says what the work is, never whose.
 */
function homeHtml(c: ContentBundle): string {
  const s = c.siteCopy;
  const para = (lines: { en: string }[]) => `<p>${escapeHtml(lines.map((l) => l.en).join(" "))}</p>`;
  const work = s.footer.work
    .map((w) => `<li><a href="${escapeHtml(w.url)}">${escapeHtml(`${w.label}, ${w.note.en}`)}</a></li>`)
    .join("");
  const profiles = s.profiles
    .map((p) => `<li><a href="${escapeHtml(p.url)}">${escapeHtml(p.label)}</a></li>`)
    .join("");
  return `<main><h1>${escapeHtml(s.hero.name)}, full-stack engineer and team lead</h1>${s.about.intro
    .map((x) => para(x.lines))
    .join("")}<h2>${escapeHtml(s.about.heading.en)}</h2>${s.about.principles
    .map((p) => `<h3>${escapeHtml(p.claim.en)}</h3>${para(p.lines)}`)
    .join("")}<h2>Elsewhere</h2><ul><li><a href="/projects">Projects: what I have built and run</a></li><li><a href="/blog">Notes: writing on backend engineering and infrastructure</a></li>${work}${profiles}</ul><p>${escapeHtml(
    `Based in ${s.contact.location.en}. ${s.contact.availability.en}.`,
  )}</p></main>`;
}

/*
 * The projects the site renders, by slug, from the content store's table.
 *
 * The frontend renders this table and merges any published area over it by
 * slug, so the server has to know it too: before, a hard load of
 * /projects/windom answered 404 while the same URL rendered fine once the app
 * had booted. Until #163 this was a hand-copied list; it is now the store's.
 */
async function storeProjects(): Promise<Map<string, ContentBundle["projects"]["items"][number]>> {
  const bundle = await publishedBundleOrSeed();
  return new Map(bundle.projects.items.map((p) => [p.slug, p]));
}


const PERSON_LD = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Yehuda Briskman",
  url: SITE_URL,
  jobTitle: "Full-stack engineer and team lead",
  address: { "@type": "PostalAddress", addressLocality: "Tel Aviv", addressCountry: "IL" },
  sameAs: ["https://github.com/YehudaBriskman"],
};

async function sendShell(res: Response, meta: PageMeta, status = 200): Promise<void> {
  const shell = await fetchShell();
  res
    .status(status)
    .type("html")
    /*
     * A 404 must not be cached: the slug it refers to may be published a minute
     * later, and a shared cache would keep serving "not found" to everyone.
     * A 200 shell embeds content-hashed asset URLs, so it may be revalidated
     * but never served stale.
     */
    .set("Cache-Control", status >= 400 ? "no-store" : "public, max-age=0, must-revalidate")
    .send(renderShellWithMeta(shell, meta));
}

router.get(
  "/render/home",
  asyncHandler(async (_req, res) => {
    const content = await publishedBundleOrSeed();
    await sendShell(res, {
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      socialDescription: SITE_SOCIAL_DESCRIPTION,
      canonical: absoluteUrl("/"),
      image: absoluteUrl("/og.png"),
      imageAlt: "Yehuda Briskman, full-stack engineer and team lead",
      type: "website",
      bodyHtml: homeHtml(content),
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          PERSON_LD,
          {
            "@type": "WebSite",
            name: "Yehuda Briskman",
            url: SITE_URL,
            inLanguage: "en",
          },
        ],
      },
    });
  })
);

router.get(
  "/render/blog",
  asyncHandler(async (_req, res) => {
    const posts = await publishedPosts();
    await sendShell(res, {
      route: "Blog",
      title: "Blogs · Yehuda Briskman",
      description:
        "Writing on backend engineering, infrastructure, and shipping products end to end.",
      canonical: absoluteUrl("/blog"),
      image: absoluteUrl("/og-blog.png"),
      imageAlt: "Notes by Yehuda Briskman",
      type: "website",
      /*
       * The index pages were 20 words of boilerplate to a crawler. They are the
       * pages that should be handing Google the link graph for everything else,
       * so they now list what they actually contain.
       */
      bodyHtml: `<main><h1>Blogs</h1><p>Writing on backend engineering, infrastructure, and shipping products end to end, plus notes from each of my projects.</p><ul>${posts
        .filter((p) => !p.seo.noindex)
        .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
        .map(
          (p) =>
            `<li><a href="/blog/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a> — ${escapeHtml(p.excerpt)}</li>`,
        )
        .join("")}</ul></main>`,
    });
  })
);

router.get(
  "/render/projects",
  asyncHandler(async (_req, res) => {
    // A real collection wins over its seed; anything only seeded still appears.
    const live = (await publishedCollections()).filter((c) => c.kind === "project");
    const merged = new Map<string, { title: string; tagline: string }>(
      [...(await storeProjects()).values()]
        .sort((a, b) => a.order - b.order)
        .map((p) => [p.slug, { title: p.title, tagline: p.fact.en }]),
    );
    for (const c of live) merged.set(c.slug, { title: c.title, tagline: c.tagline || c.description });
    const entries = [...merged.entries()];
    await sendShell(res, {
      route: "Projects",
      title: "Work · Yehuda Briskman",
      description:
        "Things I have built and run end to end, each with its own notes, documentation and source.",
      canonical: absoluteUrl("/projects"),
      image: absoluteUrl("/og-projects.png"),
      imageAlt: "Projects by Yehuda Briskman",
      type: "website",
      bodyHtml: `<main><h1>Work</h1><p>Things I have built and run end to end, each with its own notes, documentation and source.</p><ul>${entries
        .map(
          ([slug, entry]) =>
            `<li><a href="/projects/${escapeHtml(slug)}">${escapeHtml(entry.title)}</a> — ${escapeHtml(entry.tagline)}</li>`,
        )
        .join("")}</ul></main>`,
    });
  })
);

/*
 * The Journey page and the accessibility statement (#240). Neither had a
 * location in nginx, so a direct load answered 404 with the home page's head.
 * Both are static pages, so like the home page they carry a short,
 * hand-maintained echo of their own copy for clients that do not run
 * JavaScript: web/src/pages/Story.tsx and web/src/pages/Accessibility.tsx.
 * Titles match web/src/lib/pageTitle.ts, so a tab reads the same either way.
 *
 * The story names no employer, current or previous, and neither does this.
 */
router.get(
  "/render/story",
  asyncHandler(async (_req, res) => {
    const description =
      "The work along the years, as a timeline: when I started shipping, the projects I built and ran, and the roles in between.";
    /* The beats, from the store the page reads (#163), in the page's order:
       the start, every project by year, then the roles. */
    const c = await publishedBundleOrSeed();
    const lines = (ls: { en: string }[]) => escapeHtml(ls.map((l) => l.en).join(" "));
    const projects = [...c.projects.items].sort((a, b) => Number(a.year) - Number(b.year) || a.order - b.order);
    const beats = [
      `<li><h2>${c.siteCopy.hero.shippingSince}: ${escapeHtml(c.story.start.title.en)}</h2><p>${lines(c.story.start.lines)}</p></li>`,
      ...projects.map(
        (p) =>
          `<li><h2>${escapeHtml(p.year)}: <a href="/projects/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a></h2><p>${escapeHtml(`${p.fact.en}. ${p.storyLine.en}`)}</p></li>`,
      ),
      ...c.story.roles.map((r) => `<li><h2>${escapeHtml(`${r.when.en}: ${r.title.en}`)}</h2><p>${lines(r.lines)}</p></li>`),
    ].join("");
    await sendShell(res, {
      route: "Story",
      title: "Journey · Yehuda Briskman",
      description,
      canonical: absoluteUrl("/story"),
      image: absoluteUrl("/og.png"),
      imageAlt: "Yehuda Briskman, full-stack engineer and team lead",
      type: "website",
      bodyHtml: `<main><p>Journey</p><h1>The long way round</h1><p>${escapeHtml(description)}</p><ol>${beats}</ol><p><a href="/projects">Work</a> · <a href="/blog">Blogs</a></p></main>`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        url: absoluteUrl("/story"),
        mainEntity: PERSON_LD,
      },
    });
  }),
);

router.get(
  "/render/accessibility",
  asyncHandler(async (_req, res) => {
    await sendShell(res, {
      route: "Accessibility",
      title: "Accessibility · Yehuda Briskman",
      description:
        "Accessibility statement: this site aims to meet WCAG 2.2 at level AA, which includes the Israeli standard IS 5568, and how to report a barrier.",
      canonical: absoluteUrl("/accessibility"),
      image: absoluteUrl("/og.png"),
      imageAlt: "Yehuda Briskman",
      type: "website",
      bodyHtml:
        `<main><p>Statement</p><h1>Accessibility</h1>` +
        `<p>This site aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA, which includes the Israeli standard IS 5568 (WCAG 2.0 at level AA). It was audited by the site's author, and that audit is not a certification by an accessibility professional.</p>` +
        `<p>Every page works with a keyboard alone, is built from headings and landmarks a screen reader can move between, and is measured for contrast.</p>` +
        `<p><a href="/">Home</a></p></main>`,
    });
  }),
);

/*
 * The remote MCP server's page (#263), web/src/pages/DevelopersMcp.tsx: what
 * the server is, its tools, and the one line that connects a client. A
 * crawler and a link preview get the same facts without JavaScript.
 */
router.get(
  "/render/developers/mcp",
  asyncHandler(async (_req, res) => {
    const description =
      "Connect Claude, or any MCP client, to this site: read the posts and project areas with no sign-in, or sign in with GitHub to manage them.";
    const url = absoluteUrl("/mcp");
    await sendShell(res, {
      title: "MCP server · Yehuda Briskman",
      description,
      canonical: absoluteUrl("/developers/mcp"),
      image: absoluteUrl("/og.png"),
      imageAlt: "Yehuda Briskman",
      type: "website",
      bodyHtml:
        `<main><p>Developers</p><h1>MCP server</h1><p>${escapeHtml(description)}</p>` +
        `<p>Claude Code: <code>claude mcp add --transport http yehuda ${escapeHtml(url)}</code></p>` +
        `<p>claude.ai and Claude Desktop: add a custom connector with the URL <code>${escapeHtml(url)}</code>.</p>` +
        `<p>Public tools only, no sign-in: <code>${escapeHtml(url)}/public</code></p>` +
        `<p><a href="/">Home</a> · <a href="/blog">Blogs</a></p></main>`,
    });
  }),
);

/*
 * The channel log (#226). nginx sends every `/blog/<one segment>` here as a
 * post slug, and `log` is not a post, so without this route the page would be
 * served as a 404 shell. It is a page of its own: a 200, its own title, and
 * its feed in the head where a feed reader looks for it.
 */
router.get(
  "/render/blog/log",
  asyncHandler(async (_req, res) => {
    await sendShell(res, {
      route: "BlogLog",
      title: "Channel log · Yehuda Briskman",
      description:
        "Everything that happens on the site, newest first: notes, releases, pushes, site releases and new areas.",
      canonical: absoluteUrl("/blog/log"),
      image: absoluteUrl("/og-blog.png"),
      imageAlt: "Notes by Yehuda Briskman",
      type: "website",
      feeds: [{ title: LOG_CHANNEL.title, href: LOG_CHANNEL.self }],
      bodyHtml: `<main><h1>Channel log</h1><p>Everything that happens on the site, newest first.</p><p><a href="/blog">Blogs</a> · <a href="${escapeHtml(LOG_CHANNEL.self)}">RSS</a></p></main>`,
    });
  })
);

/*
 * An area's page, /blog/area/<slug> (#225, #238). Two path segments, so the
 * one-segment `/blog/<slug>` location in nginx never matched it and a direct
 * load fell through to the server's 404 shell: a refresh or a shared link
 * answered 404 with the home page's head, while the app booted and looked
 * fine. nginx now sends it here.
 *
 * An area is what the areas API and the area's feed both count as one: a
 * published collection. A hidden one, or a slug that is no area at all,
 * answers 404 with the same not-found shell as a missing post, so neither its
 * title nor its existence reaches a crawler. The slug is checked against the
 * schema's shape first, as the feed route does, so a junk path costs no query.
 */
const AREA_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

router.get(
  "/render/blog/area/:slug",
  asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    const area = AREA_SLUG.test(slug)
      ? (
          await couch.find<Collection>({
            selector: { type: "collection", status: "published", slug },
            limit: 1,
          })
        ).docs.find((c) => c.slug === slug && c.status === "published")
      : undefined;

    if (!area) {
      return sendShell(
        res,
        {
          title: "Not found · Yehuda Briskman",
          description: "That page does not exist.",
          canonical: absoluteUrl(`/blog/area/${encodeURIComponent(slug)}`),
          image: absoluteUrl("/og.png"),
          imageAlt: "Yehuda Briskman",
          type: "website",
          noindex: true,
        },
        404,
      );
    }

    const { docs } = await couch.find<Post>({
      selector: { type: "post", status: "published", collection: slug },
      limit: 500,
    });
    // Filtered again, as the area's feed does: a draft never reaches the head
    // or the body even if the selector above is ever loosened.
    const posts = docs
      .filter((p) => p.status === "published" && p.collection === slug && !p.seo.noindex)
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
    const channel = areaChannel(area);
    const description = clampDescription(area.tagline || area.description || `Notes on ${area.title}.`);
    const canonical = absoluteUrl(`/blog/area/${area.slug}`);
    const image =
      rawImageUrlOrNull(area.coverImage) ??
      (area.kind === "project" ? absoluteUrl(`/api/seo/og/projects/${area.slug}.png`) : absoluteUrl("/og-blog.png"));

    await sendShell(res, {
      route: "BlogArea",
      title: `${area.title} · Notes · Yehuda Briskman`,
      description,
      canonical,
      image,
      imageAlt: area.title,
      type: "website",
      feeds: [{ title: channel.title, href: channel.self }],
      bodyHtml: `<main><h1>${escapeHtml(area.title)}</h1><p>${escapeHtml(description)}</p><ul>${posts
        .map(
          (p) =>
            `<li><a href="/blog/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a> — ${escapeHtml(p.excerpt)}</li>`,
        )
        .join("")}</ul><p><a href="/blog">Blogs</a> · <a href="${escapeHtml(channel.self)}">RSS</a></p></main>`,
    });
  }),
);

router.get(
  "/render/blog/:slug",
  asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    const { docs } = await couch.find<Post>({
      selector: { type: "post", status: "published", slug },
      limit: 1,
    });
    const post = docs[0];

    if (!post) {
      // A missing post has to answer 404, not 200 with a "not found" body —
      // otherwise every bad URL becomes an indexable soft-404 duplicate.
      return sendShell(
        res,
        {
          title: "Not found · Yehuda Briskman",
          description: "That page does not exist.",
          canonical: absoluteUrl(`/blog/${slug}`),
          image: absoluteUrl("/og.png"),
          imageAlt: "Yehuda Briskman",
          type: "website",
          noindex: true,
        },
        404
      );
    }

    const canonical = post.seo.canonical ?? absoluteUrl(`/blog/${post.slug}`);
    const image = rawImageUrlOrNull(post.coverImage) ?? absoluteUrl(`/api/seo/og/blog/${post.slug}.png`);

    await sendShell(res, {
      route: "BlogPost",
      title: post.seo.title ?? `${post.title} · Yehuda Briskman`,
      description: clampDescription(post.seo.description ?? post.excerpt),
      canonical,
      image,
      imageAlt: post.title,
      type: "article",
      publishedAt: post.publishedAt,
      modifiedAt: post.updatedAt,
      tags: post.tags,
      noindex: post.seo.noindex,
      bodyHtml: `<main><article><h1>${escapeHtml(post.title)}</h1>${
        post.subtitle ? `<p>${escapeHtml(post.subtitle)}</p>` : ""
      }<p>${escapeHtml(post.excerpt)}</p>${markdownToFallbackHtml(post.body)}</article></main>`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.excerpt,
        image,
        datePublished: post.publishedAt ?? post.createdAt,
        dateModified: post.updatedAt,
        author: { "@type": "Person", name: "Yehuda Briskman", url: SITE_URL },
        publisher: { "@type": "Person", name: "Yehuda Briskman", url: SITE_URL },
        mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
        keywords: post.tags.join(", ") || undefined,
        wordCount: post.body.trim().split(/\s+/).length,
      },
    });
  })
);

router.get(
  "/render/projects/:slug",
  asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    const { docs } = await couch.find<Collection>({
      selector: { type: "collection", status: "published", slug },
      limit: 1,
    });
    const collection = docs[0];

    if (!collection) {
      const seed = (await storeProjects()).get(slug);
      if (seed) {
        return sendShell(res, {
          route: "Project",
          title: `${seed.title} · Yehuda Briskman`,
          description: clampDescription(seed.fact.en),
          canonical: absoluteUrl(`/projects/${slug}`),
          image: absoluteUrl("/og-projects.png"),
          imageAlt: seed.title,
          type: "website",
          bodyHtml: `<main><h1>${escapeHtml(seed.title)}</h1><p>${escapeHtml(seed.fact.en)}</p>` +
          `<p>${escapeHtml(seed.description.en)}</p>` +
          (seed.highlights.length > 0
            ? `<ul>${seed.highlights.map((h) => `<li>${escapeHtml(h.en)}</li>`).join("")}</ul>`
            : "") +
          `<p><a href="/projects">All projects</a> · <a href="/blog">Notes</a></p></main>`,
        });
      }
      return sendShell(
        res,
        {
          title: "Not found · Yehuda Briskman",
          description: "That page does not exist.",
          canonical: absoluteUrl(`/projects/${slug}`),
          image: absoluteUrl("/og.png"),
          imageAlt: "Yehuda Briskman",
          type: "website",
          noindex: true,
        },
        404
      );
    }

    const canonical = absoluteUrl(`/projects/${collection.slug}`);
    const description = collection.tagline || collection.description || SITE_DESCRIPTION;

    await sendShell(res, {
      route: "Project",
      title: `${collection.title} · Yehuda Briskman`,
      description: clampDescription(description),
      canonical,
      image: rawImageUrlOrNull(collection.coverImage) ?? absoluteUrl(`/api/seo/og/projects/${collection.slug}.png`),
      imageAlt: collection.title,
      type: "website",
      bodyHtml: `<main><h1>${escapeHtml(collection.title)}</h1>${
        collection.tagline ? `<p>${escapeHtml(collection.tagline)}</p>` : ""
      }${collection.description ? `<p>${escapeHtml(collection.description)}</p>` : ""}</main>`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "SoftwareSourceCode",
        name: collection.title,
        description,
        url: canonical,
        codeRepository: collection.repo
          ? `https://github.com/${collection.repo.owner}/${collection.repo.name}`
          : undefined,
        programmingLanguage: collection.stats?.language ?? undefined,
        author: { "@type": "Person", name: "Yehuda Briskman", url: SITE_URL },
      },
    });
  })
);

export default router;
