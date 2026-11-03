---
{
  "slug": "windom-1-1-settings-sync",
  "title": "WindoM 1.1: settings that follow you",
  "subtitle": "Preferences sync to your account, sessions stop dropping, and the backend gets its foundations",
  "excerpt": "WindoM 1.1 syncs preferences to your account, fixes several ways a signed-in user could be disconnected, adds a command palette, and lays down the backend's tests and structure.",
  "tags": ["windom", "release", "chrome-extension"],
  "collection": "windom",
  "status": "published",
  "publishedAt": "2026-04-04T12:00:00Z",
  "readingMinutes": 1,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "Changelog", "url": "https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md" }
  ],
  "sources": [
    { "label": "WindoM CHANGELOG, 1.1.0", "url": "https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md" },
    { "label": "Tag v1.1.0", "url": "https://github.com/YehudaBriskman/WindoM/tree/v1.1.0" }
  ]
}
---
WindoM 1.1 is about the account earning its place. If you sign in, your
setup now comes with you; if you do not, nothing changes.

## What changed for users

- **Settings sync.** Preferences are saved to your account and restored on
  another browser. When the copy on the server and the copy in the browser
  disagree at sign-in, the server's wins, and local settings are no longer
  lost in the process.
- **Sessions that last.** A rolling session window with a renewal cap
  replaces a fixed expiry, the refresh token survives a browser restart, and
  a silent sign-in now tells the rest of the page it happened. Together these
  fix users being disconnected from their account for no visible reason.
- **A command palette** in the search overlay, with suggestions and commands
  for managing tabs.
- **Spotify in the dock**, beside the quick links.
- **A custom select** that matches the glass design everywhere a native
  dropdown used to break it.
- **Faster first paint**, from an app loader, code splitting and lazy-loaded
  images.

## Under the hood

The backend gained its structure in this release: linting, formatting, a
Vitest suite, and a layered split into services, controllers and routes. The
settings endpoint now validates and filters what it accepts, OAuth callbacks
are rate limited, redirect URIs are checked early with readable errors, and
the extension's manifest drops host permissions it did not use.

Calendar and Spotify responses are cached with a time-to-live, and those
caches are cleared when a provider is disconnected, so a disconnect takes
effect straight away.
