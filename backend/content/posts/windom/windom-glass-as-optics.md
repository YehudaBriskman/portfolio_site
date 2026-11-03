---
{
  "slug": "windom-glass-as-optics",
  "title": "The glass is computed, not decorated",
  "subtitle": "How WindoM's panes refract the wallpaper behind them, and the one fault that hid it",
  "excerpt": "WindoM's glass bends the wallpaper through Snell's law instead of faking it with blur and tint. Getting there meant finding the browser fault that had been erasing the backdrop.",
  "tags": ["windom", "css", "performance", "chrome-extension"],
  "collection": "windom",
  "status": "published",
  "publishedAt": "2026-11-02T09:00:00Z",
  "readingMinutes": 3,
  "featured": 1,
  "coverImage": null,
  "links": [
    { "label": "PR #349, rebuild the glass as real optics", "url": "https://github.com/YehudaBriskman/WindoM/pull/349" }
  ],
  "sources": [
    { "label": "WindoM PR #349", "url": "https://github.com/YehudaBriskman/WindoM/pull/349" },
    { "label": "WindoM CHANGELOG, 1.5.0", "url": "https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md" },
    { "label": "WindoM README, How it is built", "url": "https://github.com/YehudaBriskman/WindoM/blob/main/README.md" }
  ]
}
---
WindoM's panes are glass. For most of the project's life that meant what it
usually means on the web: a backdrop blur, a tint, and a border that catches
the light. In 1.5 the glass became something closer to the real material.
The rim of every pane bends the wallpaper behind it, and the amount it bends
is computed rather than chosen.

## What the rim computes

A pane's edge is modelled as a quartic squircle profile: flat across most of
the surface, curving down at the rim. For each point on the rim, the surface
normal comes from a rounded-rectangle distance field, and the displacement
follows Snell's law for light passing through that slope.

Incidence is capped at 65 degrees. Past that angle, Fresnel reflectance means
a real surface mostly reflects instead of transmitting, so there is nothing
meaningful to refract. Each distinct pane shape gets its own displacement map,
generated once and cached.

The highlight is the other half. It follows the pointer through a stiff
spring while the material gathers behind it through a softer one. A
highlight pinned exactly to the cursor reads as a texture painted on the
surface; one that lags slightly and settles reads as light moving across an
object.

## The fault that hid all of it

The first versions of this did not look like glass at all. The blur looked
wrong, nothing curved, and attempts to fix the look by tinting and darkening
only made the pane heavier.

The cause was a single browser behaviour. An SVG `feDisplacementMap` fed by
`feImage` returns nothing when it is used from `backdrop-filter`. The pane
was not bending the backdrop; it was erasing it. That explained every
symptom at once: there was no backdrop left to blur, and nothing to displace.

The same filter does work through an ordinary `filter:`. So the rim now paints
its own copy of the wallpaper, aligned with the real one, displaces that copy,
and masks it to the edge of the pane.

A second fault kept the effect out of every production build. Blink treats
`-webkit-backdrop-filter` as a true alias, so the minifier kept the prefixed
declaration and dropped the standard one.

## Measured, not eyeballed

Glass effects have a reputation for being expensive, so the rebuild was
profiled rather than judged by eye. Opening a panel had cost 519 ms of
script, because a full displacement field was being rasterised on every
frame of the opening animation. Layout was being read per pane per frame and
interleaved with style writes. After the fixes, that script cost is 11 ms,
backdrop samples went from 13 to 4, and the worst frame dropped from 100 ms
to 33 ms.

The test that mattered most: disabling the refraction entirely moved dropped
frames from 24 to 23. The glass is not what costs.

## Legibility without dimming

The last change was a principle rather than a technique. Earlier versions
kept text readable by darkening the pane. Now the glass stays light, and
legibility comes from a ground placed under the text. Chrome is glass;
content sits on paper.
