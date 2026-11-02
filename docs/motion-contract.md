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
| — | any running text | **pen** | prose is set as the reader's eye reaches it |
| 0 | title plate | **staged assembly** | the collection names itself, in four gated moves |
| — | the plate's end corner | **breath** | one small light is on, and says one thing at a time |
| 1 | wall text | `draw` | the method, drawn beside the sentence that names it, by the reader's scroll |
| 2 | **the run** | `pin` | the work arrives along one line, and the reader's scroll is what moves it |
| 3 | the year | `scrub` | a year of work, raised off the page by the reader's own scroll |
| 4 | notes shelf | `pan`, held | the notes walk past a held frame, one card-width per step of the reader's scroll |
| 5 | specs | `count` | real numbers landing |
| 6 | inquiry plate | `surface` | the ask comes up out of the sheet, part by part, as the reader arrives |

Ten families (`reveal` left the page with #160; `surface` took its place; `flow` left with #157 and `draw` took its place). No repeat in adjacent beats. The head row reuses the entry's family on purpose and is argued below. `pin` is spent once, on the peak,
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
  against the year's 120svh and the run's 220svh, so the peak keeps the most
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
from 85% of the window's height to 45% the pen inks it one word after
another in reading order and leaves it at ink — so a sentence is written out
as the eye reaches it, and un-written word by word if the reader scrolls
back (#158: word `i` of `n` owns the slice `i/n`–`(i+1)/n` of the
paragraph's clock, so at most one word is ever mid-stroke). It sat beside
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
but the colour of text that was already there. It never makes anything less
legible than the page set it: the muted state is `--ink-soft`, the colour the
wall text was already designed in, and the band only *adds* ink. And its
off state is not a lesser version of it but the page with all prose at full
ink, which costs a reader nothing to choose. A peak is the thing the page
spends its budget on; this spends a frame cost, measured below, and nothing
else.

**Muted is `--ink-soft`, and there is no third value to choose.**
`index.css` already settled it: paper has no room for a third text colour,
and `--ink-faint` (3.60:1) is non-text. Measured on every ground it is used
on — computed from the tokens and confirmed against the rendered ground
sampled beside the text:

| where | ground | muted `--ink-soft` | lit / rest `--ink` |
|---|---|---|---|
| wall text, home | `--paper` #ECE8DC | 6.37:1 | 15.17:1 |
| a post's body | `--paper` #ECE8DC | 6.37:1 | 15.17:1 |
| a project page | `--paper` #ECE8DC | 6.37:1 | 15.17:1 |
| any prose inside a dark act | `--panel` #0C0C0E (via `.on-panel`) | 7.86:1 | 17.15:1 |

No `Written` sits inside a dark act today; the last row is there because
`.on-panel` re-points both tokens and the stylesheet does nothing extra, so
the day one does it is already measured. The rendered-glyph figures
`index.css` records for the text face (coverage-weighted, lowest on paper
4.69:1 for a 12px chip in `--ink-soft`) apply to the muted state exactly as
they applied to the wall text before this change: it is the same colour on
the same face, at body sizes that sit above that lowest row.

**Its rest state is full ink, which is the off state.** Reduced motion,
Pause and a browser without `animation-timeline` each cancel the animation
and land on `--ink` — not on the caller's colour, because most prose here is
set in `--ink-soft` and landing there would be landing on muted. Print is a
fourth exit for the same reason. Screenshots of all three switches are in
`docs/written/`.

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

**The breath row is not a beat either: it is the one thing on the page that
loops while the reader does nothing, and the row is there so it stays the
only one.** `HeroCorners.tsx` puts a 0.5rem lamp of `--signal` in the title
plate's end corner, breathing over 6.4s with a ring leaving it once a breath,
and beside it the owner's README asides — "Technology", "Build boldly" — one
at a time, every 3.6s. A soft light that rises and falls means *this is on*.
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
holds its frame (`position: sticky`) over a 120svh runway, on a static stage
that owns the named timeline exactly as §1 prescribes. That makes it a held
beat, and the test is now comparative and measured: the run holds for 220svh
(55svh a card, four cards) and the year for 120svh; the work section is
3397px against the year's 2360px at 1440×900, same page, same data. (The
pile it replaced held about 238svh, a 3919px section.) The run keeps the most
scroll room,
the only asset budget and `pin` as its *move*; what the year holds still for
is a camera dolly down its own grid, which is the scrub continuing rather than
a second family arriving. It has no asset budget, being 365 one-colour boxes
and no image; and it runs backwards when the reader scrolls back up, which is
what makes it a thing the reader operates rather than a thing that happens to
them once.

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

### /projects: the catalogue, and why it is not the run (#169)

The table above is the home page's. `/projects` is a different page with a
different job, and since #169 it has its own device rather than a second
copy of the home page's.

| page | device family | the one reason it exists |
|---|---|---|
| `/projects` | **`riffle`** | each row stands up out of the lower part of the window like the next card in a drawer, so the register is ruled and upright by the time the eye reaches it |

**The owner's words are the brief:** the catalogue "shouldn't be like the
landing page, it's not the same purpose". The run is branding — a curated
few, one at a time, the page's peak. The catalogue is the full set, 4 today
and 40 later, and a reader there is scanning and choosing, not being shown.
Before #169 the catalogue was the pile, on the argument that two ways of
showing a project would drift apart; that argument was about code reuse, and
the owner's is about purpose, which wins.

**What makes `riffle` its own family and not `pin`, `pan` or `flow` again.**
Four tests, and it has to keep passing all of them:

- **Nothing is held.** No `position: sticky`, no runway, no stage. The page is
  exactly as tall as the list (1969px for six projects at 1440×900, 4783px
  for twenty-six), where the run adds 55svh of scroll per card and the pile
  added a pinned slot per card. That is the scaling argument in one line: a
  held device charges scroll per item, so it is only affordable for a curated
  few, and the catalogue is by definition not curated.
- **No lateral travel.** The run moves cards sideways along a curve and the
  shelf pans; a row here rotates about its own top edge (`rotateX`) and moves
  nowhere. The only thing that has a direction is the hairline drawn in from
  the reading edge, which mirrors in RTL (`transform-origin` flips under
  `html[dir="rtl"]`).
- **Per-row clock, not per-act.** Each `<li>` names its own `view-timeline`
  and the link inside it reads it, so the 40th row behaves exactly like the
  first and there is no count in the stylesheet at all. The run divides one
  stage's timeline by `--run-n`; this has no `n`.
- **Not `flow` or `reveal`.** Those fire once on an observer and a clock and
  never reverse. `riffle` is scrubbed: `entry 0%` to `cover 25%` of each row,
  so it reverses exactly on the way up and is a pure function of scroll
  position. Six offsets compared scrolling down and back up, EN and HE, 6 and
  26 projects, laptop and phone (`web/scripts/shoot-projects-index.mjs`,
  frames in `docs/projects-index/`): 44 of 48 byte-identical below the bar,
  and the other four are RTL frames differing in 2 pixels by at most 7/255 on
  a tipped row's text — rasteriser noise, not a different state.

**It is not a peak and it does not compete with one.** Different page, so §3
does not count it against the run, and it is deliberately quiet: by a
quarter of the way up the window every row is upright, flat and still, so the
part of the screen a reader is actually reading never moves. Type is never
faded — the tipped leaf's shade is an overlay, not opacity on the words.

**It is not `spotlight` either**, which the grammar bans. Nothing is singled
out: every row does the same thing at the same height, and the effect sits
in the margin of attention (the bottom quarter) rather than at its centre.

**The off-switches land on the plain register.** Reduced motion, Pause and
no `animation-timeline` each cancel all three animations (leaf, shade,
rule) and restate upright, unshaded, fully ruled. A row that takes focus also
cancels its own (`.row:focus-within`) and asks for `scroll-margin-block-end:
34svh`, so Tab never parks the reader on a tipped leaf.

**The filter earns its place by count, not by design.** A state filter
(`?state=`, deep-linkable) appears from nine projects and two states up
(`projects/catalogue.ts`); with six it would hide less than it costs to
read. Year is not filtered because it is already the register's first
column. This is the only count-dependent thing on the page, and it decides
whether a control exists, never how anything moves.

**What it costs, measured (2026-11-02).** 4× CPU throttle, 1440×900, the whole
document wheel-scrolled with real input events, rAF frames over wall clock,
five interleaved passes per arm after a warm-up
(`web/scripts/measure-projects-fps.mjs`), against the pile it replaced on the
same harness:

| arm | 6 projects | 26 projects (20 mocked) |
|---|---|---|
| `main`, the pile | 42.9fps (41.1–44.5) | 43.4fps (39.3–44.1) |
| the register, riffling | 51.7fps (50.9–53.2) | 46.6fps (46.3–47.1) |
| the register, reduced motion (no riffle) | 59.1fps (51.8–60.7) | 60.3fps (60.0–60.4) |

The register is cheaper than the pile it replaced at both counts. It does
get dearer with more rows — 26 rows put more of them in the riffle band per
screen on the phone-sized ones and more timelines on the page — but it is
still above the pile at 26, and the cost is per row on screen, not per row in
the list, so 40 costs what 26 does. Absolute numbers are SwiftShader under
this harness and only comparable within the table. Per frame the riffle writes `transform` on the rows in the
lower quarter and `opacity` on their shade layers — compositor work, no
layout.

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
run does (120svh against 220svh), measured in §2. What the pair costs it is
the ground as a *signal* of the peak, and §2's ledger row for `drift` is where
that trade is recorded.

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
2. **The Pause toggle** — `web/src/components/nav/useMotionPaused.ts`, which
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
  restate the arrived state themselves. `InkWipe.module.css` makes this argument
  at length.
- `animation-play-state: paused` is the obvious-looking alternative and is
  wrong for the same reason in reverse: it freezes each animation at the time it
  has reached, which for anything that has not started yet is frame zero — and
  with `fill-mode: both` that is the hidden state. "Pause motion" would blank
  every element that enters by animation.
- Pause can be **toggled mid-scroll, while a sticky act is pinned**. Because
  every exit lands on the arrived state, a half-arrived element snaps to
  arrived. It must never snap to hidden.
- A component with no scroll timeline in it needs **no `@supports` block** —
  there is no feature for a browser to be missing. `Rise` is time-driven and
  deliberately has none. Adding one there is cargo cult.
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

**A fourth exit exists, and no stylesheet can see it.** A staged sequence waits
on each move's `animationend`; if one never fires — a cancelled animation, a
display change mid-flight, an engine quirk — every stage after it is stranded.
`useStagedArrival` carries a per-stage deadline for exactly that, and degrades
to the four delays the hook exists *not* to be, which is the right thing to
degrade to. The condition lives in TypeScript because it is a fact about an
event that did not happen, and CSS cannot ask that question.

Two further exits exist for specific effects rather than for motion in general:
`forced-colors: active` removes `InkWipe`'s coloured band, because in a forced
palette it would be painted in a system colour it was never chosen for; and an
`IntersectionObserver` that never fires has to land on the finished page too,
which is why `Rise.module.css` cancels its own hidden state under reduced motion
instead of waiting to be told.

---

### The one kinetic headline

`kinetic` headlines were banned here, on the grammar's own argument that a
gallery label is read rather than performed. Beat 0 is now one, on the owner's
direction, and the ban is lifted for that beat alone — the first screen is the
page naming itself and is the one place a performance is the point. Everywhere
else the argument still holds: a project label that assembles itself is a label
competing with the object it names.

## 5. What a premium reveal is made of

Measured, and the numbers are the point rather than a starting place. The
canonical implementation is `web/src/components/motion/Rise.tsx` and its
stylesheet; borrow it rather than writing these numbers again.

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

**"Once" is why a reveal uses an observer on a page that otherwise has none.** A
view timeline ties progress to scroll position, so scrolling back up runs it
backwards. That is exactly right for ink arriving on a card and exactly wrong
for content, which must not re-hide itself when the reader looks away — and
"once" is not something a scroll timeline can express. Every *other* arrival on
this site is a view timeline with no observer and no state, because the timeline
already knows where the element is and an `IntersectionObserver` reproducing
that would only ever be a frame behind it.

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
| `motion/Rise.tsx` | `reveal` — the measured reveal, fired once (no beat on the home page uses it since #160) | observer + clock |
| `Contact.module.css` `.surface` | `surface` — each part of the close rising out of its own baseline | `view()` per part |
| `motion/EntryShutter.tsx` | `shutter` — the page arrives from behind a grid | clock, gated on real readiness |
| `motion/useStagedArrival.ts` | the staged assembly: each move waits on the last | clock, gated on `animationend` |
| `components/hero-chrome.css` | the bar's part in that sequence, reached from `body` | clock |
| `motion/Flow.tsx` | `flow` — one gate per item, so a beat can differ per item (no beat on the home page uses it since #157) | observer + clock |
| `Approach.module.css` + `ApproachFigures.tsx` | `draw` — each principle's figure, stroke by stroke | named `view-timeline` per principle |
| `motion/InkWipe.tsx` | ink arriving as a hard clip edge, plus the coloured band | `view()` |
| `motion/InkRule.tsx` | a hairline drawing itself in | `view()` |
| `projects/ProjectIndex.module.css` | `riffle` — /projects only: each catalogue row stands up on its top edge as it enters the lower quarter, and its rule draws in from the reading edge | named `view-timeline` on each static `<li>`, read by the link inside it |
| `projects/ProjectRun.module.css` | `pin` — the work travelling along a curve under a held frame; one lap per card, staggered by range | named `view-timeline` on the static stage, the frame held inside it |
| `LatestNotes.module.css` | `pan`, held — the notes walk past under a held frame, one card-width per step | named `view-timeline` on the static stage (inset 0), the frame held inside it |
| `city/ContributionCity.module.css` | `scrub` — one animation turns and raises 365 columns, a second dollies the camera down the year | named `view-timeline` on a static wrapper, the frame held over it |
| `city/useCityHand.ts` | the year's orbit and its one readout — a drag turns the city, a point reads a day | pointer events; a settle loop only between release and rest |
| `gallery/Skeleton.module.css` | `sweep` — one line of a placeholder, the band across it, and the gate before it | clock |
| `gallery/SkeletonLines.tsx` | the primitive: a run of lines as tall as the type they stand in for | — |
| `gallery/LabelSkeleton.tsx` | the object label's three parts, in the label's own stylesheet | — |
| `gallery/SkeletonGate.tsx` | the box that holds a region's height, and the 180ms before it is inked | clock |
| `ground/DarkAct.module.css` | `drift` — two lights crossing at each seam of the dark ground | clock, gated off-screen by an observer |
| `index.css` `.section-head::after` | the shutter, echoed — a lattice leaving each section head outward from its word | named `view-timeline` on the head, inset to the lower third |
| `motion/Written.tsx` | `pen` — running text written one word after another as it rises through the lower half of the window | named `view-timeline` on the paragraph; word `i` of `n` owns the slice `i/n`–`(i+1)/n` |

### Retired, and why

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

An unused component with a hole in its off-switch is a trap for whoever uses it
next, so they went rather than being fixed in place. They are in the history if
a future beat wants one — but it should be rebuilt against §4 rather than
restored, because what was wrong with them is exactly what §4 exists to say.
| `nav/useMotionPaused.ts` | the Pause control | — |
| `nav/motion-paused.css` | what Pause does to the page | — |

`ground/DarkAct.tsx` is the third component on the site with an
`IntersectionObserver` in it, after `Rise` and `useEnteredOnce`, and it is the
first whose observer does not fire once and stop. It fires on the way in and
on the way out, twice per visit per act, and writes one attribute — which is
still not a listener and still not per-frame work, and is the price of an
ambient loop that refuses to run for nobody.

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
`prefers-reduced-motion`. Everything in the table is either a class name a
stylesheet acts on, or — for `Rise` and `Flow` — one observer that stops
watching a target the moment it has fired. `Flow` carries no React state at
all: it writes `data-flow` on each item and the caller's stylesheet does the
rest, so an arrival costs one attribute and no render.

**One component does hold state, and the rule is narrower than it used to
read.** `useStagedArrival` keeps an integer for the stage it has reached and
one `document` listener, both gone when the last stage starts. That is the
price of a sequence whose steps wait on each other rather than on a stopwatch,
and it is paid once per mount rather than once per frame — which is the
property this section is actually about.

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
