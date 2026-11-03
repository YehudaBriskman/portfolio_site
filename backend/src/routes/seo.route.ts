import { Router, type Request, type Response } from "express";
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
  pathIn,
  renderShellWithMeta,
  type Lang,
  type PageMeta,
} from "../services/seo.js";
import { SEO_WORDS } from "../services/seo-words.js";
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

/*
 * Every rendered page, in both languages (#248).
 *
 * nginx sends `/he/<path>` to `/api/seo/render/he/<path>`, and `page()` below
 * registers each renderer under both prefixes, so one function answers both
 * and is handed the language. A Hebrew page gets `lang="he" dir="rtl"` on its
 * <html>, Hebrew titles and descriptions (services/seo-words.ts), links that
 * stay in Hebrew, and `hreflang` alternates pointing at its English twin.
 *
 * Content from the store is optional in Hebrew. Where it is missing the
 * English is used, wrapped in `lang="en" dir="ltr"` so a crawler and a screen
 * reader both know what language they are reading.
 */
type Render = (req: Request, res: Response, lang: Lang) => Promise<void>;

function page(path: string, render: Render): void {
  router.get(`/render${path}`, asyncHandler((req, res) => render(req, res, "en")));
  const he = path === "/home" ? "" : path;
  router.get(`/render/he${he}`, asyncHandler((req, res) => render(req, res, "he")));
}

type Text = { en: string; he?: string };

/** A store text in a language, escaped, and marked when it fell back to English. */
function tx(t: Text, lang: Lang): string {
  if (lang === "he" && t.he) return escapeHtml(t.he);
  return lang === "he" ? `<span lang="en" dir="ltr">${escapeHtml(t.en)}</span>` : escapeHtml(t.en);
}

/** A string that is English whatever the page's language: a post title, an area's name. */
function en(s: string, lang: Lang): string {
  return lang === "he" ? `<span lang="en" dir="ltr">${escapeHtml(s)}</span>` : escapeHtml(s);
}

/** The plain-text form of a store text, for a head tag. */
function plain(t: Text, lang: Lang): string {
  return lang === "he" && t.he ? t.he : t.en;
}

/** An internal link's href, kept in the page's language. */
const href = (path: string, lang: Lang) => escapeHtml(pathIn(path, lang));

/**
 * Crawler-visible copy for the home page, from the content store (#163).
 *
 * The app renders the home page from the store only after JavaScript runs,
 * so to anything that reads raw HTML the page would have no heading and
 * almost no words. It reads the same document the page does, so an edit in
 * the admin reaches a crawler on the next request.
 *
 * The employer is never named: the copy says what the work is, never whose.
 */
function homeHtml(c: ContentBundle, lang: Lang): string {
  const w = SEO_WORDS[lang];
  const s = c.siteCopy;
  const para = (lines: Text[]) => `<p>${lines.map((l) => tx(l, lang)).join(" ")}</p>`;
  const work = s.footer.work
    .map((w) => `<li><a href="${escapeHtml(w.url)}">${en(w.label, lang)}, ${tx(w.note, lang)}</a></li>`)
    .join("");
  const profiles = s.profiles
    .map((p) => `<li><a href="${escapeHtml(p.url)}">${en(p.label, lang)}</a></li>`)
    .join("");
  return `<main><h1>${en(s.hero.name, lang)}, ${escapeHtml(w.role)}</h1>${s.about.intro
    .map((x) => para(x.lines))
    .join("")}<h2>${tx(s.about.heading, lang)}</h2>${s.about.principles
    .map((p) => `<h3>${tx(p.claim, lang)}</h3>${para(p.lines)}`)
    .join("")}<h2>${escapeHtml(w.elsewhere)}</h2><ul><li><a href="${href("/projects", lang)}">${escapeHtml(w.homeProjects)}</a></li><li><a href="${href("/blog", lang)}">${escapeHtml(w.homeNotes)}</a></li>${work}${profiles}</ul><p>${escapeHtml(
    w.basedIn(plain(s.contact.location, lang)),
  )} ${tx(s.contact.availability, lang)}.</p></main>`;
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

function personLd(lang: Lang) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Yehuda Briskman",
    url: SITE_URL,
    jobTitle: SEO_WORDS[lang].jobTitle,
    address: { "@type": "PostalAddress", addressLocality: "Tel Aviv", addressCountry: "IL" },
    sameAs: ["https://github.com/YehudaBriskman"],
  };
}

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

