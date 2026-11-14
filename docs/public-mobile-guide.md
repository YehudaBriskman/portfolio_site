# Public mobile guide

**How the public site (home, blog, notes, areas, projects, story, follow, contact, help, share) behaves on a phone.** Read it before you change anything a visitor sees. The admin has its own contract in [admin-design-guide.md](admin-design-guide.md); this is the public counterpart, and it reuses the admin's phone components where they fit.

`MUST` fails review. `SHOULD` needs a reason in the PR to skip. Every rule carries its *why*.

The numbers come from the plan and measurement study of 2026-11-14 (84 page, width, language and theme combinations: no horizontal overflow anywhere today). What is missing is a written contract and a guard so those 84 do not regress. This file is the contract; [`web/src/pages/__tests__/publicMobileGuide.guard.test.ts`](../web/src/pages/__tests__/publicMobileGuide.guard.test.ts) is the first guard.

## 1. Decisions the owner approved

| | Decision |
|---|---|
| D1 | Touch targets: **44px** on coarse pointers, **24px** is the hard floor (WCAG 2.5.8), 8px between neighbours. |
| D2 | **One public phone breakpoint: 640px** (Tailwind `sm`). The constant is `PUBLIC_PHONE_BREAKPOINT` in `web/src/lib/phoneBreakpoint.ts`; in CSS it is `@media (max-width: 639px)`. The admin keeps its own 600px `usePhone()` hook: an admin phone is a different product. |
| D3 | Resume reading: a quiet "continue" row, per device, no server. (Built in a later PR.) |
| D4 | Install: **manifest only**. No service worker, no offline reading. |
| D5 | The footer "Admin" link is hidden on phones (later PR). |
| D7 | `Save-Data` (and 2g) turns off particles, orbs and scroll acts only. Nothing else. |
| D8 | A nightly, non-gating full matrix. |
| D9 | No pull-to-refresh, no swipe-to-navigate between posts. They fight the browser's back swipe and scroll restoration. |
| D10 | **Direction A ("grouped", GitHub-Mobile-like)** is the look of the public phone: soft rounded groups on a calm ground, icon circles, pills, pill segmented tabs, stat tiles. Phones only (under 640); tablet and desktop are unchanged. Section 6. |

Owner approves all new public wording, English and Hebrew, before it ships. A PR that adds visitor-facing text lists it in a table headed `STRINGS FOR OWNER APPROVAL`.

## 2. Rules

The last column says what holds the rule today. "Guard" means a failing test; "matrix" means the public-matrix harness (a later PR); "review" means a human.

