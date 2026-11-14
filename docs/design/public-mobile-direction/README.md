# Public site on a phone: design direction (task ds1)

Date 2026-11-14. Design pass only: this folder holds research, a written direction, and static prototypes. **No app code changes.**

Owner request: make the phone look of projects, the readers and the dashboard-like blocks feel more like the GitHub Mobile app (soft circles, clean areas), and then widened: do not use GitHub as the only reference; also study Notion and other well-regarded apps. Fold the old bug plan ([mobile-public-site-plan](../../public-mobile-guide.md), PRs 3 to 6) into the redesign so nothing is done twice.

## 0. How to look at it

| What | Where |
|---|---|
| Side-by-side sheets, one image per screen: **before, A, B, C** (Projects list, Post reader) | `sheets/projects-<lang>-<theme>--before-A-B-C.png`, `sheets/post-<lang>-<theme>--before-A-B-C.png` |
| Before vs the recommended direction C, all five screens | `sheets/<screen>-<lang>-<theme>--before-vs-C.png` (screens: projects, project, blog, post, area) |
| The prototypes themselves (open in any browser, 390 wide, no JS) | `html/<direction>-<screen>.<lang>.<theme>.html` |
| Single renders (viewport 390x844 and full page) | `after/*.view.png`, `after/*.full.png`; today's site in `before/` |
| Regenerate | `node build.mjs` then `node shoot-after.mjs` (needs a built `web/` and the Playwright browser, see the header of each script) |

`<lang>` is `en` or `he` (the Hebrew files are real RTL), `<theme>` is `light` or `dark`. The prototypes use the site's own tokens from `web/src/index.css` (paper, ink, signal, the radius ladder, the five hues) and each project's real tint from `web/src/data/projects.ts`, the site's own fonts (Audiowide, Atkinson Hyperlegible Next, Heebo/Rubik Hebrew) and no new asset. The copy is placeholder text drawn from the existing fixtures; Hebrew lines are mine and unreviewed.

## 1. Research (2026-11-14)

