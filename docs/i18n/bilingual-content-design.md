# Bilingual content (en/he): design

Status: **proposal for review** · Issue: #295 (part of #292) · Date: 2026-11-03
Companions: [English-on-Hebrew audit](english-on-hebrew-audit.md) (#293) and
[Hebrew tech glossary](hebrew-tech-glossary.md) (#294).

## 1. Summary

The site is English-first with a Hebrew twin under `/he` (#280, #287, #290). UI
words are already complete in Hebrew and gated by tests. **Content** is not: of
the text a Hebrew visitor reads on a typical page, most is still English from the
content store, GitHub or the server render, correctly marked `lang="en"` but
English all the same (see the audit's headline numbers).

This document proposes how content becomes bilingual **without** changing what
already works:

1. **Keep translations inside the document they translate.** Two shapes already
   exist and both are right for their content: a per-field `{ en, he }` map for
   structured copy (projects, story, site copy) and a `he` sibling block for
   long-form notes and areas. Formalise them, and give **media** and the
   remaining single-language fields the same treatment.
2. **Add one small piece of metadata per translation: a source fingerprint.**
   It is what lets the site tell *translated* from *stale* (the English changed
   after the Hebrew was written). Everything else in this design (the status
   pill, the Translations dashboard, the SEO rules, the MCP tools) is computed
   from content + fingerprint. No new database, no TMS, no job queue.
3. **Make the Hebrew page honest to crawlers.** A `/he` page whose main content
   is only the English fallback is `noindex`, has no `hreflang` pair and is not
   in the sitemap. A page with a real translation gets all three.
4. **Give the one editor a calm surface**: side-by-side fields, a status pill per
   item, one Translations dashboard listing what is missing or stale, the
   glossary as hints while typing.

Rollout is 8 small PRs (§10), each shippable alone. The first two are pure
reads (status computation and the dashboard) and change no stored data.

## 2. Context: what exists today (post #290, `0b6714f`)

| Surface | Where the words live | Hebrew today | Shape |
|---|---|---|---|
| UI chrome, page furniture | `web/src/i18n/{words,chrome,pages,statement}.ts`, component `words.ts` (dashboard, work, reader, note editor, settings) | Complete; `words.test.ts` proves every key has `he`, `untranslated.test.ts` proves JSX has no stray English | `{ en: {...}, he: {...} }` tables |
| SEO titles/descriptions | `backend/src/services/seo-words.ts` | Complete for site pages | table |
| Projects, story, site copy | CouchDB `content:projects`, `content:story`, `content:site-copy` (#163), each with a `draft` beside it | Prose fields optional `he`; names, field values, tech, link labels are single strings | per-field `Text = { en, he? }` (`backend/src/schemas/site-content.ts`) |
| Notes (posts) | `post:<slug>`, with `draft` (#285) | Optional `he: { title, subtitle, excerpt, body }`; none of the 14 real notes has it | sibling block |
| Areas (collections) | `collection:<slug>` | Optional `he: { title, tagline, description }` | sibling block |
| Media | `media:<id>`: `alt`, `caption`, `credit`, video caption track `lang` | None | single string |
| Site settings | `settings` doc with history (#284) | No prose (section order, theme, accent) | n/a |
| GitHub-derived | repo stats, release names, README/CHANGELOG under "docs", activity titles | None (English upstream) | fetched, cached |
| Activity / channel log | `activity` events: titles like "Pushed to Bothy", "Site v1.0.0" | Built in English on the server | strings |
| Feeds | `/api/seo/feed*.xml` | English channel titles, `<language>en` | generated |
| MCP | `backend/src/mcp/shared/tools.ts` | Tool titles/descriptions English (developer-facing); no tool reads or writes `he` | n/a |
| Admin | `web/src/pages/Admin*.tsx`, `components/admin/**` | Shell and note editor localised; content forms are English-only and excluded from `untranslated.test.ts` (`SKIP_FILES`) | hard-coded |

Fallback is already done well on the public side: a missing `he` renders the
English inside `lang="en" dir="ltr"` both in the SPA and in the server render
(`seo.route.ts`, "A store text in a language, escaped, and marked when it fell
back to English"). What is missing is any notion of **staleness**, any per-item
**status**, any **SEO consequence** of falling back, and Hebrew for **media**,
**names-as-prose**, **activity**, **feeds** and the **admin forms**.

## 3. Goals and non-goals

Goals
- Every piece of owner-written content can carry Hebrew, field by field, and the
  site always knows whether that Hebrew is missing, draft, current or stale.
- English stays the source of truth and stays required. Hebrew is never required
  to publish anything.
- The owner can see, in one place, everything that needs translating, ordered by
  how visible it is.
- Crawlers and screen readers are never told a page is Hebrew when its content
  is not.
- The glossary (#294) is visible while writing Hebrew, as advice.

Non-goals (and why)
- **A translation management system** (Crowdin, Lokalise, Weblate). One editor,
  a few hundred strings, and a store with drafts already. A TMS adds a sync
  boundary, a second source of truth and a vendor for zero gain.
- **Machine translation in the pipeline.** Not automatic. §7.7 allows an
  *optional, owner-triggered* draft suggestion through the MCP server (an LLM
  client the owner already uses), which writes a *draft* and is never published
  unreviewed.
- **Hebrew-only content.** Not in v1; see open question Q3.
- **Translating GitHub data.** READMEs, release names and repo descriptions stay
  English upstream; §6.4 gives them a lightweight Hebrew path where the owner
  wants one.
- **More languages.** The model is written for `he` but keyed by language code,
  so a third language would be a data change, not a schema redesign. No work is
  done for it now.

## 4. Data model options

The three candidates, judged against what this site actually has: drafts on
content and notes (#163, #285), settings history (#284), CouchDB with Mango
indexes, nightly backups of the one database, an MCP server that reads and
writes posts and areas, and one editor.

| | **A. Per-field map** `title: { en, he }` | **B. `he` sibling block** `he: { title, body }` | **C. Per-locale documents** `post:x` + `post:x@he` |
|---|---|---|---|
| Used today by | projects, story, site copy | notes, areas | nothing |
| Editing UX | Best for short structured fields: the two languages of one field sit together, side by side | Best for long-form: the Hebrew note is one unit, edited as a body | Same as B in the UI, but two saves and two `_rev`s per item |
| Partial translation | Natural: each field is independently present or absent | Natural per field inside the block | Whole-doc granularity unless the doc is sparse, which is B again |
| Publish per language | Awkward: language state would live in every field | Natural: the block can carry its own `status`/`publishedAt` | Natural |
| Drafts (#163/#285) | Draft holds the same shape; already works | Draft holds `he` too; already works (`draft.he`) | Two drafts per item; publish of one must not race the other |
| History / versioning | One doc, one history | One doc, one history | Two histories to correlate |
| Conflicts | One `_rev`; editing en and he in two tabs collides on one doc (rare, one editor) | Same | No collision between languages; but a slug rename must touch both docs atomically, which CouchDB cannot do |
| Querying (Mango) | Indexes on `title` must become `title.en`: **breaking** for posts | Unchanged: English stays top-level | Every query gains a language filter; list views must join |
| Migration from today | Posts and areas would be rewritten: every reader of `post.title` changes (API, SEO, feeds, MCP, admin) | None for posts/areas; content docs stay A | Split every translated doc; rewrite every reader |
| Backups / restore | Unchanged | Unchanged | Unchanged, but a partial restore can orphan one half |
| MCP tools | `get_post` returns maps: changes every client | Additive: a `he` key on existing shapes | New tools and pairing logic |
| Size | +he per field | +he per doc (a long Hebrew body roughly doubles a note, fine for CouchDB) | Same bytes, two docs |

### Recommendation: keep A and B where they are, formalise both, add fingerprints

The current split is not an accident to clean up; it follows the content.
Structured copy is many short fields, each translated on its own: A. A note is
read as a whole in one language and could reasonably be published in Hebrew
later than in English: B. Converting either to the other buys consistency on
paper and costs a migration of every reader (A for posts), or loses the natural
per-language publish (B for structured copy). C solves a multi-editor,
multi-language problem this site does not have, and introduces the one thing
CouchDB is bad at: keeping two documents consistent.

So the decision is:

- **Structured copy (projects, story, site copy) and media:** A, `Text = { en, he?, heSrc? }`.
- **Notes and areas:** B, the `he` block, extended with metadata.
- **One shared vocabulary** for status, computed the same way for both (§5), so
  the dashboard, the pill, SEO and MCP never care which shape a field has.

### 4.1 Shapes after the change

```ts
// backend/src/schemas/i18n.ts (new): the one place the fingerprint is defined
/** sha256 of the NFC-normalised, whitespace-collapsed English, first 12 hex. */
export const Fingerprint = z.string().regex(/^[0-9a-f]{12}$/);

// A: structured copy and media (site-content.ts `text()` gains one optional key)
export const text = (max: number) => z.object({
  en: z.string().trim().min(1).max(max),
  he: z.string().trim().max(max).transform((v) => v || undefined).optional(),
  /** The English `he` was written against. Absent on legacy data (= "unverified"). */
  heSrc: Fingerprint.optional(),
});

// B: notes (content.ts PostHebrewSchema gains a meta block)
export const PostHebrewSchema = z.object({
  title: z.string().max(200).default(""),
  subtitle: z.string().max(300).default(""),
  excerpt: z.string().max(320).default(""),
  body: z.string().max(200_000).default(""),
  /** Per-field source fingerprints, set by the server on save. */
  src: z.object({ title: Fingerprint, subtitle: Fingerprint, excerpt: Fingerprint, body: Fingerprint })
    .partial().default({}),
  /** The English body this Hebrew body was translated from, for the "what changed" diff. */
  bodyBase: z.string().max(200_000).nullable().default(null),
  /** Hebrew can go live after the English: its own first-publish date. */
  publishedAt: z.string().datetime().nullable().default(null),
  updatedAt: z.string().datetime().nullable().default(null),
});
// Areas: CollectionHebrewSchema gains `src` the same way (no bodyBase: fields are short).
```

> **As built (#303):** `src` and `bodyBase` live in a sibling `heMeta: { src, bodyBase }`
> beside `he` (on the note, on `draft`, and on the area), not inside the `he`
> block. Every existing reader of `he` (the public API, the server render, the
> MCP tools) iterates its fields as words; a sibling keeps them seeing only
> words, and keeps a block with no Hebrew from looking non-empty because it
> holds a `bodyBase`.

Why each piece:
- **`heSrc`/`src` (fingerprint), not a version number.** The English has no
  version counter today, and a counter goes stale on a whitespace-only save. A
  content hash is stable, cheap and computed in one place on the server.
  Normalisation (NFC, collapse whitespace, trim) keeps a reflowed paragraph
  from flagging the Hebrew as stale.
- **Server-stamped.** The client never sends a fingerprint. On every save the
  server sets `heSrc = fp(en)` *for each field whose `he` changed in this save*.
  A field whose English changed and whose Hebrew did not keeps its old `heSrc`,
  which is exactly what makes it stale.
- **`bodyBase` on notes only.** A stale one-line field is obvious; a stale
  2,000-word body is not. Keeping the English body the Hebrew was written
  against lets the editor show *what changed in English since*, with the diff
  the note editor already has (`components/admin/noteEditor/diff.ts`, #285).
  Cost: up to one extra copy of the English body per translated note. Fine.
- **Hebrew `publishedAt`.** Lets the Hebrew note appear in Hebrew listings and
  feeds with its own date, and is what makes "publish Hebrew later" a real event
  (§5.3).

### 4.2 Fields that change shape (string → `Text`)

The audit (#293) found prose that is stored as a plain string and therefore can
never be Hebrew. These become `Text` (A), with a read-side shim (`typeof v ===
"string" ? { en: v } : v`) so old documents keep rendering until migrated:

| Field | Why it is prose, not a name |
|---|---|
| `site-copy.hero.place` (now `Text` after #290) | done |
| project `fields[].value` where `kind` is `state` or `where` ("In use", "Chrome Web Store") | Read aloud as words; #163 kept it a string because `state === "Archive"` is a key. Fix: store the key (`archive`, `in-use`) and translate on render from a word table, not from the store |
| project `links[].label`, area `links[].label`, footer link labels ("Source on GitHub", "Changelog") | Prose labels; brand-only labels ("Chrome Web Store") stay Latin by the glossary |
| project `linkLabel` | usually a domain (Latin by rule); stays a string |
| media `alt`, `caption` | Accessibility: a Hebrew page reading an English `alt` is the single most-heard leak for a screen-reader user. `credit` stays a string (a name) |
| media video captions | `captions` becomes a list keyed by `lang` (a second `.vtt`), the player picks by page language |
| note `links[].label`, `sources[].label` | as above |

> **As built (#306), first part:** project `links[].label` and footer
> `work[].label` are `Text`, read through `textOrString` (a string is `{ en }`).
> The state chip and a `state` field hold a key (`STATE_KEYS`: `live`,
> `in-use`, `open-source`, `in-progress`, `released`, `archive`). An old label
> is read as its key, and a release tag stays as written. `where` values stay
> strings, because every one so far is a brand (category A). Activity: a push
> carries `meta.repo` and a note carries `meta.he`, and the site words both in
> the page language. **Not yet:** media `alt`/`caption` and per-language
> captions wait for the media admin in #296, note `links`/`sources` labels
> wait for the bilingual note editor (#305), and the final conversion script
> plus shim removal come a release later (§4.3).
>
> **As built (#306), second part:** media and note links take the note and
> area shape (§3, shape B), not `Text`: a sibling `he: { alt, caption }` and
> `heMeta.src` fingerprints on the media doc, stamped on save. Every existing
> reader (the MCP, the editors, `/meta`) keeps reading the English strings, so
> nothing migrates, and no stored doc has a Hebrew alt yet to backfill. The Translations
> report lists each picture and video (`type: "media"`, `alt` primary,
> `caption` counted only when the English has one); "still correct" restamps
> it, and `put_translation` refuses it, since media has no draft. Captions:
> `captions` stays the first track, and `moreCaptions` holds one more per
> language (`captions-<lang>.vtt`), added and removed in `/admin/media` through
> `PUT`/`DELETE /api/admin/media/:id/captions/:lang`; `/meta` gives `tracks`,
> and `<MediaVideo>` marks the page language's track `default`. A note's link
> labels sit in its `he` block under `links.<i>.label`, beside each English
> label in the editor, and `local()` swaps them in on a Hebrew page. Notes have
> no `sources` field, so there is nothing to translate there. An area's
> `links[].label` is `Text` (`{ en, he?, heSrc? }`, a string from before read as
> `{ en }`), stamped on save by `stampTexts`, with a Hebrew column in the area
> editor. A label sent as a plain string (the MCP tools) keeps the Hebrew of a
> link whose English and address are unchanged. The public API still gives
> `{ label, url }` with the English, and puts the Hebrew in the area's `he`
> under `links.<i>.label`, as a note's are. **Not yet:** no public page plays
> a video, so the `default` track is proved by unit test only.

`tech[]`, project `title`, area `title` when it is a product name (WindoM,
Bothy), `tags` (URL keys) stay strings: names and keys, Latin by glossary
category A.

### 4.3 Migration plan

All migrations are **additive and lazy**: nothing is rewritten in bulk, and
every reader accepts both the old and new shape.

1. **Fingerprint backfill (one script, idempotent, dry-run by default):** for
   every existing `he` value, stamp `heSrc = fp(current en)`. This asserts that
   today's Hebrew is current, which is true: the only Hebrew in the store was
   written by #290 against today's English. Logged to the audit log.
2. **String → `Text` fields (§4.2):** the read shim ships first; the schema
   accepts both for one release; the admin writes the new shape on next save;
   a final script converts the rest and the shim is removed a release later.
3. **Project field keys:** `state`/`where` values become keys plus a word table
   (`work/words.ts`), with a mapping for the existing values; the story's
   "counted on /story" logic reads the key.
4. **Backups:** take the nightly backup before each script; each script prints
   the doc ids it would touch and needs `--apply`.

## 5. Status and fallback semantics

### 5.1 One status vocabulary

For every **translation unit** (a `Text` field; or one field of a `he` block):

| Status | Rule | Pill |
|---|---|---|
| `missing` | no Hebrew value | `HE —` grey |
| `draft` | Hebrew exists only in the item's `draft` (not published) | `HE draft` blue |
| `translated` | Hebrew published and `heSrc === fp(en)` | `HE ✓` green |
| `stale` | Hebrew published and `heSrc !== fp(en)` | `HE stale` amber |
| `unverified` | Hebrew published, no `heSrc` (legacy, before backfill) | treated as `translated`, shown grey-outlined |
| `n/a` | the field is Latin by rule (a name, a key, a URL) | no pill |

An **item's** status is the worst of its *primary* units (title, the lede
line, the body). Secondary units (link labels, alt text) affect the dashboard
count but not the item pill, so a note does not show "stale" because a link
label changed.

### 5.2 How stale is detected and surfaced

- Computed on read, never stored: `status(unit) = f(en, he, heSrc, inDraft)`.
  One pure function, `backend/src/services/translation-status.ts`, unit-tested,
  also exported to the web build (shared like `apiTokenFormat.ts`).
- Surfaced in four places: the item pill (admin lists and editors), the
  Translations dashboard (§7.3), a count badge on the admin nav item, and
  `GET /api/admin/translations` for MCP.
- **Stale Hebrew stays live.** Hiding it would be worse: a slightly old Hebrew
  sentence beats an English one for a Hebrew reader. The owner fixes or
  acknowledges it ("Hebrew still correct": re-stamps `heSrc` with no text change,
  for an English typo fix that did not change meaning).

### 5.3 Publishing rules

- **English is required and primary.** Every item has English; nothing publishes
  without it (unchanged).
- **A note can publish in English only.** `/he/blog/<slug>` then shows the
  English body inside `lang="en" dir="ltr"`, with a one-line Hebrew notice ("הרשימה
  זמינה באנגלית בלבד"), and is `noindex` (§5.4).
- **Hebrew publishes separately.** The note editor gets "Publish Hebrew" when
  the English is published and the Hebrew draft has a title and body. It copies
  `draft.he` to `he`, stamps `he.publishedAt` on the first time and `he.updatedAt`
  every time, and does **not** touch the English or its `publishedAt`. A
  normal "Publish" publishes both languages' drafts together, as today.
- **Unpublishing Hebrew** clears `he` (kept in the draft), and the page returns to
  fallback.
- **Structured copy** (projects, story, site copy) has one draft and one publish
  per document, as today; the Hebrew rides along. No per-language publish there:
  these are short fields, and a half-translated project card is fine because each
  field falls back on its own.
- **Lists and feeds:** a Hebrew listing (`/he/blog`, an area) lists every
  published note; untranslated ones show their English title marked `lang="en"`
  and an `EN` chip, so the reader knows before clicking. A Hebrew feed
  (`/api/seo/he/feed.xml`, new) lists **only** notes with published Hebrew.

### 5.4 SEO rules

| Page state | `<html lang>` | `robots` | `hreflang` | sitemap | `og:locale` | JSON-LD `inLanguage` |
|---|---|---|---|---|---|---|
| Hub page (`/he`, `/he/blog`, `/he/projects`, `/he/story`): UI translated | `he` | index | en ↔ he pair, x-default en | both | `he_IL` | `he` |
| Item with published Hebrew (translated or stale) | `he` | index | pair | both | `he_IL` | `he` |
| Item with **no** Hebrew (fallback only) | `he` (chrome is Hebrew) | **noindex, follow** | **none** on the he page; the en page lists no he alternate | en only | `en_US` | `en` |
| Item whose English is `seo.noindex` | as today | noindex | none | none | | |

Why `noindex` rather than `canonical → English`: Google treats `rel=canonical`
as a hint and may still index the Hebrew URL with English content, and mixing
canonical-to-another-URL with hreflang is a documented source of conflicting
signals. `noindex, follow` is unambiguous, keeps link equity flowing through the
Hebrew chrome, and flips to `index` the moment Hebrew is published. Today
(audit §SEO) every `/he/blog/<slug>` and `/he/projects/<slug>` is indexable,
claims `og:locale=he_IL`, is in the sitemap with a Hebrew alternate, and serves
an English `<title>` and description: a duplicate of the English page under a
Hebrew label.

The `<title>` and description of a fallback page are English (they cannot carry
`lang`), which is one more reason not to index it.

## 6. Scope by surface

### 6.1 UI strings (word tables)

Unchanged in shape. Process:

1. **Adding a key:** add `en` and `he` together in the component's `words.ts`
   (or `i18n/*.ts`). `words.test.ts` fails on a missing `he`; `untranslated.test.ts`
   fails on English typed into JSX.
2. **Review:** a PR that adds or changes Hebrew lists the keys in its body with
   both languages (the `docs/hebrew/strings.md` table regenerated by script), and
   the glossary lint (§9) runs on every `he` value.
3. **Admin forms join the gate.** `SKIP_FILES` in `untranslated.test.ts` drops
   the admin forms one file at a time (the PENDING list mechanism already exists
   for exactly this). The owner reads the admin in Hebrew only if he chooses
   `/he/admin`; the audit shows ~all of its form labels are English today.
4. **Allowlist from the glossary.** The `LATIN` set in `untranslated.test.ts` is
   replaced by the category-A terms of `docs/i18n/glossary.json` (moved to
   `web/src/i18n/glossary.json` when enforcement lands).

### 6.2 Store content

Notes, areas, projects, story, site copy, media alt/captions: per §4. Settings
(#284) holds no prose today; if hero lines ever move from site copy into
settings, they are `Text` there and the settings history covers them.

### 6.3 Activity and the channel log

Event titles are generated server-side in English ("Pushed to Bothy", "Bothy
v1.9.0"). Change the event to carry **structure, not a sentence**: `{ kind:
"push", area: "bothy" }` and render the sentence from a word table in the page
language (`עדכוני קוד ב־Bothy`). Release/tag names stay Latin (category A).
This removes a whole source class from the audit without any stored Hebrew.

### 6.4 GitHub-derived data

- Repo stats, language names, license ids, tags: Latin by rule (A), always
  wrapped in `<bdi>`/`dir="ltr"` where they sit inside Hebrew.
- Repo description and README/CHANGELOG ("docs" tab): English, marked. Optional
  Hebrew: a project may list `README.he.md` in `repo.docPaths`; on `/he` the docs
  tab prefers a `*.he.md` sibling when it exists. No store change, no sync
  machinery; the owner opts in per repo.
- The project's own fact/description in the store is what Hebrew readers mostly
  see; translating those (A) covers the visible part.

### 6.5 SEO and feeds

- `seo-words.ts` stays the table for site-level words (complete).
- Per-item titles/descriptions come from the item's Hebrew when published;
  otherwise §5.4.
- `post.seo.title/description` gain a `he` sibling (`seo.he: { title,
  description }`) inside the `he` block, defaulting to the Hebrew title/excerpt.
- Feeds: `/api/seo/he/feed.xml` (Hebrew notes only, `<language>he`); area and log
  feeds get a Hebrew twin only if Q5 says yes.
- OG images: the generated card text (`og.ts`) renders the Hebrew title when one
  is published, with the Hebrew face already bundled (#287 fonts).

### 6.6 MCP

Tool titles and descriptions are read by an LLM client and shown to the developer
connecting it; they stay English (developer docs, category D in the glossary).
The `/he/developers/mcp` page explains them in Hebrew. What changes is data
access, §8.3.

## 7. Admin UX

The admin is being redesigned in a GitHub/dashboard style in a parallel PR. The
wireframes use that vocabulary: a left nav, a list with filter chips and
label-style pills, a detail page with a header bar and a right sidebar.

### 7.1 Editing both languages

- **Short fields: side by side.** English left, Hebrew right, on one row, at
  desktop width; stacked (English above) under 900 px. Both visible at once is
  what makes "is this still the same sentence" checkable at a glance.
- **Long body: tabs with a third "side by side" tab.** A 2,000-word body is
  edited in one column; comparing is a mode, not the default.
- The physical order is the same in `/admin` and `/he/admin` (English on the
  left, as the source); only the chrome's direction changes.

```
┌ Notes / windom-1-0-first-release ──────────────────────────── [Save draft] [Publish ▾] ┐
│  Title                                                                                   │
│  ┌ English ─────────────────────────────┐ ┌ עברית ───────────────────── HE stale ┐   │
│  │ WindoM 1.0: the new tab as a dashboard│ │ ‏WindoM 1.0: הלשונית החדשה כדשבורד     │   │
│  └───────────────────────────────────────┘ └───────────────────────── [Still correct]┘ │
│  Subtitle   [ … ]                         [ … ]                          HE —           │
│  Excerpt    [ … ]                         [ … ]                          HE ✓           │
│                                                                                          │
│  Body   ( English | עברית | Side by side | Preview en | Preview he )                     │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐│
│  │ (RTL textarea, see 7.4)                                                              ││
│  └──────────────────────────────────────────────────────────────────────────────────────┘│
│  ⚠ The English body changed since this Hebrew was written.  [Show what changed]          │
└──────────────────────────────────────────────────────────────────────────────────────────┘
  Sidebar:  Status  EN published · HE draft
            Hebrew  [Publish Hebrew]   first published —
            Terms   PR · ריפו · קומיט (3 glossary hits, 1 warning)
```

`Publish ▾` holds "Publish both" (default), "Publish English only", "Publish
Hebrew only". "Show what changed" opens the existing diff view on `bodyBase` →
current English.

> **As built (#305):** the note editor puts the Hebrew title, subtitle and
> excerpt beside their English (RTL, each with its pill). The body toggle
> gains "Side by side": two editors, no preview. A stale field gets a line
> above the body; the body's line shows the diff from `heMeta.bodyBase` to the
> English now, and every line offers "Hebrew still correct" (#303's ack,
> disabled while edits are unsaved). Publish scope lives in the review dialog
> as a radio group, shown once the note is live: `scope: "en"` publishes the
> English and keeps the live Hebrew, `"he"` publishes the Hebrew over the live
> English; what was not published stays in the draft. `#field=` from the
> Translations page focuses the field's Hebrew input (`body` opens the Hebrew
> body). **Deferred:** Hebrew-only notes (§7.6; they touch public listings and
> the sitemap) and "Unpublish Hebrew".

### 7.2 The status pill

One component (`TranslationPill`), the same everywhere: in every admin list row,
in each editor's header, and beside each bilingual field. Text plus colour, never
colour alone: `HE ✓`, `HE stale`, `HE draft`, `HE —`. In `/he/admin` the label
reads `עב׳ ✓` etc.

```
Notes                                       [Filter: All ▾] [Hebrew: Any ▾]  [New note]
───────────────────────────────────────────────────────────────────────────────────────
● An updater that cannot choose the version     bothy    Published   HE —      2d ago
● WindoM 1.5: computed glass                    windom   Published   HE stale  5d ago
○ Draft: the site in Hebrew                      site     Draft       HE draft  1h ago
```

### 7.3 The Translations dashboard

A new admin page, `/admin/translations`, the GitHub "issues list" shape: counts
as tabs, filter chips, one row per item, sorted by visibility.

```
Translations                                                    Hebrew coverage 41%
───────────────────────────────────────────────────────────────────────────────────
[ Missing 58 ] [ Stale 3 ] [ Draft 2 ] [ Done 19 ]
Type: [All] [Notes] [Areas] [Projects] [Story] [Site copy] [Media]   Visibility: [Public ▾]
───────────────────────────────────────────────────────────────────────────────────
HE —     Home · hero tagline lines                 site copy   seen on /he         [Edit]
HE —     WindoM · fact, description, 4 decisions    project     /he, /he/projects   [Edit]
HE stale Bothy · tagline                            area        /he/blog/area/bothy [Edit]
HE —     cabin-under-aurora.jpg · alt               media       /he/story           [Edit]
HE —     An updater that cannot choose the version  note        /he/blog/…          [Edit]
…
```

- "Visibility" ranks by where the item appears: home and hub pages first, then
  project pages, notes by recency, then media alt.
- Each row deep-links to the field (`#field=fact`), and the editor focuses it.
- Data: `GET /api/admin/translations` (§8.2). No stored state; refresh is a
  re-read.
- A count of missing+stale public units shows as a badge on the nav item.

> **As built (#302):** `/admin/translations` reads one report
> (`web/src/services/translations.ts`, cached for 30 s and dropped on any
> admin write). It filters on the client: the tabs are Missing, Stale, Draft
> and Done (unverified counts as done), and type and visibility are selects,
> all held in the query string. A tab's count is the rows it shows under
> the current filters (items, not fields); coverage is by field, in the same
> scope. The nav badge counts public *items* with any field missing or stale,
> and says so in its accessible text.
> A row links to `#field=<path>`. The content editors resolve the path
> (`?project=` and `?role=` pick the item), find the field by `data-path`,
> and focus its Hebrew input. Notes and areas open their editor at the top;
> field focus there comes with the bilingual note editor (#305). Pills sit on
> the Posts and Areas rows, on each project in the Projects list, and on the
> Story opening, each role, and the Site copy sections.

### 7.4 An RTL editing surface

- Every Hebrew input/textarea: `lang="he" dir="rtl"`, Hebrew font stack, logical
  padding. (`Fields.tsx` already does `dir="rtl"`; `AdminEditor.tsx` already
  wraps the Hebrew block in `lang="he" dir="rtl"`.)
- Markdown body: `dir="rtl"` on the textarea with `unicode-bidi: plaintext` so a
  line that starts with Latin (a code line, a list of commands) lays out LTR on
  its own, and fenced code in the preview is always `dir="ltr"`.
- Toolbar actions for bidi: "Insert as code" (backticks: the renderer isolates
  inline code) and "Wrap as Latin" (inserts `<bdi>…</bdi>`, which the markdown
  renderer allows through for this one tag). No invisible control characters are
  typed by hand.
- Ids, slugs, URLs, versions and paths in admin forms are always `dir="ltr"`
  inputs, also in `/he/admin` (data-display skill: direction by what a value is).
- A visible-whitespace toggle shows RLM/LRM/isolate marks when debugging a line.

### 7.5 Preview in both languages

The note editor's preview gets a language switch (`Preview en | Preview he`)
that renders through the same reader components with `lang`/`dir` set, plus
"Open /he preview" which opens the draft preview route under `/he`. Structured
copy editors (`EditorFrame`) get the same switch over their existing preview.

### 7.6 New content in one language, translated later

1. Write English, publish. The item shows `HE —` and appears in the dashboard.
2. Later, open it from the dashboard; the Hebrew column is empty with the
   English beside it. Type Hebrew; it saves to the draft (`HE draft`).
3. "Publish Hebrew". The `/he` page flips from fallback (noindex) to translated
   (indexed, hreflang pair, sitemap, Hebrew feed).
4. If the English is edited afterwards, the unit turns `HE stale` and shows in
   the dashboard's Stale tab until the Hebrew is updated or acknowledged.

### 7.7 Glossary while editing, and an optional draft assist

- **Hints:** a sidebar "Terms" panel lists glossary terms found in the English of
  this item with their agreed Hebrew form ("pull request → PR (ה־PR)"), so the
  translation starts from the policy.
- **Linter:** the Hebrew textarea underlines forbidden variants from
  `glossary.json` (e.g. `רשומה` for a note, `מזלגות` for forks) with the
  preferred form as a one-click fix, and flags a Latin term not on the allowlist.
  Warnings, never blocks: the owner can write anything.
- **Optional assist (owner-triggered only):** the MCP write tool (§8.3) lets the
  owner's own LLM client draft a Hebrew translation into the **draft**, with the
  glossary passed as context by the tool description. It never publishes; the
  dashboard shows it as `HE draft` like any other. This is a convenience, not a
  pipeline, and nothing depends on it.

## 8. API and validation

### 8.1 Schemas (zod)

- `backend/src/schemas/i18n.ts` (new): `Fingerprint`, `fp(text)`, `TranslationStatus`,
  `TranslationUnit`, and the status function. Shared to the web build the way
  `apiTokenFormat.ts` is.
- `text()` (A) and `PostHebrewSchema`/`CollectionHebrewSchema` (B) as in §4.1.
  `heSrc`/`src` are **stripped from client input** (`.omit` on the write
  schemas) and set by the server.
- Media: `alt: text(300)`, `caption: text(500)` (accepting a plain string during
  migration).

### 8.2 Endpoints (auth unchanged: `requireAdmin`, proxy proof or token)

| Method & path | Body / query | Returns |
|---|---|---|
| `GET /api/admin/translations` | `?status=missing,stale&type=post,project&visibility=public` | `{ ok, counts: {missing, stale, draft, translated}, items: [{ type, id, title, route, units: [{ path, status, en, he?, enChangedAt? }] }] }` |
| `POST /api/admin/translations/ack` | `{ type, id, path, rev }` | re-stamps `heSrc` for one unit ("Hebrew still correct"); 409 on stale `rev` |
| `PUT /api/admin/posts/:slug/draft` (existing) | `draft.he` as today | server stamps `src` for changed Hebrew fields on publish |
| `POST /api/admin/posts/:slug/publish` (existing) | `{ rev, languages?: ["en","he"] }` | `languages` defaults to both; `["he"]` publishes Hebrew only |
| `PUT /api/admin/content/:key/draft`, `POST /api/admin/content/:key/publish` (existing) | `Text` fields may carry `he` | server stamps `heSrc` per changed Hebrew field |
| `PUT /api/admin/media/:id` (existing) | `alt`/`caption` as `Text` | same |

Public endpoints are unchanged in shape: they already return `he` blocks and
`Text` maps; they gain nothing but drop `heSrc`/`src`/`bodyBase` (admin-only data;
`public-isolation.test.ts` extended to assert it).

Validation errors in Hebrew: zod messages in `site-content.ts` ("English is
required", "At most N characters") are shown verbatim by the admin today. They
become **codes** (`{ code: "too_long", max: 160 }`) rendered from the admin's
word table, the pattern `SETTINGS_ISSUES` already uses in `site-settings.ts`.

### 8.3 MCP tools

| Tool | Access | Purpose |
|---|---|---|
| `list_translations` | admin, read | the dashboard data; filters as the endpoint |
| `get_translation` | admin, read | one item, both languages side by side, with status per unit and the English diff since `bodyBase` |
| `put_translation` | admin, write (dry run by default, like every MCP write) | set Hebrew for one or more units of one item, into the **draft**; returns the glossary lint warnings |
| `get_post` / `list_posts` (public) | public | add `lang: "en" \| "he"` input; with `he`, return Hebrew where published and `fallback: true` where not |
| `save_post_draft`, `save_area` (existing) | admin | accept `he` in the draft, as the admin forms do |

The glossary (category rules + the term table) is exposed as an MCP resource
(`glossary://he`) so a client drafting Hebrew can read it.

> **As built (#307):** `put_translation` writes through a new
> `PUT /api/admin/translations/draft` `{ type, id, rev?, units: [{ path, he }], dryRun }`
> (dry run by default), which finds each unit server-side, stamps it like an
> admin save and returns the glossary lint as `warnings`. Areas have no draft,
> so it refuses them. `save_post_draft`/`save_area` did not gain `he`:
> `put_translation` is the one way an MCP client writes Hebrew. The backend
> carries a checked copy of the glossary (`backend/src/i18n/`) for the lint
> and for `GET /api/admin/translations/glossary`, which backs the resource.

## 9. Operations

### 9.1 Tests and gates

| Gate | Where | New? |
|---|---|---|
| Every word-table key has `he` | `words.test.ts` | exists |
| No English typed into JSX | `untranslated.test.ts`, allowlist from `glossary.json`, admin forms brought in via PENDING | change |
| Glossary lint over every `he` value in word tables and `seo-words.ts` (forbidden variants, Latin not on allowlist, maqaf after a one-letter prefix before Latin: `ב־GitHub`, not `בGitHub`) | `web/src/i18n/__tests__/glossary.test.ts` | new |
| Status function: fingerprints, normalisation, unit/item rollup | `translation-status.test.ts` | new |
| Public responses never carry `heSrc`/`src`/`bodyBase` | `public-isolation.test.ts` | extend |
| SEO: fallback item → `noindex`, no hreflang, not in sitemap; translated item → index + pair | `seo.route.test.ts` | extend |
| No `toLocale*`/`Intl.*` without an explicit locale from `useLang()` | ESLint `no-restricted-syntax` rule | new |
| axe in Hebrew | `scripts/a11y/axe-routes.mjs` over `/he` routes (it already runs some) | extend |
| The English-on-Hebrew crawl | `scripts/i18n-audit/crawl.mjs` (this audit), run before a release, not in CI (needs a seeded backend) | new, manual |

### 9.2 Rollout: small PRs

| # | PR | Size | Changes data? |
|---|---|---|---|
| 1 | `glossary.json` into `web/src/i18n/`; `untranslated.test.ts` reads its allowlist; glossary lint test over word tables | S | no |
| 2 | `schemas/i18n.ts`: fingerprint + status function + tests; `GET /api/admin/translations` (computing status with `unverified` for all existing Hebrew) | M | no |
| 3 | Translations dashboard page + `TranslationPill` in admin lists | M | no |
| 4 | Server stamps `heSrc`/`src` on save; backfill script (dry-run default); "Still correct" ack endpoint | M | yes (additive) |
| 5 | SEO: noindex/hreflang/sitemap/og:locale by translation state; Hebrew feed | S–M | no |
| 6 | Note editor: side-by-side fields, Preview he, Publish Hebrew, stale banner + diff on `bodyBase` | L | yes (additive) |
| 7 | Prose strings → `Text` (§4.2: media alt/caption, link labels, project state/where keys), with read shim; activity events rendered from structure | M–L | yes (lazy) |
| 8 | MCP: `list_translations`, `get_translation`, `put_translation`, `lang` on public reads, glossary resource | M | no |

Then content work, which is the owner's, not code: translating the hub-page
items the dashboard ranks first.

### 9.3 Risks

| Risk | Mitigation |
|---|---|
| Fingerprint normalisation too strict (stale storms on reflow) or too loose (real changes missed) | normalise only NFC + whitespace; "Still correct" ack is one click; tests with real edits from git history |
| Stale Hebrew left live says something the English no longer says | dashboard + nav badge; stale is visible to the owner, not hidden from readers (deliberate; see 5.2) |
| `noindex` on fallback pages drops currently indexed `/he/...` URLs | they are duplicates of English pages today; losing them is the point. Watch Search Console coverage for a month |
| Shape migration breaks a reader that assumed a string | read shim + schema accepting both for a release; `public-isolation` and SEO tests over both shapes |
| Hebrew in `alt` exceeds the `max` tuned for English | Hebrew is usually shorter in characters; same limits, revisit if hit |
| One editor, two tabs, one doc: `_rev` conflict | existing optimistic lock + "keep mine / take theirs" from the note editor (#285) |

### 9.4 Open questions for the owner

- **Q1. Admin in Hebrew:** is `/he/admin` a real goal (all forms translated), or
  is the admin English-only with a Hebrew *content* column? This audit counts
  admin findings separately so either answer works.
- **Q2. Stale Hebrew:** keep it live (recommended) or fall back to English until
  updated?
- **Q3. Hebrew-only notes:** ever? (Would make English optional per note and
  needs an `en`-fallback-to-he path.)
- **Q4. Fallback pages:** `noindex` (recommended) vs `canonical → English`.
- **Q5. Feeds:** a Hebrew feed of translated notes only (recommended), or also
  Hebrew twins of the area and channel-log feeds?
- **Q6. Project state/where values** ("In use", "Chrome Web Store"): translate
  `state` via keys (recommended) and keep store names Latin?
- **Q7. README.he.md:** worth supporting for the docs tab, or leave GitHub docs
  English-only and say so?
- **Q8. The draft assist via MCP (§7.7):** wanted at all?
- **Q9. Glossary disputes:** the calls marked "contested" in the glossary (e.g.
  קומיט vs commit in prose, דשבורד vs לוח בקרה) need the owner's ear.
