# Public blog and reader, direction A (phones under 640px)

Before and after screenshots at 390 (he and en, light and dark) are in `before/` and `after/`
(`blog`, filtered `blog?tag=`, `blog/area/bothy`, a post, and a long post at three scroll positions).

## What changed
- Note rows (list, filter results, area page, related posts): a 40 circle tinted by area, title, muted meta, pills, chevron.
- Reader: text on the calm ground, tags as pills, soft quote and code blocks, grouped byline and subscribe.
- Floating reader bar: Contents, Text size, Share only; opaque, above the safe area, tucks on scroll down and returns on scroll up, shown while a keyboard focus is inside it. The footer takes its room.

## Deviations
- Text size opens an inline stepper above the bar (the sheet's own control and strings), so no new wording.
- The phone bar no longer has a Back link (the desktop rail is unchanged).

## Verification
- `npm run a11y:public-blog` (360/390/430, he and en, light and dark, about 25 s).
- Public matrix baseline updated (down only). `compare-wide.mjs` with `PAGES=blog`: identical bytes at 768 and 1280, he and en.
- Chromium here gives about one rAF per 40 s, so the check polls by hand.
