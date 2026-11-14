# Projects, direction A (grouped), phones only

`before/` and `after/` are 390px captures (he and en, light and dark) of /projects, /projects/bothy and /projects/bothy?tab=releases from `npm run shoot:projects`. The prototype is `../public-mobile-direction/after/a-projects.*`.

Checked by eye against the prototype: en light, he light, he dark of the list and the project page.

## Where the build differs from the prototype

- The prototype's list has a "Pinned" group, an "All projects" group with counts, and a stack-line meta. The build keeps today's sections and sort (Pinned, then sort, then the grid) and today's card facts (stars, forks, language, release, updated, notes); nothing was invented for the list.
- The prototype's circles carry a per-project glyph and tone. The build uses the page's own icon and a tone from the project's state (live green, in use blue, open purple, release yellow, else neutral).
- The page header is a card with a 56px circle, the state pill and the one-line description, then four stat tiles. A tile is absent when its datum is. Bothy shows all four; a project with no repository data shows none.
- The pinned action is the page's primary link (today's string), opaque, with no blur.
- The Stack collapses to two lines with Show more / Show less, using existing strings.

## Verified

Tablet (768) and desktop (1280) are byte-identical to main, he and en, on the list, a project, its releases and a project with no stats (`scripts/a11y/compare-wide.mjs`).
