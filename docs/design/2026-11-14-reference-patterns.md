<!-- Reference appendix to docs/admin-design-guide.md. Research notes dated 2026-11-14: they record where the guide's numbers came from and are not a contract; if they disagree with the guide, the guide wins. Local file paths were removed when this was copied. -->

# Reference patterns for the mobile admin

Agent p3. Scratch research, not for the repo. Copy PATTERNS, never pixels, assets or branding.

## How to read this file (provenance tags)

- **[V]** read this session from the page named. Strongest evidence.
- **[S]** seen only in a web-search snippet. Treat as a lead.
- **[K]** general platform knowledge, not re-verified here. Check before hard-coding.
- **[SEEN]** I downloaded the image and viewed it. Only 2 images were seen (both Mailchimp, see "Images" below).

What did not work, so nobody assumes it was covered:
- `developer.apple.com/design/human-interface-guidelines/<page>` and `m3.material.io/...` render as a title only (JS app). **Fix that worked: append `.md` to Apple HIG URLs** (e.g. `.../sheets.md`). M3 pages have no such route; I used the Material Components Android docs on GitHub raw, plus Flutter token JSON, instead.
- Apple HIG image files (`images/com.apple.HIG/*@2x.png`) return 404/403 from direct URLs. No Apple screenshots were seen.
- Mobbin, Dribbble, Behance, Pttrns, ScreenSpot: not fetched (login or paywall walls; not attempted). Zero screens from them were seen.
- Resend, Buttondown, beehiiv, Substack, Stripe, Shopify, Linear, GitHub, Notion, Airbnb host mobile: no screenshots seen. What is written about them is from text snippets, and is marked [S] or [K].
- Refactoring UI and Smashing: not fetched this run (one Smashing/NN-g snippet only).

## Images saved (scratch, not for the repo)

(the screenshots were kept outside the repo)
- `mailchimp-mobile-dashboard.png` [SEEN] source: https://mailchimp.com/resources/introducing-a-new-mobile-dashboard/
- `mailchimp-mobile-dashboard-hero.png` [SEEN] same page.

What I saw in them (own description):
1. Audience card. Top row: one big number (300), a small tinted delta pill (+33%), and a "7 DAYS" outlined range button at the trailing end. Under the big number a plain label ("Audience change"). Then a 2-column pair of secondary numbers, each as number over label (900 / Total audience, 235 / Unsubs-Bounces). A hairline divides the numbers from the chart zone. In the chart zone: a two-segment control (Growth | Sources) centred above a stacked bar chart, 7 bars with sparse axis ticks (0/25/50/100/200/300), 2 tones of one hue for existing vs new, and a 2-item legend underneath. What makes it work: one hero number, one delta, one range switch, then detail. Colour is spent on the data only; text is neutral grey/black.
2. E-commerce card on the phone mock. Same card anatomy repeated: hero number plus delta pill plus range button, then a 2x2 grid of number-over-label, then segmented control (Revenue | Orders) over a bar chart. Header strip has a title ("Dashboard"), top tabs (EXPLORE / OVERVIEW / ACTIVITY with an underline on the active one), and a 5-item bottom tab bar (icon plus tiny label). Section title "E-Commerce" sits OUTSIDE the white card on the grey page background, like an iOS grouped-list header.
Pattern to copy: the "stat card" = hero number + delta + range + 2 to 4 secondary numbers + one segmented switch + one chart. Same card for every metric group, so the page reads as a rhythm.

---

# 1. Data lists and tables on phones

**Reference apps / links**
1. Apple HIG "Lists and tables" [V] https://developer.apple.com/design/human-interface-guidelines/lists-and-tables.md
2. Mailchimp mobile reports (Analytics tab: pick report type, pick audience, tap a campaign) [S] https://mailchimp.com/help/view-reports-mobile/ ; dashboard post [V] https://mailchimp.com/resources/introducing-a-new-mobile-dashboard/
3. Stripe Dashboard mobile app: "payment and customer list and detail screens", charts, push for new payments [S] https://docs.stripe.com/dashboard/mobile
4. NN/g "How to fit big tables on small screens" (lock headers, let users pick a column subset, reorder) [S] https://www.nngroup.com/videos/big-tables-small-screens/
5. Smashing "Accessible front-end patterns for responsive tables" (stacked/accordion vs scroll trade-offs) [S] https://www.smashingmagazine.com/2022/12/accessible-front-end-patterns-responsive-tables-part2/

**The pattern**
- On a phone, a table becomes a list of **rows with one primary fact, one secondary line and one trailing value/status**. Apple: "Prefer displaying text in a list or table", keep item text succinct, and use a middle ellipsis when the start and end both matter (ids, paths, emails) [V].
- Multi-column comparison is the exception: keep a real table with a **sticky header and sticky first column**, horizontal scroll, and a column picker [S NN/g]. Cards suit reading one record, scrolling tables suit comparing many [S].
- Row accessories have fixed meanings [V Apple]: chevron (disclosure indicator) = drill in; info button = "more about this row" only, never navigation. Avoid an alphabet index on rows that already have trailing controls.
- Selected-row feedback: navigation lists highlight persistently, option lists flash then show a checkmark [V].

