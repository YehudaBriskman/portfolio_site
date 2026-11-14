# Admin design guide

**The single source of truth for how the admin looks and behaves on a phone.** Read it before you change anything under `/admin`. It is a living reference, not a task list: work is tracked as issues (#669 to #683 for the phone series), and if something here stops being true, change it in the same PR.

`MUST` fails review. `SHOULD` needs a reason in the PR to skip. Every rule carries its *why*, because a rule without one gets argued away.

Where the numbers came from: [principles](design/2026-11-13-mobile-design-principles.md), [data density](design/2026-11-14-mobile-data-density.md), [reference patterns](design/2026-11-14-reference-patterns.md), [importance research](design/2026-11-14-importance-scoring.md). Appendices are history; if they disagree with this guide, the guide wins. Guard tests keep the catalogue below honest (`web/src/components/ui/adminDesignGuide.guard.test.ts`).

---

## 1. Principles and the importance-scoring method

### 1.1 Principles

1. **One screen, one question.** A phone row answers *which one do I open, and does it need me?* Detail belongs one tap away. *Why:* a phone shows about 60 characters per line and 5 to 7 rows; every extra fact costs a row.
2. **Show exceptions, not the norm.** Published, Ready, Active, Mailable draw nothing. Only problems, warnings and "needs you" are drawn. *Why:* a calm value coloured green teaches the eye to ignore colour, and the one red thing is lost (data-display skill; NN/g: "if everything is contrasted, nothing stands out").
3. **Encode, do not write.** Status is a glyph plus a hidden word; time is relative with the full date on `title`; counts are a bar. *Why:* an icon is read in one fixation, a sentence in six.
4. **Say it once.** A datum appears once per view. *Why:* duplicates make people compare them (NN/g).
5. **Two levels, no more.** Row, then one sheet. A sheet never opens a sheet. *Why:* NN/g progressive disclosure: three levels lose people.
6. **Colour is never the only channel**, and at most one coloured glyph sits on a row.
7. **Leading side first.** Order by importance from the inline-start edge and the top; it mirrors in RTL (Apple HIG, Layout: "place the most important items near the top and leading side").
8. **A gesture is a shortcut, never the only path.** Long-press, swipe and drag each have a visible control. (WCAG 2.5.1, 2.5.7.)
9. **Use what exists.** Native element, then a Radix primitive, then a component from section 3, then hand-rolled. A new component needs a catalogue row (the guard test enforces it for `components/ui`).

### 1.2 The importance-scoring method

Run it on **every field a screen shows**, before drawing anything. It takes five minutes and ends the "show it just in case" argument.

**Step 1. Name the job.** One sentence, "When I ___, I need to ___": *"When I open the Inbox, I need to find what is new on the site that I should post."* A field that serves no job is tier 4.

**Step 2. Score four things, each 1 to 3.**

| Factor | 1 | 2 | 3 | Asks |
|---|---|---|---|---|
| **F**requency of need | rare (a few times a year) | weekly | nearly every visit | how often does the owner need this *to do the job*? |
| **C**onsequence of missing it | nothing happens | rework or a wasted trip | a wrong send, lost data, a legal problem | what breaks if the owner does not see it? |
| **U**rgency | any time | today | now, something waits on it | how soon must they act on it? |
| **R**eversibility of the mistake | undone in one tap | undone with effort | cannot be undone (an email sent, a post published) | how bad is acting without it? |

**Step 3. Multiply: `score = F x C x U x R` (1 to 81).**

| Score | Tier | Home | Budget |
|---|---|---|---|
| **>= 12** | **1 always visible** | the row or the screen itself | row: title + at most 2 facts + 1 glyph |
| **4 to 11** | **2 one tap** | BottomSheet, Disclosure, row detail | one sheet deep |
| **<= 3, and it is a setting or tool** | **3 settings / advanced** | SettingsList group, Advanced `Disclosure` | not on a list screen |
| **<= 3, and derivable, repeated or unused** | **4 remove** | nowhere | delete it |

**Step 4. Apply the five overrides** (they beat the number):

1. **Identity is tier 1.** The field that tells rows apart (title, email, campaign name) is always shown, wrapped not truncated (Polaris: rows that start the same look identical when cut).
2. **Exception promotion.** A *normal* value draws nothing (score it as tier 4). An *abnormal* one that blocks the job is promoted to tier 1 as **one glyph**. Score the abnormal case.
3. **Actions are scored for reach, not for row placement.** A row has no buttons; the best an action can score is tier 2 (sheet footer, one tap). Irreversible actions (R = 3) are never one accidental tap.
4. **Duplicates lose.** When two fields say the same thing (status word beside status glyph) the one with the lower score is tier 4.
5. **The budget wins.** If more than 2 facts + 1 glyph qualify for tier 1, demote the lowest score. A tie goes to the one with the higher **U**.

A tier-2 or tier-3 field with a low score that nobody acts on is tier 4. Ask: *"What decision does this change?"* If there is none, delete it.

### 1.3 Worked examples (real screens, before the phone series)

Row contents are read from code at `b938c9f`. Score shown as F-C-U-R.

**A. Marketing Inbox row** (`announce/inbox/InboxRow.tsx`). Job: *find what is new that I should post.*

| Field today | F-C-U-R | Score | Tier | Result |
|---|---|---|---|---|
| Title (2-3 lines) | identity | n/a | 1 | keep, clamp to 2 lines |
| "New" tag | 3-3-3-1 | 27 | 1 | an 8px dot, sr-only "new" |
| Posted state per channel (4 empty circles) | 3-3-2-3 | 54 | 1 | four brand glyphs, filled = posted (`ChannelRow`) |
| Relative time | 3-2-2-1 | 12 | 1 | keep, `title` has the date |
| Readiness problem ("Long description") | 2-3-2-2 | 24 | 1 (exception) | one `TriangleAlert` glyph, only when there is a problem |
| "Ready" pill, normal case | 3-1-1-1 | 3 | 4 | draw nothing |
| Problem *name* as a chip word | duplicate of the glyph | n/a | 4 here, 2 in the sheet | listed by name in the sheet |
| Caption, language, previews | 2-2-1-1 | 4 | 2 | sheet body |
| Copy LinkedIn / Copy X buttons | 3-1-2-1 | 6 | 2 | sheet footer (override 3: no buttons in rows) |
| Mark posted | 3-2-2-3 | 36 | 2 | sheet footer, deferred commit with Undo |
| Kind icon | row template | n/a | chrome | leading icon, not a fact |

Result: 7-8 text facts and 2 buttons become title + time + dot + 4 glyphs, 0 buttons.

**B. Audience contact row** (`announce/audience/AudienceTab.tsx`). Job: *who is this, can I mail them?*

| Field today | F-C-U-R | Score | Tier | Result |
|---|---|---|---|---|
| Email | identity | n/a | 1 | `dir="ltr"`, wraps by segment, never truncated |
| Cannot be mailed (pending, unsubscribed, blocked) | 3-3-2-3 | 54 | 1 (exception) | one distinct glyph per state |
| Mailable, normal case | 3-1-1-1 | 3 | 4 | draw nothing |
| Status word | duplicate of glyph | n/a | 4 | name is sr-only and in the sheet |
| Why-sentence (consent record) | 1-3-1-2 | 6 | 2 | contact sheet |
| Groups | 2-2-1-1 | 4 | 2 | contact sheet |
| Language | 1-2-1-2 | 4 | 2 | contact sheet |
| Name | 2-1-1-1 | 2 | 2 (acted on when identifying) | contact sheet |
| Signup date | repeats the consent record | n/a | 4 | merged into the consent record |
| Edit button | 2-1-1-1 | 2 | 2 | whole row opens the sheet; Edit is in it |
| Search + Group + Status + Language + 3 buttons above the list | 3-2-1-1 / 1-1-1-1 | 6 / 1 | 2 / 3 | search stays; the three selects go to `FilterSheet`; Add/Import/Export under one "+" |

Result: 4 facts per row become email + 0 or 1 glyph. About 7 rows fit instead of 3.

**C. Campaign list row** (`announce/campaigns/CampaignsTab.tsx`). Job: *is anything sending, did it go out, did it go wrong?*

| Field today | F-C-U-R | Score | Tier | Result |
|---|---|---|---|---|
| Name | identity | n/a | 1 | keep |
| Lifecycle (draft, scheduled, sending, sent) | 3-3-3-3 | 81 | 1 | 4-step stepper glyph, replaces the pill |
| Sent / total while sending | 2-3-3-3 | 54 | 1 (exception: only while active) | `MiniBar` + one number |
| Failed count when > 0 | 2-3-3-2 | 36 | 1 (exception) | one danger glyph with the number |
| Relative time | 3-2-2-1 | 12 | 1 | keep |
| Subject line | 2-1-1-1 | 2 | 2 | campaign sheet |
| Skipped, start and finish times | 1-1-1-1 | 1 | 2 / 4 | sheet (skipped); finish time kept, start derivable (4) |
| Sent / failed / skipped columns (hidden under md today) | 1-1-1-1 | 1 | 4 on phones | already hidden: now removed, counters live in the sheet |

Result: 4-5 facts become name + stepper + time (+ bar while sending).

### 1.4 What the research says (one paragraph each, sources in the appendix)

- **Hierarchy is contrast, not decoration.** Size, weight, colour and position rank things; use at most three contrast treatments and two large elements (NN/g, *Visual hierarchy*, fetched 2026-11-14). Weight and colour do more work than size (interface-design skill).
- **Proximity groups.** Close means related; space separates groups; borders sparingly (NN/g; Apple HIG Layout, fetched 2026-11-14).
- **Reading order is the importance order.** People scan top to bottom and from the leading edge; the F-pattern holds on mobile and mirrors in RTL; front-load the informative word (NN/g, *F-shaped pattern*, 2026-11-14; *Inverted pyramid*, 2026-11-14; Apple HIG Layout).
- **Frequency decides what is first-level.** Frequently used features on the initial display, rare ones secondary; two levels at most (NN/g, *Progressive disclosure*, 2026-11-14). Our F factor is that sentence made countable.
- **De-emphasise to emphasise.** Lighten and shrink the secondary, remove boxes around it; labels are quieter than values (Refactoring UI, via secondary summaries only; the book was not fetched, treat as a lead).
- **Test it.** Squint test: blur the screen, the one thing that matters must still read (NN/g; interface-design skill).

---

## 2. Phone budget numbers

All numbers are CSS px at 320 to 430 wide unless stated. They are **testable**: the tests and scripts in section 7 read them.

| Thing | Number | Why |
|---|---|---|
| Facts beside the title in a row | **<= 2** | a third belongs in the sheet (Apple/Material rows carry 3 items incl. status) |
| Status glyphs per row | **<= 1** coloured | one exception is visible, two are noise |
| Buttons inside a row | **0** (a checkbox in selection mode only) | the whole row is the tap target |
| Title lines | **<= 2** (`line-clamp`), wrap, never ellipsis a lone identifier | identity must stay readable |
| Row height | **min 56** (`3.5rem`), never < 44 | M3 two-line list item 72, one-line 56; Apple 44 |
| Visible primary actions per list page | **<= 1** (rest under "+" or "...") | one focal point |
| Visible filter affordances | **<= 2** (search + Filters button) plus the chips row | the audience screen spent a full screen on controls |
| Settings row label | **1 line**; help behind an info button; only warnings visible | "a lot of data telling me nothing" |
| Touch target | **44 x 44**; hard floor **40**; WCAG AA floor **24** | Apple 44, WCAG 2.5.8 AA 24, 2.5.5 AAA 44 |
| Gap between adjacent targets | **>= 8** | NN/g touch target size |
| Text carrying meaning (hints, meta, `th`, `time`, pills) | **>= 14** (`--a-fs-meta: .875rem`) | `readability.guard.test.ts` |
| Ornament text | 12; **nothing under 11** | Apple minimum 11 |
| Inputs, selects, textareas on touch | **>= 16** | iOS zooms the page on focus below 16 |
| Body text | 14 in the admin (`.a-app`), 16 for form fields | density chosen on purpose |
| Page gutter | 16 (24 from 600) | Apple/Material margins |
| Spacing | 4px steps: `--a-s-1` .25rem to `--a-s-8` 2rem | one scale, rem so text zoom scales it |
| Radius | `--a-r-tiny` 6, `--a-r-sm` 10, `--a-r-ctl` 12, `--a-r-box` 16, `--a-r-sheet` 24, `--a-r-pill` 999 | concentric: inner = outer - padding (`adminShape.guard.test.ts`) |
| Elevation | `--a-shadow-1..3`; dark uses a line, not a shadow | shadows barely read on dark |
| Sheet snap heights (planned, #669) | **peek** content up to 30dvh (min 168), **half** 55dvh, **full** 92dvh | a strip of page behind it reads as a sheet |
| Sheet at >= 600 | centred dialog, max 560 | principle 68 |
| Handle | 44px-tall button around a 36 x 4 pill; Enter cycles snaps | WCAG 2.5.7; Apple grabber tap cycles detents |
| Sheet footer | sticky, `padding-block-end: calc(var(--a-s-3) + env(safe-area-inset-bottom))` | clear of the home indicator |
| Sticky bars | static when viewport height < 480 | landscape phones lose the screen |
| Toast | announced once (`status` good news, `alert` errors); **>= 5s**, error with an action **>= 12s**, Undo **>= 8s**, pauses on hover, focus, touch and hidden tab; top on < 600, bottom-right on desktop | WCAG 2.2.1; `lib/toast` |
| Press feedback | `scale(.97 to .98)`, **100 to 160ms** | feels instant under 100ms (NN/g) |
| `--a-dur-fast` / `base` / `sheet` | **120 / 180 / 280 ms** | micro, popover, sheet |
| Enter easing `--a-ease-out` | `cubic-bezier(.2, 0, 0, 1)` | decelerate in |
| Move easing `--a-ease-inout` | `cubic-bezier(.4, 0, .2, 1)` | both ends |
| Exit | about 30% faster than enter; `cubic-bezier(.4, 0, 1, 1)` (not yet a token) | leaving should not linger |
| Stagger | 30 to 80ms, total under 400ms | longer reads as slow |
| Long-press | 450ms, cancelled by > 8px movement | never the only path |
| Rows before virtualising | 50 | WIG |

Viewport matrix to test: 320x568, 360x740, 375x667, 390x844, 412x915, 430x932, 600x900, 768x1024, 1024x768, 1440x900, landscape 844x390, 200% zoom (640x450). Both directions, both themes.

---

## 3. Component catalogue

Status: **exists** = on `main` today. **planned** = an open issue; do not copy a pattern from another screen, wait for it or build it as that issue says, so there is one implementation. Import with the `@/` alias.

### 3.1 On main

| Component | Import | Use it for | Do not use it for |
|---|---|---|---|
| `Disclosure`, `DisclosureButton` | `@/components/ui/Disclosure` | every expander. `Disclosure` wraps `<details>`/`<summary>` (chevron, 44px summary, RTL mirror, one-line `meta`); `DisclosureButton` is the `aria-expanded` + required `aria-controls` toggle for non-`details` regions | a raw `<details>` (guard test `disclosure.guard.test.ts` fails), a second level inside a sheet |
| `Action` | `@/components/ui/Action` | the site's primary call-to-action button (`solid`, `outline`, `text`) | admin controls (use `.a-btn`) |
| `button` | `@/components/ui/button` | shadcn-style button primitive | rows |
| `popover` | `@/components/ui/popover` | small anchored content: an info popover (planned `InfoPopover` wraps it) | long content (use a sheet) |
| `dropdown-menu` | `@/components/ui/dropdown-menu` | the "..." menu of secondary actions on desktop | the only path to an action on touch rows |
| `Select` | `@/components/ui/Select` | a single choice from a short list | more than ~8 options (searchable multi in `FilterSheet`) |
| `toast` service (#724) | `@/lib/toast` (API) and `@/components/ui/ToastHost` (the one renderer, mounted once by `ToastMount` in `App.tsx`; do not mount another) | the **transient result of an action**: `toast.success/info/warning/error/loading/promise`, `toast.undoable({ title, commit, onUndo })` (the Undo window: commit held back, runs on timeout, dismiss, pagehide or a newer job), `id` to replace in place (never stack a storm), `description` (one short line), `details` (long text behind a **Details** button), `action` / `secondary` (Undo, Retry, View), `help: { topic }` (a typed "Learn more" link to /help#topic; ids live in `lib/toast/helpTopics.ts` and a test fails if the section is missing), `persistent`. Modal-safe: it mounts inside an open `<dialog>`, so it is reachable over a sheet. `useToastHistory()` feeds the Notifications bell in the top bar (session only, last 30, never the details). `setToastAvoid(px)` keeps the desktop stack clear of a fixed bar | form validation, a state the user must fix or keep seeing (inline), a decision (a sheet or dialog); a second toast library; `import "sonner"` anywhere but `ToastHost` (guard test) |
| `ToastHost`, `ToastMount` (#724) | `@/components/ui/ToastHost`, `@/components/ui/ToastMount` | see the `toast` service row: the renderer (sonner) and where it is mounted | raising a toast (use `@/lib/toast`) |
| `BottomSheet` (#669) | `@/components/ui/BottomSheet` | detail, filters, bulk actions: short and transient. Native `<dialog>`, opens at half and pulls to full (optional peek), Back closes it, Esc and backdrop and drag-down close it, focus returns to the opener, one at a time; the handle is a 44px button (Enter/arrows resize) | a long flow gets a page; never a sheet opening a sheet |
| `RecordRow` (#669) | `@/components/ui/RecordRow` | every phone list row: icon, title, <= 2 facts (`MAX_FACTS`), 1 status, chevron; the whole row is one button named by `openLabel` | buttons inside it |
| `StatusGlyph` (#669) | `@/components/ui/StatusGlyph` | a status as shape + tone + hidden word (`withWord` in sheets); published / active / mailable / translated draw nothing unless `showDefault`. `kind="attention"` with `label` (its own words, e.g. "Long description") and `tone` is the one-glyph "something is wrong here" a row shows instead of a "Ready" pill; `kind="used"` is the link glyph on a media tile that something uses | colour alone, two on a row |
| `ChannelIcon`, `ChannelRow` (#669) | `@/components/ui/ChannelIcon` | LinkedIn / X / Instagram / email in fixed order, filled with a check = posted, outline = not yet; brand paths in `channelGlyphs.ts` (simple-icons, CC0) | any other order |
| `ICON`, `CONCEPTS` (#669) | `@/components/ui/icons` | the vocabulary in section 4; words (he + en) in `useMobileWords().icons` (`i18n/mobile.ts`); `icons.test.ts` fails on a concept without a word | an icon with no concept row |
| `Journey`, `LifecycleStepper` (#672) | `@/components/ui/Journey` | from > to with optional waypoints and a `via` pill (sender > audience); a vertical lifecycle (draft > scheduled > sending > sent) with the current step announced and paused/failed/canceled as a side branch | a graphic with no text: every fact is also in the list |
| `MiniBar` (#672) | `@/components/ui/MiniBar` | counts as a segmented inline bar, `role="img"` with a text name; danger is hatched | the only place a decision number appears: keep the number visible |
| `Gauge` (#672) | `@/components/ui/Gauge` | a budget against a limit as a ring, warn at 70 / danger at 90 percent; level in colour, badge glyph and words, value in a hidden `<meter>` | colour-only status |
| `SidebarNav`, `SidebarGroup` (#675) | `@/components/ui/SidebarGroup` | hierarchical drawer and sidebar nav (the tree is `components/admin/adminNav.ts`): a group with an address is a link plus its own 44px `DisclosureButton` chevron, one without is a single toggle; groups nest two deep, the current link has `aria-current`, the route's groups open on their own, open state is remembered per viewer. APG disclosure navigation, not a tree role: Tab works as on any page, Up/Down/Home/End walk visible rows, inline-end/inline-start open and close (swapped in RTL). Below 600px (`usePhone`) the drawer carries Marketing's sections and the hub's tab strip is gone | a second nav, or a flat list of more than ~7 links |
| `Switch` (#673) | `@/components/ui/Switch` | an on/off setting that applies at once: native `<input role="switch">`, whole 44px row is the target, label on one line, optional ONE-line `hint` as its description, thumb moves with logical properties | a checkbox for on/off; a multi-line explanation (use `InfoPopover`) |
| `InfoPopover` (#673) | `@/components/ui/InfoPopover` | the long help for a setting: a 44px info button opening the popover, help in the DOM only while open, Esc / outside press close it and focus returns to the button | hover-only help; help a user must read to decide (say it in the label) |
| `SettingsRow` (#673) | `@/components/ui/SettingsRow` | one line in a settings list: `switch` (label + Switch + info button, first sentence of the help as description), `value` (label + current value + chevron) or `link` (icon tile + name + one live summary line + chevron); only a `warning` shows extra text | a paragraph of help under a control |
| `SettingsList`, `groupSurface` (#673) | `@/components/ui/SettingsList` | inset grouped list, one row per group with a live summary; a group opens as a half `BottomSheet` (4 controls or fewer, no text field) or a sub-page (more, or any text field); two panes from 840px; `openId` / `onOpenChange` are the caller's, so the URL can hold them | a flat page of every control |
| `SettingsSearch`, `matchItems` (#673) | `@/components/ui/SettingsSearch` | the one search field above a settings list: label + help matching, a `role=status` count, "Clear search" on an empty result; results read "Group > Label" and open the group on that row | filtering data records (use `FilterChips`) |
| `FilterChips`, `FiltersRestoredNote` (#674) | `@/components/ui/FilterChips` | the row above a list: 3 to 5 common filters as one-tap toggle chips (`aria-pressed`, a tick when on), a "Filters" button with the active count (a multi counts once, the sort never), Clear all while any filter is on, and a removable chip for an active filter that has no chip. A toolbar: one tab stop, arrows mirror in RTL, the chips scroll sideways behind an edge fade and the button never scrolls away | a row of more than ~5 chips: the rest belong in the sheet |
| `FilterSheet` (#674) | `@/components/ui/FilterSheet` | every filter in a `BottomSheet`: segmented (radios), multi-select (checkboxes, search above 8 options, select all/none), date range (two native dates, presets, refuses end before start), sort. Choosing edits a draft; "Show N results" applies and N follows the draft live; Reset empties the draft; Close/Esc/Back discard | applying on every tap: the list behind must not jump |
| `useSavedFilters`, `filters.ts` (#674) | `@/components/ui/useSavedFilters` | a screen's filters kept in the address (the truth; defaults are never written; other params untouched), plus `localStorage` `admin.filters.<screen>` as a per-viewer convenience (try/catch everywhere). An empty address restores the last set and `restored` drives "Filters restored" + Undo | reading storage first: a shared link must win |
| `SelectionHeader`, `SelectionBar` (#671) | `@/components/ui/SelectionBar` | select mode on a list. The header button is always visible ("Select", then "Done", plus select all / none); long-press on a row (`RecordRow onLongPress`) is a bonus. The bar is sticky at the bottom (above `--a-bar-h` and the safe area, static under 480px height): count in a polite live region, the first action as the primary button, "More" opening a `BottomSheet` of every action with its item count. A `destructive` action never runs on one tap: a confirm sheet names object and count ("Delete 3 posts") beside "Keep"; destructive rows sort last | a bar with no Select button; a destructive action without `confirm` |
| `useSelection` (#671) | `@/components/ui/useSelection` | the mode and the chosen ids: `on`, `enter(id?)`, `exit`, `toggle`, `has`, `all`, `none`, `count`, `ids`. Escape and Back leave the mode (an open sheet takes Escape first); a filter change drops chosen rows that are no longer listed | holding ids the user cannot see |
| `UndoToast`, `useUndoable` (#671) | `@/components/ui/UndoToast` | an Undo window over a deferred action: `schedule({ message, commit, onUndo })` shows the toast and holds `commit` back; Undo cancels it. Never under 8 s, pauses on hover and focus, `role="status"` mounted ahead so it is announced, commits on `pagehide` and unmount, one at a time. This is how an irreversible server action gets an Undo | new code (use `toast.undoable`, same semantic; the four phone screens move over in #724 slice b); an error the user must act on |
| `Presence` (#709) | `@/components/ui/Presence` | a surface that appears and leaves by `show`: keeps the last children while it leaves (`data-state="closed"`, `inert`, `aria-hidden`), rises and falls on phones only; `UndoToast` and `SelectionBar` use it | a dialog (use `BottomSheet`), anything that must unmount at once |
| `SheetPresence` (#709) | `@/components/ui/SheetPresence` | wraps a `BottomSheet` its parent draws as `{x && <Sheet open>}`: `<SheetPresence show={x}>` keeps it mounted for the exit on a phone (the sheet is told it is closed) | a sheet already drawn with `open={x}` (it leaves by itself) |
| `tooltip` | `@/components/ui/tooltip` | a hint for pointer users | the only label of anything: touch has no hover |

Also on main, outside `ui/`: `usePhone()` (`@/hooks/usePhone`; true under 600px, the one breakpoint a phone screen switches its layout on, so a phone never mounts the desktop list), the Posts and Areas phone screens (`components/admin/posts/`: a row opens the editor; bulk is Move to drafts and Archive, both behind `UndoToast`, and never Publish, which is decided in the review one note at a time; `ReviewDialog` is a sheet below 600px: what changes, the diff, then closed Disclosures), the Inbox's phone screen as the worked example of a migrated list (`announce/inbox/InboxPhoneRow.tsx` rows, `InboxSheet.tsx` for the Composer in a `BottomSheet`; an **Undo** inside a modal sheet is drawn in the sheet, because a toast outside a top-layer `<dialog>` is inert while it is open), the Media library's phone screen as the worked example of a **grid** (`MediaPhone.tsx`: square tiles, one button each, named by alt text and state; `AdminMedia.tsx` `MediaDetail` draws the item sheet with the alt text first, where it is used second and the facts in a closed `Disclosure`; bulk delete lists unused items only and goes through `UndoToast`), the admin shell and `.a-*` classes (`@/components/admin/AdminShell`), `StatusPill` and `TranslationPill` (`@/components/admin/StatusPill`, `.../TranslationPill`; being replaced by `StatusGlyph`), the native-`<dialog>` modals (`@/components/admin/MediaGrid` `Modal`, `announce/audience/Modal`, the popup system in `styles/popup.css`; see `docs/motion-contract.md` section 9).

### 3.2 Planned (phone series)

| Component | Issue | Import (planned) | Use it for | Rule of thumb |
|---|---|---|---|---|

Migrations that consume them: #670 Inbox, #676 Campaigns, #677 Audience, #678 Marketing Settings, #679 Library, #680 Posts and Areas, #681 Media, #682 Overview and Connections and Translations, #683 Projects and the save bar. The first phone screen is the Inbox. The content editors (`/admin/projects`, `/story`, `/site-copy`, #683) are the worked example of a long form on a phone: `Section` becomes a closed-by-default group (`aria-expanded` toggle, opens itself on an error), `TextField` shows one language chosen by `LangSwitch`, `ListField` hides move and remove behind a Reorder button (`content/Reorder.tsx`), and `EditorFrame` holds the leave guard.

### 3.3 When to use which

| You need to... | Use |
|---|---|
| show one record in a list | `RecordRow` (never a `<table>` below 600) |
| show more of a record | `BottomSheet`, half snap; full only for editing |
| hide rarely used fields in a page | `Disclosure`, closed, with a one-line `meta` |
| show a status | `StatusGlyph`; the word only in a sheet |
| explain a setting | `InfoPopover` (never a paragraph under the checkbox) |
| turn something on or off | `Switch`, applies at once, with Undo toast on failure |
| tell the result of an action | **toast** if it is transient (saved, copied, sent, failed with Retry); **inline** if the user must fix it or keep seeing it (a field error stays inline and focused); **sheet or dialog** if it needs a decision. Never auto-dismiss text a visitor must read |
| edit several fields | a sub-page with Save, not a switch |
| filter a list | `FilterChips` + `FilterSheet` |
| act on many rows | `SelectionBar` |
| show progress or a budget | `MiniBar`, `Gauge` |
| show from > to | `Journey` |
| confirm a destructive act | name the object and count in the buttons: "Delete 3 posts" / "Keep" |

---

## 4. Icon vocabulary

**One concept, one icon, everywhere.** lucide-react, 16 / 20 / 24px, stroke 2 (1.75 at 16), `aria-hidden` unless the icon is the only content (then `role="img"` and a name). Directional icons (chevrons, arrows) mirror in RTL; clocks, checks, play, brand marks and charts do not. A new icon needs a row here first. Labels are the he + en names; the Hebrew labels are a draft to confirm against the translations glossary. lucide has no LinkedIn, Instagram, X or Facebook icons: `ChannelIcon` (#669) draws inline SVGs for LinkedIn, X and Instagram (email is the lucide `Mail`).

| Concept | Icon | en | he |
|---|---|---|---|
| Note / post | `FileText` | Note | פוסט |
| Release | `Rocket` | Release | גרסה |
| Project | `FolderKanban` | Project | פרויקט |
| Area | `Shapes` | Area | תחום |
| Story | `User` | Story | סיפור |
| Home page | `Home` | Home page | דף הבית |
| Announcement | `Megaphone` | Announcement | הודעה |
| Image / video | `Image` / `Film` | Image / Video | תמונה / וידאו |
| Connected app | `Plug` | Connected app | אפליקציה מחוברת |
| Read and write / read only | `KeyRound` / `Eye` | Read and write / Read only | קריאה וכתיבה / קריאה בלבד |
| Draft | `PenLine` | Draft | טיוטה |
| Unpublished changes | `CircleDot` | Unpublished changes | שינויים שלא פורסמו |
| Published, mailable (only on request) | `CircleCheck` | Published | פורסם |
| Scheduled | `CalendarClock` | Scheduled | מתוזמן |
| Sending | `Send` | Sending | בשליחה |
| Sent | `CheckCheck` | Sent | נשלח |
| Paused | `Pause` | Paused | מושהה |
| Failed | `CircleX` | Failed | נכשל |
| Archived, canceled | `Archive` | Archived | בארכיון |
| Needs attention | `TriangleAlert` | Needs attention | דורש תשומת לב |
| Hidden | `EyeOff` | Hidden | מוסתר |
| Revoked / expired | `Ban` / `Hourglass` | Revoked / Expired | בוטל / פג תוקף |
| New / unread | an 8px dot (not an icon) | New | חדש |
| Loading | `Loader` (static under reduced motion) | Loading | טוען |
| Contact | `UserRound` | Contact | איש קשר |
| Mailable | `MailCheck` | Can be mailed | ניתן לשלוח |
| Waiting to confirm | `Hourglass` | Waiting to confirm | ממתין לאישור |
| Unsubscribed | `MailX` | Unsubscribed | ביטל הרשמה |
| Blocked from mail | `ShieldBan` | Blocked from mail | חסום לדיוור |
| Group | `Users` | Group | קבוצה |
| Language | `Languages` | Language | שפה |
| Contact source: site signup / added by hand / CSV import (lead icon of a contact row; the word is in the sheet's consent record) | `Globe` / `UserPen` / `FileUp` (`announce/audience/sourceIcon.ts`) | Site signup / Added by hand / CSV import | הרשמה באתר / נוסף ידנית / ייבוא CSV |
| Hebrew missing / out of date / draft / unverified / done | `CircleDashed` / `RefreshCw` / `PenLine` / `CircleHelp` / `Check` on an "עב" badge | Hebrew missing / out of date / draft / unverified / done | עברית חסרה / לא עדכנית / טיוטה / לא מאומתת / הושלמה |
| Email | `Mail` | Email | אימייל |
| LinkedIn / X / Instagram | `ChannelIcon` (inline SVG) | LinkedIn / X / Instagram | לינקדאין / X / אינסטגרם |
| From / to | `Mail` or `AtSign` / `Users` | From / To | מאת / אל |
| When | `Clock` | When | מתי |
| Direction | `ArrowRight` (mirrors) | to | אל |
| Mail budget, sending limits | `Gauge` | Mail budget | תקציב דיוור |
| Sent / failed / skipped | `Check` / `CircleX` / `MinusCircle` | Sent / Failed / Skipped | נשלח / נכשל / דולג |
| Used in N places / unused | `Link2` + number / `Unlink` | Used in N places / Not used | בשימוש ב-N מקומות / לא בשימוש |
| Settings: everyday | `SlidersHorizontal` | Everyday | יומיומי |
| Settings: channels | `Radio` | Channels | ערוצים |
| Settings: sender and delivery | `Send` | Sender and delivery | שולח ומשלוח |
| Settings: alerts | `Bell` | Alerts | התראות |
| Settings: advanced | `Wrench` | Advanced | מתקדם |
| Help / info | `Info` | About this setting | על ההגדרה |
| Search | `Search` | Search | חיפוש |
| Open a row | `ChevronRight` (mirrors) | Open | פתח |
| Expand / collapse | `ChevronRight` rotating (as `Disclosure`) | Expand | הרחב |
| Copy | `Copy` | Copy | העתק |
| Open external | `ExternalLink` | Open in new tab | פתח בלשונית חדשה |
| Mark posted | `CircleCheck` | Mark posted | סמן כפורסם |
| Select / select all | `ListChecks` / `SquareCheckBig` | Select / Select all | בחירה / בחר הכול |
| Filter / sort | `SlidersHorizontal` / `ArrowUpDown` | Filter / Sort | סינון / מיון |
| Clear filters | `FilterX` | Clear all | נקה הכול |
| Add | `Plus` | Add | הוספה |
| More | `Ellipsis` | More actions | פעולות נוספות |
| Delete | `Trash2` (danger) | Delete | מחיקה |
| Undo | `Undo2` | Undo | ביטול פעולה |
| Reorder | `GripVertical` + a Move up/down menu | Move | הזזה |
| Restore version | `History` | Restore | שחזור |
| Close | `X` | Close | סגירה |

Tones: four only. Neutral `--ink-soft`, ok `--signal`, attention `--ink` with a dashed outline, danger `--destructive-ink`.

---

## 5. RTL and Hebrew rules

1. **MUST** `dir="rtl"` and `lang="he"` on `<html>` for `/he`; admin text comes from the words files in both languages (no hard-coded English: `AdminCollection`, `AdminAreas`, `AdminConnections`, `AdminTranslations` had some). *Why:* an English string in the Hebrew admin is a bug the owner sees daily.
2. **MUST** logical CSS only: `margin-inline`, `padding-block`, `inset-inline-start`, `text-align: start`. *Why:* `left`/`right` is how a 9999px scroll appeared in RTL (`.a-skip`).
3. **MUST** mirror directional icons (chevrons, arrows, back); never mirror clocks, checks, play, brand glyphs, charts. Never type `←` or `→` into a label: draw the icon and put `className="a-mirror"` on the `<svg>` (`.a-mirror:dir(rtl)` is `scaleX(-1)`); a component's own chevron does the same under `:dir(rtl)`. A breadcrumb label is a `<bdi>` so an English title in a Hebrew bar is cut at its end, not its start.
4. **MUST** isolate by what a value *is* (data-display skill): ids, emails, paths, URLs, phones `dir="ltr"`; user text `<bdi>`; JSON `unicode-bidi: plaintext`; a phrase that merely contains a digit ("3 days ago") gets nothing. Never `<bdo>`, never `dir="auto"` on an id.
5. **MUST** numeric table columns align to the **physical** right with `tabular-nums` in both languages; identifiers (nominal numbers) align to the start.
6. **MUST** swipe and slide directions flip; a swipe-to-reveal starts at the inline-start edge; drawers open from the inline-start side.
7. **MUST** tab order and DOM order are the reading order; do not use `order` or `row-reverse` to fake RTL.
8. **SHOULD** allow two-line labels: Hebrew is shorter but taller (glyph metrics); body line-height >= 1.5; no italics or letter-spacing on Hebrew.
9. **MUST** test every new screen in `/he` as well as `/`, and the matrix runs both (section 7).
10. Plural and number formats go through `Intl` (`he-IL`); Hebrew plurals have 4 forms, so do not build "N item(s)" by hand.

---

## 6. Motion rules

The site-wide contract is [`docs/motion-contract.md`](motion-contract.md); read its section 4 (the three off-switches) and section 8 (the inventory) before adding motion. Admin motion is the **exempt** class there: press, hover, focus, dialog and sheet open, skeletons.

1. **MUST** durations and easing come from tokens (`--a-dur-*`, `--a-ease-*`, section 2). No raw `ms` or `cubic-bezier` in a component. *Why:* `adminShape.guard.test.ts` reads them off the CSS.
2. **MUST** every `transition` and `animation` in the admin sits inside `@media (prefers-reduced-motion: no-preference)`. A visitor who asked for none gets the colour change and nothing that travels. Prefer 1ms over `animation: none` when a handler waits for `animationend`.
3. **MUST** JS-driven motion (WAAPI, drag settle) listens to the `matchMedia('(prefers-reduced-motion: reduce)')` change; CSS cannot stop it.
4. **MUST** animate `transform` and `opacity`. Never `transition: all`. Height opens through `::details-content` + `interpolate-size` (as `Disclosure`) or `grid-template-rows 0fr to 1fr`.
5. **MUST** every exit lands on the finished state, never the first frame (motion-contract section 4).
6. **MUST** interruptible: a second tap during a transition reverses it; never block input while animating.
7. **SHOULD** drag is 1:1 with the finger (`translateY` only), release picks the nearest snap by position and velocity (flick > 0.5px/ms goes to the next), rubber-band at the limit; tap-driven open/close uses damping 1.0, a flick uses about 0.8 (apple-design skill).
8. **MUST NOT** add scroll-driven animation to the admin. If you do anywhere: no `animation-delay` or `-duration` on a scroll timeline, and never a `view()` timeline on a `position: sticky` element (motion-contract section 1).
9. **MUST** new motion is added to the inventory in motion-contract section 8 in the same PR.
10. Animated dash and shimmer only for states that are really active (`sending`, loading); static under reduced motion.

### 6.1 Phone motion catalogue (#709, phones only)

Below 600px a state change is a transition (motion-contract section 13); from 600px up nothing here applies. `open` / `data-open` / `inert` flip on the tap, the transition follows, and a timer only drops leftovers.

| Surface | Enter | Exit | Notes |
|---|---|---|---|
| `BottomSheet` | rises from the bottom, spring, 300 ms; backdrop fades; body content fades a beat later | falls, ease-in, 200 ms; backdrop fades | drag is 1:1 (no transition while `data-dragging`); snap settles on `block-size` |
| Settings sub-page (`SettingsList`) | pushes from the inline-end edge, the list shoves 25% back; items cascade in 30 ms steps | pops back, ease-in | mirrored in RTL via `--dir`; the list stays mounted, covered and inert |
| Settings group sheet | as `BottomSheet`, items cascade | as `BottomSheet` | stays mounted after first use |
| `Disclosure` | height and fade, 300 ms | height and fade, 200 ms | `::details-content`, chevron turns |
| `UndoToast` (`Presence`) | rises, spring | falls, ease-in | no bounce on the exit |
| `SelectionBar` (`Presence`) | rises | falls | |
| Route change (`.a-main > *`) | one opacity fade, 200 ms; skeleton and the content it becomes cross-fade | none: the state is already the new screen | opacity only |
| Tab content (`.a-main [role="tabpanel"]`) | short rise (6 px) and fade | none | the tab is already selected |
| Settings search results | each hit fades in | none | |
| Sheets drawn as `{x && <Sheet/>}` (`SheetPresence`) | as `BottomSheet` | as `BottomSheet` | Audience: add, import, edit |
| Admin drawer and scrim | slides from the inline-start edge, spring; scrim fades | slides out, ease-in | `.a-side:not([data-open])` |

No entrance animation is kept on nav elements: the nav audit found none that also had a scroll-driven one (guarded by `motionStateChange.guard.test.ts`). Check by hand with `npm run a11y:admin-motion` (samples mid-transition through the Web Animations API; this box has about one frame per 40 s).

---

## 7. Testing

### 7.1 Failing test first

**MUST** write the test, run it, and see it fail *for the stated reason* before you write the fix; say so in the PR. A test that passed before the change proves nothing. For a bug the test reproduces it; for a component it fails because the module or rule is absent. The guard test for this guide was committed before the guide.

jsdom cannot see layout and the headless Chromium on the dev box emits about one `requestAnimationFrame` per 40 s. So:

- **Size, token, motion and text-floor rules** are read off the CSS text in a guard test (`touchTargets.guard.test.tsx`, `adminShape.guard.test.ts`, `readability.guard.test.ts`).
- **Layout** is measured in a real browser (7.3) and shown in a screenshot, in `/` and `/he`, light and dark.
- In browser scripts **poll on a timer or use fixed waits**, never default `waitForFunction` (it polls on rAF and hangs).

### 7.2 Commands

```sh
cd web
npx vitest run src/components/admin/__tests__/touchTargets.guard.test.tsx   # one file
npm run lint && npm run typecheck && npm test                               # what CI runs
npm run build && npm run a11y:admin-phones                                  # real browser, needs a build
npm run a11y                                                                # axe, WCAG 2.2 AA, every route
make check                                                                  # everything, web and backend
```

Never run vitest from the repo root.

### 7.3 The admin matrix and density scripts

Three Playwright scripts in `web/scripts/a11y/` measure a built admin through the repo's own harness (`site-stub.mjs`: `vite preview` plus API fixtures, no login, no network; every request that is not localhost is aborted, so they run offline). `admin-matrix`, `admin-inbox-phone`, `admin-media-phone` and `admin-posts-phone` run in CI; `density-matrix` is a measuring tool you run by hand.

```sh
cd web && npm run build
# Matrix (CI): every admin route and state at 320/360/390/768, light/dark, en/he. Fails on page overflow, targets under 24x24, primary controls under 44 on touch, text under 14px outside the allowlist; a finding in admin-matrix-baseline.json is known.
npm run a11y:admin-matrix        # ONLY=media,marketing-inbox  WIDTHS=320,390  THEMES=light  LANGS=en  SHARD=1/2
# Inbox on a phone (CI): one tappable row per event, >= 7 rows above the fold of 390x844, no sideways scroll, the sheet opens and gives focus back, Mark done offers Undo, Hebrew mirrors.
npm run a11y:admin-media-phone   # Media on a phone (CI): 3 columns of square tiles, >= 6 tiles above the fold of 390x844, one button per tile, no sideways scroll, the sheet has the alt text before where it is used, focus returns, desktop unchanged. BEFORE=1 measures and shoots without asserting (to record an old build)
npm run a11y:admin-reflow   # reflow and device edge cases (CI), ~2 min: 320 and 280 wide, 200% text (the `--text-scale` token), forced-colors, safe-area insets, he. ONLY=B-h5-3 runs one case; SHOTS=<dir> writes screenshots. The admin matrix stays at 320/360/390/768: these cases need their own browser contexts and a frame per font change, so they live here, not in the matrix
npm run a11y:admin-density-phone   # control budgets in the fold at 390x844 (CI): editor <= 9, review sheet <= 12, Audience <= 7, Overview <= 10, drawer <= 10, Areas <= 7 (rows are counted apart), Library-expanded one row per template; no sideways scroll, focus returns, he RTL. SHOTS=<dir> writes screenshots
npm run a11y:admin-inbox-phone   # SHOTS=<dir> also writes screenshots (taken over the protocol: page.screenshot waits for a frame this headless build rarely makes)
# Posts and Areas on a phone (CI): one tappable row per record, >= 7 post rows above the fold of 390x844, no sideways scroll, Select shows the bulk bar, the publish review is a sheet (summary, diff, then closed Disclosures), Hebrew mirrors, desktop table unchanged.
npm run a11y:admin-posts-phone   # SHOTS=<dir>; CHROME=<path> when Playwright's browser is not the one installed
# Density (by hand): every admin screen at 390x844 and 360x740, scored 0-100 from fold characters, nodes, controls, pills, small text, scroll height, the longest run of rows and empty text; the fixtures are bigger (10 to 20 records) because a list of 2 measures nothing.
npm run a11y:density -- --top 25 --shots top   # ONLY=marketing-inbox  VPS=390x844,360x740  CHROME=<path to chrome>
# The same screens in Hebrew (right to left) or in the dark theme: one language and one theme per run, so a before/after is two runs with the same flags.
LANGS=he npm run a11y:density -- --shots top   # THEMES=dark  likewise
```

`a11y:density` reaches the sheets and dialogs that sit behind a tap: the audience contact sheet (a `[data-record-row]`), Add contact and Import CSV (the phone's "Add people" sheet, or the toolbar buttons on a wide screen), an open campaign and its composer with every collapsed section opened (`marketing-campaign-expanded`). A step that cannot find its control marks the screen `STEPFAIL` or `SKIP` and leaves it out of the ranking, so a screen missing from the table is a broken step, not a good score. With a sheet open the sheet is the screen. `a11y:density` writes its results, table and screenshots to a temp folder (a fresh `density-matrix-XXXX` folder under the OS temp dir, printed at the end), never into the repo. Read the score as a comparison between two builds, not as a target: run it before and after a screen's migration and put both numbers in the PR. The matrix baseline lists known findings; a **new** one fails. When you fix one, shrink the baseline in the same PR. A list screen you migrate adds its own fixture (10 to 20 records) and its own check in this style (rows above the fold, one control per row, no overflow, in `/he` too).

### 7.4 What CI enforces

| Check | Where | Holds |
|---|---|---|
| Lint, typecheck, unit tests, build | `ci.yml` Frontend | includes every guard test: `adminShape` (radius and motion tokens, motion only when allowed), `touchTargets` (44 coarse, 32 fine, `--a-fs-meta`), `readability` (>= 14px, `title` on truncated text), `disclosure` (no raw `<details>`), this guide's catalogue |
| `npm audit --omit=dev --audit-level=high` | Frontend | no high advisory in runtime deps |
| Accessibility floor (axe, WCAG 2.2 AA), sharded | `ci.yml` Browser checks | contrast, labels, names, target size |
| Admin phone layout | Browser checks | `/admin/projects` row never overflows, draft banner keeps its sentence, links are 44 x 24 |
| Overview, Connections, Translations, Settings on a phone | Browser checks | `a11y:admin-phone-screens`: one button and at most two facts per row, no sideways scroll, five setting groups, history as compact rows (never cards), sheet returns focus, desktop unchanged |
| Admin Inbox on a phone | Browser checks | `a11y:admin-inbox-phone`: 7 rows above the fold at 390x844, one button per row, 4 named glyphs, no "Ready" and no Copy in the list, sheet opens and returns focus, Undo, Hebrew mirrors |
| Admin Posts and Areas on a phone | Browser checks | `a11y:admin-posts-phone`: 7 post rows above the fold at 390x844, one button per row, at most one glyph, Select shows the bulk bar, the review leads with what changes, Hebrew mirrors, desktop table intact |
| Admin Media on a phone | Browser checks | `a11y:admin-media-phone`: 3 columns of square tiles at 360 to 430, >= 6 tiles above the fold at 390x844, one button per tile, sheet order (alt, used, details closed), focus back on the tile, desktop radios and explainer unchanged |
| Admin control budgets on a phone | Browser checks | `a11y:admin-density-phone`: chrome controls in the first screen at 390x844 under budget per screen (rows counted apart), no sideways scroll, sheets return focus, he is RTL, desktop unchanged |
| Admin reflow and device edge cases | Browser checks | `a11y:admin-reflow`: the bulk bar keeps its count and stays under 30% of 320x568 (and 40% at 200% text), `/story` headings fit 320 and 280, a Switch has a border under forced-colors, nothing is pushed off screen at 200% text on 320 and 390 (New post, Posts), a landscape notch is cleared by the top bar and main, Hebrew mirrors the back chevron and Back, no heading level is skipped in Library and Sender |
| Links land where they point | Browser checks | no dead internal links |
| Static | `ci.yml` | secrets scan, workflow and Dockerfile lint |
| CodeQL | `codeql.yml` | security analysis; **wait for it too** |

A merge needs every check green, CodeQL included.

---

## 8. PR checklist (admin UI)

Copy into the PR; the PR template carries the same list.

- [ ] I scored every field the screen shows (section 1.2); tier 4 is gone, tier 2 and 3 are not on the row
- [ ] Row budget: <= 2 facts, <= 1 status glyph, 0 buttons, title <= 2 lines, height >= 56 (>= 44 always)
- [ ] I used a catalogue component, or added one with a catalogue row (section 3) and an icon row (section 4)
- [ ] Targets >= 44, gaps >= 8, meaningful text >= 14, inputs >= 16
- [ ] Tokens only: spacing `--a-s-*`, radius `--a-r-*`, motion `--a-dur-*` / `--a-ease-*`; no `transition: all`
- [ ] Every status has a shape and a name; colour is never alone; normal state draws nothing
- [ ] Hebrew checked in `/he`: logical properties, mirrored chevrons, ids and emails `dir="ltr"`, no English string left
- [ ] Reduced motion: nothing travels; the finished state is shown
- [ ] Keyboard: one tab stop per row, Esc closes the sheet and focus returns to the opener
- [ ] Errors say what and how to fix, in the user's language; the client rule equals the server rule (no raw zod text)
- [ ] The test failed before the change and I said why
- [ ] Screenshots at 390x844, light and dark, `/` and `/he`; matrix baseline updated
- [ ] `npm run lint`, `typecheck`, `npm test` green; every CI check green, CodeQL included

---

## 9. Anti-patterns we found

Each one was measured in a real screen. Fix by pointing at the section.

| Anti-pattern | Where | Why it hurts | Instead |
|---|---|---|---|
| **Arrow-less expander**: a `<summary className="flex">` loses the native marker (Tailwind preflight) | 10 admin summaries | nothing says it opens | `Disclosure` (section 3) |
| **Empty status circles**: four hollow dots with no channel identity | Inbox row | pixels with no meaning | glyph per channel, filled or outline (#669) |
| **Repeated pill**: the same "Ready" on every row | Inbox | noise hides the one that is not ready | normal draws nothing (1.1 principle 2) |
| **Identical-on-every-row labels**: "Copy LinkedIn" x N, "Edit" x N, the same pill | Inbox, Audience | repetition is scanned, not read | move to the sheet footer |
| **Long help text under every checkbox** | Marketing Settings | "a lot of data telling me nothing" | one-line label + `InfoPopover`; only warnings visible |
| **Raw zod error** shown to the user, English in a Hebrew admin | `CampaignEditor`, `SettingsPanel`, `LibraryPanel` | not actionable, not translated | validate in the client with the server's own rule; map codes to words files |
| **Payload nulls vs schema**: UI sends `null` or accepts what the server refuses | hashtag with `-`, a `"` in a name, quiet hours left blank, a 2-letter consent note, `me@example.c`, 1 MB CSV vs 900,000 characters, name 120 vs 80 | Save fails after the user thinks it is valid | share one constant or one schema between web and backend; add a test that feeds the server's refused input to the client check |
| **Any failure shown as "link expired"**: network and 503 told like a bad token | `Unsubscribe`, `SubscribeConfirm`, `SubscribeManage` | a real subscriber thinks their link died | tell 4xx from network and 5xx; keep a Retry |
| **Settings read as defaults when unreadable** | campaign sender when settings fail to load | a send goes out with no quiet hours | hold and say why; never fall back to defaults for a send |
| **Hidden-scrollbar tab strip** with no cue | Marketing, 6 tabs | the last two are off-screen | sidebar group (#675) |
| **Key hints on touch** ("j/k/c/o") | Inbox | means nothing without a keyboard | hide under `pointer: coarse` |
| **Three-row fixed bottom bar** | editors | 25% of a 568px screen; a focused field half under it | one row, `scroll-padding-bottom` |
| **A table squeezed to 390px**: every column becomes text | most lists | desktop layout on a phone | `RecordRow` below 600 |
| **Truncating an identifier** | subject, titles | rows that start alike look the same | wrap it; clamp only non-identifying text, with `title` |
| **A gesture as the only path** | long-press, drag to reorder | undiscoverable, fails WCAG 2.5.7 | visible Select button, Move menu |
| **Hover-only affordance** | tooltips, hover rows | touch never hovers | `@media (hover: hover)` for styling only |
| **`transition: all`**, raw durations, motion outside `no-preference` | various | animates layout, ignores the user | tokens, section 6 |
| **Text under 14px that carries meaning** | hints 13, pills 12, `th` 12 | unreadable at arm's length | `--a-fs-meta` |
