import { Router, type Request, type Response } from "express";
import { couch } from "../db/couch.js";
import { env } from "../env.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { escapeXml as escapeHtml } from "../services/escape.js";
import { HEBREW_CARDS, isOgFormat, renderCardPng, type OgFormat } from "../services/og.js";
import { loadSiteReleases } from "../services/activity.js";
import {
  LOG_CHANNEL,
  absoluteUrl,
  areaChannel,
  buildFeed,
  buildRobots,
  buildSitemap,
  clampDescription,
  fetchShell,
  metaLines as headTags,
  markdownToFallbackHtml,
  pathIn,
  renderShellWithMeta,
  type Lang,
  type PageMeta,
} from "../services/seo.js";
import { SEO_WORDS } from "../services/seo-words.js";
import { linkablePosts, neighbours, newestFirst, relatedPosts } from "../services/seo-links.js";
import { PERSON_ID, WEBSITE_ID, personNode, personRef, siteNameIn, websiteNode, withHebrewName } from "../services/seo-entity.js";
import { areaHasHebrew, postHasHebrew, projectHasHebrew } from "../services/seo-translation.js";
import { breadcrumbs, fitTitle, graph, homeGraph, itemList, webPage } from "../services/seo-template.js";
import { rawImageUrlOrNull, type Collection, type Post } from "../schemas/content.js";
import type { ContentBundle } from "../schemas/site-content.js";
import { publishedBundleOrSeed } from "../services/site-content.js";
import { sectionVisible, type SiteSettings } from "../schemas/site-settings.js";
import { settingsOrDefault } from "../services/site-settings.js";

const router = Router();

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
    const [posts, collections, store] = await Promise.all([publishedPosts(), publishedCollections(), storeProjects()]);
    res.type("application/xml").set("Cache-Control", "public, max-age=600");
    const live = new Map(collections.map((c) => [c.slug, c]));
    res.send(
      buildSitemap(posts, collections, {
        projects: [...store.values()].map((p) => ({ slug: p.slug, hebrew: projectHasHebrew(p, live.get(p.slug)) })),
        postHebrew: postHasHebrew,
        areaHebrew: areaHasHebrew,
      }),
    );
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

/*
 * The IndexNow key file (#308), served at `/<key>.txt` by nginx: the engines
 * fetch it to check that a ping came from the site. Only the configured key
 * answers; any other name is a 404, so this is no oracle for guessing it.
 */
router.get("/indexnow/:file", (req, res) => {
  const key = env.INDEXNOW_KEY;
  if (!key || req.params.file !== `${key}.txt`) {
    res.status(404).type("text/plain").send("Not Found");
    return;
  }
  res.type("text/plain").set("Cache-Control", "public, max-age=86400").send(key);
});

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

/** "4 דקות קריאה", with the Hebrew singular and dual. */
function hebrewMinutes(n: number): string {
  return n === 1 ? "דקת קריאה אחת" : n === 2 ? "שתי דקות קריאה" : `${n} דקות קריאה`;
}

/** Slugs and release tags only: no path separators, no leading dot. */
const OG_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/**
 * Per-post, per-project and per-release cards, rendered on demand and cached in
 * process. `?format=og|square|story` picks the size (default og, the one the
 * link previews use). `?lang=he` draws the card in Hebrew, right to left, using
 * the title the owner translated and falling back to the English one.
 */
