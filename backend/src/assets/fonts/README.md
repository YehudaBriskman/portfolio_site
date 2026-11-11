# Card fonts

Bundled for the share-card renderer (`services/og.ts`); resvg loads these files only, never system fonts.

| File | Used for |
|---|---|
| `OGDisplay.ttf`, `OGSans.ttf`, `OGMono.ttf` | English cards |
| `Heebo-Bold.ttf` | Hebrew cards (Hebrew block plus Latin and digits, so mixed titles stay in one face) |
| `metrics.json` | Per-glyph advance widths (em fractions) used to wrap titles; the `Heebo` entry is generated from `Heebo-Bold.ttf`'s `hmtx`/`cmap` |

## Heebo

- Source: https://github.com/OdedEzer/heebo, `fonts/ttf/Heebo-Bold.ttf` (static instance)
- Version: 3.100 (from the file's own `name` table, ID 5)
- Licence: SIL Open Font License 1.1, stated in the file's name table (IDs 0, 13, 14); full text in `Heebo-OFL.txt`, copied from the same repository. Copyright 2014 The Heebo Project Authors.
- Unmodified. The OFL allows bundling and redistribution with this software; the font is not sold on its own.
