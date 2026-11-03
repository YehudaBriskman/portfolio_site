---
{
  "slug": "windom-1-5-computed-glass",
  "title": "WindoM 1.5: computed glass, and Gmail withdrawn",
  "subtitle": "Includes 1.5.1: signing in no longer signs you out",
  "excerpt": "The glass becomes real refraction, the Gmail widget is withdrawn for a licensing reason, windom.app is rebuilt, and 1.5.1 fixes a sign-in that undid itself.",
  "tags": ["windom", "release", "chrome-extension", "css"],
  "collection": "windom",
  "status": "published",
  "publishedAt": "2026-10-26T12:37:36Z",
  "readingMinutes": 2,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "Release v1.5.0", "url": "https://github.com/YehudaBriskman/WindoM/releases/tag/v1.5.0" },
    { "label": "Release v1.5.1", "url": "https://github.com/YehudaBriskman/WindoM/releases/tag/v1.5.1" }
  ],
  "sources": [
    { "label": "WindoM CHANGELOG, 1.5.0 and 1.5.1", "url": "https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md" },
    { "label": "Release v1.5.0", "url": "https://github.com/YehudaBriskman/WindoM/releases/tag/v1.5.0" },
    { "label": "Release v1.5.1", "url": "https://github.com/YehudaBriskman/WindoM/releases/tag/v1.5.1" }
  ]
}
---
1.5.0 and 1.5.1 shipped on the same day, so they share a note. 1.5.0 is the
visible one; 1.5.1 fixes what it exposed.

## The glass is computed now

The rim of every pane refracts the wallpaper behind it, following Snell's
law across a squircle profile, rather than approximating glass with blur and
tint. The highlight follows the pointer with a little weight behind it, so it
reads as light moving across an object rather than a texture stuck to the
cursor. The material is lighter overall: text stays legible because of a
ground underneath it, not because the pane is dimmed.

The redesign also unified the rest of the surface: one motion system across
every pane, with exits quicker than entries, and 25 different corner radii
reduced to 5 tokens. There is a separate note on how the glass works.

## Gmail is withdrawn

The Gmail widget is gone from the published extension. Keeping it would have
meant a paid third-party security assessment every year, because of the
permission it needs. The consent screen now asks only for sign-in and
Calendar. The code is still there behind a flag, off by default. There is a
separate note on this decision too.

## Panels behave like objects

The settings panel and sidebar lost their close buttons and the dimmed page
behind them. Each is anchored to a corner and opened from a visible button,
so they close by clicking outside, pressing Escape, or pressing the same
button again.

## windom.app is rebuilt

The site is now a working new tab rather than a page describing one: your
own clock and greeting, the bundled wallpapers crossfading through a day as
you scroll, and screenshots of the real extension instead of a feature grid.

## 1.5.1, the same afternoon

- **Signing in no longer signs you out.** A stale Calendar or Spotify grant
  was being treated as an expired session, which ended the session it was
  part of. Written up separately.
- **Connecting an app keeps the settings panel open.**
- **Spotify responds on the first press**, instead of showing the state from
  before the command for up to fifteen seconds.
- **Focus mode** now exits on a click or Escape, as the guide always said.
- **Releases confirm the store's answer.** The release job now submits the
  package explicitly and fails if the Chrome Web Store rejects it, instead of
  trusting an upload step that reports success either way.
