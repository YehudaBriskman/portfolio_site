# SEO audit

Issue: #308 (and #304) · Date: 2026-11-03 · Measured on `main` at `a65708c`

The site as a search engine reads it: every public route, in English and in
Hebrew, with its robots, canonical, hreflang, sitemap coverage, status, title
and description, structured data, heading outline, image alt text and link
depth; plus lab Core Web Vitals. The **before** numbers are below; each
follow-up PR in #308 moves one row, and the **after** column is filled in by
the last of them.

**After** was measured on 2026-11-04 the same way, on the head of the stack
(#315 to #319), with the same seed; raw summary in
[`audit-after.json`](audit-after.json). The two titles still over 60 are the
Hebrew home page, which carries both spellings of the name, and one post
title; the two short descriptions are Hebrew index pages. Lab vitals were
not re-measured: the portrait preload (#315) is the change aimed at the
home page's LCP load delay.

## How it was measured

- **Stack:** `main` built into its two images and run with Docker Compose,
  CouchDB seeded with `backend/scripts/seed-dev-content.mjs` (the 14 reviewed
  notes, 3 areas, and 4 fixture notes that production does not have), and
  `SITE_URL` set to the production origin so every canonical, hreflang and
  sitemap URL is the one production would print. Production itself still runs
  an older build with no `/he` site, so it is not the baseline.
- **Raw HTML pass** (`web/scripts/seo/audit.mjs`): what a crawler reads with no
  JavaScript. It starts at `robots.txt`, the sitemap, `/` and `/he`, follows
  every internal link and `hreflang` breadth first (so it knows each page's
  click depth), then fetches every sitemap URL and every route the app's router
  serves that no link reached. JSON-LD is checked against the schema.org
  vocabulary (release file reduced by `web/scripts/seo/vocab.mjs`): every
  `@type` must exist and every property must be one that type may carry.
  Raw summary: [`audit-before.json`](audit-before.json).
- **Rendered pass** (`rendered-links.mjs`, `rendered-head.mjs`): the links and
  the head once the app has run, on a hard load and after a client-side
  navigation, which is what Google's renderer sees on its second pass.
- **Lab vitals** (`lighthouse.sh`): Lighthouse 12.8, mobile with simulated
  throttling, against the local nginx (HTTP/1.1, gzip, no CDN). INP cannot be
  measured in the lab; Total Blocking Time is its proxy.

Re-running it:

```sh
cd web
node scripts/seo/vocab.mjs schemaorg-current-https.jsonld > /tmp/vocab.json
node scripts/seo/audit.mjs --base http://127.0.0.1:8080 --areas site,windom,bothy \
  --vocab /tmp/vocab.json --full > /tmp/audit.json
xvfb-run -a node scripts/seo/rendered-head.mjs --base http://127.0.0.1:8080 / /he /he/projects
scripts/seo/lighthouse.sh /tmp/lh http://127.0.0.1:8080
```

## Headline

| Measure | Before | After |
|---|---:|---:|
| Public pages found (en + he) | 64 | 64 |
| Answer 200 | 64 / 64 | 64 / 64 |
| Indexable (no `noindex`) | 64 | 39 (the 25 others are deliberate, see #304 below) |
| `/he` pages indexable with an English title and description (duplicate of the English page) | **22** | **0** |
| Indexable pages missing from the sitemap | **16** | **0** |
| Sitemap URLs that are not 200 or are `noindex` | 0 | 0 |
| Pages with exactly one title / description / canonical | 64 / 64 / 64 | 64 / 64 / 64 |
| Distinct titles / descriptions across 64 pages | 42 / 37 | 39 / 37 across the 39 indexable |
| Titles over 60 characters | 8 | 2 |
| Descriptions under 70 characters | 10 | 2 |
| Pages with no JSON-LD | **20** | **0** |
| JSON-LD nodes invalid against schema.org | 0 | 0 |
| JSON-LD types used | Person, PostalAddress, WebSite, ProfilePage (story), BlogPosting, WebPage, SoftwareSourceCode | adds CollectionPage, ItemList, ListItem, BreadcrumbList, CreativeWork, ImageObject |
| Pages with a `BreadcrumbList` | **0** | **62** (every page but the two home pages) |
| `Person` with `alternateName` / `image` / LinkedIn in `sameAs` (render) | no / no / no | yes / yes / yes |
| Pages where the Hebrew name (יהודה בריסקמן) appears | **0** | **7 of 7** indexable /he titles (28 of all 32 /he pages) |
| `og:` and `twitter:` sets complete | 64 / 64 | 64 / 64 |
| `og:locale` agrees with `<html lang>` | 64 / 64 (but see finding 1) | 64 / 64; a /he page in English says en_US |
| Head correct after a client-side navigation | **no** (description, canonical, `og:*` keep the first page's) | yes (HeadSync, from `/api/seo/head`) |
| Search-console verification tags | none | from env (`GOOGLE_`/`BING_SITE_VERIFICATION`), unset locally |
| IndexNow | none | on publish, when `INDEXNOW_KEY` is set |
| Feeds linked in `<head>` | every page (the shell's site feed), plus log and area feeds | unchanged |
| Max click depth, raw HTML / rendered | 2 / 2, but **14** routes reachable only by JavaScript links | unchanged (2 / 2; 14) |
| Images with no `alt` in server HTML | 0 | 0 |
| Pages with no H1 / more than one H1 / skipped heading levels | 0 / 0 / 0 | 0 / 0 / 0 |

### Lab Core Web Vitals (mobile, simulated throttling)

| Page | Perf | SEO | A11y | LCP | CLS | TBT | FCP |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` | 70 | 100 | 100 | 3.7 s | 0.021 | 550 ms | 2.9 s |
| `/he` | 69 | 100 | 100 | 3.8 s | 0 | 520 ms | 3.1 s |
| `/blog/windom-glass-as-optics` | 67 | 100 | 100 | 3.9 s | 0.017 | 580 ms | 3.2 s |
| `/he/blog/windom-glass-as-optics` | 66 | 100 | 100 | 4.0 s | 0.017 | 570 ms | 3.3 s |
| `/projects/windom` | 59 | 100 | 100 | 4.5 s | 0.024 | 770 ms | 3.3 s |
| `/he/projects/windom` | 70 | 100 | 100 | 4.2 s | 0.021 | 370 ms | 3.3 s |

CLS is good everywhere. LCP is "needs improvement" (2.5–4 s) or poor (> 4 s)
in the lab. On `/` the LCP element is the portrait, and its breakdown is TTFB
451 ms, **load delay 2,368 ms**, load 17 ms, render delay 879 ms: the image is
fine, it is discovered late, because only React puts it in the DOM. Lighthouse's
SEO category is 100 on every page, which says the basics are present and
nothing about the findings below.

## Findings, by priority

### P0: wrong signals to a search engine

1. **22 Hebrew pages are English duplicates** (#304). Every `/he/blog/<slug>`
   and `/he/projects/<slug>` is indexable, says `og:locale he_IL`, has an
   `hreflang` pair, is in the sitemap with a Hebrew alternate, and serves the
   English title, description and body. None of the 14 notes and none of the
   4 projects has published Hebrew. Design §5.4: `noindex, follow`, no
   hreflang, out of the sitemap, `og:locale en_US`, until Hebrew exists.

### P1: being found under the name

2. **The Hebrew name appears nowhere.** Not in a title, a description, the
   JSON-LD or the page; a search for "יהודה בריסקמן" has nothing on the site to
   match. `/he` titles end in the Latin name.
3. **The `Person` entity is thin.** The render's `Person` has no `@id`, no
   `alternateName`, no `image`, no `knowsAbout`, and `sameAs` lists GitHub only
   (the built shell's copy also lists windom.app; neither lists the LinkedIn
   profile the site links to). The home page has no `ProfilePage`, and
   `WebSite` has no `alternateName`. The job title says "Full-stack engineer
   and team lead"; the owner's role is technical team lead.
4. **The home page's H1 differs between the render and the app.** The render's
   H1 is "Yehuda Briskman, full-stack engineer and team lead"; the app's (and so
   Google's rendered DOM's) is "Portfolio", with the name in the fact line
   under it. The two must agree, and the stronger signal for a name search is
   the name in the H1. Changing the visible H1 is an owner decision (it was the
   owner's pick in #100), so this is a proposal in `docs/seo/keywords.md` (step 8),
   and meanwhile the render mirrors the app.
5. **16 indexable pages are not in the sitemap:** `/story`, `/accessibility`,
   `/blog/log`, the three area pages, and two of the four projects
   (`/projects/icaros`, `/projects/programming-with-yehuda`), each in both
   languages. The sitemap's project list is hard-coded to two seeds.
6. **14 routes are reachable only through JavaScript links:** the story, the
   accessibility statement, the log, the MCP page and the three areas, in both
   languages. Google's renderer finds them (rendered depth ≤ 2); a raw-HTML
   crawler and Bing's first pass do not. `/developers/mcp` is in the sitemap
   but has no inbound link in any server render.
7. **Structured data is missing on 20 pages and incomplete on the rest:** no
   JSON-LD on `/blog`, `/projects`, the log, the areas, the accessibility
   statement, the MCP page or the two unseeded projects; no `BreadcrumbList`
   anywhere; no `CollectionPage` for the indexes; `BlogPosting` has no `@id`
   link to the `Person`.

### P2: quality of what is shown

8. **The head goes stale after a client-side navigation.** The app only sets
   `document.title`; description, canonical, `og:*`, `twitter:*` and `robots`
   keep the first page's values. Navigating `/` → `/he/projects` leaves
   `canonical = /` and an English description on a Hebrew page. Crawlers
   hard-load each URL, so the indexed head is the server's; but the two must
   agree, and a script that runs on the page (Google's renderer included) sees
   whatever is in the DOM. The audit of English on the Hebrew site (#293, S044)
   recorded this as "index.html meta and OG are English on every /he route".
9. **Titles and descriptions:** 8 titles exceed 60 characters (long release
   note titles plus the suffix); 10 descriptions are under 70 characters (the
   project pages, from the one-line tagline); the site area is titled
   "Notes · Notes · Yehuda Briskman". English and Hebrew pages of untranslated
   items share titles and descriptions (that is finding 1 again).
10. **Thin raw HTML on project pages** (28 to 43 words): the render has the
    name, tagline and description only, while the app shows the project's
    problem, role, outcome and decisions from the same store.
11. **Lab LCP** 3.7–4.5 s; the home portrait is discovered 2.4 s late. A
    `<link rel="preload" as="image" imagesrcset=…>` in the home head lets the
    browser start it with the HTML.
12. **No search-console verification and no IndexNow.** New notes reach Bing
    and Yandex only when they next crawl.

### P3: housekeeping

13. **Feeds:** every page, Hebrew ones included, advertises the English site
    feed from the shell; there is no Hebrew feed yet (owner decision Q5: not
    yet).
14. **Share cards:** notes get a generated card; seeded projects get the generic
    `/og-projects.png`; Hebrew pages get English cards (S040; needs a Hebrew
    face in `og.ts`).
15. **The unrouted-path 404** (`/no-such-page`) is nginx's static shell, so its
    head says `index, follow` with `canonical = /`. The 404 status wins, so
    this is cosmetic.
16. `Person.url` is `https://yehudabriskman.com` without the slash the
    canonical has, and the nested `Person` repeats `@context` inside `@graph`.

### What is already right

`robots.txt` is correct and host-aware (closed on every host but production);
every page has exactly one title, description and canonical; missing notes,
areas and projects answer a real 404 with `noindex`; no accidental `noindex`;
JSON-LD that exists is valid; `og:` and `twitter:` sets are complete; every
image in server HTML has `alt`; heading outlines are clean; the sitemap already
has `lastmod` and `xhtml:link` alternates; feeds are linked in `<head>`.

## Plan (one PR each, #308)

| Step | Findings |
|---|---|
| Identity: `Person`, `ProfilePage`, `WebSite`, the Hebrew name | 2, 3, 4 |
| Per-route metadata from one template, breadcrumbs, collection pages, client head sync | 7, 8, 9, 10, 11, 14 (partly) |
| Discovery: complete sitemap, IndexNow, feeds | 5, 6, 12, 13 |
| Search consoles: verification tags | 12 |
| SEO by translation state (#304) | 1 |
| CI gates | keeps all of the above |
| Keywords and copy proposals (`docs/seo/keywords.md` (step 8)) | 4, 9 |
