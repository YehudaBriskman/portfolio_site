"""
Build every raster icon from the one mark in `public/favicon.svg`.

Run from `web/`:  uv run --with pillow python -I scripts/brand/build-icons.py

The mark is a 384px 2-colour bitmap (ink figure, transparent ground, the
lenses knocked out) embedded in the SVG. Every icon is that figure on a
white disc, because a dark tab strip swallowed the bare figure: the SVG's
`prefers-color-scheme` invert only fires when the OS is dark, and a browser
with a dark theme on a light OS showed ink on near-black. A disc makes the
icon carry its own ground, so it is legible on any strip and needs no
colour-scheme rule at all.

Geometry, shared with the SVG: the figure is scaled to FIG of the disc's
diameter, centred horizontally and dropped to the bottom so the shoulders run
off the disc's edge and are clipped by it, like a portrait in a roundel.
"""
import base64, re, sys
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw

PUBLIC = Path(__file__).resolve().parents[2] / "public"
FIG = 0.86          # figure height as a fraction of the disc diameter
WHITE = (255, 255, 255, 255)
PAPER = (236, 232, 220, 255)  # --paper, the site's ground: the disc reads on it
SS = 4              # supersampling factor for a clean disc edge

svg = (PUBLIC / "favicon.svg").read_text()
mark = Image.open(BytesIO(base64.b64decode(re.search(r"base64,([A-Za-z0-9+/=]+)", svg).group(1)))).convert("RGBA")


def disc(size: int, inset: float = 0.0, ground=None) -> Image.Image:
    """The figure on a white disc, `inset` (fraction) clear of each edge."""
    big = size * SS
    d = round(big * (1 - 2 * inset))
    off = (big - d) // 2
    out = Image.new("RGBA", (big, big), ground or (0, 0, 0, 0))
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).ellipse((off, off, off + d - 1, off + d - 1), fill=255)
    layer = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    layer.paste(WHITE, (0, 0, big, big), mask)
    f = round(d * FIG)
    fig = mark.resize((f, f), Image.LANCZOS)
    layer.alpha_composite(fig, (off + (d - f) // 2, off + d - f))
    clipped = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    clipped.paste(layer, (0, 0), mask)
    out.alpha_composite(clipped)
    return out.resize((size, size), Image.LANCZOS)


disc(192).save(PUBLIC / "icon-192.png", optimize=True)
disc(512).save(PUBLIC / "icon-512.png", optimize=True)
# Maskable: the platform crops to its own shape, so the disc sits inside the
# 80% safe zone on a full-bleed paper ground and any crop still shows it whole.
disc(512, inset=0.1, ground=PAPER).save(PUBLIC / "icon-maskable-512.png", optimize=True)
# iOS fills transparency with black and rounds the corners itself.
disc(180, inset=0.06, ground=PAPER).save(PUBLIC / "apple-touch-icon.png", optimize=True)
ico = disc(256)
ico.save(PUBLIC / "favicon.ico", sizes=[(48, 48), (32, 32), (16, 16)])
print("icons written to", PUBLIC, file=sys.stderr)
