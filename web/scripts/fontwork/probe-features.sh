#!/usr/bin/env bash
#
# What the alternate-letterform machinery costs on the two heaviest faces.
#
# Playpen Sans's whole character is `calt` — a bagful of contextual alternate
# letterforms — and alternates are extra outlines, not extra bytes of table.
# This is the measurement `build.sh` and the @font-face note in index.css cite
# when they drop those features. Writes only into ./probe; run fetch-ttf.sh
# first.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TTF="$HERE/ttf"
P="$HERE/probe"
mkdir -p "$P"

LATIN='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
HEBREW='U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F'
# What build.sh ships with, and the same plus everything it drops.
KEEP='ccmp,kern,liga,locl,mark,mkmk,rlig,rvrn,case,tnum,zero,frac,numr,dnom'
ALL="$KEEP,calt,rclt,clig,curs,aalt,ss01,ss03,dlig"

probe() {
  local src="$1" tag="$2" ranges="$3" feats="$4"
  pyftsubset "$TTF/$src" --output-file="$P/$tag.woff2" --flavor=woff2 \
    --unicodes="$ranges" --layout-features="$feats" --drop-tables+=DSIG,meta 2>/dev/null
  local n
  n=$(python3 -c "
import sys
from fontTools.ttLib import TTFont
print(len(TTFont(sys.argv[1]).getGlyphOrder()))" "$P/$tag.woff2")
  printf '%8d bytes  %4s glyphs  %s\n' "$(stat -c%s "$P/$tag.woff2")" "$n" "$tag"
}

fonttools varLib.instancer -q -o "$TTF/psh-400.ttf" \
  "$TTF/PlaypenSansHebrew-var.ttf" 'wght=400' 2>/dev/null

echo "— Playpen Sans Hebrew (static 400), latin + hebrew"
probe psh-400.ttf psh-shipped "$LATIN,$HEBREW" "$KEEP"
probe psh-400.ttf psh-with-alternates "$LATIN,$HEBREW" "$ALL"

echo "— Rubik Glitch, latin + hebrew"
probe RubikGlitch-Regular.ttf rg-shipped "$LATIN,$HEBREW" "$KEEP"
probe RubikGlitch-Regular.ttf rg-with-alternates "$LATIN,$HEBREW" "$ALL"