**Measurable specifics**
- Min tap target 44x44 pt (Apple), 48x48 dp (Material; M3 chip min touch target is 48dp [V Android Chip.md]) [K for Apple number].
- iOS row: 44 pt single-line; title 17/22 Body, secondary 15/20 Subhead or 13/18 Footnote in secondary label colour [V type table below; 44 [K]].
- M3 list items: one-line 56dp, two-line 72dp, three-line 88dp [K]. Material Web tokens [V]: leading icon 18px (24px trailing), leading avatar 40px, leading image 56x56.
- Facts per row: **max 3** (primary, secondary, trailing). A fourth fact belongs in the detail sheet.
- Page side margin 16pt (iOS) / 16dp (Material) [K].
- Numbers: tabular figures, aligned to the physical right edge; Latin numerals and ids set LTR even in RTL (see `data-display` skill).

**Apply to our screens**
- **Audience contacts**: row = display name or email (middle-ellipsis, `dir=ltr` span) + one muted line (status or source) + trailing relative date. Avatar 40px optional, and only if it carries real identity. Fixed row height so virtualisation is trivial.
- **Posts / Media lists**: row = thumbnail 56x56 (rounded 8) + title + one meta line (status, date) + trailing chevron. Media list can switch to a grid (HIG: images that vary a lot or are many belong in a collection, not a list [V]).
- **Campaigns list**: row = subject, status chip, one progress line (see section 6), trailing sent count.
- **History**: row = event icon, sentence, timestamp. Group by day with sticky section headers (iOS grouped header pattern).
- Wide data (a desktop-style table in the same page): keep table markup at >= 768px; below, render the same data as rows. Do not make both fight at one breakpoint.

---

# 2. Grouped settings lists with switches, info popovers, sub-pages

**Reference apps / links**
1. iOS Settings = "a hierarchy of lists" [V Apple Lists and tables]; inset grouped style = group headers/footers plus extra space between groups [V].
2. Apple HIG Lists and tables info-button vs disclosure rule [V] (url above).
3. M3 Switch (Android docs) [V] https://raw.githubusercontent.com/material-components/material-components-android/master/docs/components/Switch.md : "effects of a switch should start immediately, without needing to save"; thumb icon 16dp; label gap 16dp.
4. Apple HIG Playing haptics: toggles, sliders and pickers play system haptics by default [V] https://developer.apple.com/design/human-interface-guidelines/playing-haptics.md
5. Stripe mobile app permission model: "View only" role cannot create payments, refunds or payouts, so the app shows read-only state [S] https://docs.stripe.com/dashboard/mobile . Pattern: disabled controls with a reason, not hidden controls.

**The pattern**
- Page = stack of **rounded groups** on a slightly tinted background; each group is rows separated by hairlines inset from the leading edge to the text start.
- Row types: (a) label + switch (applies at once, no Save), (b) label + current value + chevron = sub-page, (c) label + info button = popover/sheet with explanation, (d) destructive action as its own group, red text, last.
- Group header = short noun, small caps-ish secondary text; group **footer** = the explanation sentence (Apple uses footers rather than long row subtitles).
- Sub-pages: push navigation with a back chevron and the parent title as back label; large title collapses on scroll.
- Info popover on touch = small sheet or anchored popover, dismiss on outside tap; never hover-only.

**Measurable specifics**
- iOS inset-grouped: 16pt outer margin, corner radius about 10pt on the group card, row min 44pt, hairline separator 1 device px, inset about 16pt from leading edge [K, verify in a screenshot before copying].
- Switch: 51x31 pt iOS [K]; Material track 52x32dp, thumb 16-28dp [K]. Keep the whole row tappable, not just the switch.
- Footer text: Footnote 13/18 secondary colour [V type table].
- Switch state change: 200 to 250 ms spring, haptic "selection" tick on iOS [V haptics names].

**Apply to our screens**
- **Settings** (sender identity, double opt-in, daily send caps, danger zone): groups = Sending, Audience, Appearance, Danger. Switches apply immediately with a toast+undo; text/number fields use a sub-page with a Done/Cancel pair (HIG sheet rule: Cancel leading, Done trailing [V]).
- Every setting that has a consequence (cap, domain) gets a footer sentence, not a tooltip.
- Info popovers for jargon such as "double opt-in": an `i` button opens a small bottom sheet (medium detent) on phones; a popover at >=768px.
- Read-only role: show disabled rows with a footer saying why.

---

# 3. Bottom sheets (snap points, grabber), action sheets, multi-select and bulk action bars