| # | Rule | Why | Held by |
|---|---|---|---|
| R1 | **One phone breakpoint, 640.** Switch phone layouts at `max-width: 639px` or Tailwind `sm:`. Prefer CSS media queries for layout; use a hook only to mount phone-only controls. | Two breakpoints (599 and 639) made 600-639px show phone layouts on some components and tablet on others. | Guard (allow-list) |
| R2 | **No bare `100vh` for layout.** `svh` for "must always be visible" (hero, first screen), `dvh` to fill the screen (sheets, panels). `100vh` is allowed only as arithmetic inside `view-timeline-inset`. Tailwind `min-h-screen` is `100vh`: use `min-h-svh`. | `100vh` is the tallest the screen gets with the URL bar hidden, so content ends up under the toolbar. | Guard (allow-list) |
| R3 | **Viewport meta is exactly** `width=device-width, initial-scale=1, viewport-fit=cover`. Never `maximum-scale` or `user-scalable=no`. The viewport meta says nothing about the keyboard; if `interactive-widget` is ever set, record the choice here. | Zoom lock fails WCAG 1.4.4 and 1.4.10. | Guard |
| R4 | **Inputs, selects and textareas are at least 16px.** | iOS Safari zooms the page when a smaller field is focused and does not zoom back. | Guard (allow-list) |
| R5 | **Targets: 44px on `(pointer: coarse)`, 24px floor everywhere, 8px gap.** Pad the link or its row, not the text. A checkbox's label is its hit area. Inline links in a sentence are exempt from the size, not from the gap in a list. | Apple HIG 44pt, WCAG 2.5.8 (24). Today's misses: row titles 22px, consent boxes 21px, chips 26px, hero CTA 35px. | Matrix |
| R6 | **Hover only inside `@media (hover: hover)`.** Anything a hover reveals must also be reachable by focus and by tap. | Touch browsers emulate hover on first tap and leave it stuck; the first tap then does not follow the link. | Guard (allow-list) |
| R7 | **Safe areas on every fixed or sticky edge** (the phone menu circle included: top and inline-end): `env(safe-area-inset-*)` on the top dock, the bottom bar, sheets, and the sides in landscape. | The page is `viewport-fit=cover`: a notch or home indicator clips what is not padded. | Review, real device |
| R8 | **Logical properties only** (`margin-inline-start`, `inset-inline-end`, `text-align: start`, Tailwind `ms-`/`pe-`/`start-`). No `left`/`right` for layout. | Hebrew is a first-class language; a physical property is an RTL bug. | Review; [i18n manual](manual/i18n.md) |
| R9 | **Directional icons mirror** under `:dir(rtl)`: arrows, chevrons, back/forward, send, progress. Play, check, search, clock, brand marks and anything depicting a real object do not. | A mirrored list is a decision; an unmirrored arrow points the wrong way. | Review |
| R10 | **Phone numbers, emails, URLs, code and ids are `dir="ltr"`** inside RTL text, with `unicode-bidi: isolate`. | Otherwise the punctuation lands on the wrong side. | Review |
| R11 | **Every swipe or drag has a tap alternative.** A carousel has buttons; a sheet has a close button. | WCAG 2.5.1, 2.5.7. | Review |
| R12 | **Motion has a reduced-motion path and a fallback** for browsers without `animation-timeline` and for no-JS. See [motion-contract.md](motion-contract.md). | Scroll-driven acts are heavy on low-end phones. | [Motion contract](motion-contract.md) |
| R13 | **Images carry `width`/`height` or `aspect-ratio`.** The LCP image is never `loading="lazy"` and has `fetchpriority="high"`. AVIF, WebP, JPG ladder. | Layout shift and a late first paint. | Review |
| R14 | **Fonts: self-hosted, at most two preloads**, `font-display` stated in the stylesheet. | Every preload competes with the LCP image on a slow link. | Review |
| R15 | **No `unload` handler, ever.** No `beforeunload` on a public page (only the admin editors have one, listed in the guard). `Cache-Control: no-store` only on the API, never on a document. Use `pagehide`/`pageshow`. | Each of these makes the page ineligible for the back/forward cache, so Back becomes a reload. | Guard (allow-list) |
| R16 | **One vocabulary for offline, empty and error states**: say what failed, say what still works, offer one retry. Never a blank area. | A blank section reads as "broken" and as "loading" alike. | Review |
| R17 | **No keyboard-only copy on touch.** Instructions such as "arrow keys navigate" show only under `(hover: hover) and (pointer: fine)`. | It is wrong for the person holding the phone and it eats the first screen. | Review |
| R18 | **No third-party scripts, no cookies, no trackers, no analytics beacon.** Field performance is read from CrUX / PageSpeed only. | Stated privacy position of the site. | Review |
| R19 | **A Help topic for every control** a visitor can meet (both languages, unique ids). | A control with no explanation is a support email. | `helpTopics` tests |
| R20 | **Every new control works with storage blocked and inside an in-app browser.** Wrap every `localStorage` access in try/catch; if `navigator.share` is missing, fall back to copy link. | Private windows throw; webviews lack APIs. We test in webviews, we do not sniff them. | Review |
| R21 | **A ring only for keyboard focus.** Moving focus on navigation (to the heading, to a sheet's opener, to an anchor) is right for screen readers, but it must not paint a ring after a tap. `<html data-input="keyboard|pointer">` (`web/src/lib/inputModality.ts`, installed in `main.tsx`) holds the last input; one rule at the end of `index.css` removes the outline on `:focus-visible` while it is `pointer`. Never add `outline: none` to a focus style by hand, never rely on `:focus-visible` alone for script focus, and never `outline: none` under `forced-colors`. Keyboard focus keeps the 2px (3px at More contrast) ring; text fields keep theirs. | Chromium and iOS match `:focus-visible` on script focus when nothing was focused before, so a tap on a project card left a thick ring round the title (#776). | Guard, `a11y:public-focus` |

### 2.1 How the guard's warning lists work

Each guarded rule has an allow-list in the test file naming the offenders that exist today. The lists **may only shrink**:

- A new offender fails the test. Fix it; do not add a line to the list.
- A listed offender that has been fixed also fails the test, until its line is deleted. The list is a to-do that only gets shorter, and it is how a later PR proves it did its job.
- Hover entries are one line per file with a rule count, so renaming a selector does not churn the list.

Scope is everything under `web/src` and `web/index.html` except tests, `components/admin`, `pages/Admin*`, the `.a-*` rules in `index.css`, and the admin's shared kit (`components/ui`, whose 599px switch is the admin's, see D2).