/** What every page in a language shares: its language, path and canonical. */
function at(path: string, lang: Lang) {
  return { lang, path, canonical: absoluteUrl(pathIn(path, lang)) };
}

const title = (name: string) => `${name} · Yehuda Briskman`;

function notFound(res: Response, path: string, lang: Lang): Promise<void> {
  const w = SEO_WORDS[lang];
  return sendShell(
    res,
    {
      title: title(w.notFound),
      description: w.notFoundDescription,
      lang,
      canonical: absoluteUrl(pathIn(path, lang)),
      image: absoluteUrl("/og.png"),
      imageAlt: "Yehuda Briskman",
      type: "website",
      noindex: true,
    },
    404,
  );
}

page("/home", async (_req, res, lang) => {
  const w = SEO_WORDS[lang];
  const content = await publishedBundleOrSeed();
  await sendShell(res, {
    ...at("/", lang),
    title: w.siteTitle,
    description: w.siteDescription,
    socialDescription: w.siteSocial,
    image: absoluteUrl("/og.png"),
    imageAlt: `Yehuda Briskman, ${w.role}`,
    type: "website",
    bodyHtml: homeHtml(content, lang),
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        personLd(lang),
        {
          "@type": "WebSite",
          name: "Yehuda Briskman",
          url: SITE_URL,
          inLanguage: lang,
        },
      ],
    },
  });
});

page("/blog", async (_req, res, lang) => {
  const w = SEO_WORDS[lang];
  const posts = await publishedPosts();
  await sendShell(res, {
    ...at("/blog", lang),
    route: "Blog",
    title: title(w.blogs),
    description: w.blogsDescription,
    image: absoluteUrl("/og-blog.png"),
    imageAlt: w.notesAlt,
    type: "website",
    /*
     * The index pages were 20 words of boilerplate to a crawler. They are the
     * pages that should be handing Google the link graph for everything else,
     * so they now list what they actually contain.
     */
    bodyHtml: `<main><h1>${escapeHtml(w.blogs)}</h1><p>${escapeHtml(w.blogsBody)}</p><ul>${posts
      .filter((p) => !p.seo.noindex)
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .map((p) => `<li><a href="${href(`/blog/${p.slug}`, lang)}">${en(p.title, lang)}</a> — ${en(p.excerpt, lang)}</li>`)
      .join("")}</ul></main>`,
  });
});

page("/projects", async (_req, res, lang) => {
  const w = SEO_WORDS[lang];
  // A real collection wins over its seed; anything only seeded still appears.
  const live = (await publishedCollections()).filter((c) => c.kind === "project");
  const merged = new Map<string, { title: string; tagline: string }>(
    [...(await storeProjects()).values()]
      .sort((a, b) => a.order - b.order)
      .map((p) => [p.slug, { title: en(p.title, lang), tagline: tx(p.fact, lang) }]),
  );
  for (const c of live) merged.set(c.slug, { title: en(c.title, lang), tagline: en(c.tagline || c.description, lang) });
  const entries = [...merged.entries()];
  await sendShell(res, {
    ...at("/projects", lang),
    route: "Projects",
    title: title(w.work),
    description: w.workDescription,
    image: absoluteUrl("/og-projects.png"),
    imageAlt: w.projectsAlt,
    type: "website",
    bodyHtml: `<main><h1>${escapeHtml(w.work)}</h1><p>${escapeHtml(w.workDescription)}</p><ul>${entries
      .map(([slug, entry]) => `<li><a href="${href(`/projects/${slug}`, lang)}">${entry.title}</a> — ${entry.tagline}</li>`)
      .join("")}</ul></main>`,
  });
});

/*
 * The Journey page and the accessibility statement (#240). Both are static
 * pages, so like the home page they carry a short, hand-maintained echo of
 * their own copy for clients that do not run JavaScript:
 * web/src/pages/Story.tsx and web/src/pages/Accessibility.tsx. Titles match
 * web/src/lib/pageTitle.ts, so a tab reads the same either way.
 *
 * The story names no employer, current or previous, and neither does this.
 */
