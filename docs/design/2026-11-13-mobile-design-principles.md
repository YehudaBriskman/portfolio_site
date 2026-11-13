<!-- Reference appendix to docs/admin-design-guide.md. Research notes dated 2026-11-13: they record where the guide's numbers came from and are not a contract; if they disagree with the guide, the guide wins. Local file paths were removed when this was copied. -->

# Mobile-first design principles for admin/dashboard UIs (checklist)

Task r1, compiled 2026-11-13. Audience: implementers. Hebrew RTL admin, rounded modern look.

## Source legend and honesty notes
- **[F]** = page fetched this session (2026-11-13) and read. **[K]** = from my own knowledge, page NOT fetched or not renderable; verify before quoting a number.
- Apple HIG (developer.apple.com) and Material 3 (m3.material.io) are JS-rendered; WebFetch returned only titles. Every Apple/M3 number below is **[K]**. Primary URLs are given so a human or browser run can confirm.
- Pages were treated as data. MDN/web.dev pages were truncated at 100k chars; the parts used were in the first part.
- Sources used: W3C WCAG 2.2 Understanding docs, MDN, web.dev, Chrome dev blog, Android developers, NN/g, GOV.UK design system.

## Reconciliation with local skills (what is already covered vs new)
Read: `web-interface-guidelines` (full), `interface-design` (section headings + motion/radius/hit-area/type lines), `apple-design` (headings + sec. 14-15), `data-display` (headings + bidi table lines). I did not read every line of `interface-design`, `apple-design`, `data-display`.

| Topic | Already covered locally | New in this document |
|---|---|---|
| Hit targets | WIG: >=24px, mobile >=44px, expand hit area; interface-design: 44px, 40 min, pseudo-element | spacing exception math, `pointer: coarse` sizing, row-action spacing, thumb-zone caveat |
| iOS input zoom, zoom disable, tap-highlight, touch-action | WIG | font-size test as computed-style CI check |
| Safe areas | WIG one line | `viewport-fit=cover`, sticky bar padding recipe, `interactive-widget`, dvh/svh/lvh, keyboard avoidance |
| Forms | WIG (types, autocomplete, inline errors, focus first error, unsaved warn) | inputmode value table, enterkeyhint, GOV.UK validate-on-submit tension with WIG "validate after", sticky action bar |
| Motion | interface-design (<300ms, 100-160 press, scale .97, no scale(0), stagger); apple-design (springs, interrupt, reduced-motion x3 signals); WIG (compositor props, no `transition: all`) | token table, "1ms not none" for reduced motion, view transitions, FLIP/layout animation, JS listener for MQ change |
| Radius | interface-design: scale + concentric (outer = inner + padding); WIG: nested radii | concrete numeric scale, M3 reference, pill rule for touch controls |
| Tables/records | data-display: bidi per value type, alignment, tabular, empty, say-once | mobile reflow options, sticky first column, row actions, sort/filter sheet, 320px reflow SC |
| RTL | data-display, hebrew-i18n | logical-property lint, icon mirroring list, numerals/Intl, swipe direction flip |
| Contrast | WIG: prefer APCA | WCAG minimums as the legal floor (AA 4.5/3/3), APCA as additional |
| Navigation, sheets, toasts, skeletons, pull-to-refresh, settings patterns, viewport matrix, text scaling | mostly not covered (skeleton mirrors content; polite aria-live toast; optimistic UI + undo) | all rows in sections A, C, D, H, J, M |

Conflicts to settle: (1) WIG says "validate after, do not block typing" and GOV.UK says validate on submit, not on blur [F]. Choose: no validation while typing, validate on blur only for format-certain fields (email shape), always full on submit. (2) interface-design says 44px with 40px minimum; WCAG AA floor is 24px; use 44px for touch, 40px hard floor, 24px is legal not usable.

---

# 1. Checklist (MUST = fail the review, SHOULD = needs a reason to skip)

