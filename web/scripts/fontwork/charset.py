"""Every non-ASCII codepoint that appears anywhere in the web source tree.

Conservative on purpose: it does not try to tell copy from comments, so the
answer is a superset of what the page can render. If a character is not in
here it cannot reach the screen from this repository.
"""

from __future__ import annotations

import os
import unicodedata

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
EXT = {".ts", ".tsx", ".css", ".html", ".json", ".md"}
SKIP = {"node_modules", "dist", ".git", "fontwork"}

seen: dict[str, int] = {}
for base, dirs, files in os.walk(os.path.join(ROOT, "src")):
    dirs[:] = [d for d in dirs if d not in SKIP]
    for f in files:
        if os.path.splitext(f)[1] not in EXT:
            continue
        with open(os.path.join(base, f), encoding="utf-8") as fh:
            for ch in fh.read():
                if ord(ch) > 0x7F:
                    seen[ch] = seen.get(ch, 0) + 1

for ch, n in sorted(seen.items(), key=lambda kv: ord(kv[0])):
    print(f"U+{ord(ch):04X}  {ch!r:>8}  x{n:<6} {unicodedata.name(ch, '?')}")
print(f"\n{len(seen)} distinct non-ASCII codepoints")