page("/story", async (_req, res, lang) => {
  const w = SEO_WORDS[lang];
  /* The beats, from the store the page reads (#163), in the page's order:
     the start, every project by year, then the roles. */
  const c = await publishedBundleOrSeed();
  const lines = (ls: Text[]) => ls.map((l) => tx(l, lang)).join(" ");
  const projects = [...c.projects.items].sort((a, b) => Number(a.year) - Number(b.year) || a.order - b.order);
  const beats = [
    `<li><h2>${c.siteCopy.hero.shippingSince}: ${tx(c.story.start.title, lang)}</h2><p>${lines(c.story.start.lines)}</p></li>`,
    ...projects.map(
      (p) =>
        `<li><h2>${escapeHtml(p.year)}: <a href="${href(`/projects/${p.slug}`, lang)}">${en(p.title, lang)}</a></h2><p>${tx(p.fact, lang)}. ${tx(p.storyLine, lang)}</p></li>`,
    ),
    ...c.story.roles.map((r) => `<li><h2>${tx(r.when, lang)}: ${tx(r.title, lang)}</h2><p>${lines(r.lines)}</p></li>`),
  ].join("");
  await sendShell(res, {
    ...at("/story", lang),
    route: "Story",
    title: title(w.journey),
    description: w.journeyDescription,
    image: absoluteUrl("/og.png"),
    imageAlt: `Yehuda Briskman, ${w.role}`,
    type: "website",
    bodyHtml: `<main><p>${escapeHtml(w.journey)}</p><h1>${escapeHtml(w.journeyTitle)}</h1><p>${escapeHtml(w.journeyDescription)}</p><ol>${beats}</ol><p><a href="${href("/projects", lang)}">${escapeHtml(w.work)}</a> · <a href="${href("/blog", lang)}">${escapeHtml(w.blogs)}</a></p></main>`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      url: absoluteUrl(pathIn("/story", lang)),
      inLanguage: lang,
      mainEntity: personLd(lang),
    },
  });
});

page("/accessibility", async (_req, res, lang) => {
  const w = SEO_WORDS[lang];
  await sendShell(res, {
    ...at("/accessibility", lang),
    route: "Accessibility",
    title: title(w.accessibility),
    description: w.accessibilityDescription,
    image: absoluteUrl("/og.png"),
    imageAlt: "Yehuda Briskman",
    type: "website",
    bodyHtml:
      `<main><p>${escapeHtml(w.statement)}</p><h1>${escapeHtml(w.accessibility)}</h1>` +
      w.accessibilityBody.map((p) => `<p>${escapeHtml(p)}</p>`).join("") +
      `<p><a href="${href("/", lang)}">${escapeHtml(w.home)}</a></p></main>`,
  });
});

/*
 * The remote MCP server's page (#263), web/src/pages/DevelopersMcp.tsx: what
 * the server is, its tools, and the one line that connects a client. A
 * crawler and a link preview get the same facts without JavaScript.
 */
page("/developers/mcp", async (_req, res, lang) => {
  const w = SEO_WORDS[lang];
  const url = absoluteUrl("/mcp");
  const code = (s: string) => `<code dir="ltr">${escapeHtml(s)}</code>`;
  await sendShell(res, {
    ...at("/developers/mcp", lang),
    title: title(w.mcp),
    description: w.mcpDescription,
    image: absoluteUrl("/og.png"),
    imageAlt: "Yehuda Briskman",
    type: "website",
    bodyHtml:
      `<main><p>${escapeHtml(w.developers)}</p><h1>${escapeHtml(w.mcp)}</h1><p>${escapeHtml(w.mcpDescription)}</p>` +
      `<p>${escapeHtml(w.mcpCode)}: ${code(`claude mcp add --transport http yehuda ${url}`)}</p>` +
      `<p>${escapeHtml(w.mcpConnector)} ${code(url)}.</p>` +
      `<p>${escapeHtml(w.mcpPublic)} ${code(`${url}/public`)}</p>` +
      `<p><a href="${href("/", lang)}">${escapeHtml(w.home)}</a> · <a href="${href("/blog", lang)}">${escapeHtml(w.blogs)}</a></p></main>`,
  });
});

