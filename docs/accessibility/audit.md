# Accessibility audit: WCAG 2.2 AA

Issue #99, conformance half. Audited 2026-11-02 against `main` at `5e58b7c`,
on the production build (`vite build` then `vite preview`), with the API
stubbed by fixtures shaped like the real envelopes.

**This is the author's audit, not a certification.** Most of it was done by
hand. The automated pass (axe-core) is listed separately, because it catches
perhaps a third of real failures and a green run is not conformance.

The light/dark question was answered after this audit: #247 built a true
dark theme (option 1 in the issue), re-derived the palette and kept the dark
act as the deepest ground in both themes. The axe run covers both themes.

## Viewer controls (2026-11-03)

The issue's other half. They live in the existing theme menu rather than in
a separate accessibility widget, so no setting has two switches:

| Control | Where | Persists | What it does |
|---|---|---|---|
| Theme | theme menu (#247) | `yb-theme` | Light, Dark, System |
| Text size | theme menu | `yb-text-size` | Default, Large (112.5%), Larger (125%) of the root size, on top of browser zoom |
| Contrast | theme menu | `yb-contrast` | Standard, More, System (`prefers-contrast: more`). More moves `--ink-soft`, `--ink-faint`, `--rule`, `--rule-firm` and the act's two greys (ratios in `index.css`) and makes the focus ring 3px |
| Motion | Pause toggle | `yb-motion-paused` | unchanged; `prefers-reduced-motion` is still honoured on its own |

All three menu settings are applied before first paint by
`public/theme-boot.js`, so a returning reader never sees a frame at the
wrong size or contrast. The menu is a Radix menu button: Enter or Space
opens it, the arrow keys move, Escape closes and returns focus to the
trigger. Each row is a `menuitemradio` with `aria-checked`, under a group
label. The trigger's name states all three current values, for example
"Theme: System, now Light; text size: Larger; contrast: More — change
display". `/accessibility` describes the controls.

### The gates these added

`npm run a11y` now also:

- **Walks the keyboard** on every route at both widths and fails on a tab
  stop with no focus indicator (2.4.7), a tab stop entirely hidden by
  sticky chrome (2.4.11, nine-point `elementFromPoint`), or a target under
  24x24 that the spacing exception does not save (2.5.8).
- **Re-runs seven routes at Larger text and More contrast**, in both themes
  and at both widths, for axe and the 320px reflow check.

`ONLY=axe|prefs|keyboard` narrows a local run.

### What the new gates found, and the fixes

| Finding | Where | Fix |
|---|---|---|
| A section head that is one long word ran off a phone at Larger text (and off 320px at the default) | `/accessibility` h1 | `text-section` floor is `min(2.2rem, 10vw)` (`tailwind.config.ts`) |
| "PORTFOLIO" ran 65px past a 320px screen at Larger | hero | phone floor capped at `13.8vw`, the same as the rem floor at the default size (`Hero.module.css`) |
| The sort options did not wrap | `/projects` | `.sort ul` wraps (`Work.module.css`) |
| The email address could not break, so it was clipped | `/accessibility`, `/` contact | `overflow-wrap: break-word` on `body` |
| More contrast in both themes and the act | 7 routes x 2 widths x 2 themes | axe clean, no change needed |
| Keyboard walk | every page, both widths | clean once the probe credits a ring drawn on a tree branch's first row (APG structure) and samples a tall tab panel only where it is on screen |

**The probe's 2.5.8 check implements the spacing exception.** Without it,
about thirty standalone text links 20–22px tall (rail pins, feed rows,
channel-log links) were flagged. Each one is clear of every other target
by the criterion's 24px circle, so each passes 2.5.8 as written, and axe's
`target-size` agrees. Making them 24px tall anyway would be a design change
across components that other work owns, so it is not made here.

## Scope

| | |
|---|---|
| Routes | `/`, `/projects`, `/projects/:slug` (`bothy`, the coverless case), `/blog`, `/blog/:slug`, `/accessibility`, the 404. `/blog` and `/blog/:slug` were also taken with the API failing |
| Out of scope | `/admin/*`. It sits behind the GitHub wall on its own host and is not public |
| Windows | 1440×900 and 320×568. 320 CSS px is the width 1.4.10 names, so it also stands in for 1280px at 400% zoom |
| Directions | `en` (LTR), and `he` (RTL), forced by setting `lang="he" dir="rtl"` on `<html>` after load the way `scripts/fontwork/shoot-first-screen.mjs` does. The Hebrew locale is listed and disabled because no Hebrew strings exist yet (`nav/locale.ts`), so the `he` runs answer "does the RTL layout and type system hold". They do not answer "is the Hebrew site accessible", because there is no Hebrew site yet |
| Motion | Both `prefers-reduced-motion: reduce` and `no-preference` |
| Legal floor | IS 5568 (Israel) is WCAG 2.0 AA with national changes, so it is a subset of this audit. The exception is 2.4.10 Section Headings, which IS 5568 raises to AA. It is covered below |

## Automated pass (the floor)

`npm run build && npm run a11y` (`web/scripts/a11y/axe-routes.mjs`). It runs
axe-core 4.10 with tags `wcag2a wcag2aa wcag21a wcag21aa wcag22aa` and
checks horizontal overflow at 320px. That makes 30 route runs: 7 routes × 2
directions × 2 widths, plus 2 with the API down. CI runs it on every pull
request, after the build.

| Run | Result |
|---|---|
| Before fixes | 28/30 clean. 1 rule failed on 2 runs: `scrollable-region-focusable` (2.1.1) on `/blog/:slug` at 320px, en and he: the prose table wrapper |
| After fixes | **30/30 clean** |
| axe best-practice tags (by hand, not in CI) | clean on every route |
| `color-contrast` incomplete | axe could not decide 52 nodes on `/` and 45 on `/projects`: text over the hero photograph, glyphs over pseudo-element grounds, and card labels where layers overlap. Not pixel-verified; see 1.4.3 below |

A note on how this was nearly wrong: the first version of the script used a
fixed port, found another process's static file server already on it, and
"audited" a directory listing. It now takes a free port from the OS and
refuses to measure any page that is not this site.

## Findings, by criterion

Status: **Pass**, **Fixed** (failed, fixed in this PR), **Open** (recorded
with a reason), **N/A**.

### Perceivable

| Criterion | Status | Evidence |
|---|---|---|
| 1.1.1 Non-text content | Pass | The hero portrait has a descriptive `alt`. Card screenshots carry `alt=""` because the card's label is the link's name. Icons are `aria-hidden` on controls that have names |
| 1.2.x Time-based media | N/A | No audio or video on any public route |
| 1.3.1 Info and relationships | Fixed | The coverless project card (Bothy) was announced as "stack React 19 TypeScript Docker Compose Traefik v3.7 Bothy …". `Plate` is a stand-in for a screenshot that copies facts stated elsewhere, and it sat first in the link. It is now `aria-hidden`, in `projects/Plate.tsx`. Everything else, including lists, `dl` specs and table headers, is exposed with its structure |
| 1.3.2 Meaningful sequence | Pass | DOM order matches reading order in both directions. The layout uses logical properties |
| 1.3.4 Orientation | Pass | Nothing locks orientation |
| 1.3.5 Input purpose | Pass | Contact fields carry `autocomplete="name"` and `"email"` |
| 1.4.1 Use of colour | Pass | States (`aria-current`, invalid fields) carry text or shape as well as colour |
| 1.4.3 Contrast (minimum) | Pass, partly unverified | axe passes every node it can decide, in both the paper sections and the dark act. Text over the hero photograph and over pseudo-element grounds is reported "incomplete" (above). It is covered by the measured token block in `index.css`, but this audit has not checked it pixel by pixel, because desktop screenshots hang on this box's headless Chromium (no frame clock). **Open: re-check the hero facts over the photograph on a machine with a working compositor** |
| 1.4.4 Resize text | Pass | Type is set in `rem` and `clamp()`, and the 320px run is the 400% case |
| 1.4.10 Reflow | Pass | `scrollWidth − clientWidth = 0` on every route at 320px, in both directions, automated. Code blocks and prose tables scroll inside their own box, which the criterion allows for content that needs two dimensions |
| 1.4.11 Non-text contrast | Pass | Focus ring: 2–3px `--bone` (rgb 20 19 15) on paper, and on the dark act the cards use a light ring (rgb 242 240 234). Both measured at every tab stop. Field borders and pills come from the measured tokens |
| 1.4.12 Text spacing | Pass | Injected line-height 1.5, letter 0.12em, word 0.16em and paragraph 2em at 320px on every route. Nothing readable clips, and there is no horizontal overflow. The only clipped boxes were the `Plate` tech rows (`truncate`, fixed aspect). They are a decorative copy of `ProjectStack`, now `aria-hidden`, so no content is lost |
| 1.4.13 Content on hover/focus | Pass | Radix tooltips are dismissible with Escape, hoverable, and persistent |

### Operable

| Criterion | Status | Evidence |
|---|---|---|
| 2.1.1 Keyboard | Fixed | The prose table wrapper scrolled sideways below ~560px and could not be reached by keyboard. It is now `tabIndex=0` with `role="region"` and a name, in `BlogPost.tsx`. Every other control was reached in a full tab walk of `/` and `/blog/:slug` at both widths |
| 2.1.2 No keyboard trap | Pass | The tab order wraps through the document. The contact `<dialog>` and the phone menu contain focus on purpose, and both release it on Escape, which returns focus to the trigger (verified: "Write a message" gets focus back). Nothing else contains focus |
| 2.1.4 Character key shortcuts | Pass | None. Sonner's `alt+T` uses a modifier |
| 2.2.2 Pause, stop, hide | Pass | The only motion that runs longer than 5s is the hero phrase cycle: 24 infinite animations on `/`. With reduced motion: 0. After **Pause motion**: 0 infinite animations running. The other routes run nothing infinite |
| 2.3.1 Three flashes | Pass | Nothing flashes |
| 2.4.1 Bypass blocks | Pass | "Skip to content" is the first tab stop on every route and targets `#content` |
| 2.4.2 Page titled | Pass | Each route sets `name · Yehuda Briskman` |
| 2.4.3 Focus order | Pass | Bar, then main, then footer, in visual order. The phone shows Menu → content |
| 2.4.4 Link purpose | Pass (after 1.3.1 fix) | Card links now lead with the project or note name |
| 2.4.6 Headings and labels | Pass | |
| 2.4.7 Focus visible | Fixed | On `/blog/:slug` at phone width, the reading bar's "← Notes" and "Share" are in the tab order from the top of the post. The bar hides below the screen for the first 240px, so tab stops 3 and 4 landed **off screen**: the rect was at y=641 in a 640px viewport. Focus inside the bar now shows the bar (`ReadingBar.tsx`). After the fix it is at y=585, in view, and uncovered |
| 2.4.10 Section headings (AA in IS 5568) | Pass | Outline per route: `/` h1 → h2 Work → h3 ×4 → h2 How I work → h3 ×3 → h2 ×4. `/projects` h1 → h2 ×6. `/projects/bothy` h1 → h2 → h2 → h3 ×3 → h2 ×4. Posts h1 → body h2/h3. No skipped levels anywhere. `ObjectLabel`'s `nameAs` holds this |
| 2.4.11 Focus not obscured (min.) | Pass, plus hardening | No tab stop on any route had its centre covered by the sticky bar (`elementFromPoint` sampled at 9 points per stop: 0 covered). The top bar already sets `scroll-padding-top`. The phone reading bar is fixed at the *bottom* and had no matching padding, so a focused link could scroll under it. A post now sets `scroll-padding-bottom` while it is mounted |
| 2.5.1 / 2.5.2 Pointer | Pass | No path or multipoint gestures. Actions fire on click |
| 2.5.3 Label in name | Pass | Icon-only controls have no visible label. Text controls' names contain their text |
| 2.5.7 Dragging | N/A | Nothing drags (the notes shelf scrolls natively) |
| 2.5.8 Target size (min.) | Pass | axe `target-size` is clean. By hand, nothing interactive is under 24×24 except inline links inside prose (exempt as *inline*) and the skip link while it is visually hidden. Bar controls are 38–44px, footer rows 47px at phone width |

### Understandable

| Criterion | Status | Evidence |
|---|---|---|
| 3.1.1 Language of page | Pass | `lang="en"` is shipped in `index.html` and kept by `applyLocale` |
| 3.1.2 Language of parts | Pass | The language menu's "עברית" is the only foreign string. It does not apply in IS 5568 |
| 3.2.1 / 3.2.2 On focus / input | Pass | Nothing changes context on focus or input |
| 3.2.6 Consistent help | Pass | Contact is reached the same way from every page (footer Email, `/#contact`) |
| 3.3.1 Error identification | Pass | An empty submit sets `aria-invalid` on each bad field, with a note linked by `aria-describedby`. A `role="alert"` says "Nothing was sent…". Focus deliberately stays on Send; the reason is argued in `Contact.tsx` (moving focus cuts off the alert on several screen readers) |
| 3.3.2 Labels or instructions | Pass | Visible `<label for>` on every field |
| 3.3.3 Error suggestion | Fixed | The name and message notes said what to do, but the email note only said "That email address doesn't look right". It now adds the expected shape: "It should look like name@example.com" (`services/contact.ts`) |
| 3.3.7 Redundant entry / 3.3.8 Accessible auth | N/A | Single-step form, no authentication on public routes |

### Robust

| Criterion | Status | Evidence |
|---|---|---|
| 4.1.2 Name, role, value | Fixed | **Pause motion** combined `aria-pressed` with a name that flipped to "Play motion", so a screen reader said "Play motion, toggle button, pressed" while motion was stopped. The name is now constant, `aria-pressed` carries the state, and the tooltip says what a press does next, per the APG toggle-button rule (`nav/MotionToggle.tsx`) |
| 4.1.3 Status messages | Pass | The contact receipt is `role="status"` with `aria-live="polite"`. Failure is `role="alert"`. Route changes are announced by `RouteAnnouncer` |

## Reduced motion, against the device ledger

`docs/motion-contract.md` lists the devices. With `reducedMotion: "reduce"`,
`document.getAnimations()` returned **0 running** on every route after a full
scroll. With `no-preference`, only `/` runs anything continuous (the hero
phrase cycle), and Pause stops it. The entry shutter is skipped under
reduced motion. The scroll-driven arrivals settle at once (they are
reduced to `0.01ms` by the global rule in `index.css`).

## Screen-reader names

Taken from Chromium's accessibility tree (Playwright `ariaSnapshot`) on each
route. Landmarks: one banner with `nav "Pages"` and `nav "Elsewhere"`, then
`main` and `contentinfo`. The phone sheet repeats both navs, but it is
`hidden` while closed, and the bar copies are `display: none` while it is
open. So no landmark name is announced twice.

**No assistive technology was run.** NVDA, JAWS, VoiceOver and TalkBack are
not on this box. The accessibility tree is what they read, but each one reads
it its own way, and Hebrew speech in particular is unchecked. **Open.**

## Open items

1. **Two empty notification regions.** `Toaster` (Radix, "Notifications
   (F8)") and `Sonner` ("Notifications alt+T") are both mounted, so a screen
   reader's landmark list shows two regions with almost the same name and
   nothing in either. Not a WCAG failure. The fix is to keep one toast
   library, which is a separate change.
2. **Hero contrast over the photograph** has not been pixel-verified (1.4.3
   above).
3. **Real assistive-technology pass** (above).
4. **Hebrew.** The prose table cells in `BlogPost.tsx` use physical
   `text-left` and `pr-6`, which will sit wrong under `dir="rtl"` once Hebrew
   content exists. The fix is `text-start` and `pe-6`. This is left to the
   prose-primitive work (#98), which owns that file's prose.

## Accessibility statement

`/accessibility` is new and linked from the footer on every page. Regulation
35ה of the Israeli Service Accessibility Regulations asks a public-facing
service for one. Whether a personal portfolio falls under that duty, or under
a 35ו exemption, is a legal question this audit does not answer. The page is
published anyway, because it also gives the issue its "visible, reachable
statement of what the Pause control does".

**For the owner to confirm:**

- The reporting channel is the email address the site already publishes
  (`data/site.ts`) plus the contact form. Nothing new was invented.
- No accessibility coordinator is named. Section 19מב of the Act requires one
  only from an operator with at least 25 employees.
- The statement says plainly that this is the author's own audit, not a
  certified one.

## Re-running

```sh
cd web
npm run build && npm run a11y            # the automated floor; exits 1 on any violation
npm run a11y -- --json /tmp/axe.json     # raw results
```

The manual checks above (tab walk with an `elementFromPoint` obscuring
test, the text-spacing injection, the target sweep and the animation count)
were run with throwaway Playwright probes against the same preview build.
On this box, pass `{ polling: 500 }` to every `waitForFunction`, because
headless Chromium has almost no rAF clock.
