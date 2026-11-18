# Search Console and PageSpeed, 2026-11-18

Working notes; the other two PSI URLs (/blog and a post) are still to be added.

## Search Console report (crawled 2026-11-04 .. 11-13)

| Bucket | Verdict | Action |
|---|---|---|
| Alternate page with proper canonical (330) | Expected: `?tag`, `?view`, `?topic` views canonicalise to the unfiltered page. `?topic=` was the one facet missing from robots | #906 |
| Blocked by robots.txt | Intentional (facets, #530) | none |
| Page with redirect | `http`/`www` to https apex (308, then 301) | none |
| 404 `/mcp` | Already 401 + `Disallow: /mcp` (#343) | validate fix |
| Crawled, not indexed (feeds) | Feeds send `X-Robots-Tag: noindex`; not in robots so the noindex is seen | none |
| Discovered, not indexed (`/blog/log`, `site-hebrew-and-translations`, +he) | New URLs, in sitemap, 200, self-canonical | request indexing |

Sitemap crawl of all 210 URLs: all 200, self-canonical, one `h1`, no stray `noindex`.
Found and fixed: 23 thin help-message pages (#907, #910), duplicate project/area descriptions and
Hebrew help titles (#908, #911), five over-long post titles (#909, edited live).
Released as v1.9.2.

## PageSpeed Insights, home (https://yehudabriskman.com/)

| | Mobile | Desktop |
|---|---|---|
| Performance | 83 | 91 |
| Accessibility | 97 | 97 |
| Best practices | 96 | 96 |
| SEO | 100 | 100 |
| FCP / LCP | 1.1 s / 3.0 s | 0.3 s / 0.8 s |
| TBT / CLS | 360 ms / 0 | 180 ms / 0 |

Open issues: #912 contrast, #913 non-composited animations (236 mobile), #914 render-blocking CSS and unused CSS/JS,
#915 short cache on unfingerprinted assets.

Deliberately left: brotli off (see `web/nginx.conf.template`), HSTS preload (would bind the admin host and
every subdomain), Trusted Types (optional hardening).

Core Web Vitals field data: none yet (not enough traffic in the CrUX window).

## PageSpeed Insights, post and blog

| | /blog mobile | /blog desktop | post mobile | post desktop |
|---|---|---|---|---|
| Performance | 99 | 96 | 86 | 96 |
| Accessibility | 100 | 100 | 97 | 97 |
| Best practices | 96 | 96 | 92 | 92 |
| SEO | 100 | 100 | 100 | 100 |
| LCP | 1.1 s | 0.8 s | 3.5 s | 0.7 s |
| TBT | 30 ms | 130 ms | 210 ms | 70 ms |
| CLS | 0 | 0.001 | 0 | 0 |

New findings:
- **Post pages log a console error** (best practices 92): `GET /api/signature/en/current` returned 404 on
  every view while "End of posts" is off. Fixed to 204 in #916.
- Post page is the heaviest: unused JS 114 KiB, 426 non-composited animations (#913), LCP 3.5 s mobile (#914).
- Image delivery, ~20 KiB, on post and blog: #917. /blog identical-links a11y flag and CLS 0.001: #918.
- Contrast fails on home and post but not /blog mobile (#912).
