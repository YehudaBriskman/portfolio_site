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
effect. `WordStagger` needs per-word rests of 110ms, 250ms and 420ms, which no
range can express, so the words run on the clock and a scroll-driven animation
is used only as a **gate**: a one-step `steps(1, jump-end)` animation flips a
custom property that the words read through `animation-play-state`. A custom
property is the only thing a scroll timeline can hand to a time-driven
animation, and `animation-play-state` is the one property that accepts the
handoff. See `motion/WordStagger.module.css`.

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
| 0 | title plate | `reveal` | the collection names itself |
| 1 | wall text | `flow` | the quiet before the peak |
| 2 | **the pile** | `pin` | the work stacks up with weight |
| 3 | notes shelf | `pan` | lateral travel against vertical scroll |
| 4 | specs | `count` | real numbers landing |
| 5 | inquiry plate | `reveal` | the ask, as part of the collection |

Five families. No repeat in adjacent beats. `reveal` is used only as the two
bookends; `pin` is spent once, on the peak.

**Every beat must be able to state its one reason in a sentence.** A beat that
cannot does not have one, and gets cut rather than kept.

**Banned outright by the gallery grammar**, listed here so they do not creep
back: `kinetic` headlines, `spotlight`, `magnet`, more than one `scrub`, and a
pinned argument-shaped type act.

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
  there is no feature for a browser to be missing. `Rise` and `BlurShot` are
  time-driven and deliberately have none. Adding one there is cargo cult.

Two further exits exist for specific effects rather than for motion in general:
`forced-colors: active` removes `InkWipe`'s coloured band, because in a forced
palette it would be painted in a system colour it was never chosen for; and an
`IntersectionObserver` that never fires has to land on the finished page too,
which is why `Rise.module.css` cancels its own hidden state under reduced motion
instead of waiting to be told.

---

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
  queue rather than a reveal.
- **Firing at the fold** means the reveal has already finished somewhere below
  the reader's eyeline. 12% inside means they watch it.
- **Horizontal travel is banned.** The deleted `Reveal` component pushed
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
| `motion/InkWipe.tsx` | ink arriving as a hard clip edge, plus the coloured band | `view()` |
| `motion/IrisPanel.tsx` | a panel opening from its centre | `view()` |
| `motion/FillSweep.tsx` | a heading's fill sweeping across its glyphs | `view()` |
| `motion/InkRule.tsx` | a hairline drawing itself in | `view()` |
| `motion/WordStagger.tsx` | a line arriving word by word, in speech rhythm | clock, gated by `view()` |
| `motion/BlurShot.tsx` | a photograph resolving out of a blurred stand-in | load event |
| `nav/useMotionPaused.ts` | the Pause control | — |
| `nav/motion-paused.css` | what Pause does to the page | — |

Plus two scroll-position publishers, which are not devices:
`hooks/useScrollProgress.ts` (the home page's palette and layer progress) and
`components/notes/ReadingBar.tsx` (a post's progress bar).

**No motion component has a scroll listener, a `requestAnimationFrame` loop or
a piece of React state.** The two hooks above are the whole of the per-frame
cost on any page: one `scroll` listener each, rAF-throttled, writing custom
properties on `<html>` rather than React state, and both returning early under
`prefers-reduced-motion`. Everything in the table is either a class name a
stylesheet acts on, or — for `Rise` — one observer that disconnects the moment
it has fired.

Keep it that way. The reason this page can afford as much motion as it carries
is that almost none of it costs anything per frame, and the first component that
measures something on scroll is the one that takes that away.
