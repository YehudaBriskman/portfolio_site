# Admin motion and behaviour

Companion to [admin-design-guide.md](admin-design-guide.md) section 0 (rules A1 to A34). This sheet holds the rules for **how the admin moves and reacts** (M1 to M12). The public site's motion is a separate document, [motion-contract.md](motion-contract.md); section 13 and 14 of it record what the admin already does on phones (#709, #731). Where this sheet and the contract disagree about the admin, change both in the same PR.

Format as in the guide: **Rule**, **Why**, **Check**, **Kit**, **Source**. `MUST` fails review, `SHOULD` needs a reason. Written 2026-11-15 (phase 1, #830).

## The numbers (tokens that already exist)

| Token | Value | Use |
|---|---|---|
| `--a-dur-fast` | 120ms | press, hover, toggle, chip, tooltip |
| `--a-dur-base` | 180ms | popover, menu, row arrive and leave, fade |
| `--a-dur-sheet` | 280ms | sheet, side panel, page-level change |
| `--a-ease-out` | `cubic-bezier(.2, 0, 0, 1)` | everything that enters or moves into place |
| `--a-ease-in` | `cubic-bezier(.4, 0, 1, 1)` | everything that leaves |
| `--a-ease-spring` | `linear(...)` 1 to 1.025 overshoot | press release on phones only, never for anything destroyed |

Why these: NN/g puts simple feedback near 100ms, a modal entering at 200 to 300ms and a hard ceiling near 400ms ("shortest time that is not jarring"); Atlassian says interactions 50 to 150ms, transitions 150 to 400ms, and high-frequency motion under 150ms; Material's token set runs short 50 to 200ms, medium 250 to 400ms with the standard curve `(.2, 0, 0, 1)` (the same curve as `--a-ease-out`, so the admin already agrees with Material here). Anything above 300ms in the admin needs a reason in the PR.

## Motion

**M1. Duration follows size and frequency: 120 / 180 / 280, nothing over 300.** MUST use the three duration tokens; a feedback (press, toggle, chip) is 120ms or less; a panel, sheet or page-level change is at most 280ms; a stagger step is 30 to 80ms and the whole run under 400ms. NEVER a raw `ms` or `s` literal in admin CSS.
*Why:* small elements stay fast, frequent motion shorter and subtler (Atlassian); 500ms and over feels draggy (NN/g).
*Check:* `motionStateChange.guard.test.ts` style: `rg 'transition|animation' ` in admin CSS finds only `var(--a-dur-*)`; the matrix script reads computed `transition-duration` of every opened surface, all at most 300ms.
*Kit:* tokens in `index.css`; `Presence`, `ListPresence`, `SheetPresence`.
*Source:* https://www.nngroup.com/articles/animation-duration/ ; https://atlassian.design/foundations/motion ; https://m3.material.io/styles/motion/easing-and-duration/tokens-specs *(lead: page is script-rendered, values from the published token set)*

**M2. Enter decelerates, exit accelerates, and the exit is about 30 percent shorter.** MUST enter with `--a-ease-out` and leave with `--a-ease-in`; the leave is shorter than the arrive (180 in, about 120 out); a leaving element never delays the next step.
*Why:* entrances slightly longer, exits shorter (NN/g); make exits faster than entrances and start motion at once (Atlassian). Exit tokens are not defined yet: add `--a-dur-exit` values as part of the first motion workstream (M-W1).
*Check:* for every `[data-state=closed]` rule, `transition-duration` is less than its open counterpart.
*Kit:* `Presence`, `ListPresence`, `SheetPresence`, `BottomSheet`.
*Source:* https://www.nngroup.com/articles/animation-duration/ ; https://atlassian.design/foundations/motion

**M3. Animate transform and opacity only; never layout.** MUST NOT animate `height`, `width`, `top`, `left`, `margin` or `padding` of anything that holds content, except the one controlled `grid-template-rows: 0fr to 1fr` collapse used by `ListPresence` and `Disclosure`. Colour and background changes are allowed on controls.
*Why:* layout animation janks on a phone and re-flows neighbours, the "janky" complaint. A grid-rows collapse is the one safe exception because the browser interpolates it without per-frame JS.
*Check:* a guard that fails on `transition: height|width|margin|padding` in `components/**/*.css`.
*Kit:* `ListPresence`, `Disclosure`.
*Source:* https://atlassian.design/foundations/motion (properties: scale, fade, slide, colour)

**M4. One change, one animation, one owner.** MUST NOT run two animations for one state change: if a row leaves, the row's wrapper animates and nothing inside it does; if a list re-sorts, either the list animates or each row does. A component that animates its own entrance is not wrapped in another presence component. A skeleton fades into content once (`SkeletonSwap`), not skeleton out then content in.
*Why:* "animations duplicated" is a standing complaint; Atlassian: lead with one focal point, avoid simultaneous animations that compete.
*Check:* in `admin-motion.mjs`, for a fixture state change count elements whose computed `animation-name` or `transition-property` is not `none` within the changed subtree: at most 1 owner per node path.
*Kit:* `Presence`, `ListPresence`, `SheetPresence`, `SkeletonSwap` each own one concern.
*Source:* https://atlassian.design/foundations/motion

**M5. Motion explains a change of place or state; remove it if nothing is lost.** MUST: arrive from where it came from (a sheet from the bottom, a side panel from the inline-end edge, a menu from its trigger); a row that is removed collapses where it was; a toggle moves its thumb. NEVER decorative loops, parallax, or a staged reveal on a page the owner uses all day.
*Why:* "if removed, does the user lose information?" (Atlassian); frequent actions need less.
*Check:* review question in the PR checklist; no `animation-iteration-count: infinite` except in a loading indicator that stops when loaded.
*Kit:* as M4.
*Source:* https://atlassian.design/foundations/motion

**M6. Reduced motion means instant, and the screen still works.** MUST honour `prefers-reduced-motion: reduce` by setting all admin durations to 0 (the tokens do this in one place) and removing any slide or scale; a state that is communicated only by motion also has a static cue. Nothing flashes more than 3 times a second. An auto-playing motion that lasts more than 5 seconds has a pause (WCAG 2.2.2).
*Why:* Atlassian: usable with all motion disabled; WCAG 2.2.2 pause, stop, hide.
*Check:* `admin-motion.mjs` with `reducedMotion: "reduce"`: every opened surface is at its final state within one timer tick (poll 500ms, never rAF).
*Kit:* `index.css` token override.
*Source:* https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html ; https://atlassian.design/foundations/motion

**M7. Motion is interruptible and never waited on.** MUST: a sheet that is being closed can be reopened; a second tap during an animation takes effect at once; code never waits for `animationend` or `transitionend` (a timer drops a ghost: `EXIT_KEEP_MS`); a test never waits on a frame (this box has about one rAF per 40 seconds, so `page.waitForFunction` with `{ polling: 500 }` and `force: true` on clicks).
*Why:* `animationend` does not fire when the tab is hidden or the element is `display: none`; the ghost would stay forever.
*Check:* `rg 'animationend|transitionend' web/src` outside a documented allow-list is empty.
*Kit:* `ListPresence`, `SheetPresence` (timer-based).
*Source:* [motion-contract.md](motion-contract.md) section 14

**M8. Press, hover and focus feedback: instant, small, the same everywhere.** MUST: press is `scale(.97 to .98)` at 100 to 160ms on touch-first controls, a background step on desktop; hover is a background step only (no movement); focus ring appears at once with no delay and is not animated away. All controls in a group share one feedback; a button that gains a spinner keeps its width (no reflow).
*Why:* feels instant under about 100ms (NN/g); "inconsistent weights and sizes" extends to feedback.
*Check:* computed `transform` on `:active` is the same for every `IconButton`, `Chip`, `.a-btn`.
*Kit:* `IconButton.module.css`, `Chip.module.css`, `Action.module.css` (three copies today; unify through a shared token `--press-scale`).
*Source:* https://www.nngroup.com/articles/animation-duration/

**M9. Shared-element and scroll-linked motion only where it saves a thought.** SHOULD use a shared-element transition (a list row to its detail, a thumbnail to its viewer) on a phone where it keeps the person oriented; MUST NOT drive layout from scroll (no sticky shrinking header with per-frame JS). A scroll-linked hide and reveal is allowed for a *floating* control only (the back circle, the Dock): it hides on scroll toward the end of the page after 8px of travel, returns on scroll back or at the top, and never hides while it holds focus. It uses `transform`, runs on one passive listener or CSS scroll-timeline, and never fights `position: sticky` bars.
*Why:* "things not truly floating/fixed" is a complaint: a control that is part of the layout moves with it. Atlassian: scroll and parallax kept restrained.
*Check:* `FloatingBack.test.tsx` holds the fixed box; add: the floating control's `getBoundingClientRect().top` is constant across a 600px scroll when it is visible.
*Kit:* `FloatingBack`, `Dock` (fixed, opaque, one shadow).
*Source:* https://atlassian.design/foundations/motion ; §3.1 Control kit

## Behaviour

**M10. The interface answers within 100ms and says what it is doing.** MUST: every control reacts to press in the same frame; an action that takes over about 1 second shows a local indicator on the control (not the page); over about 10 seconds a progress bar with what is done; the page never blocks for a background job (A28). Optimistic UI only for reversible change, with rollback and a message.
*Why:* NN/g skeleton and loading thresholds.
*Check:* `page.route` delays 1500ms: the pressed button shows its busy state in under 200ms; a 12s job shows a progress element.
*Kit:* `IconButton` (`busy` state is MISSING; today pages draw their own text), `toast.promise`, `MiniBar`.
*Source:* https://www.nngroup.com/articles/skeleton-screens/

**M11. A list keeps your place.** MUST: after Back the scroll position, the filter, the sort and the opened row are as they were; a row that changes does not jump the list; new rows from a poll arrive behind a "3 new" control, never pushing what you are reading; focus after a delete moves to the next row.
*Why:* losing place is the main cost of a two-level model; NN/g progressive disclosure pitfalls (users bouncing back and forth).
*Check:* open the 20th row, press Back: `scrollY` within 50px; filter in URL.
*Kit:* `useSavedFilters`, `ListPresence`; scroll restoration is MISSING outside the router default.
*Source:* https://www.nngroup.com/articles/progressive-disclosure/

**M12. Keyboard behaviour matches the pointer's, and shortcuts do not trap.** MUST: Esc closes the top-most surface only and returns focus to its opener; arrow keys move within a toolbar or a menu (one tab stop per toolbar, mirrored in RTL); Enter or Space activates; a single-key shortcut is off while a field has focus; Ctrl+K (palette, A32) and Ctrl+B (sidebar) work on every admin screen.
*Why:* WAI-ARIA toolbar and menu patterns; WCAG 2.1.4 character-key shortcuts.
*Check:* `admin-sidebar.mjs` (Ctrl+B), `FilterChips.test.tsx` (toolbar); a new e2e that opens a sheet over a sheet-less screen and checks Esc order.
*Kit:* `keyboard.ts`, `FilterChips`, `ControlBar`.
*Source:* https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html ; https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html

## Source status (2026-11-15)

Retrieved as text and used directly: NN/g progressive disclosure, animation duration, data tables, mobile tables, dashboards (preattentive), modal and nonmodal dialogs, confirmation dialogs, skeleton screens, filter categories; Primer data table, progressive disclosure, saving; Carbon data table; Atlassian empty state and motion; WCAG 2.2 target size minimum, focus appearance, dragging movements, pause stop hide.

Not retrievable as text (script-rendered, redirected or 404): Material 3 structure and easing pages, Apple HIG sidebars, Polaris index table (redirected to shopify.dev), the NN/g bulk-actions URL. Rules citing those say *(lead)*. Not researched in this phase: Linear, Vercel, Stripe, Ant, Radix, Refactoring UI as text (the guide already cites it as a lead). A second pass should fetch those and the WAI-ARIA authoring practices before any rule marked *(lead)* is turned into a failing check.
