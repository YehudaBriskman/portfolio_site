#!/usr/bin/env bash
#
# Issue #97: what each candidate reading face costs, cut exactly as build.sh
# cuts what ships. Writes only into ./probe; run fetch-ttf.sh first.
#
# Two questions this answers, both by bytes rather than by belief:
#
#   1. Atkinson Hyperlegible (2020, two static masters) or Atkinson
#      Hyperlegible Next (2024, variable 200..800)? The first screen preloads
#      only the 400, so what matters is the 400 on its own and then the pair.
#
#   2. What would a legibility-first Hebrew text face cost against the
#      Playpen Sans Hebrew it would replace? Each candidate's Hebrew half,
#      clipped to 400..700 where it is variable, which is the same clip
#      Playpen ships with.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TTF="$HERE/ttf"
P="$HERE/probe"
mkdir -p "$P"

LATIN='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
HEBREW='U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F'
KEEP='ccmp,kern,liga,locl,mark,mkmk,rlig,rvrn,case,tnum,zero,frac,numr,dnom'

cut() {
  local src="$1" tag="$2" ranges="$3"
  pyftsubset "$TTF/$src" --output-file="$P/$tag.woff2" --flavor=woff2 \
    --unicodes="$ranges" --layout-features="$KEEP" --drop-tables+=DSIG,meta 2>/dev/null
  printf '%8d  %s\n' "$(stat -c%s "$P/$tag.woff2")" "$tag"
}
clip() { fonttools varLib.instancer -q -o "$TTF/$2" "$TTF/$1" "${@:3}"; }

echo "— English text and data role, latin"
cut ComicRelief-Regular.ttf            comic-relief-400 "$LATIN"
cut ComicRelief-Bold.ttf               comic-relief-700 "$LATIN"
cut AtkinsonHyperlegible-Regular.ttf   atkinson-400 "$LATIN"
cut AtkinsonHyperlegible-Bold.ttf      atkinson-700 "$LATIN"
clip AtkinsonHyperlegibleNext-var.ttf  ahn-400.ttf     'wght=400'
clip AtkinsonHyperlegibleNext-var.ttf  ahn-700.ttf     'wght=700'
clip AtkinsonHyperlegibleNext-var.ttf  ahn-400-700.ttf 'wght=400:700'
cut ahn-400.ttf                        atkinson-next-400 "$LATIN"
cut ahn-700.ttf                        atkinson-next-700 "$LATIN"
cut ahn-400-700.ttf                    atkinson-next-400-700 "$LATIN"

echo "— Hebrew text role candidates, hebrew half, 400..700"
fonttools varLib.instancer -q -o "$TTF/PlaypenSansHebrew-400-700.ttf" \
  "$TTF/PlaypenSansHebrew-var.ttf" 'wght=400:700'
cut PlaypenSansHebrew-400-700.ttf      playpen-hebrew "$HEBREW"
clip NotoSansHebrew-var.ttf  noto-400-700.ttf      'wght=400:700' 'wdth=100'
cut noto-400-700.ttf                   noto-sans-hebrew-hebrew "$HEBREW"
cut noto-400-700.ttf                   noto-sans-hebrew-latin "$LATIN"
clip Heebo-var.ttf           heebo-400-700.ttf     'wght=400:700'
cut heebo-400-700.ttf                  heebo-hebrew "$HEBREW"
clip Assistant-var.ttf       assistant-400-700.ttf 'wght=400:700'
cut assistant-400-700.ttf              assistant-hebrew "$HEBREW"
clip Rubik-var.ttf           rubik-400-700.ttf     'wght=400:700'
cut rubik-400-700.ttf                  rubik-hebrew "$HEBREW"
cut Alef-Regular.ttf                   alef-400-hebrew "$HEBREW"
cut Alef-Bold.ttf                      alef-700-hebrew "$HEBREW"
clip OpenSans-var.ttf        opensans-400-700.ttf  'wght=400:700' 'wdth=100'
cut opensans-400-700.ttf               opensans-hebrew "$HEBREW"
cut VarelaRound-Regular.ttf            varela-round-400-hebrew "$HEBREW"
