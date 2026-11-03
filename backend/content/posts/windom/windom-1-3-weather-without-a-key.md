---
{
  "slug": "windom-1-3-weather-without-a-key",
  "title": "WindoM 1.3: weather without a key, and accounts you can recover",
  "subtitle": "Includes 1.2: account deletion, and fixes to calendar and Spotify",
  "excerpt": "Weather moves to Open-Meteo and needs no API key. Accounts gain email verification, password reset and deletion, and both OAuth flows move to PKCE.",
  "tags": ["windom", "release", "chrome-extension", "auth"],
  "collection": "windom",
  "status": "published",
  "publishedAt": "2026-04-16T18:43:43Z",
  "readingMinutes": 1,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "Release v1.3.3", "url": "https://github.com/YehudaBriskman/WindoM/releases/tag/v1.3.3" }
  ],
  "sources": [
    { "label": "WindoM CHANGELOG, 1.2.2 and 1.3.3", "url": "https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md" },
    { "label": "Release v1.3.3", "url": "https://github.com/YehudaBriskman/WindoM/releases/tag/v1.3.3" }
  ]
}
---
This note covers 1.2 and 1.3 together. 1.2 was a short release of account
controls and fixes; 1.3 is the one with something new to show.

## Weather with no setup

The weather widget now uses Open-Meteo, which needs no API key. Before this,
weather was one of the things a new user had to configure before it showed
anything. Now it works on first open, which is the standard the rest of the
dashboard is held to.

## Accounts you can manage

- **Email verification and password reset**, with redesigned emails and
  sign-in pages, and inline validation on the login form.
- **Profile management** inside the extension.
- **Account deletion** (from 1.2), behind a clearly marked danger zone in
  settings.

## Safer sign-in

Both the Google and Spotify OAuth flows now use PKCE. Spotify also supports
"bring your own app", for people who would rather connect through their own
developer credentials.

Alongside that, this release tightens rate limits on the endpoints most
likely to be guessed at, adds issuer and audience checks to tokens, always
marks the refresh cookie `Secure`, and answers a busy database with a clean
503 rather than an error page.

## Fixes worth knowing

- Settings changes push only the keys that changed, so editing one section
  no longer overwrites another.
- Spotify reports clearly when no device is active, stops its progress
  ticker when a track ends, and keeps the player from shifting the dock.
- Calendar responses with empty items no longer break the list.

## Quality

The extension now builds under ESLint and a strict TypeScript configuration
in CI, and an end-to-end journey suite of 50 assertions in 10 groups covers
the main paths through the product.