### 2.2 Rules that are checked in a browser

The matrix (a later PR, `web/scripts/a11y/public-matrix.mjs`) measures overflow, targets under 24 (fail) and under 44 (budget, may only go down), text under 12px, inputs under 16px, fixed and sticky overlap, and the first-screen call-to-action gap, at 360/390/430/768 plus a 320 reflow pass, in both languages. It gates only on structural facts: never on timing, CLS or Lighthouse scores, which vary too much on shared runners. A count above `public-matrix-baseline.json` fails; a count below it only prints a notice. After a fix, run `npm run a11y:public-matrix -- --update-baseline` (`npm run build` first) and commit the lowered baseline.

## 3. Component catalogue

For each component: the phone rule that applies, the he/en note, and what guards it. "Reuse" means the admin component under `components/ui` already exists and is the one to use. Add a row when you add a public component.

| Component | Phone rule | he / en | Guard |
|---|---|---|---|
| **Top bar / dock** (`components/Nav.tsx`) | **Below 640 there is no bar: one floating soft circle** (46px, paper ground, hairline, very soft shadow, no blur) at the inline-end top corner holds the menu icon. No word, no line, no full-width strip; the name is the `aria-label` (the existing Menu string). It never tucks. Safe-area top and inline-end side (R7); the first line of every page starts below 56px + inset, so it never sits on a title. The menu sheet it opens is unchanged. 640 and up keep the bar (56px, tucks on scroll down, returns on scroll up, focus keeps it open); coarse targets 44 (R5). | The circle mirrors to the left in Hebrew; the bar's mark order mirrors; theme and language controls keep their position. | `web/scripts/a11y/public-nav.mjs` (shape, place, overlap with headings and text, open/Escape/focus return, he and en), `public-landing.mjs`, axe keyboard walk |
| **Hero plate** (`components/Hero.tsx`, `HeroCorners.tsx`) | `svh`. The call to action sits inside the first screen at 640px high with a clear gap to the bottom edge. Counter unit at least 12px. | The Hebrew line mixes a Latin brand word on purpose; the owner confirms wording. | Matrix (first-screen gap) |
| **Card** (`notes/NoteCard`, `NoteTile`, projects cards) | Whole card is one target, one link; no nested interactive. Cover has an aspect ratio. | Title takes its own `dir` when a post is in the other language, with a visible language label. | Matrix, review |
| **Row** (blog and project lists) | The title link is padded to 44 on coarse pointers (R5); the row never shows hover-only content (R6). | Dates and counts are isolated LTR runs (R10). | Matrix |
| **Filter chips and filter sheet** (reuse `ui/FilterChips`, `ui/FilterSheet`) | Chips 44 tall on coarse pointers, horizontal scroller with a visible peek. Phone filter field is full width, the `#` and `@` buttons on their own row, no keyboard-only help (R17). | Icon at the inline-start edge. | Matrix; vitest on the copy gating (later PR) |
| **Bottom sheet** (reuse `ui/BottomSheet`) | `dvh` max height, safe-area bottom, drag and tap alternatives, close button (R11). A sheet never opens a sheet. | Handle and close mirror. | Existing `BottomSheet` tests |
| **Reading bar** (`notes/ReadingBar.tsx`) | Bottom, 56px plus safe-area; never overlaps back-to-top or the connection notice. Appears after 240px. | Contents and share icons stay in reading order. | Reader phone script (later PR) |
| **Reading sheet** (new, later PR) | Text size, theme, reset; stored per device in `localStorage`, blocked storage tolerated (R20). | Labels need owner approval in both languages. | Unit tests for the store |
| **Toast** (reuse `ui/ToastHost`) | Above the reading bar and the safe area; never covers the primary target. | Placement uses inline-start/end. | Existing `ToastHost` tests |
| **Connection notice** (new, later PR) | Overlays under the dock, never pushes content (CLS). Offline vocabulary from R16. | Owner approves wording. | vitest with online/offline events |
| **Back to top** (new, later PR) | On long pages (Help, notes). 44 target, clear of the reading bar and the safe area. | Position at inline-end. | Reader phone script |
| **Contact form** (`components/Contact.tsx`) | 16px fields (R4), `autocomplete`, `inputmode` and `enterkeyhint` set, labels visible, submit 44 tall. Offline error has a Help link. | Email and URL fields are `dir="ltr"` (R10). | Guard (R4), axe, `phone-pages.mjs forms` (short keyboard viewport) |
| **Contact, grouped** (`components/phone/pages-forms.css`, `data-ph-ask`, `data-ph-contact`) | The home ask is one card with a full-width 48px pill; in the form sheet the three fields are one continuous card (name, email, message, hairlines between, no box of their own, an invalid field gets an inset red underline), the send button a full-width pill. Labels, errors, receipt and live regions are the page's own. | Fields keep their `dir`; the card's corners are logical. | `phone-pages.mjs forms` |
| **Subscribe pages** (`SubscribeFrame`, `SubscribeManage`; `data-ph-frame`) | The status line is a card that keeps its reserved 56px; the topics and language choices are one card each, 48px rows with hairlines; the primary and the way home are full-width 48px pills. Wording is today's. | Radio and checkbox rows mirror with the reading direction. | `phone-pages.mjs forms` |
| **404** (`pages/NotFound.tsx`) | The quoted path is a card; the three ways onward stack as full-width pills. | The path stays an LTR run. | `phone-pages.mjs forms` |
| **Sign-up block** (`components/SignupBlock.tsx`) | Email field 44 tall, consent checkbox with a 44 label hit area. | Consent text wraps in both languages. | Matrix |
| **Share menu** (`components/share/ShareMenu.tsx`) | `navigator.share` first; fallback to the in-page menu and copy link. Each outcome has a Help topic (R19). | Per-channel URLs keep `/he`. | Existing share and `helpTopics` tests |
| **Footer** (`components/SiteFooter.tsx`) | Links 44 tall and at least 44 wide. Admin link hidden on phones (D5, later PR). | Hebrew words are shorter: check their width. | Matrix |
| **Footer, grouped** (`SiteFooter.tsx`, `data-ph-foot`) | On a phone each link column is one inset group on the dark panel (a tint of the panel's own ink, no new colour), rows 48 tall and full width with a hairline between. Same links, same order. | Rows start at the logical edge. | `phone-pages.mjs forms` |
| **GroupedSection** (`components/phone/GroupedSection.tsx`) | The group is the rounded thing: one inset surface (22px radius, no outline) around a page's own `<ul>`/`<ol>`; rows divided by a hairline that starts after the circle. Adds no element to the accessibility tree; `display: contents` above 640. | Dividers start at the inline-start edge. | `phone.guard.test.ts`, matrix |
| **ListRow** (`components/phone/ListRow.tsx`) | One link per row, 64px tall, icon circle 40, title over a muted meta line, chevron. Whole row is the target (R5). Above 640 the circle is `display: contents` and the chevron hidden, so the page's own row is unchanged. | Chevron mirrors (R9); titles may take two lines, so Hebrew keeps its width. | `public-projects.mjs`, vitest |
| **AvatarCircle** (`components/phone/AvatarCircle.tsx`) | A circle (not a squircle) of 32, 40 or 56, tinted by what it labels. Decorative unless given a `label`. A circle never carries a number or a sentence. | Glyph direction follows R9. | `public-projects.mjs`, vitest |
| **Chevron** (`components/phone/Chevron.tsx`) | The row's trailing 18px chevron, phone only. | Mirrored under `:dir(rtl)`. | `public-projects.mjs` |
| **PillBadge** (`components/phone/PillBadge.tsx`) | A state or count, 24px tall, a dot and a word: colour never alone. The page's own pill class is the desktop look. Tone from `phone/tone.ts`. | Words come from the page's existing strings. | `tokens.contrast.test.ts` |
| **StatTile / StatGrid** (`components/phone/StatTile.tsx`) | Phone only. A 32 circle, a figure and a label, two per row. Render a tile only for a datum that exists; with none, the grid renders nothing (no empty box, no layout shift). Values are LTR isolates. | Labels reuse the repository facts' words. | `public-projects.mjs`, vitest |
| **SegmentedTabs** (`components/phone/SegmentedTabs.tsx`) | Three or four 44px segments in a pill track. The one tablist of the public site: APG tabs, automatic activation, roving tabindex; the page keeps the selection in the URL (`?tab=`). The Projects sort is the same look over links (`aria-current`). | Arrow keys follow the reading direction. | `public-projects.mjs`, vitest |
| **PinnedAction** (`components/phone/PinnedAction.tsx`) | The page's one primary action, fixed at the bottom above `env(safe-area-inset-bottom)`, opaque, no blur. Same link and words as the header's, which is hidden on a phone (`data-phone-dup`). The footer takes the room, so nothing is covered at the end of the page. | Label is today's string. | `public-projects.mjs` |
| **Route-change focus** (`components/RouteAnnouncer.tsx`, `lib/scrollToAnchor.ts`, `lib/inputModality.ts`) | Focus moves to the page heading for screen readers; no ring after a tap (R21), a 2px+ ring after a key. | Same in he and en. | `a11y:public-focus`, `inputModality` tests |

## 4. Real-device checklist

The headless browser in CI has no real browser chrome, no notch, no keyboard and no rubber-banding, so a person checks these. Run it at the end of the touch-target PR, the reader PR and the states PR: about 10 minutes on the owner's own phone, plus one in-app browser.

Devices: an iPhone in Safari, an Android phone in Chrome, one in-app browser (for example a link opened from a chat app), and one throttled run (Slow 3G in devtools, or a poor-signal spot).

Run each on `/`, a post, the blog list, a project and `/help`, once in English and once in Hebrew:

1. **First screen.** Load with the URL bar showing. The main call to action is fully visible and not under the toolbar. Scroll a little: the bar collapses and nothing jumps.
2. **Rotate to landscape.** The top dock and bottom bar are clear of the notch and home indicator (R7). Text does not inflate.
3. **Tap, do not aim.** Every button, chip, row and footer link opens on the first tap, with a thumb, without zooming. No sticky hover colour is left behind (R6).
4. **Keyboard.** Focus the contact email and the blog search: the page does not zoom (R4), the field stays visible above the keyboard, the Enter key says what it does.
5. **Reader.** Read down a post, open Contents, change the text size, share. The bar tucks and returns, and never covers the last line.
6. **Back and forward.** Open a post, press Back: the list is where you left it, scroll position kept, and it came back at once (bfcache).
7. **Offline.** Turn on airplane mode mid-page: the page says what failed and what still works; nothing goes blank (R16). Turn it off and retry.
8. **Slow network.** On the throttled run the first paint is text, then the image; nothing jumps when images arrive.
9. **Save-Data.** With data saver on, the particles and orbs are off and the page still looks finished.
10. **Hebrew.** Arrows point the right way, numbers and emails read correctly, nothing is clipped on the left edge.
11. **Blocked storage.** In a private window, change text size and theme: it works for the session and nothing throws.
12. **Share fallback.** In the in-app browser, Share falls back to copy link.

Note any failure as an issue with the device, OS and browser version, and a screenshot.

## 5. PR checklist

- [ ] Rules R1 to R21 read for what the PR touches; no allow-list line added (lines may only be removed).
- [ ] New public wording, English and Hebrew, listed in the PR under `STRINGS FOR OWNER APPROVAL`.
- [ ] Desktop pixels unchanged (axe and desktop screenshots).
- [ ] Hebrew checked in a screenshot, not only in the string file.
- [ ] No army-related text anywhere (copy, fixtures, alt text, screenshots).
- [ ] Catalogue row added or updated for a new or changed component.

## 6. Direction A ("grouped") on a phone

Owner decision of 2026-11-14 (D10). The research is in [design/public-mobile-direction](design/public-mobile-direction/README.md); the first pages built on it are Projects and a Project ([design/public-projects-a](design/public-projects-a/)).

**The kit** lives in `web/src/components/phone/` (catalogue rows above). Tokens are in `phone/tokens.css` and exist only inside `@media (max-width: 639px)`.

| Token | Value |
|---|---|
| Radii | `--r-sm` 14 (inner panels), `--r-md` 22 (a group, a card), `--r-pill` 999. Circles, not squircles. |
| Circles | `--ph-circle-s` 32 (stat tile), `--ph-circle-m` 40 (list row), `--ph-circle-l` 56 (header card). Glyph is half the circle. |
| Layers | ground `--canvas`; group `--ph-card` (canvas lightened 38%; dark: toward `--canvas-2` 62%); raised segment `--ph-card-hi`; recess `--ph-recess` (track, tile). |
| Spacing | 4 / 8 / 12 / 16 / 24: gutter 16, group gap 24, row 12x16. |
| Tones | `blue green purple yellow red neutral`, from the existing `--hue-*` and `--wash-*`. Disc = tone at 17%; glyph and pill word = tone mixed toward ink (dark: white). Held at 3:1 (glyph) and 4.5:1 (pill word) in light and dark by `phone/__tests__/tokens.contrast.test.ts`. |

**Rules for adopting it**

1. **Phone only, neutral above.** Wrapper components are `display: contents` and phone-only parts `display: none` above 640px, so the page keeps its own classes and its tablet and desktop pixels. `phone.guard.test.ts` fails if a look appears outside the phone query.
2. **Restyle the page's own markup before adding new DOM.** The DOM order, the single `h1` and the content a crawler reads stay as they were; the only additions are the circle wrapper, the chevron, the stat tiles, the stack toggle and the pinned action.
3. **Say it once.** Where the phone shows a fact in a tile or a pinned action, the same fact in the page's old place is hidden on a phone (`data-phone-dup`), not shown twice.
4. **Show only data that exists.** No tile, pill or row for an absent datum, and no placeholder.
5. **No blur, no new font, no third-party code, no layout shift** (sizes are reserved; skeletons per R16).
6. **Test it** with `npm run a11y:public-projects` (360/390/430, he and en, light and dark): overflow, circle sizes, 44px targets, tab semantics, the pinned action's clearance, desktop untouched.
