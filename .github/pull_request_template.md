<!--
Pull requests here are by invitation: please link the issue where one was asked for.
See .github/CONTRIBUTING.md.
-->

## What and why

Closes #

<!-- What changes, and the reason for it. One subject per PR. -->

## How it was checked

- [ ] `make check` passes (lint, typecheck, tests and builds for web and backend)
- [ ] Checked by hand in the browser, in English (`/`) and Hebrew (`/he`) where it shows text
- [ ] Screenshots attached for anything visual (light and dark, desktop and phone)

## Admin UI changes

Skip this section if the PR does not touch `/admin`. Rules and numbers: [docs/admin-design-guide.md](../docs/admin-design-guide.md).

- [ ] Every field on the screen was scored (frequency x consequence x urgency x reversibility); tier 4 removed, tier 2 and 3 are not on the row
- [ ] Phone row budget: at most 2 facts, 1 status glyph, 0 buttons; height at least 56px
- [ ] Catalogue components used (or a catalogue and icon row added); targets 44px, meaningful text 14px, inputs 16px
- [ ] Tokens only (`--a-s-*`, `--a-r-*`, `--a-dur-*`); motion only under `prefers-reduced-motion: no-preference`
- [ ] Checked in `/he`: logical properties, mirrored chevrons, ids and emails `dir="ltr"`
- [ ] The new test failed before the change; screenshots at 390x844 attached

## Notes for review

<!-- Anything risky, anything left out on purpose, follow-ups. -->
