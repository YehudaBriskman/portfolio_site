#!/usr/bin/env bash
#
# Builds the nine woff2 files the site serves, from the sources fetch-ttf.sh
# pulled out of google/fonts. Run it from anywhere; it writes into
# web/public/fonts and prints the byte count of everything it wrote.
#
#   LATIN / HEBREW are Google's own subset ranges, copied verbatim from the
#   css2 responses in ./out, so a glyph Google would have served is a glyph we
#   serve.
#
#   KEEP is the layout-feature set. It drops `calt`, `aalt`, `ss01`, `ss03`
#   and `dlig` — the alternate-letterform machinery — which on Playpen Sans
#   Hebrew is 1023 glyphs and 105,928 bytes against 360 glyphs and 31,404
#   without. The alternates are the face's signature at poster size and
#   invisible at the 11-12px uppercase the data role sets, so they are not
#   worth three times the file.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TTF="$HERE/ttf"
OUT="$(cd "$HERE/../.." && pwd)/public/fonts"
mkdir -p "$OUT"

LATIN='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
HEBREW='U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F'
KEEP='ccmp,kern,liga,locl,mark,mkmk,rlig,rvrn,case,tnum,zero,frac,numr,dnom'

cut() {
  local src="$1" dst="$2" ranges="$3"
  pyftsubset "$TTF/$src" --output-file="$OUT/$dst" --flavor=woff2 \
    --unicodes="$ranges" --layout-features="$KEEP" --drop-tables+=DSIG,meta 2>/dev/null
  printf '%8d  %s\n' "$(stat -c%s "$OUT/$dst")" "$dst"
}

# The variable Playpen file carries wght 100..800 and the data role sets two of
# them. Clipping the axis first is worth measuring against the full range.
fonttools varLib.instancer -q -o "$TTF/PlaypenSansHebrew-400-700.ttf" \
  "$TTF/PlaypenSansHebrew-var.ttf" 'wght=400:700'

echo "— English: latin only. The site's English content comes out of CouchDB"
echo "  at runtime, so the range cannot be narrowed to what this repo contains."
cut Audiowide-Regular.ttf       audiowide-400.woff2      "$LATIN"
cut JimNightshade-Regular.ttf   jim-nightshade-400.woff2 "$LATIN"
# The reading face, issue #97. Atkinson Hyperlegible Next rather than the 2020
# static pair: same letterforms where it counts (legibility.mjs measures the
# two within a few hundredths on every confusable pair), and its one variable
# file clipped to 400..700 is 20,056 bytes for both weights against 16,676 +
# 17,080 for the two hinted statics (probe-reading-face.sh). Clipped for the
# same reason Playpen is: the text and data roles ask for 400 and 700.
#
# Run on 2026-11-02, this script reproduced every committed file byte for byte
# except the two Playpen halves (11,888 / 43,748 against the committed 11,924
# / 43,812): the variable source in google/fonts has moved since they were
# cut. Those two were left as committed, because #97 does not change Hebrew
# and a reading-face PR should not quietly re-cut a face it is not about.
fonttools varLib.instancer -q -o "$TTF/AtkinsonHyperlegibleNext-400-700.ttf" \
  "$TTF/AtkinsonHyperlegibleNext-var.ttf" 'wght=400:700'
cut AtkinsonHyperlegibleNext-400-700.ttf atkinson-hyperlegible-next-400-700.woff2 "$LATIN"

echo "— Hebrew: split by script, because the Latin half of each of these faces"
echo "  is the expensive half and a Hebrew heading does not need it."
cut RubikGlitch-Regular.ttf     rubik-glitch-400-hebrew.woff2 "$HEBREW"
cut RubikGlitch-Regular.ttf     rubik-glitch-400-latin.woff2  "$LATIN"
cut Solitreo-Regular.ttf        solitreo-400-hebrew.woff2     "$HEBREW"
cut Solitreo-Regular.ttf        solitreo-400-latin.woff2      "$LATIN"
cut PlaypenSansHebrew-400-700.ttf playpen-sans-hebrew-400-700-hebrew.woff2 "$HEBREW"
cut PlaypenSansHebrew-400-700.ttf playpen-sans-hebrew-400-700-latin.woff2  "$LATIN"