/*
 * The channel log (#226). nginx sends every `/blog/<one segment>` here as a
 * post slug, and `log` is not a post, so without this route the page would be
 * served as a 404 shell. It is a page of its own: a 200, its own title, and
 * its feed in the head where a feed reader looks for it.
 */
page("/blog/log", async (_req, res, lang) => {
  const w = SEO_WORDS[lang];
  await sendShell(res, {
    ...at("/blog/log", lang),
    route: "BlogLog",
    title: title(w.log),
    description: w.logDescription,
    image: absoluteUrl("/og-blog.png"),
    imageAlt: w.notesAlt,
    type: "website",
    feeds: [{ title: LOG_CHANNEL.title, href: LOG_CHANNEL.self }],
    bodyHtml: `<main><h1>${escapeHtml(w.log)}</h1><p>${escapeHtml(w.logBody)}</p><p><a href="${href("/blog", lang)}">${escapeHtml(w.blogs)}</a> · <a href="${escapeHtml(LOG_CHANNEL.self)}">RSS</a></p></main>`,
  });
});

/*
 * An area's page, /blog/area/<slug> (#225, #238). Two path segments, so the
 * one-segment `/blog/<slug>` location in nginx never matched it and a direct
 * load fell through to the server's 404 shell. nginx now sends it here.
 *
 * An area is what the areas API and the area's feed both count as one: a
 * published collection. A hidden one, or a slug that is no area at all,
 * answers 404 with the same not-found shell as a missing post, so neither its
 * title nor its existence reaches a crawler. The slug is checked against the
 * schema's shape first, as the feed route does, so a junk path costs no query.
 */
const AREA_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

page("/blog/area/:slug", async (req, res, lang) => {
  const w = SEO_WORDS[lang];
  const slug = String(req.params.slug);
  const area = AREA_SLUG.test(slug)
    ? (
        await couch.find<Collection>({
          selector: { type: "collection", status: "published", slug },
          limit: 1,
        })
      ).docs.find((c) => c.slug === slug && c.status === "published")
    : undefined;

  if (!area) return notFound(res, `/blog/area/${encodeURIComponent(slug)}`, lang);

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
  const own = area.tagline || area.description;
  const description = clampDescription(own || w.notesOn(area.title));
  const image =
    rawImageUrlOrNull(area.coverImage) ??
    (area.kind === "project" ? absoluteUrl(`/api/seo/og/projects/${area.slug}.png`) : absoluteUrl("/og-blog.png"));

  await sendShell(res, {
    ...at(`/blog/area/${area.slug}`, lang),
    route: "BlogArea",
    title: `${area.title} · ${w.notes} · Yehuda Briskman`,
    description,
    image,
    imageAlt: area.title,
    type: "website",
    feeds: [{ title: channel.title, href: channel.self }],
    bodyHtml: `<main><h1>${en(area.title, lang)}</h1><p>${own ? en(description, lang) : escapeHtml(description)}</p><ul>${posts
      .map((p) => `<li><a href="${href(`/blog/${p.slug}`, lang)}">${en(p.title, lang)}</a> — ${en(p.excerpt, lang)}</li>`)
      .join("")}</ul><p><a href="${href("/blog", lang)}">${escapeHtml(w.blogs)}</a> · <a href="${escapeHtml(channel.self)}">RSS</a></p></main>`,
  });
});

