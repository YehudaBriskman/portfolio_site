# English on the Hebrew site: audit

Issue #293 (part of #292). Run on `main` at `bcb4563`, which includes the
approved Hebrew copy review (#290) and the admin shell (#291). Companion
documents: [the Hebrew tech glossary](hebrew-tech-glossary.md) (#294) and
[the bilingual content design](bilingual-content-design.md) (#295).

Every English string a visitor (or the owner, in admin) meets under `/he`, where
it comes from, whether it is marked as English, and what should happen to it.
Machine-readable copy: [`english-on-hebrew-audit.json`](english-on-hebrew-audit.json).

## 1. Method

Three independent passes, then a hand review.

1. **Dynamic crawl** (`web/scripts/i18n-audit/crawl.mjs`). Playwright Chromium
   under `xvfb-run`, against a production build served with the real backend and
   a CouchDB seeded by `backend/scripts/seed-dev-content.mjs` (so the content is
   the seeded content, not production's; see §7). Routes: every public `/he`
   route (home, story, projects and its 4 project pages, blog, activity log, the
   3 areas, all 14 notes plus the rendering fixture, accessibility, the MCP
   page, 4 not-found routes) and every admin screen (10). Configurations:
   desktop light and phone dark, the full route set each; then an **API error**
   run (every `/api` call answered 503) and an **API loading** run (never
   answered) over 8 data-driven routes. Desktop dark and phone light were run
   once and produced no string the other two did not, so they were dropped from
   the final run. On each page the crawler opened every `aria-haspopup` /
   `aria-expanded` trigger (menus, share sheets, table of contents, theme menu),
   the note lightbox, and submitted the contact form empty and with a bad email.
   It records visible text by block, plus `aria-label`, `title`, `alt`,
   `placeholder`, `aria-description`, `aria-roledescription`, `aria-valuetext`,
   input values and the `<head>` tags, and whether each Latin run sits inside
   `lang="en"` **and** `dir="ltr"`.
2. **Server render** (`seo.mjs`). Every route through
   `/api/seo/render/he/*`: `<html lang dir>`, title, meta, Open Graph, Twitter,
   `hreflang`, JSON-LD strings and the pre-rendered body; plus every feed.
3. **Static scan** (73 rows, `S001`–`S073`). The source read for English that
   the crawl cannot reach: other branches of a ternary, error paths, OG images,
   feeds, MCP OAuth pages, emails, zod messages.
4. **Classification** (`classify.mjs`, `report.mjs`, `overrides.json`). Each
   string is traced to its origin: a field in an API response (content store,
   GitHub, settings), a string literal in `web/src` or `backend/src`
   (word table vs hard-coded), or a date/number format. Treatment is proposed
   from the glossary's `allowLatin` list, the brand list and the source, then
   reviewed by hand. The scripts are committed so the audit can be re-run
   after each translation PR.

**Treatments**: `translate` (UI or prose with a Hebrew equivalent),
`needs-he-field` (content with no Hebrew field to put a translation in yet),
`keep-latin` (brand, product, standard, code, tag slug, version: keep, but mark
`lang="en" dir="ltr"` or isolate), `transliterate` (only the owner's name, S018).
**Marked** is `true` when every Latin run is inside `lang="en"` + `dir="ltr"`,
`mixed` when some are, `n/a` for head tags and feeds.

Counting unit: one row per distinct string per kind (text vs each attribute),
with the routes it appears on. A note body is **one** row per note, not one per
paragraph. Admin rows are per string, which is why admin's count is large.

## 2. Headline numbers

**1,336 distinct strings** from the crawl and server render, plus 73 static rows
(which overlap them by design: the static rows group strings by cause).

| Source | Translate | Needs he field | Keep Latin | Total |
|---|---:|---:|---:|---:|
| Content store | 207 | 184 | 131* | 522 |
| Hard-coded (not in a word table) | 411 | 0 | 19 | 430 |
| SEO / server render / feeds | 38 | 172 | 51 | 261 |
| Word tables (Latin inside Hebrew) | 29 | 0 | 15 | 44 |
| GitHub | 0 | 0 | 8 | 8 |
| Settings | 0 | 3 | 0 | 3 |
| API error messages | 2 | 0 | 0 | 2 |
| Admin data (lists, counters) | 3 | 0 | 1 | 4 |
| Unattributed** | 47 | 0 | 15 | 62 |
| **Total** | **737** | **359** | **240** | **1,336** |

\* Tag slugs, profile names, tech names, versions and ids.
\*\* Strings whose literal is assembled at runtime (e.g. `Move ${title} up`)
or upper-cased by CSS, almost all in admin; the hand review assigned the
recurring patterns, the rest are listed as `unknown`.

By audience:

| Audience | Strings | Translate | Needs he field | Keep Latin | Unmarked | Mixed |
|---|---:|---:|---:|---:|---:|---:|
| Public pages | 621 | 177 | 265 | 179 | 290 | 22 |
| Developers (`/he/developers/mcp`) | 40 | 25 | 4 | 11 | 33 | 0 |
| Admin (`/he/admin/*`) | 675 | 535 | 90 | 50 | 604 | 40 |

Static pass (`S001`–`S073`): content store 24, hard-coded 25, API error 6,
SEO 6, word table 6, format 3, MCP 2, GitHub 1. Treatments: translate 31,
needs-he-field 17, keep-latin 15, mark-en 6, locale-format 3, transliterate 1.

**What the numbers say.** On public pages, the UI is already Hebrew: only 10
word-table rows and 29 hard-coded rows remain, and most of those are keep-Latin
(RSS, WCAG, Claude Code). What a Hebrew visitor reads in English is
**content** (325 rows) and the **server render** (238 rows). Only about one public string in five
(74 of 386, head tags aside) is fully marked as English; the unmarked ones are
overwhelmingly content values that render through components with no
`lang` hook (taglines, labels, footer notes, tags). Admin is a separate problem:
it is almost entirely English (S053–S066) and that is a scoping decision
(design Q1), not a bug.

**Not found**: no string names the owner's current employer, and nothing in the
content hints at a military or defence employer. The only employer-like strings
are generic role titles ("Technical team lead", "Full-stack engineer").

## 3. The ten most visible English strings on /he

Ranked by how many routes show them and where on the page they sit.

| # | String | Where | Source | Marked | Treatment | Rows |
|---|---|---|---|---|---|---|
| 1 | `Full-stack engineer and team lead in Tel Aviv…`, `Yehuda Briskman · Full-stack engineer & team lead`, `I ship products end to end…` | `<meta name=description>`, `og:title`, `og:description`, `twitter:image:alt` of **all 43 `/he` routes** in the client (from `web/index.html`, never replaced on /he) | SEO | n/a | translate | S044 |
| 2 | `No trackers. No cookie banner, because there are no cookies.`, `Tel Aviv, Israel`, `Self-hosted`, `Chrome Web Store` | footer of every page (33 routes) | content store `siteCopy.footer.*`, `contact.location` | yes / partly | needs-he-field | S022, S023 |
| 3 | Note titles, subtitles and excerpts (65 strings) | blog home, area pages, activity, related notes, share sheets | content store `post.title/subtitle/excerpt` (`he` block empty) | yes | translate (field exists) | S025 |
| 4 | Note bodies (13 notes) | `/he/blog/:slug` (marked "כתוב באנגלית") | content store `post.body` (`he.body` empty) | yes | translate (field exists) | DB01–DB13 |
| 5 | Project taglines: `Every new tab becomes a dashboard`, `A console for one machine…` | home cards, projects list, project header and caption (upper-cased) | content store `content:projects` | mixed; caption unmarked | needs-he-field | S001 |
| 6 | Project descriptions, highlights, decisions, problem/role/outcome | project pages | content store | yes | needs-he-field | S003–S006 |
| 7 | `NOW` / `BEFORE` / `OUTSIDE WORK`, `STARTED SHIPPING`, `FULL-STACK ENGINEER`, `TECHNICAL TEAM LEAD`, `IN USE` / `OPEN SOURCE` / `ARCHIVE` | home ledger, story timeline, project state chips | content store labels and enum-like values | **no** | translate / key | S008, S014, S019 |
| 8 | Server-rendered `<title>`, description, JSON-LD headline/keywords of note and project pages | crawlers, link previews (`og:locale he_IL`, indexable, `hreflang` he) | SEO from content | n/a | needs-he-field (or `noindex`, design §5) | S041, S042 |
| 9 | `Notifications alt+T` | `aria-label` of the toast region, 14 routes | hard-coded (sonner default) | no | translate | — |
| 10 | `Request failed (503)`, `The contribution year could not be read.` | error states of blog, projects, activity and the GitHub calendar | API / client error text in `<code>` | no | translate | S032, S034 |

## 4. Structural findings

These are the causes behind most rows; fixing a cause clears many rows at once.

1. **Content has no Hebrew field where it most needs one** (S001–S006,
   S011, S013–S015, S019, S020, S022, S023). `content:projects`, `content:story`
   and `content:site-copy` use `{ en, he? }` maps, but several fields are still
   plain strings (project state/where/kind values, link labels, image alt and
   captions, tech list). Media alt/caption are single strings everywhere.
2. **Fields that exist are empty.** Notes and areas have a `he` block; every
   seeded note leaves it empty, so all 13 notes fall back to English. The
   seed's Hebrew from #290 is written only where a content doc does not yet
   exist (S073), so **production keeps its English until the owner enters the
   Hebrew in admin**.
3. **Labels stored as English values.** Project state (`In use`, `Open source`,
   `Archive`) and story/era labels (`Now`, `Before`) are content values used as
   labels; they render unmarked, upper-cased by CSS. They should be keys with a
   word table (design §4.2, Q6) or `Text` maps.
4. **Behaviour keyed by English text.** `ApproachFigures` picks a figure by the
   English claim string (S021): translating the claim would silently drop the
   figure. Must move to an id before any principles copy is translated.
5. **Strings assembled in code.** `${title} screenshot` alt (S012), admin
   `Move ${title} up/down`, `Remove ${title}`, `humaniseSlug()` page names on
   404s (S036), activity "Pushed to {repo}" (S029), "The site" fallback (S031).
6. **The SPA head is English on every /he route** (S044): `web/index.html`
   ships English description and Open Graph tags and `/he` pages never replace
   them. The server render does better (Hebrew titles for static pages) but
   note and project pages carry English title, description and JSON-LD
   (`inLanguage: en`) while declaring `og:locale he_IL`, being indexable and
   listed with a `he` alternate in the sitemap: a duplicate-content signal.
7. **Feeds** are English only (`<language>en`) and `/api/seo/he/feed.xml` is
   404, while `/he` pages advertise feeds (S039).
8. **Admin** is essentially untranslated (S053–S066, ~200 literals in 12
   files), including error messages and zod messages, and dates use `en-GB`
   (S067). Admin forms also break in RTL: see §5.
9. **Formatting**: English relative time and `Undated` groups survive in two
   helpers (S068, S069), partly in dead paths.
10. **Tables outside the gate.** `log.ts`, `work/words.ts` and the dashboard
    `i18n.ts` are `Record<Lang, …>` tables that `words.test.ts` does not check,
    so a missing or Latin-only Hebrew entry there would not fail CI.

## 5. Bidi breakage

| Pattern | Rows | Example | Fix |
|---|---:|---|---|
| Unmarked Latin with trailing punctuation or digits laid out RTL: the full stop or number jumps to the wrong end | 262 | admin hints render `.Comma-separated, in the order shown`; `.3 WHERE: CHROME WEB STORE`; `.Y.B` in the admin header | `lang="en" dir="ltr"` on the element, or `<bdi>` |
| Latin or a number at the end of an RTL run | 43 | `מקום: Tel Aviv, Israel.` in the server-rendered body | isolate the value (`inEnglish`, LRI…PDI) |
| Mixed run in an attribute (no markup possible) | 50 | `שיתוף "WindoM 1.5: computed glass…"` in share `aria-label`s, `רשימות עם התגית chrome-extension` | wrap the Latin part in U+2066…U+2069 when building the string |
| Path or slug echoed without direction | 2 | 404 page echoes `/a-page-that-does-not-exist`; the area 404 shows the slug as a heading | `dir="ltr"` on the echo (S071) |

Screen reader impact: unmarked English is read with Hebrew phonetics. The 290
unmarked public rows are the accessibility half of this audit.

## 6. Error and loading states

The API-error run (every `/api` answered 503) shows Hebrew headings and help
text, then the raw cause in English: `Request failed (503)` (blog, projects,
area, note), the activity panel's error, and the GitHub calendar's `The
contribution year could not be read.` (S032, S034). The loading run shows only
Hebrew skeleton text, except the note and project pages, whose `<title>` falls
back to the humanised English slug ("Windom", "Bothy updates deploy what main
pins") until the data arrives (S036). Contact-form validation is Hebrew in the
client, but the server's failure reason is shown verbatim in English (S033).

## 7. Caveats

- Content is the dev seed, not production. Production's content documents
  predate #290, so they are *more* English than this run (S073).
- `innerText` reflects CSS `text-transform`, so labels set in capitals appear in
  capitals in the table; the stored value is in sentence case.
- GitHub-sourced strings (release names, repo descriptions) appeared only where
  the backend could reach GitHub during the run; the static rows S029, S030 and
  S034 cover the rest.
- Strings visible only to a signed-in admin with real data (connected apps,
  media library contents) were empty in the seed and are covered statically.

## 8. Screenshots

| Shot | Shows |
|---|---|
| [project-tagline-unmarked.png](audit-shots/project-tagline-unmarked.png) | Project page: English tagline under a Hebrew header, upper-cased caption unmarked, English description (desktop, light) |
| [note-english-on-he-phone.png](audit-shots/note-english-on-he-phone.png) | A note on `/he` on a phone: marked "כתוב באנגלית", title and subtitle English (phone, dark) |
| [error-state-raw-message.png](audit-shots/error-state-raw-message.png) | Blog with the API down: Hebrew message, English `Request failed (503)` |
| [admin-projects-english.png](audit-shots/admin-projects-english.png) | `/he/admin/projects`: English nav and labels, and RTL punctuation flips (`.Comma-separated…`, `.3 WHERE:`) |

## 9. Re-running

```sh
# backend on :15099 with a seeded CouchDB, web/dist served on :15173 with /api proxied
cd web
OUT=/tmp/audit/desktop ONLY=desktop-light-motion xvfb-run -a node scripts/i18n-audit/crawl.mjs
OUT=/tmp/audit/seo node scripts/i18n-audit/seo.mjs
GLOSSARY=../docs/i18n/glossary.json node scripts/i18n-audit/classify.mjs /tmp/audit /tmp/audit/findings.json
node scripts/i18n-audit/report.mjs /tmp/audit/findings.json /tmp/audit/seo/seo.json static.json \
  scripts/i18n-audit/overrides.json ../docs/i18n/english-on-hebrew-audit.json /tmp/audit/tables.md
```

## 10. Static findings

| ID | String / cause | Source | Audience | Marked | Treatment | Proposed Hebrew / note |
|---|---|---|---|---|---|---|
| S001 | Project fact / tagline: "Every new tab becomes a dashboard" and the 3 other seeded facts (`backend/src/content/seed.ts:16 (from web/src/data/projects.ts)`) | content-store | public | partial: marked in ObjectLabel fact (home cards); UNMARKED in RepoCard.tsx:126, Project.tsx:346 (head tagline), Project.tsx:460 (Figure caption), Plate.tsx:58, Project.tsx:526 (Elsewhere row meta) | needs-he-field | windom: "כל כרטיסייה חדשה הופכת ללוח מחוונים"; bidi: trailing punctuation reorders in RTL where unmarked; Seed carries zero `he` for any project Text field (fact, description, status, highlights, problem, role, outcome, decisions, storyLine). Owner must fill in Admin > Projects; until then every /he project surface is English. Also add inEnglish() at the unmarked sites. |
| S002 | Area tagline/description: site.json "Decisions, and what they cost", windom.json / bothy.json taglines and descriptions; area title "Notes" (`backend/content/areas/site.json:4`) | content-store | public | partial: Project.tsx:446 description marked; BlogArea.tsx:126 tagline in <bdi> only (no lang); Project head tagline unmarked | needs-he-field | site title "רשימות"; tagline "החלטות, ומה הן עלו"; bidi: bdi isolates but screen reader reads with Hebrew voice; Area JSON has no `he` object. The site area's TITLE is the English word "Notes" and appears as area label in the Blog tree, Row meta (Blog.tsx:96), Timeline (Timeline.tsx:124), BlogLog (BlogLog.tsx:133,346) with translate="no" — it is not a brand. |
| S003 | Project description (4 seeded, e.g. "A Chrome extension that replaces the new-tab page...") (`web/src/pages/Project.tsx:446`) | content-store | public | true | needs-he-field | Marked correctly via inEnglish. |
| S004 | Project highlights ("Worth knowing" list items) (`web/src/pages/Project.tsx:494`) | content-store | public | false | needs-he-field | bidi: list items with trailing periods/numbers reorder in RTL; &lt;li>{h}&lt;/li> without inEnglish. |
| S005 | Project decisions title/body, e.g. "The Gmail widget was removed for a licensing reason, not a product one." (6 seeded) (`web/src/components/projects/ProjectDecisions.tsx:45`) | content-store | public | false | needs-he-field | bidi: em-dashes and trailing periods reorder; h3 and Written body both unmarked. |
| S006 | Project problem / role / outcome bodies (`web/src/components/projects/ProjectBrief.tsx:31`) | content-store | public | false | needs-he-field | bidi: paragraph-level punctuation reorder; Written as=dd, no inEnglish. |
| S007 | "The problem", "My part in it", "What came of it" (`web/src/components/projects/ProjectBrief.tsx:21`) | hard-coded | public | false | translate | "הבעיה", "החלק שלי", "מה יצא מזה"; Hard-coded dt labels, bypass every word table. High visibility on the two flagship project pages. |
| S008 | Project label field values: "In use", "Open source", "Archive" (kind state); "Chrome Web Store" (where); "React 19", "Docker Compose", "React" (tech) (`web/src/data/projects.ts:150 → web/src/components/gallery/ObjectLabel.tsx:194`) | content-store | public | false | translate | state values via stateWord(): "בשימוש" / "קוד פתוח" / "ארכיון"; bidi: each value in &lt;bdi> (good), but no lang="en"; Home ProjectRun cards render entry.fields raw. The state pill elsewhere goes through stateWord() and is Hebrew, so the same word is Hebrew on /he/projects and English on /he. Schema field `value` is a plain string (no he). Tech values are keep-latin. |
| S009 | Tech stack list ("React 19 · TypeScript · Vite 8 · Manifest V3 · Fastify 5 · Drizzle ORM · PostgreSQL 17 · Fly.io", Bothy's incl. "Traefik v3.7") (`web/src/components/projects/ProjectStack.tsx:22; Plate.tsx:35`) | content-store | public | false | keep-latin | bidi: version numbers next to names inside RTL flex; no dir="ltr"/bdi per item; Product names; wrap each in &lt;bdi dir="ltr" translate="no"> and lang=en. |
| S010 | Primary/other link labels: "windom.app", "Chrome Web Store"; fallback "Visit" (`web/src/data/projects.ts:328; web/src/pages/Project.tsx:358,388`) | content-store | public | false | keep-latin | "Visit" → "לאתר"; bidi: domain in RTL button reorders ("app.windom" risk is low but the arrow icon sides swap); linkLabel and links[].label are plain strings in the schema (no he). "Visit" is a hard-coded English fallback when linkLabel is null — translate it. |
| S011 | Project title "Programming with Yehuda" (others WindoM, Bothy, Icaros are brands) (`web/src/data/projects.ts:267`) | content-store | public | false | needs-he-field | "לתכנת עם יהודה" (or keep as a product name); bidi: translate="no" only, no lang/dir; title is a plain string in the schema. Brand names are fine as keep-latin, but should carry lang=en. |
| S012 | `${c.title} screenshot` (`web/src/pages/Project.tsx:464`) | hard-coded | public | false | translate | `צילום מסך של ${title}`; Image alt on the LCP image; read by screen readers on every project page with a cover. |
| S013 | Story lines per project, e.g. "Published in the Chrome Web Store: a review, a privacy policy, an update channel." (`web/src/data/story.ts:138; web/src/pages/Story.tsx:92`) | content-store | public | false | needs-he-field | bidi: colon + trailing period reorder; storyLine Text has no he in seed. |
| S014 | Story start/roles: "Started shipping", "The first software shipped.", "Then", "Now", "Full-stack engineer", "Technical team lead", "Building software across the whole stack.", "Leading a small team that builds and runs internal software.", "Still writing and reviewing code every day." (`web/src/data/story.ts:145; web/src/pages/Story.tsx:82-92`) | content-store | public | false | needs-he-field | "התחלתי לשחרר", "אז", "עכשיו", "מהנדס פול־סטאק", "ראש צוות טכני"; bidi: trailing periods; beat.when / beat.title / beat.lines all unmarked. Role titles already exist in Hebrew in word tables (dashboard i18n role) — reuse. "internal software" is neutral; no military/defence hint found anywhere. |
| S015 | Story image alt (beat.image.alt) (`web/src/pages/Story.tsx:67`) | content-store | public | false | needs-he-field | IMAGES seed is empty today; any alt the owner adds without he is read unmarked. |
| S016 | Interlude English half ("Things other people could open.", "Then, things they relied on.", "Then, a team.") (`web/src/pages/Story.tsx:108`) | content-store | public | true | mark-en | bidi: lang="en" without dir="ltr": trailing period lands on the left edge inside the RTL page; Intentional bilingual pair; add dir="ltr". |
| S017 | Hero name "Portfolio" and mottos "Build boldly", "Keep improving" (`web/src/data/site.ts:97,137`) | content-store | public | mottos yes (per phrase, #290); "Portfolio" h1 via ObjectLabel name: no | keep-latin | Intentional per #290 (brand word, mottos with no approved Hebrew). The h1 itself carries no lang="en" — ObjectLabel never marks `name`. |
| S018 | "Yehuda Briskman" (owner name) (`web/src/components/notes/Byline.tsx:6; web/src/components/dashboard/Parts.tsx:188; web/src/lib/pageTitle.ts:5`) | hard-coded | public | footer yes (SiteFooter.tsx:157); Byline, OwnerCard, document.title, portraitAlt: no | transliterate | "יהודה בריסקמן"; bidi: in &lt;title> "Yehuda Briskman · מהנדס…" the separator side flips; Decide once: keep-latin everywhere with lang=en, or a Hebrew spelling. Also in seo-words he siteTitle/notesAlt/projectsAlt, chrome.ts:153 homeTitle, log.ts:174 feedTitle, pages.ts:48 portraitAlt. |
| S019 | About intro labels "Now", "Before", "Outside work" and their lines ("I'm a full-stack engineer and a technical team lead in Tel Aviv." …) (`web/src/data/site.ts:206; web/src/components/Approach.tsx:95-99`) | content-store | public | false | needs-he-field | "עכשיו", "קודם", "מחוץ לעבודה"; bidi: apostrophes/periods; mentions former employer Momentum Tailored Solutions (allowed); Heading has he since #290 but the labels/lines do not, and Approach renders none of them through inEnglish. |
| S020 | Principles claims and lines: "Install from empty, every time", "A check that cannot fail is not a check", "Generated, never committed" (+6 lines) (`web/src/data/site.ts:240; web/src/components/Approach.tsx:119`) | content-store | public | false | needs-he-field | bidi: trailing periods; Unmarked. |
| S021 | ApproachFigures keyed by the English claim string (`web/src/components/ApproachFigures.tsx:72-79`) | hard-coded | public | n/a | translate | String-switch bug: Approach passes the LOCALIZED claim (convert.ts tx) to FIGURES[claim]; the moment the owner adds a Hebrew claim the figure silently disappears on /he. Key by index or a stable id instead. |
| S022 | Footer: work notes "Chrome Web Store", "Self-hosted"; colophon "Built with React and TypeScript. Runs on a single Arm machine…"; colophonNote; place "Tel Aviv, Israel" (`web/src/data/site.ts:257-290; web/src/components/SiteFooter.tsx:118-159`) | content-store | public | true | needs-he-field | place "תל אביב, ישראל"; "Self-hosted" → "מתארח עצמית"; Marked; just needs Hebrew. Work link labels WindoM/Bothy are brands. Elsewhere links show l.name ("github" capitalised by CSS) not the label. |
| S023 | Contact location "Tel Aviv, Israel", availability (`web/src/data/site.ts:8`) | content-store | public | yes in seo.route tx() | needs-he-field | Rendered in the server fallback/SEO body (seo.route.ts:232). |
| S024 | Profile labels "GitHub", "LinkedIn" (`web/src/data/links.ts:29; web/src/components/Contact.tsx:64`) | content-store | public | false | keep-latin | bidi: in &lt;bdi>, fine; Brands, intentional. |
| S025 | Post title / subtitle / excerpt (all 14 posts in backend/content/posts/** have no he) (`web/src/components/dashboard/Parts.tsx:99 (Row), web/src/pages/Blog.tsx:341,431, web/src/components/dashboard/History.tsx:171, web/src/components/LatestNotes.tsx:319, web/src/pages/Project.tsx:636-637, web/src/components/notes/reader/NoteLink.tsx:188, web/src/components/dashboard/Tree.tsx:219`) | content-store | public | partial: BlogPost h1/subtitle, NoteCard, NoteTile marked; Row, Tree, search results, History (bdi only), LatestNotes ObjectLabel name, Project docs tab, NoteLink preview: unmarked | needs-he-field | bidi: titles ending in punctuation / containing versions ("WindoM 1.4.1") reorder where unmarked; 8 render sites skip inEnglish. |
| S026 | Post tags (English slugs) as chips/pills and facet values (`web/src/pages/Blog.tsx:111; web/src/components/notes/TagPill.tsx:24; BlogPost.tsx:339`) | content-store | public | false | keep-latin | bidi: translate="no" only; hyphenated tags fine; Tags have no he field by design; add lang=en dir=ltr, or a tag→Hebrew label map. |
| S027 | Table of contents headings (h.text from English body) (`web/src/components/notes/reader/Toc.tsx:127`) | content-store | public | false | mark-en | bidi: the body is wrapped lang=en dir=ltr (BlogPost.tsx:330) but the aside/sheet TOC is not; Apply the same bodyInEnglish marking to the TOC. |
| S028 | Post links labels (post.links[].label) and Lightbox figure alt from markdown (`web/src/pages/BlogPost.tsx:353; web/src/components/notes/reader/Lightbox.tsx:176`) | content-store | public | false | mark-en | bidi: button text reorders with the out-arrow; Outside the lang=en body wrapper. |
| S029 | Activity feed not localized: post titles always English even when the post has `he`; "Pushed to {repo}" (`backend/src/services/activity.ts:85,140`) | api-error | public | false | translate | "עדכון קוד ב־{repo}" (build client-side from kind + area); bidi: "Pushed to WindoM" inside RTL timeline; Activity API has no lang and never applies `he`; also area titles in /api/areas. Timeline.tsx:98, BlogLog.tsx:120. Generate the push title client-side from words.pushed. |
| S030 | GitHub release names (r.name \|\| tag) as site-release event titles (`backend/src/services/activity.ts:157`) | github | public | false | mark-en | bidi: version strings like "v1.1.0" without dir=ltr; Owner-authored on GitHub; keep, but mark lang=en dir=ltr. |
| S031 | "The site" (area title fallback) (`web/src/pages/Blog.tsx:78,202`) | hard-coded | public | false | translate | "האתר"; BlogArea.tsx:72 already has the Hebrew; Blog.tsx does not. |
| S032 | Raw error in &lt;code>: "Couldn't reach the server.", "Request failed (N)", "Failed to load", zod parse messages (`web/src/pages/Blog.tsx:281; web/src/pages/BlogLog.tsx:385; web/src/services/blog.ts:107,115; web/src/services/activity.ts:68,75`) | api-error | public | false | translate | bidi: &lt;code> without dir=ltr; "(500)" parentheses mirror; Under a Hebrew title/body. Either map to a Hebrew reason or mark lang=en dir=ltr as a diagnostic. |
| S033 | Contact failure reason: "Check the form", client zod messages ("Add your name", "That email address doesn't look right…", "Tell me a little more…"), backend validate() zod formErrors, "Couldn't send that (HTTP n)" (also hit on the 429 "Too many messages sent" path) (`web/src/services/contact.ts:15-20,35,58; web/src/components/Contact.tsx:349-352; backend/src/middlewares/validate.ts:9; backend/src/app.ts:97`) | api-error | public | false | translate | bidi: English clause with "(HTTP 429)" spliced into a Hebrew sentence via w.failed(reason, email); Field errors were already mapped to Hebrew (Contact.tsx:292), but the send-failure reason is err.message verbatim. Map by status (400/429/5xx) to Hebrew reasons. |
| S034 | "The contribution year could not be read from GitHub." / "The contribution year could not be read." (`backend/src/services/contributions.ts:134; web/src/services/contributions.ts:59; web/src/components/city/ContributionCity.tsx:385`) | api-error | public | false | translate | "לא ניתן היה לקרוא את שנת התרומות מ־GitHub."; The comment says 'nothing here to translate' but the line is printed as the figure caption on the Hebrew home page. Return a code and render from the word table. |
| S035 | document.title "Not found" (`web/src/pages/BlogPost.tsx:126`) | hard-coded | public | false | translate | Project.tsx uses w.notFound; BlogPost hard-codes English. |
| S036 | humaniseSlug() of English slugs as page name ("Windom 1 4 apps hub") in RouteAnnouncer/initial title (`web/src/lib/pageTitle.ts:93-96`) | hard-coded | public | false | mark-en | Announced before the post loads; then replaced by the (English) post title. |
| S037 | "stack" plate caption (`web/src/components/projects/Plate.tsx:25`) | hard-coded | public | false | translate | "סטאק"; Decorative (container aria-hidden) but visible text. |
| S038 | "RSS" feed link (`web/src/components/notes/Byline.tsx:~33`) | hard-coded | public | false | keep-latin | Acronym; intentional. Same in log.ts he rss: "RSS". |
| S039 | RSS feeds advertised from /he are English-only: "Yehuda Briskman · Notes", "Notes on {title}.", "Yehuda Briskman · Channel log", item labels "New note", "Site release", "New area", &lt;language>en (`backend/src/services/seo.ts:289-410`) | seo | public | n/a | translate | No /he feed variant; link rel=alternate on Hebrew pages points to English feeds. Acceptable if documented; otherwise add ?lang=he feeds. |
| S040 | OG card images: eyebrow "Note"/"Project", meta "{n} min read", English title; static og.png/og-blog.png/og-projects.png ("Full-stack engineer & team lead", "Writing"/"Notes", "Work"/"Projects") (`backend/src/routes/seo.route.ts:109-129; backend/scripts/generate-og-assets.ts:20-31`) | seo | public | n/a | translate | bidi: og.ts has no Hebrew font or RTL shaping; Shares from /he show English cards. Needs a Hebrew-capable font before any Hebrew text can be rendered. |
| S041 | Post &lt;title>/description from post.seo.title / post.seo.description (English overrides not localized); JSON-LD headline/description/keywords and article:tag English; og:image:alt = English title (`backend/src/routes/seo.route.ts:563-590`) | seo | public | n/a | needs-he-field | local() only swaps top-level he fields; `seo` overrides always win over a Hebrew title. JSON-LD inLanguage says "he" when the body is Hebrew even if headline is English. |
| S042 | Project/area head: title `${area.title} · ${w.notes} · Yehuda Briskman`, description = English tagline/description, JSON-LD SoftwareSourceCode name/description, seeded project fallback description (`backend/src/routes/seo.route.ts:521-534,624-663`) | seo | public | body yes (en()), head n/a | needs-he-field | Follows store content; fixes itself when he fields are filled. |
| S043 | "Yehuda Briskman" in og:site_name, article:author, JSON-LD Person name; addressLocality "Tel Aviv"; imageAlt "Yehuda Briskman" (`backend/src/routes/seo.route.ts:262-265,305,441,464; backend/src/services/seo.ts:556,581`) | seo | public | n/a | keep-latin | Fine for structured data; consider alternateName "יהודה בריסקמן" and Hebrew imageAlt on /he. |
| S044 | web/index.html static head: &lt;html lang="en" dir="ltr">, &lt;title>Yehuda Briskman · Full-stack engineer & team lead&lt;/title>, meta description, og:title/description/locale en_US, og:image:alt (`web/index.html:5-89`) | seo | public | n/a | translate | bidi: first paint LTR until applyLang runs; seo.ts:710 rewrites lang/dir for he only on the rendered path. |
| S045 | MCP tool descriptions and server instructions (18 descriptions) and tool results (English post content only) (`backend/src/mcp/shared/tools.ts`) | mcp | developers | n/a | keep-latin | Shown in the user's MCP client, not the site; the page itself translates them via toolsDo (all 16 covered). |
| S046 | MCP OAuth pages: &lt;html lang="en">, "Allow", "Deny", "Signed in with GitHub as", "… is asking to use this site's MCP server as you", "About this MCP server", "Done. You can close this tab…", "Nothing was granted.", "Continue to {client}" (`backend/src/mcp/oauth/pages.ts:69-137`) | mcp | developers | true | translate | Correctly marked lang=en; no Hebrew variant. Low priority. |
| S047 | "Claude Code" CopyLine label; tool names in &lt;th translate="no"> (`web/src/pages/DevelopersMcp.tsx:79,120`) | hard-coded | developers | false | keep-latin | bidi: tool names (list_posts) have no dir="ltr"; harmless for identifiers; Brand and identifiers, intentional. |
| S048 | Latin runs in Hebrew word tables (MCP page): "(mcp:read)", "(mcp:write)", "confirm: true.", "OAuth 2.1 … PKCE", "Model Context Protocol‏ (MCP)", "GitHub", "Claude" (`web/src/i18n/statement.ts:166-216`) | ui-table | developers | n/a | keep-latin | bidi: "(mcp:read)" at line end: parentheses mirror; "confirm: true." final period jumps left of the Latin run. Wrap in LRI…PDI like the desktop line does; Intentional (names/identifiers per pages.ts:12 policy). |
| S049 | Latin runs in Hebrew tables: "WCAG 2.2 … AA", "ת״י 5568 (WCAG 2.0 ברמה AA)" (`web/src/i18n/statement.ts:63; backend/src/services/seo-words.ts:99,101`) | ui-table | public | n/a | keep-latin | bidi: "(WCAG)" parentheses and "2.2" number runs; Standard names; intentional. |
| S050 | Latin key names / paths in Hebrew tables: "Escape", "Enter", "Home ו־End", "# … @ …", "מ־/notes ל־/blog", "name@example.com" (`web/src/components/notes/reader/words.ts:120,136; web/src/components/dashboard/i18n.ts:199,205; web/src/components/dashboard/historyWords.ts:91; web/src/i18n/pages.ts:121,149`) | ui-table | public | n/a | keep-latin | bidi: "/notes" and "/blog" render as "notes/" "blog/" in RTL (leading slash is neutral); "# בוחר נושא" starts with RLM ok; Intentional key names; wrap the two paths in LRI/PDI. |
| S051 | Latin runs in GitHub/RSS strings: "ב־GitHub", "צפייה ב־GitHub", "פיד RSS של התחום", "היומן כ־RSS", feedTitle "Yehuda Briskman · יומן פעילות" (`web/src/components/work/words.ts:103-127; web/src/components/dashboard/log.ts:171-186; historyWords.ts:81`) | ui-table | public | n/a | keep-latin | Brands/acronyms; intentional. Note log.ts/work/words.ts/dashboard i18n.ts use Record&lt;Lang,…> tables, not defineWords, so words.test.ts's Hebrew-completeness check does not cover them. |
| S052 | Admin note-editor Hebrew with Latin: "Markdown", "[[a-note]]", "Ctrl+B … Ctrl+Shift+P", "https://" (`web/src/components/admin/noteEditor/words.ts:141-254`) | ui-table | admin | n/a | keep-latin | bidi: shortcut list "Ctrl+Shift+P" + Hebrew labels alternate direction; Intentional. |
| S053 | Admin is mostly NOT localized: only AdminShell, AdminEditor (noteEditor/words) and AdminSettings (settings/words) use word tables (`web/src/pages/Admin*.tsx`) | hard-coded | admin | AdminCollection.tsx:204-212 marks three labels lang=en; elsewhere no | translate | bidi: English labels in an RTL layout (dir=rtl applies to admin too); Summary row; per-file rows S054-S068. |
| S054 | Admin.tsx (13): "Posts", "New post", "New area", "Search posts", "Search title, slug, tag", "Filter by status", "Filter by area", "All areas", "Loading…", "Write the first post", "Clear filters", list meta "published" / `edited ${…}` / `${n}m` (`web/src/pages/Admin.tsx:77-167`) | hard-coded | admin | false | translate |  |
| S055 | AdminAreas.tsx (8): "Areas", "New area", "Loading…", "No areas yet", "Projects on the public site come from here…", "Create the first area" (`web/src/pages/AdminAreas.tsx:38-71`) | hard-coded | admin | false | translate |  |
| S056 | AdminCollection.tsx (37): "Title", "Tagline", "Description", "Hebrew", "Optional, field by field…", "Details", "Kind", "Project", "My blog", "Visibility", "Published", "Hidden", "Order (lower comes first)", "Slug (the URL)", "Cover image URL", "Icon", "None.", "Remove icon", "Repository", "Owner", "Repo", "Branch", "Published paths", "From GitHub", "Refreshed automatically every 15 minutes…", "never" (`web/src/pages/AdminCollection.tsx:166-380`) | hard-coded | admin | 3 of 37 | translate |  |
| S057 | AdminConnections.tsx (6): "Connected apps", "Loading…", "Nothing connected", "Ended" (`web/src/pages/AdminConnections.tsx:47-102`) | hard-coded | admin | false | translate | bidi: the `claude mcp add …` command line has no dir=ltr |
| S058 | AdminMedia.tsx (25): "Media", "Pictures, icons and short videos…", "Anything in use cannot be deleted.", "Search", "Alt text, caption, credit, file name", "Nothing here yet", "Kind", "Size", "Added", "Captions", "Alt text (required)", "Caption", "Credit", "Used by", "Replace the video", "New video", "Its poster (required)", "Captions (optional)", "Cancel" (`web/src/pages/AdminMedia.tsx:70-472`) | hard-coded | admin | false | translate |  |
| S059 | AdminProjects.tsx (35): "Projects", "Edit", "Title", "Slug", "Year", "State", "One-line fact", "Description", "Status line", "Line on the story page", "Card", "Kind", "Value", "Tech", "Image", "Tint (red, green, blue: 0 to 255)", "Links", "Main link", "Main link label", "Repository", "Label", "URL", "The case", "The problem", "My role", "The outcome", "Body", "Preview this project ↗" (`web/src/pages/AdminProjects.tsx:55-226`) | hard-coded | admin | false | translate | bidi: "↗" arrow not mirrored |
| S060 | AdminSiteCopy.tsx (28): "Site copy", "Hero", "Name", "Shipping since", "Title", "Fact", "Where", "How I work", "Heading", "Label", "Claim", "Contact", "Email", "Location", "Availability", "Reply within", "Profiles", "Mark", "URL", "Accessible name", "Footer", "Note", "Colophon", "Colophon note", "Place" (`web/src/pages/AdminSiteCopy.tsx:24-150`) | hard-coded | admin | false | translate |  |
| S061 | AdminStory.tsx (14): "Story", "The opening", "Title", "Roles", "When", "Pinned to beats", "Beat", "Layout", "Image", "Alt text", "After beat", "Words" (`web/src/pages/AdminStory.tsx:35-145`) | hard-coded | admin | false | translate |  |
| S062 | Shared admin components: EditorFrame (8) "Save draft", "Publish", "Loading…", "Preview ↗", "Discard draft", "Seed the store", "Reload", "Problems"; StatusPill (3) "Unsaved", "Saving", "Changed elsewhere"; MediaUpload (10) "Use it as", "Alt text (required)", "Poster image (required)", "A still from the video. JPEG, PNG, WebP or AVIF, up to 5 MB.", "A WebVTT (.vtt) file.", "Captions language", "Caption", "Credit", "Cancel"; MediaPicker (3) "Search", "Alt text, caption, file name", "Loading…"; MediaGrid (2) "Show", "Close"; DocPathsEditor (4) "Add a path only when…", "Path to publish", "Add path"; Fields.tsx placeholder "English" (`web/src/components/admin/**`) | hard-coded | admin | false | translate | Count ~31. |
| S063 | LinkEditor (6): "Links", "Link label", "Source", "Link URL", "Add link", `Remove link ${label}` (`web/src/components/LinkEditor.tsx:27-70`) | hard-coded | admin | false | translate | Embedded in AdminEditor, which is otherwise localized — a visible English island in a Hebrew screen. |
| S064 | Admin API error messages shown verbatim: "This changed elsewhere. Reload and reapply your edit.", "This post changed elsewhere. Reload and reapply.", "This collection changed elsewhere. Reload.", "This picture changed elsewhere…", "invalid", "invalid document", "1 field needs attention"/"N fields need attention", "The site collection cannot be removed.", "No repository configured for this area.", "No such version.", "Too large. Videos are limited to…", "In use by N items. Remove it from them first.", MediaRejected messages, "This connection is read-only.", "This token is read-only.", "Too many requests. Try again shortly." (`backend/src/routes/admin.route.ts:139-600; admin-content.route.ts:59-62; admin-settings.route.ts:31-92; media.admin.route.ts:130-303; middlewares/requireAdmin.ts:144-202 → web/src/services/admin.ts:159, adminContent.ts:76, media.ts:139`) | api-error | admin | false | translate | ~25 distinct strings. Return error codes and translate in the client (AdminSettings already maps some). |
| S065 | Client-side admin errors: "This post changed elsewhere. Reload and reapply your edit.", "The admin API did not respond. It may be restarting." (x3), "Changed elsewhere. Reload to see the newer version.", "A video needs a poster image.", "Request failed (N)" (`web/src/services/admin.ts:144,174; adminContent.ts:40,61; media.ts:103,134`) | hard-coded | admin | false | translate |  |
| S066 | Content schema zod messages: "English is required", "At most N characters", "A full URL, with https://", "A title is required", "A value is required", "A four-digit year", "A state is required", "At least one project", "Already used by project N", "At least one line", "Two roles share this id", "Two interludes share this id", "Hebrew is required here", "Lowercase letters, digits and hyphens", "An email address", "At least one phrase" (`web/src/content/schema.ts:57-206; backend/src/schemas/site-content.ts`) | api-error | admin | false | translate | Shown as field issues in the content editors. |
| S067 | Hard-coded en-GB dates/times in admin: Admin.tsx relativeTime ("Nm ago"/"Nh ago"/"Nd ago") + toLocaleDateString("en-GB"); AdminConnections Intl.DateTimeFormat("en-GB"); AdminCollection toLocaleString("en-GB"); AdminMedia toLocaleDateString("en-GB"); StatusPill toLocaleTimeString("en-GB"); EditorFrame toLocaleString("en-GB") (`web/src/pages/Admin.tsx:19-22; AdminConnections.tsx:13; AdminCollection.tsx:376; AdminMedia.tsx:260; components/admin/StatusPill.tsx:20; components/admin/content/EditorFrame.tsx:31`) | format | admin | false | locale-format | 6 sites. AdminEditor and AdminSettings already use INTL[lang]. |
| S068 | English relative time "today", "yesterday", "N days ago", "N months ago", "N years ago"; facts "stars", "pushed", "last push" (`web/src/services/blog.ts:145-157; components/projects/ProjectFacts.tsx:23-26; components/ProjectMeta.tsx:18`) | format | public | false | locale-format | Dead code today: ProjectFacts, ProjectMeta, ProjectActions, ProjectRow and projects/Gallery are imported by nothing (Gallery only by its test). Delete, or route through dashboard i18n relative() if revived. |
| S069 | "Undated" year group (shelf.ts byYear); monthLabel default locale "en-GB" (`web/src/components/notes/shelf.ts:79; web/src/components/city/cityPlan.ts:172`) | format | public | n/a | locale-format | byYear is unused; cityPlan's English label is only a React key (render passes INTL[lang]). Latent only. |
| S070 | Fallback state/status "In use" / "Archive" / "Earlier work" for areas with no seed (`web/src/hooks/useProjects.ts:121-131`) | hard-coded | public | false | translate | state goes through stateWord() (Hebrew covered); `status` ("Earlier work") is currently not rendered anywhere. Low. |
| S071 | 404 pathname echoed without direction (`web/src/pages/NotFound.tsx:49`) | hard-coded | public | n/a | mark-en | bidi: path "/he/foo/bar" displays as "he/foo/bar/" in RTL — needs dir="ltr" (or &lt;bdi dir=ltr>); Same class: Project.tsx release tag and repo path DO have dir=ltr; this one does not. |
| S072 | Owner-inbox email: "Portfolio contact from {name}", "New message from {name}", "Name:", "Email:" (`web/src/services/contact.ts:44-48`) | hard-coded | admin | n/a | keep-latin | Not shown to the visitor; listed for completeness. Consider noting the sender's language in the email. |
| S073 | Fixed by #290 (not re-listed): Hero "Shipping since {year}" (now w.shippingSince), hero where/fact/phrases/replyWithin/about heading Hebrew seeded, HeroCorners per-phrase lang marking, log/work/notes/settings Hebrew copy revisions (`web/src/components/Hero.tsx:172; web/src/data/site.ts heroHebrew`) | ui-table | public | n/a | translate | Seeded Hebrew only applies where the content document does not exist yet; on a running site the owner must enter it in Admin > Site copy. |

## 11. All findings (crawl and server render)

IDs: `D…` crawl, `DB…` a note body, `R…` server render. Admin rows follow the public ones. The JSON has every route per row.

### Public (621)

| ID | Text | Where | Source | Routes | Marked | Treatment | Bidi / note |
|---|---|---|---|---|---|---|---|
| D0055 | שרת MCP | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | ui-table | 33 routes (/he, /he/a-page-that-does-not-exist, …) | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0068 | HE — החלפת שפה | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | ui-table | 33 routes (/he, /he/a-page-that-does-not-exist, …) | false | keep-latin | mixed run in an attribute (cannot be isolated with markup); the HE/EN code is fine; read aloud as 'H E' — consider lang=en on the code or 'עברית' |
| D0115 | RSS של התחום | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | ui-table | 4 routes (/he/blog/area/an-area-that-does-not-exist, /he/blog/area/bothy, …) | false | keep-latin |  |
| D0158 | פיד RSS של התחום | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | ui-table | /he/projects/bothy, /he/projects/windom | false | keep-latin |  |
| D1241 | j k עוברים בין הרשימות; Enter פותח. | text (open:תפריט, open:עיון) | ui-table | /he/blog/area/bothy, /he/blog/area/site | false | keep-latin |  |
| D0111 | # בוחר נושא, @ בוחר תחום. Enter מחפש. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | ui-table | /he/blog | false | keep-latin |  |
| D0153 | השנה, יום אחר יום. מקשי החיצים עוברים בין הימים, ו־Home ו־End מגיעים לראשון ולאחרון. | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | ui-table | /he | false | keep-latin | mixed run in an attribute (cannot be isolated with markup) |
| D0290 | האתר שואף לעמוד בהנחיות הנגישות לתוכן אינטרנט (WCAG) 2.2 ברמה AA, הכוללות את התקן הישראלי ת״י 5568 (WCAG 2.0 ברמה AA). הבדיקה האחרונה נערכה … | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | ui-table | /he/accessibility | false | keep-latin | standard names, glossary allowLatin |
| D0291 | כפתור ערכת הצבעים בסרגל העליון (בתוך התפריט בטלפון) פותח תפריט אחד עם שלוש הגדרות. האתר זוכר כל אחת מהן במכשיר הזה, ואפשר להגיע לכל אחת ולשנ… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | ui-table | /he/accessibility | false | translate |  |
| D0632 | מקשי החיצים מנווטים, חץ שמאלה פותח תחום, Enter פותח רשימה. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | ui-table | /he/blog | false | keep-latin |  |
| D0001 | HE | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | 33 routes (/he, /he/a-page-that-does-not-exist, …) | false | keep-latin |  |
| D0160 | English | text (open:HE — החלפת שפה) | hard-coded | 30 routes (/he/a-page-that-does-not-exist, /he/accessibility, …) | true | translate |  |
| D0192 | RSS | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | 14 routes (/he/blog/bothy-2026-8-first-release, /he/blog/bothy-2026-9-five-services, …) | false | keep-latin |  |
| D0193 | Notifications alt+T | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | 14 routes (/he/blog/bothy-2026-8-first-release, /he/blog/bothy-2026-9-five-services, …) | false | translate | library default; pass containerAriaLabel |
| D0084 | The problem | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/projects/bothy, /he/projects/windom | false | translate |  |
| D0086 | My part in it | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/projects/bothy, /he/projects/windom | false | translate |  |
| D0088 | What came of it | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/projects/bothy, /he/projects/windom | false | translate |  |
| D0648 | matches | text (open:נושאהכול, open:שנההכול) | hard-coded | /he/blog, /he/projects | false | translate |  |
| D0651 | match | text (open:נושאהכול, open:מצבהכול) | hard-coded | /he/blog, /he/projects | false | translate |  |
| D0669 | operator | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/blog/bothy-2026-8-first-release, /he/blog/bothy-no-shell-in-the-browser | true | keep-latin |  |
| D1239 | j | text (open:תפריט, open:עיון) | hard-coded | /he/blog/area/bothy, /he/blog/area/site | false | keep-latin |  |
| D1240 | k | text (open:תפריט, open:עיון) | hard-coded | /he/blog/area/bothy, /he/blog/area/site | false | keep-latin |  |
| D0051 | The contribution year could not be read. | text | hard-coded | /he | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0109 | WindoM screenshot | attr:alt (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/projects/windom | false | translate | `${title} screenshot` alt template (S012) |
| D0117 | היומן כ־RSS, עם הסינון הנוכחי. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/blog/log | false | keep-latin |  |
| D0119 | כל הרשימות כ־RSS | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/blog/log | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0169 | Icaros screenshot | attr:alt (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/projects/icaros | false | translate | `${title} screenshot` alt template (S012) |
| D0218 | AVIF | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/blog/fixture-rendering | true | keep-latin |  |
| D0220 | WebP | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/blog/fixture-rendering | true | translate |  |
| D0222 | JPEG | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/blog/fixture-rendering | true | keep-latin |  |
| D0224 | src | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/blog/fixture-rendering | true | keep-latin |  |
| D0623 | Bothy screenshot | attr:alt (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/projects/bothy | false | translate | `${title} screenshot` alt template (S012) |
| D0740 | download | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/blog/bothy-2026-8-first-release | true | keep-latin |  |
| D0741 | version | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/blog/bothy-2026-8-first-release | true | keep-latin |  |
| D0748 | VERSION | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/blog/bothy-2026-8-first-release | true | keep-latin |  |
| D0951 | Programming with Yehuda screenshot | attr:alt (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/projects/programming-with-yehuda | false | translate | `${title} screenshot` alt template (S012) |
| D1017 | npm | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/blog/windom-1-4-1-reliability | true | keep-latin |  |
| D1045 | /a-page-that-does-not-exist | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/a-page-that-does-not-exist | false | keep-latin | path-without-dir-ltr; echoed path/slug (S036, S071): needs dir=ltr; the area 404 shows humaniseSlug as a heading |
| D1046 | an-area-that-does-not-exist | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/blog/area/an-area-that-does-not-exist | false | keep-latin | path-without-dir-ltr; echoed path/slug (S036, S071): needs dir=ltr; the area 404 shows humaniseSlug as a heading |
| D0112 | Request failed (503) | text | api-error | /he/blog, /he/blog/log | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip; raw fetch error shown to visitors |
| D0215 | FORMAT | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | api-error | /he/blog/fixture-rendering | true | translate |  |
| D0643 | תחום חדש: Notes | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | settings | /he/blog | false | needs-he-field | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0002 | GitHub | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 33 routes (/he, /he/a-page-that-does-not-exist, …) | false | keep-latin |  |
| D0003 | LinkedIn | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 33 routes (/he, /he/a-page-that-does-not-exist, …) | false | keep-latin |  |
| D0056 | WindoM Chrome Web Store | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 33 routes (/he, /he/a-page-that-does-not-exist, …) | false | keep-latin |  |
| D0057 | Chrome Web Store | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 33 routes (/he, /he/a-page-that-does-not-exist, …) | mixed | keep-latin |  |
| D0058 | Bothy Self-hosted | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 33 routes (/he, /he/a-page-that-does-not-exist, …) | false | keep-latin |  |
| D0059 | Self-hosted | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 33 routes (/he, /he/a-page-that-does-not-exist, …) | true | translate |  |
| D0060 | Github ↗ | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 33 routes (/he, /he/a-page-that-does-not-exist, …) | false | keep-latin |  |
| D0061 | Linkedin ↗ | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 33 routes (/he, /he/a-page-that-does-not-exist, …) | false | keep-latin |  |
| D0063 | No trackers. No cookie banner, because there are no cookies. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 33 routes (/he, /he/a-page-that-does-not-exist, …) | true | translate |  |
| D0064 | © 2026 Yehuda Briskman | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 33 routes (/he, /he/a-page-that-does-not-exist, …) | true | keep-latin |  |
| D0065 | Tel Aviv, Israel | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 33 routes (/he, /he/a-page-that-does-not-exist, …) | true | translate |  |
| D0066 | GitHub | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 33 routes (/he, /he/a-page-that-does-not-exist, …) | false | keep-latin |  |
| D0067 | LinkedIn | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 33 routes (/he, /he/a-page-that-does-not-exist, …) | false | keep-latin |  |
| D0078 | Yehuda Briskman | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 26 routes (/he/blog, /he/blog/area/an-area-that-does-not-exist, …) | false | keep-latin |  |
| D0194 | רשימות עם התגית windom | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 9 routes (/he/blog/windom-1-0-first-release, /he/blog/windom-1-1-settings-sync, …) | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D0263 | רשימות עם התגית release | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 8 routes (/he/blog/bothy-2026-8-first-release, /he/blog/bothy-2026-9-five-services, …) | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D0197 | רשימות עם התגית chrome-extension | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 7 routes (/he/blog/windom-1-0-first-release, /he/blog/windom-1-1-settings-sync, …) | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D0026 | A console for one machine that asks Docker what is running | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 6 routes (/he, /he/blog/area/bothy, …) | mixed | translate |  |
| D0132 | BOTHY | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 6 routes (/he, /he/blog/bothy-2026-8-first-release, …) | false | keep-latin | English content value set in capitals by CSS; label-like fields (state, era, role) need he or a key |
| D0016 | Every new tab becomes a dashboard | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 5 routes (/he, /he/projects, …) | mixed | translate |  |
| D0029 | Programming with Yehuda | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 5 routes (/he, /he/projects, …) | false | translate |  |
| D0030 | Lesson pages built while learning React and Node | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 5 routes (/he, /he/projects, …) | mixed | translate |  |
| D0033 | Icaros | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 5 routes (/he, /he/projects, …) | false | keep-latin |  |
| D0034 | A car-listing web app, built while learning React and Node | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 5 routes (/he, /he/projects, …) | mixed | translate |  |
| D0189 | #auth | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 4 routes (/he/blog/windom-1-3-weather-without-a-key, /he/blog/windom-1-4-1-reliability, …) | false | keep-latin | tag slug; mark lang=en dir=ltr |
| D0196 | רשימות עם התגית auth | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 4 routes (/he/blog/windom-1-3-weather-without-a-key, /he/blog/windom-1-4-1-reliability, …) | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D0255 | #bothy | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 4 routes (/he/blog/bothy-2026-8-first-release, /he/blog/bothy-2026-9-five-services, …) | false | keep-latin | tag slug; mark lang=en dir=ltr |
| D0262 | רשימות עם התגית bothy | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 4 routes (/he/blog/bothy-2026-8-first-release, /he/blog/bothy-2026-9-five-services, …) | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D0768 | Changelog ↖ | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 4 routes (/he/blog/windom-1-0-first-release, /he/blog/windom-1-1-settings-sync, …) | false | needs-he-field |  |
| D0099 | React 19 | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects, /he/projects/bothy, /he/projects/windom | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0100 | TypeScript | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects, /he/projects/bothy, /he/projects/windom | false | keep-latin |  |
| D0157 | MIT | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/area/bothy, /he/projects/bothy, /he/projects/windom | false | keep-latin |  |
| D0164 | React | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects, /he/projects/icaros, /he/projects/programming-with-yehuda | false | keep-latin |  |
| D0165 | Node.js | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects, /he/projects/icaros, /he/projects/programming-with-yehuda | false | keep-latin |  |
| D0166 | MongoDB | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects, /he/projects/icaros, /he/projects/programming-with-yehuda | false | keep-latin |  |
| D0167 | Vite | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects, /he/projects/icaros, /he/projects/programming-with-yehuda | false | keep-latin |  |
| D0257 | #self-hosting | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-8-first-release, /he/blog/bothy-2026-9-five-services, /he/blog/bothy-asks-docker | false | keep-latin | tag slug; mark lang=en dir=ltr |
| D0264 | רשימות עם התגית self-hosting | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-8-first-release, /he/blog/bothy-2026-9-five-services, /he/blog/bothy-asks-docker | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D0597 | v2026.9.0 | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/area/bothy, /he/projects, /he/projects/bothy | false | keep-latin |  |
| D0619 | Python | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/area/bothy, /he/projects, /he/projects/bothy | false | needs-he-field |  |
| D0675 | #docker | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-8-first-release, /he/blog/bothy-asks-docker, /he/blog/bothy-no-shell-in-the-browser | false | keep-latin | tag slug; mark lang=en dir=ltr |
| D0679 | רשימות עם התגית docker | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-8-first-release, /he/blog/bothy-asks-docker, /he/blog/bothy-no-shell-in-the-browser | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D0035 | NOW | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he, /he/story | false | translate | English content value set in capitals by CSS; label-like fields (state, era, role) need he or a key |
| D0054 | yehuda@yehudabriskman.com | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he, /he/accessibility | false | keep-latin |  |
| D0144 | Three verbs, written down where they cannot drift | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he, /he/blog/bothy-no-shell-in-the-browser | true | translate |  |
| D0146 | Why the console has no list of services, and what it does instead | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he, /he/blog/bothy-asks-docker | true | translate |  |
| D0148 | A licensing decision rather than a product one, and how it was kept reversible | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he, /he/blog/windom-gmail-withdrawn-for-licensing | true | translate |  |
| D0150 | One misread status code, and why the fix is keyed on the route | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he, /he/blog/windom-provider-401-is-not-a-session | true | translate |  |
| D0152 | How WindoM's panes refract the wallpaper behind them, and the one fault that hid it | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he, /he/blog/windom-glass-as-optics | true | translate |  |
| D0155 | v1.5.1 | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects, /he/projects/windom | false | keep-latin |  |
| D0161 | Visit | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/icaros, /he/projects/programming-with-yehuda | false | needs-he-field |  |
| D0254 | main | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-9-five-services, /he/blog/windom-1-4-1-reliability | true | keep-latin |  |
| D0260 | The guide ↖ | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-9-five-services, /he/blog/windom-1-4-apps-hub | false | needs-he-field |  |
| D0620 | YehudaBriskman/Bothy | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/area/bothy, /he/projects/bothy | false | needs-he-field |  |
| D0625 | release | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog, /he/blog/area/bothy | false | needs-he-field |  |
| D0631 | A console for one machine is usually a hand-written list, wrong from the first container that moves. Bothy has no list: it joins two read-on… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog, /he/blog/area/bothy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0633 | updates | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog, /he/blog/area/bothy | false | needs-he-field |  |
| D0634 | ci | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog, /he/blog/area/bothy | false | keep-latin |  |
| D0635 | self-hosting | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog, /he/blog/area/bothy | false | keep-latin |  |
| D0636 | security | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog, /he/blog/area/bothy | false | needs-he-field |  |
| D0637 | docker | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog, /he/blog/area/bothy | false | keep-latin |  |
| D0638 | testing | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog, /he/blog/area/bothy | false | needs-he-field |  |
| D0649 | fixture | text (open:נושאהכול, open:תפריט) | content-store | /he/blog, /he/blog/area/site | false | needs-he-field |  |
| D0650 | edge-case | text (open:נושאהכול, open:תפריט) | content-store | /he/blog, /he/blog/area/site | false | keep-latin |  |
| D0652 | observability | text (open:נושאהכול, open:תפריט) | content-store | /he/blog, /he/blog/area/bothy | false | needs-he-field |  |
| D0653 | rendering | text (open:נושאהכול, open:תפריט) | content-store | /he/blog, /he/blog/area/site | false | needs-he-field |  |
| D0676 | #testing | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-no-shell-in-the-browser, /he/blog/windom-provider-401-is-not-a-session | false | keep-latin | tag slug; mark lang=en dir=ltr |
| D0680 | רשימות עם התגית testing | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-no-shell-in-the-browser, /he/blog/windom-provider-401-is-not-a-session | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D0724 | #css | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-5-computed-glass, /he/blog/windom-glass-as-optics | false | keep-latin | tag slug; mark lang=en dir=ltr |
| D0727 | רשימות עם התגית css | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-5-computed-glass, /he/blog/windom-glass-as-optics | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D1261 | (שיתוף ב־LinkedIn) | text (open:שיתוף "Fixture — code, tables and q, open:שיתוף "Fixture — a long read") | content-store | /he/blog/area/bothy, /he/blog/area/site | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0011 | Yehuda Briskman — פול־סטאק, עם דגש על פרונטאנד | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | keep-latin |  |
| D0012 | טכנולוגיה, בונה מוצרים, Build boldly, בינה מלאכותית יישומית, Keep improving | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | translate | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0013 | Build boldly | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | translate |  |
| D0014 | Keep improving | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | translate |  |
| D0017 | IN USE | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | translate | English content value set in capitals by CSS; label-like fields (state, era, role) need he or a key |
| D0018 | REACT 19 | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0019 | CHROME WEB STORE | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | keep-latin |  |
| D0020 | STACK | text | content-store | /he | false | translate | English content value set in capitals by CSS; label-like fields (state, era, role) need he or a key |
| D0021 | ·React 19 | text | content-store | /he | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0022 | ·TypeScript | text | content-store | /he | false | keep-latin |  |
| D0023 | ·Docker Compose | text | content-store | /he | false | needs-he-field |  |
| D0024 | ·Traefik v3.7 | text | content-store | /he | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0027 | OPEN SOURCE | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | translate | English content value set in capitals by CSS; label-like fields (state, era, role) need he or a key |
| D0028 | DOCKER COMPOSE | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | keep-latin | English content value set in capitals by CSS; label-like fields (state, era, role) need he or a key |
| D0031 | ARCHIVE | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | translate | English content value set in capitals by CSS; label-like fields (state, era, role) need he or a key |
| D0032 | REACT | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | keep-latin | English content value set in capitals by CSS; label-like fields (state, era, role) need he or a key |
| D0038 | BEFORE | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | translate | English content value set in capitals by CSS; label-like fields (state, era, role) need he or a key |
| D0040 | OUTSIDE WORK | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | translate | English content value set in capitals by CSS; label-like fields (state, era, role) need he or a key |
| D0042 | Install from empty, every time | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | translate |  |
| D0045 | A check that cannot fail is not a check | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | translate |  |
| D0048 | Generated, never committed | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | translate |  |
| D0052 | GITHUB | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | keep-latin | English content value set in capitals by CSS; label-like fields (state, era, role) need he or a key |
| D0053 | LINKEDIN | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | keep-latin |  |
| D0069 | Yehuda Briskman: תצלום גזור מהמותניים ומעלה, במשקפי שמש עגולים ובחולצת טי בהירה, רצועת תיק על כתף אחת, מביט הצידה. | attr:alt (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | keep-latin | mixed run in an attribute (cannot be isolated with markup) |
| D0070 | Portfolio | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | false | translate |  |
| D0079 | הנתונים העדכניים מ־GitHub לא זמינים כרגע, ולכן ייתכן שחסרים כוכבים, עדכוני קוד וגרסאות. כל הפרויקטים עדיין מופיעים. | text | content-store | /he/projects | false | keep-latin |  |
| D0081 | windom.app | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/windom | false | keep-latin |  |
| D0083 | EVERY NEW TAB BECOMES A DASHBOARD | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/windom | false | needs-he-field | project tagline: no he in content:projects; unmarked (S001) |
| D0090 | Published on the Chrome Web Store, v1.5.1 | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/windom | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0091 | Push a version tag and it builds, zips and ships to Google with no manual step | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/windom | false | translate |  |
| D0092 | Full stack solo: React front end, Fastify + Postgres back end, Google and Spotify OAuth | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/windom | false | translate |  |
| D0093 | The Gmail widget was removed for a licensing reason, not a product one. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/windom | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0095 | The glass is computed optics rather than a stack of CSS tricks. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/windom | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0097 | Signing in logged you straight back out — one fault, several symptoms. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/windom | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0101 | Vite 8 | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/windom | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0102 | Manifest V3 | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/windom | false | keep-latin | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0103 | Fastify 5 | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/windom | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0104 | Drizzle ORM | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/windom | false | keep-latin |  |
| D0105 | PostgreSQL 17 | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/windom | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0106 | Fly.io | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/windom | false | keep-latin |  |
| D0107 | YehudaBriskman/WindoM | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/windom | false | needs-he-field |  |
| D0108 | WindoM | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/windom | false | keep-latin |  |
| D0122 | STARTED SHIPPING | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/story | false | translate | English content value set in capitals by CSS; label-like fields (state, era, role) need he or a key |
| D0124 | PROGRAMMING WITH YEHUDA | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/story | false | keep-latin | English content value set in capitals by CSS; label-like fields (state, era, role) need he or a key |
| D0125 | Lesson pages built while learning React and Node. A learning project, written to practise React and Node. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0126 | Things other people could open. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0127 | ICAROS | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/story | false | keep-latin | English content value set in capitals by CSS; label-like fields (state, era, role) need he or a key |
| D0128 | A car-listing web app, built while learning React and Node. A learning project: a React front end on a Node.js and MongoDB back end. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/story | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0130 | Every new tab becomes a dashboard. Published in the Chrome Web Store: a review, a privacy policy, an update channel. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0131 | Then, things they relied on. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0133 | A console for one machine that asks Docker what is running. Open source. The install has to work on a machine its author has never seen. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0134 | THEN | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/story | false | translate | English content value set in capitals by CSS; label-like fields (state, era, role) need he or a key |
| D0135 | FULL-STACK ENGINEER | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/story | false | translate | English content value set in capitals by CSS; label-like fields (state, era, role) need he or a key |
| D0137 | Then, a team. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0138 | TECHNICAL TEAM LEAD | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/story | false | translate | English content value set in capitals by CSS; label-like fields (state, era, role) need he or a key |
| D0139 | Leading a small team that builds and runs internal software. Still writing and reviewing code every day. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0142 | How Bothy keeps its own stack current without letting the update button decide what to run | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he | true | translate |  |
| D0162 | A learning project: a car-listing web app with a React front end and a Node.js and MongoDB back end, built while learning the stack. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/icaros | true | translate |  |
| D0163 | A CAR-LISTING WEB APP, BUILT WHILE LEARNING REACT AND NODE | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/icaros | false | needs-he-field | project tagline: no he in content:projects; unmarked (S001) |
| D0168 | Icaros | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/icaros | false | keep-latin |  |
| D0172 | WHY THE GMAIL WIDGET WAS WITHDRAWN | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-gmail-withdrawn-for-licensing | true | translate |  |
| D0175 | To read mail, an app asks Google for the gmail.readonly scope. Google classes it as a restricted scope. An extension that requests one can o… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-gmail-withdrawn-for-licensing | true | needs-he-field |  |
| D0176 | gmail.readonly | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-gmail-withdrawn-for-licensing | true | keep-latin |  |
| D0188 | #privacy | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-gmail-withdrawn-for-licensing | false | keep-latin | tag slug; mark lang=en dir=ltr |
| D0191 | PR #329, gate the Gmail restricted scope ↖ | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-gmail-withdrawn-for-licensing | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0195 | רשימות עם התגית privacy | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-gmail-withdrawn-for-licensing | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D0199 | FIXTURE — CODE, TABLES AND QUOTES | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/fixture-rendering | true | translate |  |
| D0200 | Every block the renderer has to handle, in one place | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/fixture-rendering | true | translate |  |
| D0201 | Fixture text. Everything below exists so the renderer has something to render. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/fixture-rendering | true | translate |  |
| D0202 | A fenced block, shell | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/fixture-rendering | mixed | translate |  |
| D0228 | #fixture | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/fixture-rendering | false | keep-latin | tag slug; mark lang=en dir=ltr |
| D0229 | #rendering | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/fixture-rendering | false | keep-latin | tag slug; mark lang=en dir=ltr |
| D0231 | רשימות עם התגית fixture | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/fixture-rendering | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D0232 | רשימות עם התגית rendering | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/fixture-rendering | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D0234 | BOTHY 2026.9: FIVE SERVICES, A CLUSTER CONSOLE, AND A GUIDE | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-9-five-services | true | translate |  |
| D0235 | Fewer containers, new metrics storage, a written guide, and releases that tag themselves | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-9-five-services | true | translate |  |
| D0241 | New metrics storage | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-9-five-services | mixed | translate |  |
| D0249 | An installer that clones a pinned release, verifies the commit against a value baked into the script, and then stops and tells you the next … | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-9-five-services | true | needs-he-field |  |
| D0251 | bothy self-update, because upgrade updates the box and not the tool. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-9-five-services | true | needs-he-field |  |
| D0253 | Releases tag themselves. After CI passes on main, a workflow tags that exact commit and publishes release notes. A commit whose CI failed is… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-9-five-services | true | needs-he-field |  |
| D0258 | #observability | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-9-five-services | false | keep-latin | tag slug; mark lang=en dir=ltr |
| D0259 | Release v2026.9.0 ↖ | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-9-five-services | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0265 | רשימות עם התגית observability | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-9-five-services | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D0267 | WINDOM 1.3: WEATHER WITHOUT A KEY, AND ACCOUNTS YOU CAN RECOVER | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-3-weather-without-a-key | true | translate |  |
| D0268 | Includes 1.2: account deletion, and fixes to calendar and Spotify | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-3-weather-without-a-key | true | translate |  |
| D0278 | Alongside that, this release tightens rate limits on the endpoints most likely to be guessed at, adds issuer and audience checks to tokens, … | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-3-weather-without-a-key | true | needs-he-field |  |
| D0286 | Release v1.3.3 ↖ | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-3-weather-without-a-key | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0596 | Releases | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | needs-he-field |  |
| D0598 | A self-hosted console for a single machine. It reports containers, ports, routes, metrics and files by asking Docker directly, so what it sh… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | true | translate |  |
| D0599 | A CONSOLE FOR ONE MACHINE THAT ASKS DOCKER WHAT IS RUNNING | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | needs-he-field | project tagline: no he in content:projects; unmarked (S001) |
| D0600 | A console for one machine is normally a hand-written list, so it is wrong from the first container that moves and nobody notices until it ma… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0601 | One person's reproducible development box, in git: the console, the compose stacks beneath it, and the CI that clones the repository into an… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0602 | Start any container and it appears in the console within ten seconds with no edit to Bothy; stop it and its dot goes red just as fast. Fifty… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0603 | Every card is discovered, never configured | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | translate |  |
| D0604 | Each PR bootstraps the whole stack from empty and runs every suite | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | translate |  |
| D0605 | Secrets generated at install; names logged, values never | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | translate |  |
| D0606 | 125 merged pull requests | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0607 | The security boundary is the Traefik rule, not the socket proxy's configuration. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0608 | docker-socket-proxy gates by endpoint family, so CONTAINERS=1 also permits /containers/{id}/json — whose body contains every container's env… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0609 | There is no exec, and that is a deliberate regression. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0610 | No shell in the browser, no kill, no create, no image or volume management. docker exec is root on the box, so EXEC: 0 is written out explic… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0611 | One function owns the walk, so the security check is not something a caller has to remember. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0612 | The file API's safepath.collect() is the only way the application can learn a set of paths, so a new endpoint inherits the deny rules by cal… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0613 | Docker Compose | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | needs-he-field |  |
| D0614 | Traefik v3.7 | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0615 | Keycloak | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | keep-latin |  |
| D0616 | VictoriaMetrics | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | keep-latin |  |
| D0617 | Grafana | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | keep-latin |  |
| D0618 | Tailscale | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | keep-latin |  |
| D0622 | Bothy | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/bothy | false | keep-latin |  |
| D0626 | chrome-extension | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog | false | keep-latin |  |
| D0628 | auth | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog | false | needs-he-field |  |
| D0629 | WindoM's glass bends the wallpaper through Snell's law instead of faking it with blur and tint. Getting there meant finding the browser faul… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0630 | Signing in to WindoM worked, then undid itself. A stale Calendar or Spotify grant was being read as an expired session, and the refresh stor… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0639 | privacy | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog | false | needs-he-field |  |
| D0640 | css | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog | false | keep-latin |  |
| D0641 | performance | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog | false | needs-he-field |  |
| D0642 | תחום חדש: WindoM | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0644 | תחום חדש: Bothy | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0645 | עדכוני קוד: Pushed to WindoM | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog | false | translate | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0646 | עדכוני קוד: Pushed to Bothy | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog | false | translate | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0647 | רשימה חדשה: An updater that cannot choose the version | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog | false | translate | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0654 | WHY BOTHY HAS NO SHELL IN THE BROWSER | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-no-shell-in-the-browser | true | translate |  |
| D0658 | docker exec | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-no-shell-in-the-browser | true | keep-latin |  |
| D0659 | docker exec is effectively root on the machine. A browser terminal is a convenient way to hand that to anyone who can reach a web page and h… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-no-shell-in-the-browser | true | needs-he-field |  |
| D0662 | The socket proxies say no explicitly. Exec is switched off by an explicit setting on every Docker socket proxy, rather than left to a defaul… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-no-shell-in-the-browser | true | needs-he-field |  |
| D0674 | #security | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-no-shell-in-the-browser | false | keep-latin | tag slug; mark lang=en dir=ltr |
| D0677 | Bothy guide, Roles ↖ | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-no-shell-in-the-browser | false | needs-he-field |  |
| D0678 | רשימות עם התגית security | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-no-shell-in-the-browser | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D0682 | A PROVIDER'S 401 IS NOT A SIGNED-OUT USER | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-provider-401-is-not-a-session | true | translate |  |
| D0683 | "Connect with Google" in WindoM would show Connecting… and then stop. It looked like a sign-in failure. It was not. The sign-in succeeded ev… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-provider-401-is-not-a-session | true | needs-he-field |  |
| D0685 | WindoM's backend speaks for two kinds of identity. There is the user's session with WindoM itself, and there are the user's grants with each… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-provider-401-is-not-a-session | true | needs-he-field |  |
| D0704 | PR #362, stop a provider 401 from ending the session ↖ | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-provider-401-is-not-a-session | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0706 | WINDOM 1.5: COMPUTED GLASS, AND GMAIL WITHDRAWN | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-5-computed-glass | true | translate |  |
| D0707 | Includes 1.5.1: signing in no longer signs you out | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-5-computed-glass | true | translate |  |
| D0716 | windom.app is rebuilt | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-5-computed-glass | mixed | keep-latin |  |
| D0721 | Spotify responds on the first press, instead of showing the state from before the command for up to fifteen seconds. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-5-computed-glass | true | translate |  |
| D0722 | Focus mode now exits on a click or Escape, as the guide always said. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-5-computed-glass | true | needs-he-field |  |
| D0723 | Releases confirm the store's answer. The release job now submits the package explicitly and fails if the Chrome Web Store rejects it, instea… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-5-computed-glass | true | needs-he-field |  |
| D0725 | Release v1.5.0 ↖ | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-5-computed-glass | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0726 | Release v1.5.1 ↖ | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-5-computed-glass | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0729 | BOTHY 2026.8: THE FIRST RELEASE | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-8-first-release | true | translate |  |
| D0730 | A console, local identity, a CLI, and CI that installs it from nothing | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-8-first-release | true | translate |  |
| D0736 | The console. Overview, Control and Files, all discovered from Docker rather than configured. Five themes and a theme editor. A markdown read… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-8-first-release | true | needs-he-field |  |
| D0737 | Identity. A local Keycloak with four flat roles (viewer, editor, operator and shell), enforced at the edge. Nothing leaves the machine. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-8-first-release | true | needs-he-field |  |
| D0753 | Release v2026.8.1 ↖ | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-2026-8-first-release | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0755 | WINDOM 1.1: SETTINGS THAT FOLLOW YOU | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-1-settings-sync | true | translate |  |
| D0756 | Preferences sync to your account, sessions stop dropping, and the backend gets its foundations | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-1-settings-sync | true | translate |  |
| D0937 | גרסה: v1.5.1 | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0938 | גרסה: v2026.9.0 | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0941 | רשימות על WindoM | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects | false | keep-latin | mixed run in an attribute (cannot be isolated with markup) |
| D0945 | In use | text (open:מצבהכול) | content-store | /he/projects | false | needs-he-field |  |
| D0946 | Open source | text (open:מצבהכול) | content-store | /he/projects | false | needs-he-field |  |
| D0947 | Archive | text (open:מצבהכול) | content-store | /he/projects | false | needs-he-field |  |
| D0948 | A learning project: a small site of programming lesson pages, built while learning React and Node.js. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/programming-with-yehuda | true | translate |  |
| D0949 | LESSON PAGES BUILT WHILE LEARNING REACT AND NODE | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/programming-with-yehuda | false | needs-he-field | project tagline: no he in content:projects; unmarked (S001) |
| D0950 | Programming with Yehuda | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/projects/programming-with-yehuda | false | translate |  |
| D0953 | Pushed to WindoM (ב־GitHub) | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/log | false | translate | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0954 | (ב־GitHub) | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/log | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0955 | Pushed to Bothy (ב־GitHub) | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/log | false | translate | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0956 | v1.5.1 (ב־GitHub) | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/log | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0957 | v2026.9.0 (ב־GitHub) | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/log | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0958 | BOTHY ASKS DOCKER WHAT IS RUNNING | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-asks-docker | true | translate |  |
| D0964 | A read-only Docker socket proxy gives ports, health, images, Compose labels and per-volume disk use. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-asks-docker | true | needs-he-field |  |
| D0968 | Docker Compose already labels every container with the files it came from. That label is enough to say whether a container belongs to Bothy'… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-asks-docker | true | needs-he-field |  |
| D0971 | So a project can declare itself in a small file in its own repository. A collector turns those declarations into a list the console reads al… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-asks-docker | true | needs-he-field |  |
| D0975 | Bothy on GitHub ↖ | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/bothy-asks-docker | false | needs-he-field |  |
| D0977 | THE GLASS IS COMPUTED, NOT DECORATED | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-glass-as-optics | true | translate |  |
| D0998 | #performance | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-glass-as-optics | false | keep-latin | tag slug; mark lang=en dir=ltr |
| D0999 | PR #349, rebuild the glass as real optics ↖ | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-glass-as-optics | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1000 | רשימות עם התגית performance | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-glass-as-optics | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D1002 | WINDOM 1.4.1: A RELEASE ABOUT NOT BREAKING | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-4-1-reliability | true | translate |  |
| D1003 | Readiness checks, a release gate, session controls and a GitHub widget | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-4-1-reliability | true | translate |  |
| D1008 | Both tag-triggered workflows, the backend deploy and the Chrome Web Store publish, now have to pass one shared release gate before anything … | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-4-1-reliability | true | needs-he-field |  |
| D1011 | A GitHub widget | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-4-1-reliability | mixed | translate |  |
| D1019 | #ci | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-4-1-reliability | false | keep-latin | tag slug; mark lang=en dir=ltr |
| D1020 | רשימות עם התגית ci | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-4-1-reliability | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D1022 | WINDOM 1.4: THE APPS HUB, MARKETS AND A FIRST-RUN GUIDE | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-4-apps-hub | true | translate |  |
| D1023 | Includes 1.3.5: settings restructured, and a sync conflict removed | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-4-apps-hub | true | translate |  |
| D1028 | A finance dashboard with separate Stocks and Crypto cards, each scrollable, with ticker search and autocomplete and a toggle to show or hide… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-4-apps-hub | true | needs-he-field |  |
| D1032 | A Help & Guide panel in the app. The same guide is published at windom.app/guide, in English and Hebrew. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-4-apps-hub | true | needs-he-field |  |
| D1043 | The first release: a working new-tab page, with an account that stays optional | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/blog/windom-1-0-first-release | true | translate |  |
| D1235 | Decisions, and what they cost | text (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | translate |  |
| D1236 | fixture: 3 רשימות, 60% | text (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | needs-he-field |  |
| D1237 | edge-case: רשימה אחת, 20% | text (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | needs-he-field |  |
| D1238 | rendering: רשימה אחת, 20% | text (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | needs-he-field |  |
| D1242 | Fixture text. Everything below exists so the renderer has something to render. A fenced block, shell bash docker compose f docker compose.ym… | text (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | translate |  |
| D1243 | מזהה רשימה 2585f21 | text (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror); id; already in &lt;code>, add dir=ltr |
| D1244 | Fixture text. This one is deliberately long, because the reading bar measures the article rather than the document and a short post cannot s… | text (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | translate |  |
| D1245 | מזהה רשימה 3760d29 | text (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror); id; already in &lt;code>, add dir=ltr |
| D1246 | Fixture text, short on purpose: an article shorter than the viewport has no scroll travel at all, which is the case that makes a progress ba… | text (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | translate |  |
| D1247 | מזהה רשימה b41bb56 | text (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror); id; already in &lt;code>, add dir=ltr |
| D1248 | העתקת קישור אל "Fixture — code, tables and quotes" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1249 | שיתוף "Fixture — code, tables and quotes" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1250 | פתיחת "Fixture — code, tables and quotes" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1251 | פתיחת "Fixture — code, tables and quotes" | attr:title (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1252 | העתקת קישור אל "Fixture — a long read" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1253 | שיתוף "Fixture — a long read" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1254 | פתיחת "Fixture — a long read" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1255 | פתיחת "Fixture — a long read" | attr:title (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1256 | העתקת קישור אל "Fixture — shorter than the viewport" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1257 | שיתוף "Fixture — shorter than the viewport" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1258 | פתיחת "Fixture — shorter than the viewport" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1259 | פתיחת "Fixture — shorter than the viewport" | attr:title (open:תפריט, open:עיון) | content-store | /he/blog/area/site | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1274 | docs/guide/index.md | text (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | needs-he-field |  |
| D1275 | docs/guide/installing.md | text (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | needs-he-field |  |
| D1276 | docs/guide/the-console.md | text (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | needs-he-field |  |
| D1277 | docs/guide/roles.md | text (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | needs-he-field |  |
| D1278 | docs/guide/upgrading.md | text (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | needs-he-field |  |
| D1280 | self-hosting: 4 רשימות, 21% | text (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | needs-he-field |  |
| D1281 | docker: 3 רשימות, 16% | text (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | needs-he-field |  |
| D1282 | release: 2 רשימות, 11% | text (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | needs-he-field |  |
| D1283 | Bothy's updater deploys only what the main branch already pins. It checks before, snapshots, verifies by response body, rolls back on failur… | text (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | translate |  |
| D1284 | מזהה רשימה 53523e5 | text (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror); id; already in &lt;code>, add dir=ltr |
| D1285 | Bothy can restart, stop and start a container, and nothing else. The missing exec is a deliberate regression, and the limit is enforced in p… | text (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | translate |  |
| D1286 | מזהה רשימה c569e5e | text (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror); id; already in &lt;code>, add dir=ltr |
| D1287 | מזהה רשימה e008820 | text (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror); id; already in &lt;code>, add dir=ltr |
| D1288 | Bothy goes from eight containers to five, gains a Kubernetes console with 29 audited actions, moves to VictoriaMetrics and Alloy, and ships … | text (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | translate |  |
| D1289 | מזהה רשימה 66b9065 | text (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror); id; already in &lt;code>, add dir=ltr |
| D1290 | The first tagged release of Bothy: a console discovered from Docker, local single sign-on with four roles, the bothy CLI, and an install wit… | text (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | translate |  |
| D1291 | מזהה רשימה 3c5691a | text (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror); id; already in &lt;code>, add dir=ltr |
| D1292 | העתקת קישור אל "An updater that cannot choose the version" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | translate | mixed run in an attribute (cannot be isolated with markup) |
| D1293 | שיתוף "An updater that cannot choose the version" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | translate | mixed run in an attribute (cannot be isolated with markup) |
| D1294 | פתיחת "An updater that cannot choose the version" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | translate | mixed run in an attribute (cannot be isolated with markup) |
| D1295 | פתיחת "An updater that cannot choose the version" | attr:title (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | translate | mixed run in an attribute (cannot be isolated with markup) |
| D1296 | העתקת קישור אל "Why Bothy has no shell in the browser" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | translate | mixed run in an attribute (cannot be isolated with markup) |
| D1297 | שיתוף "Why Bothy has no shell in the browser" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | translate | mixed run in an attribute (cannot be isolated with markup) |
| D1298 | פתיחת "Why Bothy has no shell in the browser" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | translate | mixed run in an attribute (cannot be isolated with markup) |
| D1299 | פתיחת "Why Bothy has no shell in the browser" | attr:title (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | translate | mixed run in an attribute (cannot be isolated with markup) |
| D1300 | העתקת קישור אל "Bothy asks Docker what is running" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1301 | שיתוף "Bothy asks Docker what is running" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1302 | פתיחת "Bothy asks Docker what is running" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1303 | פתיחת "Bothy asks Docker what is running" | attr:title (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1304 | העתקת קישור אל "Bothy 2026.9: five services, a cluster console, and a guide" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | translate | mixed run in an attribute (cannot be isolated with markup) |
| D1305 | שיתוף "Bothy 2026.9: five services, a cluster console, and a guide" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | translate | mixed run in an attribute (cannot be isolated with markup) |
| D1306 | פתיחת "Bothy 2026.9: five services, a cluster console, and a guide" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | translate | mixed run in an attribute (cannot be isolated with markup) |
| D1307 | פתיחת "Bothy 2026.9: five services, a cluster console, and a guide" | attr:title (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | translate | mixed run in an attribute (cannot be isolated with markup) |
| D1308 | העתקת קישור אל "Bothy 2026.8: the first release" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1309 | שיתוף "Bothy 2026.8: the first release" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1310 | פתיחת "Bothy 2026.8: the first release" | attr:aria-label (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| D1311 | פתיחת "Bothy 2026.8: the first release" | attr:title (open:תפריט, open:עיון) | content-store | /he/blog/area/bothy | false | needs-he-field | mixed run in an attribute (cannot be isolated with markup) |
| DB01 | Note body (12 English blocks): "WindoM 1.4 added a Gmail widget: an unread count and the most recent messages, o…" | text | content-store | /he/blog/windom-gmail-withdrawn-for-licensing | mixed | translate | needs he.body (the field exists; empty for every note) |
| DB02 | Note body (13 English blocks): "docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d node backen…" | text | content-store | /he/blog/fixture-rendering | mixed | translate | dev fixture, not real content |
| DB03 | Note body (13 English blocks): "v2026.9.0 is a reorganisation. Bothy's own footprint got smaller while the conso…" | text | content-store | /he/blog/bothy-2026-9-five-services | mixed | translate | needs he.body (the field exists; empty for every note) |
| DB04 | Note body (16 English blocks): "This note covers 1.2 and 1.3 together. 1.2 was a short release of account contro…" | text | content-store | /he/blog/windom-1-3-weather-without-a-key | mixed | translate | needs he.body (the field exists; empty for every note) |
| DB05 | Note body (12 English blocks): "Bothy's Control page can do three things to a container: restart it, stop it, an…" | text | content-store | /he/blog/bothy-no-shell-in-the-browser | mixed | translate | needs he.body (the field exists; empty for every note) |
| DB06 | Note body (19 English blocks): "Two meanings of 401…" | text | content-store | /he/blog/windom-provider-401-is-not-a-session | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip; needs he.body (the field exists; empty for every note) |
| DB07 | Note body (12 English blocks): "1.5.0 and 1.5.1 shipped on the same day, so they share a note. 1.5.0 is the visi…" | text | content-store | /he/blog/windom-1-5-computed-glass | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip; needs he.body (the field exists; empty for every note) |
| DB08 | Note body (16 English blocks): "Bothy's first tagged release is v2026.8.1. Bothy is a console for one machine: i…" | text | content-store | /he/blog/bothy-2026-8-first-release | mixed | translate | needs he.body (the field exists; empty for every note) |
| DB09 | Note body (11 English blocks): "WindoM 1.1 is about the account earning its place. If you sign in, your setup no…" | text | content-store | /he/blog/windom-1-1-settings-sync | mixed | translate | needs he.body (the field exists; empty for every note) |
| DB10 | Note body (13 English blocks): "Most dashboards for a single machine start as a list. Someone writes down the se…" | text | content-store | /he/blog/bothy-asks-docker | mixed | translate | needs he.body (the field exists; empty for every note) |
| DB11 | Note body (20 English blocks): "WindoM's panes are glass. For most of the project's life that meant what it usua…" | text | content-store | /he/blog/windom-glass-as-optics | mixed | translate | needs he.body (the field exists; empty for every note) |
| DB12 | Note body (12 English blocks): "Most of 1.4.1 is invisible by design. It is a hardening and reliability release:…" | text | content-store | /he/blog/windom-1-4-1-reliability | mixed | translate | needs he.body (the field exists; empty for every note) |
| DB13 | Note body (15 English blocks): "1.4 is the release where WindoM stopped being a set of widgets and started being…" | text | content-store | /he/blog/windom-1-4-apps-hub | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip; needs he.body (the field exists; empty for every note) |
| D0159 | גרסה אחרונה: v1.5.1 | attr:title (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | github | /he/projects/windom | false | keep-latin | mixed run in an attribute (cannot be isolated with markup); release tag from GitHub; keep, isolate |
| D0621 | גרסה אחרונה: v2026.9.0 | attr:title (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | github | /he/projects/bothy | false | keep-latin | mixed run in an attribute (cannot be isolated with markup); release tag from GitHub; keep, isolate |
| D0935 | גרסה v1.5.1, השבוע שעבר | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | github | /he/projects | false | keep-latin | release tag from GitHub; keep, isolate |
| D0936 | גרסה v2026.9.0, לפני חודשיים (2) | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | github | /he/projects | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror); release tag from GitHub; keep, isolate |
| D0939 | גרסה v1.5.1 · 26 באוקטובר 2026 בשעה 15:50 | attr:title (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | github | /he/projects | false | keep-latin | mixed run in an attribute (cannot be isolated with markup); release tag from GitHub; keep, isolate |
| D0940 | גרסה אחרונה: v1.5.1 | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | github | /he/projects | false | keep-latin | mixed run in an attribute (cannot be isolated with markup); release tag from GitHub; keep, isolate |
| D0942 | גרסה v2026.9.0 · 19 בספטמבר 2026 בשעה 0:03 | attr:title (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | github | /he/projects | false | keep-latin | mixed run in an attribute (cannot be isolated with markup); release tag from GitHub; keep, isolate |
| D0943 | גרסה אחרונה: v2026.9.0 | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | github | /he/projects | false | keep-latin | mixed run in an attribute (cannot be isolated with markup); release tag from GitHub; keep, isolate |
| R066 | Yehuda Briskman | server-render jsonld:author.name | seo | 16 routes (/he/blog/bothy-updates-deploy-what-main-pins, /he/blog/bothy-no-shell-in-the-browser, …) | n/a | keep-latin |  |
| R067 | Yehuda Briskman | server-render jsonld:publisher.name | seo | 14 routes (/he/blog/bothy-updates-deploy-what-main-pins, /he/blog/bothy-no-shell-in-the-browser, …) | n/a | keep-latin |  |
| R208 | 200 en | server-render feed:status | seo | 5 routes (/api/seo/feed.xml, /api/seo/feed/log.xml, …) | n/a | translate |  |
| R039 | RSS | server-render body | seo | 4 routes (/he/blog/log, /he/blog/area/site, …) | false | keep-latin |  |
| R158 | windom, release, chrome-extension | server-render jsonld:keywords | seo | /he/blog/windom-1-4-apps-hub, /he/blog/windom-1-1-settings-sync, /he/blog/windom-1-0-first-release | n/a | needs-he-field |  |
| D0624 | Bothy · Yehuda Briskman | head:title | seo | /he/blog/area/bothy, /he/projects/bothy | n/a | keep-latin |  |
| R047 | Every new tab becomes a dashboard | server-render head:description | seo | /he/blog/area/windom, /he/projects/windom | n/a | needs-he-field |  |
| R049 | Every new tab becomes a dashboard | server-render head:og:description | seo | /he/blog/area/windom, /he/projects/windom | n/a | needs-he-field |  |
| R051 | Every new tab becomes a dashboard | server-render head:twitter:description | seo | /he/blog/area/windom, /he/projects/windom | n/a | needs-he-field |  |
| R053 | A console for one machine that asks Docker what is running | server-render head:description | seo | /he/blog/area/bothy, /he/projects/bothy | n/a | needs-he-field |  |
| R055 | A console for one machine that asks Docker what is running | server-render head:og:description | seo | /he/blog/area/bothy, /he/projects/bothy | n/a | needs-he-field |  |
| R057 | A console for one machine that asks Docker what is running | server-render head:twitter:description | seo | /he/blog/area/bothy, /he/projects/bothy | n/a | needs-he-field |  |
| R209 | Yehuda Briskman · Notes | server-render feed:channel-title | seo | /api/seo/feed.xml, /api/seo/feed/site.xml | n/a | keep-latin |  |
| D0071 | Yehuda Briskman · מהנדס פול־סטאק וראש צוות טכני | head:title | seo | /he | n/a | keep-latin |  |
| D0080 | פרויקטים · Yehuda Briskman | head:title | seo | /he/projects | n/a | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0110 | WindoM · Yehuda Briskman | head:title | seo | /he/projects/windom | n/a | keep-latin |  |
| D0113 | בלוג · Yehuda Briskman | head:title | seo | /he/blog | n/a | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0116 | Windom · Yehuda Briskman | head:title | seo | /he/blog/area/windom | n/a | keep-latin |  |
| D0120 | יומן פעילות · Yehuda Briskman | head:title | seo | /he/blog/log | n/a | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0121 | Bothy updates deploy what main pins · Yehuda Briskman | head:title | seo | /he/blog/bothy-updates-deploy-what-main-pins | n/a | translate |  |
| D0140 | מסלול מקצועי · Yehuda Briskman | head:title | seo | /he/story | n/a | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0170 | Icaros · Yehuda Briskman | head:title | seo | /he/projects/icaros | n/a | keep-latin |  |
| D0171 | Site · Yehuda Briskman | head:title | seo | /he/blog/area/site | n/a | translate |  |
| D0198 | Why the Gmail widget was withdrawn · Yehuda Briskman | head:title | seo | /he/blog/windom-gmail-withdrawn-for-licensing | n/a | translate |  |
| D0233 | Fixture — code, tables and quotes · Yehuda Briskman | head:title | seo | /he/blog/fixture-rendering | n/a | translate |  |
| D0266 | Bothy 2026.9: five services, a cluster console, and a guide · Yehuda Briskman | head:title | seo | /he/blog/bothy-2026-9-five-services | n/a | translate |  |
| D0289 | WindoM 1.3: weather without a key, and accounts you can recover · Yehuda Briskman | head:title | seo | /he/blog/windom-1-3-weather-without-a-key | n/a | translate |  |
| D0292 | נגישות · Yehuda Briskman | head:title | seo | /he/accessibility | n/a | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0293 | A note that does not exist · Yehuda Briskman | head:title | seo | /he/blog/a-note-that-does-not-exist | n/a | translate |  |
| D0681 | Why Bothy has no shell in the browser · Yehuda Briskman | head:title | seo | /he/blog/bothy-no-shell-in-the-browser | n/a | translate |  |
| D0705 | A provider's 401 is not a signed-out user · Yehuda Briskman | head:title | seo | /he/blog/windom-provider-401-is-not-a-session | n/a | translate |  |
| D0728 | WindoM 1.5: computed glass, and Gmail withdrawn · Yehuda Briskman | head:title | seo | /he/blog/windom-1-5-computed-glass | n/a | translate |  |
| D0754 | Bothy 2026.8: the first release · Yehuda Briskman | head:title | seo | /he/blog/bothy-2026-8-first-release | n/a | translate |  |
| D0769 | WindoM 1.1: settings that follow you · Yehuda Briskman | head:title | seo | /he/blog/windom-1-1-settings-sync | n/a | translate |  |
| D0952 | Programming with Yehuda · Yehuda Briskman | head:title | seo | /he/projects/programming-with-yehuda | n/a | translate |  |
| D0976 | Bothy asks Docker what is running · Yehuda Briskman | head:title | seo | /he/blog/bothy-asks-docker | n/a | translate |  |
| D1001 | The glass is computed, not decorated · Yehuda Briskman | head:title | seo | /he/blog/windom-glass-as-optics | n/a | translate |  |
| D1021 | WindoM 1.4.1: a release about not breaking · Yehuda Briskman | head:title | seo | /he/blog/windom-1-4-1-reliability | n/a | translate |  |
| D1041 | WindoM 1.4: the Apps Hub, markets and a first-run guide · Yehuda Briskman | head:title | seo | /he/blog/windom-1-4-apps-hub | n/a | translate |  |
| D1044 | WindoM 1.0: the new tab as a dashboard · Yehuda Briskman | head:title | seo | /he/blog/windom-1-0-first-release | n/a | translate |  |
| D1047 | An area that does not exist · Yehuda Briskman | head:title | seo | /he/blog/area/an-area-that-does-not-exist | n/a | translate |  |
| D1260 | Notes · Yehuda Briskman | head:title | seo | /he/blog/area/site | n/a | translate |  |
| D1264 | Windom 1 3 weather without a key · Yehuda Briskman | head:title | seo | /he/blog/windom-1-3-weather-without-a-key | n/a | translate |  |
| D1272 | Bothy no shell in the browser · Yehuda Briskman | head:title | seo | /he/blog/bothy-no-shell-in-the-browser | n/a | translate |  |
| D1273 | Windom provider 401 is not a session · Yehuda Briskman | head:title | seo | /he/blog/windom-provider-401-is-not-a-session | n/a | translate |  |
| D1312 | Windom 1 4 apps hub · Yehuda Briskman | head:title | seo | /he/blog/windom-1-4-apps-hub | n/a | translate |  |
| D1313 | Windom 1 0 first release · Yehuda Briskman | head:title | seo | /he/blog/windom-1-0-first-release | n/a | translate |  |
| R001 | Yehuda Briskman · מהנדס פול־סטאק וראש צוות טכני | server-render head:title | seo | /he | n/a | keep-latin |  |
| R002 | Yehuda Briskman · מהנדס פול־סטאק וראש צוות טכני | server-render head:og:title | seo | /he | n/a | keep-latin |  |
| R003 | Yehuda Briskman · מהנדס פול־סטאק וראש צוות טכני | server-render head:twitter:title | seo | /he | n/a | keep-latin |  |
| R004 | Yehuda Briskman | server-render jsonld:@graph[0].name | seo | /he | n/a | keep-latin |  |
| R005 | Tel Aviv | server-render jsonld:@graph[0].address.addressLocality | seo | /he | n/a | needs-he-field |  |
| R006 | Yehuda Briskman | server-render jsonld:@graph[1].name | seo | /he | n/a | keep-latin |  |
| R007 | מקום: Tel Aviv, Israel. | server-render body | seo | /he | false | translate |  |
| R008 | בלוג · Yehuda Briskman | server-render head:title | seo | /he/blog | n/a | keep-latin |  |
| R009 | בלוג · Yehuda Briskman | server-render head:og:title | seo | /he/blog | n/a | keep-latin |  |
| R010 | בלוג · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog | n/a | keep-latin |  |
| R011 | פרויקטים · Yehuda Briskman | server-render head:title | seo | /he/projects | n/a | keep-latin |  |
| R012 | פרויקטים · Yehuda Briskman | server-render head:og:title | seo | /he/projects | n/a | keep-latin |  |
| R013 | פרויקטים · Yehuda Briskman | server-render head:twitter:title | seo | /he/projects | n/a | keep-latin |  |
| R014 | מסלול מקצועי · Yehuda Briskman | server-render head:title | seo | /he/story | n/a | keep-latin |  |
| R015 | מסלול מקצועי · Yehuda Briskman | server-render head:og:title | seo | /he/story | n/a | keep-latin |  |
| R016 | מסלול מקצועי · Yehuda Briskman | server-render head:twitter:title | seo | /he/story | n/a | keep-latin |  |
| R017 | Yehuda Briskman | server-render jsonld:mainEntity.name | seo | /he/story | n/a | keep-latin |  |
| R018 | Tel Aviv | server-render jsonld:mainEntity.address.addressLocality | seo | /he/story | n/a | needs-he-field |  |
| R019 | נגישות · Yehuda Briskman | server-render head:title | seo | /he/accessibility | n/a | keep-latin |  |
| R020 | הצהרת נגישות: האתר שואף לעמוד ב־WCAG 2.2 ברמה AA, הכוללת את התקן הישראלי ת״י 5568, ואיך לדווח על מחסום. | server-render head:description | seo | /he/accessibility | n/a | needs-he-field |  |
| R021 | נגישות · Yehuda Briskman | server-render head:og:title | seo | /he/accessibility | n/a | keep-latin |  |
| R022 | הצהרת נגישות: האתר שואף לעמוד ב־WCAG 2.2 ברמה AA, הכוללת את התקן הישראלי ת״י 5568, ואיך לדווח על מחסום. | server-render head:og:description | seo | /he/accessibility | n/a | needs-he-field |  |
| R023 | נגישות · Yehuda Briskman | server-render head:twitter:title | seo | /he/accessibility | n/a | keep-latin |  |
| R024 | הצהרת נגישות: האתר שואף לעמוד ב־WCAG 2.2 ברמה AA, הכוללת את התקן הישראלי ת״י 5568, ואיך לדווח על מחסום. | server-render head:twitter:description | seo | /he/accessibility | n/a | needs-he-field |  |
| R025 | האתר שואף לעמוד בהנחיות הנגישות לתוכן אינטרנט (WCAG) 2.2 ברמה AA, הכוללת את התקן הישראלי ת״י 5568 (WCAG 2.0 ברמה AA). הבדיקה נעשתה בידי כותב… | server-render body | seo | /he/accessibility | false | translate |  |
| R036 | יומן פעילות · Yehuda Briskman | server-render head:title | seo | /he/blog/log | n/a | keep-latin |  |
| R037 | יומן פעילות · Yehuda Briskman | server-render head:og:title | seo | /he/blog/log | n/a | keep-latin |  |
| R038 | יומן פעילות · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog/log | n/a | keep-latin |  |
| R040 | Notes · רשימות · Yehuda Briskman | server-render head:title | seo | /he/blog/area/site | n/a | needs-he-field |  |
| R041 | Decisions, and what they cost | server-render head:description | seo | /he/blog/area/site | n/a | needs-he-field |  |
| R042 | Notes · רשימות · Yehuda Briskman | server-render head:og:title | seo | /he/blog/area/site | n/a | needs-he-field |  |
| R043 | Decisions, and what they cost | server-render head:og:description | seo | /he/blog/area/site | n/a | needs-he-field |  |
| R044 | Notes · רשימות · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog/area/site | n/a | needs-he-field |  |
| R045 | Decisions, and what they cost | server-render head:twitter:description | seo | /he/blog/area/site | n/a | needs-he-field |  |
| R046 | WindoM · רשימות · Yehuda Briskman | server-render head:title | seo | /he/blog/area/windom | n/a | needs-he-field |  |
| R048 | WindoM · רשימות · Yehuda Briskman | server-render head:og:title | seo | /he/blog/area/windom | n/a | needs-he-field |  |
| R050 | WindoM · רשימות · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog/area/windom | n/a | needs-he-field |  |
| R052 | Bothy · רשימות · Yehuda Briskman | server-render head:title | seo | /he/blog/area/bothy | n/a | needs-he-field |  |
| R054 | Bothy · רשימות · Yehuda Briskman | server-render head:og:title | seo | /he/blog/area/bothy | n/a | needs-he-field |  |
| R056 | Bothy · רשימות · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog/area/bothy | n/a | needs-he-field |  |
| R058 | An updater that cannot choose the version · Yehuda Briskman | server-render head:title | seo | /he/blog/bothy-updates-deploy-what-main-pins | n/a | needs-he-field |  |
| R059 | Bothy&apos;s updater deploys only what the main branch already pins. It checks before, snapshots, verifies by response body, rolls back on f… | server-render head:description | seo | /he/blog/bothy-updates-deploy-what-main-pins | n/a | needs-he-field |  |
| R060 | An updater that cannot choose the version · Yehuda Briskman | server-render head:og:title | seo | /he/blog/bothy-updates-deploy-what-main-pins | n/a | needs-he-field |  |
| R061 | Bothy&apos;s updater deploys only what the main branch already pins. It checks before, snapshots, verifies by response body, rolls back on f… | server-render head:og:description | seo | /he/blog/bothy-updates-deploy-what-main-pins | n/a | needs-he-field |  |
| R062 | An updater that cannot choose the version · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog/bothy-updates-deploy-what-main-pins | n/a | needs-he-field |  |
| R063 | Bothy&apos;s updater deploys only what the main branch already pins. It checks before, snapshots, verifies by response body, rolls back on f… | server-render head:twitter:description | seo | /he/blog/bothy-updates-deploy-what-main-pins | n/a | needs-he-field |  |
| R064 | An updater that cannot choose the version | server-render jsonld:headline | seo | /he/blog/bothy-updates-deploy-what-main-pins | n/a | needs-he-field |  |
| R065 | Bothy's updater deploys only what the main branch already pins. It checks before, snapshots, verifies by response body, rolls back on failur… | server-render jsonld:description | seo | /he/blog/bothy-updates-deploy-what-main-pins | n/a | needs-he-field |  |
| R068 | bothy, updates, ci, self-hosting | server-render jsonld:keywords | seo | /he/blog/bothy-updates-deploy-what-main-pins | n/a | needs-he-field |  |
| R069 | Why Bothy has no shell in the browser · Yehuda Briskman | server-render head:title | seo | /he/blog/bothy-no-shell-in-the-browser | n/a | needs-he-field |  |
| R070 | Bothy can restart, stop and start a container, and nothing else. The missing exec is a deliberate regression, and the limit is enforced in p… | server-render head:description | seo | /he/blog/bothy-no-shell-in-the-browser | n/a | needs-he-field |  |
| R071 | Why Bothy has no shell in the browser · Yehuda Briskman | server-render head:og:title | seo | /he/blog/bothy-no-shell-in-the-browser | n/a | needs-he-field |  |
| R072 | Bothy can restart, stop and start a container, and nothing else. The missing exec is a deliberate regression, and the limit is enforced in p… | server-render head:og:description | seo | /he/blog/bothy-no-shell-in-the-browser | n/a | needs-he-field |  |
| R073 | Why Bothy has no shell in the browser · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog/bothy-no-shell-in-the-browser | n/a | needs-he-field |  |
| R074 | Bothy can restart, stop and start a container, and nothing else. The missing exec is a deliberate regression, and the limit is enforced in p… | server-render head:twitter:description | seo | /he/blog/bothy-no-shell-in-the-browser | n/a | needs-he-field |  |
| R075 | Why Bothy has no shell in the browser | server-render jsonld:headline | seo | /he/blog/bothy-no-shell-in-the-browser | n/a | needs-he-field |  |
| R076 | Bothy can restart, stop and start a container, and nothing else. The missing exec is a deliberate regression, and the limit is enforced in p… | server-render jsonld:description | seo | /he/blog/bothy-no-shell-in-the-browser | n/a | needs-he-field |  |
| R077 | bothy, security, docker, testing | server-render jsonld:keywords | seo | /he/blog/bothy-no-shell-in-the-browser | n/a | needs-he-field |  |
| R078 | Bothy asks Docker what is running · Yehuda Briskman | server-render head:title | seo | /he/blog/bothy-asks-docker | n/a | needs-he-field |  |
| R079 | A console for one machine is usually a hand-written list, wrong from the first container that moves. Bothy has no list: it joins two read-on… | server-render head:description | seo | /he/blog/bothy-asks-docker | n/a | needs-he-field |  |
| R080 | Bothy asks Docker what is running · Yehuda Briskman | server-render head:og:title | seo | /he/blog/bothy-asks-docker | n/a | needs-he-field |  |
| R081 | A console for one machine is usually a hand-written list, wrong from the first container that moves. Bothy has no list: it joins two read-on… | server-render head:og:description | seo | /he/blog/bothy-asks-docker | n/a | needs-he-field |  |
| R082 | Bothy asks Docker what is running · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog/bothy-asks-docker | n/a | needs-he-field |  |
| R083 | A console for one machine is usually a hand-written list, wrong from the first container that moves. Bothy has no list: it joins two read-on… | server-render head:twitter:description | seo | /he/blog/bothy-asks-docker | n/a | needs-he-field |  |
| R084 | Bothy asks Docker what is running | server-render jsonld:headline | seo | /he/blog/bothy-asks-docker | n/a | needs-he-field |  |
| R085 | A console for one machine is usually a hand-written list, wrong from the first container that moves. Bothy has no list: it joins two read-on… | server-render jsonld:description | seo | /he/blog/bothy-asks-docker | n/a | needs-he-field |  |
| R086 | bothy, docker, self-hosting | server-render jsonld:keywords | seo | /he/blog/bothy-asks-docker | n/a | needs-he-field |  |
| R087 | Why the Gmail widget was withdrawn · Yehuda Briskman | server-render head:title | seo | /he/blog/windom-gmail-withdrawn-for-licensing | n/a | needs-he-field |  |
| R088 | Reading mail needs a Google scope that requires a recurring third-party security assessment. WindoM switched the widget off behind a flag in… | server-render head:description | seo | /he/blog/windom-gmail-withdrawn-for-licensing | n/a | needs-he-field |  |
| R089 | Why the Gmail widget was withdrawn · Yehuda Briskman | server-render head:og:title | seo | /he/blog/windom-gmail-withdrawn-for-licensing | n/a | needs-he-field |  |
| R090 | Reading mail needs a Google scope that requires a recurring third-party security assessment. WindoM switched the widget off behind a flag in… | server-render head:og:description | seo | /he/blog/windom-gmail-withdrawn-for-licensing | n/a | needs-he-field |  |
| R091 | Why the Gmail widget was withdrawn · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog/windom-gmail-withdrawn-for-licensing | n/a | needs-he-field |  |
| R092 | Reading mail needs a Google scope that requires a recurring third-party security assessment. WindoM switched the widget off behind a flag in… | server-render head:twitter:description | seo | /he/blog/windom-gmail-withdrawn-for-licensing | n/a | needs-he-field |  |
| R093 | Why the Gmail widget was withdrawn | server-render jsonld:headline | seo | /he/blog/windom-gmail-withdrawn-for-licensing | n/a | needs-he-field |  |
| R094 | Reading mail needs a Google scope that requires a recurring third-party security assessment. WindoM switched the widget off behind a flag in… | server-render jsonld:description | seo | /he/blog/windom-gmail-withdrawn-for-licensing | n/a | needs-he-field |  |
| R095 | windom, privacy, auth, chrome-extension | server-render jsonld:keywords | seo | /he/blog/windom-gmail-withdrawn-for-licensing | n/a | needs-he-field |  |
| R096 | A provider&apos;s 401 is not a signed-out user · Yehuda Briskman | server-render head:title | seo | /he/blog/windom-provider-401-is-not-a-session | n/a | needs-he-field |  |
| R097 | Signing in to WindoM worked, then undid itself. A stale Calendar or Spotify grant was being read as an expired session, and the refresh stor… | server-render head:description | seo | /he/blog/windom-provider-401-is-not-a-session | n/a | needs-he-field |  |
| R098 | A provider&apos;s 401 is not a signed-out user · Yehuda Briskman | server-render head:og:title | seo | /he/blog/windom-provider-401-is-not-a-session | n/a | needs-he-field |  |
| R099 | Signing in to WindoM worked, then undid itself. A stale Calendar or Spotify grant was being read as an expired session, and the refresh stor… | server-render head:og:description | seo | /he/blog/windom-provider-401-is-not-a-session | n/a | needs-he-field |  |
| R100 | A provider&apos;s 401 is not a signed-out user · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog/windom-provider-401-is-not-a-session | n/a | needs-he-field |  |
| R101 | Signing in to WindoM worked, then undid itself. A stale Calendar or Spotify grant was being read as an expired session, and the refresh stor… | server-render head:twitter:description | seo | /he/blog/windom-provider-401-is-not-a-session | n/a | needs-he-field |  |
| R102 | A provider's 401 is not a signed-out user | server-render jsonld:headline | seo | /he/blog/windom-provider-401-is-not-a-session | n/a | needs-he-field |  |
| R103 | Signing in to WindoM worked, then undid itself. A stale Calendar or Spotify grant was being read as an expired session, and the refresh stor… | server-render jsonld:description | seo | /he/blog/windom-provider-401-is-not-a-session | n/a | needs-he-field |  |
| R104 | windom, auth, testing | server-render jsonld:keywords | seo | /he/blog/windom-provider-401-is-not-a-session | n/a | needs-he-field |  |
| R105 | The glass is computed, not decorated · Yehuda Briskman | server-render head:title | seo | /he/blog/windom-glass-as-optics | n/a | needs-he-field |  |
| R106 | WindoM&apos;s glass bends the wallpaper through Snell&apos;s law instead of faking it with blur and tint. Getting there meant finding the br… | server-render head:description | seo | /he/blog/windom-glass-as-optics | n/a | needs-he-field |  |
| R107 | The glass is computed, not decorated · Yehuda Briskman | server-render head:og:title | seo | /he/blog/windom-glass-as-optics | n/a | needs-he-field |  |
| R108 | WindoM&apos;s glass bends the wallpaper through Snell&apos;s law instead of faking it with blur and tint. Getting there meant finding the br… | server-render head:og:description | seo | /he/blog/windom-glass-as-optics | n/a | needs-he-field |  |
| R109 | The glass is computed, not decorated · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog/windom-glass-as-optics | n/a | needs-he-field |  |
| R110 | WindoM&apos;s glass bends the wallpaper through Snell&apos;s law instead of faking it with blur and tint. Getting there meant finding the br… | server-render head:twitter:description | seo | /he/blog/windom-glass-as-optics | n/a | needs-he-field |  |
| R111 | The glass is computed, not decorated | server-render jsonld:headline | seo | /he/blog/windom-glass-as-optics | n/a | needs-he-field |  |
| R112 | WindoM's glass bends the wallpaper through Snell's law instead of faking it with blur and tint. Getting there meant finding the browser faul… | server-render jsonld:description | seo | /he/blog/windom-glass-as-optics | n/a | needs-he-field |  |
| R113 | windom, css, performance, chrome-extension | server-render jsonld:keywords | seo | /he/blog/windom-glass-as-optics | n/a | needs-he-field |  |
| R114 | WindoM 1.5: computed glass, and Gmail withdrawn · Yehuda Briskman | server-render head:title | seo | /he/blog/windom-1-5-computed-glass | n/a | needs-he-field |  |
| R115 | The glass becomes real refraction, the Gmail widget is withdrawn for a licensing reason, windom.app is rebuilt, and 1.5.1 fixes a sign-in th… | server-render head:description | seo | /he/blog/windom-1-5-computed-glass | n/a | needs-he-field |  |
| R116 | WindoM 1.5: computed glass, and Gmail withdrawn · Yehuda Briskman | server-render head:og:title | seo | /he/blog/windom-1-5-computed-glass | n/a | needs-he-field |  |
| R117 | The glass becomes real refraction, the Gmail widget is withdrawn for a licensing reason, windom.app is rebuilt, and 1.5.1 fixes a sign-in th… | server-render head:og:description | seo | /he/blog/windom-1-5-computed-glass | n/a | needs-he-field |  |
| R118 | WindoM 1.5: computed glass, and Gmail withdrawn · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog/windom-1-5-computed-glass | n/a | needs-he-field |  |
| R119 | The glass becomes real refraction, the Gmail widget is withdrawn for a licensing reason, windom.app is rebuilt, and 1.5.1 fixes a sign-in th… | server-render head:twitter:description | seo | /he/blog/windom-1-5-computed-glass | n/a | needs-he-field |  |
| R120 | WindoM 1.5: computed glass, and Gmail withdrawn | server-render jsonld:headline | seo | /he/blog/windom-1-5-computed-glass | n/a | needs-he-field |  |
| R121 | The glass becomes real refraction, the Gmail widget is withdrawn for a licensing reason, windom.app is rebuilt, and 1.5.1 fixes a sign-in th… | server-render jsonld:description | seo | /he/blog/windom-1-5-computed-glass | n/a | needs-he-field |  |
| R122 | windom, release, chrome-extension, css | server-render jsonld:keywords | seo | /he/blog/windom-1-5-computed-glass | n/a | needs-he-field |  |
| R123 | WindoM 1.4.1: a release about not breaking · Yehuda Briskman | server-render head:title | seo | /he/blog/windom-1-4-1-reliability | n/a | needs-he-field |  |
| R124 | Database migrations leave server startup, health checks start telling the truth, every release passes one shared gate, and users can see and… | server-render head:description | seo | /he/blog/windom-1-4-1-reliability | n/a | needs-he-field |  |
| R125 | WindoM 1.4.1: a release about not breaking · Yehuda Briskman | server-render head:og:title | seo | /he/blog/windom-1-4-1-reliability | n/a | needs-he-field |  |
| R126 | Database migrations leave server startup, health checks start telling the truth, every release passes one shared gate, and users can see and… | server-render head:og:description | seo | /he/blog/windom-1-4-1-reliability | n/a | needs-he-field |  |
| R127 | WindoM 1.4.1: a release about not breaking · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog/windom-1-4-1-reliability | n/a | needs-he-field |  |
| R128 | Database migrations leave server startup, health checks start telling the truth, every release passes one shared gate, and users can see and… | server-render head:twitter:description | seo | /he/blog/windom-1-4-1-reliability | n/a | needs-he-field |  |
| R129 | WindoM 1.4.1: a release about not breaking | server-render jsonld:headline | seo | /he/blog/windom-1-4-1-reliability | n/a | needs-he-field |  |
| R130 | Database migrations leave server startup, health checks start telling the truth, every release passes one shared gate, and users can see and… | server-render jsonld:description | seo | /he/blog/windom-1-4-1-reliability | n/a | needs-he-field |  |
| R131 | windom, release, ci, auth | server-render jsonld:keywords | seo | /he/blog/windom-1-4-1-reliability | n/a | needs-he-field |  |
| R132 | Bothy 2026.9: five services, a cluster console, and a guide · Yehuda Briskman | server-render head:title | seo | /he/blog/bothy-2026-9-five-services | n/a | needs-he-field |  |
| R133 | Bothy goes from eight containers to five, gains a Kubernetes console with 29 audited actions, moves to VictoriaMetrics and Alloy, and ships … | server-render head:description | seo | /he/blog/bothy-2026-9-five-services | n/a | needs-he-field |  |
| R134 | Bothy 2026.9: five services, a cluster console, and a guide · Yehuda Briskman | server-render head:og:title | seo | /he/blog/bothy-2026-9-five-services | n/a | needs-he-field |  |
| R135 | Bothy goes from eight containers to five, gains a Kubernetes console with 29 audited actions, moves to VictoriaMetrics and Alloy, and ships … | server-render head:og:description | seo | /he/blog/bothy-2026-9-five-services | n/a | needs-he-field |  |
| R136 | Bothy 2026.9: five services, a cluster console, and a guide · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog/bothy-2026-9-five-services | n/a | needs-he-field |  |
| R137 | Bothy goes from eight containers to five, gains a Kubernetes console with 29 audited actions, moves to VictoriaMetrics and Alloy, and ships … | server-render head:twitter:description | seo | /he/blog/bothy-2026-9-five-services | n/a | needs-he-field |  |
| R138 | Bothy 2026.9: five services, a cluster console, and a guide | server-render jsonld:headline | seo | /he/blog/bothy-2026-9-five-services | n/a | needs-he-field |  |
| R139 | Bothy goes from eight containers to five, gains a Kubernetes console with 29 audited actions, moves to VictoriaMetrics and Alloy, and ships … | server-render jsonld:description | seo | /he/blog/bothy-2026-9-five-services | n/a | needs-he-field |  |
| R140 | bothy, release, self-hosting, observability | server-render jsonld:keywords | seo | /he/blog/bothy-2026-9-five-services | n/a | needs-he-field |  |
| R141 | Bothy 2026.8: the first release · Yehuda Briskman | server-render head:title | seo | /he/blog/bothy-2026-8-first-release | n/a | needs-he-field |  |
| R142 | The first tagged release of Bothy: a console discovered from Docker, local single sign-on with four roles, the bothy CLI, and an install wit… | server-render head:description | seo | /he/blog/bothy-2026-8-first-release | n/a | needs-he-field |  |
| R143 | Bothy 2026.8: the first release · Yehuda Briskman | server-render head:og:title | seo | /he/blog/bothy-2026-8-first-release | n/a | needs-he-field |  |
| R144 | The first tagged release of Bothy: a console discovered from Docker, local single sign-on with four roles, the bothy CLI, and an install wit… | server-render head:og:description | seo | /he/blog/bothy-2026-8-first-release | n/a | needs-he-field |  |
| R145 | Bothy 2026.8: the first release · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog/bothy-2026-8-first-release | n/a | needs-he-field |  |
| R146 | The first tagged release of Bothy: a console discovered from Docker, local single sign-on with four roles, the bothy CLI, and an install wit… | server-render head:twitter:description | seo | /he/blog/bothy-2026-8-first-release | n/a | needs-he-field |  |
| R147 | Bothy 2026.8: the first release | server-render jsonld:headline | seo | /he/blog/bothy-2026-8-first-release | n/a | needs-he-field |  |
| R148 | The first tagged release of Bothy: a console discovered from Docker, local single sign-on with four roles, the bothy CLI, and an install wit… | server-render jsonld:description | seo | /he/blog/bothy-2026-8-first-release | n/a | needs-he-field |  |
| R149 | bothy, release, self-hosting, docker | server-render jsonld:keywords | seo | /he/blog/bothy-2026-8-first-release | n/a | needs-he-field |  |
| R150 | WindoM 1.4: the Apps Hub, markets and a first-run guide · Yehuda Briskman | server-render head:title | seo | /he/blog/windom-1-4-apps-hub | n/a | needs-he-field |  |
| R151 | Integrations move into one Apps Hub, a finance dashboard arrives for stocks and crypto, and new users get templates, onboarding and a guide … | server-render head:description | seo | /he/blog/windom-1-4-apps-hub | n/a | needs-he-field |  |
| R152 | WindoM 1.4: the Apps Hub, markets and a first-run guide · Yehuda Briskman | server-render head:og:title | seo | /he/blog/windom-1-4-apps-hub | n/a | needs-he-field |  |
| R153 | Integrations move into one Apps Hub, a finance dashboard arrives for stocks and crypto, and new users get templates, onboarding and a guide … | server-render head:og:description | seo | /he/blog/windom-1-4-apps-hub | n/a | needs-he-field |  |
| R154 | WindoM 1.4: the Apps Hub, markets and a first-run guide · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog/windom-1-4-apps-hub | n/a | needs-he-field |  |
| R155 | Integrations move into one Apps Hub, a finance dashboard arrives for stocks and crypto, and new users get templates, onboarding and a guide … | server-render head:twitter:description | seo | /he/blog/windom-1-4-apps-hub | n/a | needs-he-field |  |
| R156 | WindoM 1.4: the Apps Hub, markets and a first-run guide | server-render jsonld:headline | seo | /he/blog/windom-1-4-apps-hub | n/a | needs-he-field |  |
| R157 | Integrations move into one Apps Hub, a finance dashboard arrives for stocks and crypto, and new users get templates, onboarding and a guide … | server-render jsonld:description | seo | /he/blog/windom-1-4-apps-hub | n/a | needs-he-field |  |
| R159 | WindoM 1.3: weather without a key, and accounts you can recover · Yehuda Briskman | server-render head:title | seo | /he/blog/windom-1-3-weather-without-a-key | n/a | needs-he-field |  |
| R160 | Weather moves to Open-Meteo and needs no API key. Accounts gain email verification, password reset and deletion, and both OAuth flows move t… | server-render head:description | seo | /he/blog/windom-1-3-weather-without-a-key | n/a | needs-he-field |  |
| R161 | WindoM 1.3: weather without a key, and accounts you can recover · Yehuda Briskman | server-render head:og:title | seo | /he/blog/windom-1-3-weather-without-a-key | n/a | needs-he-field |  |
| R162 | Weather moves to Open-Meteo and needs no API key. Accounts gain email verification, password reset and deletion, and both OAuth flows move t… | server-render head:og:description | seo | /he/blog/windom-1-3-weather-without-a-key | n/a | needs-he-field |  |
| R163 | WindoM 1.3: weather without a key, and accounts you can recover · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog/windom-1-3-weather-without-a-key | n/a | needs-he-field |  |
| R164 | Weather moves to Open-Meteo and needs no API key. Accounts gain email verification, password reset and deletion, and both OAuth flows move t… | server-render head:twitter:description | seo | /he/blog/windom-1-3-weather-without-a-key | n/a | needs-he-field |  |
| R165 | WindoM 1.3: weather without a key, and accounts you can recover | server-render jsonld:headline | seo | /he/blog/windom-1-3-weather-without-a-key | n/a | needs-he-field |  |
| R166 | Weather moves to Open-Meteo and needs no API key. Accounts gain email verification, password reset and deletion, and both OAuth flows move t… | server-render jsonld:description | seo | /he/blog/windom-1-3-weather-without-a-key | n/a | needs-he-field |  |
| R167 | windom, release, chrome-extension, auth | server-render jsonld:keywords | seo | /he/blog/windom-1-3-weather-without-a-key | n/a | needs-he-field |  |
| R168 | WindoM 1.1: settings that follow you · Yehuda Briskman | server-render head:title | seo | /he/blog/windom-1-1-settings-sync | n/a | needs-he-field |  |
| R169 | WindoM 1.1 syncs preferences to your account, fixes several ways a signed-in user could be disconnected, adds a command palette, and lays do… | server-render head:description | seo | /he/blog/windom-1-1-settings-sync | n/a | needs-he-field |  |
| R170 | WindoM 1.1: settings that follow you · Yehuda Briskman | server-render head:og:title | seo | /he/blog/windom-1-1-settings-sync | n/a | needs-he-field |  |
| R171 | WindoM 1.1 syncs preferences to your account, fixes several ways a signed-in user could be disconnected, adds a command palette, and lays do… | server-render head:og:description | seo | /he/blog/windom-1-1-settings-sync | n/a | needs-he-field |  |
| R172 | WindoM 1.1: settings that follow you · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog/windom-1-1-settings-sync | n/a | needs-he-field |  |
| R173 | WindoM 1.1 syncs preferences to your account, fixes several ways a signed-in user could be disconnected, adds a command palette, and lays do… | server-render head:twitter:description | seo | /he/blog/windom-1-1-settings-sync | n/a | needs-he-field |  |
| R174 | WindoM 1.1: settings that follow you | server-render jsonld:headline | seo | /he/blog/windom-1-1-settings-sync | n/a | needs-he-field |  |
| R175 | WindoM 1.1 syncs preferences to your account, fixes several ways a signed-in user could be disconnected, adds a command palette, and lays do… | server-render jsonld:description | seo | /he/blog/windom-1-1-settings-sync | n/a | needs-he-field |  |
| R176 | WindoM 1.0: the new tab as a dashboard · Yehuda Briskman | server-render head:title | seo | /he/blog/windom-1-0-first-release | n/a | needs-he-field |  |
| R177 | WindoM 1.0 replaces Chrome&apos;s empty new tab with a dashboard: clock, weather, tasks, calendar, music, quick links and a focus timer, wit… | server-render head:description | seo | /he/blog/windom-1-0-first-release | n/a | needs-he-field |  |
| R178 | WindoM 1.0: the new tab as a dashboard · Yehuda Briskman | server-render head:og:title | seo | /he/blog/windom-1-0-first-release | n/a | needs-he-field |  |
| R179 | WindoM 1.0 replaces Chrome&apos;s empty new tab with a dashboard: clock, weather, tasks, calendar, music, quick links and a focus timer, wit… | server-render head:og:description | seo | /he/blog/windom-1-0-first-release | n/a | needs-he-field |  |
| R180 | WindoM 1.0: the new tab as a dashboard · Yehuda Briskman | server-render head:twitter:title | seo | /he/blog/windom-1-0-first-release | n/a | needs-he-field |  |
| R181 | WindoM 1.0 replaces Chrome&apos;s empty new tab with a dashboard: clock, weather, tasks, calendar, music, quick links and a focus timer, wit… | server-render head:twitter:description | seo | /he/blog/windom-1-0-first-release | n/a | needs-he-field |  |
| R182 | WindoM 1.0: the new tab as a dashboard | server-render jsonld:headline | seo | /he/blog/windom-1-0-first-release | n/a | needs-he-field |  |
| R183 | WindoM 1.0 replaces Chrome's empty new tab with a dashboard: clock, weather, tasks, calendar, music, quick links and a focus timer, with an … | server-render jsonld:description | seo | /he/blog/windom-1-0-first-release | n/a | needs-he-field |  |
| R184 | WindoM · Yehuda Briskman | server-render head:title | seo | /he/projects/windom | n/a | needs-he-field |  |
| R185 | WindoM · Yehuda Briskman | server-render head:og:title | seo | /he/projects/windom | n/a | needs-he-field |  |
| R186 | WindoM · Yehuda Briskman | server-render head:twitter:title | seo | /he/projects/windom | n/a | needs-he-field |  |
| R187 | WindoM | server-render jsonld:name | seo | /he/projects/windom | n/a | keep-latin |  |
| R188 | Every new tab becomes a dashboard | server-render jsonld:description | seo | /he/projects/windom | n/a | needs-he-field |  |
| R189 | TypeScript | server-render jsonld:programmingLanguage | seo | /he/projects/windom | n/a | needs-he-field |  |
| R190 | Bothy · Yehuda Briskman | server-render head:title | seo | /he/projects/bothy | n/a | needs-he-field |  |
| R191 | Bothy · Yehuda Briskman | server-render head:og:title | seo | /he/projects/bothy | n/a | needs-he-field |  |
| R192 | Bothy · Yehuda Briskman | server-render head:twitter:title | seo | /he/projects/bothy | n/a | needs-he-field |  |
| R193 | Bothy | server-render jsonld:name | seo | /he/projects/bothy | n/a | keep-latin |  |
| R194 | A console for one machine that asks Docker what is running | server-render jsonld:description | seo | /he/projects/bothy | n/a | needs-he-field |  |
| R195 | Python | server-render jsonld:programmingLanguage | seo | /he/projects/bothy | n/a | needs-he-field |  |
| R196 | Programming with Yehuda · Yehuda Briskman | server-render head:title | seo | /he/projects/programming-with-yehuda | n/a | needs-he-field |  |
| R197 | Lesson pages built while learning React and Node | server-render head:description | seo | /he/projects/programming-with-yehuda | n/a | needs-he-field |  |
| R198 | Programming with Yehuda · Yehuda Briskman | server-render head:og:title | seo | /he/projects/programming-with-yehuda | n/a | needs-he-field |  |
| R199 | Lesson pages built while learning React and Node | server-render head:og:description | seo | /he/projects/programming-with-yehuda | n/a | needs-he-field |  |
| R200 | Programming with Yehuda · Yehuda Briskman | server-render head:twitter:title | seo | /he/projects/programming-with-yehuda | n/a | needs-he-field |  |
| R201 | Lesson pages built while learning React and Node | server-render head:twitter:description | seo | /he/projects/programming-with-yehuda | n/a | needs-he-field |  |
| R202 | Icaros · Yehuda Briskman | server-render head:title | seo | /he/projects/icaros | n/a | needs-he-field |  |
| R203 | A car-listing web app, built while learning React and Node | server-render head:description | seo | /he/projects/icaros | n/a | needs-he-field |  |
| R204 | Icaros · Yehuda Briskman | server-render head:og:title | seo | /he/projects/icaros | n/a | needs-he-field |  |
| R205 | A car-listing web app, built while learning React and Node | server-render head:og:description | seo | /he/projects/icaros | n/a | needs-he-field |  |
| R206 | Icaros · Yehuda Briskman | server-render head:twitter:title | seo | /he/projects/icaros | n/a | needs-he-field |  |
| R207 | A car-listing web app, built while learning React and Node | server-render head:twitter:description | seo | /he/projects/icaros | n/a | needs-he-field |  |
| R210 | Yehuda Briskman · Channel log | server-render feed:channel-title | seo | /api/seo/feed/log.xml | n/a | keep-latin |  |
| R211 | Yehuda Briskman · WindoM | server-render feed:channel-title | seo | /api/seo/feed/windom.xml | n/a | keep-latin |  |
| R212 | Yehuda Briskman · Bothy | server-render feed:channel-title | seo | /api/seo/feed/bothy.xml | n/a | keep-latin |  |
| R213 | 404 no &lt;language> | server-render feed:status | seo | /api/seo/he/feed.xml | n/a | translate |  |
| D0252 | upgrade | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | unknown | /he/blog/bothy-2026-8-first-release, /he/blog/bothy-2026-9-five-services | true | keep-latin |  |
| D0667 | viewer | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | unknown | /he/blog/bothy-2026-8-first-release, /he/blog/bothy-no-shell-in-the-browser | true | keep-latin |  |
| D0668 | editor | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | unknown | /he/blog/bothy-2026-8-first-release, /he/blog/bothy-no-shell-in-the-browser | true | keep-latin |  |
| D0670 | shell | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | unknown | /he/blog/bothy-2026-8-first-release, /he/blog/bothy-no-shell-in-the-browser | true | keep-latin |  |
| D1263 | (שיתוף ב־X) | text (open:שיתוף "Fixture — code, tables and q, open:שיתוף "Fixture — a long read") | unknown | /he/blog/area/bothy, /he/blog/area/site | false | translate | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0118 | יומן פעילות · RSS | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | unknown | /he/blog/log | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0944 | רשימות על Bothy | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | unknown | /he/projects | false | keep-latin | mixed run in an attribute (cannot be isolated with markup) |
| D1279 | bothy: 5 רשימות, 26% | text (open:תפריט, open:עיון) | unknown | /he/blog/area/bothy | false | translate |  |

### Developers (40)

| ID | Text | Where | Source | Routes | Marked | Treatment | Bidi / note |
|---|---|---|---|---|---|---|---|
| D0770 | האתר תומך ב־Model Context Protocol (MCP). חברו אליו את Claude, או כל לקוח MCP אחר, והוא יוכל לקרוא את הרשימות, את תחומי הפרויקטים ואת יומן ה… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | ui-table | /he/developers/mcp | false | keep-latin | product UI names; keep, mark lang=en (the uppercase run is CSS text-transform on Latin) |
| D0771 | CLAUDE CODE | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | ui-table | /he/developers/mcp | false | keep-latin | product UI names; keep, mark lang=en (the uppercase run is CSS text-transform on Latin) |
| D0773 | ב־CLAUDE.AI וב־CLAUDE DESKTOP: SETTINGS → CONNECTORS → ADD CUSTOM CONNECTOR | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | ui-table | /he/developers/mcp | false | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror); product UI names; keep, mark lang=en (the uppercase run is CSS text-transform on Latin) |
| D0783 | בעל האתר, גישת קריאה (MCP:READ) | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | ui-table | /he/developers/mcp | false | translate | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0788 | בעל האתר, גישת כתיבה (MCP:WRITE) | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | ui-table | /he/developers/mcp | false | translate | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0793 | העברת רשימה לארכיון. דורש confirm: true. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | ui-table | /he/developers/mcp | false | translate |  |
| D0796 | הסתרת תחום. דורש confirm: true. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | ui-table | /he/developers/mcp | false | translate |  |
| D0797 | OAuth 2.1 סטנדרטי עם PKCE. הלקוח מגלה את כל מה שהוא צריך מ־/.well-known/oauth-protected-resource ונרשם בעצמו. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | ui-table | /he/developers/mcp | false | translate |  |
| D0801 | העתקה: ב־claude.ai וב־Claude Desktop: Settings → Connectors → Add custom connector | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | ui-table | /he/developers/mcp | false | keep-latin | mixed run in an attribute (cannot be isolated with markup); product UI names; keep, mark lang=en (the uppercase run is CSS text-transform on Latin) |
| D0777 | list_posts | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/developers/mcp | false | translate |  |
| D0778 | get_post | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/developers/mcp | false | translate |  |
| D0779 | list_tags | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/developers/mcp | false | translate |  |
| D0780 | list_areas | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/developers/mcp | false | translate |  |
| D0781 | get_area | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/developers/mcp | false | translate |  |
| D0782 | list_activity | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/developers/mcp | false | translate |  |
| D0784 | admin_list_posts | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/developers/mcp | false | translate |  |
| D0785 | admin_get_post | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/developers/mcp | false | translate |  |
| D0786 | read_audit_log | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/developers/mcp | false | translate |  |
| D0787 | list_media | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/developers/mcp | false | translate |  |
| D0789 | save_post_draft | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/developers/mcp | false | translate |  |
| D0790 | publish_post | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/developers/mcp | false | translate |  |
| D0791 | unpublish_post | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/developers/mcp | false | translate |  |
| D0792 | delete_post | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/developers/mcp | false | translate |  |
| D0794 | save_area | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/developers/mcp | false | translate |  |
| D0795 | delete_area | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/developers/mcp | false | translate |  |
| D0798 | /.well-known/oauth-protected-resource | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | hard-coded | /he/developers/mcp | false | keep-latin |  |
| D0775 | הקריאה הראשונה פותחת חלון דפדפן. כל אחד יכול להתחבר: הכלים הציבוריים עונים בלי חשבון. התחברות עם GitHub פותחת את הכלים של בעל האתר, ורק לבעל… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/developers/mcp | false | keep-latin |  |
| D0799 | הזהות מגיעה מ־GitHub. האתר אף פעם לא רואה סיסמה ולא שומר אסימון של GitHub. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/developers/mcp | false | needs-he-field |  |
| D0802 | שרת MCP · Yehuda Briskman | head:title | seo | /he/developers/mcp | n/a | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| R026 | שרת MCP · Yehuda Briskman | server-render head:title | seo | /he/developers/mcp | n/a | keep-latin |  |
| R027 | חיבור Claude, או כל לקוח MCP, לאתר: קריאת הרשימות ותחומי הפרויקטים בלי התחברות, או התחברות עם GitHub כדי לנהל אותם. | server-render head:description | seo | /he/developers/mcp | n/a | needs-he-field |  |
| R028 | שרת MCP · Yehuda Briskman | server-render head:og:title | seo | /he/developers/mcp | n/a | keep-latin |  |
| R029 | חיבור Claude, או כל לקוח MCP, לאתר: קריאת הרשימות ותחומי הפרויקטים בלי התחברות, או התחברות עם GitHub כדי לנהל אותם. | server-render head:og:description | seo | /he/developers/mcp | n/a | needs-he-field |  |
| R030 | שרת MCP · Yehuda Briskman | server-render head:twitter:title | seo | /he/developers/mcp | n/a | keep-latin |  |
| R031 | חיבור Claude, או כל לקוח MCP, לאתר: קריאת הרשימות ותחומי הפרויקטים בלי התחברות, או התחברות עם GitHub כדי לנהל אותם. | server-render head:twitter:description | seo | /he/developers/mcp | n/a | needs-he-field |  |
| R032 | שרת MCP | server-render body | seo | /he/developers/mcp | false | translate |  |
| R033 | חיבור Claude, או כל לקוח MCP, לאתר: קריאת הרשימות ותחומי הפרויקטים בלי התחברות, או התחברות עם GitHub כדי לנהל אותם. | server-render body | seo | /he/developers/mcp | false | translate |  |
| R034 | Claude Code: | server-render body | seo | /he/developers/mcp | false | translate |  |
| R035 | ‏claude.ai ו־Claude Desktop: הוספת מחבר מותאם אישית עם הכתובת | server-render body | seo | /he/developers/mcp | false | translate |  |
| D0800 | העתקה: Claude Code | attr:aria-label (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | unknown | /he/developers/mcp | false | keep-latin | mixed run in an attribute (cannot be isolated with markup) |

### Admin (675)

| ID | Text | Where | Source | Routes | Marked | Treatment | Bidi / note |
|---|---|---|---|---|---|---|---|
| D0299 | SITE COPY | text (open:Choose from library, open:Choose an icon) | ui-table | 10 routes (/he/admin/areas, /he/admin/areas/windom, …) | false | translate |  |
| D0302 | CONNECTED APPS | text (open:Choose from library, open:Choose an icon) | ui-table | 10 routes (/he/admin/areas, /he/admin/areas/windom, …) | false | translate |  |
| D0347 | Site copy | text (open:Choose from library, open:Choose an icon) | ui-table | 10 routes (/he/admin/areas, /he/admin/areas/windom, …) | false | translate |  |
| D0350 | Connected apps | text (open:Choose from library, open:Choose an icon) | ui-table | 10 routes (/he/admin/areas, /he/admin/areas/windom, …) | false | translate |  |
| D0306 | NEW AREA | text | ui-table | /he/admin/areas, /he/admin/posts | false | translate |  |
| D0404 | REPOSITORY | text (open:Choose from library, open:Choose an icon) | ui-table | /he/admin/areas/windom, /he/admin/projects | false | translate |  |
| D1266 | New area | text | ui-table | /he/admin/areas, /he/admin/posts | false | translate |  |
| D0307 | NEW POST | text | ui-table | /he/admin/posts | false | translate |  |
| D0308 | Search posts | text | ui-table | /he/admin/posts | false | translate |  |
| D0313 | Filter by area | text | ui-table | /he/admin/posts | false | translate |  |
| D0314 | All areas | text | ui-table | /he/admin/posts | false | translate |  |
| D0351 | New post | attr:aria-label | ui-table | /he/admin/posts | false | translate |  |
| D0353 | Filter by status | attr:aria-label | ui-table | /he/admin/posts | false | translate |  |
| D0378 | HEBREW | text (open:Choose from library, open:Choose an icon) | ui-table | /he/admin/areas/windom | false | translate |  |
| D0383 | DETAILS | text (open:Choose from library, open:Choose an icon) | ui-table | /he/admin/areas/windom | false | translate |  |
| D0421 | Save | text (open:Choose from library, open:Choose an icon) | ui-table | /he/admin/areas/windom | false | translate |  |
| D0466 | SLUG | text (open:Choose from library) | ui-table | /he/admin/projects | false | translate |  |
| D0817 | תגיות #windom #release #chrome-extension Enter או פסיק מוסיפים תגית. אותיות לטיניות קטנות, ספרות ומקפים. | text (open:הוספת תמונה מהספרייה, open:Choose from library) | ui-table | /he/admin/posts/windom-1-0-first-release | false | keep-latin |  |
| D0818 | תמונת שער כתובת https:// מלאה, או בחירה מהספרייה. | text (open:הוספת תמונה מהספרייה, open:Choose from library) | ui-table | /he/admin/posts/windom-1-0-first-release | false | keep-latin |  |
| D1054 | New area | attr:aria-label | ui-table | /he/admin/areas | false | translate |  |
| D1103 | HEADING | text | ui-table | /he/admin/site-copy | false | translate |  |
| D1152 | Footer | text | ui-table | /he/admin/site-copy | false | translate |  |
| D1157 | COLOPHON | text | ui-table | /he/admin/site-copy | false | translate |  |
| D1267 | New post | text | ui-table | /he/admin/posts | false | translate |  |
| D1271 | SAVE | text (open:Choose from library, open:Choose an icon) | ui-table | /he/admin/areas/windom | false | translate |  |
| D0294 | Y.B.ניהול | text (open:Choose from library, open:Choose an icon) | hard-coded | 10 routes (/he/admin/areas, /he/admin/areas/windom, …) | false | translate |  |
| D0295 | POSTS | text (open:Choose from library, open:Choose an icon) | hard-coded | 10 routes (/he/admin/areas, /he/admin/areas/windom, …) | false | translate |  |
| D0296 | AREAS | text (open:Choose from library, open:Choose an icon) | hard-coded | 10 routes (/he/admin/areas, /he/admin/areas/windom, …) | false | translate |  |
| D0300 | MEDIA | text (open:Choose from library, open:Choose an icon) | hard-coded | 10 routes (/he/admin/areas, /he/admin/areas/windom, …) | false | translate |  |
| D0301 | SETTINGS | text (open:Choose from library, open:Choose an icon) | hard-coded | 10 routes (/he/admin/areas, /he/admin/areas/windom, …) | false | translate |  |
| D0305 | Posts | text (open:Choose from library, open:Choose an icon) | hard-coded | 10 routes (/he/admin/areas, /he/admin/areas/windom, …) | false | translate |  |
| D0344 | Areas | text (open:Choose from library, open:Choose an icon) | hard-coded | 10 routes (/he/admin/areas, /he/admin/areas/windom, …) | false | translate |  |
| D0348 | Media | text (open:Choose from library, open:Choose an icon) | hard-coded | 10 routes (/he/admin/areas, /he/admin/areas/windom, …) | false | translate |  |
| D0349 | Settings | text (open:Choose from library, open:Choose an icon) | hard-coded | 10 routes (/he/admin/areas, /he/admin/areas/windom, …) | false | translate |  |
| D1265 | Y.B. | text (open:Choose from library) | hard-coded | 8 routes (/he/admin/areas, /he/admin/connections, …) | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0375 | TITLE | text (open:Choose from library, open:Choose an icon) | hard-coded | 4 routes (/he/admin/areas/windom, /he/admin/projects, …) | false | translate |  |
| D0442 | SEARCH | text (open:Choose from library, open:Choose an icon) | hard-coded | 4 routes (/he/admin/areas/windom, /he/admin/media, …) | false | translate |  |
| D0395 | CHOOSE FROM LIBRARY | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom, /he/admin/posts/windom-1-0-first-release, /he/admin/projects | false | translate |  |
| D0426 | Media library | attr:aria-label (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom, /he/admin/posts/windom-1-0-first-release, /he/admin/projects | false | translate |  |
| D0439 | Media library | text (open:Choose from library, open:הוספת תמונה מהספרייה) | hard-coded | /he/admin/areas/windom, /he/admin/posts/windom-1-0-first-release, /he/admin/projects | false | translate |  |
| D0445 | Close | attr:aria-label (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom, /he/admin/posts/windom-1-0-first-release, /he/admin/projects | false | translate |  |
| D0446 | Alt text, caption, file name | attr:placeholder (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom, /he/admin/posts/windom-1-0-first-release, /he/admin/projects | false | translate |  |
| D0453 | SAVE DRAFT | text (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy, /he/admin/story | false | translate |  |
| D0454 | PUBLISH | text (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy, /he/admin/story | false | translate |  |
| D0456 | The site is showing the built-in content. Publish, or seed the store, to start editing it here. | text (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy, /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0457 | PREVIEW ↗ | text (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy, /he/admin/story | false | translate |  |
| D0458 | SEED THE STORE | text (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy, /he/admin/story | false | translate |  |
| D0536 | Title, English | text (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy, /he/admin/story | false | translate |  |
| D0537 | Title, Hebrew (optional) | text (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy, /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0545 | Save draft | text (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy, /he/admin/story | false | translate |  |
| D0546 | Publish | text (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy, /he/admin/story | false | translate |  |
| D0563 | English | attr:placeholder (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy, /he/admin/story | true | translate |  |
| D0377 | DESCRIPTION | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom, /he/admin/projects | false | translate |  |
| D0384 | KIND | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom, /he/admin/projects | false | translate |  |
| D0401 | Link label | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom, /he/admin/posts/windom-1-0-first-release | false | translate |  |
| D0402 | Link URL | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom, /he/admin/posts/windom-1-0-first-release | false | translate |  |
| D0425 | https://… | attr:placeholder (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom, /he/admin/posts/windom-1-0-first-release | false | keep-latin |  |
| D0428 | Source | attr:placeholder (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom, /he/admin/posts/windom-1-0-first-release | false | translate |  |
| D0447 | Icons | text (open:Choose an icon) | hard-coded | /he/admin/areas/windom, /he/admin/media | false | translate |  |
| D0502 | Links | text (open:Choose from library, open:הוספת תמונה מהספרייה) | hard-coded | /he/admin/posts/windom-1-0-first-release, /he/admin/projects | false | translate |  |
| D0507 | LABEL | text (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy | false | translate |  |
| D0508 | URL | text (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy | false | keep-latin |  |
| D0509 | ADD A LINK | text (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy | false | translate |  |
| D0547 | Move WindoM up | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D0548 | Move WindoM down | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D0549 | Remove WindoM | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D0551 | Move Bothy up | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D0552 | Move Bothy down | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D0553 | Remove Bothy | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects, /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D0843 | LINES | text | hard-coded | /he/admin/site-copy, /he/admin/story | false | translate |  |
| D0846 | Line 1, English | text | hard-coded | /he/admin/site-copy, /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0847 | Line 1, Hebrew (optional) | text | hard-coded | /he/admin/site-copy, /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0848 | ADD A LINE | text | hard-coded | /he/admin/site-copy, /he/admin/story | false | translate |  |
| D0862 | Line 2, English | text | hard-coded | /he/admin/site-copy, /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0864 | Line 2, Hebrew (optional) | text | hard-coded | /he/admin/site-copy, /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0304 | Y.B.Posts+ | text | hard-coded | /he/admin/posts | false | translate |  |
| D0309 | ALL | text | hard-coded | /he/admin/posts | false | translate |  |
| D0316 | 19 posts | text | hard-coded | /he/admin/posts | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0352 | Search title, slug, tag | attr:placeholder | hard-coded | /he/admin/posts | false | translate |  |
| D0380 | Title | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | true | translate |  |
| D0382 | Description | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | true | translate |  |
| D0386 | My blog | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate |  |
| D0387 | VISIBILITY | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate |  |
| D0389 | Hidden | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate |  |
| D0390 | ORDER (LOWER COMES FIRST) | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0391 | SLUG (THE URL) | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0393 | COVER IMAGE URL | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate |  |
| D0396 | ICON | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate |  |
| D0397 | None. | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0398 | CHOOSE AN ICON | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate |  |
| D0400 | LINKS | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate |  |
| D0403 | ADD LINK | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate |  |
| D0405 | OWNER | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate |  |
| D0406 | REPO | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate |  |
| D0407 | BRANCH | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate |  |
| D0411 | ONE FILE | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate |  |
| D0413 | Path to publish | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate |  |
| D0414 | ADD PATH | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate |  |
| D0419 | Refreshed automatically every 15 minutes. Never read during a page load. | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0420 | SAVE AREA | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate |  |
| D0427 | Icons | attr:aria-label (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate |  |
| D0430 | Remove link Chrome Web Store | attr:aria-label (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate | admin list controls; label built from English content |
| D0431 | Remove link windom.app | attr:aria-label (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate | admin list controls; label built from English content |
| D0432 | Remove link Source on GitHub | attr:aria-label (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate | admin list controls; label built from English content |
| D0435 | Remove README.md from the allowlist | attr:aria-label (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate | admin list controls; label built from English content |
| D0436 | Remove CHANGELOG.md from the allowlist | attr:aria-label (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate | admin list controls; label built from English content |
| D0437 | docs/ | attr:placeholder (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate |  |
| D0449 | 0 icons | text (open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0452 | Y.B.Projects | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0459 | ORDER ON THE SITE | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0461 | EDIT | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0468 | YEAR | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0471 | ONE-LINE FACT | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0472 | One-line fact, English | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0473 | One-line fact, Hebrew (optional) | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0474 | Description, English | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0475 | Description, Hebrew (optional) | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0476 | STATUS LINE | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0477 | Status line, English | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0478 | Status line, Hebrew (optional) | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0479 | LINE ON THE STORY PAGE | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0480 | Line on the story page, English | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0481 | Line on the story page, Hebrew (optional) | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0483 | Card | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0484 | LABEL FIELDS (ONE TO THREE) | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0490 | count | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0491 | VALUE | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0495 | Comma-separated, in the order shown. | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0496 | IMAGE | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0498 | TINT (RED, GREEN, BLUE: 0 TO 255) | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0499 | RED | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0500 | GREEN | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0501 | BLUE | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0503 | MAIN LINK | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0504 | MAIN LINK LABEL | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0505 | MORE LINKS | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0510 | The case | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0511 | HIGHLIGHTS | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0514 | Highlight 1, English | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0515 | Highlight 1, Hebrew (optional) | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0518 | Highlight 2, English | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0519 | Highlight 2, Hebrew (optional) | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0522 | Highlight 3, English | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0523 | Highlight 3, Hebrew (optional) | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0524 | ADD A HIGHLIGHT | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0525 | THE PROBLEM | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0526 | The problem, English | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0527 | The problem, Hebrew (optional) | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0528 | MY ROLE | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0529 | My role, English | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0530 | My role, Hebrew (optional) | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0531 | THE OUTCOME | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0532 | The outcome, English | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0533 | The outcome, Hebrew (optional) | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0534 | DECISIONS | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0538 | BODY | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0539 | Body, English | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0540 | Body, Hebrew (optional) | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0543 | ADD A DECISION | text (open:Choose from library) | hard-coded | /he/admin/projects | false | translate |  |
| D0550 | Edit WindoM | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0554 | Edit Bothy | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0555 | Move Programming with Yehuda up | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0556 | Move Programming with Yehuda down | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0557 | Remove Programming with Yehuda | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0558 | Edit Programming with Yehuda | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0559 | Move Icaros up | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0560 | Move Icaros down | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0561 | Remove Icaros | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0562 | Edit Icaros | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0564 | Move state: In use up | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0565 | Move state: In use down | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0566 | Remove state: In use | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0567 | Move tech: React 19 up | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip; admin list controls; label built from English content |
| D0568 | Move tech: React 19 down | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip; admin list controls; label built from English content |
| D0569 | Remove tech: React 19 | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip; admin list controls; label built from English content |
| D0570 | Move where: Chrome Web Store up | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0571 | Move where: Chrome Web Store down | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0572 | Remove where: Chrome Web Store | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0573 | Move Chrome Web Store up | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0574 | Move Chrome Web Store down | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0575 | Remove Chrome Web Store | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0576 | Move Published on the Chrome Web Store, v1.5. up | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip; admin list controls; label built from English content |
| D0577 | Move Published on the Chrome Web Store, v1.5. down | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip; admin list controls; label built from English content |
| D0578 | Remove Published on the Chrome Web Store, v1.5. | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip; admin list controls; label built from English content |
| D0579 | Move Push a version tag and it builds, zips a up | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0580 | Move Push a version tag and it builds, zips a down | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0581 | Remove Push a version tag and it builds, zips a | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0582 | Move Full stack solo: React front end, Fastif up | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0583 | Move Full stack solo: React front end, Fastif down | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0584 | Remove Full stack solo: React front end, Fastif | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0585 | Move The Gmail widget was removed for a licen up | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0586 | Move The Gmail widget was removed for a licen down | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0587 | Remove The Gmail widget was removed for a licen | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0588 | Move The glass is computed optics rather than up | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0589 | Move The glass is computed optics rather than down | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0590 | Remove The glass is computed optics rather than | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0591 | Move Signing in logged you straight back out up | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0592 | Move Signing in logged you straight back out down | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0593 | Remove Signing in logged you straight back out | attr:aria-label (open:Choose from library) | hard-coded | /he/admin/projects | false | translate | admin list controls; label built from English content |
| D0595 | Y.B.הגדרות | text | hard-coded | /he/admin/settings | false | translate |  |
| D0821 | Add link | text (open:הוספת תמונה מהספרייה, open:Choose from library) | hard-coded | /he/admin/posts/windom-1-0-first-release | false | translate |  |
| D0830 | Remove link Changelog | attr:aria-label (open:הוספת תמונה מהספרייה, open:Choose from library) | hard-coded | /he/admin/posts/windom-1-0-first-release | false | translate | admin list controls; label built from English content |
| D0832 | Y.B.Connected apps | text | hard-coded | /he/admin/connections | false | translate |  |
| D0834 | remote MCP server | text | hard-coded | /he/admin/connections | false | translate |  |
| D0835 | 0 connected | text | hard-coded | /he/admin/connections | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0836 | Nothing connected | text | hard-coded | /he/admin/connections | false | translate |  |
| D0840 | Y.B.Story | text | hard-coded | /he/admin/story | false | translate |  |
| D0841 | The page at /story. English is required; Hebrew is optional and falls back to English, except in an interlude, which is written in both. | text | hard-coded | /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0842 | The opening | text | hard-coded | /he/admin/story | false | translate |  |
| D0849 | Roles | text | hard-coded | /he/admin/story | false | translate |  |
| D0852 | ID | text | hard-coded | /he/admin/story | false | translate |  |
| D0854 | When, English | text | hard-coded | /he/admin/story | false | translate |  |
| D0855 | When, Hebrew (optional) | text | hard-coded | /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0865 | ADD A ROLE | text | hard-coded | /he/admin/story | false | translate |  |
| D0866 | Pinned to beats | text | hard-coded | /he/admin/story | false | translate |  |
| D0868 | How a beat's photograph sits beside its text. A beat with none uses the default. | text | hard-coded | /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0870 | BEAT | text | hard-coded | /he/admin/story | false | translate |  |
| D0877 | beside | text | hard-coded | /he/admin/story | false | translate |  |
| D0883 | ADD A LAYOUT | text | hard-coded | /he/admin/story | false | translate |  |
| D0884 | PHOTOGRAPHS | text | hard-coded | /he/admin/story | false | translate |  |
| D0885 | ADD A PHOTOGRAPH | text | hard-coded | /he/admin/story | false | translate |  |
| D0886 | INTERLUDES | text | hard-coded | /he/admin/story | false | translate |  |
| D0887 | A short phrase between two beats, written in both languages. | text | hard-coded | /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0889 | AFTER BEAT | text | hard-coded | /he/admin/story | false | translate |  |
| D0890 | WORDS | text | hard-coded | /he/admin/story | false | translate |  |
| D0891 | Words, English | text | hard-coded | /he/admin/story | false | translate |  |
| D0892 | Words, Hebrew (optional) | text | hard-coded | /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0895 | ADD AN INTERLUDE | text | hard-coded | /he/admin/story | false | translate |  |
| D0896 | Move The first software shipped. up | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0897 | Move The first software shipped. down | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0898 | Remove The first software shipped. | attr:aria-label | hard-coded | /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip; admin list controls; label built from English content |
| D0899 | Move Full-stack engineer up | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0900 | Move Full-stack engineer down | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0901 | Remove Full-stack engineer | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0902 | Move Building software across the whole stack up | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0903 | Move Building software across the whole stack down | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0904 | Remove Building software across the whole stack | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0905 | Move Technical team lead up | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0906 | Move Technical team lead down | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0907 | Remove Technical team lead | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0908 | Move Leading a small team that builds and run up | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0909 | Move Leading a small team that builds and run down | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0910 | Remove Leading a small team that builds and run | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0911 | Move Still writing and reviewing code every d up | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0912 | Move Still writing and reviewing code every d down | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0913 | Remove Still writing and reviewing code every d | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0914 | Move programming-with-yehuda up | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0915 | Move programming-with-yehuda down | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0916 | Remove programming-with-yehuda | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0917 | Move icaros up | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0918 | Move icaros down | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0919 | Remove icaros | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0920 | Move bothy up | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0921 | Move bothy down | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0922 | Remove bothy | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0923 | Move now up | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0924 | Move now down | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0925 | Remove now | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0926 | Move Things other people could open. up | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0927 | Move Things other people could open. down | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0928 | Remove Things other people could open. | attr:aria-label | hard-coded | /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip; admin list controls; label built from English content |
| D0929 | Move Then, things they relied on. up | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0930 | Move Then, things they relied on. down | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0931 | Remove Then, things they relied on. | attr:aria-label | hard-coded | /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip; admin list controls; label built from English content |
| D0932 | Move Then, a team. up | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0933 | Move Then, a team. down | attr:aria-label | hard-coded | /he/admin/story | false | translate | admin list controls; label built from English content |
| D0934 | Remove Then, a team. | attr:aria-label | hard-coded | /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip; admin list controls; label built from English content |
| D1048 | Y.B.Areas+ | text | hard-coded | /he/admin/areas | false | translate |  |
| D1050 | 3 areas | text | hard-coded | /he/admin/areas | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1056 | Y.B.Media | text | hard-coded | /he/admin/media | false | translate |  |
| D1058 | CHOOSE A FILE | text | hard-coded | /he/admin/media | false | translate |  |
| D1060 | SHOW | text | hard-coded | /he/admin/media | false | translate |  |
| D1061 | All | text | hard-coded | /he/admin/media | false | translate |  |
| D1062 | Pictures | text | hard-coded | /he/admin/media | false | translate |  |
| D1063 | Videos | text | hard-coded | /he/admin/media | false | translate |  |
| D1064 | 0 of 0 items | text | hard-coded | /he/admin/media | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1065 | Nothing here yet | text | hard-coded | /he/admin/media | false | translate |  |
| D1067 | Alt text, caption, credit, file name | attr:placeholder | hard-coded | /he/admin/media | false | translate |  |
| D1068 | Item | attr:aria-label | hard-coded | /he/admin/media | false | translate |  |
| D1069 | Y.B.Site copy | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1071 | Hero | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1072 | NAME | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1073 | SHIPPING SINCE | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1074 | FACT | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1075 | Fact, English | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1076 | Fact, Hebrew (optional) | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1078 | Where, English | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1079 | Where, Hebrew (optional) | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1080 | PHRASES BESIDE THE LIGHT | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1083 | Phrase 1, English | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1084 | Phrase 1, Hebrew (optional) | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1087 | Phrase 2, English | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1088 | Phrase 2, Hebrew (optional) | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1091 | Phrase 3, English | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1092 | Phrase 3, Hebrew (optional) | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1095 | Phrase 4, English | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1096 | Phrase 4, Hebrew (optional) | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1099 | Phrase 5, English | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1100 | Phrase 5, Hebrew (optional) | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1101 | ADD A PHRASE | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1104 | Heading, English | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1105 | Heading, Hebrew (optional) | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1106 | SECTIONS | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1108 | Label, English | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1109 | Label, Hebrew (optional) | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1116 | ADD A SECTION | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1117 | PRINCIPLES | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1118 | A principle's figure is drawn for its English claim; a new claim gets no figure until one is drawn. | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1120 | CLAIM | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1121 | Claim, English | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1122 | Claim, Hebrew (optional) | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1131 | ADD A PRINCIPLE | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1133 | EMAIL | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1134 | LOCATION | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1135 | Location, English | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1136 | Location, Hebrew (optional) | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1137 | AVAILABILITY | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1138 | Availability, English | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1139 | Availability, Hebrew (optional) | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1140 | REPLY WITHIN | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1141 | Reply within, English | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1142 | Reply within, Hebrew (optional) | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1143 | Profiles | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1144 | IN THE NAV AND THE FOOTER | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1146 | MARK | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1149 | ACCESSIBLE NAME | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1151 | ADD A PROFILE | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1153 | WORK LINKS | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1154 | NOTE | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1155 | Note, English | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1156 | Note, Hebrew (optional) | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1158 | Colophon, English | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1159 | Colophon, Hebrew (optional) | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1160 | COLOPHON NOTE | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1161 | Colophon note, English | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1162 | Colophon note, Hebrew (optional) | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1163 | PLACE | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1164 | Place, English | text | hard-coded | /he/admin/site-copy | false | translate |  |
| D1165 | Place, Hebrew (optional) | text | hard-coded | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1166 | Move Technology up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1167 | Move Technology down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1168 | Remove Technology | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1169 | Move Product builder up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1170 | Move Product builder down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1171 | Remove Product builder | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1172 | Move Build boldly up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1173 | Move Build boldly down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1174 | Remove Build boldly | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1175 | Move Applied AI up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1176 | Move Applied AI down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1177 | Remove Applied AI | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1178 | Move Keep improving up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1179 | Move Keep improving down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1180 | Remove Keep improving | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1181 | Move Now up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1182 | Move Now down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1183 | Remove Now | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1184 | Move I'm a full-stack engineer and a technica up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1185 | Move I'm a full-stack engineer and a technica down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1186 | Remove I'm a full-stack engineer and a technica | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1187 | Move I lead a small team building and running up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1188 | Move I lead a small team building and running down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1189 | Remove I lead a small team building and running | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1190 | Move Before up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1191 | Move Before down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1192 | Remove Before | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1193 | Move Before that I was a full-stack engineer up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1194 | Move Before that I was a full-stack engineer down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1195 | Remove Before that I was a full-stack engineer | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1196 | Move Outside work up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1197 | Move Outside work down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1198 | Remove Outside work | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1199 | Move Outside work I ship my own products end up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1200 | Move Outside work I ship my own products end down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1201 | Remove Outside work I ship my own products end | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1202 | Move Install from empty, every time up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1203 | Move Install from empty, every time down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1204 | Remove Install from empty, every time | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1205 | Move Every pull request on Bothy clones the r up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1206 | Move Every pull request on Bothy clones the r down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1207 | Remove Every pull request on Bothy clones the r | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1208 | Move A nightly job repeats it at a path with up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1209 | Move A nightly job repeats it at a path with down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1210 | Remove A nightly job repeats it at a path with | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1211 | Move A check that cannot fail is not a check up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1212 | Move A check that cannot fail is not a check down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1213 | Remove A check that cannot fail is not a check | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1214 | Move One CI job exists only to plant a mutati up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1215 | Move One CI job exists only to plant a mutati down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1216 | Remove One CI job exists only to plant a mutati | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1217 | Move A green suite and a suite that is incapa up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1218 | Move A green suite and a suite that is incapa down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1219 | Remove A green suite and a suite that is incapa | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1220 | Move Generated, never committed up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1221 | Move Generated, never committed down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1222 | Remove Generated, never committed | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1223 | Move Credentials are generated at install tim up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1224 | Move Credentials are generated at install tim down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1225 | Remove Credentials are generated at install tim | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1226 | Move The bootstrap prints which keys it wrote up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1227 | Move The bootstrap prints which keys it wrote down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1228 | Remove The bootstrap prints which keys it wrote | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1229 | Move github up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1230 | Move github down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1231 | Remove github | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1232 | Move linkedin up | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1233 | Move linkedin down | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1234 | Remove linkedin | attr:aria-label | hard-coded | /he/admin/site-copy | false | translate | admin list controls; label built from English content |
| D1270 | Save area | text (open:Choose from library, open:Choose an icon) | hard-coded | /he/admin/areas/windom | false | translate |  |
| D0315 | Notes | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | settings | 7 routes (/he/admin/areas, /he/admin/posts, …) | false | needs-he-field |  |
| D1132 | Contact | text | settings | /he/admin/site-copy | false | needs-he-field |  |
| D0062 | Built with React and TypeScript. Runs on a single Arm machine I administer myself, behind Traefik and cert-manager, with the content in Couc… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 34 routes (/he, /he/a-page-that-does-not-exist, …) | true | translate |  |
| D0015 | WindoM | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 24 routes (/he, /he/admin/areas, …) | false | keep-latin |  |
| D0025 | Bothy | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 17 routes (/he, /he/admin/areas, …) | false | keep-latin |  |
| D0129 | WINDOM | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 12 routes (/he, /he/admin/areas/windom, …) | false | keep-latin |  |
| D0187 | #windom | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 10 routes (/he/admin/posts/windom-1-0-first-release, /he/blog/windom-1-0-first-release, …) | false | keep-latin | tag slug; mark lang=en dir=ltr |
| D0297 | PROJECTS | text (open:Choose from library, open:Choose an icon) | content-store | 10 routes (/he/admin/areas, /he/admin/areas/windom, …) | false | needs-he-field |  |
| D0298 | STORY | text (open:Choose from library, open:Choose an icon) | content-store | 10 routes (/he/admin/areas, /he/admin/areas/windom, …) | false | needs-he-field |  |
| D0345 | Projects | text (open:Choose from library, open:Choose an icon) | content-store | 10 routes (/he/admin/areas, /he/admin/areas/windom, …) | false | needs-he-field |  |
| D0346 | Story | text (open:Choose from library, open:Choose an icon) | content-store | 10 routes (/he/admin/areas, /he/admin/areas/windom, …) | false | needs-he-field |  |
| D0256 | #release | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 9 routes (/he/admin/posts/windom-1-0-first-release, /he/blog/bothy-2026-8-first-release, …) | false | keep-latin | tag slug; mark lang=en dir=ltr |
| D0190 | #chrome-extension | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 8 routes (/he/admin/posts/windom-1-0-first-release, /he/blog/windom-1-0-first-release, …) | false | keep-latin | tag slug; mark lang=en dir=ltr |
| D0145 | Bothy asks Docker what is running | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 7 routes (/he, /he/admin/posts, …) | mixed | translate |  |
| D0141 | An updater that cannot choose the version | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 6 routes (/he, /he/admin/posts, …) | mixed | translate |  |
| D0143 | Why Bothy has no shell in the browser | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 6 routes (/he, /he/admin/posts, …) | mixed | translate |  |
| D0149 | A provider's 401 is not a signed-out user | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 6 routes (/he, /he/admin/posts, …) | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0151 | The glass is computed, not decorated | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 6 routes (/he, /he/admin/posts, …) | mixed | translate |  |
| D0147 | Why the Gmail widget was withdrawn | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 5 routes (/he, /he/admin/posts, …) | mixed | translate |  |
| D0336 | Bothy 2026.9: five services, a cluster console, and a guide | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 5 routes (/he/admin/posts, /he/blog/area/bothy, …) | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0230 | Fixture — a long read | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 4 routes (/he/admin/posts, /he/blog/area/site, …) | mixed | translate |  |
| D0261 | Bothy 2026.8: the first release | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 4 routes (/he/admin/posts, /he/blog/area/bothy, …) | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0288 | WindoM 1.1: settings that follow you | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 4 routes (/he/admin/posts, /he/blog/log, …) | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0327 | WindoM 1.5: computed glass, and Gmail withdrawn | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 4 routes (/he/admin/posts, /he/blog/log, …) | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0334 | Fixture — a note filed under a project | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 4 routes (/he/admin/posts, /he/blog/log, …) | mixed | translate |  |
| D0340 | WindoM 1.3: weather without a key, and accounts you can recover | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 4 routes (/he/admin/posts, /he/blog/log, …) | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0343 | WindoM 1.0: the new tab as a dashboard | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 4 routes (/he/admin/posts, /he/admin/posts/windom-1-0-first-release, …) | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0627 | bothy | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | 4 routes (/he/admin/story, /he/blog, …) | mixed | keep-latin |  |
| D0114 | windom | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/admin/story, /he/blog, /he/blog/area/windom | false | keep-latin |  |
| D0287 | WindoM 1.4: the Apps Hub, markets and a first-run guide | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/admin/posts, /he/blog/log, /he/blog/windom-1-3-weather-without-a-key | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0325 | Fixture — code, tables and quotes | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/admin/posts, /he/blog/area/site, /he/blog/log | false | translate |  |
| D0330 | WindoM 1.4.1: a release about not breaking | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/admin/posts, /he/blog/log, /he/blog/windom-1-5-computed-glass | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0332 | Fixture — shorter than the viewport | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/admin/posts, /he/blog/area/site, /he/blog/log | false | translate |  |
| D0735 | What is in it | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/admin/posts/windom-1-0-first-release, /he/blog/bothy-2026-8-first-release, /he/blog/windom-1-0-first-release | mixed | translate |  |
| D0036 | I'm a full-stack engineer and a technical team lead in Tel Aviv. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he, /he/admin/site-copy | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0037 | I lead a small team building and running internal software, and I still write and review code every day. I never wanted the version of the j… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he, /he/admin/site-copy | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0039 | Before that I was a full-stack engineer at Momentum Tailored Solutions. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he, /he/admin/site-copy | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0041 | Outside work I ship my own products end to end: WindoM, a Chrome extension published in the Web Store, and Bothy, a console that reports wha… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he, /he/admin/site-copy | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0043 | Every pull request on Bothy clones the repository into an empty directory, runs the three-line install and nothing else, then runs every tes… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he, /he/admin/site-copy | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0044 | A nightly job repeats it at a path with a space in it and at a six-level-deep path, because every portability bug that repo has had looked f… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he, /he/admin/site-copy | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0046 | One CI job exists only to plant a mutation and require another job to catch it. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he, /he/admin/site-copy | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0047 | A green suite and a suite that is incapable of going red look identical from the outside, so I make the difference explicit. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he, /he/admin/site-copy | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0049 | Credentials are generated at install time rather than shipped as placeholders to fill in. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he, /he/admin/site-copy | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0050 | The bootstrap prints which keys it wrote and never their values, so there is no default password to forget about. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he, /he/admin/site-copy | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0082 | A Chrome extension that replaces the new-tab page with a personal dashboard: calendar, inbox, tasks, weather, music and markets in one view.… | text (open:Choose from library) | content-store | /he/admin/projects, /he/projects/windom | true | translate |  |
| D0085 | The things you check first thing — the time, the weather, today's tasks, what is playing, the pull requests waiting on you, the price of som… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/admin/projects, /he/projects/windom | mixed | translate |  |
| D0087 | Solo, across all four trees in the repository: the extension itself, the Fastify API behind it, windom.app, and the CI that releases them. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/admin/projects, /he/projects/windom | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0089 | Published on the Chrome Web Store and shipping — v1.5.1 went out on 26 October 2026. A release now reads the store's answer back before it c… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/admin/projects, /he/projects/windom | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0094 | Reading mail needs the gmail.readonly scope, which Google classes as restricted: publishing with it requires a third-party CASA security ass… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/admin/projects, /he/projects/windom | mixed | translate |  |
| D0096 | The rim of every pane bends the wallpaper behind it through Snell's law, across a quartic squircle profile, with the direction taken from a … | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/admin/projects, /he/projects/windom | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0098 | Calendar, Spotify and Gmail each return 401 when their own provider grant is stale. Every one of those was being read as an expired session … | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/admin/projects, /he/projects/windom | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0123 | The first software shipped. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/admin/story, /he/story | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0136 | Building software across the whole stack. | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/admin/story, /he/story | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0156 | A Chrome extension that replaces the new-tab page with a personal dashboard: clock, weather, tasks, calendar, music and markets in one view.… | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/admin/areas/windom, /he/projects/windom | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0429 | https://github.com/… | attr:placeholder (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom, /he/admin/posts/windom-1-0-first-release | false | keep-latin |  |
| D0460 | 1. WINDOM | text (open:Choose from library) | content-store | /he/admin/projects, /he/admin/site-copy | false | keep-latin | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0806 | WindoM 1.0 is the first release. It replaces the page Chrome opens on every new tab with a dashboard, and it is built so that the first thin… | text (open:הוספת תמונה מהספרייה, open:Choose from library) | content-store | /he/admin/posts/windom-1-0-first-release, /he/blog/windom-1-0-first-release | true | translate |  |
| D0813 | The account is optional | text (open:הוספת תמונה מהספרייה, open:Choose from library) | content-store | /he/admin/posts/windom-1-0-first-release, /he/blog/windom-1-0-first-release | mixed | translate |  |
| D0814 | Everything above the integrations works without an account. Signing in adds Google sign-in and the integrations, and the account system behi… | text (open:הוספת תמונה מהספרייה, open:Choose from library) | content-store | /he/admin/posts/windom-1-0-first-release, /he/blog/windom-1-0-first-release | true | translate |  |
| D0815 | How it ships | text (open:הוספת תמונה מהספרייה, open:Choose from library) | content-store | /he/admin/posts/windom-1-0-first-release, /he/blog/windom-1-0-first-release | mixed | translate |  |
| D0816 | The backend runs on Fly.io with PostgreSQL. GitHub Actions deploy the backend and publish the extension automatically, so a release is a tag… | text (open:הוספת תמונה מהספרייה, open:Choose from library) | content-store | /he/admin/posts/windom-1-0-first-release, /he/blog/windom-1-0-first-release | true | translate |  |
| D1042 | WINDOM 1.0: THE NEW TAB AS A DASHBOARD | text (open:HE — החלפת שפה, open:ערכת צבעים: בהירה; גודל טקסט: רגיל;) | content-store | /he/admin/posts/windom-1-0-first-release, /he/blog/windom-1-0-first-release | mixed | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0310 | DRAFT | text | content-store | /he/admin/posts | false | needs-he-field |  |
| D0311 | PUBLISHED | text | content-store | /he/admin/posts | false | needs-he-field |  |
| D0312 | ARCHIVED | text | content-store | /he/admin/posts | false | needs-he-field |  |
| D0317 | Fixture — draft, must never be public | text | content-store | /he/admin/posts | false | translate |  |
| D0318 | Notes · edited 1d ago · 1m · fixture | text | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0319 | Bothy · published · 3m · bothy updates ci self-hosting | text | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0320 | Bothy · published · 2m · bothy security docker testing | text | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0321 | Bothy · published · 3m · bothy docker self-hosting | text | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0322 | WindoM · published · 2m · windom privacy auth chrome-extension | text | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0323 | WindoM · published · 2m · windom auth testing | text | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0324 | WindoM · published · 3m · windom css performance chrome-extension | text | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0326 | Notes · published · 1m · fixture rendering | text | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0328 | WindoM · published · 2m · windom release chrome-extension css | text | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0329 | Notes · published · 9m · fixture | text | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0331 | WindoM · published · 2m · windom release ci auth | text | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0333 | Notes · published · 1m · fixture edge-case | text | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0335 | WindoM · published · 1m · fixture | text | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0337 | Bothy · published · 2m · bothy release self-hosting observability | text | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0338 | Bothy · published · 1m · bothy release self-hosting docker | text | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0339 | WindoM · published · 2m · windom release chrome-extension | text | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0341 | WindoM · published · 1m · windom release chrome-extension auth | text | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0342 | WindoM · published · 1m · windom release chrome-extension | text | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0354 | View An updater that cannot choose the version on the public site | attr:aria-label | content-store | /he/admin/posts | false | translate |  |
| D0355 | View Why Bothy has no shell in the browser on the public site | attr:aria-label | content-store | /he/admin/posts | false | translate |  |
| D0356 | View Bothy asks Docker what is running on the public site | attr:aria-label | content-store | /he/admin/posts | false | needs-he-field |  |
| D0357 | View Why the Gmail widget was withdrawn on the public site | attr:aria-label | content-store | /he/admin/posts | false | translate |  |
| D0358 | View A provider's 401 is not a signed-out user on the public site | attr:aria-label | content-store | /he/admin/posts | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0359 | View The glass is computed, not decorated on the public site | attr:aria-label | content-store | /he/admin/posts | false | translate |  |
| D0360 | View Fixture — code, tables and quotes on the public site | attr:aria-label | content-store | /he/admin/posts | false | needs-he-field |  |
| D0361 | View WindoM 1.5: computed glass, and Gmail withdrawn on the public site | attr:aria-label | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0362 | View Fixture — a long read on the public site | attr:aria-label | content-store | /he/admin/posts | false | needs-he-field |  |
| D0363 | View WindoM 1.4.1: a release about not breaking on the public site | attr:aria-label | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0364 | View Fixture — shorter than the viewport on the public site | attr:aria-label | content-store | /he/admin/posts | false | needs-he-field |  |
| D0365 | View Fixture — a note filed under a project on the public site | attr:aria-label | content-store | /he/admin/posts | false | needs-he-field |  |
| D0366 | View Bothy 2026.9: five services, a cluster console, and a guide on the public site | attr:aria-label | content-store | /he/admin/posts | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0367 | View Bothy 2026.8: the first release on the public site | attr:aria-label | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0368 | View WindoM 1.4: the Apps Hub, markets and a first-run guide on the public site | attr:aria-label | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0369 | View WindoM 1.3: weather without a key, and accounts you can recover on the public site | attr:aria-label | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0370 | View WindoM 1.1: settings that follow you on the public site | attr:aria-label | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0371 | View WindoM 1.0: the new tab as a dashboard on the public site | attr:aria-label | content-store | /he/admin/posts | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0373 | ‹WindoM | text (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | false | keep-latin |  |
| D0374 | An area is a shelf of posts: the site’s own notes, or one project’s. | text (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0376 | TAGLINE | text (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | false | needs-he-field |  |
| D0381 | Tagline | text (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | true | needs-he-field |  |
| D0385 | Project | text (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | false | needs-he-field |  |
| D0388 | Published | text (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | false | needs-he-field |  |
| D0392 | SLUG (THE URL) Lowercase words separated by single hyphens. No dots or spaces — this becomes the URL, so “windom.app” would not resolve. Tid… | text (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0394 | COVER IMAGE URL Must be a full https:// URL that returns an image. A GitHub /blob/ link is an HTML page, not an image — it is saved as its r… | text (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0408 | PUBLISHED PATHS | text (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | false | needs-he-field |  |
| D0409 | 2 OF 20 PATHS PUBLISHED | text (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0410 | README.md | text (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | false | keep-latin |  |
| D0412 | CHANGELOG.md | text (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | false | keep-latin |  |
| D0416 | SYNC FROM GITHUB | text (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | false | needs-he-field |  |
| D0417 | FROM GITHUB | text (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | false | needs-he-field |  |
| D0418 | 15 stars · TypeScript · MIT · fetched 03/11/2026, 21:12:10 | text (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0422 | WindoM | attr:placeholder (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | false | keep-latin |  |
| D0423 | Every new tab becomes a dashboard | attr:placeholder (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | false | translate |  |
| D0424 | windom | attr:placeholder (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | false | keep-latin |  |
| D0434 | main | attr:placeholder (open:Choose from library, open:Choose an icon) | content-store | /he/admin/areas/windom | false | needs-he-field |  |
| D0455 | The projects on the home page, the work page and each project page. English is required; Hebrew is optional and falls back to English. Image… | text (open:Choose from library) | content-store | /he/admin/projects | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0463 | 3. PROGRAMMING WITH YEHUDA | text (open:Choose from library) | content-store | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0464 | 4. ICAROS | text (open:Choose from library) | content-store | /he/admin/projects | false | keep-latin | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0465 | ADD A PROJECT | text (open:Choose from library) | content-store | /he/admin/projects | false | needs-he-field |  |
| D0467 | The address: /projects/&lt;slug> | text (open:Choose from library) | content-store | /he/admin/projects | false | needs-he-field |  |
| D0469 | STATE | text (open:Choose from library) | content-store | /he/admin/projects | false | needs-he-field |  |
| D0470 | Live, Released, In progress, Archived… | text (open:Choose from library) | content-store | /he/admin/projects | false | needs-he-field |  |
| D0482 | The sentence /story tells about this project. | text (open:Choose from library) | content-store | /he/admin/projects | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0485 | 1. STATE: IN USE | text (open:Choose from library) | content-store | /he/admin/projects | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0486 | state | text (open:Choose from library) | content-store | /he/admin/projects | false | needs-he-field |  |
| D0487 | tech | text (open:Choose from library) | content-store | /he/admin/projects | false | needs-he-field |  |
| D0488 | where | text (open:Choose from library) | content-store | /he/admin/projects | false | needs-he-field |  |
| D0489 | when | text (open:Choose from library) | content-store | /he/admin/projects | false | needs-he-field |  |
| D0492 | 2. TECH: REACT 19 | text (open:Choose from library) | content-store | /he/admin/projects | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0493 | 3. WHERE: CHROME WEB STORE | text (open:Choose from library) | content-store | /he/admin/projects | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0494 | TECH | text (open:Choose from library) | content-store | /he/admin/projects | false | needs-he-field |  |
| D0497 | A picture from the library, /projects/… or https://…; empty for none. | text (open:Choose from library) | content-store | /he/admin/projects | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0506 | 1. CHROME WEB STORE | text (open:Choose from library) | content-store | /he/admin/projects | false | keep-latin | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0512 | 1. PUBLISHED ON THE CHROME WEB STORE, V1.5. | text (open:Choose from library) | content-store | /he/admin/projects | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0544 | Preview this project ↗ | text (open:Choose from library) | content-store | /he/admin/projects | false | needs-he-field |  |
| D0803 | ‹WindoM 1.0: the new tab as a dashboard | text (open:הוספת תמונה מהספרייה, open:Choose from library) | content-store | /he/admin/posts/windom-1-0-first-release | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0804 | Markdown. הדביקו או גררו תמונה כדי להעלות אותה. הקלידו [[ כדי לקשר לרשימה, לתחום או לפרויקט. קיצורים: Ctrl+B מודגש, Ctrl+I נטוי, Ctrl+K קישו… | text (open:הוספת תמונה מהספרייה, open:Choose from library) | content-store | /he/admin/posts/windom-1-0-first-release | false | needs-he-field |  |
| D0805 | WindoM 1.0 is the first release. It replaces the page Chrome opens on every new tab with a dashboard, and it is built so that the first thin… | text (open:הוספת תמונה מהספרייה, open:Choose from library) | content-store | /he/admin/posts/windom-1-0-first-release | true | translate |  |
| D0819 | WindoM 1.0 replaces Chrome's empty new tab with a dashboard: clock, weather, tasks, calendar, music, quick links and a focus timer, with an … | text (open:הוספת תמונה מהספרייה, open:Choose from library) | content-store | /he/admin/posts/windom-1-0-first-release | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0820 | windom-1-0-first-release | text (open:הוספת תמונה מהספרייה, open:Choose from library) | content-store | /he/admin/posts/windom-1-0-first-release | false | keep-latin |  |
| D0827 | הסרת התגית windom | attr:aria-label (open:הוספת תמונה מהספרייה, open:Choose from library) | content-store | /he/admin/posts/windom-1-0-first-release | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D0828 | הסרת התגית release | attr:aria-label (open:הוספת תמונה מהספרייה, open:Choose from library) | content-store | /he/admin/posts/windom-1-0-first-release | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D0829 | הסרת התגית chrome-extension | attr:aria-label (open:הוספת תמונה מהספרייה, open:Choose from library) | content-store | /he/admin/posts/windom-1-0-first-release | false | keep-latin | latin-at-end-of-rtl-attr; tag slug inside a Hebrew aria-label: fine to keep, wrap in LRI/PDI |
| D0833 | MCP clients you signed in to this site’s remote MCP server with GitHub. Access tokens last an hour; a connection renews itself for up to 30 … | text | content-store | /he/admin/connections | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0844 | 1. THE FIRST SOFTWARE SHIPPED. | text | content-store | /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0850 | IN THE ORDER THEY COME AFTER THE PROJECTS | text | content-store | /he/admin/story | false | needs-he-field |  |
| D0851 | 1. FULL-STACK ENGINEER | text | content-store | /he/admin/story | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0853 | WHEN | text | content-store | /he/admin/story | false | needs-he-field |  |
| D0857 | 2. TECHNICAL TEAM LEAD | text | content-store | /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0859 | Leading a small team that builds and runs internal software. | text | content-store | /he/admin/story | true | translate |  |
| D0863 | Still writing and reviewing code every day. | text | content-store | /he/admin/story | true | translate |  |
| D0867 | LAYOUTS | text | content-store | /he/admin/story | false | needs-he-field |  |
| D0869 | 1. PROGRAMMING-WITH-YEHUDA | text | content-store | /he/admin/story | false | keep-latin | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0872 | programming-with-yehuda | text | content-store | /he/admin/story | false | keep-latin |  |
| D0873 | icaros | text | content-store | /he/admin/story | false | keep-latin |  |
| D0874 | full-stack | text | content-store | /he/admin/story | false | keep-latin |  |
| D0875 | now | text | content-store | /he/admin/story | false | needs-he-field |  |
| D0876 | LAYOUT | text | content-store | /he/admin/story | false | needs-he-field |  |
| D0878 | under | text | content-store | /he/admin/story | false | needs-he-field |  |
| D0879 | overlap | text | content-store | /he/admin/story | false | needs-he-field |  |
| D0880 | 2. ICAROS | text | content-store | /he/admin/story | false | keep-latin | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0888 | 1. THINGS OTHER PEOPLE COULD OPEN. | text | content-store | /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0893 | 2. THEN, THINGS THEY RELIED ON. | text | content-store | /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0894 | 3. THEN, A TEAM. | text | content-store | /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1049 | An area is either this site’s own notes or one project. A project area carries its own posts, links and repository. | text | content-store | /he/admin/areas | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1052 | project · /windom · 10 posts · YehudaBriskman/WindoM | text | content-store | /he/admin/areas | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1053 | project · /bothy · 5 posts · YehudaBriskman/Bothy | text | content-store | /he/admin/areas | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1057 | Pictures, icons and short videos for posts, areas and projects. Each is stored once and cleaned of camera, location and device data. Picture… | text | content-store | /he/admin/media | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1066 | Upload a picture, an icon or a video above, or import the site’s existing project pictures with backend/scripts/import-media.mjs. | text | content-store | /he/admin/media | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1070 | The hero, How I work, the contact plate, the profiles and the footer. English is required; Hebrew is optional and falls back to English. | text | content-store | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1077 | WHERE | text | content-store | /he/admin/site-copy | false | needs-he-field |  |
| D1081 | 1. TECHNOLOGY | text | content-store | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1085 | 2. PRODUCT BUILDER | text | content-store | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1089 | 3. BUILD BOLDLY | text | content-store | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1093 | 4. APPLIED AI | text | content-store | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1097 | 5. KEEP IMPROVING | text | content-store | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1102 | How I work | text | content-store | /he/admin/site-copy | false | translate |  |
| D1110 | 1. I'M A FULL-STACK ENGINEER AND A TECHNICA | text | content-store | /he/admin/site-copy | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1112 | 2. BEFORE | text | content-store | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1113 | 1. BEFORE THAT I WAS A FULL-STACK ENGINEER | text | content-store | /he/admin/site-copy | false | needs-he-field | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1114 | 3. OUTSIDE WORK | text | content-store | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1115 | 1. OUTSIDE WORK I SHIP MY OWN PRODUCTS END | text | content-store | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1119 | 1. INSTALL FROM EMPTY, EVERY TIME | text | content-store | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1125 | 2. A CHECK THAT CANNOT FAIL IS NOT A CHECK | text | content-store | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1128 | 3. GENERATED, NEVER COMMITTED | text | content-store | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1145 | 1. GITHUB | text | content-store | /he/admin/site-copy | false | keep-latin | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1147 | Github | text | content-store | /he/admin/site-copy | false | keep-latin |  |
| D1148 | Linkedin | text | content-store | /he/admin/site-copy | false | keep-latin |  |
| D1150 | 2. LINKEDIN | text | content-store | /he/admin/site-copy | false | keep-latin | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1268 | draft | text | content-store | /he/admin/posts | false | needs-he-field |  |
| D1269 | published | text | content-store | /he/admin/posts | false | needs-he-field |  |
| D0072 | Full-stack engineer and team lead in Tel Aviv. I ship products end to end and build the checks that prove they still work. | head:description | seo | 43 routes (/he, /he/a-page-that-does-not-exist, …) | n/a | translate |  |
| D0073 | Yehuda Briskman | head:og:site_name | seo | 43 routes (/he, /he/a-page-that-does-not-exist, …) | n/a | keep-latin |  |
| D0074 | Yehuda Briskman · Full-stack engineer & team lead | head:og:title | seo | 43 routes (/he, /he/a-page-that-does-not-exist, …) | n/a | translate |  |
| D0075 | I ship products end to end, and build the checks that prove they work. Tel Aviv. | head:og:description | seo | 43 routes (/he, /he/a-page-that-does-not-exist, …) | n/a | translate |  |
| D0076 | https://yehudabriskman.com/og.png | head:twitter:image | seo | 43 routes (/he, /he/a-page-that-does-not-exist, …) | n/a | keep-latin |  |
| D0077 | Yehuda Briskman, full-stack engineer and team lead | head:twitter:image:alt | seo | 43 routes (/he, /he/a-page-that-does-not-exist, …) | n/a | translate |  |
| D0594 | לא נמצא · Yehuda Briskman | head:title | seo | 7 routes (/he/a-page-that-does-not-exist, /he/admin/media, …) | n/a | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0372 | רשימות · ניהול · Yehuda Briskman | head:title | seo | /he/admin/posts | n/a | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0438 | עריכה: Windom · ניהול · Yehuda Briskman | head:title | seo | /he/admin/areas/windom | n/a | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0831 | עריכה: Windom 1 0 first release · ניהול · Yehuda Briskman | head:title | seo | /he/admin/posts/windom-1-0-first-release | n/a | translate | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0839 | אפליקציות מחוברות · ניהול · Yehuda Briskman | head:title | seo | /he/admin/connections | n/a | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D1055 | תחומים · ניהול · Yehuda Briskman | head:title | seo | /he/admin/areas | n/a | keep-latin | Latin/number at the end of an RTL run (punctuation may mirror) |
| D0303 | Signed in as YehudaBriskman | text (open:Choose from library, open:Choose an icon) | admin-data | 10 routes (/he/admin/areas, /he/admin/areas/windom, …) | false | translate |  |
| D0433 | YehudaBriskman | attr:placeholder (open:Choose from library, open:Choose an icon) | admin-data | /he/admin/areas/windom | false | translate |  |
| D0837 | Run claude mcp add --transport http yehuda https://yehudabriskman.com/mcp and sign in; the client appears here. | text | admin-data | /he/admin/connections | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0838 | claude mcp add --transport http yehuda https://yehudabriskman.com/mcp | text | admin-data | /he/admin/connections | false | keep-latin |  |
| D0440 | CHOOSE A PICTURE | text (open:Choose from library, open:הוספת תמונה מהספרייה) | unknown | /he/admin/areas/windom, /he/admin/posts/windom-1-0-first-release, /he/admin/projects | false | translate |  |
| D0441 | or drop one here. Pictures: JPEG, PNG, WebP, AVIF or plain SVG, up to 10 MB. | text (open:Choose from library, open:הוספת תמונה מהספרייה) | unknown | /he/admin/areas/windom, /he/admin/posts/windom-1-0-first-release, /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0443 | 0 pictures | text (open:Choose from library, open:הוספת תמונה מהספרייה) | unknown | /he/admin/areas/windom, /he/admin/posts/windom-1-0-first-release, /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0444 | There are no pictures in the library yet. Upload the first above. | text (open:Choose from library, open:הוספת תמונה מהספרייה) | unknown | /he/admin/areas/windom, /he/admin/posts/windom-1-0-first-release, /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0462 | 2. BOTHY | text (open:Choose from library) | unknown | /he/admin/projects, /he/admin/site-copy | false | keep-latin | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0807 | The basics on one page. A clock with a personalised greeting, a live weather widget, a to-do list kept on the device, daily quotes, quick li… | text (open:הוספת תמונה מהספרייה, open:Choose from library) | unknown | /he/admin/posts/windom-1-0-first-release, /he/blog/windom-1-0-first-release | true | translate |  |
| D0808 | Backgrounds from Unsplash or from your own images. | text (open:הוספת תמונה מהספרייה, open:Choose from library) | unknown | /he/admin/posts/windom-1-0-first-release, /he/blog/windom-1-0-first-release | true | translate |  |
| D0809 | A focus mode with a countdown timer, for the stretch of the day when the dashboard should get out of the way. | text (open:הוספת תמונה מהספרייה, open:Choose from library) | unknown | /he/admin/posts/windom-1-0-first-release, /he/blog/windom-1-0-first-release | true | translate |  |
| D0810 | Search from the page, through Google or DuckDuckGo. | text (open:הוספת תמונה מהספרייה, open:Choose from library) | unknown | /he/admin/posts/windom-1-0-first-release, /he/blog/windom-1-0-first-release | true | translate |  |
| D0811 | Optional integrations. Google Calendar and a Spotify now-playing widget, both off until you connect them. | text (open:הוספת תמונה מהספרייה, open:Choose from library) | unknown | /he/admin/posts/windom-1-0-first-release, /he/blog/windom-1-0-first-release | true | translate |  |
| D0812 | A settings panel with controls for each section. | text (open:הוספת תמונה מהספרייה, open:Choose from library) | unknown | /he/admin/posts/windom-1-0-first-release, /he/blog/windom-1-0-first-release | true | translate |  |
| D0845 | LINE 1 | text | unknown | /he/admin/site-copy, /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0861 | LINE 2 | text | unknown | /he/admin/site-copy, /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0379 | Optional, field by field. A field left empty shows the English on the Hebrew page, marked as English. | text (open:Choose from library, open:Choose an icon) | unknown | /he/admin/areas/windom | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0399 | ICON None. CHOOSE AN ICON A small mark for this area, from the library’s icons. A one-colour icon takes the text colour around it. | text (open:Choose from library) | unknown | /he/admin/areas/windom | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0415 | A trailing slash publishes a whole folder; without one it is a single file. Wildcards are not expanded; they match literally. | text (open:Choose from library, open:Choose an icon) | unknown | /he/admin/areas/windom | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0448 | or drop one here. Icons: SVG or PNG, up to 64 KB. | text (open:Choose an icon) | unknown | /he/admin/areas/windom | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0450 | There are no icons in the library yet. Upload the first above. | text (open:Choose an icon) | unknown | /he/admin/areas/windom | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0451 | ICON None. CHOOSE AN ICON Icons × CHOOSE AN ICON or drop one here. Icons: SVG or PNG, up to 64 KB. SEARCH 0 icons There are no icons in the … | text (open:Choose an icon) | unknown | /he/admin/areas/windom | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0513 | HIGHLIGHT 1 | text (open:Choose from library) | unknown | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0516 | 2. PUSH A VERSION TAG AND IT BUILDS, ZIPS A | text (open:Choose from library) | unknown | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0517 | HIGHLIGHT 2 | text (open:Choose from library) | unknown | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0520 | 3. FULL STACK SOLO: REACT FRONT END, FASTIF | text (open:Choose from library) | unknown | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0521 | HIGHLIGHT 3 | text (open:Choose from library) | unknown | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0535 | 1. THE GMAIL WIDGET WAS REMOVED FOR A LICEN | text (open:Choose from library) | unknown | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0541 | 2. THE GLASS IS COMPUTED OPTICS RATHER THAN | text (open:Choose from library) | unknown | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0542 | 3. SIGNING IN LOGGED YOU STRAIGHT BACK OUT | text (open:Choose from library) | unknown | /he/admin/projects | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0822 | מודגש (Ctrl+B) | attr:title (open:הוספת תמונה מהספרייה, open:Choose from library) | unknown | /he/admin/posts/windom-1-0-first-release | false | keep-latin | mixed run in an attribute (cannot be isolated with markup); key name; isolate |
| D0823 | נטוי (Ctrl+I) | attr:title (open:הוספת תמונה מהספרייה, open:Choose from library) | unknown | /he/admin/posts/windom-1-0-first-release | false | keep-latin | mixed run in an attribute (cannot be isolated with markup); key name; isolate |
| D0824 | קוד בשורה (Ctrl+E) | attr:title (open:הוספת תמונה מהספרייה, open:Choose from library) | unknown | /he/admin/posts/windom-1-0-first-release | false | keep-latin | mixed run in an attribute (cannot be isolated with markup); key name; isolate |
| D0825 | קישור (Ctrl+K) | attr:title (open:הוספת תמונה מהספרייה, open:Choose from library) | unknown | /he/admin/posts/windom-1-0-first-release | false | keep-latin | mixed run in an attribute (cannot be isolated with markup); key name; isolate |
| D0826 | ## כותרת טקסט, `קוד`, [[a-note]] ובלוקי קוד עובדים כולם. | attr:placeholder (open:הוספת תמונה מהספרייה, open:Choose from library) | unknown | /he/admin/posts/windom-1-0-first-release | true | keep-latin | mixed run in an attribute (cannot be isolated with markup) |
| D0856 | 1. BUILDING SOFTWARE ACROSS THE WHOLE STACK | text | unknown | /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0858 | 1. LEADING A SMALL TEAM THAT BUILDS AND RUN | text | unknown | /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0860 | 2. STILL WRITING AND REVIEWING CODE EVERY D | text | unknown | /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0871 | start-2021 | text | unknown | /he/admin/story | false | keep-latin | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0881 | 3. BOTHY | text | unknown | /he/admin/story | false | keep-latin | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D0882 | 4. NOW | text | unknown | /he/admin/story | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1051 | site · /site · 4 posts | text | unknown | /he/admin/areas | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1059 | or drop one here. Pictures: JPEG, PNG, WebP, AVIF or plain SVG, up to 10 MB. Icons: SVG or PNG, up to 64 KB. Videos: MP4 or WebM, up to 25 M… | text | unknown | /he/admin/media | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1082 | PHRASE 1 | text | unknown | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1086 | PHRASE 2 | text | unknown | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1090 | PHRASE 3 | text | unknown | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1094 | PHRASE 4 | text | unknown | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1098 | PHRASE 5 | text | unknown | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1107 | 1. NOW | text | unknown | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1111 | 2. I LEAD A SMALL TEAM BUILDING AND RUNNING | text | unknown | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1123 | 1. EVERY PULL REQUEST ON BOTHY CLONES THE R | text | unknown | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1124 | 2. A NIGHTLY JOB REPEATS IT AT A PATH WITH | text | unknown | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1126 | 1. ONE CI JOB EXISTS ONLY TO PLANT A MUTATI | text | unknown | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1127 | 2. A GREEN SUITE AND A SUITE THAT IS INCAPA | text | unknown | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1129 | 1. CREDENTIALS ARE GENERATED AT INSTALL TIM | text | unknown | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
| D1130 | 2. THE BOOTSTRAP PRINTS WHICH KEYS IT WROTE | text | unknown | /he/admin/site-copy | false | translate | Latin with punctuation/digits laid out RTL (unmarked): ends may flip |
