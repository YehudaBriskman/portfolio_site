# The motion contract

**This is a living reference doc, not a task list.** Work on this site is tracked as
GitHub issues; in-repo Markdown is for interface contracts, data models and
architecture only. Nothing here is a TODO, nothing here is checked off, and if
something in here stops being true the fix is to change it, not to open a
section called "known issues".

It exists because three of the rules below each cost a rebuild to discover,
none of them produces an error, and all of them will be rediscovered by the
next person to touch `web/src/components/motion/` unless they are written down
beside the rules they govern. The component comment blocks carry the
file-specific reasoning; this is the part that is true across all of them.

---

## 1. The two rules of scroll-driven motion

Both are non-obvious, neither throws, and both present as "the animation
silently does nothing".

### A scroll-driven animation has no delay and no duration

`animation-delay` and `animation-duration` are **ignored outright** when
`animation-timeline` names a scroll or view timeline. Not clamped, not scaled —
ignored. The range *is* the clock: progress is the scrollport's position
relative to the subject, and nothing else.

So a staggered sequence is:

- N animations with N different `animation-range` values, or
- one animation whose beats are keyframe percentages,

and **never** N delays. The failure is silent — every element animates, all of
them at once, and the stagger you wrote has no effect at all.

The corollary is that *something* has to carry the timing when the timing is the
effect — per-word rests in speech rhythm, say, which no range can express. The
pattern that works is to run the effect on the clock and use the scroll-driven
animation only as a **gate**: a one-step `steps(1, jump-end)` animation flips a
custom property the time-driven animation reads. A custom property is the only
thing a scroll timeline can hand to a time-driven animation.

**Do not reach for `animation-play-state` as that handoff.** It is the one
property that accepts it, and it is also the property §4 bans: paused means
frozen at the time reached, which for anything not yet started is frame zero,
and with `fill-mode: both` frame zero is the hidden state. A retired component
(`WordStagger`, see the retirement note in §7) did exactly this, and one
missing `body.motion-paused` block away from blanking its own text.

### A pinned element's timeline stalls

`position: sticky` stops an element moving relative to the scrollport the moment
it pins. A `view()` timeline on that element — or on anything inside it —
therefore freezes at whatever progress it had reached at that instant and never
advances. In the prototype this was a section heading stuck permanently
half-wiped, which looked like a clip-path bug and was not one.

The fix is always the same shape:

```css
/* The static wrapper owns the clock. */
.wrapper { view-timeline-name: --act; }

/* The pinned child reads it. */
.pinned {
  position: sticky;
  top: 0;
  animation-timeline: --act;     /* not view() */
  animation-range: contain 0% contain 100%;
}
```

Declare `view-timeline-name` on the **static** wrapper and point the pinned
child's `animation-timeline` at that name. The wrapper keeps travelling through
the scrollport while the child is held still, so the clock keeps running.

**Corollary, and it is a separate decision:** `entry` runs *before* an element
pins and `contain` runs *while* it is pinned. "Animate on the way in" and
"animate while held" are two different ranges, and picking the wrong one is the
other way to get an animation that appears to do nothing.

This is also why a short wrapper is better than a tall one. `entry` on a subject
taller than the viewport is a range the reader never finishes scrolling through,
so a reveal hung on a full section arrives in slow motion or not at all. Put the
timeline on the smallest static box that contains the act.

---

## 2. The device ledger

> Four or more device families on a page, and **never the same one twice in a
> row.** Five sections that behave identically are one section shown five times.

The old plan put the same full-window colour transition between every pair of
sections and then gave three separate sections a card-arrival animation. On
paper each issue looked fine; together they were one device wearing four hats.
The failure is invisible from inside any single component, which is why the
ledger is a page-level document and not a comment.

