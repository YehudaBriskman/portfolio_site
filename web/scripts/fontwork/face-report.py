"""Reports, per source face: GSUB/GPOS feature tags, digit advance widths,
whether the Hebrew block is present, and the vertical metrics. Nothing here
writes a font; it only answers the questions the issue says to measure."""

from __future__ import annotations

import os
import sys

from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
TTF = os.path.join(HERE, "ttf")

DIGITS = "0123456789"


def feature_tags(font: TTFont, table: str) -> list[str]:
    if table not in font:
        return []
    t = font[table].table
    if t.FeatureList is None:
        return []
    return sorted({r.FeatureTag for r in t.FeatureList.FeatureRecord})


def report(path: str) -> None:
    font = TTFont(path, fontNumber=0)
    name = os.path.basename(path)
    upem = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]

    widths: dict[str, int] = {}
    for d in DIGITS:
        gid = cmap.get(ord(d))
        widths[d] = hmtx[gid][0] if gid else -1

    hebrew = [cp for cp in range(0x05D0, 0x05EB) if cp in cmap]
    uppercase = [c for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ" if ord(c) in cmap]
    lowercase = [c for c in "abcdefghijklmnopqrstuvwxyz" if ord(c) in cmap]

    os2 = font["OS/2"]
    print(f"--- {name}  upem={upem}")
    print(f"    GSUB: {feature_tags(font, 'GSUB')}")
    print(f"    GPOS: {feature_tags(font, 'GPOS')}")
    uniq = sorted(set(widths.values()))
    print(f"    digit advances (per 1000upem): "
          f"{ {d: round(w * 1000 / upem) for d, w in widths.items()} }")
    print(f"    digit widths distinct: {len(uniq)}  -> "
          f"{'MONOSPACED digits' if len(uniq) == 1 else 'PROPORTIONAL digits'}")
    print(f"    hebrew alef..tav present: {len(hebrew)}/27")
    print(f"    latin upper: {len(uppercase)}/26  lower: {len(lowercase)}/26")
    print(f"    cap height={os2.sCapHeight if hasattr(os2, 'sCapHeight') else '?'}"
          f" x-height={os2.sxHeight if hasattr(os2, 'sxHeight') else '?'}"
          f"  (/{upem})")
    if "fvar" in font:
        for a in font["fvar"].axes:
            print(f"    axis {a.axisTag}: {a.minValue}..{a.maxValue} default {a.defaultValue}")
    font.close()


if __name__ == "__main__":
    for f in sys.argv[1:] or sorted(os.listdir(TTF)):
        report(f if os.path.sep in f else os.path.join(TTF, f))
