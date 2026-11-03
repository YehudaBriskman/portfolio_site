#!/bin/bash
# Lab Core Web Vitals for the SEO audit (#308): Lighthouse 12, mobile with
# simulated throttling (its default), on a home page, a note and a project in
# both languages. One line per page.
#
#   web/scripts/seo/lighthouse.sh <out-dir> <base-url> [note-slug] [project-slug]
#
# Chrome is started here under xvfb and Lighthouse attaches to it with
# --port, because chrome-launcher reads WSL as Windows and fails to make its
# temp directory. CHROME overrides the binary (default: Playwright's).
set -u
OUT=${1:?out dir}
BASE=${2:?base url}
NOTE=${3:-windom-glass-as-optics}
PROJECT=${4:-windom}
CHROME=${CHROME:-$(ls -d "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux64/chrome | tail -1)}
mkdir -p "$OUT"
PROFILE=$(mktemp -d)
xvfb-run -a "$CHROME" --no-sandbox --remote-debugging-port=9333 --user-data-dir="$PROFILE" --no-first-run about:blank >/dev/null 2>&1 &
for _ in $(seq 1 30); do curl -s localhost:9333/json/version >/dev/null && break; sleep 1; done
for p in / /he "/blog/$NOTE" "/he/blog/$NOTE" "/projects/$PROJECT" "/he/projects/$PROJECT"; do
  name=$(echo "$p" | tr '/' '_')
  npx -y lighthouse@12.8.2 "$BASE$p" --port=9333 --quiet --output=json --output-path="$OUT/$name.json" \
    --only-categories=performance,seo,accessibility,best-practices >/dev/null 2>"$OUT/$name.err"
  node -e '
    const r = require(process.argv[1]); const a = r.audits; const c = r.categories;
    const s = (k) => Math.round(c[k].score * 100);
    console.log([process.argv[2], "perf=" + s("performance"), "seo=" + s("seo"), "a11y=" + s("accessibility"),
      "bp=" + s("best-practices"), "LCP=" + a["largest-contentful-paint"].displayValue,
      "CLS=" + a["cumulative-layout-shift"].displayValue, "TBT=" + a["total-blocking-time"].displayValue,
      "FCP=" + a["first-contentful-paint"].displayValue].join("\t"));
  ' "$OUT/$name.json" "$p"
done
pkill -f "remote-debugging-port=9333" 2>/dev/null
rm -rf "$PROFILE" 2>/dev/null || true