**Reference apps / links**
1. Apple HIG Sheets [V] https://developer.apple.com/design/human-interface-guidelines/sheets.md
2. Apple HIG Action sheets [V] https://developer.apple.com/design/human-interface-guidelines/action-sheets.md
3. Material Components Android BottomSheet [V] https://raw.githubusercontent.com/material-components/material-components-android/master/docs/components/BottomSheet.md ; Flutter M3 sheet tokens [V] https://raw.githubusercontent.com/flutter/flutter/master/dev/tools/gen_defaults/data/sheet_bottom.json
4. screensdesign.com "mobile app bulk selection UX" (Noteshelf 3, Dropbox, Collect, WPS Office, Plaud and others, as recordings) [V text] https://screensdesign.com/articles/mobile-app-bulk-selection-ux/
5. NN/g "Bulk actions: 3 design guidelines" (select all, contextual action bar, feedback and undo) [V text of summary] https://www.nngroup.com/videos/bulk-actions-design-guidelines/

**The pattern: sheets**
- Sheet = scoped task tied to the current context [V]. Two system detents: **large** (full) and **medium (about half)**; custom detents allowed [V]. A grabber appears on resizable sheets; **tap on it cycles detents**; also exposed to VoiceOver [V].
- Show the most relevant items at the medium detent, more on scroll or expand ("progressive disclosure"); compose-type sheets stay full height only [V].
- Swipe down to dismiss, and if the sheet has unsaved changes, interrupt with an **action sheet** to confirm [V].
- Only one sheet at a time; a sheet that opens another sheet should close first [V].
- Buttons: Cancel leading, Done trailing; Back replaces Cancel in later steps of a multi-step flow; never all three [V, updated Mar 2026].
- Non-modal sheet (Notes format sheet) lets the background stay interactive [V].
- Android: standard sheet (no scrim, not hideable) vs modal sheet (scrim, tap outside or drag down to hide) [V]. Max width 640dp [V]. Peek height should be tall enough to signal more content [V]. Half-expanded ratio default 0.5 [V]. Fling velocity threshold 500 px/s [V]. Draggable, and nested scroll hands over to drag [V].

**The pattern: action sheets**
- Choices related to an action the person started (e.g. leaving a draft: Delete draft / Save draft) [V]. Not an alert; not a menu [V].
- Destructive choice at the **top**, red/destructive style; Cancel at the **bottom**; short one-line title; message only if needed; **avoid scrolling**, so keep to about 4 options [V; "no more than four including Cancel" is the watchOS number].

**The pattern: multi-select and bulk bar**
- Entry through an explicit labelled **Select** (long-press is a weak entry point) [V screensdesign]. In select mode a tap selects instead of opening [V].
- Visible mode change: count ("2 selected"), checkmarks in the leading column, an exit (Cancel/Done) near the count, Select all / Deselect all above the toolbar [V].
- Action bar appears **only once something is selected**, actions stay put as the count changes [V]. Count repeated inside consequential confirmations and equal to the exact set the command will touch [V]. Warn when an action can apply to only part of the selection [S].
- Always give feedback + undo [V NN/g summary].

**Measurable specifics**
- Grabber: 32 x 4 dp, colour onSurfaceVariant, 4dp radius [V Flutter tokens]. Reserve at least 48dp at the top of the sheet for the handle's tap area [V Android BottomSheetDragHandleView min 48dp].
- Sheet top corners: M3 "extra-large top" token; third-party spec lists 28 [S]; Android example uses 24dp [V, example only]. iOS sheet radius changed across versions; do not hard-code, choose 16 to 28px and keep it consistent [K].
- Snap points to copy: **peek (auto, about 25-30% or content height) / medium 50% (Apple "medium", Material `halfExpandedRatio` 0.5 [V]) / large about 92-100% of viewport** (leave a visible strip of the page behind on iPhone so the stack reads as a sheet [K]).
- Container elevation level 1, surface container low [V Flutter tokens].
- Scrim on modal: 32% black [K].
- Selection toolbar: 56px high, safe-area-bottom padding, 3 to 4 actions + overflow "More" (HIG: aim for max three groups, overflow in More menu [V toolbars]).
- Springs for sheets: damping 0.8, response 0.3 s (momentum drag release) per Apple's WWDC numbers as recorded in the `apple-design` skill [V local file]; use damping 1.0 / 0.4 s for tap-driven open/close.

**Apply to our screens**
- **Marketing Inbox**: Select button in the nav bar; swipe rows for single actions; select mode shows a bottom bar with Archive / Mark spam / Reply, count in the title ("3 selected").
- **Audience contacts**: Select -> bulk bar [Tag, Add to segment, Export, Delete]; "Delete" confirms through an action sheet that repeats the count ("Delete 12 contacts"); "Select all N matching this filter" as an explicit second step, with a notice when N exceeds loaded rows.
- **Campaigns list**: row tap opens a detail bottom sheet at the medium detent (status, send time, key numbers, Duplicate / Cancel send / Delete), expand to large for the full report.
- **Posts / Media**: row action `...` opens an action sheet; destructive item at top; Cancel at bottom.
- Unsaved-edit dismissal: action sheet "Discard changes / Keep editing".

---

# 4. Filter chips, filter sheets, segmented controls, selectors/pickers

