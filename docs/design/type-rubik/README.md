# One UI family: Rubik (issue #795)

Admin and phone titles, project / work / dashboard headings and the gallery,
notes, story, stack, signup and share modules are set in **Rubik** at weight 600
(`--font-ui`, `--weight-ui`, `--track-ui`), Latin and Hebrew in one family.
Audiowide stays only on `.display` (the wordmark and hero name) and the plate
name. Jim Nightshade (the connecting script) is retired. Atkinson body text is
unchanged.

## Files

| File | Bytes | SHA-256 |
|---|---|---|
| `web/public/fonts/rubik-ui-400-600-latin.woff2` | 32,972 | `51acaeeb98a5009f34ef1a65251a085a65b6cf1243b8ef3da6b44099f0a9feca` |
| `web/public/fonts/rubik-ui-400-600-hebrew.woff2` | 8,584 | `f08955e97d0ca2f5724073f9263202d1c6b7d3572dcb20ba93d647444922756f` |

Removed: `jim-nightshade-400.woff2` (51,532 B). Net: -9,976 B shipped; the
first screen preloads the Latin Rubik file only (Hebrew loads on the first
Hebrew glyph through its `unicode-range`).

## Source and licence

- Package: `@fontsource-variable/rubik` 5.3.0, fetched with `npm pack`
  (nothing installed, no scripts run), files `rubik-latin-wght-normal.woff2`
  (sha256 `691cd1d9...0691`) and `rubik-hebrew-wght-normal.woff2`
  (sha256 `197b6dbe...76c2`). Fontsource republishes google/fonts `ofl/rubik`.
- Licence: SIL Open Font License 1.1, copyright 2015 The Rubik Project
  Authors (https://github.com/googlefonts/rubik).
- Modification: wght axis narrowed from 300-900 to 400-600 with the fontTools
  variable instancer; glyph set and `unicode-range` as published. The name
  table was read back after the cut: family "Rubik", copyright and OFL URL
  intact; fvar and GSUB `tnum` present (tabular figures work).
- Reserved Font Name: the OFL's rule on modified versions is met by the CSS
  family name `Rubik UI`, which is only a local alias.

## Behaviour

- `@font-face` `Rubik UI`, `font-display: swap`, weights 400 600, two faces
  split by `unicode-range` (Latin, Hebrew).
- `Rubik UI Fallback`: Arial / Helvetica Neue / Liberation Sans with
  `size-adjust: 104%` and metric overrides, so the swap moves lines little.
- Guard: `web/src/test/typeRubik.guard.test.ts`.

Before / after montages (390 and 1280, he + en, light + dark) are in this
folder.