page("/blog/:slug", async (req, res, lang) => {
  const w = SEO_WORDS[lang];
  const slug = String(req.params.slug);
  const { docs } = await couch.find<Post>({
    selector: { type: "post", status: "published", slug },
    limit: 1,
  });
  const post = docs[0];

  // A missing post has to answer 404, not 200 with a "not found" body —
  // otherwise every bad URL becomes an indexable soft-404 duplicate.
  if (!post) return notFound(res, `/blog/${slug}`, lang);

  /* A post's own canonical, when it sets one, is the English page's; the
     Hebrew page is its own address, with the English as its alternate. */
  const canonical =
    lang === "en" ? (post.seo.canonical ?? absoluteUrl(`/blog/${post.slug}`)) : absoluteUrl(pathIn(`/blog/${post.slug}`, lang));
  const image = rawImageUrlOrNull(post.coverImage) ?? absoluteUrl(`/api/seo/og/blog/${post.slug}.png`);
  const marker = lang === "he" ? `<p>${escapeHtml(w.writtenInEnglish)}</p>` : "";

  await sendShell(res, {
    ...at(`/blog/${post.slug}`, lang),
    canonical,
    route: "BlogPost",
    title: post.seo.title ?? `${post.title} · Yehuda Briskman`,
    description: clampDescription(post.seo.description ?? post.excerpt),
    image,
    imageAlt: post.title,
    type: "article",
    publishedAt: post.publishedAt,
    modifiedAt: post.updatedAt,
    tags: post.tags,
    noindex: post.seo.noindex,
    bodyHtml: `<main>${marker}<article${lang === "he" ? ' lang="en" dir="ltr"' : ""}><h1>${escapeHtml(post.title)}</h1>${
      post.subtitle ? `<p>${escapeHtml(post.subtitle)}</p>` : ""
    }<p>${escapeHtml(post.excerpt)}</p>${markdownToFallbackHtml(post.body)}</article></main>`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.excerpt,
      image,
      inLanguage: "en",
      datePublished: post.publishedAt ?? post.createdAt,
      dateModified: post.updatedAt,
      author: { "@type": "Person", name: "Yehuda Briskman", url: SITE_URL },
      publisher: { "@type": "Person", name: "Yehuda Briskman", url: SITE_URL },
      mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
      keywords: post.tags.join(", ") || undefined,
      wordCount: post.body.trim().split(/\s+/).length,
    },
  });
});

page("/projects/:slug", async (req, res, lang) => {
  const w = SEO_WORDS[lang];
  const slug = String(req.params.slug);
  const { docs } = await couch.find<Collection>({
    selector: { type: "collection", status: "published", slug },
    limit: 1,
  });
  const collection = docs[0];

  if (!collection) {
    const seed = (await storeProjects()).get(slug);
    if (seed) {
      return sendShell(res, {
        ...at(`/projects/${slug}`, lang),
        route: "Project",
        title: title(seed.title),
        description: clampDescription(plain(seed.fact, lang)),
        image: absoluteUrl("/og-projects.png"),
        imageAlt: seed.title,
        type: "website",
        bodyHtml:
          `<main><h1>${en(seed.title, lang)}</h1><p>${tx(seed.fact, lang)}</p>` +
          `<p>${tx(seed.description, lang)}</p>` +
          (seed.highlights.length > 0 ? `<ul>${seed.highlights.map((h) => `<li>${tx(h, lang)}</li>`).join("")}</ul>` : "") +
          `<p><a href="${href("/projects", lang)}">${escapeHtml(w.allProjects)}</a> · <a href="${href("/blog", lang)}">${escapeHtml(w.notes)}</a></p></main>`,
      });
    }
    return notFound(res, `/projects/${slug}`, lang);
  }

  const canonical = absoluteUrl(pathIn(`/projects/${collection.slug}`, lang));
  const description = collection.tagline || collection.description || w.siteDescription;

  await sendShell(res, {
    ...at(`/projects/${collection.slug}`, lang),
    route: "Project",
    title: title(collection.title),
    description: clampDescription(description),
    image: rawImageUrlOrNull(collection.coverImage) ?? absoluteUrl(`/api/seo/og/projects/${collection.slug}.png`),
    imageAlt: collection.title,
    type: "website",
    bodyHtml: `<main><h1>${en(collection.title, lang)}</h1>${
      collection.tagline ? `<p>${en(collection.tagline, lang)}</p>` : ""
    }${collection.description ? `<p>${en(collection.description, lang)}</p>` : ""}</main>`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      name: collection.title,
      description,
      url: canonical,
      codeRepository: collection.repo ? `https://github.com/${collection.repo.owner}/${collection.repo.name}` : undefined,
      programmingLanguage: collection.stats?.language ?? undefined,
      author: { "@type": "Person", name: "Yehuda Briskman", url: SITE_URL },
    },
  });
});

/* Anything else under /he is not a page: the same 404 an unknown English
   address gets from nginx, with a head that says so. */
router.get(
  "/render/he/*",
  asyncHandler((req, res) => notFound(res, req.path.replace(/^\/render\/he/, "") || "/", "he")),
);

export default router;
