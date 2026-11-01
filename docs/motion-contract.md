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
| 0 | title plate | **staged assembly** | the collection names itself, in four gated moves |
| 1 | wall text | `flow` | the quiet before the peak |
| 2 | **the pile** | `pin` | the work stacks up with weight |
| 3 | the year | `scrub` | a year of work, raised off the page by the reader's own scroll |
| 4 | notes shelf | `pan` | lateral travel against vertical scroll |
| 5 | specs | `count` | real numbers landing |
| 6 | inquiry plate | `reveal` | the ask, as part of the collection |

Six families. No repeat in adjacent beats. `pin` is spent once, on the peak,
and `scrub` is spent once on beat 3 — the grammar bans a *second* scrub and
has always allowed the first, which is the whole licence beat 3 has.

**Beat 3 is not a second peak, and the test it had to pass is on paper
rather than on taste.** It does not pin, so it buys no scroll distance beyond
its own section's height; it has no asset budget, being 365 one-colour boxes
and no image; and it runs backwards when the reader scrolls back up, which is
what makes it a thing the reader operates rather than a thing that happens to
them once. Its three off-switches land on the flat contribution grid, which is
a finished chart and the one GitHub itself ships — a scrub whose switched-off
state is a legitimate drawing costs nothing to switch off. Measured at 4×
CPU throttle it holds within 0.8fps of the pile and 1.6fps of a page with no
act on it at all; the numbers are in the pull request that added it.

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
`pages/Index.tsx` renders today.** The page renders the pile *before* the wall
text, so the shipped sequence is title plate, pile, wall text, the year, notes
shelf, specs, inquiry plate. `Approach.tsx` still describes itself as "the
quiet before the peak", which is the arrangement above and not the arrangement
shipped. Recorded here rather than silently renumbered, because which of the
two is wrong is a decision about the page and not about this document. No
adjacent pair repeats a family in either order, which is why the discrepancy
has never produced a visible fault.

Beat 0 was `reveal` and is now a staged assembly of four moves — letters, then
the portrait, then the chrome, then the remaining lines — each gated on the
previous one's real `animationend` rather than on a delay. So `reveal` is no
longer a matched pair of bookends; beat 6 is the only one left using it, which
is a thing to notice rather than a thing to fix.

**Every beat must be able to state its one reason in a sentence.** A beat that
cannot does not have one, and gets cut rather than kept.

**Banned outright by the gallery grammar**, listed here so they do not creep
back: `spotlight`, `magnet`, more than one `scrub`, and a
pinned argument-shaped type act. The one `scrub` the page is allowed is now
spent, on beat 3; a second one is the ban and not a judgement call.

**Allowed and currently unused:** `tilt` on objects the visitor would pick up
(3–9°; past 12° it is a toy). It is the one pointer device this grammar invites.

Two rules about the cost of a beat, both of which are about page height rather
than about motion:

- A `flow` section directly after the pinned act takes **reduced** padding. The
  stage needs a full viewport to scroll off, and full section padding on top of
  that delays the next section's first content by another screen.
- Every pinned beat buys its time in scroll distance, and the reader pays for
  it. Review total page height against the beat count, not each beat on its own.

When a beat changes, this table changes with it. A ledger that describes the
previous build is worse than no ledger.

---

## 3. The peak rule

**One engineered peak per page.** It gets the asset budget, the silence before
it, and the most scroll room. Everything else is support.

A page with three peaks has none. The old plan had a smoke hero, colour splats
and a card pile all competing at maximum effort, and the measurable result was
that nothing on the page read as the most important thing on it. The current
peak is the pile (beat 2) — *the work stacks up and you can feel the weight of
it* — and it is the only place the page spends `pin`, the only dark act, and the
only section allowed to cost a frame budget.

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
| `motion/Rise.tsx` | `reveal` — the measured reveal, fired once | observer + clock |
| `motion/useStagedArrival.ts` | the staged assembly: each move waits on the last | clock, gated on `animationend` |
| `components/hero-chrome.css` | the bar's part in that sequence, reached from `body` | clock |
| `motion/Flow.tsx` | `flow` — one gate per item, so a beat can differ per item | observer + clock |
| `motion/InkWipe.tsx` | ink arriving as a hard clip edge, plus the coloured band | `view()` |
| `motion/InkRule.tsx` | a hairline drawing itself in | `view()` |
| `city/ContributionCity.module.css` | `scrub` — one animation turns and raises 365 columns | named `view-timeline` on a static wrapper |

### Retired, and why

`IrisPanel` (a panel opening from its centre), `FillSweep` (a heading's fill
sweeping across its glyphs), `WordStagger` (a line arriving word by word) and
`BlurShot` (a photograph resolving out of a blurred stand-in) were deleted
once the page became a gallery. All four had no call site; three were missing
their `body.motion-paused` exit, which the global duration override cannot
cover because they are progress-driven; and the grammar bans kinetic headlines
outright, which is `WordStagger`'s whole purpose.

An unused component with a hole in its off-switch is a trap for whoever uses it
next, so they went rather than being fixed in place. They are in the history if
a future beat wants one — but it should be rebuilt against §4 rather than
restored, because what was wrong with them is exactly what §4 exists to say.
| `nav/useMotionPaused.ts` | the Pause control | — |
| `nav/motion-paused.css` | what Pause does to the page | — |

Plus two scroll-position publishers, which are not devices:
`hooks/useScrollProgress.ts` (the home page's palette and layer progress) and
`components/notes/ReadingBar.tsx` (a post's progress bar).

**No motion component has a scroll listener or a `requestAnimationFrame` loop,
and none does per-frame work.** The one hook with a scroll listener is
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
`animation-name`. `Approach.module.css` takes the first route and says why.

Keep it that way. The reason this page can afford as much motion as it carries
is that almost none of it costs anything per frame, and the first component that
measures something on scroll is the one that takes that away.
