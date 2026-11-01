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