## A. Viewport, layout, reflow
1. MUST: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`; test: no `maximum-scale`/`user-scalable=no`. [WIG local; K for viewport-fit] https://developer.mozilla.org/en-US/docs/Web/CSS/env [F: env page confirms insets, not viewport-fit]
2. MUST: no 2-D scroll at 320 CSS px wide (page body); `scrollWidth <= clientWidth` on `document.documentElement`. Data tables may scroll inside their own container. https://www.w3.org/WAI/WCAG22/Understanding/reflow.html [F]
3. MUST: headings, search fields and pagination attached to a table still reflow at 320px (not covered by the table exception). same URL [F]
4. MUST: layout works at browser zoom 200% (1280px window = 640 css px) and 400% (=320 css px) without clipped controls. same URL [F]
5. MUST: use `dvh`/`svh`, never bare `100vh`, for full-height shells; `svh` where a bottom button must always be visible; `dvh` fills but resizes during toolbar motion. https://web.dev/blog/viewport-units [F]
6. MUST: layout decisions use container/available width, not device type or UA sniffing (Android guidance: use the space actually given). Prefer `@container` for components. https://developer.android.com/develop/ui/compose/layouts/adaptive/support-different-screen-sizes [F]
7. SHOULD: breakpoints follow window size classes: compact <600, medium 600-839, expanded >=840 (dp ~ css px). https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes [K for numbers]
8. MUST: flex/grid children that hold text have `min-width:0`; long ids, emails, paths truncate or wrap; no overflow at 320px with 40-char unbroken string. [WIG local]
9. SHOULD: horizontal page gutter 16px at <600, 24px at >=600; content max-width at wide screens (tables may exceed). Apple iPhone margin 16pt, iPad 20pt. https://developer.apple.com/design/human-interface-guidelines/layout [K]
10. MUST: sticky/fixed bars become static or collapse when viewport height < 480px (landscape phones) so they do not eat the viewport. WCAG reflow guidance: make sticky elements static at small sizes. https://www.w3.org/WAI/WCAG22/Understanding/reflow.html [F]
11. SHOULD: master-detail: single pane on compact, two-pane list-detail from >=840; selection state survives a resize or fold (hoist state). https://developer.android.com/develop/ui/compose/layouts/adaptive/support-different-screen-sizes [F]
12. MUST: `overscroll-behavior: contain` on sheets, drawers, inner scrollers so scroll chaining does not move the page. [WIG local]

## B. Safe areas, keyboard, iOS/Android quirks
13. MUST: fixed/sticky bottom bars pad with `calc(<base> + env(safe-area-inset-bottom))`; test with a simulated 34px inset. https://developer.mozilla.org/en-US/docs/Web/CSS/env [F]
14. MUST: side insets (`safe-area-inset-left/right`) applied to full-bleed content in landscape (notch). same URL [F]
15. MUST: every `input`, `select`, `textarea` computed font-size >= 16px on touch viewports (iOS Safari zooms on focus below 16px). [WIG local; K for the zoom rule, not fetched]
16. MUST: focused field is not hidden by keyboard or sticky bar: `scroll-margin-block` on fields, test by focusing the last field at 375x667 with a 300px simulated keyboard. https://developer.chrome.com/blog/viewport-resize-behavior [F: viewports]
17. SHOULD: know the keyboard model: Chrome Android 108+ and iOS Safari both default to `resizes-visual` (layout viewport does NOT shrink); `interactive-widget=resizes-content` restores shrinking on Android only (not Chrome iOS). Do not rely on `100dvh` shrinking for the keyboard. https://developer.chrome.com/blog/viewport-resize-behavior [F]
18. SHOULD: for sticky action bars above the keyboard, use `visualViewport` resize/scroll events or `env(keyboard-inset-height)` (VirtualKeyboard API, Chromium only), with a graceful fallback. https://developer.mozilla.org/en-US/docs/Web/CSS/env [F]
19. MUST: `touch-action: manipulation` on controls (no double-tap zoom delay); keep pinch zoom. [WIG local]
20. SHOULD: `-webkit-tap-highlight-color: transparent` only when a custom `:active` state exists. [WIG local]
21. MUST: hover styles inside `@media (hover: hover)`; touch devices report `hover: none`, so nothing sticks after tap. https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/any-pointer [F, hover part from page-adjacent knowledge, marked by the fetcher as general knowledge]
22. SHOULD: size by `@media (pointer: coarse)` (primary input); do NOT use `any-pointer: coarse` to exclude mouse, it matches many hybrid laptops. same URL [F]
23. SHOULD: test Android Chrome URL-bar collapse (dvh jumps), and iOS Safari bottom toolbar (fixed bottom bar must clear it); use real device or BrowserStack, headless Chromium cannot show either. [K]
24. SHOULD: `<meta name="theme-color">` matches surface in light and dark (two tags with `media`). [WIG local]

## C. Touch targets, buttons, destructive actions
25. MUST: every pointer target >= 24x24 css px, or has 24px-circle spacing from neighbours, or an equivalent control, or is inline text. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html [F]
26. MUST (house rule): coarse-pointer targets >= 44x44 css px (Apple 44pt; WCAG 2.5.5 AAA 44; Material 48dp). Hard floor 40. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html [F: 44 figure]; Apple/M3 numbers [K]
27. MUST: if the visual is smaller (20px checkbox, 16px icon), extend the hit area with padding or a pseudo-element, never let two hit areas overlap. [interface-design local]
28. SHOULD: >= 8px gap between adjacent touch targets (NN/g cites ~2mm minimum; 8px is the practical number). https://www.nngroup.com/articles/touch-target-size/ [F]
29. SHOULD: primary actions larger than secondary; NN/g: primary CTA can deserve ~2cm. same URL [F]
30. MUST: checkbox/radio/switch: label + control share one hit target, no dead zones between them. [WIG local]
31. MUST: icon-only buttons have `aria-label` and a visible `:focus-visible` ring; tooltips are never the only label on touch. [WIG local]
32. SHOULD: do not assume the bottom of the screen is the best place; NN/g notes the middle of the screen is generally easiest to reach, and bottom-anchored does not automatically improve reachability. Put frequent actions bottom/mid, rare ones in overflow. https://www.nngroup.com/articles/bottom-sheet/ [F]
33. MUST: destructive actions are visually distinct (danger color AND text/icon), never adjacent to the primary action without >= 16px gap, never the default/first-focused button in a confirm. https://www.nngroup.com/articles/confirmation-dialog/ [F]
34. MUST: prefer Undo over confirm for reversible deletes; confirm only for severe or irreversible; reserve type-to-confirm for rare, dangerous ones. https://www.nngroup.com/articles/confirmation-dialog/ [F]
35. MUST: confirm dialog restates the object and consequence; buttons labelled by outcome ("Delete 3 posts" / "Keep"), not Yes/No. same URL [F]
36. MUST: pending button shows spinner, keeps its label and width (no layout shift), is disabled only after request starts. [WIG local]
37. SHOULD: press feedback `transform: scale(0.97)` (not below .95) within 100-160ms. [interface-design local]
38. MUST: every button/link has a non-hover affordance; "if it looks clickable, it is clickable". [WIG local]

## D. Settings screens
39. MUST: group settings into labelled sections (grouped list: rounded container, 1px separators inset from the icon edge); each row >= 44px tall. Apple Settings and Android Settings both use this pattern. https://developer.apple.com/design/human-interface-guidelines/lists-and-tables [K]
40. MUST: a toggle row applies immediately and shows saved state (optimistic + rollback on failure); a row that needs several fields opens a detail screen/sheet with Save. https://developer.apple.com/design/human-interface-guidelines/toggles [K]
41. MUST: the entire row is the toggle target (not only the 51x31 switch); `role="switch"` + `aria-checked`, label associated. https://www.w3.org/WAI/ARIA/apg/patterns/switch/ [K]
42. SHOULD: inline edit only for single short values; use a detail screen for validation-heavy or multi-field edits; never mix auto-save and Save button in one screen. [K; Material/Apple settings practice, secondary]
43. SHOULD: progressive disclosure: advanced settings behind a row ("Advanced") or `<details>`, default closed; summary text on the row shows the current value. https://www.nngroup.com/articles/progressive-disclosure/ [K]
44. SHOULD: settings search when > ~25 settings; results show the setting's row in place with its section as breadcrumb; empty result offers a next step. [K]
45. MUST: dangerous settings (delete account, reset) live in a separate "Danger zone" section at the end, with the confirm pattern from 33-35. [K]
46. MUST: row labels truncate with ellipsis at one line OR wrap; value never overlaps label at 320px and 200% text. [WIG local]

## E. Data tables and record lists on phones
47. MUST: choose per table, in this order: (a) cut columns to what is legible, (b) card-reflow for <=6 fields where rows are independent records, (c) horizontal scroll with sticky first column for comparison tables. https://www.nngroup.com/articles/mobile-tables/ [F]
48. MUST: horizontal scroll tables show a cue (cut-off next column or edge shadow); NN/g: horizontal scroll "somewhat acceptable" for large tables, disliked generally. same URL [F]
49. MUST: sticky first column (row header) in scroll tables; sticky header row for long tables; both with opaque background and a separator. same URL [F]
50. MUST: table inside its own `overflow-x:auto` region with `tabindex=0`, `role="region"`, accessible name, so keyboard users can scroll it. https://www.w3.org/WAI/WCAG22/Understanding/reflow.html [F: container advice]; tabindex rule [K]
51. MUST: card-reflow keeps `<table>` semantics or labelled `dl`; each value keeps its column label; do not reorder reading order. [data-display local]
52. SHOULD: card = title (primary field) + status chip + 2-4 key fields + overflow menu; the rest on tap. [K]
53. MUST: row tap opens the record; secondary row actions live in a `...` overflow button (44px) or swipe plus the same actions in that menu. [K]
54. MUST: swipe actions always have a non-gesture equivalent (overflow menu, detail screen buttons). WCAG 2.5.1 Pointer Gestures. https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html [K]
55. MUST: sort and filter on phones are one control opening a bottom sheet with Apply/Reset and an active-count badge; active filters render as removable chips above the list. [K]
56. SHOULD: density toggle: 48px default rows on touch, 36-40px compact option for `pointer: fine`; never below 40px touch. [interface-design local density; K]
57. MUST: numeric columns right-aligned physically, `tabular-nums`; ids/paths `dir="ltr"`. [data-display local]
58. SHOULD: virtualise or paginate > 50 rows; show total count and loaded count. [WIG local]
59. MUST: bulk-select mode shows a bar with count and actions; checkbox column hit area 44px. [K]

## F. Cards, record details, bottom sheets, dialogs
60. MUST: record detail = header (title, status, primary action) then grouped label/value sections; one column on compact. [data-display local]
61. MUST: detail screens have Back (UI and browser/gesture) and deep-linkable URL. [WIG local]
62. SHOULD: bottom sheet only for short, transient content (filters, actions, pickers); long flows get a page. NN/g: sheets are transient. https://www.nngroup.com/articles/bottom-sheet/ [F]
63. MUST: sheet has visible Close (X), grab handle is not the only dismiss, and Back/Escape closes it. same URL [F]
64. MUST: no stacked sheets (a sheet opening a sheet). same URL [F]
65. MUST: modal sheet/dialog: focus moves in, trapped, returns to trigger on close; `<dialog>` or APG dialog pattern; background `inert`. https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ [K]
66. MUST: modal sheets lock background scroll without layout jump (`overscroll-behavior: contain`, avoid `position:fixed` body hack unless scroll position restored). [WIG local]
67. SHOULD: sheet max-height `90dvh`, content scrolls inside, footer actions sticky with safe-area padding. [K, dvh F]
68. SHOULD: below 600 css px dialogs become sheets (bottom) or full-screen; >=600 centered, max-width 560px. [K]

## G. Forms
69. MUST: right `type` AND `inputmode` AND `autocomplete` AND `name` per field (email, tel, url, numeric: `inputmode="numeric"` for PINs; `decimal` for amounts). https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode [F]
70. MUST: `inputmode` is a keyboard hint only; validation comes from `type`/pattern/server. same URL [F]
71. SHOULD: `enterkeyhint` (search/next/done/go) matches what Enter does. same URL [F]
72. MUST: visible label above field (not placeholder-only); placeholder is an example, ends with ellipsis. [WIG local]
73. MUST: single-column forms on compact; related short fields (zip + city) may pair >= 600. [K]
74. MUST: server-validate always; client validate on submit, plus on blur only for format-certain fields; never block typing or paste. https://design-system.service.gov.uk/patterns/validation/ [F]
75. MUST: errors inline under the field AND an error summary at the top that receives focus on submit; keep user's input; message says what and how to fix; title prefixed "Error: ". https://design-system.service.gov.uk/patterns/validation/ [F]
76. MUST: `aria-invalid` + `aria-describedby` to the error id; errors not color-only. [WIG local; K]
77. SHOULD: sticky action bar (Save/Cancel) at the bottom of long forms, with safe-area padding, not covering the focused field (see 16); dirty-state shows "Unsaved changes". [K; WIG: warn on unsaved]
78. MUST: Enter submits; no autofocus on mobile (opens keyboard and scrolls). [WIG local]
79. MUST: allow autofill and password managers; allow paste; trim whitespace. [WIG local]
80. SHOULD: date/time use native pickers on touch (`type=date`) unless range selection needs a custom one; locale via `Intl`. [K]

## H. Navigation
81. MUST: <=5 primary destinations -> bottom tab bar on compact (labels always visible, 48-56px tall, active state not color-only); more -> "More" tab or drawer. Material: navigation bar compact, rail medium, drawer expanded. https://m3.material.io/components/navigation-bar [K]
82. SHOULD: >=600 switch to rail (72-80px); >=1024 permanent sidebar. https://m3.material.io/components/navigation-rail [K]
83. MUST: bottom bar respects safe-area-bottom and hides never; do not hide on scroll for admin tools (users lose orientation). [K]
84. MUST: current location shown (`aria-current="page"`), page title matches, Back never traps. [WIG local]
85. SHOULD: hamburger/drawer only for secondary and rare destinations; admin apps with many sections: bottom bar for top 4 + "More" list. [K]
86. SHOULD: breadcrumb collapses to a single "< Parent" back link on compact. [K]

## I. States: empty, loading, error, feedback
87. MUST: every list/table/card has designed empty (what + next action), loading, error (what + retry), and partial states. [WIG local]
88. MUST: skeletons mirror final layout, same heights, zero CLS; replace after >=300ms delay to avoid flash; spinner only for actions < 1s. [WIG local; delay rule K]
89. MUST: reduced motion keeps skeletons (state-conveying) but replaces shimmer with static or slow fade. https://web.dev/articles/prefers-reduced-motion [F: keep skeletons]
90. SHOULD: pull-to-refresh on lists that are server data; must have a visible Refresh button alternative; `overscroll-behavior-y: contain` plus custom indicator, or leave native. [K]
91. SHOULD: optimistic UI for toggles and simple edits; rollback with toast + retry on failure. [WIG local]
92. MUST: toasts: `role="status"` / polite `aria-live`, >= 5s (Undo toasts >= 8s) and pausable, not above the bottom nav, never the sole way to learn an error that needs action. WCAG 2.2.1 Timing Adjustable, 4.1.3. https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html [K]
93. MUST: Undo toast for delete/archive; the undo works after navigation within the window. https://www.nngroup.com/articles/confirmation-dialog/ [F]
94. MUST: errors say what happened + what to do; inline retry; keep entered data. https://design-system.service.gov.uk/patterns/validation/ [F]
95. SHOULD: offline/slow connection banner; stale-data timestamp on dashboards. [K]

## J. Typography and text scaling
96. MUST: body >= 16px on mobile (inputs hard requirement, see 15); secondary text >= 14px; captions/labels >= 12px; nothing below 11px anywhere (uppercase tracked micro-labels may be 11px). [K/house; interface-design suggests 11px labels]
97. MUST: sizes in `rem`; 200% browser text zoom leaves no clipped or overlapping text; test with `font-size: 200%` on html. WCAG 1.4.4 (200%) and 1.4.10. https://www.w3.org/WAI/WCAG22/Understanding/reflow.html [F reflow; 1.4.4 K]
98. MUST: layout survives text-spacing override (line-height 1.5, paragraph 2x, letter .12em, word .16em) with nothing cut off; no fixed heights on text containers. https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html [F]
99. SHOULD: line length 45-75 characters for prose (`max-width: 65ch`); table/cards exempt. [K]
100. SHOULD: line-height body 1.5, headings 1.15-1.3, dense table 1.35. [apple-design/interface-design local]
101. SHOULD: Dynamic Type-style scaling: use `rem` for spacing too, so spacing grows with text; use `min-height`, not `height`. [apple-design local]
102. SHOULD: tabular figures on every dynamic number; `text-wrap: balance` on headings, `pretty` on prose. [WIG local]
103. MUST: Hebrew font stack with real Hebrew glyphs (not fallback-mixed metrics); line-height >= 1.5 for Hebrew body; avoid italic and letter-spacing on Hebrew. [K, hebrew-i18n local]

## K. Colour, dark mode, contrast
104. MUST: text contrast >= 4.5:1 (>= 3:1 for large text: 24px, or 18.5px bold); icons, input borders, focus rings >= 3:1 against adjacent colour. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html [F]
105. SHOULD: also check APCA Lc >= 60 body, >= 75 for small/light text, as the stricter perceptual test (WCAG remains the conformance floor). https://apcacontrast.com/ [K]
106. MUST: dark theme is a designed palette (not inverted): surfaces step lighter with elevation, text not pure white (#E6-#F0 range), saturated accents toned down; `color-scheme: dark`. [WIG local; K for ranges]
107. MUST: status never colour-only (icon or text). [WIG local]
108. SHOULD: `prefers-contrast: more` raises borders and text; `prefers-reduced-transparency` removes blur. [apple-design local]
109. MUST: both themes tested at the viewport matrix; charts use colour-blind-safe palettes. [WIG local]

## L. Spacing, radius, elevation (rounded modern look)
110. MUST: one spacing scale on a 4px base; no off-scale values in CSS (lint). [interface-design local]
111. MUST: concentric radii: inner radius = outer radius - padding (never inner >= outer). [interface-design/WIG local]
112. SHOULD: radius by role: control 12 (h 44), chip/segment pill, card 16-20, sheet top corners 24-28, dialog 24; avoid mixing sharp and soft. M3 scale reference: 4/8/12/16/20/28/full. https://m3.material.io/styles/shape/corner-radius-scale [K numbers; page not renderable]
113. SHOULD: Apple style continuous corners ("squircle"): approximate with `corner-shape: squircle` where supported (progressive), else plain radius. [K]
114. SHOULD: elevation by layered low-alpha shadow plus 1px translucent border; dark mode uses lighter surface plus border, not shadow. [WIG local]
115. SHOULD: card padding 16 (compact) / 20-24 (>=600); gap between cards 12; section gap 24-32. [K/house]

## M. RTL and Hebrew
116. MUST: `dir="rtl"` and `lang="he"` on `<html>`; CSS uses logical properties only (`margin-inline`, `padding-block`, `inset-inline-start`, `text-align: start`, `border-start-*`). Lint for `left|right|margin-left|padding-right|text-align: left`. https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values [K]
117. MUST: mirror directional icons (chevrons, back/forward, arrows, send, progress, list indents); do NOT mirror clocks, media play, check marks, logos, charts' time axis conventions per W3C. https://m3.material.io/foundations/designing/structure [K: M3 bidirectionality; not fetched]
118. MUST: swipe gestures and slide transitions flip direction in RTL (swipe-to-reveal from the inline-start edge); drawers open from the right. [K]
119. MUST: numerals: `dir="ltr"` islands for ids, phone, paths, emails, timestamps; money amounts via `Intl.NumberFormat('he-IL')`; keep Western digits unless product decides otherwise. [data-display local]
120. MUST: embedded LTR words (brand names, code) in Hebrew sentences wrapped with `<bdi>` or `dir` so punctuation does not jump. [data-display local]
121. SHOULD: table numeric columns still physical right; text columns start. [data-display local]
122. MUST: test the viewport matrix in RTL AND LTR with long Hebrew and long English strings. [K]
123. SHOULD: Hebrew text ~10-30% shorter than English but taller glyph metrics; allow 2-line labels. [K, secondary]

## N. Motion
124. MUST: durations: micro feedback 100-160ms, popovers 125-200ms, sheets/drawers 200-300ms (<=350 large), page/view transitions 200-300ms; exits ~30% faster than enters. [interface-design local, 150-300 per brief]
125. MUST: easing: enter `cubic-bezier(0.2,0,0,1)` (decelerate), exit `cubic-bezier(0.4,0,1,1)` (accelerate), move `cubic-bezier(0.4,0,0.2,1)`; no linear except progress/loops. https://m3.material.io/styles/motion/easing-and-duration/tokens-specs [K]
126. SHOULD: gesture-driven motion uses springs (response ~0.3-0.5s, little overshoot); everything interruptible. [apple-design local]
127. MUST: animate `transform`/`opacity` only; never `transition: all`; avoid animating height (use grid-template-rows 0fr->1fr or FLIP). [WIG local]
128. MUST: `@media (prefers-reduced-motion: reduce)` removes movement and parallax, keeps opacity/feedback; prefer durations ~1ms over `animation:none` so `animationend` handlers still fire. https://web.dev/articles/prefers-reduced-motion [F]
129. MUST: JS-driven animation (WAAPI, libraries) listens to `matchMedia('(prefers-reduced-motion: reduce)')` change; CSS overrides do not stop WAAPI. same URL [F]
130. SHOULD: View Transitions API for route changes and list reorder (`view-transition-name` unique per element; wrap in `@media (prefers-reduced-motion: no-preference)`); progressive enhancement only. https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API [K]
131. SHOULD: layout animation with FLIP (measure, invert, play) on transform; batch reads then writes; no per-frame layout reads. [K]
132. MUST: no autoplay motion > 5s without pause control. [WIG local]
133. SHOULD: stagger list entrances 30-80ms, cap total < 400ms. [interface-design local]

## O. Gestures
134. MUST: any drag/swipe/pinch/path gesture has a single-pointer tap alternative (WCAG 2.5.1) and a keyboard alternative. https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html [K]
135. MUST: drag-to-reorder has "Move up/down" or a move-to menu (WCAG 2.5.7 Dragging Movements, 2.2 AA). https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html [K]
136. MUST: do not use edge swipes that collide with system back gestures (left/right edge 20px on iOS/Android); keep custom swipe zones inside content. [K]
137. SHOULD: 1:1 tracking during drag, rubber-band at limits, velocity handoff on release. [apple-design local]
138. MUST: touch actions fire on pointer-up (not down) so users can slide off to cancel (WCAG 2.5.2 Pointer Cancellation). https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html [K]
139. SHOULD: long-press is never the only path (hidden on touch, undiscoverable). [K]

## P. Accessibility extras
140. MUST: focus not obscured by sticky headers/footers (WCAG 2.2 SC 2.4.11 Focus Not Obscured, AA): `scroll-padding` equal to bar height. https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html [K]
141. MUST: single-point alternatives, orientation not locked (SC 1.3.4), content works portrait and landscape. https://www.w3.org/WAI/WCAG22/Understanding/orientation.html [K]
142. MUST: Israeli standard IS 5568 is WCAG 2.0 AA based; WCAG 2.2 AA is a superset target. [israeli-accessibility-compliance local]

---

# 2. Viewport and device matrix to test
Portrait CSS px (width x height): 320x568 (SE1, WCAG reflow floor), 360x740 (small Android), 375x667 (SE2/3, 8), 390x844 (iPhone 12-15), 412x915 (Pixel/large Android), 430x932 (Pro Max), 600x960 (small tablet, M3 medium), 768x1024 (iPad portrait), 1024x768 (iPad landscape / small laptop), 1280x800 (desktop).
Extra: landscape phones (844x390, 667x375: small-height, sticky bars must not eat the screen), browser zoom 200% on 1280 (= 640 css) and 400% (= 320 css), text zoom 200%, fold devices (Galaxy Z Fold folded ~344x882, unfolded ~673x841 / ~882x1068; Surface Duo spans), RTL and LTR, light and dark, `prefers-reduced-motion`, `pointer: coarse`.
(Numbers for named devices are [K]; use Playwright's built-in device descriptors for exact values.)

---

# 3. Design tokens proposal (rounder modern admin)
All values are proposals, tuned to the checklist above; units css px unless noted.

```css
:root {
  /* spacing: 4px base */
  --space-0: 0;  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-5: 20px; --space-6: 24px; --space-8: 32px;
  --space-10: 40px; --space-12: 48px; --space-16: 64px;
  --gutter: 16px;                      /* >=600px: 24px */

  /* radius (concentric: inner = outer - padding) */
  --radius-xs: 6px;   /* badges, tiny chips */
  --radius-sm: 10px;  /* small buttons, tags */
  --radius-md: 12px;  /* inputs, buttons (44px high), list-group inner */
  --radius-lg: 16px;  /* cards, grouped lists */
  --radius-xl: 20px;  /* large cards, popovers */
  --radius-2xl: 28px; /* sheets (top corners), dialogs */
  --radius-full: 9999px; /* pills, switches, avatars, FABs */

  /* touch / size */
  --hit-min: 24px;       /* WCAG 2.5.8 AA legal floor */
  --hit-floor: 40px;     /* never below on coarse pointers */
  --hit: 44px;           /* default coarse target (Apple 44pt) */
  --hit-comfort: 48px;   /* primary controls, tab bar items (Material 48dp) */
  --target-gap: 8px;
  --row-h: 48px; --row-h-compact: 40px;
  --tabbar-h: 56px;

  /* type: rem sizes, 16px base */
  --text-micro: 0.6875rem; /* 11px: uppercase labels only, floor */
  --text-xs: 0.75rem;      /* 12px captions */
  --text-sm: 0.875rem;     /* 14px secondary, table cells (dense) */
  --text-base: 1rem;       /* 16px body, ALL inputs on touch */
  --text-lg: 1.125rem;     /* 18px */
  --text-xl: 1.25rem;      /* 20px section title */
  --text-2xl: 1.5rem;      /* 24px page title */
  --text-3xl: 1.875rem;    /* 30px */
  --lh-tight: 1.2; --lh-body: 1.5; --lh-dense: 1.35; --lh-he: 1.6;

  /* motion */
  --dur-instant: 80ms;  --dur-fast: 120ms;  --dur-base: 180ms;
  --dur-slow: 260ms;    --dur-sheet: 300ms;
  --ease-out: cubic-bezier(0.2, 0, 0, 1);       /* enter */
  --ease-in: cubic-bezier(0.4, 0, 1, 1);        /* exit */
  --ease-inout: cubic-bezier(0.4, 0, 0.2, 1);   /* move */
  --ease-spring: linear(0, 0.55 12%, 0.92 28%, 1.03 44%, 0.99 62%, 1); /* CSS linear() spring approximation, tune */

  /* elevation: layered ambient + direct, low alpha; dark uses lighter surface + border */
  --shadow-1: 0 1px 2px rgb(0 0 0 / .06), 0 1px 1px rgb(0 0 0 / .04);
  --shadow-2: 0 2px 6px rgb(0 0 0 / .07), 0 1px 2px rgb(0 0 0 / .05);
  --shadow-3: 0 8px 24px rgb(0 0 0 / .10), 0 2px 6px rgb(0 0 0 / .06);   /* popover */
  --shadow-sheet: 0 -8px 32px rgb(0 0 0 / .14);                          /* sheet */
  --border-hairline: 1px solid rgb(0 0 0 / .08); /* dark: rgb(255 255 255 / .10) */

  /* safe areas */
  --safe-b: env(safe-area-inset-bottom, 0px);
  --safe-t: env(safe-area-inset-top, 0px);
  --safe-l: env(safe-area-inset-left, 0px);
  --safe-r: env(safe-area-inset-right, 0px);
}
@media (pointer: coarse) { :root { --row-h: 52px; } }
@media (min-width: 600px) { :root { --gutter: 24px; } }
@media (prefers-reduced-motion: reduce) {
  :root { --dur-fast: 1ms; --dur-base: 1ms; --dur-slow: 1ms; --dur-sheet: 1ms; }
}
```
Breakpoints: 600 (medium: rail), 840 (expanded: list-detail), 1024 (permanent sidebar). Prefer container queries for components.
Notes: sheet corner radius 28 matches M3 extra-large [K]; Apple uses continuous corner curves [K]. Radix/Linear/Vercel look = low-alpha layered shadows, hairline borders, 8-12px control radii, 16px cards: [K], not fetched.

---

# 4. Automated checks to add to CI
Run with Playwright (Chromium; add WebKit project for iOS-shape checks, noting headless-here rAF caveat: use fixed waits / `polling: 500`). Matrix: widths 320, 360, 375, 390, 412, 430, 600, 768, 1024 x {LTR, RTL} x {light, dark}; plus one landscape 667x375 and a 200%-zoom emulation (`deviceScaleFactor` or `page.setViewportSize(640x400)` with `html{font-size:200%}`). Set `hasTouch: true, isMobile: true` for touch projects.

1. **No horizontal overflow**: for each route and viewport, assert `document.documentElement.scrollWidth <= innerWidth`; on failure list offending elements (`getBoundingClientRect().right > innerWidth`), excluding elements inside `[data-scroll-region]`. (Items 2, 3, 8)
2. **Touch-target size**: for every visible `a, button, input, select, textarea, [role=button|switch|tab|checkbox|menuitem]`, assert box >= 44x44 on coarse projects (fail < 40, warn < 44), and >= 24x24 or 24px-circle spacing exemption on all projects (WCAG 2.5.8). Overlap check between sibling hit boxes. (Items 25-28)
3. **Input font-size**: every `input, select, textarea` computed `font-size >= 16px` at width <= 768. (Item 15)
4. **Minimum font size**: walk text nodes, `getComputedStyle().fontSize >= 12px` (11px allow-list class `.text-micro`); flag any `< 11px`. (Item 96)
5. **Viewport meta**: assert content has `width=device-width`, `viewport-fit=cover`, and no `maximum-scale`/`user-scalable=no`. (Item 1)
6. **axe-core** (`@axe-core/playwright`) at 320, 390, 768, 1024 in both themes and directions, tags `wcag2a,wcag2aa,wcag21aa,wcag22aa` (includes `target-size`, `color-contrast`, `meta-viewport`, `label`, `aria-*`). Zero violations; allow-list with expiry. (Items 25, 104, 107)
7. **Reflow at 320**: at 320x256-ish and 640 css px with `html{font-size:200%}`, re-run checks 1, 2 and assert no element with `overflow:hidden` clips text (`scrollHeight > clientHeight` on text nodes). (Items 2-4, 97)
8. **Text-spacing stress**: inject the WCAG 1.4.12 CSS (line-height 1.5, letter .12em, word .16em, paragraph 2em) and assert no clipping/overlap (check 7 logic) plus screenshot diff. (Item 98)
9. **Logical-property lint** (stylelint `liberty/use-logical-spec` or `stylelint-use-logical`; or an `rg` test) failing on `margin-left|right`, `padding-left|right`, `left:|right:`, `text-align:(left|right)`, `float:(left|right)`, `border-left|right`, `ml-|mr-|pl-|pr-|left-|right-` Tailwind classes, allow-list per line. (Item 116)
10. **RTL render checks**: with `dir=rtl`, assert directional icons carry the mirror class (`[data-icon-dir] ` computed `transform: scaleX(-1)`), and `getBoundingClientRect` of the nav "back" button is on the inline-start (right) side. Screenshot baselines per direction. (Items 117, 118)
11. **Safe area / sticky bars**: emulate insets by injecting `:root{--safe-b:34px}` or use a WebKit device with notch; assert bottom bars' bottom padding >= 34px and no overlap with the last content item (scroll to bottom, assert last row bottom <= bar top). (Items 13, 83)
12. **Focus obscured**: tab through each page at 390x844, after each Tab assert `document.activeElement` rect is not covered by a fixed/sticky element (`elementFromPoint` at the center equals the element or a descendant). (Item 140)
13. **Keyboard avoidance (approximate)**: set viewport to 375x350 (simulated keyboard), focus last form field, assert it is inside `visualViewport` and not under the sticky action bar. (Items 16, 77)
14. **Reduced motion**: with `reducedMotion: 'reduce'`, assert computed `transition-duration`/`animation-duration` <= 10ms for tokens, and no `transform` changes on route transition (compare before/after bounding boxes at t+50ms). (Items 128, 129)
15. **Forbidden motion CSS lint**: grep for `transition: all`, animations of `width|height|top|left|margin`. (Item 127)
16. **Contrast beyond axe**: computed-style script checks icon-only buttons and focus ring against background >= 3:1; optionally APCA Lc via `apca-w3`. (Items 104, 105)
17. **Form attribute audit**: every `input` has `name`, `autocomplete` (except explicitly `off`), `type`/`inputmode` for email/tel/number/url; every field has an associated label; every error has `aria-describedby`. (Items 69-76)
18. **State coverage test**: per list route, Playwright route-mocks produce empty, loading (delayed), error (500) and long-content responses; assert presence of designed state selectors (`[data-state=empty|loading|error]`) and zero CLS (`PerformanceObserver` layout-shift sum < 0.05 during load). (Items 87, 88)
19. **Hover-only guard**: stylelint rule or script: `:hover` rules must sit inside `@media (hover: hover)`; fail otherwise. (Item 21)
20. **Visual regression**: Playwright `toHaveScreenshot` for key screens (settings, table card-reflow, record detail, sheet open, form with errors) at 320, 390, 768 x LTR/RTL x light/dark; mask dynamic data.
21. **Pointer gestures**: for each swipe-action row, test asserts the overflow-menu equivalent exists and is operable by click and keyboard. (Items 53, 54, 134)
22. **Real-device smoke (manual or BrowserStack, not CI-gating)**: iOS Safari keyboard, dvh/toolbar, safe areas; Android Chrome URL bar. Headless Chromium here cannot show these. (Items 17, 23)

Box caveat: headless Chromium emits ~1 rAF per 40 s here; do not rely on `waitForFunction` default polling, use `{ polling: 500 }` or fixed waits.

---

# 5. Sources fetched this session (2026-11-13) [F]
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
- https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html
- https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- https://developer.mozilla.org/en-US/docs/Web/CSS/env
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/any-pointer
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode
- https://web.dev/blog/viewport-units
- https://web.dev/articles/prefers-reduced-motion
- https://developer.chrome.com/blog/viewport-resize-behavior
- https://developer.android.com/develop/ui/compose/layouts/adaptive/support-different-screen-sizes (its window-size-class page was not fetched)
- https://www.nngroup.com/articles/mobile-tables/ , /touch-target-size/ , /bottom-sheet/ , /confirmation-dialog/
- https://design-system.service.gov.uk/patterns/validation/
Not fetched / not rendered (numbers are [K]): Apple HIG (layout, toggles, lists), Material 3 (shape, navigation, easing), WCAG 2.5.x and 2.4.11 pages, APCA site, MDN View Transitions, Polaris, Carbon, Primer, Atlassian, Smashing.
