# Public pages, direction A: contact, forms, subscribe pages, 404, privacy, footer

Phones under 640px only (390 wide here). Tablet and desktop are unchanged
(`scripts/a11y/compare-wide.mjs`). `before/` is main, `after/` is this branch,
light and dark, English and Hebrew. The unsubscribe and confirm "before" shots
were taken without a token, so they show the invalid-link state; "after" shows
the same pages with a token.

What changed: the home Contact ask is one card with a full-width pill; the
contact form's three fields are one continuous card; the status line, topics
and language choices on the subscribe pages are cards; the 404 path is a card
and the ways onward stack; Privacy's way back is a grouped row; each footer
column is one inset group. No wording changed, no new strings.