**Reference apps / links**
1. Apple HIG Segmented controls [V] https://developer.apple.com/design/human-interface-guidelines/segmented-controls.md
2. Material Components Android Chips [V] https://raw.githubusercontent.com/material-components/material-components-android/master/docs/components/Chip.md
3. Mailchimp mobile dashboard: segmented switch (Growth | Sources, Revenue | Orders) and a "7 DAYS" range menu [SEEN] (images above).
4. Apple Health "Activity" screen uses D/W/M style segmented switch above graphs, cited in HIG [V text; image not seen].
5. Apple Calendar "New Event" sheet segmented control (Event | Reminder) [V text; image not seen].

**The pattern**
- **Segmented control**: 2 to 5 mutually exclusive, closely related views or values of the SAME object; equal widths; text OR icons, not mixed; nouns, title case [V]. Max about 5 on iPhone [V]. For switching whole sections use a tab bar instead [V].
- **Chips** (Material four types [V]): Filter (toggle, multi), Input (a discrete entity such as a recipient), Suggestion, Assist. A row of filter chips scrolls horizontally; the active ones are filled.
- **Filter sheet** for more than about 4 facets: chips row shows the 2 to 3 most-used filters and a trailing "Filters (n)" button that opens a bottom sheet with groups, a count-aware "Show 128 results" primary button and a Reset.
- Selectors (date range, audience, sender): a row with value + chevron that opens a sheet with a list and a checkmark; segmented for 2 to 4 options; menu for long lists.

**Measurable specifics** (Material, [V Android Chip.md])
- Chip min height 32dp; corner radius 8dp (small shape); icon 18dp; padding container 4dp start / 6dp end, label 8dp start / 6dp end; **touch target extended to 48dp**.
- Segmented control: height about 32pt iOS standard, 40dp Material [K]; at most 5 segments [V].
- Chip gap 8px; row horizontal padding 16px; scroll-snap not required; fade mask on the scrolling edge [K].
- Active filter count badge on the Filters button.
- Applying a chip is instant (no Apply button); a filter sheet uses an explicit Apply or live-updating count.

**Apply to our screens**
- **Audience contacts**: chips = All / Subscribed / Unsubscribed / Bounced (single-choice filter chips) + "Filters" sheet (tag, source, signup date range). Show the active filters as removable input chips under the search field.
- **Campaigns list**: segmented control Draft | Scheduled | Sent for lifecycle (3 segments, nouns), not chips.
- **Overview stats**: range switch (7d / 30d / 90d) as a segmented control or the "7 DAYS" outlined menu seen in Mailchimp; metric switch (Opens | Clicks) as a second segmented control above the chart.
- **History**: filter chips by event type.
- RTL: segmented control order mirrors; selected pill animation direction follows `dir`.

---

# 5. Hierarchical sidebar / drawer navigation

**Reference apps / links**
1. Apple HIG Sidebars [V] https://developer.apple.com/design/human-interface-guidelines/sidebars.md
2. Material Components Android Navigation Drawer [V] https://raw.githubusercontent.com/material-components/material-components-android/master/docs/components/NavigationDrawer.md (note: the page says the drawer is being deprecated in M3 Expressive in favour of an expanded navigation rail)
3. Apple HIG Tab bars / adaptable sidebar mentioned in Sidebars page [V]
4. Apple HIG Toolbars (back button, large title, grouping) [V] https://developer.apple.com/design/human-interface-guidelines/toolbars.md
5. Mailchimp mobile bottom tab bar (Dashboard, Lists, Campaigns, Reports, Automation) with icon+label [SEEN, hero image]

