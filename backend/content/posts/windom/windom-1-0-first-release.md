---
{
  "slug": "windom-1-0-first-release",
  "title": "WindoM 1.0: the new tab as a dashboard",
  "subtitle": "The first release: a working new-tab page, with an account that stays optional",
  "excerpt": "WindoM 1.0 replaces Chrome's empty new tab with a dashboard: clock, weather, tasks, calendar, music, quick links and a focus timer, with an optional account behind it.",
  "tags": ["windom", "release", "chrome-extension"],
  "collection": "windom",
  "status": "published",
  "publishedAt": "2026-03-19T12:00:00Z",
  "readingMinutes": 1,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "Changelog", "url": "https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md" }
  ],
  "sources": [
    { "label": "WindoM CHANGELOG, 1.0.0", "url": "https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md" },
    { "label": "Tag v1.0.0", "url": "https://github.com/YehudaBriskman/WindoM/tree/v1.0.0" }
  ]
}
---
WindoM 1.0 is the first release. It replaces the page Chrome opens on every new
tab with a dashboard, and it is built so that the first thing a person sees
works before they have signed up for anything.

## What is in it

- **The basics on one page.** A clock with a personalised greeting, a live
  weather widget, a to-do list kept on the device, daily quotes, quick links
  and a dock bar.
- **Backgrounds** from Unsplash or from your own images.
- **A focus mode** with a countdown timer, for the stretch of the day when the
  dashboard should get out of the way.
- **Search** from the page, through Google or DuckDuckGo.
- **Optional integrations.** Google Calendar and a Spotify now-playing widget,
  both off until you connect them.
- **A settings panel** with controls for each section.

## The account is optional

Everything above the integrations works without an account. Signing in adds
Google sign-in and the integrations, and the account system behind it uses
short-lived JWTs with refresh-token rotation. OAuth tokens from Google and
Spotify are encrypted at rest with AES-GCM.

## How it ships

The backend runs on Fly.io with PostgreSQL. GitHub Actions deploy the backend
and publish the extension automatically, so a release is a tag rather than a
checklist.
