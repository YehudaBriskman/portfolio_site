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
import type { Collection, Post } from "../schemas/content.js";

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
      const title = collection?.title ?? SEEDED_PROJECTS[slug]?.title;
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
 * Crawler-visible copy for the home page.
 *
 * The app renders all of this from src/data/site.ts, but only after JavaScript
 * runs — so to anything that reads raw HTML the page had no heading and almost
 * no words. This is a deliberate, hand-maintained echo of that copy: if the
 * wording on the home page changes materially, change it here too.
 */
const HOME_FALLBACK_HTML = `
<main>
  <h1>Yehuda Briskman, full-stack engineer and team lead</h1>
  <p>I am a full-stack engineer and a technical team lead in Tel Aviv. I lead a small team building and running internal software, and I still write and review code every day. I never wanted the version of the job where you stop.</p>
  <p>Before that I was a full-stack engineer at Momentum Tailored Solutions.</p>
  <p>Outside work I ship my own products end to end: WindoM, a Chrome extension published in the Chrome Web Store, and Bothy, a console that reports what is running by asking Docker rather than by reading a list someone has to remember to update. I build the backends, the release pipelines and the infrastructure under both, and I run them in production rather than handing them over at the demo.</p>
  <h2>How I work</h2>
  <h3>Install from empty, every time</h3>
  <p>Every pull request on Bothy clones the repository into an empty directory, runs the three-line install and nothing else, then runs every test in the tree against whatever came up. A nightly job repeats it at a path with a space in it and at a six-level-deep path, because every portability bug that repository has had looked fine at exactly one path.</p>
  <h3>A check that cannot fail is not a check</h3>
  <p>One CI job exists only to plant a mutation and require another job to catch it. A green suite and a suite that is incapable of going red look identical from the outside, so I make the difference explicit.</p>
  <h3>Generated, never committed</h3>
  <p>Credentials are generated at install time rather than shipped as placeholders to fill in. The bootstrap prints which keys it wrote and never their values, so there is no default password to forget about.</p>
  <h2>Elsewhere</h2>
  <ul>
    <li><a href="/projects">Projects: what I have built and run</a></li>
    <li><a href="/blog">Notes: writing on backend engineering and infrastructure</a></li>
    <li><a href="https://windom.app">WindoM, in the Chrome Web Store</a></li>
    <li><a href="https://github.com/YehudaBriskman">GitHub</a></li>
  </ul>
  <p>Based in Tel Aviv, Israel. I am employed full-time and not looking for freelance work, but I read everything sent to me.</p>
</main>`;

/*
 * Projects the site can render without a database row.
 *
 * The frontend ships a seed table so /projects is never empty, and merges any
 * published collection over it by slug. The server did not know that, so a hard
 * load of /projects/windom answered 404 while the same URL rendered fine once
 * the app had booted — the index linked to pages that did not exist as far as
 * any crawler, or any refresh, was concerned.
 *
 * This is a bridge, not a design. Create the areas in the admin and the
 * database wins automatically; this list can then go, along with the seeds.
 */
const SEEDED_PROJECTS: Record<string, { title: string; tagline: string }> = {
  windom: { title: "WindoM", tagline: "Every new tab becomes a dashboard" },
  bothy: { title: "Bothy", tagline: "A console that discovers itself" },
  "programming-with-yehuda": { title: "Programming with Yehuda", tagline: "Teaching platform" },
  change11: { title: "Change11", tagline: "Cash tracking" },
  icaros: { title: "Icaros", tagline: "Car marketplace" },
  "text-encrypting": { title: "Text Encrypting", tagline: "Encrypt and decrypt in the browser" },
};


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
    await sendShell(res, {
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      socialDescription: SITE_SOCIAL_DESCRIPTION,
      canonical: absoluteUrl("/"),
      image: absoluteUrl("/og.png"),
      imageAlt: "Yehuda Briskman, full-stack engineer and team lead",
      type: "website",
      bodyHtml: HOME_FALLBACK_HTML,
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
      Object.entries(SEEDED_PROJECTS),
    );
    for (const c of live) merged.set(c.slug, { title: c.title, tagline: c.tagline || c.description });
    const entries = [...merged.entries()];
    await sendShell(res, {
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
    await sendShell(res, {
      title: "Journey · Yehuda Briskman",
      description,
      canonical: absoluteUrl("/story"),
      image: absoluteUrl("/og.png"),
      imageAlt: "Yehuda Briskman, full-stack engineer and team lead",
      type: "website",
      bodyHtml: `<main><p>Journey</p><h1>The long way round</h1><p>${escapeHtml(description)}</p><p><a href="/projects">Work</a> · <a href="/blog">Blogs</a></p></main>`,
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
 * The channel log (#226). nginx sends every `/blog/<one segment>` here as a
 * post slug, and `log` is not a post, so without this route the page would be
 * served as a 404 shell. It is a page of its own: a 200, its own title, and
 * its feed in the head where a feed reader looks for it.
 */
router.get(
  "/render/blog/log",
  asyncHandler(async (_req, res) => {
    await sendShell(res, {
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
      area.coverImage ??
      (area.kind === "project" ? absoluteUrl(`/api/seo/og/projects/${area.slug}.png`) : absoluteUrl("/og-blog.png"));

    await sendShell(res, {
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
    const image = post.coverImage ?? absoluteUrl(`/api/seo/og/blog/${post.slug}.png`);

    await sendShell(res, {
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
      const seed = SEEDED_PROJECTS[slug];
      if (seed) {
        return sendShell(res, {
          title: `${seed.title} · Yehuda Briskman`,
          description: clampDescription(seed.tagline),
          canonical: absoluteUrl(`/projects/${slug}`),
          image: absoluteUrl("/og-projects.png"),
          imageAlt: seed.title,
          type: "website",
          bodyHtml: `<main><h1>${escapeHtml(seed.title)}</h1><p>${escapeHtml(seed.tagline)}</p>` +
          `<p>Built and run end to end. Source, notes and links are on the page.</p>` +
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
      title: `${collection.title} · Yehuda Briskman`,
      description: clampDescription(description),
      canonical,
      image: collection.coverImage ?? absoluteUrl(`/api/seo/og/projects/${collection.slug}.png`),
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
