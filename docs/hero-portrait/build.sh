#!/bin/sh
#
# The hero portrait, from the photograph to the two WebP files the page serves.
#
#     sh docs/hero-portrait/build.sh web/public/img
#
# Needs ImageMagick 7 and nothing else. Run it from anywhere; it works out of
# its own directory.
#
#
# Why there is a hand-traced silhouette in this folder
# ----------------------------------------------------
# The brief was that neither the face nor the room may be legible, and the room
# is the harder half: there is a framed certificate and a cap on the wall behind
# the subject. The obvious route — pull the figure out of the background and
# throw the background away — does not work on this photograph. Measured in
# CIELAB, the T-shirt runs L* 61.8–89.8 and the wall behind it runs L* 68.4–93.1.
# The wall's range contains the shirt's, so no threshold, no flood fill and no
# level separates them; a segmentation model would, and there is none available
# here. So the silhouette is authored by hand: 63 points traced over the figure
# in source coordinates, in `silhouette.txt`.
#
# The trace is also an edit. Below the shoulders it runs near-vertical into the
# bottom of the frame rather than following the arms out to the frame's corners,
# because the figure has to be taller than it is wide to stand in the hero's
# second grid row — and because the bottom of the box is dissolved into the
# paper by `Hero.module.css`, so what the silhouette does down there is never
# seen as an edge.
#
#
# Why a halftone and not a wash
# -----------------------------
# A continuous ink wash — luminance as alpha — dissolves the room beautifully
# and makes the face *more* legible, not less: it is a photograph with the
# background removed. Screening the density through a halftone cell is what
# destroys the face, because the cell is coarse relative to an eye. At 560px
# across, an 11px cell leaves nothing of the features but two faint smudges
# where the eye sockets were.
#
# The dots are anti-aliased rather than binary. The browser scales this file
# from 560 to 416 CSS pixels at a 1440-wide window, and a hard-edged halftone
# moires when it is resampled.
#
#
# Why the density is lifted before it is screened
# -----------------------------------------------
# A halftone's ink coverage goes roughly as the square of its density, so the
# shirt — which is pale, and therefore low-density — came out at a fifth of the
# coverage of the hair and the figure read as a floating head. `-level 0%,92%,2.0`
# is the correction: it is close to a square root, which turns the screen's
# quadratic response back into something near-linear. `+level 12%,100%` then
# puts a floor under it, so no lit part of the body can fade to bare paper.
#
# What is deliberately *not* here is local-contrast recovery. Running an
# `-unsharp 0x24+1.6+0` over the lifted density does restore the shirt's folds,
# and it also restores the eyes, the nose, the mouth and the jawline. See
# `rejected-local-contrast.png`. The body's modelling is not worth the face.
#
#
# The `+repage` after `-rotate`, which is load-bearing
# ----------------------------------------------------
# `-rotate 45` leaves the result with a negative page offset — a 1368x1368 tile
# rotated becomes `1936x1936-284-284`. A following `-gravity center -crop`
# resolves its offset against the *page*, not the image, so without `+repage`
# the crop lands 284px down and right of the centre and takes a bite out of the
# rotated tile's corner. The screen then has a white triangle in it, the
# Mathematics step below reads that as "no ink", and the figure loses its lower
# right side to a clean diagonal edge that looks exactly like a cape.
#
set -e
cd "$(dirname "$0")"

DEST=${1:-../../web/public/img}

CROP=845x1220+185+380   # excludes the air conditioner outright; the certificate
                        # and the cap fall inside it but outside the silhouette
SIGMA_L=2.4; CELL_L=11; W_L=560; H_L=808
SIGMA_S=1.5; CELL_S=7;  W_S=350; H_S=505
LEVEL='0%,92%,2.0'
FLOOR=12
INK='#14130F'           # --ink, the same black the type is set in

PTS=$(cat silhouette.txt)

# One size. The small file is screened again at its own size with a cell scaled
# to match rather than resampled from the large one, because a halftone that is
# scaled down stops being a grid of dots and becomes noise — which costs more
# bytes than the dots it replaced (49.8kB resampled, 18.0kB re-screened).
one() {
  name=$1; sigma=$2; cell=$3; w=$4; h=$5

  # The silhouette: drawn at source scale, cropped, then eroded by 2px and
  # feathered by 2px at output scale. Enough to kill the polygon's facets
  # without letting a halo of wall in past the figure's edge.
  magick -size 1200x1600 xc:black -fill white -stroke none -draw "polygon $PTS" \
    -alpha off -crop "$CROP" +repage \
    -resize "${w}x${h}!" -morphology Erode Disk:2 -blur 0x2 \
    "build-mask-$name.png"

  # The ink density: inverted luminance, blurred, lifted, floored. Blurred
  # before the halftone and at output resolution, so the sigma means the same
  # thing as the cell size it is paired with.
  magick source.jpg -crop "$CROP" +repage -colorspace Gray -resize "${w}x${h}!" \
    -blur "0x${sigma}" -negate -level "$LEVEL" +level "${FLOOR}%,100%" \
    "build-density-$name.png"

  # The screen: one radial cell, tiled, turned 45 degrees. See the note above
  # about +repage.
  magick -size "${cell}x${cell}" radial-gradient:black-white "build-cell-$name.png"
  big=$((w + h))
  magick -size "${big}x${big}" "tile:build-cell-$name.png" -rotate 45 +repage \
    -gravity center -crop "${w}x${h}+0+0" +repage "build-screen-$name.png"

  # Density against screen as a soft step: 0.5 + density - screen, steepened.
  magick "build-density-$name.png" "build-screen-$name.png" -compose Mathematics \
    -define compose:args='0,-1,1,0.5' -composite -level '42%,58%' \
    "build-ink-$name.png"

  # Flat ink, with the screened density inside the silhouette as its alpha.
  magick "build-ink-$name.png" "build-mask-$name.png" -compose Multiply -composite \
    "build-alpha-$name.png"
  magick -size "${w}x${h}" "xc:$INK" "build-alpha-$name.png" \
    -compose CopyOpacity -composite "build-out-$name.png"
}

one lg "$SIGMA_L" "$CELL_L" "$W_L" "$H_L"
one sm "$SIGMA_S" "$CELL_S" "$W_S" "$H_S"

# The file is a flat colour plus an alpha channel, so `-quality` buys nothing
# and `webp:alpha-quality` buys everything: 100 gives 72kB, 70 gives 44kB, and
# the difference between them is not visible at any magnification.
magick build-out-lg.png -define webp:alpha-quality=70 -quality 80 "$DEST/yehuda-ink.webp"
magick build-out-sm.png -define webp:alpha-quality=70 -quality 80 "$DEST/yehuda-ink-sm.webp"

rm -f build-*.png
magick identify "$DEST/yehuda-ink.webp" "$DEST/yehuda-ink-sm.webp"

# Prove, every time, that nothing identifying the room is inside the figure.
magick -size 1200x1600 xc:black -fill white -stroke none -draw "polygon $PTS" \
  -alpha off build-check.png
for r in "certificate 136x196+900+630" "cap 142x151+954+885" "air-conditioner 241x151+960+165"; do
  n=$(echo "$r" | cut -d' ' -f1)
  g=$(echo "$r" | cut -d' ' -f2)
  v=$(magick build-check.png -crop "$g" +repage -format "%[fx:maxima]" info:)
  echo "$n inside the silhouette: $v (must be 0)"
done
rm -f build-check.png
