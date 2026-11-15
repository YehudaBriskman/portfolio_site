# Admin design guide

**The single source of truth for how the admin looks and behaves.** Section 0 is the rulebook for every width (A1 to A34); sections 1 to 9 hold the phone numbers and the catalogue. Read it before you change anything under `/admin`. It is a living reference, not a task list: work is tracked as issues (#669 to #683 for the phone series), and if something here stops being true, change it in the same PR.

`MUST` fails review. `SHOULD` needs a reason in the PR to skip. Every rule carries its *why*, because a rule without one gets argued away.

Where the numbers came from: [principles](design/2026-11-13-mobile-design-principles.md), [data density](design/2026-11-14-mobile-data-density.md), [reference patterns](design/2026-11-14-reference-patterns.md), [importance research](design/2026-11-14-importance-scoring.md). Appendices are history; if they disagree with this guide, the guide wins. Guard tests keep the catalogue below honest (`web/src/components/ui/adminDesignGuide.guard.test.ts`).

---

## 0. The rulebook (A1 to A34)

Added 2026-11-15 (phase 1 of the admin design pass, #830). **This is the layer that applies to every admin screen at every width, phone and desktop.** Sections 1 to 9 below keep the phone numbers, the importance method, the catalogue and the checklist; where a rule here and a number there overlap, the number there is the measured one and the rule here says *why it generalises*. Motion and live behaviour have their own sheet: [admin-motion-and-behavior.md](admin-motion-and-behavior.md) (rules M1 to M12, which this section refers to).

Each rule: **Rule** (MUST / SHOULD / NEVER), **Why**, **Check** (something a script or a person can measure), **Kit** (the component that implements it, or `MISSING`), **Source**. Sources marked *(lead)* were not retrievable as text on 2026-11-15 and are recorded from the system's published guidance as remembered; verify before quoting. The owner's recurring complaints are the reason the list is ordered the way it is: too much at once, one place per thing, elements touching, inconsistent weights, labels clipped.

Reading order for a reviewer: **Hierarchy** (A1 to A10), **Lists and tables** (A11 to A18), **Disclosure and detail** (A19 to A22), **Forms and feedback** (A23 to A28), **Navigation and dashboards** (A29 to A32), **Access and language** (A33, A34).

### Hierarchy and layout

**A1. One primary, one secondary, then More.** MUST draw at most one primary action per surface (page, sheet, toolbar, row group) and at most one secondary; everything else goes in a "More" menu. Destructive actions are never the primary and are never red-filled until they are the confirm step.
*Why:* a second equal button makes the person decide before they act (the Campaigns page opens with "New campaign", "Compile issue" and "Pause all sending" at one weight; Audience has "Add contact", "Import CSV", "Export CSV" in one row). Primer allows one save button per form; Carbon caps a toolbar at 5 and sends the rest to an overflow.
*Check:* per screen, count `.a-btn--primary` / `IconButton tone="primary"` in the DOM that are visible without opening a menu: 1. Count visible text buttons in the header and toolbar: at most 3 including More.
*Kit:* `ControlBar` (`priority`, `max`), `CreateMenu`, `IconButton tone`. A `PageHeader` that takes `primary`, `secondary`, `more` props is MISSING (see the kit gaps in the gap audit).
*Source:* https://primer.style/product/ui-patterns/saving/ ; https://carbondesignsystem.com/components/data-table/usage/ ; https://www.nngroup.com/articles/progressive-disclosure/

**A2. A page has one title, in one place, and says its job in one line.** MUST render the page title once (the `h1`); the top bar shows the section or a back path, never the same words. A description is at most one sentence (one line on a phone); anything longer is behind an info control. A hub with tabs (Marketing) has one `h1` for the hub and the active tab's name is the tab, not a second `h1` and a second paragraph.
*Why:* the Marketing hub today draws "Marketing", a tab strip, then "Audience" and a second paragraph that restates the first; the editor draws the post title in the breadcrumb and the `h1`. Duplicate headings make people compare.
*Check:* per route, the text of `h1` does not equal the last breadcrumb or top-bar title, and there is exactly one `h1`; description length under 120 characters.
*Kit:* `PageHeader` in `components/admin/ui.tsx` exists (title, description, actions) but is not in the `ui/` kit and has no `primary`/`more` slots. Promote it (workstream W2).
*Source:* https://www.nngroup.com/articles/visual-hierarchy-ux-definition/ *(lead; the guide's principle 4 cites NN/g duplicates)* ; Apple HIG Layout *(lead)*

**A3. Hierarchy is fill and a bar, not bold and a ring.** MUST mark "current" (nav row, active tab, selected record) with a soft fill plus a 2 to 4px bar on the inline-start edge. NEVER use bold plus a ring plus a coloured border together. Text uses two weights in a body (400 and 500; 600 for headings and the one value that matters); every sidebar row, tab and chip shares one weight; a state change never changes the weight (it moves the layout).
*Why:* size, weight and colour rank things; use at most three contrast treatments and two large elements (NN/g). Mixed weights read as a mistake.
*Check:* `admin-sidebar.mjs` already holds this for the sidebar (one weight, 2-4px bar, no ring). Extend it to tabs and chips: `font-weight` of siblings in one group is identical in every state.
*Kit:* `SidebarGroup`, `SegmentedControl`, `Chip`. The marketing tab strip and the editor language tabs are hand-rolled and use bold plus underline plus ring: MISSING a shared `Tabs`.
*Source:* https://www.nngroup.com/articles/visual-hierarchy-ux-definition/ *(lead)* ; Refactoring UI, "hierarchy" chapter *(lead; book, not fetched)*

**A4. Leading edge first; importance falls from the top and the inline-start.** MUST put the identity first and the action last in a row; the order mirrors in RTL with logical properties only (no `left`/`right`).
*Why:* people scan top to bottom from the leading edge; front-load the informative word (NN/g F-pattern; Apple Layout).
*Check:* in `dir=rtl` the first child of a row is at the right edge; `rg 'margin-left|padding-right|text-align: *left'` in admin CSS finds nothing new.
*Kit:* `RecordRow`, `SettingsRow`.
*Source:* https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content-discovered/ *(lead)*

**A5. Say it once; identity once.** MUST show a datum once per view: the record's name is not in the breadcrumb and the heading; a status is not a pill and a banner and a sentence; "Recent activity" and "Pick up where you left off" are not the same three posts. Where a fact is on the page twice, the lower-scoring copy is deleted (§1.2 override 4).
*Why:* the editor shows "Unpublished changes" three times (pill, banner, footer readout); Overview lists the same posts in two cards.
*Check:* per screen, no two visible nodes share the same text string longer than 12 characters except inside a list that is the screen's job. The importance scoring in §1.2 is the method.
*Kit:* `StatusGlyph` (word only in a sheet).
*Source:* https://www.nngroup.com/articles/progressive-disclosure/ ; §1 principle 4

**A6. Show exceptions, not the norm.** MUST NOT draw a pill, tick or colour for the normal state (Published, Ready, Active, Done). Only a problem, a warning or "needs you" draws, as one glyph. A table where every row says "Published" has a column that carries no information: remove it or make it a filter.
*Why:* a calm value in green teaches the eye to ignore colour. Today Areas, Posts and Connected apps draw a pill on nearly every row.
*Check:* on a list fixture where 80 percent of records are normal, fewer than 30 percent of rows contain a status node.
*Kit:* `StatusGlyph` (default hidden). `StatePill` in `admin/ui.tsx` is the older desktop pill and should be reduced to the exception states.
*Source:* https://www.nngroup.com/articles/dashboards-preattentive/ ; §1 principle 2

**A7. Equal siblings, one spacing scale, nothing touches.** MUST keep adjacent boxes in a row the same height (within 1px) and padding; keep at least `--a-s-2` (8px) between any two controls and at least 12px between a control and a container edge; a chip row that scrolls clips on the container edge with a fade or a peek, never underneath another control.
*Why:* Campaigns and Media phone shots draw the last chip ("Finish", "Vi") cut mid-word underneath the Select button; uneven neighbours read as broken. WCAG 2.5.8: a 24px target must not touch another.
*Check:* `admin-equal-siblings.mjs` (heights) exists; add: bounding boxes of any two interactive elements in one toolbar have `gap >= 8` and never intersect.
*Kit:* `ControlBar`, `ChipRow scroll`, `FilterChips`. The Select button belongs outside the scrolling row (W3).
*Source:* https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

**A8. Truncate with an ellipsis or wrap the row; never clip mid-word.** MUST wrap record titles and identifiers (two lines, `line-clamp`); a one-line label ends with an ellipsis at a word or character boundary and has the full text on `title`/`aria-label`; an unbreakable string gets `overflow-wrap: anywhere` (`.a-path`). NEVER cut by a parent's `overflow: hidden` with no ellipsis.
*Why:* a title that starts the same as its neighbour looks identical when cut (Polaris); a cut word looks like a bug.
*Check:* `admin-desktop.mjs` already fails a button whose label wraps past 2 lines or breaks a one-word label; add: for every text node with `scrollWidth > clientWidth`, computed `text-overflow` is `ellipsis` or the node wraps.
*Kit:* `.a-fit`, `.a-path`, `RecordRow` (clamp 2).
*Source:* https://www.nngroup.com/articles/data-tables/ ; Polaris index table *(lead; shopify.dev redirected, text not retrievable)*

**A9. Glyph for status, word for action.** MUST encode status as one glyph plus a hidden word; MUST pair every icon that is not universal (home, search, close, plus, chevron, trash, bell) with a visible word, at least on desktop and in menus. Icons come from the one vocabulary (§4, lucide through `Icon`); no emoji, no mixed styles, no icon-only control without `label`.
*Why:* an icon is read in one fixation, a sentence in six, but an ambiguous icon costs a tap. Primer: pair disclosure icons with text.
*Check:* `controlKit.test.tsx` (label required), `icons.test.ts` (concept has a word), `Icon.guard.test.ts` (no raw size).
*Kit:* `Icon`, `IconButton` (`showLabel`), `StatusGlyph`, `ICON`/`CONCEPTS`.
*Source:* https://primer.style/product/ui-patterns/progressive-disclosure/

**A10. One typeface, one scale, tabular figures.** MUST use Rubik (Hebrew and Latin from the one family) at the token sizes; numbers that line up use `font-variant-numeric: tabular-nums`; labels are quieter than values (smaller or lighter, not both bold).
*Why:* a second face or a one-off size is the commonest source of "inconsistent sizes".
*Check:* computed `font-family` of every text node starts with Rubik; the set of distinct `font-size` values per screen is at most 6 and each is a token (`--a-fs-*`).
*Kit:* tokens in `index.css`; `Fields`, `StatChip`.
*Source:* web-interface-guidelines skill (tabular-nums) ; data-display skill

### Lists and tables

**A11. A table is a table only where the screen is wide and the records are comparable.** MUST: first column is a human-readable identifier (never an auto id); columns ordered by importance; related columns adjacent; a header row that sticks when the table is taller than the viewport, with a quiet shadow when stuck; numeric columns right-aligned (physical right), tabular, with a unit in the header, not in every cell; text columns start-aligned. At most 6 visible columns at 1280; the rest behind a "Columns" control that shows a count of hidden ones.
*Why:* NN/g data tables; Primer: keep headers very short.
*Check:* a desktop table fixture of 40 rows: `position: sticky` on `thead th`; first `td` text is not matched by `/^[0-9a-f-]{20,}$/`; right-aligned numeric `td` have `tabular-nums`.
*Kit:* `DataTable` and `RowActions` now exist (#835); existing screens still hand-roll with `.a-table` in `index.css` and `ui.tsx` pieces (Posts, Areas, Translations, Audience, Campaigns, Connections each differ).
*Source:* https://www.nngroup.com/articles/data-tables/ ; https://primer.style/product/components/data-table/guidelines/ ; https://carbondesignsystem.com/components/data-table/usage/

**A12. At most two inline actions per row; the rest in More; the row itself opens.** MUST make the whole row (or its title) open the record; at most two row actions are visible (usually Edit is the row click, so zero or one); more goes in an overflow menu. Fewer than three actions: inline icon buttons with labels; three or more: overflow. In batch-select mode the row actions are disabled. NEVER repeat the same red "Revoke" / "Delete" button on every row.
*Why:* Carbon (overflow when 3 or more; disabled in batch mode); NN/g (one or two inline). Today Connected apps draws N red Revoke buttons, Inbox draws "Copy LinkedIn" and "Copy X" on every row, Audience an "Edit" per row.
*Check:* in a 10-row fixture, visible buttons per row at 1280 <= 2; no row has a button that is also `tone=danger` and visible at rest.
*Kit:* `ControlBar` (row-sized), `dropdown-menu`. A `RowActions` wrapper is MISSING.
*Source:* https://www.nngroup.com/articles/data-tables/ ; https://carbondesignsystem.com/components/data-table/usage/

**A13. Two densities, chosen by pointer, not by screen size.** MUST offer a compact row (32 to 40px control height, desktop pointer) and a comfortable row (44 and up, touch); the page never mixes them. Row min-height on a phone stays 56 (§2). A density toggle is a *later* feature; the default is comfortable on touch, compact on fine pointer.
*Why:* Carbon: XS 24 / SM 32 / MD 40 (default) / LG 48 / XL 64 two-line; header row matches. WCAG 2.5.8 keeps 24 as the floor.
*Check:* `(pointer: coarse)` lifts every `--ctl-h-*` to 44 (exists); at fine pointer the median row height of a list is between 40 and 56.
*Kit:* `--ctl-h-sm/md/lg`.
*Source:* https://carbondesignsystem.com/components/data-table/usage/ ; WCAG 2.5.8

**A14. Below 600px a table is a list of rows, never a scrolling grid.** MUST render `RecordRow` per record (title + at most 2 facts + one glyph + chevron); a phone never mounts the desktop table (`usePhone()`). If a table must scroll sideways (a diff, a fixture), freeze the first column and the header and show the cut-off column as the cue.
*Why:* NN/g mobile tables: a large-screen table first, then adapt; horizontal scroll with a frozen column is the acceptable fallback; filter before viewing.
*Check:* §7 phone checks; Translations on a phone today still draws three lines per row (title, type, key path), over the 2-fact budget.
*Kit:* `RecordRow`, `usePhone`.
*Source:* https://www.nngroup.com/articles/mobile-tables/

**A15. Search, filter, sort: search first, at most five visible filters, active state always visible, state in the address.** MUST: search is the first control and clears with one tap; a filter that is on shows as a removable chip with a count of results; "Clear all" appears while any filter is on; sort shows its direction on the active column only; filter and sort state live in the URL (`useSavedFilters`), the last set may be restored with an Undo. Instant apply on desktop for one-tap chips; "Show N results" in a sheet on a phone. Order filters from general to specific.
*Why:* NN/g: filters discoverable, a clear indication when active, sort and filter are different actions; Carbon: sorted column only gets the arrow.
*Check:* §7 filter tests exist; add: every list screen with more than 20 records exposes search plus a filter control; a filter set survives reload.
*Kit:* `FilterChips`, `FilterSheet`, `useSavedFilters`, `SegmentedControl`. A desktop `FilterBar` (search + chips + active chips + count, one component for Posts, Audience, Media, Translations) is MISSING.
*Source:* https://www.nngroup.com/articles/data-tables/ ; https://www.nngroup.com/articles/filter-categories-values/ ; https://carbondesignsystem.com/components/data-table/usage/

**A16. Bulk actions: a Select mode, a bar that carries the count, an Undo.** MUST: select is a visible control ("Select"), not only long-press or hover; a bar appears with the count in a live region, the first action as primary, the rest in More, Cancel at the end; "Select all" selects the loaded rows and says so; a destructive bulk action names the count ("Delete 3 posts") and is followed by an Undo toast, not a prior confirm; irreversible bulk actions (publish, send) are never bulk.
*Why:* Carbon batch bar; NN/g bulk guidance (the dedicated article returned 404 on 2026-11-15; NN/g data-tables covers select-all and batch buttons).
*Check:* `admin-posts-phone.mjs` holds the phone path; add the same for desktop tables.
*Kit:* `SelectionHeader`, `SelectionBar`, `useSelection`, `useUndoable`.
*Source:* https://carbondesignsystem.com/components/data-table/usage/ ; https://www.nngroup.com/articles/data-tables/ ; https://www.nngroup.com/articles/confirmation-dialog/

**A17. Page by cursor and keep rows under 50; virtualise above.** SHOULD paginate at 20 to 50 rows or "Load more" by cursor with the count loaded ("40 of 212"); MUST virtualise a list that can pass 50 DOM rows; the scroll position and the opened row survive Back.
*Why:* Primer suggests 20 per page as the start; the web-interface-guidelines skill sets 50 before virtualising.
*Check:* a 500-record fixture renders fewer than 80 row nodes.
*Kit:* none (Audience uses a cursor, Posts renders all). `DataTable` leaves paging to the caller.
*Source:* https://primer.style/product/components/data-table/guidelines/

**A18. Every list has four states and they differ.** MUST design: *loading* (skeleton with the real columns and row height, so nothing shifts; none at all under about 1 second; a progress bar above 10 seconds), *empty-first-use* (one sentence that teaches and one action), *empty-no-results* (neutral, names the active filters, one "Clear filters"), *error* (what failed, Retry, the data kept). NEVER a bare "No items", an "x" or "-" in an empty cell, or two primary buttons in an empty state.
*Why:* Atlassian empty-state types; Primer: never "x" or "-" for empty cells; NN/g skeleton thresholds.
*Check:* each list screen fixture renders all four; empty state has at most one primary.
*Kit:* `EmptyState`, `Empty`, `LoadingRows`, `ErrorState` exist in `admin/ui.tsx` (not in the `ui/` kit; no variants), `SkeletonSwap` (phone cross-fade). `Skeleton` (#835) takes the column template and `EmptyState` has the three variants.
*Source:* https://atlassian.design/components/empty-state/usage ; https://www.nngroup.com/articles/skeleton-screens/ ; https://primer.style/product/components/data-table/guidelines/

### Disclosure and detail

**A19. Two levels, no more.** MUST: a screen shows the 20 percent that is needed nearly every visit; one tap reaches the rest (Disclosure, sheet, side panel); a third level means redesign. Never several routes to the same hidden option. Never auto-collapse a section the person is typing in (§1.1 5a).
*Why:* NN/g: beyond 2 levels people get lost; hiding frequent options forces them to the second level too often.
*Check:* no sheet opens a sheet; `admin-typing.mjs`; the importance scoring (§1.2).
*Kit:* `Disclosure`, `BottomSheet`, `InfoPopover`.
*Source:* https://www.nngroup.com/articles/progressive-disclosure/

**A20. A disclosure trigger says what is inside and which way it goes.** MUST: chevron plus a word ("Show all 6 projects", "Advanced"), chevron down when closed and up (or rotated) when open, in RTL it mirrors only where it is directional; one-line meta shows the count or state of the closed content ("7 saved versions"). Use an ellipsis for truncated inline text, a kebab only for a menu. NEVER a text-only toggle or a bare caret.
*Why:* Primer progressive-disclosure pattern; strong information scent (NN/g).
*Check:* `disclosureButtons.test.tsx`, `disclosure.guard.test.ts`.
*Kit:* `Disclosure`, `DisclosureButton`.
*Source:* https://primer.style/product/ui-patterns/progressive-disclosure/ ; https://www.nngroup.com/articles/progressive-disclosure/

**A21. Choose the detail surface by weight of the task.** MUST: *a peek* (read-only, under 6 fields) is a popover or an expanding row; *a look-and-edit while the list matters* is a non-modal side panel on desktop (the list stays visible) and a half `BottomSheet` on a phone; *a long edit* is a page; *a modal dialog* is only for critical, irreversible loss, a blocking missing input, or a short wizard. Errors fixable inline never open a modal.
*Why:* NN/g data tables: avoid modal popups for deep editing because they hide adjacent records, prefer a nonmodal side panel; NN/g modals: overuse trains people to ignore them and a modal turns into a full-screen blocker on mobile.
*Check:* on desktop, opening a record from Audience, Campaigns or Translations keeps the list visible; `dialog[open]` count on a normal flow is 0 or 1.
*Kit:* `BottomSheet` (phone), `popover`, `InfoPopover`. A **`SidePanel`** (desktop, non-modal, resizable, Esc closes, focus returns, URL-addressable) is MISSING and is the biggest structural gap (W5).
*Source:* https://www.nngroup.com/articles/data-tables/ ; https://www.nngroup.com/articles/modal-nonmodal-dialog/

**A22. Tabs are peers of one object; segmented is a view mode; the sidebar is the only place for sections.** MUST: tabs switch between parts of one record or hub; a segmented control switches the *view of the same data* (sort, language, preview) and has at most 4 options; a section that is in the sidebar is not also a tab strip on the page (Marketing's Inbox, Audience, Campaigns, Library and Settings are in both: choose one). Tabs are not for steps and never hold a primary action that changes with the tab unless the header does.
*Why:* two navigations for the same thing is the "one place per thing" complaint; tab and sidebar duplicates double the targets and split the memory of where you are.
*Check:* a route's sidebar leaf labels and its tab labels have an empty intersection.
*Kit:* `SegmentedControl`, `SidebarGroup`; `Tabs` MISSING.
*Source:* https://www.nngroup.com/articles/progressive-disclosure/ ; Apple HIG sidebars *(lead: one primary navigation pattern per width class)*

### Forms and feedback

**A23. Forms: one column, labels above, groups with headings, one Save.** MUST: a label above every field (never placeholder-only); required marked in words; related fields grouped under a heading; one column below 900px; a hint is one line or in an `InfoPopover`; the Save control is one and always enabled, with a verb ("Save", "Publish", "Save settings"), primary on the end, Cancel secondary; the footer bar is fixed above the safe area and never covers a focused field.
*Why:* Primer saving: one save button, always enabled, a verb label; WIG forms.
*Check:* `shoot-admin.mjs CHECK_BAR=1` holds the fixed bar; label-for coverage 100 percent.
*Kit:* `EditorBar`, `Fields`, `SettingsRow`, `Switch`. A shared `SaveBar` with the save readout is partly `EditorBar` (editors only).
*Source:* https://primer.style/product/ui-patterns/saving/

**A24. Saving model: explicit for forms, immediate for switches, never both in one form.** MUST: text inputs, checkbox groups and selects save on an explicit Save; switches and segmented toggles apply at once and say so with a status near the control; the saved state is a readout ("Saved 12:00", "Unsaved changes", "Could not save, retry") in one fixed place; on failure the user's data stays; leaving with unsaved text warns once.
*Why:* Primer: do not mix explicit and autosave in one form; keep the data on failure; autosaved fields make clear whether the change saved.
*Check:* the readout exists on every screen with a Save; a failed save leaves field values unchanged (test).
*Kit:* `saveReadout.ts`, `Switch`, `useUndoable`.
*Source:* https://primer.style/product/ui-patterns/saving/

**A25. Validate on blur and on submit, beside the field, in words that say how to fix it.** MUST: an error appears next to its field after the person leaves it (not while typing), moves focus to the first invalid field on submit, is announced (`role=alert` once), and names the fix ("Use https://, no spaces"); the form summary is never the only place.
*Why:* WIG; NN/g modal: errors fixable inline belong beside the field.
*Check:* submit an invalid fixture: focus is on the first invalid field; `aria-invalid` and `aria-describedby` present.
*Kit:* `Fields`, `focusField.ts`.
*Source:* https://www.nngroup.com/articles/modal-nonmodal-dialog/ ; web-interface-guidelines skill

**A26. Undo beats confirm; when confirming, name the thing and the outcome.** MUST: a reversible action (move to drafts, archive, remove from a list, mark done) runs at once and shows an Undo toast of at least 8 seconds; a confirm exists only for what Undo cannot reverse (send, publish, permanent delete, revoke access) and its buttons are the outcome ("Delete 3 posts" / "Keep"), with the object and count in the text; the default focus is the safe button; the heaviest friction (typing a word) is reserved for rare, dangerous actions.
*Why:* NN/g confirmation dialogs: prefer Undo, confirm only serious consequences, outcome labels, no default "Yes".
*Check:* no `window.confirm`; every dialog's primary button text is not in {OK, Yes, Confirm}.
*Kit:* `toast.undoable`, `useUndoable`, `BottomSheet`; a `ConfirmDialog` that enforces the wording is MISSING.
*Source:* https://www.nngroup.com/articles/confirmation-dialog/

**A27. Feedback goes to the channel that fits its life.** MUST: *a toast* for the transient result of an action the person just did (saved, copied, sent, failed with Retry), once, polite; *inline* for what must be fixed or stays true (field error, a campaign that is paused, a draft waiting); *a banner* for a page-level state that outlasts the visit; *a dialog* only for a decision. A toast with an action stays at least 12 seconds, pauses on hover, focus and a hidden tab. NEVER toast a validation error or a thing that is still true after it vanishes.
*Why:* §3.3; Primer prefers inline messages over toasts for saves; WCAG 2.2.1.
*Check:* the toast host is mounted once; toast text never contains the word "must".
*Kit:* `@/lib/toast`, `ToastHost`; `Banner` (inline, page-level, with action and dismiss memory) is MISSING.
*Source:* https://primer.style/product/ui-patterns/saving/ ; §3.3

**A28. Optimistic where it can be undone; honest progress where it cannot; a long job is a row, not a spinner.** MUST: a reversible change appears at once and rolls back with a message on failure; a job over about 10 seconds (send, import, compile, media upload) has a progress bar or step state, can be left and found again (a "Sending 83 of 120" row), says what is done when it ends, and has Cancel where cancelling is safe. Under about 1 second, show nothing; 1 to 10 seconds, a skeleton or a local spinner.
*Why:* NN/g skeleton thresholds; the Campaigns list already shows the in-flight row.
*Check:* an upload fixture shows a determinate bar; a failed optimistic write rolls the row back.
*Kit:* `MiniBar`, `Journey`/`LifecycleStepper`, `toast.promise`. A `JobRow` is MISSING.
*Source:* https://www.nngroup.com/articles/skeleton-screens/

### Navigation and dashboards

**A29. Navigation: the sidebar has two levels, a rail collapses it, a title says where you are, back is always one tap.** MUST: groups without an address are headings (Marketing, Content, Site), the sidebar has at most two levels and one geometry; the collapsed rail keeps a name on focus (tooltip) and a flyout per group; the current place is fill plus bar (A3); breadcrumbs only on records (Admin / Posts / the title) and never repeat the `h1`; on a phone, a Menu button that has a word, and a back control on every record. Keep selection in sync with the content and restore it when the view returns.
*Why:* Apple sidebars *(lead)*: shallow depth, group by section, one selected state; M3: rail at medium widths, drawer at expanded *(lead; page not retrievable)*.
*Check:* `admin-sidebar.mjs` (geometry, bar, tooltip, flyout, Ctrl+B, persistence).
*Kit:* `SidebarGroup`, `adminNav.ts`, `FloatingBack`, `AdminShell`.
*Source:* https://developer.apple.com/design/human-interface-guidelines/sidebars *(lead)* ; https://m3.material.io/foundations/designing/structure *(lead)*

**A30. A dashboard answers one question and fits one screen.** MUST: Overview opens on "what needs me" (the exceptions, A6), then a row of at most 4 to 6 equal KPI tiles, then recent change; each tile is a number, its word, and one bar or delta; the number is the largest thing; tiles link to the filtered list; quantities are drawn as bars or lines, not pies, donuts or radial gauges; colour never carries magnitude on its own.
*Why:* NN/g: a dashboard has a single task, fits one screen, uses position and length; avoid radial gauges for quantities. (`Gauge` stays only for a budget with a limit where the ring and the words agree; prefer `MiniBar` for everything else.)
*Check:* Overview at 1280x800 shows its "needs you" list and all tiles above the fold; tile heights equal; no `canvas`/svg arc.
*Kit:* `StatChip`, `MiniBar`, `Gauge`; a shared `KpiTile` and `NeedsYouList` are MISSING (Overview builds both by hand).
*Source:* https://www.nngroup.com/articles/dashboards-preattentive/

**A31. Notifications are few, grouped and dismissible.** MUST: the bell carries a count and opens a list grouped by day; a notification is one line with a link to the thing; read state persists; the same event does not also toast; severity maps to one glyph and one tone; there is a quiet period for noise. Alerts that need an action live in "needs you" on Overview, not only in the bell.
*Why:* one place per thing; WCAG 2.2.2 for anything that updates by itself.
*Check:* `NotificationsMenu.test.tsx`; an event appears in at most one of bell, toast, banner.
*Kit:* `NotificationsMenu`, `toast`.
*Source:* https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html

**A32. Everything is reachable by keyboard; shortcuts are discoverable on demand, not printed on the page.** MUST: a visible focus ring with contrast of at least 3:1 and an area of at least a 2px perimeter on every control and never hidden under a sticky bar; `?` or the Help control opens the shortcut list; single-key shortcuts only inside lists and can be turned off; a command palette (Ctrl or Cmd + K) reaches every route and the create actions. NEVER print a line of shortcuts above a list by default (Inbox does).
*Why:* WCAG 2.4.13 (AAA) sets the size and contrast; 2.4.11 forbids a focused control hidden by sticky content; a permanent hint line is noise for people who use the pointer.
*Check:* tab through every screen: each stop has a visible ring; `scroll-padding` clears the fixed bar; palette opens on Ctrl+K.
*Kit:* `keyboard.ts`; a `CommandPalette` is MISSING (no `cmdk`).
*Source:* https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html

### Access and language

**A33. Targets, gestures, contrast.** MUST: pointer targets at least 24x24 CSS px (WCAG AA floor), 44 on touch, 8 apart; any drag has a tap or button path (2.5.7); text that carries meaning at least 14px; colour is never the only channel; a modal or sheet traps and returns focus.
*Why:* WCAG 2.5.8, 2.5.7; §2.
*Check:* `admin-matrix.mjs` (target sizes, text size, overflow), `axe-routes.mjs`.
*Kit:* all; `IconButton` sets sizes by token.
*Source:* https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html ; https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html

**A34. Hebrew is not an afterthought: every word translated, every layout mirrored, every identifier isolated.** MUST: no English word in a Hebrew admin screen except identifiers and brand names (today "Edit" in Projects and "Media" in the breadcrumb remain English); logical CSS only; an id, a path, an email or a number inside RTL text is wrapped in `bdi`/`dir=ltr` (§5); numbers and dates use `Intl`; screens are shot in both directions, light and dark, before merge.
*Why:* §5; the hebrew-i18n skill.
*Check:* a script lists text nodes in `/he/admin/*` that match `/[A-Za-z]{4,}/` and are not in the identifier allow-list.
*Kit:* `i18n/mobile.ts`, `admin/words`, `bdi` helper.
*Source:* hebrew-i18n and data-display skills

---

## 1. Principles and the importance-scoring method

### 1.1 Principles

1. **One screen, one question.** A phone row answers *which one do I open, and does it need me?* Detail belongs one tap away. *Why:* a phone shows about 60 characters per line and 5 to 7 rows; every extra fact costs a row.
2. **Show exceptions, not the norm.** Published, Ready, Active, Mailable draw nothing. Only problems, warnings and "needs you" are drawn. *Why:* a calm value coloured green teaches the eye to ignore colour, and the one red thing is lost (data-display skill; NN/g: "if everything is contrasted, nothing stands out").
3. **Encode, do not write.** Status is a glyph plus a hidden word; time is relative with the full date on `title`; counts are a bar. *Why:* an icon is read in one fixation, a sentence in six.
4. **Say it once.** A datum appears once per view. *Why:* duplicates make people compare them (NN/g).
5. **Two levels, no more.** Row, then one sheet. A sheet never opens a sheet. *Why:* NN/g progressive disclosure: three levels lose people.
5a. **A section the user is typing in never auto-collapses.** Auto-open on an error or a first value is fine; auto-close only on the user's own toggle or on leaving the screen. Pass `open={cond ? true : undefined}`, never `open={cond}` from data (`Disclosure` ignores `undefined`, so the section stays as the reader has it). *Why:* a closed `<details>` drops focus from a field under the cursor (#746, #749). `web/scripts/a11y/admin-typing.mjs` types into every field and holds this.
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
| **Equal siblings**: boxes side by side in a grid or flex row (stat tiles, cards, toolbar controls, media tiles) | **same height within 1px**, same width columns, same padding and radius | uneven neighbours read as broken. The grid item (`li`) stretches (`display: flex`) and the box inside fills it (`flex: 1 1 auto`); an optional second line gets a reserved slot (`tileSlot`, min 1.5rem) so its absence changes nothing; a toolbar row is `items-stretch`. Held by `npm run a11y:admin-equal` (390 and 1280, en and he; panels over 360px tall are columns, not tiles) |

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
| `Icon` (#796) | `@/components/ui/Icon` | the one wrapper for a lucide glyph: size 16/20/24 maps to stroke 2/1.75/1.5, decorative (`aria-hidden`) unless labelled, `mirrorInRtl` for directional glyphs; `iconOf()` for APIs that take a `LucideIcon` | a raw `size`/`strokeWidth` on a lucide import |
| `Gauge` (#672) | `@/components/ui/Gauge` | a budget against a limit as a ring, warn at 70 / danger at 90 percent; level in colour, badge glyph and words, value in a hidden `<meter>` | colour-only status |
| `SidebarNav`, `SidebarGroup` (#675) | `@/components/ui/SidebarGroup` | hierarchical drawer and sidebar nav (the tree is `components/admin/adminNav.ts`): a group without an address (Marketing, Content, Site) is one small muted heading with its own chevron, a group of one (Media, System) is drawn as its single item; one row geometry, one weight (500) everywhere, the current item is a soft `--a-press` fill plus a 3px `--signal` bar on the inline-start edge, never bold, no ring or circle, plain 20px glyphs; a group with an address (a nested one, Settings) is a link plus its own 44px chevron; groups nest two deep; on the docked sidebar `collapsed` draws a 4rem icon rail (`--a-side-w`): a glyph with a tooltip per item, a group is a flyout popover button, Ctrl/Cmd+B and a button toggle it, remembered in `admin-nav-collapsed` (the drawer is never collapsed); identity is said once, by the account menu in the top bar, the current link has `aria-current`, the route's groups open on their own, open state is remembered per viewer. APG disclosure navigation, not a tree role: Tab works as on any page, Up/Down/Home/End walk visible rows, inline-end/inline-start open and close (swapped in RTL). Below 600px (`usePhone`) the drawer carries Marketing's sections and the hub's tab strip is gone | a second nav, or a flat list of more than ~7 links |
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
| `useUndoable` (#671, now on the toast service) | `@/lib/toast/useUndoable` | an Undo window over a deferred action on a screen: `schedule({ message, commit, onUndo, id? })` shows an Undo toast and holds `commit` back; Undo cancels it. The service owns the clock: never under 8 s, paused while the toast stack is hovered or focused and while the tab is hidden, commits on expiry, on `pagehide`, when the screen unmounts, when another job replaces it, and when the same `id` is scheduled again; Undo then leaving commits nothing. Needs a host (`ToastMount` in `App.tsx`; the admin says one is coming, so an Undo raised before the lazy chunk loads waits). This is how an irreversible server action gets an Undo | an error the user must act on; a plain confirmation (`toast.success`) |
| `Presence` (#709) | `@/components/ui/Presence` | a surface that appears and leaves by `show`: keeps the last children while it leaves (`data-state="closed"`, `inert`, `aria-hidden`), rises and falls on phones only; `SelectionBar` uses it | a dialog (use `BottomSheet`), anything that must unmount at once |
| `ListPresence` (#731) | `@/components/ui/ListPresence` | a list drawn from `items` whose rows arrive and leave softly on phones: a removed row stays as a closed, `inert` ghost in its place and collapses (height and opacity) while the neighbours slide, an inserted row grows in, Undo grows it back; a timer drops the ghost, no `animationend`; `variant="tiles"` for a grid. Inbox, posts, audience, media and campaigns use it | a list that never gains or loses rows, or one where a row must vanish at once |
| `SkeletonSwap` (#735) | `@/components/ui/SkeletonSwap` | a loading skeleton that cross-fades into the content that replaces it on phones: both layers share one grid cell, the skeleton fades out as the content fades in, a timer (`EXIT_KEEP_MS`) drops the closed `inert` ghost; no layout jump while both are drawn. Posts, audience, campaigns and inbox lists use it | content drawn without a skeleton first |
| `DataTable` (#835) | `@/components/ui/DataTable` | the one desktop table and its phone twin (A11 to A18): sticky header with a shadow once stuck, sortable columns (`aria-sort`), numeric columns right and tabular, `primary` title wraps to two lines, `hideBelow` drops columns by the table's own width, `density` (pointer decides by default), select mode with a bulk bar (count in a live region), `groupBy` to say a status once as a header, loading / empty / error states, one tab stop with arrow-key grid navigation (inline-end arrow steps into the row's controls, mirrored in RTL). Under 600px it renders `RecordRow` from `phoneRow` and the phone `SelectionBar`; words are props | a phone grid; a status pill on every row (group or filter instead); more than 50 DOM rows without paging (A17) |
| `RowActions` (#835) | `@/components/ui/RowActions` | one primary action plus one "More" menu per row, built on `ControlBar`; More is always drawn on touch and appears on hover, focus or open menu on a fine pointer; destructive actions sort last; `disabled` makes it inert in select mode | three or more visible row buttons; a red button on every row |
| `FilterBar`, `useFilterBar` (#835) | `@/components/ui/FilterBar` | the desktop row above a table: search first (clears with X and Escape), `FilterChips`, the result count and one Clear all that also clears the search; `useFilterBar` is `useSavedFilters` plus a `q` param, so the saved view lives in the address | the phone (use `FilterChips` + `FilterSheet`) |
| `Skeleton` (#835) | `@/components/ui/Skeleton` | a placeholder with the real column template and row height (`columns`, `rows`, `height`) or `variant="cards"` for the phone list; one status word; static, no shimmer | a spinner; a skeleton for a load under about a second |
| `EmptyState` (#835) | `@/components/ui/EmptyState` | the three empty lists: `first-use` (teach + one action), `no-results` (names the filters, one Clear), `error` (what failed + Retry); never two buttons | a bare "No items" |
| `SheetPresence` (#709) | `@/components/ui/SheetPresence` | wraps a `BottomSheet` its parent draws as `{x && <Sheet open>}`: `<SheetPresence show={x}>` keeps it mounted for the exit on a phone (the sheet is told it is closed) | a sheet already drawn with `open={x}` (it leaves by itself) |
| `tooltip` | `@/components/ui/tooltip` | a hint for pointer users | the only label of anything: touch has no hover |

Also on main, outside `ui/`: `usePhone()` (`@/hooks/usePhone`; true under 600px, the one breakpoint a phone screen switches its layout on, so a phone never mounts the desktop list), the Posts and Areas phone screens (`components/admin/posts/`: a row opens the editor; bulk is Move to drafts and Archive, both behind an Undo toast, and never Publish, which is decided in the review one note at a time; `ReviewDialog` is a sheet below 600px: what changes, the diff, then closed Disclosures), the Inbox's phone screen as the worked example of a migrated list (`announce/inbox/InboxPhoneRow.tsx` rows, `InboxSheet.tsx` for the Composer in a `BottomSheet`; an **Undo** inside a modal sheet is drawn in the sheet, because a toast outside a top-layer `<dialog>` is inert while it is open), the Media library's phone screen as the worked example of a **grid** (`MediaPhone.tsx`: square tiles, one button each, named by alt text and state; `AdminMedia.tsx` `MediaDetail` draws the item sheet with the alt text first, where it is used second and the facts in a closed `Disclosure`; bulk delete lists unused items only and goes through an Undo toast), the admin shell and `.a-*` classes (`@/components/admin/AdminShell`), `StatusPill` and `TranslationPill` (`@/components/admin/StatusPill`, `.../TranslationPill`; being replaced by `StatusGlyph`), the native-`<dialog>` modals (`@/components/admin/MediaGrid` `Modal`, `announce/audience/Modal`, the popup system in `styles/popup.css`; see `docs/motion-contract.md` section 9).

#### Control kit (#794)

Icon controls come from one kit in `components/ui/`; do not add another `.a-btn`-style icon button. The kit owns no words: every label, menu item and group name is a prop from the caller. Heights are tokens in `index.css`: `--ctl-h-sm/md/lg` (28 / 36 / 44; a coarse pointer lifts every size to 44), `--ctl-gap`, `--ctl-icon-*` (16 / 20 / 24), `--ctl-radius`, `--dock-*`.

| Component | Import | Use it for | Do not use it for |
|---|---|---|---|
| `IconButton` | `@/components/ui/IconButton` | any icon control. `label` is required by the type: it is the `aria-label` and the tooltip. `showLabel` `never` (default) / `from-md` / `always`; `tone` neutral / primary / danger (one primary per surface); `size` sm / md / lg; `pressed` makes it a toggle | an icon with no name; a tooltip as the only cue for an unclear icon (draw the word: two similar icons, the bar's one primary action, Edit, Publish) |
| `ControlBar` | `@/components/ui/ControlBar` | a toolbar of `IconButton`s: `items` with `priority`, `max` drawn, the rest in a "More" `dropdown-menu` (lowest priority first, original order kept, ties keep the earlier); `label` and `moreLabel` are required | more than one prominent action |
| `CreateMenu` | `@/components/ui/CreateMenu` | the "+" that opens a menu of what can be made (primary tone) | a single create action (use `IconButton`) |
| `SegmentedControl` | `@/components/ui/SegmentedControl` | a short either/or (sort, view): radio group, arrows mirror in RTL | more than ~4 options (use `Select`) |
| `Chip`, `ChipRow` | `@/components/ui/Chip` | a toggle chip (`aria-pressed`, drawn mark) or a static fact, optional tabular `count`; `ChipRow` is a named group, `scroll` for one line | filter sets with a sheet (`FilterChips`) |
| `Dock` | `@/components/ui/Dock` | a floating opaque pill (raised surface, hairline, one shadow) above the safe area | a full-width bar |
| `FloatingBack` | `@/components/ui/FloatingBack` | the public phone's one way up from a detail page: fixed, same box as the menu circle (`--float-h`, `--float-top`, `--float-z`), tap = parent, chevron = menu (parent, Home, Work, Blog, Share). Reached as `components/BackChip` | an in-flow back row, a second copy of the circle's size or offset |
| `StatChip` | `@/components/ui/StatChip` | glyph + number, the word sr-only | a number that needs its label drawn |

Guard: `controlKit.test.tsx` fails on an `<IconButton>` without `label`. Existing screens migrate in later PRs.

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
| the phone top bar (below 1024) | a **Menu** button (glyph and the word) and the page title, nothing else: View site, Notifications, Display settings (a `DisclosureButton` opening `DisplayPanel`) and Sign out are labelled rows at the foot of the drawer. No icon-only control in the bar |
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
| toast (sonner, `popup.css`) | rises, spring | falls, ease-in | no bounce on the exit |
| `SelectionBar` (`Presence`) | rises | falls | |
| Route change (`.a-main > *`) | one opacity fade, 200 ms; skeleton and the content it becomes cross-fade | none: the state is already the new screen | opacity only |
| Tab content (`.a-main [role="tabpanel"]`) | short rise (6 px) and fade | none | the tab is already selected |
| Settings search results | each hit fades in | none | |
| Sheets drawn as `{x && <Sheet/>}` (`SheetPresence`) | as `BottomSheet` | as `BottomSheet` | Audience: add, import, edit |
| Inbox, posts, audience, campaigns rows (`ListPresence`, #731) | the row grows in (height and opacity, 200 ms); neighbours slide; Undo grows it back | collapses (height, 200 ms; opacity 120 ms, ease-in); a timer drops it | not on first draw or on a load; reorder glides (below) |
| Media tiles (`ListPresence variant="tiles"`) | fade and scale from 0.92 | fade and shrink in place | a grid cannot give back its height |
| Popover, `DropdownMenu`, `InfoPopover` | soft scale and fade from the trigger | same, shorter | popup system; Escape is closed at once, out of the DOM within the hard timeout |
| Row press (`RecordRow`, `SettingsRow`, chips, `.a-btn`) | tint on the first frame, no tween | eases away on release | `:active` has no transition |
| Skeleton to content (`SkeletonSwap`, #735) | the skeleton fades out as the list fades in (200 ms, one grid cell, same box) | the closed ghost is dropped by a timer | opacity only; media tiles keep `.a-settle` |
| Reorder (`useReorderGlide`, #735) | the order flips at once; each moved row glides from its old slot (WAAPI transform, 220 ms), the moved row with a 1.02 lift | cancelled by a hard timer | phones, motion allowed; instant otherwise |
| `MiniBar`, `Gauge`, `Journey` | a changed value tweens from the old one | | not on first render (no `@starting-style`) |
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
# Desktop (CI): 1024/1280/1440, en/he, long and Hebrew fixtures. Fails on sideways scroll and on any button or link whose label wraps past two lines, breaks a one-word label, or is narrower than 2ch. In a table, an action sits in a cell with `.a-fit` (never wraps) and a long machine string gets `.a-path`.
npm run a11y:admin-desktop       # ONLY=translations  WIDTHS=1024  LANGS=he  SHOTS=dir
# Sidebar (CI): at 1280 and 1440, en/he, light/dark, every sidebar row starts at one inline edge and has one font-weight, the current row has a 2-4px bar and no ring, glyphs are 20px, the owner's login and "Signed in as" are visible only in the open account menu, the rail is 4rem with a name on every row, a tooltip on focus, a flyout per group, Ctrl+B, and it is remembered across a reload.
npm run a11y:admin-sidebar       # WIDTHS=1280  LANGS=he  THEMES=dark  SHOTS=dir
# Equal siblings (CI): every row of >=2 side-by-side boxes is one height (1px) on 17 screens at 390 and 1280, en/he.
npm run a11y:admin-equal         # ONLY=/admin  WIDTHS=390  LANGS=he  PROBE=1 lists each unequal row
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