Legend: **[F]** page fetched and read; **[S]** search result summary only (not opened); **[K]** from my own knowledge, not re-verified today. Web text was treated as data. Several primary sources are thin or blocked (Primer redirects to GitHub, Material's own site did not come up), so claims marked [S]/[K] are not quoted as fact.

### 1.1 The references: what makes each one feel good, what we take, what we refuse

| Reference | What makes it beautiful | Adopt | Reject |
|---|---|---|---|
| **GitHub Mobile / Primer mobile** ([primer.style/native/mobile](https://primer.style/native/mobile), [8-point grid, adjusted dark palette, share actions] [S]; [Built In on the redesign: split desk work from phone work] [S]) | An 8-point grid; one calm ground with **grouped rounded lists** (leading avatar or icon circle, a bold title, a muted meta line, a trailing count or chevron); status carried by small **pills**, not by coloured rows; dark mode is a re-tuned palette, not an inversion. [K] for the grouped-list look: the app screens, not a written spec. | Grouped inset sections with a quiet header; the row anatomy; pills for state and counts; the 8 grid. | GitHub's marks, octicons, its blue/green status colours, its exact radii and its bottom tab bar (this site has one top dock and a reading bar; a second global tab bar is a navigation change, see owner decision D-6). |
| **Apple HIG, inset grouped lists** ([lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables.md) [S]; SwiftUI `insetGrouped`: a continuous background from header to footer [S]) | The group is one rounded surface; **dividers start after the leading icon** and stop at the edge, so the eye reads rows, not boxes. Caveat from the source: inset grouped is best at regular width and compact widths can wrap, so Hebrew (longer) needs a two-line title allowance. | Inset dividers, the continuous surface, the two-line allowance. | iOS chrome (large navigation titles that physically collapse need JS; we use a sticky compact bar). |
| **Material 3 cards** ([secondary sources only, the official page did not come up] [S]) | Three card kinds: filled (tonal), elevated (shadow level 1), outlined (1px). Medium shape token, 12dp in M3 [S]. | The idea that a card is **tonal or outlined, almost never shadowed**: our C uses outlined-tonal (a 1px rule on a slightly lighter paper). | M3 corner size (12) and its tonal colour generation; this site's own ladder is 14/22/32. |
| **Notion** (page, covers, database views: [S], [Thomas Frank's tour](https://thomasjfrank.com/17-tips-for-building-your-perfect-notion-aesthetic/), [925 Studios breakdown](https://www.925studios.co/blog/notion-design-breakdown)) | A **calm page canvas**; a large page icon and cover as the only decoration; typography with generous leading; **properties** as quiet label/value rows; **toggles** for depth (progressive disclosure keeps a page clean); one dataset shown as list, gallery or table. | The property rows (project and post header), toggles for secondary detail (stack, decisions), a 2-up **gallery** for pinned projects, one data set with several views. | Emoji as page icons (an asset set we do not own), the serif option (no new fonts), infinite nesting. |
| **Things 3** ([MacStories review](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/) [F]; restraint figures from a translated design study [S]) | "Dominated by white space"; **bold area names above lighter project names** carry the hierarchy; colour in "thoughtful splashes", mostly neutral; motion confirms an action (tap lifts a card, the list fades back) rather than decorates. | Hierarchy by weight, colour only as a small splash on a circle or pill, restraint as the default. | Haptics and card-pop motion (the site's motion contract governs this). |
| **Linear mobile** ([Linear's own post on its mobile redesign](https://linear.app/now/linear-liquid-glass) [F]) | "Purpose-built, disciplined, designed for sustained focus"; **skipped Apple's refraction effect because it hurts legibility in dense UI**; solid outlines under Increase Contrast. | The refusal itself: **no blur, no glass**; the high-contrast path gets a hard outline. | Their custom tab bar; the density (this is a visitor site, not a work tool). |
| **Readwise Reader, Apple Books, Bear, Craft** ([Readwise feature posts and a design study, translated] [S]; the rest [K]) | Reading view: **generous margins, about 65 characters, clean type**, minimal chrome that gets out of the way, a quiet progress cue. | Reader as editorial text on the ground (not inside a card), 17.5 to 18px with 1.72 leading (1.85 Hebrew), one slim progress line, one floating action bar. | Swipe-to-advance feed gestures (D9 of the public guide forbids swipe navigation between posts). |
| **Stripe / Vercel mobile dashboards, Apple Health summary cards** [K] | Dashboards on a phone are **a few big tiles, each one number with a label**, not charts squeezed down; a summary card shows one fact and a tiny delta. | The StatPill tile: icon circle + one tabular figure + label, two per row. | Sparklines and charts (nothing to chart; avoid inventing data). |
| **Airbnb / Pinterest card grids, Monocle, Are.na** [K] | Image-first cards with the **text under the image**, big radius, little chrome; editorial pages use big plain titles and long white space. | The 2-up gallery cards (tint cover, name, one line); the plain big page title. | Image carousels and masonry (jank, and projects have 6 items, not 600). |

**What the references agree on** (and what the sheets are built from): one calm ground; a rounded surface per *group*, not per row; a leading circle that carries identity; hierarchy by weight and size, colour kept for state; one primary control within thumb reach; no blur and no heavy shadow.

### 1.2 What this site already owns (kept)

- Warm paper ground (`--paper` #ECE8DC, dark #1C1A16), ink, one accent (`--signal`), the five hues and their washes, the radius ladder 14/22/32/44 and `--r-pill`.
- Three font roles (Audiowide display, Atkinson text, Heebo/Rubik for Hebrew): unchanged, **no new font**.
- Each project's tint, sampled from its own cover: it becomes the colour of its circle. The tint is a true relationship (the label is the work's colour), which GitHub's avatars are as well.
- The Bothy voice: plain statements of fact, not claims.

## 2. Three directions

All three solve the same four jobs (list, project header, reader, dashboard block) and keep tokens, fonts and copy. They differ in **how much structure is drawn**.

### A. "Grouped" (closest to GitHub Mobile)

A tonal **ground one step darker than the cards**; every list sits in an inset rounded card (22px); rows have a 40px tinted circle, bold title, muted meta, a state pill and a chevron; the sort is a segmented control; the reader's header is a card and **the article text sits in a card too**; a docked **tab-style action bar** (Contents / Aa / Share) is always on screen at the bottom.
*For:* the clearest answer to "like the GitHub app"; very scannable; strong grouping on a busy page. *Against:* a card around long text narrows the measure (about 318px of text on a 390 phone), card-on-card feels heavy on a quiet personal site, and the always-on bar eats 76px of reading height.

### B. "Calm editorial" (closest to Notion)

**No cards.** Paper ground; hairlines; a 56 to 72px page-icon circle and a tinted cover band; **property rows** for metadata; 2-up gallery for pinned projects; toggles for secondary content; the reader is pure text with a thin progress line and one small floating "Aa" circle.
*For:* the calmest and the most editorial, the best reading measure (342px), the fewest elements. *Against:* weak grouping: on the dashboard-like blocks (Browse by area, channel log) rows float and the "app" feel the owner asked for is mostly gone; fewer obvious tap affordances (no chevrons, no pills on rows).

### C. "Blend" (recommended)

B's calm and A's grouping, with each used where it earns its keep:
- **Ground and type from B**: paper ground, big plain page title, text on the ground, property rows in headers, toggles for depth, 2-up tinted gallery for the pinned.
- **Grouping from A, softer**: lists and dashboard blocks sit in inset 22px *outlined-tonal* cards (a 1px rule on paper lightened 38%), **not** a darker ground; reading text is never in a card.
- **Circles everywhere identity matters** (32/40/56), tinted by the project; state in pills; counts in count pills.
- **Reader**: editorial text on the ground, a slim collapsing bar, a progress hairline, and **one floating pill bar** (Contents is the primary, Aa and Share beside it) that tucks on scroll down and returns on scroll up (the existing behaviour of the reading bar, `notes/ReadingBar.tsx`).
*For:* it answers the owner's GitHub brief on lists and dashboards and the Notion brief on reading, with the least new chrome. *Against:* two ideas in one page need discipline: the rule is simple (group lists, never group prose).

### 2.1 Scoring (1 to 5, my judgement from the rendered sheets)

| | A | B | C |
|---|---|---|---|
| Feels like the GitHub app (owner's first ask) | 5 | 2 | 4 |
| Calm / "enchanting" reading | 3 | 5 | 5 |
| Scannability of lists and dashboard blocks | 5 | 3 | 5 |
| Keeps this site's identity (paper, display type, hero) | 3 | 5 | 5 |
| Hebrew RTL comfort (long titles, two-line rows) | 4 | 4 | 4 |
| New components and CSS to build | 3 | 5 | 3 |
| Reading height and measure | 2 | 5 | 4 |

**Recommendation: C.** It loses to A only on "looks most like GitHub", and wins everywhere else. If the owner wants the GitHub look more literally, the dial is the card contrast (see D-2), not a different structure.

## 3. Recommended direction C: design contract

### 3.1 Principles (10)

1. **One calm ground; group, do not box.** A rounded surface wraps a *group* of rows (22px); a row is never its own card. Prose is never in a card.
2. **A leading circle carries identity.** 32 / 40 / 56 / 72px circles, tinted by the thing they label, glyph in a darker or lighter mix of the same tint. A circle never carries a number or a sentence.
3. **Hierarchy by weight and size, colour only as a splash.** Titles 700, meta 400 muted; colour appears on circles, pills and the one primary button.
4. **Quiet dividers.** 1px rule, inset to start after the circle (68px), absent on the last row, never between groups (space does that).
5. **State and counts are pills.** 24px high, dot + word (state) or number (count): colour never alone (WCAG 1.4.1).
6. **Thumb-first controls.** The primary action lives at the bottom (floating bar, one CTA per screen); everything tappable is 44px (visual 32 to 40, hit area extended).
7. **Compact sticky bar, large title on the page.** The bar is 56px, opaque (no blur), shows the title only after the page title has scrolled away, gains a 1px rule.
8. **Depth is progressive.** Secondary detail (stack, decisions, long lists) sits behind a toggle or a "See all", not on the first screen.
9. **Light and dark are one design.** Same layers, re-tuned tonal steps; a hairline does the work shadow cannot do on dark.
10. **Mirrored, not translated.** Hebrew is the same layout with logical properties; directional glyphs mirror, ids/numbers/paths stay LTR.

### 3.2 Token and spec table

All values are existing tokens unless marked **new**.

| Group | Token / value | Use |
|---|---|---|
| Radii | `--r-sm` 14 (code blocks, inner panels), `--r-md` 22 (cards, groups, gallery cards), `--r-lg` 32 (title plates only), `--r-pill` 999 (chips, pills, segmented, bars) | The ladder is untouched. |
| Circles | **new** `--circle-s` 32 (stat tile, compact), `--circle-m` 40 (list row, avatar), `--circle-l` 56 (project header, post thumbnail, gallery), `--circle-xl` 72 (page icon, only on a cover) | Glyph is 50% of the circle. |
| Surface layers | L0 ground `--paper`; L1 group card = `--paper` lightened 38% (dark: `--paper` toward `--paper-2` 62%) with 1px `--rule` at 75%; L2 selected segment / floating bar = lightened 70% (dark: `--paper-3`); recess = `--paper-3` at 55% (chip rest, segment track) | **new** `--card`, `--card-hi` as `color-mix` roles over existing tokens. |
| Spacing | 4 / 8 / 12 / 16 / 24 | Screen gutter 16 (prose 22), group gap 24, row padding 12x16, header-to-card 8. |
| Type | Page title Audiowide 32 (he: Rubik 700), card title 26, row title Atkinson 700 16, body 16, **reader 18 / 1.72 (he 1.85)**, meta 13.5, caption 12.5 (floor 12) | No new face; numbers `tabular-nums`. |
| Elevation | Cards: none, outline only. Floating bar: `0 10px 22px -12px rgb(shade / .45)`. Segment thumb: `0 1px 2px` + `0 4px 10px -6px`. | No blur, no backdrop-filter anywhere. |
| Icon-circle colours | The project's own tint (`data/projects.ts`); kinds without a project use the five hues: note = signal, release = green, push = green, decision = purple, alert = red. Background tint = tint at 17%, glyph = tint mixed 35% toward ink (dark: toward white, 38%). | Contrast of the glyph on its circle measured >= 3:1 (non-text) in both themes in the prototype render; to be verified by the matrix when built. |
| Chips | Filter chip: 32 tall, 14px side padding, 14px/600, rest = recess, active = ink on paper; hit area extended to 44 with `::after inset -6px -2px`. State pill: 24 tall, wash background + dot + word. Count pill: 24 tall, min 24 wide. Tag chip: `# word`, same as filter chip. | The 26px chips of today become 32/44. |
| Motion | Bar: shadow fades in 150ms; reading bar: existing tuck transform; nothing else animates. All behind `prefers-reduced-motion`. | No new motion. |

### 3.3 Components

Each is a small component with props, and each reuses what exists where it can (`ui/FilterChips`, `ui/BottomSheet`, `notes/ReadingBar`, `nav/useTuckedBar`).

**GroupedSection** `{ title, count?, action?, children }`: header row (14px/700 muted, optional count pill, optional text action at the end, 44 tall target) above a `--card` surface (22 radius, 1px rule, `overflow: hidden`). Children are `ListRow`s. Semantics: a `<section aria-labelledby>`, the list is `<ul>` with `<li>` rows.

**ListRow** `{ icon | avatar | thumb, title, meta, trailing?, href }`: min height 64, padding 12x16, gap 12. Leading circle 40 (56 for a note thumbnail). Title 16/700, up to 2 lines (`-webkit-line-clamp: 2`), meta 13.5 muted (one or two lines), state pill sits **on the meta line**, not trailing, so Hebrew titles keep their width (a trailing pill was the first thing the first render got wrong). Trailing: count pill or nothing; chevron 18px at the end, mirrored in RTL. The whole row is **one link** (rule R5/Card); divider inset 68 from the start edge.

**AvatarCircle** `{ size: 32|40|56|72, tint?, glyph | initials | image }`: tinted circle with glyph (project/area), neutral recess circle with initials or the portrait (author), or a cropped cover image. `aria-hidden` when decorative, `alt` when it is the only content.

**StatPill** `{ icon, value, label }`: a 22px tile (the stat card) with a 32 circle, one tabular figure at 20/700 and a 12.5 label; two per row (a 2x2 grid for four). Values are `dir="ltr"` isolates (`v1.9.0`, `TypeScript`). Used for stars, forks, release, language, notes, last push. It is a pill in spirit (a quiet counted fact); one row is 56 tall.

**SegmentedTabs** `{ items, current }`: a pill track (recess), 4px inset, 40px segments, the current one raised to L2 with weight 700. 3 to 4 items, never more (otherwise the horizontal chip scroller). It is real tabs/links with `aria-current`, not a radio group: each item is a route or an anchor. 44px hit through the 4px track padding.

**StickyCompactHeader** `{ title, left, right }`: 56px, opaque ground, safe-area top and sides, left/right 44px circular buttons (36 visual). The title is `opacity: 0` until the page title has left the screen (an `IntersectionObserver` on the page title toggles one class, no scroll handler), then it fades in with a 1px bottom rule. On a reader it tucks with the existing `useTuckedBar`.

**ReaderHeader / ActionBar**: *Header*: kind pill + area pill, title 29 Audiowide (he Rubik), author circle 40 + name + date + read time (date and time are `tabular-nums`, isolated). A 2px progress hairline under the bar. *Body*: 18/1.72 on the ground, 22px side padding (about 346px measure on 390), H2 21/700, quote = a soft recess panel at 22 radius (not a coloured side rule), code = dark panel 22 radius, LTR. *ActionBar*: floating pill, 54 tall, three 44px targets: **Contents** (primary, signal fill, icon + word), **Aa** (opens the reading sheet: size, theme, reset), **Share** (Web Share, copy fallback). Bottom: `calc(12px + env(safe-area-inset-bottom))`; tucks on scroll down, returns on scroll up; never covers the last paragraph (the document gets matching bottom padding).

**ProjectHeaderCard** `{ project }`: a card with a 56 circle, the name in display type, a state pill and the year, then the one fact sentence at 16.5. Under it the **StatPill grid**, then **SegmentedTabs** (Overview / Notes / Releases / Docs). The primary link ("Open repository") is a **bottom-anchored 52px signal CTA**. Secondary detail (stack) is a toggle.

### 3.4 Per screen: before and after

(Images: `sheets/*--before-vs-C.png`; A and B for the two core screens in `sheets/*--before-A-B-C.png`.)

| Screen | Today (390 wide, measured in the before shots) | After (C) |
|---|---|---|
| **Projects list** (`/projects`) | Heading with a decorative squiggle, a "Browse" button, then "Pinned" and "Projects" lists. Each project is its own bordered card with an icon, a title link (22px tall target), a chip and a "no pushes" line. Sort is a 3-button control. Page about 3,160px tall. | Big title, a one-line subtitle, filter chips (32/44), two **gallery cards** for the pinned (tint wash, circle, name, one line, state pill), then **one grouped list** for the rest (circle, title, 2-line fact, pill + stack on the meta line), then the log as a grouped list with "Full channel log". The whole row is the target (64px). No per-project cards. |
| **Project page** (`/projects/:slug`) | A long single page (about 5,240px): header, a spec block, side cards, releases and docs as stacked sections. | **ProjectHeaderCard** (56 circle, state, fact), a 2x2 **StatPill** grid, **SegmentedTabs** instead of stacked sections, GroupedSections for Decisions, Notes, a toggle for Stack, and a bottom CTA. |
| **Blog / Notes list** (`/blog`) | A search card whose helper copy is squeezed to about 90px in Hebrew (M2 of the old plan), "Browse by area" as a list of text links, rows with 22px-tall title links. | A pill search field (48 tall, icon at the start edge, no keyboard-only helper on touch), chips, **Browse by area** as a GroupedSection with circle + name + tagline + count pill, **Latest notes** rows with a 56 note circle, a calm follow card with one CTA. |
| **Post reader** (`/blog/:slug`) | Full-width cover plate, kind label, display title, author line, "Contents and details" pill; the bar holds Contents and Share; text size lives inside the sheet. Page about 4,080px. | Kind + area pills, title, author circle line, **text on the ground** at 18/1.72, quote as a soft panel, code as a rounded panel, tags as chips, and one **floating action bar** (Contents / Aa / Share). Size and theme reach one tap away (Aa), not two. |
| **Browse by area / dashboard blocks** (`/blog/area/:slug`, `/blog/log`, Bothy / WindoM project pages) | Area header, text lists, a vertical timeline for the log with small icons, facts as inline text. | Area header card (circle 56, name, tagline), **StatPill grid** (notes, releases, last push, stars), **Latest** as a grouped list: circle by event kind (note, release, push), title, relative time; the same component serves the channel log page. |
| **Hero / landing** | Not changed in this pass. | Out of scope; see D-4. |

### 3.5 Hebrew and RTL

- Layout is the same tree under `dir="rtl"`: only logical properties (`inset-inline`, `padding-inline`, `border-start-*`). The prototypes contain no `left`/`right` for layout.
- **Mirror**: chevron, back arrow, the disclosure triangle in toggles, the progress hairline (grows from the inline start), the segmented order. **Do not mirror**: share, search, clock, tag, star, play, code glyphs, brand marks.
- Rows tolerate longer Hebrew: 2-line titles, the state pill moved to the meta line, the circle at the start edge. Checked in `html/*.he.*.html`.
- `v1.9.0`, `React 19 · 2026`, `TypeScript`, the repo path and the commit line are isolates with `dir="ltr"`; a Hebrew phrase that merely contains a digit ("לפני 4 ימים") is **not** forced LTR (data-display rule).
- Numeric figures in StatPill are LTR and start-aligned (nominal numbers: version, year); counts in the count pill are centred.
- Hebrew display type is Rubik 700 (the site's existing choice), letter-spacing 0; Heebo for text, line height 1.85 in the reader.
- The mixed-language case (an English post under `/he`) keeps the existing visible language label and sets the title's own `dir`.

### 3.6 Accessibility

- Targets: every row 64, chips/segments/bar buttons 44 hit area (visual 32 to 40 with extended `::after`), 8px between neighbours. Closes M3 and M4 of the old plan.
- Colour is never the only carrier: state pills have a dot **and** a word; circles are decorative (`aria-hidden`); the tint on a gallery card is an enhancement.
- Contrast: row meta uses `--ink-soft` (6.37:1 on paper); `--ink-faint` only for non-text (chevrons, the divider). Pill words use darker/lighter mixes than the wash they sit on. The matrix will assert it.
- More-contrast: cards get a full-strength 1px `--rule-firm`; the floating bar gets the same.
- Focus: 3px offset ring on row, chip, segment and bar targets (existing `:focus-visible`), not clipped by `overflow: hidden` (the ring is drawn on the link, which sits inside the card padding).
- Sticky header and floating bar do not obscure focus (WCAG 2.4.11): `scroll-padding-top: 72px`, `scroll-padding-bottom: 88px`.
- Reduced motion and Save-Data unchanged; the new surfaces have no motion of their own.
- Text size: the reader scale (`--text-scale`) multiplies the 18px; rows reflow to taller, none are fixed height (`min-height` only).

### 3.7 Performance

- **No new font, no third-party code, no image.** Circles are CSS plus inline SVG glyphs (about 200 bytes each, and they can be the site's existing icon set).
- **No blur and no `backdrop-filter`** (Linear's lesson; also cheap on low-end phones). Elevation is one small box-shadow on one element.
- Colour layers are `color-mix()` roles resolved once per theme; no per-row computed styles.
- Long lists (more than 50): `content-visibility: auto` on the rows (already in the old plan, PR 8).
- The tinted gallery cards use a gradient, not an image; LCP stays the title text.

## 4. Owner decisions (each with a recommendation)

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D-1 | **Direction** | A grouped, B calm editorial, C blend | **C.** |
| D-2 | **Card contrast** (how GitHub-like) | cards on a darker ground (A) / outlined-tonal cards on the same ground (C) | **Outlined-tonal.** Calmer, keeps the paper identity, and the dial can be turned up later by changing one token (`--card`). |
| D-3 | **Circle or squircle** for icon holders | circle / 12 to 14px superellipse | **Circle for identity (project, area, author, kind), 22px-radius tiles for stats.** The owner asked for soft circles; the two shapes also tell identity from fact. |
| D-4 | **Hero** | leave / soften / rework | **Leave the home hero as is in this pass.** Only the sections below it adopt the grouped feel; revisit after PR 3 is seen on a phone. |
| D-5 | **Density** | roomy (row 72) / standard (64) / dense (56) | **Standard 64**, 56 for the log page only. |
| D-6 | **Bottom navigation** | keep the single top dock / add a GitHub-style tab bar | **Keep the dock.** A second global bar is a navigation change for a six-page site. The bottom is for the page's own primary action (reader bar, project CTA). |
| D-7 | **Reader action bar** | none (B) / docked tab bar (A) / floating pill that tucks (C) | **Floating, tucking pill** with Contents as the primary; no sticky bar in lists. |
| D-8 | **Text in a card?** | in a card (A) / on the ground (C) | **On the ground.** Measure and calm; cards are for lists. |
| D-9 | **Gallery for pinned work** | list only / 2-up gallery | **2-up gallery for the pinned two, list for the rest**; if more than 4 pinned, the gallery becomes a horizontal scroller with a peek. |
| D-10 | **Copy** | keep today's / adopt the prototype strings | Keep today's strings. Any new string (`Updated`, `Full channel log`, tab names) goes through STRINGS FOR OWNER APPROVAL. |

## 5. Implementation plan (small PRs, folding in the old bug plan)

The old plan had touch targets (3), blog search (4), reader controls (5), landing first screen (6) as separate PRs. Building them on the old components and then restyling would do each twice. Reordered so each old fix lands **as part of** its redesign step:

| PR | Title | Contains | Old plan item it replaces |
|---|---|---|---|
| 1 | Tokens and primitives | `--circle-*`, `--card`, `--card-hi`; `AvatarCircle`, `GroupedSection`, `ListRow`, pills (state, count), chips at 32/44. Catalogue rows in `public-mobile-guide.md` section 3. Unit tests and a Storybook-free visual page under `docs/` | 3 (targets: chips, row titles, hit areas) |
| 2 | Public matrix harness | As old PR 2, plus assertions for row min-height 64, targets, tint contrast | 2 (unchanged) |
| 3 | Projects list and Work blocks | Gallery cards for the pinned, grouped rest, log rows; whole-row links | 3 (row titles 22px), part of 6 |
| 4 | Blog list and Browse by area | Search field and chips (the Hebrew squeeze fixed by layout, helper copy hidden on touch), Browse by area GroupedSection, latest rows | 4 (blog search) |
| 5 | StatPill, SegmentedTabs, Project page and Area page | ProjectHeaderCard, StatPill grid, tabs, bottom CTA, toggle for stack; `/blog/log` | 3, 6 |
| 6 | Reader | ReaderHeader, text on the ground, **floating ActionBar with Aa sheet** (size, theme, reset), compact header, progress hairline; back to top; resume row | 5 (reader controls) |
| 7 | Landing and sticky header | StickyCompactHeader (safe areas, IntersectionObserver title), first-screen CTA gap and scroll cue, `text-size-adjust`, 12px floor, single breakpoint migration | 6 (landing) |
| 8 | States, data-aware, Help | Offline/empty/error cards in the same grouped style, Save-Data, Help "On your phone" | 7, 8, 9 |

Rules for each PR: desktop pixels unchanged; Hebrew screenshot; no allow-list line added; strings in the PR for approval.

## 6. Limits of this pass

- Static prototypes at 390 on Chromium. Not checked on a real iPhone/Android (dynamic type, rubber-banding, the real URL bar), and not measured for the contrast of every tint/glyph pair; both are PR 2's job.
- Sticky and floating behaviours are shown by their resting state (`c-*-scrolled.*` shows the collapsed bar); the motion is existing code.
- Notion, Linear, Material and Primer pages were only partly readable today (see the legend in 1.1); statements marked [K] are standard knowledge, not quotations.
