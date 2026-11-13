<!-- Reference appendix to docs/admin-design-guide.md. Research notes dated 2026-11-14: they record where the guide's numbers came from and are not a contract; if they disagree with the guide, the guide wins. Local file paths were removed when this was copied. -->

# Admin on phones: less data, more meaning (audit + design)

Task p1, 2026-11-14. Repo `YehudaBriskman/portfolio_site` at origin/main `b938c9f` (the #666 tokens commit). No code changed, no PRs.
Inputs read: `BRIEF.md`, `audit/mobile-design-principles.md` (tables E, sheets F, gestures O, RTL M), the skills `data-display`, `interface-design`, `apple-design`, `web-interface-guidelines` (through the principles file, which already reconciles them), the 390px shots in `audit/shots/` (inbox, campaigns, audience looked at by eye), the two owner screenshots relayed by the lead (Inbox, Marketing > Settings), and the code under `web/src/pages/Admin*.tsx` and `web/src/components/admin/**`.
Honesty notes: row contents are read from code, not measured; `[shot]` means I also looked at a screenshot. Brand-icon availability was checked against the installed `lucide-react@1.69.0`. vaul facts are from its GitHub page only. File paths are under `web/src/` unless noted.

---

## 1. Summary

**What is wrong.** Every list and settings page in the admin is a desktop layout squeezed to 390px: every column becomes text, the same pill repeats on every row, buttons sit inside rows, and settings are a flat list of checkboxes each with 2-3 lines of help text. Owner on the Inbox: "too much data for all that and nothing that I can understand"; on Settings: "a lot of data telling me nothing".
- Inbox today (350-390px) [shot]: kind icon, 2-3 line title, relative time, "New" tag, four EMPTY circles (channel state with no channel identity), an identical "Ready" pill (or a dashed "Long description" chip), two full-width "Copy LinkedIn" / "Copy X" buttons (about 40% of the row).
- Marketing > Settings today (`announce/SettingsPanel.tsx`): "Everyday" = email checkbox + hint, notify checkbox + hint, a "Channels in the kit" checkbox fieldset (5 checkboxes), hashtags field + hint, signature field + hint, reset button, then a closed "Advanced" disclosure with its own filter field and UTM fields. Every checkbox is followed by an always-visible `.a-hint` paragraph (`check()` at line 85).

**The rules.**
1. **A phone row answers one question**: *which one do I open, and does it need me?* RecordRow = leading icon, title (<= 2 lines), <= 2 key facts, ONE status glyph, chevron. The whole row is the tap target (>= 44px, typically 56px). No buttons in a row except a checkbox in selection mode.
2. **Show exceptions, not the norm.** Ready / Published / Active / Mailable / Translated draw nothing. Only problems, warnings and "needs you" are drawn (kills the repeated "Ready" pill).
3. **Encode, do not write.** Status = glyph + colour + (sr-only / sheet) word. Time = relative, full date on tooltip. Counts = MiniBar. Lifecycle = stepper. From/to = Journey. Budget = Gauge. Channel state = four brand glyphs, filled or outline.
4. **Detail lives in a BottomSheet** (native `<dialog>`; peek / half / full), not in the row.
5. **Bulk = SelectionBar** (visible "Select" button, long-press as a bonus) with a sheet of bulk actions and an undo toast.
6. **Settings = SettingsList**: iOS-style grouped rows, each with icon, name, ONE-line live summary ("Email on, 2 alerts") and a chevron, opening a sub-page or sheet per group. Inside: one-line label + Switch; long help behind an info icon (tap); only warnings stay visible; a search field over all settings.
7. **Navigation is hierarchical**: SidebarGroup in the admin drawer (Marketing > Inbox, Audience, Campaigns, Library, Settings > Everyday, Channels, Sender & delivery, Sending limits, Alerts, Advanced), deep-linkable, current section highlighted.
8. **Filters are chips + one Filters button**: FilterChips row (common filters, active-count badge, Clear all) and a FilterSheet with the full selectors (segmented, multi-select, date range), remembered per screen.

**Build the sheet in-house; do not take vaul.** vaul's README says "This repo is unmaintained" (135 open issues, 27 PRs when fetched 2026-11-14) and I could not verify its size, dependency list or RTL/snap-point support from that page. The repo already hand-rolls three native `<dialog>` modals (`components/admin/MediaGrid.tsx` `Modal`, `announce/audience/Modal.tsx`, the popup system in `styles/popup.css`), so the pattern, focus return and jsdom fallback are known. About 250 lines plus tests; props are library-shaped, so a later swap is one file.

**Scale.** 30 surfaces inventoried (section 2). 15 PRs (section 5). The Inbox is the FIRST screen, as the owner asked: PR1 (core) and PR2 (Inbox) lead. Then five independent kits (selection, visuals, settings, filters, sidebar) and eight migration PRs run in parallel on disjoint files.

**Surprises found.**
- **lucide has no brand icons here**: `lucide-react@1.69.0` ships no `Linkedin`, `Instagram`, `Twitter`/`X`, `Facebook` (checked in the installed package; `Mail`, `Rocket`, `Gauge`, `Languages`, `ShieldBan`, `MailX`, `CalendarClock`, `Undo2`, `ListChecks` etc. are present). The four-channel glyph row needs 4 inline SVGs (Q2).
- **Mark done has no undo endpoint**: `adminAnnounce.done(eventId, channel)` is a one-way POST (`services/adminAnnounce.ts:202`). The undo toast must be a deferred commit (commit at toast end, cancel on Undo, flush on `pagehide`).
- **Half of what the owner asks for exists in pieces**: Settings > Advanced already has a filter field (`SettingsPanel.tsx:244-250`), a `?tab=settings&section=sender` deep link is already used by `CampaignsTab`, tab and filter state already live in the URL (`AdminAnnounce.tsx`, `Admin.tsx` `setParam`), and sonner and the Radix popover/dropdown are installed. New code is mostly composition.
- **No admin audit-log or API-token page exists.** Audit log is MCP-only (`read_audit_log`); "API tokens" in the admin are MCP grants on `/admin/connections`. Listed under what they really are.
- Several pages hard-code English (`Admin.tsx`, `AdminAreas.tsx`, `AdminConnections.tsx`, `AdminTranslations.tsx`); each migration PR moves what it touches into the words files (he + en).

---

## 2. Screen-by-screen table

Legend: **Today** = what one row/card shows at 390px (text facts counted). **NEED** = the 1-3 facts for the owner's task at a glance, with the reason. **Sheet** = what moves to the detail sheet. **Encode** = text becoming an icon/visual. **Bulk** = bulk actions (or why none).

### A. Marketing (`pages/AdminAnnounce.tsx`, `components/admin/announce/**`)

| # | Screen | Today per row at 390 | NEED (and why) | Into the sheet | Encode | Bulk |
|---|---|---|---|---|---|---|
| S1 | **Inbox list** (`inbox/InboxRow.tsx`, `InboxTab.tsx`, `Chips.tsx`, `inbox.css`) | kind icon, 2-3 line title, relative time, "New" tag, 4 EMPTY circles, "Ready"/"Long description" chip, 2 full-width buttons. 7-8 text facts + 2 big buttons | Task: *what is new on the site that I should post?* -> kind icon, title, relative time, new dot, 4 channel glyphs (filled = posted) | caption editor, previews, per-channel Copy / Open / Mark posted, readiness details, language | channels: LinkedIn, X, Instagram, email glyphs, filled/outline. "New" -> dot. "Ready" -> nothing; issue -> one triangle glyph | Mark read, Mark posted on a channel, dismiss |
| S2 | **Composer** (`inbox/Composer.tsx` 617, `EventCard.tsx` 397) | full page: language seg, 4 channel tabs, caption textarea, 3 card formats, previews, checks drawer, key hints | caption + the one channel's Copy | is itself the detail; becomes the sheet body at full snap | channel tabs -> 4 glyph tabs with posted tick; char counter -> MiniBar vs limit | none |
| S3 | **New announcement** (`inbox/NewAnnouncement.tsx`) | inline form | kind + title | form in a half sheet | kind -> icon grid | none |
| S4 | **Campaigns list** (`campaigns/CampaignsTab.tsx`) | table: bold name / subject (truncate) / date line / status pill; sent, failed, skipped hidden < md. 4-5 facts [shot] | *Is anything sending, did it go out, did it go wrong?* -> name, lifecycle stepper dot, sent/total bar while active, relative time | subject, counters, start/finish, open campaign | status pill -> 4-step stepper (draft > scheduled > sending > sent; paused/failed/canceled as side branch); counters -> segmented MiniBar | none (sending is irreversible); keep "Pause all sending" visible |
| S5 | **Campaign editor, review, progress** (`campaigns/CampaignEditor.tsx` 608, `Progress.tsx`, `BudgetPlan.tsx`, `SendingSwitch.tsx`) | 4-step form; review `dl` subject/from/to/when; progress `dl` of 4-5 big counters + `<progress>` + 2 timestamps; action bar with 3 buttons | review: to whom (count), when, from. progress: done/total + failed only if > 0 | subject, full counters, times, budget plan, test send | review `dl` -> Journey (sender > audience + count, clock chip); counters -> funnel MiniBar; budget -> Gauge | none |
| S6 | **Audience contacts** (`audience/AudienceTab.tsx`, `Why`, `Email.tsx`) | search + 2 selects + 3 buttons above the list (a full screen [shot]); row: email (wraps), why-sentence, status word, Edit button. 4 facts | *Who is this, can I mail them?* -> email + mailable glyph | name, language, groups, consent record, why-text, edit | status word + sentence -> one glyph (MailCheck / Hourglass / MailX / ShieldBan); only non-mailable drawn loudly | Add to / remove from group, suppress, export selected, delete |
| S7 | **Audience filters + actions** (same file, toolbar) | ~10 stacked controls | search | Group/Status/Language -> FilterSheet; Add/Import/Export -> one "+" sheet | active filters as removable chips | n/a |
| S8 | **Groups panel** (`audience/GroupsPanel.tsx`) | name, "locked", count, Rename + Delete (+ confirm row) | name + member count | rename, delete (confirm), lock explanation | count -> number + share bar | none (few groups) |
| S9 | **Suppression list** (`audience/SuppressionPanel.tsx`) | email or hash-only, "since <date>", remove + confirm text | email, since (relative) | remove + explanation, bulk-add form | since -> relative | Select: remove from list (confirm sheet) |
| S10 | **Library: templates** (`library/LibraryPanel.tsx`, `TemplateEditor.tsx`, `VisitorTemplates.tsx`) | 2 selects + New + Starter + hint, then per template: name, "channel . lang . Default", default checkbox, Open, Duplicate, Remove. 6 controls per row | name, channel glyph, language chip, default star | open, duplicate, remove, set default | channel text -> glyph; Default -> star; lang -> EN/עב chip | Select: duplicate, remove |
| S11 | **Library: built-ins (8 cards) + snippets** (`LibraryPanel.tsx:187`, `SnippetsEditor.tsx`) | "channel . lang", "customised"/"built-in", Open | channel glyph + lang | open editor | "customised" -> dot | none |
| S12 | **Settings: Everyday + Channels** (`announce/SettingsPanel.tsx` 274) [owner shot] | 2 checkboxes each with 2-3 lines of hint, "Channels in the kit" 5 checkboxes, hashtags field + hint, signature field + hint, reset | one summary line per group: "Email on . Alerts on . 4 of 5 channels" | all help text (info popover), hashtags and signature editors, reset | checkbox -> Switch; channel checkbox list -> one Channels row showing 5 glyphs | none |
| S13 | **Settings: sender & delivery** (`sender/SenderSection.tsx` 332) | long form, 2-col grids collapse, identity checklist `ul` | "Sender complete" yes/no | the fields | checklist -> row of check/alert glyphs; address -> Journey from-node | none |
| S14 | **Settings: mail budget / sending limits** (`sender/BudgetMeter.tsx`, `useBudget.ts`) | two `<progress>` bars with "x of y" text, reserved line, room line, threshold line, note. 6+ facts | *Can I still send today / this month?* -> two gauges + one sentence only when waiting or > 70% | reserved, note, resume time | `<progress>` -> Gauge (thresholds 70/90 from `useBudget`) | none |
| S15 | **Settings: alerts** (`notify/NotifySection.tsx`) | toggles + helper text | master on/off + count of alerts | per-alert switches | Switch + "2 alerts" summary | none |
| S16 | **Settings: Advanced** (UTM, notify detail; `SettingsPanel.tsx` Disclosure at 232, filter at 244) | closed disclosure, then a filter field and ~6 field groups with hints | nothing by default (rare) | everything, one group page | Disclosure -> an "Advanced" SettingsRow with "Link tags: default" summary | none |
| S17 | **Marketing tab strip** (`AdminAnnounce.tsx:88`, `.a-tabs`) | 6 tabs scroll; last two off-screen [shot, audit M3] | current section | n/a | becomes a sidebar sub-group (S30); strip stays at >= lg | n/a |

### B. Content admin and shell

| # | Screen | Today per row at 390 | NEED (and why) | Into the sheet | Encode | Bulk |
|---|---|---|---|---|---|---|
| S18 | **Overview stats** (`pages/AdminOverview.tsx`: 7 `Stat` tiles) | tile: icon, label, big value, detail sentence | *Anything that needs me?* -> drafts, notes with unpublished changes, unread marketing; the rest is trivia | detail sentences, sizes | 7 tiles -> 3 attention tiles + a one-line totals strip with icons | none |
| S19 | **Overview activity + "Continue"** (same file) | kind icon, title link, kind word, did word, state pill, relative time. 4 facts | what changed and when | kind/did words | did-verb -> small glyph; pill -> glyph | none |
| S20 | **Posts list** (`pages/Admin.tsx`) | title, area, "N min", all tags as chips, relative time, StatePill + changes pill + HE pill, external link. 7+ facts | *which note to finish or fix?* -> title, state glyph, HE glyph only when missing/stale | area, reading time, tags, time, view on site | 3 pills -> one StatusGlyph (+ changes overlay); time relative | Select: publish, unpublish, archive, move to area, delete |
| S21 | **Areas list** (`pages/AdminAreas.tsx`) | title, "Site notes/Project", `/slug`, hidden pill, HE pill, repo, count, status, order. 5-6 facts | name, kind icon, count, hidden marker | slug, repo, order, HE detail | kind -> icon; hidden -> EyeOff | Select: hide/show, move up/down |
| S22 | **Area detail** (`pages/AdminCollection.tsx` 403) | same row shape as S20 + forms | as S20 | as S20 | as S20 | as S20 |
| S23 | **Projects list** ("Order on the site", `pages/AdminProjects.tsx`, `content/Fields.tsx` ListField) | row clips 17..407 at 390 (audit M1): HE pill, "Edit", up/down/x | title + move affordance | edit form | up/down menu or Reorder mode with GripVertical | Reorder, delete |
| S24 | **Media grid** (`components/admin/MediaGrid.tsx`, `pages/AdminMedia.tsx`) | tile: thumb, video badge, alt, `WxH . size . used N times` | thumbnail + "unused" marker | alt, caption, size, added, URL, used-by, replace, delete | meta line -> corner badges (Film + duration, Link2 + count); unused -> dashed outline | Select: delete unused, copy URLs |
| S25 | **Media detail** (`AdminMedia.tsx:276`) | `dl` kind/size/added/URL + forms | preview + alt | is the detail: full-snap sheet | URL -> copy button | none |
| S26 | **Translations** (`pages/AdminTranslations.tsx`) | HE pill, title, type word, field list, private word, `/he/route`, Edit. 5 facts | which items lack or have stale Hebrew -> title + status glyph | fields, route, private, edit | status -> glyph (5 states); type -> icon | Select: mark verified |
| S27 | **Connected apps** (`pages/AdminConnections.tsx`; the "API tokens" screen: MCP grants) | client, "Read and write"/"Read only", last used, connected, **Revoke** button; ended: revoked/expired text. 4-5 facts | client, access glyph, last used (relative, "never" highlighted) | connected date, scopes, revoke (confirm), reason | access -> KeyRound / Eye; ended -> glyph | Select: revoke (confirm sheet) |
| S28 | **Settings version history** (`pages/AdminSettings.tsx:473`) | "Version N . 3 differences", time, Restore | version + when | what changed, Restore | time relative | none |
| S29 | **Editor save bar / StatusPill** (`components/admin/StatusPill.tsx`, `AdminShell.tsx:351`, `.a-bottom`, audit M4) | words Unsaved / Saving / Saved 12:03 / Changed elsewhere + 3 buttons, up to 3 rows | save state + primary action | secondary actions | glyph per `SaveState.kind`; word only on failure | none |
| S30 | **Admin sidebar / drawer nav** (`components/admin/AdminShell.tsx:285`, `GROUPS` at line 94: flat list of sections, Marketing is one item) | drawer of flat links with icons | where am I, where can I go | sub-sections (Marketing: Inbox, Audience, Campaigns, Library, Settings > groups) | collapsible SidebarGroup with counts and a current marker | n/a |

**Dashboard / History widgets** (`components/dashboard/History.tsx`, `Timeline.tsx`, `Parts.tsx`): day groups of `HistoryRow` (title, date, topic chips, copy link) and a repo fact `dl`. NEED: date + title; chips -> FilterChips (topic filter); facts -> MiniBar. Migrated in PR14. **Audit log**: no admin UI (MCP `read_audit_log` only); if one is added, start from RecordRow + Journey for "from > to" changes.

Counts: 30 surfaces (17 marketing, 13 content/shell) plus the History widgets. Rows with 5+ text facts today: S1, S4, S6, S10, S18, S19, S20, S21, S24, S26, S27 (11 of 30).

### Phone budget (the testable numbers)
- RecordRow: <= 2 text facts beside the title, <= 1 status glyph, <= 1 trailing control (chevron), 0 buttons; title <= 2 lines; min-height 56px, never < 44px.
- A list page: <= 1 primary action visible (the rest under "+" or "..." in a sheet), <= 2 filter affordances visible (search + Filters button) plus the chips row.
- A settings group page: one-line labels, 0 visible help paragraphs unless a warning, switches for on/off.

---

## 3. Component specs

New files under `web/src/components/admin/mobile/` (CSS module, `index.ts`). Tokens come from #666 (`--a-r-*`, `--a-dur-*`, `--a-ease-*`); no raw values. All text through the words files (he + en). Desktop (>= 600px) keeps its tables and forms; each screen switches by `usePhone()` (`matchMedia("(max-width: 599px)")`), so no desktop regression and smaller diffs.

### 3.1 RecordRow

```ts
type Fact = { icon?: LucideIcon; text: string; label?: string; dir?: "ltr" | "auto" };
type RecordRowProps = {
  icon: LucideIcon | ReactNode;       // leading kind icon, 20px in a 40px tinted circle
  title: string;                      // dir="auto", <bdi>, 2-line clamp
  facts?: [Fact?, Fact?];             // at most TWO
  status?: ReactNode;                 // one <StatusGlyph/> or <ChannelRow/>
  unread?: boolean;                   // 8px dot at inline-start + sr-only "new"
  selectable?: boolean; selected?: boolean;   // selection mode: leading icon swaps to a checkbox (44px hit)
  onOpen: () => void; openLabel: string;      // whole row; aria-label "Open <title>"
  onLongPress?: () => void;           // enters selection mode (never the only path)
  trailing?: "chevron" | ReactNode;
  as?: "li" | "div" | "a";
};
```
- Whole row is ONE `<button>` (or `<a>`): one tab stop, `min-height: 3.5rem`, `touch-action: manipulation`, inset focus ring.
- Grid `auto minmax(0,1fr) auto auto` so the title column has `min-width: 0`; logical properties only; chevron mirrors in RTL (clock, check, brand glyphs never).
- Hover styles only inside `@media (hover: hover)`; press `scale(.98)` 100ms, none under reduced motion.
- Long-press 450ms, cancelled by > 8px movement; paired with a visible Select button.
- Test hooks: `data-record-row`, `.rr-fact`.

### 3.2 BottomSheet (native `<dialog>`)

```ts
type BottomSheetProps = {
  open: boolean; onClose: () => void | boolean | Promise<boolean>; // return false to veto (dirty form)
  title: string;                         // aria-labelledby, visible in the header
  snap?: "peek" | "half" | "full";       // initial, default "half"
  snaps?: Array<"peek" | "half" | "full">;
  onSnap?: (s: Snap) => void;
  dismissible?: boolean;                 // default true
  footer?: ReactNode;                    // sticky, safe-area padded; the primary action lives here
  children: ReactNode;
};
```
Heights: peek = content up to 30dvh (min 168px), half = 55dvh, full = 92dvh (status bar stays visible so it reads as a sheet). Body scrolls inside (`overscroll-behavior: contain`); drag starts from the handle/header, or from the body only when `scrollTop === 0` and the finger moves down.

Behaviour contract (each line is a test in PR1):
1. Native `<dialog>` + `showModal()`: free focus trap, inert background, top layer, Esc fires `cancel`. jsdom fallback `setAttribute("open","")` like the existing modals.
2. Focus moves to the title (`tabIndex=-1`), not the first field (no keyboard pop on phones); returns to the opener captured before `showModal` (as `audience/Modal.tsx` does).
3. **Back button closes it**: on open `history.pushState({ sheet: id }, "")`; `popstate` closes; on programmatic close, if our pushed state is still current, `history.back()` once. One sheet at a time (never stacked, principle 64): opening a second replaces.
4. **Handle** = a 44px-tall `<button aria-label="Resize panel">` around a 36x4 pill; Enter/Space cycles peek > half > full; ArrowUp/ArrowDown step. Dragging is never the only way (WCAG 2.5.7). Plus a visible Close (X) at inline-end.
5. **Drag**: pointer events with `setPointerCapture`, 1:1 tracking via `transform: translateY` only, release picks the nearest snap by position + velocity (flick > 0.5px/ms goes to the next), below peek by > 25% dismisses; rubber-band at the top; settle 260ms with the `--a-ease-*` token.
6. **Reduced motion**: no slide, no spring; the sheet appears at its snap with a 1ms opacity step; dragging still works (user-driven). JS listens to the `matchMedia` change.
7. **Safe area**: footer `padding-block-end: calc(var(--space-3) + env(safe-area-inset-bottom))`; body `scroll-padding-block-end` = footer height (focus not obscured, 2.4.11). Landscape (< 480px high): forced `full`, no snap cycling.
8. **RTL**: logical properties; close at inline-end; mirrored chevrons. Tested in `dir=rtl`.
9. Close, handle and footer buttons >= 44x44 with 8px gaps.
10. Scroll lock via the top layer plus `html:has(dialog[open]) { overflow: hidden; scrollbar-gutter: stable }` (no `position: fixed` jump).
11. >= 600px: a centred 560px dialog, snaps ignored (principle 68).
12. Keyboard: Tab/Shift+Tab cycle inside, Esc closes (if dismissible).
13. Backdrop click closes; `cancel` is `preventDefault`-ed and routed to `onClose` so state stays the single source of truth (what the current modals do).

**Decision table: in-house vs vaul**

| | In-house `<dialog>` | vaul |
|---|---|---|
| Licence | ours | MIT |
| Maintenance | ours | README: "This repo is unmaintained"; 135 open issues, 27 PRs (fetched) |
| New dependency | none (owner vets dependencies) | yes; size and dependency list not verifiable from the page |
| Focus trap / inert / Esc | native | Radix JS |
| Back button | ~15 lines | not provided |
| RTL | ours, tested | not documented |
| Snap points | ours (3 fixed, ~80 lines) | supported (not verified) |
| Cost | ~250 lines + ~200 lines tests (PR1) | less code now, a stale gesture dependency forever |

**Recommendation: build in-house.**

### 3.3 SelectionBar + `useSelection` + UndoToast

```ts
const sel = useSelection<string>(ids);   // { on, enter(id?), exit(), toggle(id), has(id), all(), none(), count, ids }
<SelectionBar selection={sel} total={items.length}
  actions={[{ id: "read", icon: Check, label: "Mark read", run: (ids) => ..., destructive?: boolean, undo?: (ids) => ... }]} />
```
- **Enter**: a visible "Select" button in each list header (principle 139: long-press is never the only path) and long-press on a row. Esc or "Done" exits; selection clears when a filter changes.
- **In mode**: rows show checkboxes (22px box, 44px hit area), row tap toggles; header reads "N selected" with All/None (`aria-live=polite`, `tabular-nums`).
- **Sticky bar** at the bottom (safe-area padded): count, up to 2 primary actions as icon + short label, and "More" opening a BottomSheet list of all actions (56px rows: icon, verb, "N items"). Destructive last, danger tone and icon, with a confirm sheet naming object and count ("Delete 3 posts" / "Keep"); never first focus.
- **Undo toast** (sonner, already in `components/ui/sonner.tsx`): `role=status`, >= 8s, pausable, above the bar; reversible actions call `undo(ids)`; irreversible server actions (Mark posted, revoke) are **deferred**: commit at toast end, cancel on Undo, flush on `pagehide`.
- Landscape < 480px high: bar is static, not sticky.

### 3.4 Journey (from > to, and the lifecycle stepper)

```ts
<Journey from={{ icon: Mail, label: "hello@...", sub?: string, dir?: "ltr" }}
         to={{ icon: Users, label: "Subscribers", sub: "1,240 people" }}
         via?: ReactNode                       // a pill on the line: clock "Fri 09:00", or a count
         state?: "idle" | "active" | "done" | "failed"   // line: dashed / animated dash / solid / broken
         orientation?: "horizontal" | "vertical"
         mode?: "journey" | "stepper"; steps?: {id, icon, label}[]; current?: string />
```
- Horizontal: two 36px circular nodes (icon inside), a 2px line between with the `via` pill centred; labels below each node, 2 lines max, `min-width: 0`. DOM order is from, then to; in RTL the line runs right-to-left (matches Hebrew reading) and the arrowhead mirrors. Text uses `<bdi>`.
- Vertical stepper: lifecycle (draft > scheduled > sending > sent). done = filled check, current = ringed, future = outline; paused / failed / canceled draw as a **side branch** off the current node, not as extra steps. A compact 4-dot horizontal form is used in list rows.
- The graphic is `role="img"` with a composed `aria-label` ("From hello@..., to Subscribers, 1,240 people, Friday 9:00") next to real visible text; graphics never carry the only information.
- Animated dash only for `state="active"` and not under reduced motion.
- Used for: campaign review (sender > audience), campaign row lifecycle, audience import (file > list), translation (EN > HE), Settings > sender address, future audit-log "from > to".

### 3.5 StatusGlyph

```ts
<StatusGlyph kind="draft"|"scheduled"|"sending"|"sent"|"paused"|"failed"|"canceled"|"published"|"changes"|"hidden"|"archived"|"active"|"revoked"|"expired"
             |"missing"|"stale"|"unverified"|"translated"|"mailable"|"pending"|"unsubscribed"|"suppressed"
             size?: 16 | 20 | 24; withWord?: boolean; showDefault?: boolean />
```
- One table kind > {icon, tone, wordKey}; 4 tones only (neutral, ok, attention, danger); at most ONE coloured glyph per row. Colour never alone: shapes differ, word is `sr-only` + `title`; a visible word shows only with `withWord` (sheets).
- **Defaults draw nothing** on a row (`published`, `active`, `mailable`, `translated`) unless `showDefault`.
- Test: table-driven over every kind: an `svg[aria-hidden]` and an accessible name in en and he; a new kind without an icon fails CI.
- Replaces progressively `StatePill` (`admin/ui.tsx`), `TranslationPill`, `campaigns/status.ts pillState`, `Chips.tsx`. `StatePill` stays at >= md until every screen migrates. The existing `.a-pill` marks (round = published, outline = draft, rotated square = changes) are kept as the shapes so old and new look related.

### 3.6 MiniBar and Gauge

```ts
<MiniBar parts={[{ value: 120, tone: "ok", label: "sent" }, { value: 3, tone: "danger", label: "failed" }, { value: 8, tone: "muted", label: "skipped" }]} total={140} height={6} label="120 of 140 sent, 3 failed, 8 skipped" showNumber? />
<Gauge value={310} max={500} thresholds={[0.7, 0.9]} label="Today: 310 of 500" size={72} center={<b>62%</b>} />
```
- MiniBar: one `role="img"` element with an `aria-label`; CSS-grid segments by `flex-grow`, 6px high, full radius, 1px gaps; failed uses a hatch so colour is not alone; zero total renders an empty track (no NaN); numbers beside it `tabular-nums` `dir="ltr"`.
- Gauge: ring/semicircle SVG, `stroke-dasharray`, tone steps at the existing 70/90% thresholds; a visually hidden native `<meter>`/`<progress>` carries the real value for AT and tests; no animation under reduced motion.
- Where the exact number IS the decision (recipient count on the send confirm) the number is the headline and the bar secondary.

### 3.7 ChannelRow (the Inbox's four glyphs)
`<ChannelRow done={{ linkedin: iso, x: undefined, instagram: undefined, email: iso }} />`, fixed order LinkedIn, X, Instagram, email (position carries meaning before the eye learns the logos).
- Four 20px glyphs, 6px gap. **Filled + tiny check corner = posted; outline = not yet.** Each `role="img"` with a name like "LinkedIn: posted" / "LinkedIn: not posted yet" (he + en); group `role="group"`, `aria-label` "Where it is posted".
- Not interactive in the row; in the sheet each channel is a 44px tab with the same glyph.
- Needs `ChannelIcon` (4 inline SVGs, Q2). `gmail` (a fifth key in `ANNOUNCE_CHANNELS`) folds into email, as `InboxRow.tsx` does today.

### 3.8 Settings kit: SettingsList, SettingsRow, Switch + InfoPopover, SettingsSearch

**SettingsList** (iOS grouped list). Props: `groups: SettingsGroupDef[]`, `value` (the live settings doc), `openId` (from the URL `?tab=settings&section=<id>`, so a group is a deep link and Back closes it).
```ts
type SettingsGroupDef = {
  id: "everyday" | "channels" | "sender" | "limits" | "alerts" | "advanced";
  icon: LucideIcon; title: string;
  summary: (doc) => string;           // ONE line, live: "Email on . 2 alerts", "4 of 5 channels", "Sender complete", "310 / 500 today"
  warning?: (doc) => string | null;   // shown on the row in the attention tone, only when something is wrong
  render: (ctx) => ReactNode;         // the group's content (SettingsRow / fields)
};
```
- Phone: a rounded grouped container (radius 16, hairline separators inset from the icon edge), each row = icon (28px tile), name, summary (one line, ellipsis), chevron, min 56px. Tap puts `section` in the URL and opens the group as a **sub-page** (route-level, full screen, with a back link) for groups with fields; for groups of 4 or fewer switches it opens as a **half BottomSheet**. One rule keeps this predictable: more than 4 controls or any text field = sub-page; otherwise sheet.
- >= 840px: list-detail two-pane (principle 11): list at start, group content at end, same URL state.
- Summaries are pure functions of the doc, so they update live as switches flip (`aria-live="polite"` only on the changed row's summary).
- The existing Save bar logic (`useSettingsDoc`, dirty/conflict/reset) stays one level up; a sub-page shows "Unsaved" in its header and the shared sticky Save in the footer (safe-area padded).

**SettingsRow** (one setting inside a group).
```ts
type SettingsRowProps = {
  id: string; label: string;            // ONE line, truncates with a title attr; never wraps to 3 lines
  kind: "switch" | "value" | "text" | "choice";
  checked?: boolean; onChange?: (v: boolean) => void;   // switch
  valueText?: string;                   // "value" kind: current value on the end side + chevron to edit in a sheet
  info?: string;                        // the long help; behind the info button
  warning?: string | null;              // always visible when set, attention tone, with TriangleAlert
  disabled?: boolean; dirty?: boolean;  // dirty shows a small dot
};
```
- The whole row (label + switch) is one hit target >= 56px tall; the info button is a **separate** 44x44 target (never nested inside the label).
- **Switch** = native `<input type="checkbox" role="switch">` (keeps form semantics), 51x31 visual, label associated, whole-row tap, no layout shift. It replaces every on/off checkbox in Settings (`SettingsPanel.check()` at line 85, `NotifySection`, the template "default" checkboxes in S10). A multi-choice set (Channels in the kit) becomes one row "Channels" whose value is the 5 glyphs, opening a sheet of 5 switch rows (channel icon + name) (Q8).
- **InfoPopover**: an `Info` icon button (`aria-label` "About <label>" / "על <label>") opening the existing Radix `components/ui/popover.tsx`; on touch it opens by tap and shows the long text (max about 3 lines, the rest scrolls), closes on outside tap / Esc, returns focus to the button. The text is in the DOM only when open, so the switch also gets `aria-describedby` pointing to an sr-only copy of the FIRST sentence (screen readers still hear the gist). Never hover-only (principles 21, 31).
- Only warnings stay visible: e.g. "Email is on but no sender address", "Hashtags look wrong". A warning also puts the attention glyph on the group's row in the list.
- Text fields keep a visible label (principle 72) but their hint goes behind the same info button; the character counter and the error stay visible.

**SettingsSearch**: one `type="search"` field at the top of SettingsList, `enterkeyhint="search"`, 16px font. Matching runs over each setting's label + info (the existing filter at `SettingsPanel.tsx:244` already does this for Advanced; generalise it). With a query the list switches to a flat result list of SettingsRows ("Group > Label" as a second line); tapping jumps to the group page with that row scrolled into view and focused. An empty result offers "Clear search". A `role=status` line shows the count.

**Group map for Marketing > Settings** (what each current control becomes):

| Group (icon) | Summary example | Contents (all one-line labels) |
|---|---|---|
| Everyday (`SlidersHorizontal`) | "Email on . Alerts on" | Switch: email on/off; Switch: alerts on/off; hashtags (value row); signature (value row) |
| Channels (`Radio`) | "4 of 5 channels" | 5 channel switch rows with channel glyphs |
| Sender & delivery (`Send`) | "Sender complete" or warning "Address missing" | From name, address, reply-to, footer identity, test recipients (`SenderSection`) |
| Sending limits (`Gauge`) | "310 of 500 today" | Gauges for day + month (`BudgetMeter`), thresholds |
| Alerts (`Bell`) | "2 alerts" | per-alert switches (`NotifySection`) |
| Advanced (`Wrench`) | "Link tags: default" | UTM source, medium per channel, reset (`SettingsPanel` advanced block) |

### 3.9 Filters kit: FilterChips, FilterSheet, useSavedFilters

```ts
type FilterDef =
  | { id: string; kind: "segmented"; label: string; options: {value, label, icon?, count?}[] }
  | { id: string; kind: "multi"; label: string; options: {value, label, count?}[]; searchable?: boolean }  // searchable when > 8 options
  | { id: string; kind: "range"; label: string; min?: string; max?: string; presets?: {label, from, to}[] }; // date range
<FilterChips defs={defs} value={filters} onChange={set} common={["status", "group"]} onOpenSheet={...} resultCount={n} />
<FilterSheet defs={defs} value={filters} onApply={set} resultCount={n} />
const [filters, set] = useSavedFilters("audience", defs);
```
- **FilterChips**: a horizontally scrollable row (scroll-snap, edge fade, `role="toolbar"`, arrow keys move) of 3-5 **common** filters as toggle chips (e.g. Status: Active / Pending, Language: EN / עב), then a trailing **"Filters" button with a count badge** (number of active filters, `tabular-nums`) that opens the FilterSheet, and "Clear all" (visible only when the count is > 0). Active filters render as removable chips ("Status: Pending x", the x is a 44px target). Chips >= 44px hit height at phone width, 8px gaps.
- **FilterSheet**: BottomSheet (half, expandable) with sections in a fixed order: segmented controls (status: a `role="radiogroup"` pill row), multi-select lists (checkbox rows; a search field above 8 options; select all/none), date range (two native `type="date"` inputs + presets "7 days / 30 days / This year"). Footer: **"Show N results"** primary (N updates live from the local list or a count call) and "Reset". Changes apply only on "Show" (the list behind does not jump while choosing); Esc/back discards.
- **useSavedFilters(key, defs)**: the URL search params are the source of truth (shareable, Back-friendly, already the pattern in `Admin.tsx` `setParam` and `AdminTranslations`); on a first visit with an empty URL it restores the last-used set from `localStorage` (`admin.filters.<key>`, wrapped in try/catch); "Clear all" clears both. Defaults are never written to the URL. Remembering is per screen, per browser; a restored set shows a small "Filters restored" note with Undo, so a remembered filter can never silently hide rows.
- A list with active filters always shows "N of M" with `role=status`, and an empty-by-filter state offers "Clear filters" (the pattern `Admin.tsx` already has).
- Screens and their filters: **Audience** (search, group multi, status segmented, language), **Campaigns** (status multi, date range), **Posts** (state segmented, area multi, Hebrew status, tag multi), **Media** (kind segmented: image/video/icon, used/unused, date range), **History** (topic multi, date range); later **Translations** (status/type/visibility already URL params) and **Inbox** (kind, posted/not posted, unread).

### 3.10 SidebarGroup (hierarchical admin nav)

```ts
type NavNode = { id: string; label: string; icon: LucideIcon; to: string; badge?: number; children?: NavNode[] };
<SidebarGroup node={marketing} current={pathname + search} defaultOpen={containsCurrent} />
```
- Parent row = a link + a separate 44px chevron toggle (`<button aria-expanded aria-controls>`), so tapping the label navigates and tapping the chevron expands (APG disclosure navigation; not a menu role). Children are an indented `<ul>` with a start-side rail; **the current section is highlighted** (`aria-current="page"`, ring on the icon like the existing `Ring` mark) and its ancestors show a quiet active tint.
- Depth capped at 3: Marketing > Settings > Sender & delivery. Deep links are plain URLs (`/admin/marketing?tab=settings&section=sender`), the same ones the pages already read.
- The group containing the current route opens automatically; manual open/closed state is remembered per group in `localStorage` (try/catch), but the active path is always open.
- Counts roll up: the Marketing parent shows the unread number if a child has one (today the `AnnounceNavBadge`), children show their own.
- Phone: inside the existing drawer (`AdminShell.tsx:285`; scrim and focus handling stay); >= lg: the same component in the permanent sidebar. A `NAV` tree replaces the flat `GROUPS` array: top (Overview), Content (Posts, Areas, Projects, Story, Site copy, Media, Translations), Marketing (Inbox, Audience, Campaigns, Library, Settings > Everyday, Channels, Sender & delivery, Sending limits, Alerts, Advanced), then the site group (Connected apps, Settings). Keyboard: Up/Down through visible items, Right/Left expand/collapse (flipped in RTL), Home/End.
- The Marketing tab strip (S17) stays at >= lg and is hidden below lg (the drawer carries it); until PR7 nothing changes.

---

## 4. Icon vocabulary

One file `components/admin/mobile/icons.ts` exports `ICON: Record<Concept, LucideIcon | ChannelGlyph>` and `iconWords.ts` the he/en labels. **One concept, one icon, everywhere**; a new icon needs a row here. 16/20/24px, stroke 2 (1.75 at 16), `aria-hidden` unless it is the only content (then `role="img"` + name). Directional icons (chevrons, arrows) mirror in RTL; clocks, checks, play, brand and charts do not. Names marked (*) were verified present in the installed lucide 1.69.0.

| Concept | Icon | aria-label en | aria-label he |
|---|---|---|---|
| **Records** | | | |
| Note / post | `FileText`* | Note | פוסט |
| Release | `Rocket`* | Release | גרסה |
| Project | `FolderKanban`* | Project | פרויקט |
| Area | `Shapes`* | Area | תחום |
| Story | `User`* | Story | סיפור |
| Home page | `Home`* | Home page | דף הבית |
| Custom announcement | `Megaphone`* | Announcement | הודעה |
| Image / video / icon | `Image`* / `Film`* / `Shapes`* | Image / Video / Icon | תמונה / וידאו / אייקון |
| Connected app | `Plug`* | Connected app | אפליקציה מחוברת |
| Access write / read | `KeyRound`* / `Eye` | Read and write / Read only | קריאה וכתיבה / קריאה בלבד |
| **State** | | | |
| Draft | `PenLine` (dashed ring) | Draft | טיוטה |
| Unpublished changes | `CircleDot`* overlay | Unpublished changes | שינויים שלא פורסמו |
| Published / live / mailable | `CircleCheck`* (only on request) | Published | פורסם |
| Scheduled | `CalendarClock`* | Scheduled | מתוזמן |
| Sending | `Send`* (animated dash) | Sending | בשליחה |
| Sent | `CheckCheck` | Sent | נשלח |
| Paused | `Pause`* | Paused | מושהה |
| Failed / error | `CircleX`* | Failed | נכשל |
| Canceled / archived | `Archive` | Archived | בארכיון |
| Warning / needs a look | `TriangleAlert`* | Needs attention | דורש תשומת לב |
| Hidden | `EyeOff`* | Hidden | מוסתר |
| Revoked / expired | `Ban`* / `Hourglass`* | Revoked / Expired | בוטל / פג תוקף |
| New / unread | 8px dot (not an icon) | New | חדש |
| Loading | `Loader`* (static under reduced motion) | Loading | טוען |
| **Audience** | | | |
| Contact | `UserRound` | Contact | איש קשר |
| Mailable | `MailCheck`* | Can be mailed | ניתן לשלוח |
| Pending confirm | `Hourglass`* | Waiting to confirm | ממתין לאישור |
| Unsubscribed | `MailX`* | Unsubscribed | ביטל הרשמה |
| Suppressed | `ShieldBan`* | Blocked from mail | חסום לדיוור |
| Group | `Users` | Group | קבוצה |
| Language | `Languages`* | Language | שפה |
| **Translation** | | | |
| Missing / stale / draft / unverified / translated | `CircleDashed` / `RefreshCw` / `PenLine` / `CircleHelp` / `Check` on an "עב" badge | Hebrew missing / out of date / draft / unverified / done | עברית חסרה / לא עדכנית / טיוטה / לא מאומתת / הושלמה |
| **Channels** (brand glyphs, NOT lucide, Q2) | `ChannelIcon` | LinkedIn / X / Instagram / Email | לינקדאין / X / אינסטגרם / אימייל |
| Email (fallback) | `Mail`* | Email | אימייל |
| **Journey** | | | |
| From | `Mail`* / `AtSign`* | From | מאת |
| To | `Users` | To | אל |
| Time | `Clock`* | When | מתי |
| Direction | `ArrowRight`* (mirrors) | to | אל |
| **Metrics** | | | |
| Budget | `Gauge`* | Mail budget | תקציב דיוור |
| Sent / failed / skipped | `Check`* / `CircleX`* / `MinusCircle` | Sent / Failed / Skipped | נשלח / נכשל / דולג |
| Used in N places | `Link2`* + number | Used in N places | בשימוש ב-N מקומות |
| Unused | `Unlink` | Not used | לא בשימוש |
| **Settings** | | | |
| Everyday / general | `SlidersHorizontal` | Everyday | יומיומי |
| Channels | `Radio`* | Channels | ערוצים |
| Sender & delivery | `Send`* | Sender and delivery | שולח ומשלוח |
| Sending limits | `Gauge`* | Sending limits | מגבלות שליחה |
| Alerts | `Bell` | Alerts | התראות |
| Advanced | `Wrench` | Advanced | מתקדם |
| Help / info | `Info` | About this setting | על ההגדרה |
| Search settings | `Search` | Search settings | חיפוש בהגדרות |
| **Actions** | | | |
| Open (row) | `ChevronRight`* (mirrors) | Open | פתח |
| Expand / collapse | `ChevronDown` | Expand | הרחב |
| Copy | `Copy`* | Copy | העתק |
| Open external | `ExternalLink`* | Open in new tab | פתח בלשונית חדשה |
| Mark posted | `CircleCheck`* | Mark posted | סמן כפורסם |
| Select / select all | `ListChecks`* / `SquareCheckBig`* | Select / Select all | בחירה / בחר הכול |
| Filter / sort | `SlidersHorizontal` / `ArrowUpDown` | Filter / Sort | סינון / מיון |
| Clear filters | `FilterX` | Clear all | נקה הכול |
| Add | `Plus` | Add | הוספה |
| More | `Ellipsis` | More actions | פעולות נוספות |
| Delete | `Trash2`* (danger) | Delete | מחיקה |
| Undo | `Undo2`* | Undo | ביטול פעולה |
| Reorder | `GripVertical`* + Up/Down menu | Move | הזזה |
| Restore version | `History`* | Restore | שחזור |
| Close sheet | `X` | Close | סגירה |
| Resize sheet | pill (not an icon) | Resize panel | שינוי גודל החלונית |

Icons without a * were not individually checked in the installed package; PR1's guard test imports every entry, so a missing name fails CI at once. Tones: 4 only (neutral `--ink-soft`, ok `--signal`, attention `--ink` with dashed outline, danger `--destructive-ink`).

---

## 5. PR plan (dependency order)

Sizes: S < 150 changed lines, M 150-400, L 400-800 (tests included). Each PR: failing-first tests in the same PR, `npm run typecheck && lint` in `web/`, 390x844 screenshots (LTR/RTL, light/dark) in the body, `audit/admin-matrix.mjs` baseline updated, follow BRIEF (stay inside your files). To avoid conflicts in `i18n/admin.ts` and `index.css`, PR1 creates a `mobile` words namespace and every PR appends only inside its own namespace; styles use CSS modules, not `index.css`.

**Graph.** PR1 (core) first. PR2 (Inbox, the FIRST screen) is written at the same time and merges right after PR1 (it codes against the section 3 props and rebases once). Then the kits PR3-PR7 are independent of each other (each needs only PR1). Then the migrations PR8-PR15 (each depends on the kits it names) run in parallel on disjoint files.

### PR1 - Shared core: BottomSheet, RecordRow, StatusGlyph, ChannelIcon, icons, words (L, ~650)
New files only: `components/admin/mobile/{BottomSheet,RecordRow,StatusGlyph,ChannelIcon,icons,iconWords,mobile.module.css,index}` + `__tests__/`. No screen changes.
Failing-first tests:
- BottomSheet: `showModal` opens it, focus lands on the title, Tab/Shift+Tab stay inside, Esc calls `onClose` once, `popstate` closes and a programmatic close calls `history.back()` once, backdrop click closes, drag down past 25% dismisses, release picks the nearest snap, handle Arrow/Enter cycles snaps (keyboard path), reduced motion removes the transform transition, `dir=rtl` renders, close/handle/footer buttons >= 44px (CSS read as in `touchTargets.guard.test.tsx`), the footer rule contains `env(safe-area-inset-bottom)`, a second open replaces the first (never two `dialog[open]`).
- RecordRow: 2 facts render exactly 2 `.rr-fact` and a third is clamped (type error + runtime); the row is one button named by `openLabel`; unread has sr-only "new"; selectable renders a checkbox with a 44px area; chevron mirrors in RTL; no button nested in the row.
- StatusGlyph: table-driven over every kind: `svg[aria-hidden]` + accessible name in en and he; defaults render nothing unless `showDefault`.
- ChannelIcon: four glyphs with he/en names; done vs not differ by `data-done` and shape, not colour only.
- Guard: every `ICON` key has a words entry (en + he) and imports cleanly.

### PR2 - Inbox, the FIRST screen (M, ~450) (S1, S2, S3)
Files: `announce/inbox/{InboxRow,InboxTab,Chips,inbox.css,words}`, new `inbox/InboxSheet.tsx`, `inbox/__tests__/*`; `Composer.tsx` gets only an `embedded` prop (drops its back button, ~5 lines). Composer stays whole at >= 600px; below 600 it renders inside the BottomSheet.

**Concrete target (owner's words).** One row = kind icon + title + relative time + new dot + four channel glyphs (LinkedIn, X, Instagram, email; filled = posted, outline = not yet; he + en names); the whole row is tappable. Tap opens the BottomSheet (starts at `half`) with the language toggle, channel glyph-tabs (posted tick), the caption editor (autosave as today), the preview (collapsed under "Preview"), and in the sticky footer per-channel **Copy** / **Open** / **Mark posted**. The repeated "Ready" pill is gone: a row shows one `TriangleAlert` glyph only when `readiness` reports issues (tone from the issue severity); the sheet lists the issues by name (the `ChecksDrawer` content). "Copy LinkedIn / Copy X" leave the rows (the `c` hotkey on desktop still copies).

Before (390px, today; 3 rows fill the screen):
```
+---------------------------------------+
| [doc]  Rebuilding the admin as a tool |
|        with a deliberately long tit.. |
|        2 hours ago             New    |
| ( ) ( ) ( ) ( )  (! Long description) |
| +----------------+ +----------------+ |
| |  Copy LinkedIn | |     Copy X     | |
| +----------------+ +----------------+ |
| [rkt]  Bothy v1.9.0                   |
|        20 hours ago                   |
| (v) ( ) ( ) ( )  (! Long description) |
| +----------------+ +----------------+ |
| |  Copy LinkedIn | |     Copy X     | |
| +----------------+ +----------------+ |
+---------------------------------------+
```
After (same data; about 7 rows visible, no buttons in rows):
```
+---------------------------------------+
| Inbox                         [Select]|
| [doc] * Rebuilding the admin as a to..|  * = new dot
|          2 h       in  x  ig  @     > |  filled = posted, outline = not yet
|---------------------------------------|
| [rkt]   Bothy v1.9.0                  |
|          20 h      IN  x  ig  @  [!] >|  IN filled = posted; [!] = one issue
|---------------------------------------|
| [doc]   The theme change, as a wave   |
|          2 d       in  x  ig  @     > |
+---------------------------------------+
tap a row ->
+---------------------------------------+
|                 ====                  |  drag handle (Enter cycles snaps)
| Bothy v1.9.0                      [X] |
| [IN]v [X] [ig] [@]          EN | עב   |  glyph tabs, tick = posted
| Caption (editable) ....       212/3000|
| [Preview v]   [! 1 issue: Long desc.] |
|---------------------------------------|
| [Copy]  [Open LinkedIn]  [Mark posted]|  sticky footer, safe-area padded
+---------------------------------------+
```
(In the real render `IN x ig @` are the LinkedIn, X, Instagram and email brand glyphs; upper case here = filled.)

Failing-first tests:
- At 390px a row has <= 3 text facts (title, time, none else), 0 buttons besides the row button, 4 `[data-channel]` glyphs each named `/posted|not posted/` (en and he), and the new marker is a dot with sr-only text.
- No element with text "Ready" when every event is ready; an event with a `long-description` issue shows exactly one alert glyph whose name contains the chip word.
- Clicking a row (not a button) opens the sheet (`role=dialog`, title); Esc closes and focus returns to the row; `popstate` closes; Copy calls `copyText`; Mark posted calls `adminAnnounce.done` only after the toast window (fake timers) and Undo cancels it.
- No horizontal overflow: row `scrollWidth <= clientWidth` with a 60-char title at 320 (Inbox added to `admin-matrix.mjs`).
- Selection: "Select" shows checkboxes and the bar with the count (uses PR3; a stub until it merges).

### PR3 - Selection: SelectionBar, useSelection, UndoToast (M, ~350)
`components/admin/mobile/{SelectionBar,useSelection,UndoToast}` + tests. Depends on PR1.
Tests: bar absent with 0 selected, appears with 1 and shows the count; All selects `total`; actions run with exactly the selected ids; "More" opens a sheet listing all actions; a destructive action asks a confirm naming the count; Undo within the window restores; Esc exits; long-press (fake timers) AND the visible Select button both enter the mode; static (not sticky) in the landscape-height CSS rule.

### PR4 - Visuals: Journey, MiniBar, Gauge (M, ~400)
`components/admin/mobile/{Journey,MiniBar,Gauge}` + tests. Depends on PR1.
Tests: Journey label composed in he and en; in RTL `from` is at inline-start (DOM order); the vertical stepper has exactly one current step; paused/failed render as a side branch; MiniBar zero total has no NaN and widths sum to 100%; Gauge tone at 69/70/90%; both expose a real value to AT; no animation under reduced motion.

### PR5 - Settings kit: Switch, InfoPopover, SettingsRow, SettingsList, SettingsSearch (M-L, ~550)
`components/admin/mobile/{Switch,InfoPopover,SettingsRow,SettingsList,SettingsSearch}` + tests. Depends on PR1 (BottomSheet for small groups) and the Radix popover already in the repo.
Failing-first tests:
- Switch: `role="switch"`, toggles with Space and by tapping the label, 44px+ hit area, `aria-checked` true/false, label associated; **no `input[type=checkbox]` without `role=switch` inside a SettingsRow** (guard).
- InfoPopover: the help text is NOT in the DOM until the button is tapped, then is; Esc closes and returns focus; the button has an `aria-label` in he/en and a 44px target; the row exposes the first sentence via `aria-describedby`.
- SettingsRow: the label is one line (`white-space: nowrap; text-overflow: ellipsis` + `title`); a `warning` is always visible with an alert glyph and role; a row without a warning shows no paragraph.
- SettingsList: each group row shows icon + name + one-line summary + chevron and no `.a-hint` paragraph; flipping a switch updates the summary text; tapping a row sets `?section=<id>` and opens the content; Back closes it; groups with > 4 controls or a text field open as a sub-page, otherwise a half sheet (`data-surface`); at >= 840 it renders two panes.
- SettingsSearch: typing matches label and info text; results show "Group > Label"; tapping a result opens the group scrolled to that row with focus; an empty result shows "Clear search".

### PR6 - Filters kit: FilterChips, FilterSheet, useSavedFilters (M-L, ~500)
`components/admin/mobile/{FilterChips,FilterSheet,useSavedFilters}` + tests. Depends on PR1.
Tests: the chips row scrolls without page overflow at 320; each chip is >= 44px high; the active-count badge equals the active filters; "Clear all" only when count > 0; the FilterSheet's "Show N results" reflects the live count and nothing applies until pressed (Esc/back discards); segmented = radiogroup; multi-select gets a search above 8 options; a date range rejects from > to; state round-trips through the URL (reload test) and is restored from `localStorage` on an empty URL with a visible "restored" note and Undo; throwing storage accessors do not break rendering.

### PR7 - Hierarchical sidebar: SidebarGroup + AdminShell nav tree (M, ~400)
Files: `components/admin/AdminShell.tsx` (nav portion only: `GROUPS` > `NAV`, ~lines 60-120 and 280-340), new `components/admin/mobile/SidebarGroup.tsx`, nav words (inside the `mobile` namespace), tests (`components/admin/__tests__/`, `AnnounceNavBadge.test.tsx` stays green). Also `pages/AdminAnnounce.tsx`: the tab strip hidden below lg, sections read from the same `?tab=`/`?section=` URL (fixes audit M3). Depends on PR1 only.
Tests: the current child is highlighted from the URL; its parent auto-expands; collapsed children are not tabbable; the chevron has `aria-expanded`/`aria-controls`; Right/Left expand/collapse (flipped in RTL); the Marketing parent badge rolls up the unread count; every section link still resolves (a table test over `NAV` leaves: each `to` matches a route in `App.tsx`); at 320 the drawer scrolls inside itself with no page overflow.

### PR8 - Campaigns: list, progress, review (L, ~550) (S4, S5)
Files: `campaigns/{CampaignsTab,Progress,status,BudgetPlan,words}`, the review block of `CampaignEditor.tsx` (lines ~480-520 only), `campaigns/__tests__/*`. Depends on PR1, PR4, PR6.
Tests: a campaign row has <= 3 facts (name, stepper, relative time) + a MiniBar only when sending/sent; every `CampaignStatus` has a stepper position or a branch glyph and an accessible name; tapping opens the sheet with counters; review renders a Journey whose label contains sender, recipient count and time; status/date FilterChips work; "Pause all sending" stays visible; the table remains at >= 600.

### PR9 - Audience: contacts, filters, groups, suppression (L, ~650) (S6-S9)
Files: `audience/{AudienceTab,GroupsPanel,SuppressionPanel,ContactEditor,words}`, `audience/__tests__/*`. Depends on PR1, PR3, PR6.
Tests: a contact row shows email + one mailable glyph (<= 2 facts), each non-mailable status has a distinct glyph shape + accessible name; the 3 filter controls collapse into chips + one Filters button with a count badge; select 2 contacts > bar > "Add to group" sheet; the suppress confirm names the count; the undo toast restores.

### PR10 - Marketing Settings: SettingsList migration (L, ~650) (S12-S16)
Files: `announce/SettingsPanel.tsx`, `announce/settingsWords.ts`, `notify/NotifySection.tsx`, `sender/SenderSection.tsx`, `sender/{budgetWords,BudgetMeter}`, `sender/__tests__`, `announce/__tests__/formValidation.test.tsx`. Depends on PR1, PR4, PR5 (PR7 for the deep links).
Tests: at 390 the Settings landing shows exactly 6 group rows, each with a one-line summary and no `.a-hint` paragraph; no `input[type=checkbox]` without `role=switch` remains; help text appears only in the popover; a warning stays visible and badges its group row; `?section=sender` opens the Sender group; searching "utm" finds the UTM row under Advanced; Save/Reset/conflict behaviour is unchanged (existing `useSettingsDoc` tests pass); BudgetMeter renders two Gauges with an accessible value.

### PR11 - Library (M, ~350) (S10, S11)
Files: `library/{LibraryPanel,SnippetsEditor,TemplateEditor,words}`, `library/__tests__/*`. Depends on PR1, PR3, PR5 (default switch), PR6.
Tests: a template row has <= 3 facts with a channel glyph; Open/Duplicate/Remove only in the sheet; default is a Switch; channel/language FilterChips work.

### PR12 - Posts, Areas, Area detail (L, ~600) (S20-S22)
Files: `pages/Admin.tsx`, `pages/AdminAreas.tsx`, `pages/AdminCollection.tsx` (list part), `components/admin/TranslationPill.tsx` (adds a glyph variant), tests. Depends on PR1, PR3, PR6.
Tests: a post row at 390 has <= 2 facts + one status glyph (never 3 pills); published draws nothing, draft/changes/HE-missing each draw one; bulk publish/unpublish/archive/move through the sheet; State/Area/HE filter chips; English strings replaced by words.

### PR13 - Media grid + detail (M, ~450) (S24, S25)
Files: `components/admin/{MediaGrid,MediaPicker}.tsx`, `Media.module.css`, `pages/AdminMedia.tsx`, `__tests__/MediaLibrary.test.tsx`. Depends on PR1, PR3, PR6. `MediaPicker` keeps its props.
Tests: a tile shows a thumb + at most one badge row and no `WxH . size` line; tap opens a sheet; an unused tile is dashed with a name; select 3 > delete confirm names the count (in-use ones blocked with the reason, as today); kind/used FilterChips.

### PR14 - Overview, Connections, Translations, Settings history, History widgets (L, ~650) (S18, S19, S26, S27, S28, History)
Files: `pages/{AdminOverview,AdminConnections,AdminTranslations}.tsx`, `pages/AdminSettings.tsx` (history list ~473 only), `components/dashboard/History.tsx` (filter chips/facts only), tests. Depends on PR1, PR3, PR4, PR6.
Tests: overview shows <= 3 attention tiles + one totals strip at 390; a connection row has <= 2 facts + an access glyph, Revoke only in the sheet and bulk with a confirm naming the client; a translation row has one glyph from 5 states with an accessible name; a settings history row = version + relative time; History topic chips are FilterChips.

### PR15 - Projects list, editor save bar (M, ~400) (S23, S29)
Files: `pages/AdminProjects.tsx`, `components/admin/content/{Fields,EditorFrame}.tsx`, `components/admin/{StatusPill,EditorBar}.tsx`, `AdminShell.tsx` bottom-bar block only (line ~351, separate from PR7's nav lines). Depends on PR1, PR3. Fixes audit M1, M2, M4.
Tests: at 320 the projects row does not clip (`scrollWidth`); reorder works from a menu (WCAG 2.5.7) as well as buttons; the save bar is one row (<= 64px from CSS) with a glyph per `SaveState.kind`; a scroll-padding rule exists so a focused field is not under the bar.

**Parallelism for writers.** Round 1: PR1 + PR2 (same writer or two; PR2 rebases). Round 2 (independent, all need only PR1): PR3, PR4, PR5, PR6, PR7. Round 3 (parallel, disjoint files): PR8 `campaigns/*`; PR9 `audience/*`; PR10 `SettingsPanel/notify/sender`; PR11 `library/*`; PR12 `Admin.tsx, AdminAreas, AdminCollection`; PR13 `Media*`; PR14 `AdminOverview/Connections/Translations/AdminSettings history/History.tsx`; PR15 `AdminProjects, content/*, StatusPill, EditorBar`. The only shared file is `AdminShell.tsx` (PR7 nav lines vs PR15 bottom-bar lines, distinct blocks; merge PR7 first).

**Two CI helpers, added in PR1:** `expectRowBudget(el, { maxFacts: 2, maxButtons: 0 })`, called by every migration PR on its first list row, and `expectNoCheckboxWithoutSwitch(container)` for settings screens.

**Order of arrival for the owner:** Inbox (PR1+PR2), then selection (PR3), Settings (PR5+PR10), Filters (PR6) and the drawer (PR7), then Campaigns/Audience, then the content screens.

---

## 6. Open questions for the owner (simple choices)

1. **Select mode entry.** a) A visible "Select" button in each list header plus long-press (recommended) b) long-press only.
2. **Channel logos.** lucide has no LinkedIn / X / Instagram icons. a) I copy 4 small public-domain SVG logos into the repo (recommended, no dependency) b) letters in circles (Li, X, Ig, Em) c) add a brand-icon npm package (more to vet).
3. **Mark posted.** a) Deferred 8-second Undo, no backend change (recommended) b) ask for a real un-done endpoint later c) no undo.
4. **Inbox "Copy" on the row.** a) Remove from rows, copy inside the sheet only (recommended, matches your request) b) keep one small copy icon per row.
5. **How far do icons go?** a) Icon + colour on the row, the word only in the sheet and for screen readers (recommended) b) icon plus a one-word label under it.
6. **Overview.** a) Show only "needs you" tiles and one totals line (recommended) b) keep all 7 tiles, smaller.
7. **Sheet size.** a) Opens at half, pull up to full (recommended) b) always full screen on phones c) starts as a small peek with only the summary and the main button.
8. **Channels in Settings.** a) One "Channels" row that opens a sheet of 5 switches (recommended) b) five channel icons you tap inline in the group page.
9. **Settings group open style.** a) Small groups (up to 4 switches) open as a sheet, bigger ones as a full page (recommended) b) always a full page c) always a sheet.
10. **Drawer and tabs.** a) On phones the drawer carries Marketing's sections and the tab strip goes away (recommended) b) keep both.
11. **Remembered filters.** a) Remember per screen and show a "Filters restored" note with Undo (recommended) b) never remember, only keep them in the address bar c) always remember silently.
12. **Desktop.** a) Tables and forms stay as they are at 600px and wider; only phones change (recommended, lowest risk) b) simplify desktop the same way later.
13. **Hebrew icon words.** The Hebrew labels in section 4 are my draft: a) you review them once (recommended) b) take them from the translations glossary.
14. **Audit log.** There is no admin page for it today. a) Leave it MCP-only b) add a read-only "Activity log" page after this series, using RecordRow and Journey.
