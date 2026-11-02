#!/usr/bin/env bash
set -uo pipefail
OUT="$(cd "$(dirname "$0")" && pwd)/ttf"
mkdir -p "$OUT"
BASE="https://raw.githubusercontent.com/google/fonts/main"
try() {
  local path="$1" name="$2"
  code=$(curl -sL -o "$OUT/$name" -w "%{http_code}" "$BASE/$path")
  echo "$code  $name  $(stat -c%s "$OUT/$name" 2>/dev/null)  <- $path"
}
try "ofl/audiowide/Audiowide-Regular.ttf" "Audiowide-Regular.ttf"
try "ofl/rubikglitch/RubikGlitch-Regular.ttf" "RubikGlitch-Regular.ttf"
try "ofl/jimnightshade/JimNightshade-Regular.ttf" "JimNightshade-Regular.ttf"
try "ofl/solitreo/Solitreo-Regular.ttf" "Solitreo-Regular.ttf"
try "ofl/comicrelief/ComicRelief-Regular.ttf" "ComicRelief-Regular.ttf"
try "ofl/comicrelief/ComicRelief-Bold.ttf" "ComicRelief-Bold.ttf"
try "ofl/playpensanshebrew/PlaypenSansHebrew%5Bwght%5D.ttf" "PlaypenSansHebrew-var.ttf"

# Issue #97 — the reading face. Atkinson Hyperlegible is the face that ships;
# Next is fetched so its bytes and coverage can be weighed against it.
try "ofl/atkinsonhyperlegible/AtkinsonHyperlegible-Regular.ttf" "AtkinsonHyperlegible-Regular.ttf"
try "ofl/atkinsonhyperlegible/AtkinsonHyperlegible-Bold.ttf" "AtkinsonHyperlegible-Bold.ttf"
try "ofl/atkinsonhyperlegiblenext/AtkinsonHyperlegibleNext%5Bwght%5D.ttf" "AtkinsonHyperlegibleNext-var.ttf"

# The Hebrew candidates for the text role, measured by legibility.mjs against
# Playpen Sans Hebrew on the letter pairs Hebrew readers confuse. Fetched to
# be measured; only what the measurement picks is cut by build.sh.
try "ofl/notosanshebrew/NotoSansHebrew%5Bwdth,wght%5D.ttf" "NotoSansHebrew-var.ttf"
try "ofl/heebo/Heebo%5Bwght%5D.ttf" "Heebo-var.ttf"
try "ofl/assistant/Assistant%5Bwght%5D.ttf" "Assistant-var.ttf"
try "ofl/rubik/Rubik%5Bwght%5D.ttf" "Rubik-var.ttf"
try "ofl/alef/Alef-Regular.ttf" "Alef-Regular.ttf"
try "ofl/alef/Alef-Bold.ttf" "Alef-Bold.ttf"
try "ofl/opensans/OpenSans%5Bwdth,wght%5D.ttf" "OpenSans-var.ttf"
try "ofl/varelaround/VarelaRound-Regular.ttf" "VarelaRound-Regular.ttf"