**The pattern**
- On a phone, **prefer a bottom tab bar (about 4 to 5 destinations)** and keep the rest in "More" or a sidebar-style convertible tab bar [V Apple: "Consider using a tab bar first"].
- Sidebar/drawer is for many destinations. **Max two levels of hierarchy**; deeper means split view with a content list in the middle [V]. Group with disclosure controls; short group titles [V].
- Icons in the sidebar should be real symbols, accent-coloured by default; any fixed colours used sparingly with a clear meaning (Mail's yellow VIP) [V].
- Do not hide the sidebar by default; keep it discoverable; no critical actions at the very bottom [V].
- Modal drawer on phone has a scrim; standard drawer sits beside content on tablet/desktop [V].

**Measurable specifics** [V NavigationDrawer.md]
- Drawer max width 280dp; container radius 16dp; item padding 4dp vertical, 28dp horizontal; icon 24dp; indicator = full-round pill, 12dp inset, fill secondary container; section header uses Title Small and one line; divider 1dp with 28dp inset; labels one line; active item bold.
- iOS tab bar 49pt (83 with home indicator) [K].

**Apply to our screens**
- Phone: 5 tabs = Overview, Inbox, Campaigns, Audience, More. "More" (or a left drawer) holds Posts, Media, History, Settings. Each tab owns a navigation stack; a second tap on the active tab scrolls to top.
- Desktop/tablet: persistent sidebar with two levels only: group title (Marketing, Content, System) -> items. Active item = pill indicator.
- Badge counts on Inbox only; no badges elsewhere.

---

# 6. Status and lifecycle visuals, journey lines, progress, funnel and gauge

**Reference apps / links**
1. Apple HIG Progress indicators [V] https://developer.apple.com/design/human-interface-guidelines/progress-indicators.md
2. Apple HIG Charts [V] https://developer.apple.com/design/human-interface-guidelines/charts.md (iPhone Storage stacked bar cited as the model of a segmented bar with gaps between segments)
3. UXPin "Progress tracker design" and eBay open-source progress stepper (shipment example with start, blocked, delivery steps) [S] https://www.uxpin.com/studio/blog/design-progress-trackers/ ; https://opensource.ebay.com/evo-web/components/progress-stepper/css
4. Mailchimp cards: hero number + delta + range + stacked bars [SEEN]
5. Delivery tracking steppers (vertical rail with connectors, "on time" badge on the current stop; horizontal dot-line-dot) [S] https://21st.dev/@sean0205/components/reui-stepper-16.md ; https://www.galaxus.ch/designsystem/components/timeline-design

**The pattern: lifecycle**
- Status = a **small set of named states in a fixed order** (Draft -> Scheduled -> Sending -> Sent, plus terminal Failed / Cancelled). Show it as: (a) a chip on list rows (icon + word, colour as a bonus, never colour alone [V Apple charts colour guidance]); (b) a **stepper or timeline** on the detail page, with completed steps ticked, the current step emphasised, future steps muted, and a failed step in the error style plus a retry action.
- Delivery-style detail: a vertical rail with nodes, each node = icon, label, timestamp; the connector between the done and current node is solid, to the next is dotted [S]. A special "in transit" arrow state exists in one design system for "on its way but not arrived" [S]: that maps to "Sending".
- **From -> to journey line** (flight / ride tracking): two end labels (origin, destination), a line with a moving marker, a % or elapsed label. For us the "journey" is Queued -> Delivered -> Opened -> Clicked, or Segment (audience N) -> Sent -> Delivered.

**The pattern: progress and funnel**
- Determinate whenever possible; keep it moving; even pace; describe in concrete words not "Loading"; show Cancel when safe; switch from indeterminate to determinate when a total becomes known; never swap spinner for bar mid-way [V Apple].
- NN/g response limits: 0.1 s instant, 1 s keep flow (show activity), 10 s needs a percent-done indicator and a way to cancel [V].
- **Sending progress** = one segmented bar: delivered / pending / bounced / failed as separate segments **with narrow gaps between segments** (Apple Storage bar) [V], a headline "8,412 of 10,000 sent", an ETA line, Pause and Cancel. Poll or stream; animate width with a 300 ms ease; announce changes via `aria-live=polite` at 10% steps rather than every tick.
- **Funnel** = a short vertical list of steps each with a count and a bar scaled to the first step: Sent -> Delivered -> Opened -> Clicked, with step-to-step % in muted text. Prefer bars over a literal funnel shape (bars compare accurately). Bar charts start at 0 [V Apple Charts].
- **Gauge / budget** = a single bar or ring with a fixed 0-100 axis and the threshold marked (fixed range is right when min and max are meaningful, e.g. battery or daily send cap [V Apple Charts]). Colour by threshold (fine / near cap / over), and always print the numbers ("612 of 1,000 today").
- Charts: summary sentence above the chart (Weather's "rain starts in 20 min" model) [V], labels short, marks at least 44px hit area or scrub across the plot area, colour never the only channel, separators between stacked segments, accessible labels per mark or a text summary [V].

**Measurable specifics**
- Status chip 24 to 28px tall, 12/13px text, icon 14 to 16px [K, matches iOS Footnote/Caption scale in the type table].
- Stepper node 20 to 24px; connector 2px; row gap 24 to 32px; timestamp in Footnote secondary [K].
- Progress bar height 6 to 8px with 999px radius, gap between segments 2px [K; Apple notes the gap but gives no number].
- Chart hero number 34/41 bold (Large Title) or 28/34 (Title 1) [V type table].
- Tick sequences: familiar steps (0, 25, 50, 100) [V Apple].

**Apply to our screens**
- **Campaigns list + progress**: row shows chip + one-line "8,412 / 10,000" + thin segmented bar; no more.
- **Campaign detail**: top = status stepper (Draft, Scheduled, Sending, Sent); middle = sending bar + counts; below = funnel Delivered / Opened / Clicked + bounces.
- **Overview stats**: Mailchimp-style stat cards (hero number + delta + range). Budget/cap gauge for "emails today / daily limit".
- **History**: vertical timeline with one icon per event type and day dividers.

---

# 7. Empty and loading states, toasts with undo, swipe actions

**Reference apps / links**
1. NN/g Empty state interface design [V] https://www.nngroup.com/articles/empty-state-interface-design/ : (1) communicate system status, no "No records" while still loading; (2) learning cues; (3) direct pathway to the key task.
2. NN/g Skeleton screens [V] https://www.nngroup.com/articles/skeleton-screens/ : under 1 s none; under 10 s skeleton for full-page loads, spinner for single modules; over 10 s a progress bar; avoid frame-only skeletons.
3. NN/g Response times [V] https://www.nngroup.com/articles/response-times-3-important-limits/
4. Material Snackbar (Android docs) [V] https://raw.githubusercontent.com/material-components/material-components-android/master/docs/components/Snackbar.md : optional action such as undo or retry, non-blocking, bottom, anchored above FAB/bottom nav, swipe-to-dismiss.
5. Apple HIG Lists and tables / Progress indicators (refresh control): pull-to-refresh hidden until dragged, automatic refresh also expected, optional title only if it adds value such as "last updated" [V] ; Apple UIKit swipe actions [K, API names from a fetched developer-docs summary only].
6. Undo vs confirmation debate [S]: toasts+undo for reversible actions, confirm for irreversible (UI/UX Atlas vs other guides).

**The pattern**
- **Empty**: icon or small illustration, one-sentence cause ("No contacts match these filters"), one primary action ("Clear filters" or "Import contacts"). Distinguish *loading*, *empty*, *filtered-empty* and *error* [V NN/g]. First-run empty doubles as onboarding.
- **Loading**: skeleton rows that match the final row layout for lists (under 10 s); spinner inside a card for a single widget; determinate bar for sends/imports/exports [V NN/g].
- **Toast with undo**: appears at the bottom above the tab bar, one line, one action ("Undo"), auto-dismiss, pauses on touch or focus, queue not stack, swipe to dismiss; destructive but reversible actions use this INSTEAD of a confirm dialog; irreversible ones use an action sheet with the count [S/V mix].
- **Swipe actions**: trailing swipe reveals up to 2 to 3 labelled buttons (colour-coded: destructive red, neutral grey, positive tint); full swipe performs the first action, and then offers Undo [K; HIG page itself has no swipe text]. Always provide the same actions in a non-gesture path (row menu / detail) for accessibility.

**Measurable specifics**
- Toast: 48 to 56px tall, 16px side margin, radius 8 to 12, shadow level 3 [K]; Android snackbar margin 8dp, elevation 6dp, extra-small radius [V]. Durations: Android names SHORT / LONG / INDEFINITE and gives no ms in the doc [V]; practical web values 5 to 8 s with an action (more with a screen reader), 3 to 4 s without [K].
- Skeleton shimmer: 1.2 to 1.5 s loop, off under `prefers-reduced-motion` [K].
- Swipe reveal button width 72 to 80px each; commit threshold about 40-50% of row width; spring back damping 1.0 [K].
- Pull to refresh trigger about 60 to 80px [K].

**Apply to our screens**
- **Marketing Inbox**: swipe left = Archive, swipe right = Mark read (iOS Mail-style, [K]); toast "Archived. Undo". Empty = "Inbox zero" with last-checked time.
- **Audience contacts**: skeleton rows during first load; filtered-empty with "Clear filters"; first-run empty with "Import contacts / Add one".
- **Posts / Media**: swipe = Unpublish / Delete with undo; media upload shows a determinate bar per file with Cancel.
- **Campaigns**: Delete = toast+undo only while Draft; once Sending/Sent, require an action sheet.
- Global: one toast region, `role=status`, queue max 1 visible.

---

# 8. Email / marketing admin apps specifically

What I could actually confirm (text) about each, since no screens were seen except Mailchimp:

| App | What is confirmed | Pattern worth copying | Tag |
|---|---|---|---|
| Mailchimp mobile | Dashboard tabs: Overview, Activity, Explore. Overview has three cards (E-Commerce, Audience, Campaign engagement) with week/month/year graphs. Reports: pick report type, pick audience, tap a campaign; Overview of a report has send time and a 24-hour performance graph; A/B shows winner; PDF export. Campaign creation exists in the app. | Stat cards with delta + range; report drill-down list -> detail; A/B winner callout | [V] dashboard post, [S] help pages, [SEEN] images |
| Substack app | Post stats reachable from a banner on Home for the first 2 days after publishing; "Subscribers from the app" figure with 30-day delta. Sources disagree on whether the iOS app gives publisher dashboard/editor. | Time-boxed "your latest post" banner with a stats link | [S] https://on.substack.com/p/post-stats-substack-app |
| beehiiv | Dashboard has subscribers, open rate, growth; writing/audience/monetisation nav. Per-newsletter reader mobile app is a setting. No evidence found of a publisher-side phone app. | Growth stat + reader-app toggle; not a phone-admin model | [S] https://product.beehiiv.com/p/newsletter-mobile-app |
| Buttondown | No mobile app or dashboard info found. | None to copy | [S] |
| Resend dashboard | Not researched in detail; nothing seen. | -- | not covered |
| Stripe Dashboard mobile | Charts, payment and customer lists with detail screens, balances, payouts, push for new payments and a daily summary, widgets, live-mode only, role-limited. | Daily summary push, list->detail, read-only role | [S] https://docs.stripe.com/dashboard/mobile |
| Shopify / Linear / GitHub / Notion / Airbnb host | No pages fetched. Any claim here would be from memory, so none is made. Suggested next fetches: their App Store listings and help-center pages. | -- | not covered |

**Apply to our screens**
- **Overview**: Mailchimp stat cards: Audience (growth, sources), Campaign engagement (open and click rates), plus a "latest campaign" banner that links to its report for 48 h (Substack pattern).
- **Marketing Inbox**: triage list with swipe, unread dot, sender, one-line preview, relative time.
- **Campaigns**: report drill-down list -> detail with send time, 24-hour performance graph, funnel.

---

# Apple look

Everything here is a pattern translation to the web; do not use Apple fonts or assets we have no licence to ship (SF Pro is licensed for Apple platforms; on the web use the system font stack `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` so Apple devices get SF natively and other devices get their native UI font) [K].

**Type scale** [V, HIG Typography, iOS "Large (default)" row]. CSS px = pt.

| Style | Size / leading | Weight | Use |
|---|---|---|---|
| Large Title | 34 / 41 | Regular (Bold emphasised) | top of a root screen |
| Title 1 | 28 / 34 | Regular | |
| Title 2 | 22 / 28 | Regular | card/sheet title |
| Title 3 | 20 / 25 | Regular | |
| Headline | 17 / 22 | Semibold | row title in emphasis |
| Body | 17 / 22 | Regular | default row text |
| Callout | 16 / 21 | Regular | |
| Subhead | 15 / 20 | Regular | secondary line |
| Footnote | 13 / 18 | Regular | footers, meta |
| Caption 1 | 12 / 16 | Regular | |
| Caption 2 | 11 / 13 | Regular | smallest, tab labels |

Default size 17 pt, minimum 11 pt on iOS [V]. Honour user text scaling (use `rem`). SF adjusts tracking by size automatically; on the web with a non-SF fallback keep default tracking and do not hand-tune [V + K].

**Grouped inset lists** [V concept, K numbers]: tinted page background (secondary system grouped), white/elevated card groups with about 10pt radius, 16pt margins, hairline separators inset to the text edge, group footers in Footnote secondary text, trailing chevrons for drill-in. Selection feedback: brief highlight, then checkmark for option lists [V].

**Large title behaviour** [V Toolbars]: large title shown at the top of a root screen; **transitions to a standard (inline) title as the person scrolls and returns on scroll to top**. Web: `position: sticky` header; compute a 0 to 1 progress from `scrollTop` over about 44px; cross-fade large title out and inline title in; add a hairline under the bar only once scrolled. Keep titles under about 15 characters [V]. Back button = standard chevron symbol without "Back" text [V].

**Translucency** [V Materials]: Apple has Liquid Glass for the **controls/navigation layer** that floats above content, and says **do not use it in the content layer**; use standard materials (ultra-thin, thin, regular, thick) there; use vibrant label colours on materials; thicker = more contrast. Clear glass needs a 35% dark dim under bright content. Web translation: bars (top bar, tab bar, bulk bar, toasts) get `backdrop-filter: blur(20px) saturate(1.6)` over a 70 to 85% opaque surface; content cards stay opaque; fallback to opaque when `prefers-reduced-transparency` or no `backdrop-filter`; never put text on a blurred surface below 4.5:1.

**Spring easing** [V from local `apple-design` skill, which cites WWDC "Designing Fluid Interfaces"]:
| Interaction | Damping | Response |
|---|---|---|
| Move/reposition | 1.0 | 0.4 s |
| Rotation | 0.8 | 0.4 s |
| Drawer / sheet | 0.8 | 0.3 s |
Default UI spring: damping 1.0, response 0.3 to 0.4; momentum release: damping about 0.8 [V]. Web mapping: Motion/Framer `type: 'spring', bounce: 0, duration: 0.4`, or `bounce: 0.2` only after a flick. Without a spring library, CSS approximation for non-gesture transitions: `transition: transform 350ms cubic-bezier(0.2, 0, 0, 1)` (this is Material's "standard" curve [S, sources disagree on its label]); for sheets and drawers `cubic-bezier(0.32, 0.72, 0, 1)` is a widely used iOS-like curve [K, verify visually]. Material duration tokens: short 50-200 ms, medium 250-400 ms, long 450-600 ms [S/K]. Reduced motion: cross-fade 150 ms, no overshoot [V apple-design skill].

**Haptic-like feedback on the web** [V HIG names: notification success/warning/error; impact light/medium/heavy/soft/rigid; selection]:
- `navigator.vibrate` is not available on iOS Safari and is Android-only elsewhere [K]; make haptics optional [V HIG] and never the only signal.
- Translate each haptic to a visual pulse: *selection* = 100 ms scale 0.97->1 + highlight on the changing control; *success* = checkmark draw + 180 ms row tint fade; *error* = 2-cycle 4px horizontal shake (disabled under reduced motion) + inline message; *impact* = 120 ms press-in on buttons (scale 0.97) and a bounce-settle of a sheet at its detent.
- Use the feedback sparingly: HIG warns haptics that fire often become tiresome and should reinforce cause and effect [V].
- Press states respond in under 100 ms (NN/g: 0.1 s feels instant) [V].

---

# Target feel checklist (one page)

Tick every item before a screen is called done.

**Structure**
- [ ] Phone = bottom tab bar of 5 or fewer; deeper areas under More; max 2 levels of hierarchy anywhere [V Apple Sidebars].
- [ ] Large title on root screens, collapses to inline on scroll; no app name as a title.
- [ ] Settings = inset grouped cards, footers for explanations, chevron = sub-page, `i` = explanation, switches apply instantly.

**Lists**
- [ ] Row has at most 3 facts (primary, secondary, trailing); min height 44 px, tap target 44 px or more.
- [ ] Ids, emails, paths middle-ellipsised and `dir=ltr`; numbers tabular and right-aligned.
- [ ] Same row in loading (skeleton), empty, filtered-empty and error states, each with its own copy and one action.

**Layers**
- [ ] Sheets: grabber 32x4, detents peek / half (about 50%) / large, tap grabber cycles, swipe down dismisses, unsaved changes prompt an action sheet.
- [ ] One sheet at a time; Cancel leading, Done trailing; never Cancel + Done + Back together.
- [ ] Action sheet: destructive at top, Cancel at bottom, 4 or fewer options, no scrolling.
- [ ] Bulk mode: explicit Select, count in title, Select all, action bar appears only when selection is non-empty, actions do not move, exact count repeated in the confirm.

**Controls**
- [ ] Segmented control for 2 to 5 sibling views of one object; chips for filters; "Filters (n)" opens a sheet when facets exceed about 4.
- [ ] Chips at least 32 px tall with 48 px touch area, 8 px gap.

**Status and data**
- [ ] Every status = icon + word + colour (never colour alone), fixed vocabulary and order.
- [ ] Campaign detail has stepper, sending bar with segment gaps and "x of y", funnel as bars from 0, gauge with printed numbers and marked threshold.
- [ ] Charts have a one-sentence summary, accessible labels, scrub-anywhere hit area.
- [ ] Determinate progress wherever a total exists; over 10 s show percent + Cancel [V NN/g].

**Feedback and motion**
- [ ] Reversible action = toast with Undo (5 to 8 s, queue of 1, pauses on touch); irreversible = action sheet.
- [ ] Swipe actions have a non-gesture equivalent; full swipe commits then offers Undo.
- [ ] Springs: damping 1.0 default, about 0.8 only after a flick; 300 to 400 ms; interruptible; never block input during animation.
- [ ] Press feedback under 100 ms; haptic-like pulses optional and consistent.
- [ ] `prefers-reduced-motion` = cross-fade only; `prefers-reduced-transparency` = opaque bars.

**Look**
- [ ] System font stack, type from the table above, nothing under 11 px, default 17.
- [ ] Translucent blur on bars, sheets and toasts only; content cards opaque; text 4.5:1 or better.
- [ ] Colour spent on data and on one accent; text stays neutral (Mailchimp cards [SEEN]).
- [ ] RTL: logical properties, mirrored chevrons and segmented order, LTR spans for ids and numbers (see `hebrew-i18n`, `data-display`).

---

# Source list

Apple HIG (all fetched with the `.md` suffix, [V]): sheets, lists-and-tables, segmented-controls, action-sheets, sidebars, typography, toolbars, materials, charts, progress-indicators, playing-haptics, motion. Base: https://developer.apple.com/design/human-interface-guidelines/<name>.md
Material: https://raw.githubusercontent.com/material-components/material-components-android/master/docs/components/{BottomSheet,Chip,Snackbar,NavigationDrawer,Switch}.md ; https://raw.githubusercontent.com/material-components/material-web/main/docs/components/list.md ; https://raw.githubusercontent.com/flutter/flutter/master/dev/tools/gen_defaults/data/sheet_bottom.json ; m3.material.io pages did not render.
NN/g: empty-state-interface-design, skeleton-screens, response-times-3-important-limits [V]; bulk-actions video page and big-tables video [S/V summary only].
Others: screensdesign.com bulk-selection article [V]; mailchimp.com/resources/introducing-a-new-mobile-dashboard [V + SEEN images]; docs.stripe.com/dashboard/mobile, on.substack.com post-stats, product.beehiiv.com newsletter-mobile-app, uxpin progress-trackers, opensource.ebay.com progress-stepper, galaxus timeline design [S].
Local: the `apple-design` skill (spring values), skills `data-display`, `hebrew-i18n`, `web-interface-guidelines`.

# Gaps to fill if more depth is wanted
1. Real screenshots of Stripe, Linear, Airbnb host, Substack, Shopify, GitHub, Notion mobile (needs a source that is public and downloadable; App Store listing images are an option).
2. Apple inset-grouped corner radius, sheet radius and switch size verified from an actual screenshot or Figma kit (kept as [K] here).
3. M3 official list heights, segmented button height, easing token labels from m3.material.io (JS-rendered; try the `material-web` repo token files).
4. Refactoring UI and Smashing text not read this run.