router.get(
  "/og/:kind/:file",
  asyncHandler(async (req, res) => {
    const rawFormat = req.query.format;
    if (rawFormat !== undefined && !isOgFormat(rawFormat)) {
      return res.status(400).json({ ok: false, error: "format must be one of og, square, story" });
    }
    const format: OgFormat = rawFormat ?? "og";
    const rawLang = req.query.lang;
    if (rawLang !== undefined && rawLang !== "en" && rawLang !== "he") {
      return res.status(400).json({ ok: false, error: "lang must be en or he" });
    }
    const he = rawLang === "he" && HEBREW_CARDS;
    const lang = he ? ({ lang: "he" } as const) : {};

    const slug = req.params.file.replace(/\.png$/i, "");
    const kind = req.params.kind;
    if (!OG_FILE.test(slug)) return res.status(404).json({ ok: false, error: "Not Found" });

    if (kind === "blog") {
      const { docs } = await couch.find<Post>({
        selector: { type: "post", status: "published", slug },
        limit: 1,
      });
      const post = docs[0];
      if (!post) return res.status(404).json({ ok: false, error: "Not Found" });
      return sendPng(
        res,
        renderCardPng(
          {
            eyebrow: post.collection === "site" ? (he ? "הערה" : "Note") : post.collection.replace(/-/g, " "),
            title: (he && post.he?.title?.trim()) || post.title,
            meta: `yehudabriskman.com · ${he ? hebrewMinutes(post.readingMinutes) : `${post.readingMinutes} min read`}`,
            ...lang,
          },
          format,
        ),
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
        renderCardPng(
          {
            eyebrow: he ? "פרויקט" : "Project",
            title: (he && collection?.he?.title?.trim()) || title,
            meta: `yehudabriskman.com/projects/${slug}`,
            ...lang,
          },
          format,
        ),
      );
    }

    if (kind === "release") {
      // Only a tag the releases feed already stored gets a card, so the
      // endpoint cannot be used to render arbitrary text.
      const releases = await loadSiteReleases();
      const release = releases?.items.find((r) => r.tag === slug);
      if (!releases || !release) return res.status(404).json({ ok: false, error: "Not Found" });
      const date = Number.isNaN(Date.parse(release.publishedAt)) ? "" : ` · ${release.publishedAt.slice(0, 10)}`;
      return sendPng(
        res,
        renderCardPng(
          { eyebrow: he ? "גרסה" : "Release", title: `${releases.repo.name} ${release.tag}`, meta: `yehudabriskman.com${date}`, ...lang },
          format,
        ),
      );
    }

    return res.status(404).json({ ok: false, error: "Not Found" });
  }),
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

/* The home page is the one whose Hebrew twin has no path suffix: /render/he. */
const HOME_ROUTE = "/home";

function page(path: string, render: Render): void {
  const he = path === HOME_ROUTE ? "" : path;
  router.get(`/render${path}`, asyncHandler((req, res) => render(req, res, "en")));
  router.get(`/render/he${he}`, asyncHandler((req, res) => render(req, res, "he")));
  /* The same page, head only, for the app after a client-side navigation
     (#308): `sendShell` answers JSON when `headOnly` is set. */
  const headOnly = (lang: Lang) => (req: Request, res: Response) => {
    res.locals.headOnly = true;
    return render(req, res, lang);
  };
  router.get(`/head${path}`, asyncHandler(headOnly("en")));
  router.get(`/head/he${he}`, asyncHandler(headOnly("he")));
}

type Text = { en: string; he?: string };

/** A store text in a language, escaped, and marked when it fell back to English. */
function tx(t: Text, lang: Lang): string {
  if (lang === "he" && t.he) return escapeHtml(t.he);
  return lang === "he" ? `<span lang="en" dir="ltr">${escapeHtml(t.en)}</span>` : escapeHtml(t.en);
}

/**
 * A string from the store that may be English on a Hebrew page: a post
 * title, an area's name. Marked `lang="en"` there unless it carries Hebrew,
 * which it does once `local()` has put the owner's translation in its place.
 */
function en(s: string, lang: Lang): string {
  return lang === "he" && !HEBREW.test(s) ? `<span lang="en" dir="ltr">${escapeHtml(s)}</span>` : escapeHtml(s);
}

const HEBREW = /[\u0590-\u05FF]/;

/**
 * A post or an area in the page's language (#248): each field the owner has
 * translated replaces the English one, and each one left empty stays English.
 */
function local<T extends { he?: Record<string, string | null | undefined> | null }>(doc: T, lang: Lang): T {
  if (lang !== "he" || !doc.he) return doc;
  const out: Record<string, unknown> = { ...doc };
  for (const [k, v] of Object.entries(doc.he)) if (typeof v === "string" && v.trim() !== "") out[k] = v;
  return out as T;
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
function homeHtml(
  c: ContentBundle,
  lang: Lang,
  settings: SiteSettings,
  links: { notes: Post[]; projects: ProjectView[] } = { notes: [], projects: [] },
): string {
  const w = SEO_WORDS[lang];
  const s = c.siteCopy;
  const para = (lines: Text[]) => `<p>${lines.map((l) => tx(l, lang)).join(" ")}</p>`;
  const work = s.footer.work
    .map((w) => `<li><a href="${escapeHtml(w.url)}">${tx(w.label, lang)}, ${tx(w.note, lang)}</a></li>`)
    .join("");
  const profiles = s.profiles
    .map((p) => `<li><a href="${escapeHtml(p.url)}">${en(p.label, lang)}</a></li>`)
    .join("");
  /*
   * The sections that carry crawler copy, in the owner's order, and only the
   * ones shown (#254): a section hidden on the page is not served to a
   * crawler either. The home page's other sections are the work, figures and
   * notes the app draws from other documents; "Elsewhere" links the first
   * and the last of those, and drops a link whose section is hidden.
   */
  const blocks: Partial<Record<SiteSettings["home"]["sections"][number]["id"], string>> = {
    approach: `${s.about.intro.map((x) => para(x.lines)).join("")}<h2>${tx(s.about.heading, lang)}</h2>${s.about.principles
      .map((p) => `<h3>${tx(p.claim, lang)}</h3>${para(p.lines)}`)
      .join("")}`,
    contact: `<p>${escapeHtml(w.basedIn(plain(s.contact.location, lang)))} ${tx(s.contact.availability, lang)}.</p>`,
  };
  const ordered = settings.home.sections
    .filter((x) => x.visible && blocks[x.id] !== undefined)
    .map((x) => blocks[x.id])
    .join("");
  const elsewhere = [
    sectionVisible(settings, "work") ? `<li><a href="${href("/projects", lang)}">${escapeHtml(w.homeProjects)}</a></li>` : "",
    sectionVisible(settings, "notes") ? `<li><a href="${href("/blog", lang)}">${escapeHtml(w.homeNotes)}</a></li>` : "",
  ].join("");
  /* The plate as the app draws it (Hero.tsx): the owner's name as the H1 (the
     stored `hero.title` is not the heading: an older store still says
     "Portfolio"), then the fact line that says what he does, with the Hebrew
     spelling beside the Latin on a Hebrew page (#308). A crawler and a reader
     get one outline. */
  const fact = withHebrewName(plain(s.hero.fact, lang), lang);
  /* Real links to the newest notes and to every project, so the home page's
     HTML leads a crawler to them without running the app. */
  const latest = links.notes.length
    ? `<h2>${escapeHtml(w.latestNotes)}</h2><ul>${links.notes
        .map((p) => `<li><a href="${href(`/blog/${p.slug}`, lang)}">${en(p.title, lang)}</a></li>`)
        .join("")}</ul>`
    : "";
  const projectLinks = links.projects.length
    ? `<h2>${escapeHtml(w.allProjects)}</h2><ul>${links.projects
        .map((p) => `<li><a href="${href(`/projects/${p.slug}`, lang)}">${en(p.title, lang)}</a></li>`)
        .join("")}</ul>`
    : "";
  return `<main><h1>${en(s.hero.name, lang)}</h1><p>${en(fact, lang)}</p>${ordered}${latest}${projectLinks}<h2>${escapeHtml(w.elsewhere)}</h2><ul>${elsewhere}${work}${profiles}</ul></main>`;
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

async function sendShell(res: Response, meta: PageMeta, status = 200): Promise<void> {
  /*
   * The head alone, for the app (#308): after a client-side navigation the
   * app asks /api/seo/head/<path> for the tags this function would have
   * written, and swaps them in (web/src/components/HeadSync.tsx). One
   * function decides a page's head, whichever way the reader arrived.
   */
  if (res.locals.headOnly) {
    res
      .status(status)
      .set("Cache-Control", status >= 400 ? "no-store" : "public, max-age=60")
      .json({ ok: status < 400, lang: meta.lang ?? "en", title: meta.title, head: headTags(meta) });
    return;
  }
  const [shell, settings] = await Promise.all([fetchShell(), meta.visuals ? null : settingsOrDefault()]);
  /* Every render carries the visual settings (#254), so a reader's first
     frame is in the owner's theme default and accent on any public route. */
  if (settings) meta = { ...meta, visuals: settings.visuals };
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

/** `Name · Yehuda Briskman`, or `Name · יהודה בריסקמן` on a Hebrew page (#308). */
const title = fitTitle;

function notFound(res: Response, path: string, lang: Lang): Promise<void> {
  const w = SEO_WORDS[lang];
  return sendShell(
    res,
    {
      title: title(w.notFound, lang),
      description: w.notFoundDescription,
      lang,
      canonical: absoluteUrl(pathIn(path, lang)),
      image: absoluteUrl("/og.png"),
      imageAlt: siteNameIn(lang),
      type: "website",
      noindex: true,
    },
    404,
  );
}

/*
 * The portrait, which is the home page's LCP element on a phone. Only React
 * puts it in the DOM, so the browser found it 2.4 s after the HTML (the
 * audit, docs/seo/audit.md); preloaded from the head with the same srcset
 * and sizes as Hero.tsx, it starts with the HTML.
 */
const PORTRAIT_PRELOAD = {
  href: "/img/yehuda-cut.webp",
  srcset: "/img/yehuda-cut-sm.webp 365w, /img/yehuda-cut.webp 551w",
  sizes: "(max-width: 699px) min(92vw, 22rem), min(86vw, 26rem)",
};

page(HOME_ROUTE, async (_req, res, lang) => {
  const w = SEO_WORDS[lang];
  const [content, settings, posts, projects] = await Promise.all([
    publishedBundleOrSeed(),
    settingsOrDefault(),
    // The links are an addition: a store hiccup costs the home page its link
    // lists, not its page.
    publishedPosts().catch((): Post[] => []),
    projectViews(lang).catch((): ProjectView[] => []),
  ]);
  const notes = linkablePosts(posts, lang)
    .sort(newestFirst)
    .slice(0, 6)
    .map((p) => local(p, lang));
  await sendShell(res, {
    ...at("/", lang),
    visuals: settings.visuals,
    title: w.siteTitle,
    description: w.siteDescription,
    socialDescription: w.siteSocial,
    image: absoluteUrl("/og.png"),
    imageAlt: `${siteNameIn(lang)}, ${w.role}`,
    type: "website",
    preloadImage: PORTRAIT_PRELOAD,
    bodyHtml: homeHtml(content, lang, settings, {
      notes: sectionVisible(settings, "notes") ? notes : [],
      projects: sectionVisible(settings, "work") ? projects.filter((v) => lang === "en" || projectHasHebrew(v.entry, v.collection)) : [],
    }),
    jsonLd: homeGraph(lang, content),
  });
});

page("/blog", async (_req, res, lang) => {
  const w = SEO_WORDS[lang];
  const posts = (await publishedPosts())
    .map((p) => local(p, lang))
    .filter((p) => !p.seo.noindex)
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  await sendShell(res, {
    ...at("/blog", lang),
    route: "Blog",
    title: title(w.blogs, lang),
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
      .map((p) => `<li><a href="${href(`/blog/${p.slug}`, lang)}">${en(p.title, lang)}</a> — ${en(p.excerpt, lang)}</li>`)
      .join("")}</ul></main>`,
    jsonLd: graph(
      webPage("CollectionPage", lang, "/blog", {
        name: w.blogs,
        description: w.blogsDescription,
        about: true,
        mainEntity: itemList(lang, posts.map((p) => ({ name: p.title, path: `/blog/${p.slug}` }))),
      }),
      breadcrumbs(lang, [{ name: w.blogs, path: "/blog" }]),
    ),
  });
});

/** A project as the app shows it: the store's entry, with any published area over it. */
type ProjectView = {
  slug: string;
  title: string;
  /** The one line under the title: the area's tagline, or the entry's fact. */
  line: string;
  description: string;
  entry: ContentBundle["projects"]["items"][number] | null;
  collection: Collection | null;
};

async function projectViews(lang: Lang): Promise<ProjectView[]> {
  const live = (await publishedCollections()).filter((c) => c.kind === "project").map((c) => local(c, lang));
  const store = [...(await storeProjects()).values()].sort((a, b) => a.order - b.order);
  const views = new Map<string, ProjectView>(
    store.map((p) => [
      p.slug,
      { slug: p.slug, title: p.title, line: plain(p.fact, lang), description: plain(p.description, lang), entry: p, collection: null },
    ]),
  );
  // A real collection wins over its seed; anything only seeded still appears.
  for (const c of live) {
    const prev = views.get(c.slug);
    views.set(c.slug, {
      slug: c.slug,
      title: c.title,
      line: c.tagline || prev?.line || c.description,
      description: c.description || prev?.description || "",
      entry: prev?.entry ?? null,
      collection: c,
    });
  }
  return [...views.values()];
}

page("/projects", async (_req, res, lang) => {
  const w = SEO_WORDS[lang];
  const views = await projectViews(lang);
  await sendShell(res, {
    ...at("/projects", lang),
    route: "Projects",
    title: title(w.work, lang),
    description: w.workDescription,
    image: absoluteUrl("/og-projects.png"),
    imageAlt: w.projectsAlt,
    type: "website",
    bodyHtml: `<main><h1>${escapeHtml(w.work)}</h1><p>${escapeHtml(w.workDescription)}</p><ul>${views
      .map((v) => `<li><a href="${href(`/projects/${v.slug}`, lang)}">${en(v.title, lang)}</a> — ${en(v.line, lang)}</li>`)
      .join("")}</ul></main>`,
    jsonLd: graph(
      webPage("CollectionPage", lang, "/projects", {
        name: w.work,
        description: w.workDescription,
        about: true,
        mainEntity: itemList(lang, views.map((v) => ({ name: v.title, path: `/projects/${v.slug}` }))),
      }),
      breadcrumbs(lang, [{ name: w.work, path: "/projects" }]),
    ),
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
    title: title(w.journey, lang),
    description: w.journeyDescription,
    image: absoluteUrl("/og.png"),
    imageAlt: `${siteNameIn(lang)}, ${w.role}`,
    type: "website",
    bodyHtml: `<main><p>${escapeHtml(w.journey)}</p><h1>${escapeHtml(w.journeyTitle)}</h1><p>${escapeHtml(w.journeyDescription)}</p><ol>${beats}</ol><p><a href="${href("/projects", lang)}">${escapeHtml(w.work)}</a> · <a href="${href("/blog", lang)}">${escapeHtml(w.blogs)}</a></p></main>`,
    jsonLd: graph(
      webPage("ProfilePage", lang, "/story", {
        name: title(w.journey, lang),
        description: w.journeyDescription,
        about: true,
        mainEntity: { "@id": PERSON_ID },
      }),
      personNode(lang, c),
      websiteNode(lang),
      breadcrumbs(lang, [{ name: w.journey, path: "/story" }]),
    ),
  });
});

page("/accessibility", async (_req, res, lang) => {
  const w = SEO_WORDS[lang];
  await sendShell(res, {
    ...at("/accessibility", lang),
    route: "Accessibility",
    title: title(w.accessibility, lang),
    description: w.accessibilityDescription,
    image: absoluteUrl("/og.png"),
    imageAlt: siteNameIn(lang),
    type: "website",
    bodyHtml:
      `<main><p>${escapeHtml(w.statement)}</p><h1>${escapeHtml(w.accessibility)}</h1>` +
      w.accessibilityBody.map((p) => `<p>${escapeHtml(p)}</p>`).join("") +
      `<p><a href="${href("/", lang)}">${escapeHtml(w.home)}</a></p></main>`,
    jsonLd: graph(
      webPage("WebPage", lang, "/accessibility", { name: w.accessibility, description: w.accessibilityDescription }),
      breadcrumbs(lang, [{ name: w.accessibility, path: "/accessibility" }]),
    ),
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
    title: title(w.mcp, lang),
    description: w.mcpDescription,
    image: absoluteUrl("/og.png"),
    imageAlt: siteNameIn(lang),
    type: "website",
    bodyHtml:
      `<main><p>${escapeHtml(w.developers)}</p><h1>${escapeHtml(w.mcp)}</h1><p>${escapeHtml(w.mcpDescription)}</p>` +
      `<p>${escapeHtml(w.mcpPublic)}</p>` +
      `<p>${escapeHtml(w.mcpCode)}: ${code(`claude mcp add --transport http yehuda-public ${url}/public`)}</p>` +
      `<p>${escapeHtml(w.mcpConnector)} ${code(`${url}/public`)}.</p>` +
      `<p>${escapeHtml(w.mcpOwner)}</p>` +
      `<p>${escapeHtml(w.mcpCode)}: ${code(`claude mcp add --transport http yehuda ${url}`)}</p>` +
      `<p><a href="${href("/", lang)}">${escapeHtml(w.home)}</a> · <a href="${href("/blog", lang)}">${escapeHtml(w.blogs)}</a></p></main>`,
    jsonLd: graph(
      webPage("WebPage", lang, "/developers/mcp", { name: w.mcp, description: w.mcpDescription }),
      breadcrumbs(lang, [{ name: w.mcp, path: "/developers/mcp" }]),
    ),
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
    title: title(w.log, lang),
    description: w.logDescription,
    image: absoluteUrl("/og-blog.png"),
    imageAlt: w.notesAlt,
    type: "website",
    feeds: [{ title: LOG_CHANNEL.title, href: LOG_CHANNEL.self }],
    bodyHtml: `<main><h1>${escapeHtml(w.log)}</h1><p>${escapeHtml(w.logBody)}</p><p><a href="${href("/blog", lang)}">${escapeHtml(w.blogs)}</a> · <a href="${escapeHtml(LOG_CHANNEL.self)}">RSS</a></p></main>`,
    jsonLd: graph(
      webPage("CollectionPage", lang, "/blog/log", { name: w.log, description: w.logDescription }),
      breadcrumbs(lang, [
        { name: w.blogs, path: "/blog" },
        { name: w.log, path: "/blog/log" },
      ]),
    ),
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

/**
 * An area's name in a title: "WindoM · Notes", so it is not the project
 * page's title too; and just "Notes" for the area that is called that,
 * rather than "Notes · Notes". BlogArea.tsx titles the tab the same way.
 */
export function areaTitleName(areaTitle: string, notesWord: string): string {
  return areaTitle.trim().toLowerCase() === notesWord.toLowerCase() ? areaTitle : `${areaTitle} · ${notesWord}`;
}

page("/blog/area/:slug", async (req, res, lang) => {
  const w = SEO_WORDS[lang];
  const slug = String(req.params.slug);
  const found = AREA_SLUG.test(slug)
    ? (
        await couch.find<Collection>({
          selector: { type: "collection", status: "published", slug },
          limit: 1,
        })
      ).docs.find((c) => c.slug === slug && c.status === "published")
    : undefined;
  const area = found && local(found, lang);

  if (!area) return notFound(res, `/blog/area/${encodeURIComponent(slug)}`, lang);

  const { docs } = await couch.find<Post>({
    selector: { type: "post", status: "published", collection: slug },
    limit: 500,
  });
  // Filtered again, as the area's feed does: a draft never reaches the head
  // or the body even if the selector above is ever loosened.
  const posts = docs
    .map((p) => local(p, lang))
    .filter((p) => p.status === "published" && p.collection === slug && !p.seo.noindex)
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const channel = areaChannel(area);
  const own = area.tagline || area.description;
  const description = clampDescription(
    own && own.length < 70 && area.description && area.description !== own ? `${own}. ${area.description}` : own || w.notesOn(area.title),
  );
  const image =
    rawImageUrlOrNull(area.coverImage) ??
    (area.kind === "project" ? absoluteUrl(`/api/seo/og/projects/${area.slug}.png`) : absoluteUrl("/og-blog.png"));
  const name = areaTitleName(area.title, w.notes);

  await sendShell(res, {
    ...at(`/blog/area/${area.slug}`, lang),
    translated: areaHasHebrew(found),
    route: "BlogArea",
    title: title(name, lang),
    description,
    image,
    imageAlt: area.title,
    type: "website",
    feeds: [{ title: channel.title, href: channel.self }],
    bodyHtml: `<main><h1>${en(area.title, lang)}</h1><p>${own ? en(description, lang) : escapeHtml(description)}</p><ul>${posts
      .map((p) => `<li><a href="${href(`/blog/${p.slug}`, lang)}">${en(p.title, lang)}</a> — ${en(p.excerpt, lang)}</li>`)
      .join("")}</ul><p><a href="${href("/blog", lang)}">${escapeHtml(w.blogs)}</a> · <a href="${escapeHtml(channel.self)}">RSS</a></p></main>`,
    jsonLd: graph(
      webPage("CollectionPage", lang, `/blog/area/${area.slug}`, {
        name,
        description,
        mainEntity: itemList(lang, posts.map((p) => ({ name: p.title, path: `/blog/${p.slug}` }))),
      }),
      breadcrumbs(lang, [
        { name: w.blogs, path: "/blog" },
        { name: area.title, path: `/blog/area/${area.slug}` },
      ]),
    ),
  });
});

/** Home > Blogs > this note, as visible links; the JSON-LD says the same trail. */
function breadcrumbHtml(current: string, lang: Lang): string {
  const w = SEO_WORDS[lang];
  return `<nav aria-label="${escapeHtml(w.breadcrumb)}"><ol><li><a href="${href("/", lang)}">${escapeHtml(w.home)}</a></li><li><a href="${href("/blog", lang)}">${escapeHtml(w.blogs)}</a></li><li aria-current="page">${en(current, lang)}</li></ol></nav>`;
}

/**
 * The links a note's page carries for a crawler: its area, neighbours in time,
 * related notes and the other language. Tags are text, never links: a tag's
 * page is a filtered view of /blog, which is not a page to index. Hebrew is
 * linked from English only where the note has published Hebrew.
 */
function noteLinksHtml(post: Post, all: Post[], area: Collection | null, lang: Lang, translated: boolean): string {
  const w = SEO_WORDS[lang];
  const link = (p: Post) => `<a href="${href(`/blog/${p.slug}`, lang)}">${en(p.title, lang)}</a>`;
  const { prev, next } = neighbours(post, all);
  const related = relatedPosts(post, all, 5);
  const other: Lang = lang === "en" ? "he" : "en";
  const parts: string[] = [];
  if (post.tags.length) parts.push(`<p>${escapeHtml(w.tagged)}: ${post.tags.map((t) => escapeHtml(t)).join(", ")}</p>`);
  if (area) parts.push(`<p>${escapeHtml(w.areaLabel)}: <a href="${href(`/blog/area/${area.slug}`, lang)}">${en(area.title, lang)}</a></p>`);
  if (prev || next) {
    parts.push(
      `<nav aria-label="${escapeHtml(w.notes)}"><ul>${prev ? `<li>${escapeHtml(w.previousNote)}: ${link(prev)}</li>` : ""}${next ? `<li>${escapeHtml(w.nextNote)}: ${link(next)}</li>` : ""}</ul></nav>`,
    );
  }
  if (related.length) parts.push(`<h2>${escapeHtml(w.relatedNotes)}</h2><ul>${related.map((p) => `<li>${link(p)}</li>`).join("")}</ul>`);
  if (lang === "he" || translated) {
    parts.push(`<p><a href="${href(`/blog/${post.slug}`, other)}" hreflang="${other}" lang="${other}">${escapeHtml(w.otherLanguage)}</a></p>`);
  }
  return parts.join("");
}

page("/blog/:slug", async (req, res, lang) => {
  const w = SEO_WORDS[lang];
  const slug = String(req.params.slug);
  const { docs } = await couch.find<Post>({
    selector: { type: "post", status: "published", slug },
    limit: 1,
  });
  const english = docs[0];
  const post = english && local(english, lang);
  /* Whether the reader gets the English body on a Hebrew page: then it is
     marked as English and said to be. */
  const bodyInEnglish = lang === "he" && !HEBREW.test(post?.body ?? "");
  /* Whether this note has published Hebrew at all (#304): without it, the
     Hebrew page is noindex and neither page names the other. */
  const translated = english ? postHasHebrew(english) : false;

  // A missing post has to answer 404, not 200 with a "not found" body —
  // otherwise every bad URL becomes an indexable soft-404 duplicate.
  if (!post) return notFound(res, `/blog/${slug}`, lang);

  /* A post's own canonical, when it sets one, is the English page's; the
     Hebrew page is its own address, with the English as its alternate. */
  const canonical =
    lang === "en" ? (post.seo.canonical ?? absoluteUrl(`/blog/${post.slug}`)) : absoluteUrl(pathIn(`/blog/${post.slug}`, lang));
  const image = rawImageUrlOrNull(post.coverImage) ?? absoluteUrl(`/api/seo/og/blog/${post.slug}.png`);
  const marker = bodyInEnglish ? `<p>${escapeHtml(w.writtenInEnglish)}</p>` : "";
  const description = clampDescription(post.seo.description ?? post.excerpt);
  const [allPosts, areaDoc] = await Promise.all([
    publishedPosts(),
    AREA_SLUG.test(post.collection)
      ? couch.find<Collection>({ selector: { type: "collection", status: "published", slug: post.collection }, limit: 1 })
      : Promise.resolve({ docs: [] as Collection[] }),
  ]);
  const area = areaDoc.docs.find((c) => c.slug === post.collection && c.status === "published");
  const linkable = linkablePosts(allPosts, lang).map((p) => local(p, lang));
  const noteLinks = noteLinksHtml(post, linkable, area && (lang === "en" || areaHasHebrew(area)) ? local(area, lang) : null, lang, translated);
  const inLanguage = bodyInEnglish || lang === "en" || !translated ? "en" : "he";

  await sendShell(res, {
    ...at(`/blog/${post.slug}`, lang),
    canonical,
    translated,
    route: "BlogPost",
    title: post.seo.title ?? title(post.title, lang),
    description,
    image,
    imageAlt: post.title,
    type: "article",
    publishedAt: post.publishedAt,
    modifiedAt: post.updatedAt,
    tags: post.tags,
    noindex: post.seo.noindex,
    bodyHtml: `<main>${marker}${breadcrumbHtml(post.title, lang)}<article${bodyInEnglish ? ' lang="en" dir="ltr"' : ""}><h1>${en(post.title, lang)}</h1>${
      post.subtitle ? `<p>${en(post.subtitle, lang)}</p>` : ""
    }<p>${en(post.excerpt, lang)}</p>${markdownToFallbackHtml(post.body)}</article>${noteLinks}</main>`,
    jsonLd: graph(
      {
        "@type": "BlogPosting",
        "@id": `${canonical}#post`,
        headline: post.title,
        description,
        image,
        url: canonical,
        inLanguage,
        datePublished: post.publishedAt ?? post.createdAt,
        dateModified: post.updatedAt,
        author: personRef,
        publisher: personRef,
        isPartOf: { "@id": WEBSITE_ID },
        mainEntityOfPage: { "@type": "WebPage", "@id": canonical, breadcrumb: { "@id": `${absoluteUrl(pathIn(`/blog/${post.slug}`, lang))}#breadcrumb` } },
        keywords: post.tags.join(", ") || undefined,
        wordCount: post.body.trim() ? post.body.trim().split(/\s+/).length : 0,
        timeRequired: post.readingMinutes ? `PT${post.readingMinutes}M` : undefined,
      },
      breadcrumbs(lang, [
        { name: w.blogs, path: "/blog" },
        { name: post.title, path: `/blog/${post.slug}` },
      ]),
    ),
  });
});

/** A project's page body, as Project.tsx lays it out, from the same store. */
function projectHtml(v: ProjectView, others: ProjectView[], lang: Lang): string {
  const w = SEO_WORDS[lang];
  const e = v.entry;
  const parts: string[] = [`<h1>${en(v.title, lang)}</h1>`];
  if (v.line) parts.push(`<p>${en(v.line, lang)}</p>`);
  if (v.description) parts.push(`<p>${en(v.description, lang)}</p>`);
  if (e) {
    for (const t of [e.problem, e.role, e.outcome]) if (t) parts.push(`<p>${tx(t, lang)}</p>`);
    if (e.highlights.length) parts.push(`<h2>${escapeHtml(w.worthKnowing)}</h2><ul>${e.highlights.map((h) => `<li>${tx(h, lang)}</li>`).join("")}</ul>`);
    if (e.decisions.length)
      parts.push(`<h2>${escapeHtml(w.decisions)}</h2>${e.decisions.map((d) => `<h3>${tx(d.title, lang)}</h3><p>${tx(d.body, lang)}</p>`).join("")}`);
    if (e.tech.length) parts.push(`<h2>${escapeHtml(w.builtWith)}</h2><ul>${e.tech.map((t) => `<li>${en(t, lang)}</li>`).join("")}</ul>`);
    const links: { label: Text; url: string }[] = [
      ...(e.link ? [{ label: { en: e.linkLabel ?? e.link }, url: e.link }] : []),
      ...e.links,
      ...(e.github ? [{ label: { en: "GitHub" }, url: e.github }] : []),
    ];
    if (links.length) parts.push(`<ul>${links.map((l) => `<li><a href="${escapeHtml(l.url)}">${tx(l.label, lang)}</a></li>`).join("")}</ul>`);
  }
  if (others.length) {
    parts.push(
      `<h2>${escapeHtml(w.elsewhere)}</h2><ul>${others
        .map((o) => `<li><a href="${href(`/projects/${o.slug}`, lang)}">${en(o.title, lang)}</a> — ${en(o.line, lang)}</li>`)
        .join("")}</ul>`,
    );
  }
  parts.push(`<p><a href="${href("/projects", lang)}">${escapeHtml(w.allProjects)}</a> · <a href="${href("/blog", lang)}">${escapeHtml(w.notes)}</a></p>`);
  return `<main>${parts.join("")}</main>`;
}

page("/projects/:slug", async (req, res, lang) => {
  const w = SEO_WORDS[lang];
  const slug = String(req.params.slug);
  const views = await projectViews(lang);
  const v = views.find((x) => x.slug === slug);
  if (!v) return notFound(res, `/projects/${slug}`, lang);

  const canonical = absoluteUrl(pathIn(`/projects/${v.slug}`, lang));
  /* The one line alone was 33 to 58 characters, too short to be a snippet;
     the description after it says what the thing does. */
  const description = clampDescription([v.line, v.description].filter(Boolean).join(". ").replace(/\.\./g, ".") || w.workDescription);
  const repo = v.collection?.repo
    ? `https://github.com/${v.collection.repo.owner}/${v.collection.repo.name}`
    : (v.entry?.github ?? undefined);
  const image = rawImageUrlOrNull(v.collection?.coverImage ?? null) ?? absoluteUrl(`/api/seo/og/projects/${v.slug}.png`);

  await sendShell(res, {
    ...at(`/projects/${v.slug}`, lang),
    translated: projectHasHebrew(v.entry, v.collection),
    route: "Project",
    title: title(v.title, lang),
    description,
    image,
    imageAlt: v.title,
    type: "website",
    bodyHtml: projectHtml(
      v,
      views.filter((o) => o.slug !== v.slug && (lang === "en" || projectHasHebrew(o.entry, o.collection))),
      lang,
    ),
    /* Source code when there is a repository to point at, a creative work
       when there is not: schema.org's SoftwareSourceCode is defined by its
       codeRepository. */
    jsonLd: graph(
      {
        "@type": repo ? "SoftwareSourceCode" : "CreativeWork",
        "@id": `${canonical}#project`,
        name: v.title,
        description,
        url: canonical,
        image,
        inLanguage: "en",
        ...(repo ? { codeRepository: repo, programmingLanguage: v.collection?.stats?.language ?? undefined } : {}),
        ...(v.entry?.year ? { dateCreated: v.entry.year } : {}),
        ...(v.entry?.tech.length ? { keywords: v.entry.tech.join(", ") } : {}),
        author: personRef,
        creator: personRef,
        isPartOf: { "@id": WEBSITE_ID },
        mainEntityOfPage: { "@type": "WebPage", "@id": canonical, breadcrumb: { "@id": `${canonical}#breadcrumb` } },
      },
      breadcrumbs(lang, [
        { name: w.work, path: "/projects" },
        { name: v.title, path: `/projects/${v.slug}` },
      ]),
    ),
  });
});

/* Anything else under /he is not a page: the same 404 an unknown English
   address gets from nginx, with a head that says so. */
router.get(
  "/render/he/*",
  asyncHandler((req, res) => notFound(res, req.path.replace(/^\/render\/he/, "") || "/", "he")),
);
router.get(
  "/head/he/*",
  asyncHandler((req, res) => {
    res.locals.headOnly = true;
    return notFound(res, req.path.replace(/^\/head\/he/, "") || "/", "he");
  }),
);
router.get(
  "/head/*",
  asyncHandler((req, res) => {
    res.locals.headOnly = true;
    return notFound(res, req.path.replace(/^\/head/, "") || "/", "en");
  }),
);

export default router;