| # | beat | device family | the one reason it exists |
|---|---|---|---|
| — | entry | **shutter** | the page is behind something, and that something leaves |
| — | any waiting region | **sweep** | a region says what shape is coming, and that it is coming |
| — | the dark ground | **drift** | the dark act is a gap between two sheets, with light behind it |
| — | every section head | **shutter**, echoed | a section arrives the way the app did, at the scale of its name |
| — | any running text | **pen** | prose is set as the reader's eye reaches it — one block at a time, in document order, as each enters the reading window (68% → 38% of the window, 2026-11-03) |
| — | the run, the notes shelf; the lead of the line on "How I work" | **aurora strand** (2026-11-03; v3 the same day) | one ribbon of light, uncovered in place by a soft window from one side: the run's from the right (the reading end), the notes' from the left, through the middle of the cards it carries; on "How I work" the same window uncovers the living line's run in from the page's left edge, and there is no second strand there |
| — | a card or a day on a dashboard, a card on a project page | **arrive** (#251) | a block settles the last 12px into place and the ring by its heading draws round once; nothing is ever drawn over the content |
| 0 | title plate | **staged assembly** | the collection names itself, in four gated moves |
| — | the plate's end corner | **breath** | one small light is on, and says one thing at a time |
| 1 | wall text | `draw` + `line` | the method, drawn beside the sentence that names it, by the reader's scroll; one line joins it all up |
| — | /story, and beat 1 | **`line`** | one line drawn by scroll under the reading, which swings between the content and breaks out into a loop round a few words or a figure; on /story each picture is laid out of the line's lane just before the tip reaches it (#195), part of the same act; on home it comes in from the page's left edge and traces round the head of "How I work" (2026-11-03) |
| 2 | **the run** | `pin` | the work arrives along one line, and the reader's scroll is what moves it |
| 3 | the year | `scrub` | a year of work, raised off the page by the reader's own scroll |
| 4 | notes shelf | `pan`, held | the notes walk past a held frame, one card-width per step of the reader's scroll |
| 5 | specs | `count` | real numbers landing |
| 6 | inquiry plate | `surface` | the ask comes up out of the sheet, part by part, as the reader arrives |

Eleven families (`arrive` joined with #251, on the dashboards and the project page; `reveal` left the page with #160; `surface` took its place; `flow` left with #157 and `draw` took its place). No repeat in adjacent beats. The head row reuses the entry's family on purpose and is argued below. `pin` is spent once, on the peak,
and `scrub` is spent once on beat 3 — the grammar bans a *second* scrub and
has always allowed the first, which is the whole licence beat 3 has.

**Beat 1 changed from `flow` to `draw` on the owner's call (#157,
2026-11-02).** The wall text was three paragraphs and three principles at body
size, arriving through `flow` — 14px of rise on a 620ms clock, fired once by an
observer. The owner asked for bigger type, more room, prose that reads like
/story, and a small diagram per principle that *shows* the method; and the
house rule that came with it (the city's, #111) is that **scroll is the
clock** — nothing on a timer, nothing fired once, everything reversing exactly
on the way up. A 620ms arrival is precisely what that rule forbids, so `flow`
left the beat rather than being kept alongside.

What is there now (`Approach.tsx`, `ApproachFigures.tsx`,
`Approach.module.css`):

- **The prose** is short sections — a mono label in a narrow rail, then one
  or two paragraphs of a sentence or two each — every paragraph a `Written`
  on its own clock, so it is written word by word like a /story beat. Reading
  size 22px on a desktop (was 19px), the floor unchanged at the body size on
  a phone; the measure re-derived for the new size, **42ch = 651px, a median
  of 59 characters a line** (measured off the laid-out words at 1440×900; the
  old 62ch at 19px held about 80, because this face's `ch` is wider than its
  average letter). Gaps: 0.85em between paragraphs, 3.5–5rem between
  sections, 5.5–8.5rem above a principle.
- **`draw`**: one 96-unit inline SVG per principle in the rail — an empty box
  that the clone drops into and the three-line install fills from the floor;
  one run forking into a pass and a fail drawn at the same moment; a key held
  above a line of commits by a path that stops at a bar. Every mark has
  `pathLength="1"` and a `data-step`; one keyframe takes `stroke-dashoffset`
  1 → 0, linear, fill `both`, on the principle's named `view-timeline`
  (`--approach-fig`, the pen's own insets, so drawing and writing share a
  window), five steps of 10% across the first half of it. The figures are
  `aria-hidden`: the sentences beside them say everything they show. They
  are direction-neutral, so the Hebrew page draws the same marks with the
  rail on the right.
- **Off-switches.** Reduced motion, Pause, no `animation-timeline`, and print
  all cancel the animation and restate `stroke-dashoffset: 0`,
  `stroke-opacity: 1` — the drawn figure. The resting declaration is the
  drawn figure too, so a missed exit still shows it finished.

Measured: frames down and back up at the same depth match (figure 1 at
`drawn=0.56` both ways on a desktop, `0.37` on a phone); both switches that
Chromium can fake show `drawn=1` at a depth where motion-on is half drawn.
Contrast on `--paper`: prose muted 6.37:1 and inked 15.17:1 (the pen's), the
labels 6.37:1, the strokes 6.37:1 and the accent (`--signal`) 8.5:1 — the
figures are non-text and need 3:1. `npm run a11y` 30/30 clean. Frame cost at
4× CPU throttle, 1440×900, wheel-scrolled through `#approach`
(`web/scripts/measure-approach-fps.mjs`, nine interleaved rounds after a
warm-up): **`main` 31.8fps, this build 33.8fps**, medians, both arms spreading
about 24–38 on a loaded box — no regression, and the section is now 2052px
against 1238px, so the same wheel distance covers less of it per frame. Shots
in `docs/approach/` (`web/scripts/shoot-approach.mjs`).

The family's neighbours are `pin` (the run) and `scrub` (the year). `draw` is
neither: it holds nothing and moves nothing across the page — it is line work
drawn in place at the size of a glyph, which is the scale of `InkRule`'s
hairline rather than the year's camera. If a later beat draws strokes by
scroll at section scale, it is `scrub` and must not sit next to this one.

**The owner overrode that last sentence for this beat (#178, 2026-11-02),
and the line that resulted is its own family, `line`, not a second `scrub`.**
The ask was for /story's line to run behind the whole of "How I work",
weaving between the short sections and the principle figures. It is a
section-scale stroke drawn by scroll, which is what the sentence above
calls `scrub` — but `scrub`, as the ban below defines it, is "a drawing the
reader operates or that carries information", and this one does neither:
it holds no frame, moves no object, and says nothing a sentence beside it
does not. So it is recorded as `line` (row below) and the beat's family
column is `draw` + `line`. It sits next to `pin` and `scrub` and repeats
neither; what keeps it from being a third peak is that it is 1.5px of one
ink behind text, holds nothing, and costs nothing per frame beyond the
paint of one path (measured in the row's note).

**Beat 2 changed from the pile to the run on the owner's call (#57, reopened
2026-11-02), and it moves lateral travel next to beat 4's `pan`.** The family
is still `pin` — a held frame the scroll buys time in, spent once — but what
moves inside it is now sideways: the cards come in from the right and travel
left along one snaking curve, each leaning with its tangent
(`projects/ProjectRun.module.css`). That is a cousin of the notes shelf's
`pan`, and it is allowed for two reasons that have to stay true: the two are
never adjacent (the wall text and the year sit between them in either order
this section discusses), and they are not the same device — the shelf is a
flat row the page slides past at its own height, the run is a held stage with
the work arriving one by one on a curve. If a later change puts them next to
each other, one of them changes family. The owner's house rule for this beat
is the city's (#111): **scroll is the clock** — every part of it is scrubbed
by the stage's named timeline, reverses exactly on the way up (frames forward
and back are byte-identical below the bar, which tucks on the way down;
`web/scripts/shoot-work-run.mjs`, shots in `docs/work-run/`), and nothing is on a timer or
fired once. Each card's arrival is still its own, carried unchanged from the
pile (`pileArrival.ts`). All three off-switches land on the plain vertical
list, with no pin and no runway.

**In Hebrew the run mirrors (#168).** The cards come in from the *left*,
travel rightward along the mirrored curve and lean the other way, and the
arrival's swing and the onward arrow turn with them. It is one sign,
`--run-dir` (1, or −1 under `html[dir="rtl"]`, the attribute `locale.ts`
writes — not `:dir(rtl)`, which the build lowers to a `:lang()` list), and
every horizontal quantity in the run is multiplied by it; the slot is anchored
at `inset-inline-start`. There is no second code path and no `scale: -1`
mirror. The skip link, focus-scrolls-to-card and the three off-switches are
untouched by it: the markers are vertical, and the plain list is already
logical. Shot with `RUN_DIR=rtl` (files `run-<w>x<h>-he-*.png`): every
Hebrew frame is the English one mirrored to the pixel, and reverses
byte-identically.

**One box, a closer line, an earlier start (owner's preprod pass, #170).**
Every card is one size: 448×460 at 1440 and 312×349 at 390, where it had
been 320 wide and 382–449 tall (273 × 327–383 on a phone). The height came
from the plinth's content and, on the way in, from the arrival's `scale`.
The plinth now reserves and clamps one line of name, two of fact and one of
fields, and the run's arrival keyframe has no scale. Along the line the
neighbours are 637px apart centre to centre at 1440, a 189px edge gap where
there had been 237px. That still shows two or three cards at once and never
four. On a phone the gap is 30px, down from 40px. The stage's
`view-timeline-inset` is now explicitly `0`. Its default, `auto`, took the
document's 88px `scroll-padding-top`, so the timeline ran ahead of the pin
and a focused card landed 57px (laptop) or 31px (phone) off centre. It now
lands within 1px. With that fixed, `--run-lead` is −0.0435, and the first
card's edge shows 40px (laptop) or 10px (phone) *before* the pin, where it
had shown 30px and 50px after it. That is 70px and 60px sooner, about 7% of
the window. The curve's height, the lean's formula and the exact reverse are
unchanged.

Measured at 4× CPU throttle, 1440×900, wheel-scrolled through the whole
`#work` section with real input events, rAF frames over wall clock, five
passes per arm after a discarded warm-up, interleaved with the order flipped
each round (`web/scripts/measure-work-fps.mjs`): **`main` (the pile) 16.3fps,
the run 15.6fps**, medians, with both arms spreading 11.7–17.0 — the
difference is inside the spread. The absolute numbers are this harness under
SwiftShader with a 16ms pause per wheel step and are not comparable with the
tables below; the comparison is. The run animates only `transform`,
`translate`, `rotate` and the card's arrival transform — no layout and no
paint per frame.

**The run's cards cast a soft shadow and tilt towards the pointer (#177).**
Each link now holds a *face*: the link keeps the lean and the arrival, and is
the hit area; the face is what is seen (edge, paper, shadow) and the only
thing the tilt turns. The tilt's `transform` is the face's own, so it never
meets the arrival's and never overwrites the scroll-driven ones, and the
hovered box holds still while the face turns, so the edge does not flicker
in and out of hover. The shadow is five faint layers (each ≤ 0.34 alpha)
with short offsets, so as it turns with the card's lean it shifts a few
pixels sideways at most and still reads as falling below. The tilt is direct
manipulation, so it may be time-based: up to 6° on each axis, the edge under
the pointer going into the page, following over `--dur-micro` and settling
back over `--dur-settle`. Keyboard focus gets one fixed turn (−2°, 3°) that
points onward and takes `--run-dir`; the pointer tilt is physical and does
not. One passive `pointermove` on the list writes `--tilt-x`/`--tilt-y`
(−1…1) on the face at most once a frame, with no React state. It writes only
for a mouse under `(hover: hover) and (pointer: fine)`, and only while the
run is running, and the rules live in a block that touch and reduced motion
never match; Pause and no `animation-timeline` cancel them. Cards stay
448×460. Shots: `docs/work-run/tilt-1440x900[-he]-{hover,focus}.png`
(`web/scripts/shoot-work-tilt.mjs`). Measured by the same script (`MEASURE=`)
at 4× throttle, 240 real pointer moves across the middle card, five rounds
after a warm-up, interleaved: **`main` 59.4fps, the tilt 58.5fps**
(medians). Style recalculation per move rose from 3.4ms to 6.4ms
(throttled), script from 0.8ms to 1.4ms, and layout stayed at 0.

**An aurora runs along the cards' path and joins them (#181).** The owner
asked for something that connects all the cards: "an energy line in aurora
style on the place they are sliding". Three were prototyped and shot (an
aurora ribbon, a fine track with a pulse, a thread from card to card), and
the owner picked the aurora. It is not a new family and not a second beat.
It belongs to the run, plays on the run's own timeline and is spent inside
the same `pin`.
*On the path, not near it.* Every card plays the same lap, so every card's
centre lies on one curve fixed in the frame. The curve runs from half a card
past each edge and one `--run-amp` either side of the middle, and it is one
period of the sine. `runCurve.ts` derives this from `run-x` and `run-y`.
`.curve` is that box, set from the same custom properties the slot moves by,
and the SVG stretches one period into it with `preserveAspectRatio="none"`
(a stretched sine is still the sine). The stylesheet is tested to keep the
box and `run-x`'s two ends in step. Measured in the browser, every card on
screen stands within 0.4px of the drawn line, at both windows and in both
directions.
*A ribbon of strands (#192).* The owner asked for it thicker, and "not one fat
stroke but a bunch of fine lines like the current one, offset and phased, to
form a ribbon". A haze and seven fine strands rest on the line in the work's
own tints (teal, green, the act's blue, violet): each strand at its own
offset across the ribbon, drifting about it on its own wavelength and phase,
so they braid rather than run as rails (`motion/ribbon.ts`, rendered by
`motion/Strands.tsx`, which the living line uses too).
*It sweeps in (#192).* The ribbon is not there before the run: as the stage
comes up into the window it is uncovered from the reading end — the side
the cards arrive from — by a soft-edged window sliding in while the drawing
inside is carried back by the same amount, so it holds still on the curve.
Range `entry 40%` to `contain 6%`: whole just after the pin, ahead of the
first card. Scroll back and it leaves the way it came; the shot reached
going back up reads the same sweep as the one going down.
*The light.* A brighter copy of the strands shows through a soft
46cqw window that sweeps from the reading end to past the start once a card.
The window and the copy inside it move by opposite transforms, so the copy
holds still on the curve while the light passes. It is scrubbed and
reversed like everything in the run: frames reached going back are
byte-identical.
*Hebrew.* The window's travel takes `--run-dir`, and the drawing is turned
by `scale: var(--run-dir) 1`. That is a picture of a sine with no text in
it, and the run's own "no `scale: -1`" rule is about text and hit areas.
*Off-switches.* Reduced motion and Pause land on the plain list, which has
no curve. There the aurora becomes one still ribbon down the list's middle,
behind the cards, fully drawn with no surge, so each gap still shows the
cards on one line. With no `animation-timeline` support, and in forced
colours, it is hidden, because the list is the whole fallback.
*And the living line.* Since #191 the living line wears this ribbon too.
Until 2026-11-03 it started here, at the run's centre, and flowed down out
of the act into "How I work"; it now comes in from the page's left edge
above "How I work"'s head, uncovered by the same soft window as this one
comes in from the right (the aurora strand, §2). The aurora is light along the work; the line is that
light drawn on by the reader's scroll.
Shots: `docs/work-run/aurora-<w>x<h>[-he]-<t>.png`, `-sweep-<t>.png` (t < 0:
before the pin) and `-sweep--0.12-back.png`, `-reduced`, `-paused`
(`web/scripts/shoot-work-aurora.mjs`). Measured with
`measure-work-fps.mjs` at 4× throttle, interleaved against a build of
`main`, medians: 1440×900 **45.1 → 44.2fps** (7 rounds), 390×844
**46.4 → 46.3fps** (5 rounds), both inside the run-to-run spread.

**Beat 4 holds its frame now, and it is still `pan` (#159).** The owner's note
was that the shelf "still moves the whole page": it drifted sideways while the
section scrolled away at full speed, so the pan was a garnish on a section
that never stopped. It now pins the way the run does, with the run's
mechanism and not a second one — a static stage owning a named view timeline
(`--notes-shelf`), a sticky frame one window tall inside it, the track's
`transform` keyed to the stage's `contain` range, the document as the one real
scroll container, a marker per card in the runway that focus scrolls to, and a
skip link past the stage (`LatestNotes.tsx`, `LatestNotes.module.css`). The
old `overflow-x: auto` scroller went with the drift: a held frame that is also
a scroller is two clocks for one row.

- **A held pan is still a pan, by the argument the year already made.** "A
  held scrub is still a scrub" (§3's ban list) is what lets beat 3 hold its
  frame without spending `pin`; the same sentence covers this. `pin` is the
  run's move — the work arriving one by one along a curve under a held frame,
  each card with its own arrival. The shelf is a flat row at one height that
  slides by one card-width per step, with no arrival, no lean and no curve.
- **The hold is the shortest of the three.** 18svh a card, 108svh for six,
  against the year's ~150svh (120svh until #246) and the run's 220svh, so the peak keeps the most
  scroll room (§3). Measured at 1440×900 the section is 2376px, against 709px
  for the drifting shelf it replaced; that is the price, and "every pinned
  beat buys its time in scroll distance" (§3) is where it is counted.
- **Not adjacent to the run.** The year sits between them in the shipped
  order and the wall text and the year in the intended one, so the run/shelf
  adjacency clause above still holds. It is adjacent to the year, which also
  holds; the families differ (`scrub` against `pan`) and so does what moves —
  a camera down a grid against a row going sideways.
- **The timeline's inset is zero, and that is a measurement.** A view
  timeline's `view-timeline-inset` defaults to `auto`, which takes the
  document's `scroll-padding-top` (the bar and 2rem, 88px). Left at `auto`,
  a focused card's marker landed exactly on 4/6 of the runway and the track
  stood at 0.634 of its travel — the card 66px off centre. At `0` the range is
  the hold itself, and the focused card lands within a pixel of centre at both
  widths (720 of 1440, 194.5 of 390).
- **Scroll is the clock.** Every frame is a function of scroll position:
  frames reached by scrolling back up are byte-identical below the bar to the
  frames reached going down at 1440×900, and at 390×844 identical but for one
  row differing by 1/255 — sub-pixel rounding of the scroll offset, not motion
  (`web/scripts/shoot-notes-shelf.mjs`, shots in `docs/notes/`). No horizontal
  overflow at any point, in either direction, under right-to-left too.
- **All three off-switches land on the plain list**: no pin, no runway, no
  travel, the same cards whole in a 40rem column — each block cancels the
  animation by name and restates the layout, as the run's do.
- **The ground: covers on paper, not a dark act.** The pale washed cards are
  gone. A note with a cover shows it above its label; one without is the label
  alone in the same `--rule-firm` frame, standing on the same floor line. A
  dark ground was the other option and it fails the ceiling in
  `ground/DarkAct.tsx` three ways — the subject rule names the shelf as the
  page talking about the work, the shelf directly follows the dark year and
  would merge with it into "one long dark act with a seam in it", and it fails
  three of the four conditions the footer's exemption (#160) rests on. The full
  argument is beside the card in `LatestNotes.module.css`. Contrast, measured
  on the rendered card with motion on and off: name 15.17:1, fact, field line
  and arrow 6.37:1, all on paper; no text is ever set over a cover. The frame
  is 2.15:1 and identifies nothing on its own.
- **Frame cost.** 4× CPU throttle, 1440×900, wheel-scrolled through `#notes`
  with real input, five passes per arm after a discarded warm-up, interleaved
  with the order flipped (`web/scripts/measure-notes-fps.mjs`, API stubbed to
  the same six notes): **`main` 30.6fps, the held shelf 34.3fps**, medians,
  ranges 30.0–34.9 and 32.1–37.6. The difference is near the spread; what it
  says is that the hold costs nothing, which is what one `transform` on one
  layer predicts — the drifting shelf animated seven elements, this animates
  one.

**The entry row is not a beat, and the distinction is what keeps it honest.**
Every other row in this table is a section a reader scrolls to; `shutter` is
the app's own arrival — `motion/EntryShutter.tsx`, mounted in `App.tsx` above
`<Routes>`, once per visit and never again on a client-side navigation. It
therefore cannot repeat against beat 0 in the way adjacency means here: by the
time beat 0's letters start falling the shutter has already left the document.
It is in the ledger because it is a new device family on the page and the
ledger exists so a family is not quietly reused — a black ground and a lit
grid belong to nothing else on this site, and nothing else may take them —
with one exception, the section heads, taken openly and argued in the
next paragraph. The black ground is still the shutter's alone.

**The heads take the shutter's family a second time, and that is an
override of this table's own rule, argued here rather than taken quietly
(#104).** The owner asked for `WORK`, `THE YEAR`, `NOTES` and `SPECS` to
arrive "in a way close to the appearing of the app (the tiles)", which is a
direct request to reuse a family the ledger exists to keep from being reused.
The case for it rests on three things, and if any of them stops being true
the override goes with it:

- **It is an echo and not a repeat: same family, different scale, clock and
  granularity.** The shutter is 72px tiles over the whole window, on a timer,
  once a visit, as 260 elements. The heads are 24px tiles (16px on a phone)
  over one row of type, on the reader's scroll, every time, as one painted
  pseudo-element per head with a moving mask. What is shared is the reading —
  a lit grid leaving from the centre outward, uncovering what was behind it —
  and that is the part the owner asked for. What is not shared is everything
  a reader could mistake for the shutter happening again: it never covers the
  window, never goes black, never stops the reader, and is never opaque.
- **The heads are not a beat, so they cannot sit next to the shutter, or next
  to themselves, in the sense adjacency means here.** Like `drift` and
  `sweep`, the head is a frame every section shares rather than a section a
  reader scrolls *to*, and the four of them already share one layout
  (`.section-head`) for the same reason: the page's punctuation should be
  consistent precisely so the beats between them can differ. A different
  arrival per head would be four more devices on a page this table already
  counts at nine. The nearest the echo comes to its source is the work head,
  and between them sit the whole title plate and its four gated moves.
- **It is not a second `scrub`, though it is driven by scroll.** The ban on a
  second scrub is about a second *drawing the reader operates* — beat 3's 365
  columns, raised by the scroll and lowered again. The lattice is not a
  drawing and carries no information; it is a threshold the head passes
  through, a third of a viewport long, and like `InkRule`'s hairline (which
  has always been scroll-driven in three of these same heads without being a scrub) it
  is reversible because every `view()` timeline is, not because reversing it
  is the point.

**What it had to not cost, and what it measured.** The head is a state a
reader can park in — stop scrolling mid-arrival and it stays there — so the
tiles are a veil and not a shutter: the ground's own colour at 0.36 over the
word, solved against the floor rather than chosen. The thickest frame holds
the word at **5.16:1 on paper and 7.29:1 on `--panel`** (15.17 and 17.15
bare), above 4.5:1 on both — the body-text floor, not the 3:1 a display size
would be allowed. Read off screenshots with the veil fully over the first
letter: 6.17:1 and 7.41:1. The veil covers the heading's row and never the
eyebrow, which at 12px is the one line on the head no veil could be drawn
over. `index.css` has the arithmetic beside the rule.

It runs in the lower third and nowhere else: the head's view timeline is
inset to the bottom third of the window (`view-timeline-inset: 66.667% 0`)
and the range is `entry 0%` to `exit 0%` against that inset — from the head's
top edge rising past the bottom of the window to the same edge reaching the
top of the lower third, 300px of scroll at 900 and 281px on a phone. No delay
and no duration does any timing; the only shaping is a keyframe at 50% that
holds the veil on the word's outer letters for the first half of that
distance, so the centre-first, edges-last order the shutter gets from its
delays comes from the keyframes instead.

Measured at 4× CPU throttle, 1440x900, nine passes per arm after a discarded
warm-up, interleaved against `main` with the order flipped each round; frames
counted by `requestAnimationFrame` across a real wheel gesture of 450px that
carries the head through its whole range. Medians of nine:

| head | `main` | with the lattice | with the glow layer removed |
|---|---|---|---|
| `WORK`, dark act | 60.0fps | 58.0 (−2.0) | 59.5 (−0.5) |
| `SPECS`, paper | 58.7fps | 55.1 (−3.6) | 56.0 (−2.7) |

The spread is wide on this harness — standard deviations of 4 to 9fps per
cell — so neither delta is cleanly outside it, and both are reported rather
than called free. The glow is the expensive layer (a radial gradient per
tile) and it stays because without it the lattice is graph paper and not the
shutter's lit grid; the third column is what removing it would buy. The cost
is paid only for the third of a viewport the head is in range, on a head the
reader can switch off into a plain one. The same renderer caveat as the
drift's applies, and more so: these were taken under SwiftShader with no GPU,
which rasterises the masked layer on the CPU every frame. Nothing about the
first screen changed, so LCP was not re-taken — every head is below the fold
and none is a paint candidate.

Its off-switches — reduced motion, Pause, no `animation-timeline`, and also
forced colours and print — all remove the pseudo-element, which is the
arrived state exactly: the head itself is never animated, so a head with no
lattice over it is a finished head and not a cancelled one.

**`drift` is not a beat either, and it is not a section — it is a ground.**
`components/ground/DarkAct.tsx` wraps the two sections that leave the paper,
and the light moving at their boundaries belongs to the ground rather than to
either act, which is why it has no number. It runs under beat 2 and beat 3
both, and it cannot collide with either on adjacency for the same reason the
entry row cannot: it is not a thing the reader scrolls *to*.

**There are two dark acts and the ceiling is two.** Work and the year are the
only two sections on the home page whose subject is the work itself — the
objects, and the labour that made them. Everything between and after is the
page talking about the work, and the page talks on paper. A third is a
different page. Approach sits between them, which `pages/Index.tsx` had
already argued for on motion grounds (two acts with real depth in them must
not meet) and which now does the same job for the ground: two dark acts with
nothing between them are one long dark act with a seam in it.

**What `drift` actually is, after the first idea was thrown away.** The
obvious build is a full-bleed brightness field — slow soft veils of a lighter
tone drifting across the dark. It cannot be built honestly on `#0C0C0E`, and
the reason is arithmetic rather than taste. The ground sits at 0.37% of
relative luminance and every surface standing on it is within two points of
that, so a field faint enough to leave them alone is invisible and a field a
reader can see inverts them:

| ground | L | `--panel-rule` | the grid's empty day |
|---|---|---|---|
| `--panel` | 0.3728% | 3.3408:1 | 1.2341:1 |
| + one veil of `--panel-ink` at .055 → `rgb(25 25 26)` | 0.9765% | **3.0033:1** | **1.1094:1** |

Both rows re-measured. The first is read off the rendered act; the second is
source-over arithmetic on those same tokens, and reproduces as shown. One
veil is already enough to settle it: the hairline drops to 3.0033:1, which is
*at* the 3:1 non-text floor rather than above it with room, and the grid's
empty day falls from 1.2341:1 to 1.1094:1 — past the 1.18:1 step this
codebase has already rejected once as "no difference at all", so the first
step of a five-band scale goes quietly flat. The veiled ground is itself only
1.1124:1 off the bare one, so what is being bought at that price is a field a
reader can barely see.

A second veil was recorded as taking the hairline to 2.60:1 and the empty day
to 1.04:1 — *below its own ground*, reversing the first step outright. **That
row is not re-stated as measured here**: it was a tinted layer and the tint's
value is not recorded anywhere, so it cannot be reproduced from what the repo
holds. The one-veil row is sufficient for the decision and is the one above.

So the light is at the seams and nowhere else. Each junction carries two
sources that travel along it at different rates — a broad blue wash and a
narrow white highlight crossing it — and what reads as another layer is the
moment they pass. The seam is a clipped box 1.8 arcs tall, 114px at 1440 and
50px at 390 against 205px and 115px of padding before the first line of
content, so the ground a reader reads on is *exactly* `--panel`: sampled off
a screenshot beside the heading, beside the caption, above the grid, in the
grid's own gutter and at the act's inline edge, all rgb(12 12 14), 1.00:1
against the token. Every ratio in `index.css` stated against `--panel` still
holds inside the act, as a property of the geometry rather than as a sum of
percentages.

**The edge it lights is the other half of the device, and it is not a
radius.** #92's `--r-2xl` on the two block-start corners is kept as a budget
and spent across the page: each corner takes `50%` in the inline axis, so the
two curves meet and the act's top edge is one shallow arc. The foot is the
same arc in paper, rising into the dark, so both junctions crest the same way
and the dark band stays a constant thickness bowed over the page rather than a
lozenge. A hairline of `--accent-on-panel` rides both, which is the same light
the shutter's tile edges carry and is where that light went after the shutter
left.

**Measured, at 4x CPU throttle, 1440x900, nine passes per arm after a
discarded warm-up, interleaved against `main` with the arm order flipped each
round. Frames counted by `requestAnimationFrame` while a real scroll gesture
is synthesized through the input pipeline — a scripted per-frame `scrollTo`
forces layout on every tick and measures the harness instead of the page.**

| act | `main` | with the device | with the drift cancelled |
|---|---|---|---|
| beat 2, the pile | 59.8fps | 59.7 (−0.1) | — |
| beat 3, the year | 56.8fps | **50.5 (−6.3)** | 53.4 (−3.3) |

Medians of nine; the standard deviations are 0.3 / 0.3 on beat 2 and 2.8 / 3.9
on beat 3, so beat 2's −0.1 is inside the spread and beat 3's −6.3 is not.

Beat 2 is free. Beat 3 is not: the drift's own share is 3.0fps and everything
else the act adds — the arc, the crest, the hairlines, the seam boxes, the
inverted ramp, the extra nodes and the two observers — is another 3.3fps. The
cost lands on beat 3 and not beat 2 because that is where the seams composite
alongside the 365-column city; on beat 2 only one seam is in view at a time
and the pile is 2D.

**THE RENDERER IS SOFTWARE AND THAT MATTERS HERE.** These numbers were taken
in headless Chromium reporting `ANGLE (Google, Vulkan 1.3.0 (SwiftShader
Device (Subzero)), SwiftShader driver)` — there is no GPU in this environment,
so the seams' large animated gradient layers are rasterised and composited on
the CPU. That penalises exactly this device more than a GPU-backed reader
would experience it, so beat 3's figure is an upper bound rather than a
reader's number. The renderer the first set of figures for this device was
taken under is not recorded anywhere in this repo or in the pull request, so
whether the two sets are comparable cannot be established; they are not
assumed to be.

Two findings from when the device was built are kept because the code still
answers to them, and they are flagged rather than restated as current: a
`linear-gradient` mask on the seam was found redundant next to the clip and
removed, and a full-width *second* source was rejected in favour of a narrow
highlight crossing the first — same parallax, about a sixth of the pixels.
`will-change: transform` was tried and measured worse, the same finding
`EntryShutter.module.css` reports from the other direction. **Those three
figures were not re-taken**, because the rejected variants are no longer in
the file to measure.

Largest Contentful Paint is not distinguishable, over 35 interleaved cold
loads a side at 4x CPU. `main` means 484.9ms (median 488.0, sd 25.3, range
448–560); this branch means 501.3ms (median 484.0, sd 42.2, range 452–612).
The pooled mean is +16.3ms and the median is −4.0ms — the two statistics
disagree in sign over the same seventy loads, which is the honest summary and
it is nothing. CLS was 0.0000 in all seventy and the hero photograph was the
reported element in all seventy.

**The device runs only while its act is on screen.** A continuously running
animation has to justify itself while nobody is looking and it cannot, so
`DarkAct.tsx` carries the page's third IntersectionObserver — one per act,
firing at most twice a visit, flipping one attribute the stylesheet reads. Its
`rootMargin` is a full viewport on the block axis, so the loops are always
cancelled and restarted while the act is entirely off screen; cancelling
restarts a loop at 0%, and that is only safe because nobody can see it happen.

Its three off-switches land on the act with its boundary intact — both arcs,
both hairlines, the crest, and a flat `--panel` ground. Nothing is hidden and
nothing is half-drawn; what goes is the movement. The third switch is a real
`@supports` rather than the reflex §4 warns about: there is no
`animation-timeline` here to be missing, but without `overflow: clip` the
sources paint past the arc onto the paper and past the seam onto the ground a
reader reads on, and that is both a visible fault and an unmeasurable ground.

`shutter` is the one device whose off state is *absence* rather than a finished
drawing, which is why its exits are a `null` from the component and
`display: none` in the stylesheet rather than §4's animation-plus-arrived-state
shape. Reduced motion, Pause — including a Pause only in storage, which the
class has not been applied from during the first render — and scripting off all
land on the page with nothing over it.

**It is in the ledger on the same terms as beat 3: a measured cost, not a
taste.** The first screen is tuned around a measured Largest Contentful Paint,
and an opaque sheet over the hero is the one thing that could have taken it
away. Two thirds of that fear was misplaced, for the reason
`HeroArrival.module.css` already rests on — an element behind an opaque
sibling is still a painted element, Chrome's LCP has no occlusion check, and a
solid `background-color` is not itself a contentful candidate, so the sheet
can neither hide the photograph nor steal the title from it. The reported
element is the hero portrait in every cell measured, before and after, and CLS
is 0.000 throughout: the sheet is `position: fixed` and contributes no layout
at all.

**The third was not misplaced.** 260 extra elements in React's first commit is
main-thread work in the frame the first paint is waiting on, and it showed up
exactly where it was looked for. Measured as an **interleaved A/B** — both
production builds served at once, eleven alternating cold loads a side, order
flipped each round so neither arm could drift away from the other — the
all-tiles-in-the-first-commit version cost **+60ms at 1440×900 under 4× CPU**
and +16ms unthrottled. The fix is in `EntryShutter.tsx`: the first commit is
one `<div>` with an opaque pseudo-element and the tiles arrive on the next
frame, which nobody can see because the tiles are black squares drawn on
black. What ships measures:

| viewport | profile | LCP base | LCP shutter | delta | CLS |
|---|---|---|---|---|---|
| 1440×900 | unthrottled | 128ms | 128ms | 0 | 0.000 → 0.000 |
| 390×844 | unthrottled | 128ms | 124ms | −4ms | 0.000 → 0.000 |
| 1440×900 | 4× CPU | 384ms | 408ms | +24ms | 0.000 → 0.000 |
| 390×844 | 4× CPU | 388ms | 372ms | −16ms | 0.000 → 0.000 |

Unthrottled it costs nothing at either width. Under 4× CPU the two cells
disagree in sign, so the desktop one was re-run at fifteen rounds and held at
**388 → 408ms, +20ms** — small, real, and about 5% of a figure measured on a
machine pretending to be four times slower than it is. That is the price of
the device and it is recorded here rather than rounded away.

A 400kbps network profile was tried and dropped: at 7.7–9.1 seconds it is
entirely network-bound and several loads produced no LCP entry at all, so it
measures the connection rather than the device.

**`pen` is not a beat, and it is not a peak — it is how running text is
read.** `motion/Written.tsx` wraps prose, not sections: the wall text's
paragraphs, a post's paragraphs and list items, a project's description,
brief and decisions. Every word starts muted, and as the paragraph rises
through the READING WINDOW — its top at 68% of the window's height to its
bottom at 38% (2026-11-03; it was 95% → 62% after #174, 85% → 45% before)
— the pen inks it one word after another in reading order and leaves it at
ink, and un-writes it word by word if the reader scrolls back (#158: word
`i` of `n` owns the slice `i/n`–`(i+1)/n` of the paragraph's clock, so at
most one word is ever mid-stroke).

**One block at a time (2026-11-03).** The owner: "several sections ink at
the same time … it should feel like reading", and it "starts too early,
when the text is at the bottom of the window". Both were true: a block's
clock was `h + 33vh` of scroll from the window's foot, so neighbours a
margin apart shared a third of the window and two or three were mid-ink at
once. Now:

- **One shared constant.** `READING = { from: 0.68, to: 0.38 }` in
  `motion/penClock.ts`, and the same two numbers as `--read-from` /
  `--read-to` on `:root` in `index.css` (a test holds them equal). The
  pen's `view-timeline-inset`, the near-watch's zone (the window ± 4%) and
  the approach figures' clock are all cut from them.
- **A sequencer.** `Written.tsx` registers every block, measures their
  places once per layout change (not per frame), and `sequence()` gives
  each its turn: a block may not start before the previous one (document
  order) has finished, and must finish by the time the next is due to
  start. A block keeps its own start — top at 68% — whenever the previous
  one is done by then; in dense prose it is written while it crosses the
  68% line, and a block with room below keeps its whole clock. The turn is
  handed to CSS as `--pen-lead` / `--pen-span` on the block, and each word's
  range is scaled into it. Blocks inside a sticky or fixed box keep their
  whole clock (a distance measured to them is not the scroll to them).
- **Held by tests and in a browser.** `Written.test.tsx` checks the
  arithmetic on dense, gapped, long and side-by-side layouts (never two
  turns overlapping; each starting at 68%; done by 38%).
  `web/scripts/shoot-aurora-reading.mjs` steps the home page's wall text
  and a project page through 1/40 of the window at a time, in both themes,
  desktop and phone, counts the blocks mid-ink at every step (asserted ≤ 1)
  and records where each block's first word starts (asserted 65–70%);
  frames in `docs/aurora-reading/pen-{home,project}-*.png`, numbers in
  `report.json`. It sat beside
`flow` on the wall text without colliding with it (until #157 retired
`flow` there), because they answer
different questions: `flow` is *when a block arrives*, once; `pen` is *which
words are being read*, on every pass, and it is the same on every page that
has prose. A family that is a property of a kind of content rather than of a
place on the page has no neighbour to repeat, which is the same argument that
keeps `sweep` and `drift` out of the beat numbering.

It is not the page's third engineered peak, on the peak rule's own terms. It
buys no scroll distance — it pins nothing, and a paragraph is exactly as tall
as it was. It has no asset budget: no image, no canvas, no layer, nothing
but the colour of text that was already there. Its muted state is
deliberately texture rather than text (#174, argued next), and it is never
what a reader is left with: every word is at full ink before the eye
reaches it, and the off state is not a lesser version of the pen but the
page with all prose at full ink, which costs a reader nothing to choose. A peak is the thing the page
spends its budget on; this spends a frame cost, measured below, and nothing
else.

**Muted is readable again: `--ink` at 62% (2026-11-03).** The owner's rule
now is that text must always remain readable, so the unwritten state may no
longer be texture. It is `--ink` at 0.62: 4.84:1 on paper, 4.69:1 on the
raised paper, 6.5:1 and over on the dark grounds — above the 4.5:1 floor on
every ground prose sits on (computed from the tokens in `Written.test.tsx`)
and still a clear step below the full ink the pen writes it to (15.17:1).
The exception argued below is **retired**; it is kept as the record of why
0.22 was chosen and what it cost. What the pen gives now is the step from
a readable grey to full ink at the line the reader is about to read, one
block at a time — no longer the difference between unreadable and
readable.

**Was: muted is texture: `--ink` at 22%, a deliberate contrast exception
(#174).** Until #174 the muted state was `--ink-soft`, the page's second
text colour, chosen so the pen could never make anything less legible than
the page set it. The owner sent that back from preprod: "the text that are
supposed to be muted are still too bold, need to be very muted, to be FEELED
as muted and not to read until I come to him." He was right on the pen's own
terms. At 6.37:1 a paragraph not yet written *is* a paragraph — a reader
reads it in grey and the pen has nothing left to give. So the unwritten
state is now the same ink at an alpha of 0.22: the paragraph's shape is on
the page — where it sits, how far it runs — and its words are not legible
until the pen reaches them.

| where | ground | muted, before (`--ink-soft`) | muted, after (`--ink` / 0.22) | written / off (`--ink`) |
|---|---|---|---|---|
| wall text, home | `--paper` #ECE8DC | #55524A, 6.37:1 | ≈ #BCB9AF, **1.60:1** | 15.17:1 |
| a post's body, /story, the contact close | `--paper` #ECE8DC | #55524A, 6.37:1 | ≈ #BCB9AF, **1.60:1** | 15.17:1 |
| any prose inside a dark act (via `.on-panel`) | `--panel` #0C0C0E | #A8A49A, 7.86:1 | ≈ #3F3E3E, **1.83:1** | 17.15:1 |
| a project page (#242: the dashboard ground, `notes/DarkCard` stops) | `--panel` #1C1A16 | #A8A49A, 6.98:1 | ≈ #4B4945, **1.93:1** | 15.25:1 |

Weight is not touched. The text face (Atkinson Hyperlegible Next) is
variable from 400 to 700 and is set at 400, so there is no lighter weight
to drop to, and any weight change moves advance widths and so line breaks —
which the pen must never do. Colour is the whole effect, and it stays one
`color` declaration on an inline span.

Why the exception holds, and the conditions it holds under — each one is
checked, not assumed:

1. **The muted state is decorative, not content.** It carries no
   information the written state does not; it is the written state, not
   yet arrived. 1.4.3 is a floor for text a reader is meant to read, and
   the pen guarantees a reader never has to read it: the clock (below)
   inks every word while it is still in the lower part of the window, so
   the eye — which reads above the middle — meets only written words.
   `scripts/measure-written.mjs` measures exactly this as `waited`: the
   share of the scroll at which any word in the top half of the window is
   not at ink. It is 0% on every consumer at both widths.
2. **The text's real state is full ink, 15.17:1.** It is the state every
   word is left in, the state of everything above the reader, and the
   state the accessibility tree and the clipboard have always had (the
   spans add no characters and no roles).
3. **All three off-switches show full ink.** Reduced motion, the site's
   Pause and a browser without `animation-timeline` each cancel the
   animation and land on `--ink` — not on the caller's colour, because most
   prose here is set in `--ink-soft`, and landing there would land short of
   written. Print is a fourth exit. `npm run a11y` now checks it: on every
   route, both directions and both widths, under reduced motion, and on
   `/`, `/story`, a project and a post under Pause with motion otherwise
   on, every word `Written` made must compute to its paragraph's `--ink` at
   full alpha, and axe measures the contrast of that state.
4. **It is never the colour of anything else.** `--ink-faint` (3.60:1)
   stays non-text and the pen does not use it; the muted alpha exists only
   inside `Written.module.css`, only before a word's slice of the clock, and
   only while the effect is running.

The rendered-glyph figures `index.css` records for the text face
(coverage-weighted, lowest on paper 4.69:1 for a 12px chip in `--ink-soft`)
are for the written state now, and it clears them with room: body copy in
`--ink`. Screenshots of the off-switches are in `docs/written/`
(`174-after-off-*.png`), beside the mid-paragraph shots of every consumer
before and after.

**Two things it found that are worth not rediscovering.**

- **A `view()` timeline on an inline box does not track the box.** Every word
  of a three-line paragraph reported the same progress in Chromium: an inline
  subject resolves to the block it is laid out in. So the paragraph names the
  timeline and each word reads it through its own slice (`--pen-from`,
  `--pen-to`), set at render from the word's index — no measurement.
- **Placing the pen by geometry wrote blocks, not words (#158).** The first
  version put each word at its line's offset plus `1lh × its place along the
  line`, lit for a 14vh band: a word-to-word step of ~2px against a ramp of
  ~10px, a whole line per 31px of scroll (a third of a wheel notch), and four
  lines lit at once. The pace was tied to the text's own movement. A word
  count is not, and is immune to resizes and font swaps besides.
- **The split is inline spans, never inline-blocks, and that is what keeps
  bidi.** An inline-block is a neutral object to the bidi algorithm; the hero
  found this as ADUHEY NAMXSIRB under `dir="rtl"` (#110) and fixed it with
  `direction: ltr`, which is right for a Latin name and wrong for a
  paragraph that may be Hebrew. An inline span is invisible to bidi. Measured
  word-for-word against an unsplit twin of every wall-text paragraph — in
  English, in English under `dir="rtl"`, and in Hebrew with Latin names
  inside — no word moved by more than 0.38px and no paragraph changed height.

**What it costs, measured (2026-11-02).** At 4x CPU throttle, scrolled 16px
a frame through the wall text, main against this branch, arms interleaved
and the order flipped each round. Frame time is the round trip of one
`HeadlessExperimental.beginFrame` in a software-rendered headless shell,
because Chromium on this box has no frame clock of its own (README rule 6):
the numbers compare arms with each other and are not fps on a device.

| case | main | pen, every paragraph live | pen, parked off-band | pen, paused |
|---|---|---|---|---|
| wall text, 230 words (5 rounds; gate 3) | 16.9 ms | 24.6 ms | 23.5 ms | 13.9 ms |
| five times the prose, 1,127 words (3 rounds) | 15.9 ms | 28.9 ms | **16.2 ms** | — |

What that says. The spans are free: paused, with every word split and none
animating, is no slower than main. The cost is words animating, and it
grows with how many: ungated, five times the prose costs five-times-ish
more. Hence the observer that parks a paragraph outside the window round
the band, which takes the long case back to main's number. It
cannot do the same for the wall text, because the wall text is short
enough that most of it is near the band at once; there the pen costs about
7ms a frame at 4x throttle, on a section with no other scroll work, and it
is that or nothing for those words. Since #158 a parked paragraph is
`below` (muted) or `above` (ink), each the value its fill would hold there,
told apart by a second observer whose zone runs from the zone's top edge
upwards without end, so a jump past the zone cannot leave a read paragraph
muted.

**"Laggy to appear" was timing, not frames (#174, measured 2026-11-02).**
The owner's second note was that sections are slow to appear. Two causes
were possible and they need different fixes, so both were measured on every
consumer with `web/scripts/measure-written.mjs`, main against the branch:

- *Timing.* Scrolled in 12px steps with a frame driven per step, the window
  position (0 top, 1 foot) at which each paragraph's first and last words
  reach full ink, as a median over the route's paragraphs, and `waited`:
  the share of steps at which any word in the top half of the window — where
  the eye is — was still not at ink.
- *Frames.* At 4x CPU throttle, 16px a frame, the round trip of one
  `HeadlessExperimental.beginFrame` (median), with a `devtools.timeline`
  trace for style recalc and paint per frame and the count of tasks over
  50ms. Three rounds, arms interleaved; the same with the site's Pause on
  isolates what the pen itself costs. (Wall time on this box moves with its
  load; the trace's re-styled element counts do not, and agree.)

| consumer, 1440×900 | first / last word inked, main | branch | `waited`, main → branch | frame median, main → branch (paused) |
|---|---|---|---|---|
| Approach (home) | 0.82 / 0.41 | 0.93 / 0.58 | 34% → **0%** | 18.9 → 18.4ms (11.3) |
| contact close | 0.83 / 0.42 | 0.93 / 0.58 | 10% → **0%** | 18.9 → 19.1ms (0.9) |
| /story | 0.82 / 0.41 | 0.92 / 0.58 | 16% → **0%** | 7.5 → 7.7ms (4.4) |
| a long post | 0.84 / 0.41 | 0.94 / 0.58 | 36% → **0%** | 16.5 → 17.0ms (9.7) |
| a project page | 0.83 / 0.41 | 0.94 / 0.58 | 22% → **0%** | 83.1 → **14.7ms** (11.5); long tasks 180 → 0 |

| consumer, 390×844 | first / last, main | branch | `waited` | frame median (paused) |
|---|---|---|---|---|
| Approach (home) | 0.82 / 0.41 | 0.92 / 0.57 | 30% → **0%** | 19.7 → 17.2ms (9.5) |
| contact close | 0.83 / 0.41 | 0.93 / 0.58 | 7% → **0%** | 17.8 → 17.3ms (2.1) |
| /story | 0.81 / 0.41 | 0.91 / 0.58 | 15% → **0%** | 6.2 → 6.0ms (3.5) |
| a long post | 0.84 / 0.41 | 0.94 / 0.58 | 29% → **0%** | 14.2 → 13.6ms (8.3) |
| a project page | 0.83 / 0.41 | 0.93 / 0.58 | 19% → **0%** | 76.4 → **11.2ms** (9.8); long tasks 244 → 0 |

What it says. The old clock finished a paragraph with its last word at 41%
of the window — above the middle, where the reader already is — so for a
sixth to a third of every scroll the reader was looking at words the pen had
not written yet. That is the lag the owner felt, and it would have got much
worse with the new muted state, because a word at 1.60:1 cannot be read
ahead of the pen the way `--ink-soft` could. The new clock (95% → 62%)
writes every word while it is in the lower part of the window: 0% on every
consumer at both widths, and no paragraph left unwritten at the foot of any
page (the measurement scrolls to the end and counts).

The pen's frame cost did not cause it and did not change: it is 3–9ms a
frame at 4x throttle over Pause, the same on both arms, with no long tasks.
It is spent in style recalc and paint of the words of live paragraphs, as
measured before. The option of one animation per paragraph instead of one
per word — a registered `--pen` number animated on the paragraph, each word
computing its ink from it — was built and measured, and is worse: it
re-styles every word of a live paragraph through inheritance on every frame,
and a long post's style went from 3.0 to 16.8ms a frame. So the words keep
their own animations, and the near-watch zone tightens with the clock (58%
to the foot, from 40%) so fewer paragraphs are live at once.

**What the measurement found that was not the pen: project pages.** A
project page cost 63–95ms of style recalc a frame at 4x throttle, a long task
on every frame, with the pen paused as much as running: about 1,100 elements
re-styled per frame. `useScrollProgress` wrote `--vh` on `<html>` on every
scroll frame for the cover figure's drift, and an inherited custom property
written on the root invalidates the whole document. The value is now written
on the drifting figure's own box, its only reader — measured on its own (3 rounds, 4x), 83 → 14.7ms a frame at 1440×900 and 76 → 11.2ms at 390×844, style 85 → 3.4ms, ~1,100 → 45 elements re-styled a frame, and no long tasks where every frame was one.

**The sweep row is not a beat either, and for a different reason from the
shutter's.** `shutter` is not a beat because it happens before the page;
`sweep` is not a beat because it is not on the page at all when anything is
working. It is what a region does while it is waiting — one band of light
crossing the shape of the content that has not arrived — and on a warm cache
or a local response it is never painted, which is the measured normal case
and not a degenerate one. See §4's note on the gate.

It is in the ledger on the ledger's own terms: it is a new family, and a
family is listed so that it is not quietly reused. A band travelling along a
shape means *this is coming*. Nothing else on the site may say that, and this
may not be borrowed to say anything else — in particular it is not a hover
shine, not an attract loop on a control, and not a way to make a finished
region look busy. The empty contribution lattice is the case worth naming:
the same drawing carries the sweep when a year is on its way and must not
carry it when the year could not be read, because then nothing is coming and
the chart is finished.

Three properties keep it out of the beat sequence's budget, and all three
were the conditions for adding it. It costs no page height, because the
region it fills is a region the content was going to occupy anyway — that is
the whole point of it, and the measurements are in the pull request for #83.
It costs no scroll distance and has no range, being time-driven. And it is
one `background-position` animation on a gradient that is already painted,
so a region of thirty placeholder lines is thirty cheap paints and no second
element, no per-capsule compositor layer and nothing per frame on the main
thread. The one place that could have gone wrong is the contribution
lattice's 371 cells, which take a single band across the frame rather than
one animation each.

**A SWEEP'S PEAK IS A PROPERTY OF ITS GROUND, AND THE FAMILY NOW SPANS TWO.**
The band is `rgb(var(--ink) / a)`, so it darkens the surface it crosses on
paper and lightens it on a dark act with no second declaration — `.on-panel`
re-points `--ink`. The alpha does not carry across, and it fails in the
direction nobody expects: on a near-black ground the same alpha is too
strong. Measured, 0.05 over the lattice is a step of dL* 3.44 on `--paper-3`
and 4.77 on `--panel-3` — 1.39x — so the placeholder out-shouts the chart it
stands in for rather than sinking into the dark. The contribution lattice is
solved at 0.035 for that reason, which reproduces paper's step at dL* 3.36.
CIE L* and not a WCAG ratio, because the ratio's 5% flare term dominates at
0.37% of luminance and inflates every small step there; the two metrics agree
anyway, at 0.0349 and 0.0365. Anything new in this family that lands on a
dark act has to be re-solved the same way, and the capsule in
`gallery/Skeleton.module.css` carries paper's 0.05 deliberately — salience
scales with area, and a 0.66em capsule at that step is not a 230x1152px frame
at it.

Its off state is a finished drawing and not absence, which is the ordinary §4
shape and the opposite of the shutter's: under reduced motion or Pause the
band and its gradient are both cancelled and what is left is the flat
capsule. A skeleton that vanished under those conditions would leave the
region with no height, which is the layout shift the device exists to
prevent.

**The breath row is not a beat either.** Until #162 it was the one thing on
the page that looped while the reader did nothing; since #162 it does not
loop at all — the lamp breathes three times and the phrases turn across the
first 36% of the stretch the hero is held for (`contain` on the `--hero`
view timeline, which since 2026-11-03 is the static holder's, not the
pinned hero's), and run back on the way up (§8). `HeroCorners.tsx` puts a 0.5rem lamp of `--signal`
in the title plate's end corner, with a ring leaving it once a breath, and
beside it the owner's README asides — "Technology", "Build boldly" — one at a
time. A soft light that rises and falls means *this is on*.
Nothing else on the site may say that with a loop, and this may not be
borrowed for an attract loop on a control, a "new" badge, or a pulsing
anything elsewhere; a second ambient loop on the page makes the first one
wallpaper.

It cannot compete with beat 0 because it waits for it: nothing in it moves
until the staged assembly publishes its last token, and the lamp waits a
further 1.2s for the corners to settle. It costs no page height and no scroll
distance, being out of flow in a corner; it is three compositor-friendly
animations (`transform`, `opacity`, `box-shadow` on an 8px disc) and no
script — the rotation is one keyframe set offset per phrase, so there is no
timer and no render per change. A screen reader hears one stable sentence of
every phrase and the rotating stack is `aria-hidden`; nothing is `aria-live`.

Its off state is the ordinary §4 shape: under reduced motion and Pause the
lamp is lit and still and the first phrase is the corner's whole statement.
It is time-driven, so it has no `@supports` block. Under `forced-colors` the
lamp is removed, since a system colour would paint it in a hue nobody chose.

**Beat 3 is not a second peak, and the test it had to pass is on paper
rather than on taste.** Until #111 the test was easy: it did not pin, so it
bought no scroll distance beyond its own section's height. #111 asked for more
of it — bigger, and more time — and a scrub's only clock is scroll, so it now
holds its frame (`position: sticky`) over a runway, on a static stage
that owns the named timeline exactly as §1 prescribes. That makes it a held
beat, and the test is now comparative and measured: the run holds for 220svh
(55svh a card, four cards) and the year for about 150svh; the work section is
3397px against the year's 2651px at 1440×900, same page, same data. (The
pile it replaced held about 238svh, a 3919px section.) The run keeps the most
scroll room,
the only asset budget and `pin` as its *move*; what the year holds still for
is a camera dolly down its own grid, which is the scrub continuing rather than
a second family arriving. It has no asset budget, being 365 one-colour boxes
and no image; and it runs backwards when the reader scrolls back up, which is
what makes it a thing the reader operates rather than a thing that happens to
them once.

**Its pace (#246, 2026-11-03).** The owner found the scrub about 30% quick,
so the same choreography now plays over 1.3× the scroll: `--city-pace: 1.3`
in `ContributionCity.module.css`, with the runway solved so the act's clock —
the stage's `contain` range, which is `frame + runway − 100svh + 88px` because
the auto inset takes the document's `scroll-padding-top` — is exactly 1.3×
#111's on every window. The keyframes are untouched, so every stage grows in
proportion. Measured (`web/scripts/shoot-contrib-speed.mjs`, the scene's own
progress read back at each boundary):

| stage | 1440×900 before → after | 390×844 before → after |
|---|---|---|
| flat, held (0–10%) | 97 → 126px | 82 → 106px |
| turn (10–30%) | 194 → 252px | 163 → 212px |
| rise (30–48%) | 175 → 227px | 147 → 191px |
| dolly in (48–60%) | 116 → 151px | 98 → 127px |
| dolly along (60–100%) | 388 → 504px | 326 → 424px |
| **the clock** | **970 → 1261px** | **816 → 1061px** |

The start and the hand-off do not move. The act still begins 11px after the
frame pins (the inset was left alone: zeroing it, as the run does, would put
a still stretch in front of the act), and the next section's top still sits
260px (338px on the phone) below the window on the act's last frame — the
section's own padding, exactly as before, so no dead gap was added. It still
runs backwards: the progress read scrolling up matches the progress read
scrolling down at every offset tried. The three off-switches give the whole
runway back (`height: auto`), so they are unaffected. Before/after frames at
the same scroll offsets are in `docs/contrib-speed/`.

Its three off-switches land on the **risen** city, still, at rest height and
with the runway given back — not on the flat grid, which is where they landed
before #111. §4 says an off-switch lands on the finished state, and the
finished state of this act is the city, not its first frame; the issue asked
for exactly that. The flat lattice is now only what the *data* exits draw (a
year still coming, or one that could not be read).

Since #111 the city also answers a hand: drag sideways to turn it a few tens
of degrees (it settles back), and point or tap at a column for one shared
readout of that day. It is direct manipulation of the act's own camera rather
than a pointer device bolted on, and none of it is focusable — the scene and
its readout stay `aria-hidden`, and the caption and the twelve-month table are
still the whole accessible path. `touch-action: pan-y` leaves a vertical swipe
to the page, so on a phone the scroll that drives the act is never taken from
the reader.

Measured at 4× CPU throttle on the #111 build (dev server, wheel-scrolled end
to end, median of five passes after a warm-up): 22–23fps at 1440×900 against
28.8fps for the pre-#111 city on the identical harness, and 32–34fps at
390×844 against 34.2fps. Dragging holds 29fps and 43–48fps. The desktop cost
is frame area — the same boxes, drawn about three times as large — and it is
paid on a beat the reader can switch off into a finished chart.

Both of those were taken against a **synthetic** 365-day calendar, because no
token was available at the time, and the shape of that year is what made a
linear column height look right for as long as it did (see #81). Re-profiled
against the real calendar when the height was changed to a square root — same
harness, 4× CPU throttle, five passes after a discarded warm-up — the city
runs at a median 54.6fps against 54.1fps for the old linear heights on the
identical page, and about 5.7fps under the same section with `motion-paused`
set. The scale change is inside the run-to-run spread; the cost of the act
itself is the 5.7fps, and it is paid on a beat the reader can switch off into
a finished chart. Nothing about the column count or the one-animation build
changed, which is why it was never expected to move.

**The order in this table is the intended one and is not the order
`pages/Index.tsx` renders today.** The page renders the run *before* the wall
text, so the shipped sequence is title plate, run, wall text, the year, notes
shelf, specs, inquiry plate. `Approach.tsx` used to describe itself as "the
quiet before the peak", which is the arrangement above and not the arrangement
shipped; since #157 it describes neither. Recorded here rather than silently renumbered, because which of the
two is wrong is a decision about the page and not about this document. No
adjacent pair repeats a family in either order, which is why the discrepancy
has never produced a visible fault.

Beat 0 was `reveal` and is now a staged assembly of four moves — letters, then
the portrait, then the chrome, then the remaining lines — each gated on the
previous one's real `animationend` rather than on a delay. So `reveal` stopped
being a matched pair of bookends, and since #160 no beat uses it at all.

**Beat 6 is `surface` (#160), and it is scrubbed, not fired.** The owner's house
rule (2026-11-02) is that scroll is the clock: every arrival is driven by scroll
position and reversed exactly when the reader scrolls up, nothing on a timer and
nothing fired once by a trigger. The close was the last beat still on `Rise`.
Each part of the plate that is not running text — name, fact line, field line,
the button, the receipt, the address — rises out of its own baseline: translated
up by its own height while a clip on its bottom edge opens by the same amount,
so the visible edge stays where the part will rest. The paragraph takes the pen,
as every paragraph does. The closing rule keeps the scroll-drawn hairline it
already had. Code: `Contact.module.css`, `.surface` and `@keyframes surface`.

- **Not `count`, its neighbour.** Beat 5 lands numbers; beat 6 moves no value
  and draws no figure, so the adjacency rule holds.
- **Not a second `scrub`.** Same argument as the heads above: nothing here is a
  drawing the reader operates or that carries information. It is reversible
  because every `view()` timeline is, and because the house rule asks for it.
- **Not a veil, so nothing to measure at a parked frame.** A clip is binary per
  pixel: whatever can be seen of a part is at full ink (15.17:1 for the name,
  6.37:1 for the soft lines on paper). An opacity fade would have parked text
  under 4.5:1 for as long as the reader stopped scrolling, which is why there
  is none.
- **One timeline per part, not one per plate.** A shared timeline gives each
  part a range in scroll distance from the plate's top edge, and on a phone a
  part 400px down would finish arriving before entering the window. On its own
  `view()` each part runs `entry 30%` to `cover 36%` (about 320px at 900), so
  the order is reading order because the layout is. `ease-out`, not
  `--ease-settle`: on a scroll timeline the curve maps distance, and the
  settle curve had a part fully arrived 130px into the window.
- **A focused control is never in a slot.** `.plate:focus-within` cancels the
  animation, so a keyboard reader tabbing onto a half-risen button gets the
  whole plate arrived.
- All three off-switches cancel it outright and land on the resting CSS, which
  is the arrived state (§4).

The contact dialog is not a beat. It answers a press, not a scroll, so it is
the one thing in the section on a clock: the scrim fades and the panel rises
16px from 98.5% over 420ms on `--ease-settle`, and leaves in 180ms. The close
animates only because `display` and `overlay` transition as discrete
properties; `@starting-style` is the open's first frame. Under reduced motion
or Pause it opens and closes without moving.

**Every beat must be able to state its one reason in a sentence.** A beat that
cannot does not have one, and gets cut rather than kept.

**Banned outright by the gallery grammar**, listed here so they do not creep
back: `spotlight`, `magnet`, more than one `scrub`, and a
pinned argument-shaped type act. The one `scrub` the page is allowed is now
spent, on beat 3; a second one is the ban and not a judgement call. Holding
the year's frame for its runway (#111) does not spend `pin` a second time:
`pin` is the run's move — the work travelling under a held frame — and a held
scrub is still a scrub. It does spend scroll, which the next rule counts.

**Allowed and currently unused:** `tilt` on objects the visitor would pick up
(3–9°; past 12° it is a toy). It is the one pointer device this grammar invites.
The year's orbit (#111) is not this: it is a drag on a scene's camera, with a
rubber band at 30° and a hard stop at 48°, and it does nothing until the
reader presses — a hover never moves it.

Two rules about the cost of a beat, both of which are about page height rather
than about motion:

- The wall text, directly after the pinned act, takes **reduced** padding. The
  stage needs a full viewport to scroll off, and full section padding on top of
  that delays the next section's first content by another screen.
- Every pinned beat buys its time in scroll distance, and the reader pays for
  it. Review total page height against the beat count, not each beat on its own.

When a beat changes, this table changes with it. A ledger that describes the
previous build is worse than no ledger.

### The aurora strand: one appearing, two strands and a lead (2026-11-03)

The owner, on the live site: the aurora on "How I work" "should start from
the left side of the page, appearing like in the Projects section", and the
notes should have "the aurora like in Projects too, almost the same
animation, but from the left". So the run's appearing became a primitive,
`motion/AuroraStrand.tsx`, with a `from: "left" | "right"` option, not
copies.

**v3, after the owner's preprod review of #275 and #276 (same day).** Three
notes, three changes (`docs/aurora-v3/`):

- *"Remove the aurora from the hero."* The ribbon round the figure
  (`HeroRibbon`, `heroRibbon.ts`) is deleted. The portrait, its hold under
  the next act and the corners are unchanged.
- *"How I work: remove the additional aurora."* #276 had laid a full-width
  strand across the head for the living line to start from, so the section
  showed two: that band, and the line's own loop round the heading. The
  band is gone. The line itself now comes in from the page's left edge (the
  start edge; the right in Hebrew): a full-bleed marker in the section's top
  padding (`data-line-origin="approach-enter"`) carries an `enter` move
  (`motion/lineMoves.ts`) that starts 96px off the edge, runs in above the
  head, turns down beside it on a 28px quarter circle and comes back under
  it — the loop round the heading and its role line, as before.
  That run in is the line's **lead**: the scroll map gives it no height
  (it is drawn from the start), and a soft-edged window uncovers it from
  the edge instead — the strand's own numbers (130% wide, the leading 30%
  soft), as a `mask-position` on the drawing (`LivingLine.module.css`), on
  the drawing's own `view()` from its top at 95% of the window to the
  middle, where the tip's clock starts. So it appears the way the run's
  aurora does, and the tip takes over where it turns down.
- *Notes: "the aurora appearing from the side doesn't match the notes."* The
  band was centred on the frame, i.e. on the middle of the cards' slots
  (card plus the room it grows into), half a growth below the cards' own
  middle; it met the first card off centre and seemed to stop at its edge.
  It now shares the track's grid cell and sits on the middle of a card (at
  rest, or open where cards stand open), the frame's full width: in from
  the left edge, into the first card at its middle, in every gap, out past
  the last. It is the line the row travels on, as the run's is. Measured on
  every frame: band middle = first card's middle, to the pixel, at 1440 and
  390.

| where | `from` | clock | range |
|---|---|---|---|
| the work run (`projects/RunAurora.tsx`) | `right`, mirrored in Hebrew (`mirrorInRtl`) | `--run`, the stage's | `entry 40%` → `contain 6%` |
| the notes shelf (`LatestNotes.tsx`), on the cards' middle line, the frame's width | `left` (the frame is mirrored in Hebrew, and the strand with it) | `--notes-shelf`, the stage's | `entry 40%` → `contain 6%`, as the run |
| "How I work" (`Approach.tsx`): not a strand, the living line's lead | the start edge (`enter`, `side: "start"`) | the line's drawing, `view()` | `cover 5vh` → `cover 50vh` |

**The appearing** is the run's (#192), unchanged: a window 130% of the box
wide, its leading 30% a soft mask edge, slides in from `from` while the
drawing inside it is carried back by exactly the same amount, so the light
holds still and is uncovered rather than dragged. Two transforms on a scroll
timeline; scroll back and it leaves the way it came. The window bleeds 48px
above and below its box, because a mask paints nothing outside the masked
box and the haze's blur needs the room. The strand reads its caller's
timeline; it owned one of its own only for the band on "How I work", and
that went with the band.

**Off-switches.** The line's lead is declared only inside the positive gate
(§4), so every off-switch shows it whole, with the rest of the line drawn.
On the run and the shelf the layout itself becomes a plain list: the run
keeps its still vertical ribbon (unchanged), the shelf hides its band.
Forced colours hide every strand.

Frames: `docs/aurora-v3/{hero,approach,notes}-<theme>-<desk|phone>-<k>.png`,
k in scroll order, and `report.json` (`web/scripts/shoot-aurora-v3.mjs`,
which also asserts: no strand in the hero; no band on "How I work", the
line's tail off the page's left edge and its window home; the notes' band
on the first card's middle and the frame's width).

### /projects: the catalogue, and why it is not the run (#169, #175)

The table above is the home page's. `/projects` is a different page with a
different job, and since #169 it has had its own device rather than a second
copy of the home page's. #173 made that device `riffle`, a register whose rows
stood up one at a time. #175 replaced it with a gallery wall under an
instrument panel, on the owner's call: "bigger", "more like a dashboard",
"almost like an images gallery". He chose it from three options (a ledger, a
board, year lanes) and asked for the board, mixed with the lanes' panel.

| page | device family | the one reason it exists |
|---|---|---|
| ~~`/projects` (#175 until #227) and `/blog` (#193 until #224)~~ | ~~**`assemble`**~~ | **retired in #227**, when the last page on the wall became a dashboard; the row is kept for what it was: each band of the wall closes in from its own edges as it comes up the window: a piece on the left slides in from the left, a piece on the right from the right, a piece in the middle rises. So the wall is hung by the time the eye reaches it, and nothing in the reading band moves |
| ~~`/projects` panel~~ | ~~`draw`, on bars~~ | **removed in #193** with the panel itself: the owner's call, "it doesn't belong" |
| `/blog` (#224) | **none** | the notes left the wall for a dashboard: compact rows and cards a reader scans, filters and opens. Nothing on it arrives, rises or assembles; what moves is what the reader moves |
| `/blog/area/:slug` (#225) | **none** | an area's notes as a commit history on the same shell: read by scanning down days and acting on a row, so nothing arrives and nothing is spent |
| `/projects` (#227) | **none** | the work left the wall for the same dashboard: repository cards a reader scans, sorts, filters and opens. Nothing on it arrives either |
| `/blog/log` (#226) | **none** | the channel log is the dashboard's shell with a list of days in the middle: a reader scans it, filters it and asks for more. "Load more" appends rows where they belong, at once, and moves focus to the first of them; a filter is a navigation |

**#224: /blog is a dashboard, and has no device.** The notes index became a
three-column dashboard (a side rail of views, areas and filters; a middle of
search, top posts, a tree of areas and the latest notes; a timeline of the
site's activity). It is read the way a working tool is read, by scanning and
picking, so it gets no scroll act at all: the tree opens and closes at once
(its twisty turns with the shared `--dur-micro` hover/focus transition), the
Home/Feed switch is a navigation, the phone's rail sheet is a native
`<dialog>` shown and hidden without a transition, and the loading skeletons
keep the shared sweep with its three off-switches. Its dark ground (the note
cards' `#185` panel, now edge to edge, with `data-chrome="dark"`) is a ground,
not an act: see `ground/DarkAct.tsx`.

**#225: an area's history has no device either.** `/blog/area/:slug`
replaced #224's interim list with the area's notes grouped by day, each row
with a short id and three actions, the repo's facts in the header and a side
card. Every change on it answers the reader and none is animated: a copied
link swaps its icon for a tick for two seconds (a state, not a transition)
and says so in a polite live region; the share fallback (copy, LinkedIn, X)
is shown and hidden; a heading's copy-link button inside a note does the
same; `j`/`k` move focus, and the only scroll is the browser's own on focus,
never a smooth one; the topic filter is a navigation. Hover and focus keep
the shell's `--dur-micro` colour change.
**#227: /projects is a dashboard too, and has no device.** Work moved onto
the Blogs shell (`dashboard/DashboardShell.tsx`): the filter control, Pinned
and the areas with notes in the rail; pinned repository cards and a sortable
list in the middle; the latest releases on the right. The sort is a link
(`?sort=`) that replaces the URL and keeps the scroll, so the list re-orders
in place with no transition. Each card's strip of pushes and releases is a
still diagram, placed by date and drawn once. The project page gains GitHub's
tabs (`work/Tabs.tsx`, `?tab=`): the underline is drawn on the selected tab,
not slid to it, and a panel appears without a transition. The Overview panel
keeps the page's existing devices (then `InkWipe`, `Written`, the figure's
drift) unchanged; the other three panels have none. With no page on it any more,
`gallery/Wall.tsx` is left in place, unused, for the owner to delete or
keep, as #224 did with `NoteTile`; `projects/Gallery.tsx` has since been deleted.

**#242: the project page joins the dashboard, and keeps its three devices.**
`/projects/:slug` moved off paper onto the same dark shell: a GitHub-style
header (Work / name, the status pill, the tagline, Source and Release as the
shell's buttons), the pinned projects in the rail with this one current, and
an About aside with the repository's as-of facts (`RepoFacts`, the area
header's). None of that moves. The Overview is its old content re-laid in
bordered cards, in the same order, and it is the one place on any dashboard
page with a scroll device: the description, the brief and each decision are
still `Written` (the ink alpha reads `--ink`, which `.on-panel` re-points, so
the pen's off state is still full ink on the dark ground), the highlights and
decisions still arrived through `InkWipe` (retired in #251, below), and the figure keeps its `--vh`
drift written to its own box by `useScrollProgress`. The page is a
repository's front page that is also read, so it keeps the reading devices
and gains no new ones; the rows above and below (`Written`, `InkWipe`) keep their /projects/:slug routes. Its
loading state left `.scrub-pulse` for the shell's skeleton rows, so that
row loses the route and the sweep row gains it.

**#251: the wipe retired; one arrival, and the circle as a system.** The
owner, 2026-11-03, on the ink wipe crossing a project page: "there's still an
appearing animation that is not on par with the app brand. Remove it and
switch to something better." The wipe printed a block behind a hard,
raked clip edge with a saturated band riding that edge, so for the whole of
its range part of the text was hidden and part was painted over in red,
yellow or blue. `InkWipe` and its stylesheet are deleted, with the dead
`--wipe-radius` / `--wipe-hue` plumbing in `PaperCard.module.css`.

Its replacement is one primitive, `motion/Arrive.tsx`, and it carries a
rule this contract did not have before:

> **An arrival never covers, clips or fades the content.** No clip-path, no
> opacity, no pseudo-element over the box, not for a frame. The text is at
> full ink from the first pixel of it that is on screen. What may move is
> where the block sits, and marks *beside* the content.

So an arrival is two things, both scrubbed by `view()` and both reversed on
the way up: the block rises the last 12px into place over the first 240px of
its entry (or its whole entry, if it is shorter — a block that is fully on
screen has always arrived, so a short page cannot leave one hanging), and a
`Ring` by its heading — the living line's circle-around at bullet size —
draws once round a dot over its first 120px. The rise is §5's 14px bound,
held a little under it. No opacity: §5's "a fade with no rise reads as a
loading glitch" is the converse of this, and a rise with no fade is what the
rule leaves. A bare dashboard section whose children are cards does not rise
itself; its cards do, one each, so two rises never stack into a slide.

The three off-switches (§4) are the gate shape: both stylesheets declare
their animation only inside `@supports (animation-timeline: view())`,
`prefers-reduced-motion: no-preference` and `body:not(.motion-paused)`, so
every exit renders the arrived block and the whole ring by construction.
Under `forced-colors` a ring is CanvasText. There is no observer, no state
and no clock in either.

The dashboards (/blog, /blog/area/:slug, /blog/log, /projects and
/projects/:slug) take the circle as a system, all of it still except where
it says it draws: round area marks (`AreaGlyph`, the same hue and pattern as
the square glyph it replaced), a ring bullet before every card, aside and
day title, the timeline's nodes as rings that draw round their icon, the
current rail item circled (drawn whole: it is chrome, not an arrival), the
topic shares as a ring rather than a strip, and a short still strand of the
aurora (`motion/HeadStrand.tsx`, the ribbon's own strands and colours)
under each page title, ending in a ring. The timeline's rail is a faded
aurora thread. The page titles were already the display face.

**#193: one gallery for both pages.** The wall, its sizes, `assemble`, the
re-hang and the three off-switches moved out of `projects/` into
`gallery/Wall.tsx` + `Wall.module.css`, and `/blog` hangs the notes on it
in their dark cards (`notes/NoteTile.tsx`) instead of the two-column grid and
its `.scrub-rise` (retired: it had no other caller). What is in a cell is the
page's; the motion is the wall's, on a `.piece` wrapper, so neither a project
tile nor a note card animates anything of its own. The wall now shares its row
with a side rail, so its columns follow the wall's own width
(`@container`), not the window's. Both pages filter from the same rail
(`gallery/Rail.tsx`) and the same control (`gallery/FilterControl.tsx`):
popover multi-selects, the choices as removable tokens, "Clear all". None of
it moves: a popover and the phone's sheet appear and go without a transition,
so the only motion a filter causes is the wall's re-hang, already exempt
below and already cut by reduced motion and Pause.

**The owner's brief still holds:** the catalogue "shouldn't be like the
landing page, it's not the same purpose". The run is branding: a curated few,
one at a time, the page's peak. The catalogue is the full set, 6 today and 40
later, and a reader there is scanning and choosing, not being shown. What #175
changed is how that scanning is done. The register let a reader scan by eye
down a column. The wall leads with the picture, which is the strongest thing
most projects have, and moves the scanning into filters. State, year and stack
are always on screen and kept in the URL (`?state=&year=&stack=`; since #193
each takes several values, `?stack=Go&stack=Rust`). Each option counts what it
would show given the other two filters, so a zero is visible before it is
pressed.

**What makes `assemble` its own family and not `pin`, `pan` or `flow` again.**
Four tests, and it has to keep passing all of them:

- **Nothing is held.** No sticky, no runway, no stage. The page is exactly as
  tall as the wall: 4,748px for 26 projects at 1440×900 and 6,490px
  on a 390×844 phone. The options' uniform board measured about 12,400px on
  the phone, and the phone now gets one short row per project with an
  occasional full-bleed lead. A held device charges scroll per item, so it is
  only affordable for a curated few.
- **Lateral travel, but no path.** The run carries a card along a curve
  through a held frame. Here each tile makes one short move into its own cell
  and stops, and the direction comes from where the cell is. Which third of
  the wall a cell is in can't be known from CSS once `grid-auto-flow: dense`
  has packed it, so `Gallery.tsx` reads it from layout and writes it as
  `data-from`. It does this once on mount, again on a `ResizeObserver` or a
  change of contents, and never per frame. In one column every cell is in the
  middle, so there the sides alternate. The sides are physical, so RTL
  mirrors for free: a tile hung on the left comes from the left.
- **Per-tile clock, not per-act.** Each `<li>` names its own `view-timeline`
  and the `<article>` inside it reads it, `entry 0%` to `cover 32%`. A tile's
  size (`lead` 2×2, `wide` 2×1, `tile` 1×1) comes from its data in
  `catalogue.ts`. A featured project from the newest two years is hung large;
  active recent work, or older featured work, is hung wide. Size is never
  taken from position, and no count appears in either file.
- **Not `flow` or `reveal`.** Both are scrubbed. The same offset reached
  scrolling down and scrolling up paints byte-identical pixels below the bar:
  24 of 24 offsets, across EN and HE, 6 and 26 projects, laptop and phone
  (`web/scripts/shoot-projects-gallery.mjs`, frames in `docs/projects-gallery/`).

**One time-based thing, and why it is allowed.** A filter re-hangs the wall.
That is direct manipulation, so the filter links ask the router for a view
transition. Each tile carries its own `view-transition-name` and glides to its
new cell in `--dur-fast`, and tiles leaving or arriving cross-fade. It answers
a press; it is never driven by scroll.

**It is not a peak, and it is not `spotlight`.** Every tile does the same
thing at the same height, and by a third of the way up the window the wall is
flat and still. Type is never faded: the travelling tile's shade is an
overlay, not opacity on the words.

**The off-switches land on the plain wall.** Reduced motion, Pause and no
`animation-timeline` each cancel the piece and its shade outright (no
`animation-play-state`, which would freeze every piece below the fold half-way
in). Reduced motion and Pause also cut the re-hang to an instant swap. A piece
that takes focus cancels its own arrival and asks for
`scroll-margin-block-end: 30svh`. `gallery/__tests__/Gallery.test.tsx` holds
all of it on the stylesheet text, and holds that the pieces' own stylesheets
(`notes/NoteTile.module.css`) and the rail's
and filter's carry no keyframes at all.

**No dark ground on either page (#193).** The panel was the one dark thing on
/projects and it is gone, so nothing there carries `data-chrome="dark"` and
the nav keeps its paper material the whole way down. The notes' cards are
dark, but as cards on paper, not a ground: no `data-chrome`, no inversion.
The argument, and what would void it, is in `ground/DarkAct.tsx`.

**What it costs, measured (2026-11-02).** 4× CPU throttle, 1440×900, the whole
document wheel-scrolled with real input events, rAF frames over wall clock,
five interleaved passes per arm after a warm-up
(`web/scripts/measure-projects-fps.mjs`), against the register it replaced on
the same harness:

| arm | 6 projects | 26 projects (20 mocked) |
|---|---|---|
| `main`, the register (`riffle`) | 38.4 fps (35.1–43.9) | 46.9 fps (39.8–47.2) |
| the wall (`assemble`, bars drawing) | 41.7 fps (41.0–45.4) | 59.5 fps (47.0–60.1) |
| the wall, reduced motion | 46.5 fps (42.7–51.6) | 59.0 fps (40.6–60.6) |

Medians, with the range over five passes. The wall is no slower than the register at either count, and faster at 26. Absolute numbers are SwiftShader under this harness and comparable only
within the table. Per frame the wall writes `transform` on the tiles in the
lower third and `opacity` on their shade layers. That is compositor work, not
layout.

### `line`: /story and "How I work" (#176, #178, #191)

One primitive, `motion/LivingLine.tsx`, used twice; there is no second
line. It is one ribbon behind its container, drawn by scroll with its tip
on the middle of the window, and reversed exactly on the way up.

**Built from moves, declared in data (#191).** Each box the line visits
carries its moves as JSON on `data-line`, and the moves are written in data
beside the content they belong to (`STORY_LINE` in `data/story.ts`,
`approachLine` in `data/site.ts`; a beat, section or principle may carry its
own `line`). The composer (`lineMoves.ts`) runs the boxes in document order
and each move draws from the pen's current point:

| move | what it draws |
|---|---|
| `origin` | starts the line at the box's centre (or top); `dot` marks it |
| `line-to` | straight down a lane (`start`, `end`, `centre`, `here`) to the box's foot, or to `until`'s foot; turns into the lane first if it is elsewhere |
| `round` | a turn to a lane in circular arcs, in the gap above the box |
| `circle-around` | once round the box: in down the circle's vertical tangent, round, out down the same tangent; `pad`, `side`, and a `data-line-hold` box spent on the tangent |

More are added with `defineMove(name, impl)`, and an unknown name runs down
the start lane, so content written before its move exists (the admin panel,
#163) still draws a line that keeps out of the text. Any number of boxes
composes: the unit test runs 1, 2, 12 and 40.

**Rounder and freer: no corner anywhere.** The invariant that makes it so is
that every move starts and ends heading straight down, and inside a move
every change of direction is a circular arc tangent to what is either side.
A turn between lanes is the largest circle the gap allows: two quarter
circles of half the gap with a straight between them when the lanes are
further apart than the gap is tall, otherwise one S of two arcs and no
straight at all. The owner's "two hard cuts (right then down)" was the
old cubic swing, whose corners tightened to nothing across a wide page.
`lineMoves.test.ts` holds the three rules for any boxes and moves: the path
is continuous, its tangent is continuous (no angle between consecutive
segments), and no point of it comes within the ribbon's half-width of a
text box. It also holds the right-to-left mirror point for point.

**Never across text, measured in the browser too.** The lanes are the
container's own inline padding, which holds nothing, and every turn happens
in the margin between two boxes. `web/scripts/shoot-line.mjs` samples every
4px of every strand on both pages, both directions, both windows, against
every text box in the section (and on the home page the work section's,
which the line runs out of), and fails the run on a crossing. None.

**The tip is held on the window's middle.** Length is not height — a turn
is longer than the drop it makes and a loop is a circumference spent on one
diameter — so a linear `stroke-dashoffset` drifts hundreds of pixels by the
second loop. Every move hands its pieces over with a span of height (a
turn owns its own drop; a loop's way in and its circle share the circle's
height) and the length drawn is sampled at 101 evenly spaced heights; one
keyframe with a stop at every percentage reads each value from a custom
property the component writes on the SVG. A keyframe selector cannot be a
variable; a keyframe *value* can, and that is the only way a measured
number reaches a keyframe without writing a stylesheet at runtime. No
React state, no listener, nothing per frame.

**The aurora's look (#191, #192).** The line is dressed by the same pieces
as the run's aurora (`motion/Strands.tsx`, `ribbon.ts`): five fine strands
braided about the path, each at its own offset and drifting on its own
phase, gathered to a point at each end, in the aurora's teal, green, blue
and violet repeating every 1100px down the page.
Every strand has the same points at the same distances, so the dash reaches
the same place on each and the ribbon draws as one. The ribbon's half-width
comes from the lane (up to 9px), and the composer keeps that half-width
clear of every box. There is no glow under it: a wide faint stroke under
the strands cost a tenth of the frame rate at 4× throttle (50.3 → 45.5fps
on "How I work"), and a blur would cost more, re-rasterised every frame as
the dash moves. Sampling every 8px instead of 5 and five strands instead of
six were the rest of the trim.

**Where it starts.** /story: a dot in the middle of the page before the first
beat (`origin` with `dot`, on an empty seed box), and the line sweeps from
it to the first beat's lane. Home (since 2026-11-03, v3): off the page's
left edge, above the head of "How I work". A full-bleed marker in the
section's top padding (`data-line-origin="approach-enter"`) carries the
`enter` move; `LivingLine`'s `from` names it, so the line starts outside
its own container, and the drawing grows out to the edge as it grows up
(the aurora strand, above). Before #276 it started behind the work run's
dark stage, at its centre (`data-line-origin="work-run"`), and the
paragraph that follows describes that. It runs straight
down out of the work section (`until: "section"`, so it never turns across
"All projects"), turns into the head's lane, and carries on. The drawing
and its view timeline grow upward to reach the start — the timeline is on
the SVG, not the container, for exactly that — and paint order puts it
behind the cards: the wall is `z-index: 1`, over the dark act's ground and
seams, and the work section `z-index: 2`, over the line.

**/story.** Pictures alternate sides beat by beat; the line runs down the
lane on the picture's side, so it turns across the page in each gap.
Each beat's words take one of three layouts, a data field
(`LAYOUTS` in `data/story.ts`): `beside` (default), `under` (a caption) and
`overlap` (a paper card over the picture's inner lower corner). Three
interludes — after the third beat, the sixth and the eighth, so they come
closer together towards now — are loops drawn round a few words in the
middle of the page. The words are HTML, written by the pen; both languages
are in the DOM with their own `lang`, and the stylesheet shows one.

**"How I work".** Out of the run, beside the head, lane to lane through the
short sections (counted back from the last so the line reaches the first
figure from outside the rail), and once round each principle's figure. The
figures keep their own strokes and their own clock.

**Off-switches.** The resting declaration is the drawn line, and all three
switches and print cancel the animation on every strand and
restate `stroke-dashoffset: 0` (`LivingLine.module.css`). Measured: reduced
motion and Pause both report `drawn=1` at the depth where motion-on is
mid-loop. Under them the run is a plain list, and its start marker moves to
the foot of the still ribbon down the list, so the line continues it. Shots
in `docs/line/`: each page's start, a section-to-section turn, loops half
drawn, the same turn reached again scrolling up, EN and HE, 1440×900 and
390×844.

**Frame cost**, 4× CPU throttle, wheel-scrolled through the section with
real input (`web/scripts/measure-line-fps.mjs`, interleaved arms, a
discarded warm-up, against a build of `main`), medians:

| | `main` | with the ribbon |
|---|---|---|
| "How I work", 1440×900, 7 rounds | 47.1fps | 50.7fps |
| /story timeline, 1440×900, 5 rounds | 59.7fps | 60.0fps |
| the work run, 1440×900, 5 rounds (`measure-work-fps.mjs`) | 42.5fps | 41.5fps |

Five thin strokes repaint per frame where one did; nothing is laid out on
scroll, and the run's sweep is two compositor transforms.

### /story's pictures: laid out of the line's lane (#195)

The owner (2026-11-02): the pictures on /story, and the empty cards that hold
their place, "appear with no animation". They had one — a clip closing the
plate's lower 35% across its own `entry` — and it was invisible for a reason
worth keeping: **the part a foot clip hides is the part still below the fold
while the element enters.** The motion ran, measurably, where no one could
see it. Any arrival clipped from the foot over `entry` has this fault.

Three candidates were tried against the beats and the line:

| candidate | what it does | verdict |
|---|---|---|
| **lane wipe** | the plate opens sideways from its outer edge — the edge on the line's lane, since the line runs down the picture's side — to its inner edge, and is whole when its top reaches the window's middle, where the line's tip is held | **chosen** |
| develop | the card's skeleton ground resolves into the image (`filter` from flat and grey, or opacity over the ground) | rejected: an empty card *is* the skeleton ground, so a placeholder has nothing to develop into and the two would not share one treatment; a reader parked mid-way sees a washed-out photograph; `filter` repaints the image every frame |
| follow the tip | the clip's lower edge sits on the window's middle, so the picture is uncovered exactly as far as the line has drawn | rejected: at rest the lower half of every window holds half a picture, which reads as broken, not as arriving — the line already carries "how far you've read", and a second gauge says it twice |

**Why the lane wipe.** It is the line's gesture, made by the picture: the
line runs down the picture's side, and the picture is laid out from that side
just before the line gets there, so the two read as one act — not a second
device beside the line. A sideways edge is on screen for the whole of its
travel, which is the fix. It uses one hard `clip-path` edge with the card's
own round corners, the 1-bit edge the project pages' ink wipe argues for, so
the site has one idea of how a thing is laid on the paper. And nothing inside
the plate moves, so a photograph and an empty card — the same box, the same
`ratio` — take the identical arrival; a reader stopped half-way sees part of a
true picture.

**The numbers.** `animation-range: cover 5vh cover 50vh`: lengths from the
plate's cover start, so it takes 45% of the window's scroll on a laptop or a
phone whatever the plate's height, and it ends with the plate's top on the
window's middle — the line's tip. It starts from a strip an eighth of the
plate wide on the lane side, so the card's place is marked as it comes up; one
keyframe curve (`cubic-bezier(0.3, 0.3, 0.4, 1)`, about three quarters open
half-way) settles it onto the inner edge as the line arrives. Scroll is the
only input, so it reverses exactly.

**RTL.** `inset()` has no logical form, so the side is two custom
properties into one keyframe: a start-side plate closes its right inset in
English and its left in Hebrew; an end-side plate the reverse. Measured in
the shots' log (`pictures-he-*`: `inset(0 0 0 76.7%)` where English reads
`inset(0 76.7% 0 0)`).

**Off-switches.** Unchanged and still correct: all three and print cancel
the animation, and the base rule has no clip, so the plate is whole. Measured:
reduced motion and Pause both report `clip-path: none` at mid-arrival depth.

**The line still never crosses text.** The clip changes no box;
`shoot-line.mjs` re-run on the branch, both pages, both directions, both
windows: 76 frames, no crossing.

**Frame cost**, 4x CPU throttle, `measure-line-fps.mjs` through the /story
timeline, interleaved against a build of `main`, 5 rounds, medians: 1440×900
60.1 → 60.1fps; 390×844 60.1 → 60.1fps. The animated property and the
element are the ones `main` already animated; only the inset that moves
changed.

Shots in `docs/story-pictures/` (`scripts/shoot-story-pictures.mjs`): a
beat's plate at the start, middle and end of its arrival, the middle again
with a real picture in the card, and scrolled back to the start; EN and HE,
1440×900 and 390×844; reduced motion and Pause on the laptop.

---

## 3. The peak rule

**One engineered peak per page.** It gets the asset budget, the silence before
it, and the most scroll room. Everything else is support.

A page with three peaks has none. The old plan had a smoke hero, colour splats
and a card pile all competing at maximum effort, and the measurable result was
that nothing on the page read as the most important thing on it. The current
peak is the run (beat 2) — *the work arrives along one line, and the reader's
scroll is what moves it* — and it is the only place the page spends `pin` and the only section
allowed to cost a frame budget.

It is no longer the only dark act. It was, and the ground was part of what
made it the peak; it is now one of two, with the year, on the subject rule in
`index.css` rather than on importance. That does not move the peak, because
the ground was never what the peak rule was about: the run still pins, still
takes the most scroll room, still carries the only asset budget, and the year
— which since #111 does hold its frame — holds it for half the distance the
run does (about 150svh against 220svh), measured in §2. What the pair costs it is
the ground as a *signal* of the peak, and §2's ledger row for `drift` is where
that trade is recorded.

**One amendment, on the owner's direction (2026-11-03).** The hero is now
held still (`position: sticky`) for one screen while the dark act after it
slides up over it — the owner wanted the figure to stay until it is covered,
not dismantled on the way out. It is a hold, not a `pin` in the run's sense:
it adds no scroll distance (the holder's spacer is pulled back by the same
screen, so the document is the height it was), nothing is scrubbed *through*
it except the corners' breath, and the act
covering it is the one doing the moving. The run is still the only section
that holds the reader for scroll it adds to the page.

The practical consequence is that good ideas get cut for being in the wrong
place rather than for being bad. The close was to have its form fold once and
fly off the top of the window on send; the instinct was right — the close should
be the most satisfying moment — and it was aimed at a page whose peak is two
sections earlier. What survived the cut was the *restraint* that came with it,
which turned out to matter more than the animation:

> **The confirmation lands before or with any exit motion, never after it.** A
> card that leaves and then says it worked looks like it ate the message.

That rule outlives the animation it was written for, and it generalises: any
acknowledgement of something the reader did belongs in the DOM, and announced,
before the first frame that moves on account of it.

---

## 4. The three off-switches

They are **three independent conditions, not one**, and each needs its own exit:

1. **`prefers-reduced-motion: reduce`** — a standing OS preference about every
   site.
2. **The Pause toggle** — `web/src/components/nav/usePauseSwitch.ts`, which
   hangs `body.motion-paused` outside the React tree precisely so that view
   timelines, ambient layers and plate cross-fades stop too, none of which the
   nav renders or can reach.
3. **Absent `animation-timeline` support** — a browser that cannot run the
   animation at all. This is not a reader who asked for less motion, and
   treating it as one is how a page ends up hiding content from a machine that
   simply has an older engine.

The shape every motion component uses:

```css
@supports not (animation-timeline: view()) {
  .thing { animation: none; /* ...and the arrived state, explicitly */ }
}

@media (prefers-reduced-motion: reduce) {
  .thing { animation: none; /* ...and the arrived state, explicitly */ }
}

:global(body.motion-paused) .thing {
  animation: none;          /* ...and the arrived state, explicitly */
}
```

**Every exit lands on the finished state**, never on the first frame. This is
the trap underneath all three:

- `animation-duration: 0.01ms !important` — what `index.css` and
  `nav/motion-paused.css` apply globally — works by running a *time-driven*
  animation to completion instantly. That is the right trick, and it is
  **undefined for a progress-driven animation**: a view timeline ignores the
  duration, so the global override leaves the stroke still tied to the scroll
  position. Scroll-driven components must cancel the animation outright and
  restate the arrived state themselves. `InkRule.module.css` makes this
  argument.
- `animation-play-state: paused` is the obvious-looking alternative and is
  wrong for the same reason in reverse: it freezes each animation at the time it
  has reached, which for anything that has not started yet is frame zero — and
  with `fill-mode: both` that is the hidden state. "Pause motion" would blank
  every element that enters by animation.
- Pause can be **toggled mid-scroll, while a sticky act is pinned**. Because
  every exit lands on the arrived state, a half-arrived element snaps to
  arrived. It must never snap to hidden.
- A component with no scroll timeline in it needs **no `@supports` block** —
  there is no feature for a browser to be missing. Since #162 that is only
  the exemptions in §8 (the entry shutter, the form's ink). Adding one there
  is cargo cult.
- **The gate shape, and why #162 prefers it.** Where a component's resting
  state *is* its finished state, the animation can be declared only inside
  one positive gate — `@supports (animation-timeline: view())`, then
  `@media (prefers-reduced-motion: no-preference)`, then
  `body:not(.motion-paused)` — and nothing at all outside it. All three
  switches then render the finished state by construction, with no exit
  block to keep in step. The hero's corners, the living line's lead, the
  spec count, the drift, the skeleton sweep and the two `scrub-*` utilities
  are written that way. The `@supports` half is not decoration: without it
  an engine that drops `animation-timeline` reads `animation: x linear
  both` as a zero-length clock animation and `fill: both` holds the *last*
  frame — which, for the hero's old exit (removed 2026-11-03), was the
  dismantled screen.
- **Not every animation is motion, and the one exception is a timer.** The
  skeletons' gate (`gallery/Skeleton.module.css`) is a 1ms animation whose
  only job is its 180ms *delay*: it holds a placeholder's ink off the screen
  for long enough that a response which was never slow leaves no trace of
  having been loaded. The global `animation-duration: 0.01ms !important` both
  standing conditions carry overrides the duration and leaves the delay
  alone, so the gate keeps working under both without a line being written —
  which is right, because a reader who asked for less motion has not asked to
  be shown more flicker. **Do not cancel it in an off-switch block.** The
  sweep that crosses the placeholder *is* motion and is cancelled in both,
  landing on a flat capsule; the two live on different elements precisely so
  one can be switched off without taking the other with it.

There used to be a fourth exit in TypeScript — `useStagedArrival`'s
per-stage deadline for an `animationend` that never fired. It went with the
staged arrival in #162; a scroll-driven animation has no event to wait for.

Two further exits exist for specific effects rather than for motion in general:
`forced-colors: active` turns a `Ring` and the timeline's aurora thread to
CanvasText, because in a forced palette a brand hue would be painted in a
system colour it was never chosen for (until #251 it also removed `InkWipe`'s
coloured band); and an
`IntersectionObserver` that never fires has to land on the finished page too,
which is why `Written` animates when no observer has told it where it is.

---

### The one kinetic headline

`kinetic` headlines were banned here, on the grammar's own argument that a
gallery label is read rather than performed. Beat 0 is now one, on the owner's
direction, and the ban is lifted for that beat alone — the first screen is the
page naming itself and is the one place a performance is the point. Everywhere
else the argument still holds: a project label that assembles itself is a label
competing with the object it names.

## 5. What a premium reveal is made of

Measured, and the numbers are the point rather than a starting place. Since
#162 they are scrubbed rather than timed: the canonical implementation is the
`.scrub-rise` utility in `index.css` (14px and opacity across the element's
`entry`). `Rise`, the clock version these numbers were measured on, was
deleted in #162; the duration, stagger, trigger and "once" rows below are
its history, kept because the bounds they argue for still bound a scrub.

| | |
|---|---|
| Opacity | 0 → 1 |
| Rise | **14px**, `translateY` only |
| Duration | **~620ms**, ease-out (`--ease-settle`) |
| Stagger | **30–80ms** between children, in reading order (60ms in `Rise`) |
| Trigger | **~12% inside the viewport** (`rootMargin: 0 0 -12% 0`) |
| Repeats | **Once.** Fires and stays fired |

Each bound is a bound because of what happens outside it:

- **A fade with no rise reads as a loading glitch.** Opacity alone is the one
  thing a slow network also does.
- **A rise past about 24px reads as a slide** — a statement about the layout
  rather than about the content.
- **Under 30ms of stagger** the children read as one block moving; **over about
  80ms** the last one arrives after the reader has started reading the first.
  `Rise` caps the cumulative delay at 300ms, because past that a list has a
  queue rather than a reveal. **A split word is not a list.** The title plate's
  name cascades 14 letters at 38ms for 754ms cumulative, and reads as one
  object arriving rather than fourteen, because the eye groups glyphs into a
  word long before it groups cards into a column. The cap is about items a
  reader counts.
- **Firing at the fold** means the reveal has already finished somewhere below
  the reader's eyeline. 12% inside means they watch it.
- **Horizontal travel is banned on anything full-width, and allowed only
  inside a clip.** The title plate's last stage moves two lines 18px sideways
  with `overflow-x: clip` on the hero as the guard. That guard is the whole
  licence: without it this is the bug below.
- The original ban, and why it exists. The deleted `Reveal` component pushed
  full-width sections 26px past the right edge of the document until they fired,
  so the page reported horizontal overflow for as long as the reader had not
  scrolled that far — with `overflow-x: clip` on the body hiding the scrollbar
  and not the bug.

Slower, larger or bouncier is never more premium. The restraint is the signal,
and there is nothing here to tune.

**"Once" is retired (#162).** The argument here was that content must not
re-hide itself when the reader looks away, so a reveal had to fire once on an
observer. The owner overruled it for the whole site: "reverse when scrolling
up, all controllable with simple scrolling. no more." Every arrival is now a
view timeline with no observer and no state, and runs backwards on the way
up; `scrollOnly.test.ts` fails on a new one-shot reveal.

---

## 6. Two findings worth keeping from cut work

Both effects were cut — the first by the peak rule, the second with the hero
world it belonged to — and both findings cost enough to be worth not
rediscovering.

**A canvas feedback buffer reads as smoke only when nothing in it reads the
pointer except the stamp.** The instinct is to advect the field along pointer
velocity, which *drags* the smoke sideways instead of leaving it behind; what
reads as smoke is a stationary field that the pointer only ever stamps into,
with diffusion and decay doing the rest.

**SVG droplet sub-paths must wind the same way as the body.** The nonzero fill
rule punches a hole wherever two sub-paths of opposite winding overlap, so a
droplet whose highlight or tail was drawn counter-clockwise against a clockwise
body appeared to have a bite taken out of it exactly at the overlap. Same
direction, or set `fill-rule: evenodd` deliberately and know what it costs.

---

## 7. Where the code is

| file | device | timeline |
|---|---|---|
| `nav/useTuckedBar.ts` + `Nav.module.css` (tuck) | the bar lifts and fades on the way down, returns on the way up or on focus; no travel with motion off | scroll direction, no per-frame write |
| `Contact.module.css` `.surface` | `surface` — each part of the close rising out of its own baseline | `view()` per part |
| `motion/EntryShutter.tsx` | `shutter` — the page arrives from behind a grid | clock, gated on real readiness: the route's content (Suspense resolved, first heading present), fonts and first-screen images; soft ceiling 6 s for fonts/images only; hard cap 10 s fades the bare sheet with no tiles (`motion/shutterReadiness.ts`) |
| `Hero.module.css` `.holder` | the hero held still (`sticky`) for one screen while the dark act slides up over it; owns `--hero` | named `view-timeline` `--hero` on the static holder (§1: the pinned hero's own would stall) |
| `HeroArrival.module.css` | the plate's arrival, once a visit, when the cover lifts; it no longer comes apart on the way out (2026-11-03) | clock, exempt (§8) |
| `HeroCorners.module.css` | `breath` — the phrases turn and the lamp breathes while the hero is held | `--hero`, `contain` ranges |
| `Stack.module.css` | `count` — each figure counts from nought as the plate comes up, and back down as it goes | named `view-timeline` `--specs` on the plate |
| `index.css` `.scrub-pulse` | every loading placeholder's pulse (`.scrub-rise` retired in #193) | `view()` |
| `Approach.module.css` + `ApproachFigures.tsx` | `draw` — each principle's figure, stroke by stroke | named `view-timeline` per principle |
| `motion/Arrive.tsx` | `arrive` — the one appear primitive (#251): a block rising the last 12px into place; never covers, clips or fades the content | `view()`, `entry 0%`–`entry min(100%, 240px)` |
| `motion/Ring.tsx` | the circle-around at bullet size: a loop round a dot or an icon, drawn by scroll as it arrives, or whole as chrome | named `view-timeline` `--ring` on the ring's box, `cover 0px`–`cover 120px` |
| `motion/HeadStrand.tsx` | a still strand of the aurora under a dashboard title, ending in a ring | — (still) |
| `motion/InkRule.tsx` | a hairline drawing itself in | `view()` |
| `gallery/Wall.module.css` + `Wall.tsx` | `assemble`, unused since #227 (was /projects, and /blog from #193 until #224): each piece slides in from its own side of the wall (or rises, in the middle third), and a filter re-hangs the wall with a short view transition | named `view-timeline` on each static `<li>`, read by the `.piece` inside it; side read from layout once into `data-from` |
| `notes/NoteTile.module.css` | what hangs in a cell: a note card. No motion of their own | — |
| `gallery/FilterControl.tsx` + `Rail.tsx` | the filter card, its popovers and the phone's sheet. The popovers appear and go; the sheet takes the popup system (§8, `styles/popup.css`) | — |
| `projects/ProjectRun.module.css` | `pin` — the work travelling along a curve under a held frame; one lap per card, staggered by range | named `view-timeline` on the static stage, the frame held inside it |
| `motion/AuroraStrand.tsx` | the aurora strand's one appearing, shared by the run and the notes shelf: a soft window in from `from` ("left" \| "right"), the drawing carried back under it; a wave by default | the caller's named timeline and range as custom properties |
| `projects/RunAurora.tsx` + `runCurve.ts` | the run's aurora: a ribbon of seven strands on the cards' own curve, swept in from the reading end as the stage arrives (through `AuroraStrand`, `from="right"`), a window sweeping along it once a card; a still ribbon of strands down the plain list with motion off | the run's `--run` timeline: the sweep on `entry 40%`–`contain 6%`, the surge iterated once per card |
| `LatestNotes.module.css` | `pan`, held — the notes walk past under a held frame, one card-width per step | named `view-timeline` on the static stage (inset 0), the frame held inside it |
| `city/ContributionCity.module.css` | `scrub` — one animation turns and raises 365 columns, a second dollies the camera down the year | named `view-timeline` on a static wrapper, the frame held over it |
| `city/useCityHand.ts` | the year's orbit and its one readout — a drag turns the city, a point reads a day | pointer events; a settle loop only between release and rest |
| `gallery/Skeleton.module.css` | `sweep` — one line of a placeholder, the band across it, and the gate before it | named `view-timeline` per line; the gate is a clock (§8) |
| `gallery/SkeletonLines.tsx` | the primitive: a run of lines as tall as the type they stand in for | — |
| `gallery/LabelSkeleton.tsx` | the object label's three parts, in the label's own stylesheet | — |
| `gallery/SkeletonGate.tsx` | the box that holds a region's height, and the 180ms before it is inked | clock |
| `ground/DarkAct.module.css` | `drift` — two lights crossing at each seam of the dark ground | named `view-timeline` `--seam` per seam |
| `index.css` `.section-head::after` | the shutter, echoed — a lattice leaving each section head outward from its word | named `view-timeline` on the head, inset to the lower third |
| `motion/LivingLine.tsx` + `lineMoves.ts` | `line` — one ribbon behind a page or section, composed from the moves each box declares in data (`enter`, `origin`, `line-to`, `round`, `circle-around`, and a registry for more) and measured off the laid-out boxes, its tip held on the window's middle; an `enter` lead uncovered by a soft window from the page's edge | named `view-timeline` on the drawing (inset 50%), grown upward and outward when the line starts outside its container; a 101-stop keyframe reads offsets the composer writes as custom properties; the lead's window on the drawing's own `view()`, `cover 5vh`–`cover 50vh` |
| `motion/Strands.tsx` + `ribbon.ts` | the aurora's ribbon, shared: fine strands braided about any path, and the one set of aurora colours, for the run's aurora and the living line | — (geometry; the callers own the clock) |
| `motion/Written.tsx` + `penClock.ts` | `pen` — running text written one word after another as it rises through the reading window (68% → 38%), one block at a time in document order | named `view-timeline` on the paragraph, inset from `--read-from`/`--read-to`; word `i` of `n` owns the slice `i/n`–`(i+1)/n` of the block's turn (`--pen-lead`, `--pen-span`, from the sequencer) |
| `nav/usePauseSwitch.ts` | the Pause control | — |
| `nav/motion-paused.css` | what Pause does to the page | — |

### Retired, and why

`HeroRibbon` and `heroRibbon.ts` (the aurora ribbon round the hero's
figure, #268, cut to one layer in front in #272/#275) were deleted on
2026-11-03 on the owner's "remove the aurora from the hero". Its
keyframes (`ribbon-in`, `ribbon-held`) went from the arrival's exempt list
with it. Its frames stay in `docs/hero-aurora-v2/` as the record.

`InkWipe` (a block printed behind a hard clip edge with a saturated band
riding it) was deleted in #251 on the owner's call that it was not on par
with the brand; it hid and painted over the text it was arriving with, and
`Arrive` replaced it under a rule that forbids exactly that (§2, #251).

`IrisPanel` (a panel opening from its centre), `FillSweep` (a heading's fill
sweeping across its glyphs), `WordStagger` (a line arriving word by word) and
`BlurShot` (a photograph resolving out of a blurred stand-in) were deleted
once the page became a gallery. All four had no call site; three were missing
their `body.motion-paused` exit, which the global duration override cannot
cover because they are progress-driven; and the grammar bans kinetic headlines
outright, which is `WordStagger`'s whole purpose.

`ProjectPile` (the sticky pile of cards, beat 2 until #57 and the catalogue's
arrangement until #169) was deleted with its stylesheet and tests once
/projects became the register: nothing rendered it any more. Its per-card
arrival (`pileArrival.ts`) survives, because the run still uses it, and the
pile's notes on sticky timelines are in the history and in §1.

`Rise`, `Arrived` and `Flow` (fire-once reveals on an observer and a
clock), `useStagedArrival` and `hero-chrome.css` (the hero's clock-driven
sequence) and `useEnteredOnce` (the spec plate's starting gun) were deleted
in #162, when every animation moved onto scroll. Three of them had no call
site left; the other three were replaced by view timelines.

An unused component with a hole in its off-switch is a trap for whoever uses it
next, so they went rather than being fixed in place. They are in the history if
a future beat wants one — but it should be rebuilt against §4 rather than
restored, because what was wrong with them is exactly what §4 exists to say.

Since #162 the site has two `IntersectionObserver`s and neither reveals
anything: `Written`'s near-watch (which paragraphs are in the reading zone,
both ways, so words that cannot change stop animating) and `useDarkChrome`
(the bar's material over the dark acts). `DarkAct`'s observer, `Rise`'s and
`useEnteredOnce`'s went with the clocks they gated. `scrollOnly.test.ts`
pins the list.

Plus two scroll-position publishers, which are not devices:
`hooks/useScrollProgress.ts` (the home page's palette and layer progress) and
`components/notes/ReadingBar.tsx` (a post's progress bar).

**No motion component has a scroll listener, and only one has a
`requestAnimationFrame` loop — `useCityHand`, for under a second after the
reader lets go.** It turns the city back to rest on a damped spring, writes
one inline `rotateZ` per frame and no React state, never starts without a
press, and under reduced motion or Pause it does not coast or settle at all:
the city snaps back on release. That is the whole of the exception; it is
answering a hand, not a clock, and measured it costs the act nothing it was
not already paying (29fps dragging against 22–23fps scrolling, 4× throttle).
Otherwise no component does per-frame work. The one hook with a scroll listener is
`useScrollProgress`, mounted on a single route; it is rAF-throttled, writes a
custom property on `<html>` rather than React state, and returns early under
`prefers-reduced-motion`. Everything in the table is a class name a
stylesheet acts on, or a hook or component named in it.

**No motion component holds state since #162.** `useStagedArrival`, which
kept an integer for the hero's stage, went with the clock it sequenced.

**A keyframe name reached through a custom property is invisible to CSS
Modules.** The scoper renames `@keyframes` and rewrites the `animation-name`
declarations it can see, and `var(--flow-item, flow-rise)` is not one of them —
so the keyframes ship renamed while the rules still ask for the original, and
every animation in the file resolves to nothing, silently. Either declare those
keyframes `@keyframes :global(name)` or keep the name in a literal
`animation-name`. `Approach.module.css` took the first route until #157 removed its keyframes from custom properties; `draw` names its one keyframe in the `animation` shorthand, where the scoper sees it.

Keep it that way. The reason this page can afford as much motion as it carries
is that almost none of it costs anything per frame, and the first component that
measures something on scroll is the one that takes that away.

---

## 8. The inventory (#162)

The owner's rule, 2026-11-02: "the titles and all the animations need to be
handled like the way that the github get handled — reverse when scrolling
up, all controllable with simple scrolling. no more." This is every
animation and transition on the site after that sweep, by route, and how it
is driven. **Scrubbed** means a scroll or view timeline: no delay, no
duration, the same frame at the same scroll position on the way down and on
the way up. Every scrubbed row lands on its finished state under all three
off-switches (§4).

`web/src/components/motion/__tests__/scrollOnly.test.ts` holds it: a
`@keyframes` animation with no `animation-timeline` on the same element fails
unless it is in that file's `ALLOWED` list, which mirrors the exempt rows
here; so do a new `IntersectionObserver`, a Web Animations API call, a
Tailwind `animate-*` class outside the Radix menus, or a Tailwind theme
animation.

| element | route | mechanism | status |
|---|---|---|---|
| entry shutter (`EntryShutter`) | every route, first load | clock, gated on readiness (route content + fonts + first-screen images; never tiles over an empty page: if the content has not arrived by 10 s the whole sheet fades in one 200ms opacity transition, no tiles) | **exempt**: the one page-load moment, not a scroll |
| title plate: name letters, fact line, field line, figure coming apart on the way out (`HeroArrival.module.css`) | / | — | **removed** (2026-11-03): the owner's "the hero pictures … disappear … I want them to stay"; the figure was under a `--paper` mask at `scaleY(1)` from `exit 44%` (`docs/hero-aurora/before-*.png`). The hero is held still under the next act instead |
| aurora ribbon drift across the figure (`HeroRibbon`) | — | — | **removed** (2026-11-03, aurora v3): the owner's "remove the aurora from the hero"; it was scrubbed on `--hero` from the day before |
| title plate and corners arriving, once a visit (`HeroArrival.module.css`, `HeroCorners.module.css`) | /, first load only | clock, started by the shutter's `clearing` signal (its last tile's `animationend`) (`motion/entry.ts`), filling `backwards` (the scrubbed exit it was layered on is gone, 2026-11-03); until that signal, a still `*-held` layer pins each moving part on the arrival's `from` frame under the cover (#219), so the lifting tiles show nothing already arrived and it is seen once | **exempt** (#194): part of the page load, as the shutter is; a hero mounted after the entry, or under any off-switch, never holds or plays it |
| nav bar dropping in with the plate (`hero-chrome.css`) | / | — | **removed** (#162): the bar is simply there; its tuck is below |
| lamp breath and ring (`HeroCorners`) | / | `--hero` | **scrubbed** (#162; was a 6.4s infinite loop) |
| rotating phrases (`HeroCorners`, `useCycle`) | / | a 3.2s `setInterval` and a 700ms opacity/transform transition | **exempt** (2026-11-10, the owner: "circle on their own"); see §11 |
| hero corners sinking under paper | / | — | **removed** (2026-11-03), with the plate's exit above |
| section heads' lattice (`.section-head::after`) | /, /projects, /story | `--section-head` view timeline | scrubbed |
| section-head and hairline rules (`InkRule`) | /, /projects/:slug | `view()` | scrubbed |
| running text, word by word (`Written`) | /, /story, /projects/:slug, /blog/:slug | named view timeline per paragraph, one block's turn at a time (+ a two-way near-watch observer for cost) | scrubbed; reading window 68% → 38% (2026-11-03) |
| the aurora strand appearing (`AuroraStrand`): the notes shelf from the left, on the cards' middle line; the living line's lead on "How I work" from the left edge (`LivingLine`, `line-enter`) | / | `--notes-shelf`; the line drawing's `view()` | scrubbed (2026-11-03; v3: the band on "How I work" removed, the line's lead in its place) |
| one line (`LivingLine`) | /, /story | named view timeline | scrubbed |
| approach figures (`approach-draw`) | / | named view timeline per principle | scrubbed |
| the run: cards, lean, arrive, surge, aurora and its sweep in (`ProjectRun`, `RunAurora`) | / | `--run` | scrubbed |
| dark-act seam lights (`DarkAct`) | / | `--seam` per seam | **scrubbed** (#162; were 71s / 97s loops behind an observer) |
| the year: raise and dolly (`ContributionCity`) | / | `--city` | scrubbed; **slowed 1.3×** (#246): the same keyframes over 1.3× the scroll (`--city-pace`) |
| the year's waiting band | / (while loading) | `--city` | **scrubbed** (#162; was a 1.5s loop) |
| the year's drag-to-turn and settle (`useCityHand`) | / | pointer + a settle loop after release | **exempt**: direct manipulation |
| notes shelf pan (`LatestNotes`) | / | named view timeline | scrubbed |
| spec count (`Stack`) | / | `--specs` | **scrubbed** (#162; was a 1.2s clock fired once by `useEnteredOnce`) |
| close: surface, label, full stop (`Contact`) | / | `view()` per part | scrubbed |
| contact dialog: scrim, panel, field ink, send seal | / and the nav's Contact | transitions and clock keyframes | **exempt**: dialog open/close and a reply to Send |
| /story plates arriving (`story-plate`) | /story | `view()`, `cover 5vh cover 50vh` | scrubbed (#195: opened sideways out of the line's lane; was a foot clip that ran below the fold) |
| gallery pieces assembling (`assemble`, `assemble-shade`, `gallery/Wall`) | — | — | **removed** (#227): /projects became a dashboard of repository cards; it was on /blog from #193 until #224 |
| gallery filter re-hang (view transition) | — | — | **removed** (#227) with the wall: a filter now narrows the cards at once |
| filter popovers, the rail's phone sheet (`FilterControl`, `Rail`) | /projects, /blog | none: shown and hidden, no transition | — (#193) |
| notes hung on the gallery wall (`NoteTile` in `Wall`) | /blog | — | **removed** (#224): the index is a dashboard of rows and cards, and nothing on it arrives |
| Blogs dashboard: tree open/close, Home/Feed switch, the phone's rail `<dialog>`, the timeline (`dashboard/`) | /blog, /blog/area/:slug | none: shown and hidden, no transition; hover/focus as the row below; since #251 the cards and timeline nodes arrive (the two rows above) | — (#224) |
| area history: day groups, copy-link tick, share fallback, `j`/`k` focus, topic filter (`dashboard/History.tsx`); a note's heading copy-link (`notes/headingAnchors.tsx`) | /blog/area/:slug, /blog/:slug | none: a two-second icon state, shown and hidden, focus without smooth scroll; hover/focus as the row below | — (#225) |
| Work dashboard: sort switch, repository cards and their activity strips, the releases timeline, the phone's rail `<dialog>` (`work/`, `dashboard/`); since #242 the project page's shell too: its header buttons, pinned rail, About aside, cards and release/doc rows (`pages/Project.module.css`) | /projects, /projects/:slug | none: a re-sort is a navigation that keeps the scroll; the strip is drawn once; hover/focus change colour in `--dur-micro` | — (#227, #242) |
| project tabs: the selected underline, the panels (`work/Tabs.tsx`) | /projects/:slug | none: drawn on the selected tab, panels shown and hidden; colour in `--dur-micro` | — (#227) |
| channel log: days of rows, the kind and area filters, "Load more", the phone's rail `<dialog>` (`pages/BlogLog`) | /blog/log | none: rows appended and filters applied without a transition; hover/focus as the row below; skeletons as the sweep row | — (#226) |
| stats panel bars (`draw-bar`) | /projects | — | **removed** (#193): the panel was deleted |
| ink wipe on the cover and band (`InkWipe`) | — | — | **removed** (#251): it hid and painted over the text it arrived with |
| arrivals: a block rising 12px into place (`Arrive`) | /projects/:slug (the Overview's cards), /blog, /blog/area/:slug (cards, days), /projects (repository cards) | `view()` | **scrubbed** (#251) |
| rings drawn round a dot or an icon (`Ring`) | the same routes: card, aside and day titles, timeline nodes, decision ordinals | named `view-timeline` per ring | **scrubbed** (#251) |
| notes index cards rising (`.scrub-rise`) | /blog | — | **removed** (#193): the notes hang on the gallery wall and arrive by `assemble` (row above) |
| loading placeholders' pulse (`.scrub-pulse`) | /blog/:slug, note covers, project shots, the admin "Saving" dot | `view()`, `cover` | **scrubbed** (#162; was Tailwind `animate-pulse-soft`, 2.4s infinite) |
| skeleton sweep (`Skeleton`) | /, /projects, /projects/:slug, /blog | `--sk-line` per line | **scrubbed** (#162; was a 1.5s loop) |
| skeleton gate (`sk-gate`) | wherever a skeleton shows | 1ms step after a 180ms delay | **exempt**: not motion — a visibility threshold (§4) |
| reading bar (`ReadingBar`) | /blog/:slug | scroll position, rAF-throttled | scrubbed (a readout, not an animation) |
| reader mode: the outline's current heading, the sticky aside, the phone's contents sheet, the picture view's zoom and pan, link previews, the reading tools (`notes/reader/`) | /blog/:slug | the outline reads scroll position, rAF-throttled (a readout, like the bar above; no IntersectionObserver); the sheet and the picture view are native `<dialog>`s shown and hidden; zoom and pan move only under the reader's hand; previews and tools are shown and hidden, colour in `--dur-micro` | — (#249): nothing of its own. The pen is untouched: the aside holds no prose, and a change of text size or measure is a layout change the pen's own root ResizeObserver re-measures |
| tucking nav bar (`useTuckedBar`) | every route | scroll direction → a short transition | **exempt**: the tucking bar |
| bar material over the dark acts (`useDarkChrome`) | / | two-way observer → colour transition | **exempt**: part of the nav chrome; follows position both ways |
| mobile menu sheet and scrim, menu bars | every route | transitions | **exempt**: menu open |
| the display panel (language, theme, text size, contrast, motion switch: `nav/DisplayMenu`), tooltips (Radix, `.pop`) | every route | `pop-in` / `pop-out` keyframes keyed on `data-state` (`styles/popup.css`): opacity + 6px translate + scale .96 from the side it hangs on, 180ms in on `--ease-settle`, 140ms out | **exempt** (2026-11-10): menu open, hover/focus. Replaces the three separate menus and tailwindcss-animate |
| every modal `<dialog>` except Contact's own: the phone sheets (`Rail`, `BlogPost`), the dashboards' rail sheet, the picture view, the admin `Modal` (media, picker, publish review) (`dialog.pop-dialog`) | /projects, /blog, /blog/:slug, admin | a transition, not a keyframe: `@starting-style` plus `transition-behavior: allow-discrete` on `display` and `overlay`; opacity + translate/scale (bottom sheet rises 40px, side sheet 32px from its own edge and mirrored in RTL, modal 14px / .97), the backdrop fades on its own | **exempt** (2026-11-10): dialog open/close. This supersedes the "shown and hidden, no transition" in the rows above for the dialogs; popovers inside the filter card are unchanged |
| toasts (`ui/sonner`, `.pop-toast`) | /blog/:slug | sonner's own enter/exit, on the popup system's timing and surface | **exempt** (2026-11-10): a reply to a press |
| theme wave: the new theme revealed by a `clip-path` circle from the toggle (`nav/themeWave.ts`, `nav/theme-wave.css`, `theme-wave`) | every route | a view transition, 600ms on `--ease-settle`; old snapshot held still, default cross-fade off | **exempt** (#266): a reply to choosing a theme. Instant, with no transition at all, under every off-switch (§4: no `startViewTransition`, reduced motion, Pause), when the choice does not change the ground, and when System follows the OS |
| the hero's particle word (`hero/ParticleWord`) | /, desktop only | one `requestAnimationFrame` loop that runs only while the entrance, a pointer on the word or settling particles move, and stops at rest | **exempt** (2026-11-10): the page-load entrance and direct manipulation; see "The hero's particle word and the page's colour orbs" below |
| the page's colour orbs (`ground/AmbientOrbs`) | every route | one `opacity` transition, 0 to 1 in 1.2s, once; then static | **exempt** (2026-11-10): the page load; static under reduced motion and Pause |
| card tilt, note cards growing, pills, buttons, links, chips, glyph nudges, form controls | every route, admin login | `:hover` / `:focus` / `:active` transitions | **exempt**: hover/focus |
| in-page anchor smooth scroll (`scrollToAnchor`) | every route | per click | **exempt**: a reply to a click |
| admin login | /admin/posts | form-control focus transitions only | **exempt**: focus |
| 404, /accessibility | — | nothing of their own beyond the shared chrome above | — |

Counted from the table above, row by row: 56 rows; 20 scrubbed, 18 exempt,
10 removed, 8 with nothing of their own. Re-count after adding a row.

The dashboards' still brand marks (round area marks, the circled rail item,
the topic ring, the header strand) are not motion and have no row. `Rise`,
`Arrived` and `Flow` were on no route and were deleted.

---

## 9. The popup system (2026-11-10)

One stylesheet, `web/src/styles/popup.css`, governs everything that appears over
the page. Three tiers, each one step heavier than the last in shadow
(`--pop-shadow-1`, `--pop-shadow-2`) and in how far it travels to arrive:

| tier | class | what | holds focus |
|---|---|---|---|
| tooltip | `.pop` `.pop-tip` | a word of help, stamped in ink | no |
| panel | `.pop` `.pop-panel` | a popover opened from a button (`ui/popover`, the display panel) | yes, returns to the trigger |
| dialog | `dialog.pop-dialog` (+ `--bottom`, `--side`, `--viewer`) | a modal with a scrim | yes, native trap |

Inside a panel or dialog: `.pop-head` (title row, the one place set in the
display face), `.pop-body`, `.pop-foot` (the actions, primary on the
inline-end edge, set off by a rule and a faint wash). Toasts (`.pop-toast`)
take the panel's surface.

Rules that cost a debugging session to learn:

- **Radix panels and tooltips need a keyframe for the exit.** Radix keeps a node
  mounted only while an `animation` runs on it; a `transition` unmounts it at
  once, so the exit would be instant. Hence `pop-in` / `pop-out`, which are on
  `scrollOnly.test.ts`'s `ALLOWED` list. Tailwind's `animate-*` classes are
  now banned outright by that test.
- **Native dialogs use transitions, never keyframes**: `@starting-style` for
  the arrival, `allow-discrete` on `display` and `overlay` so the dialog
  stays in the top layer until the exit has played, and a separate rule for
  `::backdrop`.
- **Origin-aware**: panels read `--radix-popper-transform-origin`; the side
  sheet's offset is mirrored with `:dir(rtl)`.
- **Off** under `prefers-reduced-motion` and `body.motion-paused`: animation
  and transition are `none`, so a popup is shown and hidden instantly.
- Contact's dialog predates the system and keeps its own staged recipe.


## 10. The hero's particle word and the page's colour orbs (2026-11-10)

The owner asked for three things: colours fading in on the background "like
WindoM's main bg"; the word beside the portrait made of interactive
particles that flee the cursor. (A third, objects flying in from the sides to
circle the hero, was built and then deleted at the owner's word the same day:
there is no orbit constellation any more.) Each is inside this contract on
purpose, and this section is where the reasons are.

**The one loop, and why it is not an ambient loop.** `hero/ParticleWord.tsx`
owns a single `requestAnimationFrame` loop. It is armed by exactly three
things: the entrance (about 1.8s, once per visit, started by the same entry
signal as the plate's arrival), a pointer moving over the word (direct
manipulation, like `useCityHand`), and particles still travelling back
afterwards. `particlePhysics.step` reports rest and the loop does not re-arm;
the next pointer event or resize starts it. A word nobody touches costs no
frames. It is therefore not the "second ambient loop" §2 forbids beside the
lamp: nothing in it runs while the reader does nothing. There is no
`IntersectionObserver` (`scrollOnly.test.ts` lists the only two): the loop
needs input to run, and the pointer's event target must be inside `#hero`, so
a hero covered by the dark act, or scrolled away, cannot be pushed. A hidden
tab pauses it (`visibilitychange`; rAF stops anyway).

**Physics that can stop.** A damped spring to the rest point (K = 90, zeta =
0.62) and a smooth radial push from the pointer, integrated at a fixed 1/120s
step so it is the same at 60 and 144Hz. A tangential "swirl" was tried and
removed: it is not the gradient of any potential, so it pumps energy and left
particles circling a still pointer for ever, which a loop that must stop at
rest cannot allow. Central force plus damping always settles
(`particlePhysics.test.ts` pins both facts).

**Off-switches, and what each renders.** `hero/useParticleGate` is the one
gate for the word, and each input is watched live:

| condition | renders |
|---|---|
| viewport under 1100px, `(pointer: coarse)` or no `(hover: hover)` | the static h1 exactly as before ("UN-mobile": desktop only) |
| `prefers-reduced-motion: reduce` | the static h1 |
| the Pause toggle (`body.motion-paused`) | the static h1; Play brings the word back |
| `forced-colors: active`, print | the static h1 (the canvas is `display: none` in CSS too) |
| no 2D canvas, or no text | the static h1 |

The static word is the real `h1`, always in the DOM: it is what screen readers,
crawlers and no-script readers get, it is selectable and copyable in every
fallback, and with particles on it is only `opacity: 0` (never `display` or
`visibility`), so selection still works there too. The canvas is `aria-hidden`
and `pointer-events: none`; the page listens on the window with passive
listeners. The particle word renders `plateTitle.name`: the h1's own text from
the same content store, in the page's language (on the live site that is the
stored title "Portfolio"), in the h1's own computed font, uppercased as the h1
is, on the lines the browser wrapped it into.

**No layout shift.** On desktop the h1 is laid out at the particle size (CSS
custom properties `--pw-*` on the section, computed by `ParticleWord` from the
font's measured advance widths so the word fills ~84% of the section width,
two or three lines if that is bigger) and the canvas is drawn onto that box. So
the box is the same before and after the canvas appears. What does change is
the h1's size when the gate opens, a hydration-time step on desktop only,
under the entry shutter on a first visit. Mobile, reduced motion, Pause,
print and forced colours never receive the `--pw-*` rules (they match only
under `[data-particles]`).

**Density and colour.** The word is made of about 9000 dots (14000 on a very
large box, fewer on weak or very dense screens; `particleBudget`), each under a
pixel and a half across, in black ink grain plus five accents running blue to
purple left to right. The palette is fixed in `ParticleWord.tsx`, with a
brighter set on the dark theme. The canvas is `visibility: hidden` until the
section says `data-particles="on"`, so the assembled word can never show before
its entrance begins; a resize or a late title mid-entrance carries the flight
plan over rather than restarting or flashing it, and the entrance plays once per
mount.

**The colour orbs** (`ground/AmbientOrbs`) are one fixed layer of four radial
gradients (`--glow-*` tokens: blue, indigo, violet, navy), not blurred elements, so there is nothing to
re-raster. Its `opacity` is the only thing that changes: one 1.2s transition
once on load, not a keyframe animation (no clock animation for the scroll-only
test to list), compositor-only. Under reduced motion and Pause the orbs are
simply shown. Print and forced colours show none. The alpha is a token per
theme (`--orb-alpha`: 0.16 light, 0.13 dark; 55% of that under 700px), and
`test/orbContrast.test.ts` holds `--ink-soft` at 4.5:1 and `--ink` at 7:1
under the strongest orb in both themes. A scroll-linked drift was left out.

**Verification note.** On this box's headless Chromium (about one rAF per 40s)
physics are checked by calling the same pure `step` functions, and in the
browser through a test hook that exists only with `?particles=settled|test` in
the address (`window.__heroParticles`: fast-forward N frames, move a virtual
pointer, read particle state). `?particles=settled` also skips the entrance.
||||||| 105e66e

---

## 11. The corner phrases turn on a timer (2026-11-10)

The owner asked for "Technology / Product builder / Applied AI" to "circle on
their own", reversing #162 for those words only. `HeroCorners.tsx` runs one
`setInterval` (3.2s) that moves `data-on` to the next phrase; a 700ms CSS
transition fades and lifts it. No keyframes, so `scrollOnly.test.ts` is
untouched. It is the one clock-driven loop on the first screen besides the
entry's arrival, and it has all the off-switches: reduced motion and Pause
never start it (the first phrase is shown, still), it skips ticks while the tab
is hidden, and print and forced colours show the first phrase. A screen reader
still gets one stable `sr-only` sentence of all the phrases; the rotating stack
is `aria-hidden`.

---

## 12. The particle word's energy lines (2026-11-10)

The owner asked for a thin line from every dot to the centred tenth of the
page's top edge, carrying energy, moving with the dots. `ParticleWord.tsx` draws
them on the word's own canvas (now sized from the hero's top edge down to the
word, and *under* the composition, so the photograph stands in front of the dots
and the lines): one quadratic curve per second dot (up to 4500), its control
point a spring that follows the midpoint so lines swing and lag as dots move,
and a bead running down every tenth line that flares at its dot.

It is a clock-driven loop, like §11, and it is gated exactly as the word is:
the particle gate (width, pointer, hover, canvas, reduced motion, Pause, print,
forced colours) decides whether any of it exists; the loop draws every other
frame when only the lines move, stops while the tab is hidden or the hero is
off screen (an `IntersectionObserver`, both directions, a cost saving and not a
reveal), and never runs in the test modes. No keyframes.
||||||| a371804
