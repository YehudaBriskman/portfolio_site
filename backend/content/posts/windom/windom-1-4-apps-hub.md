---
{
  "slug": "windom-1-4-apps-hub",
  "title": "WindoM 1.4: the Apps Hub, markets and a first-run guide",
  "subtitle": "Includes 1.3.5: settings restructured, and a sync conflict removed",
  "excerpt": "Integrations move into one Apps Hub, a finance dashboard arrives for stocks and crypto, and new users get templates, onboarding and a guide in English and Hebrew.",
  "tags": ["windom", "release", "chrome-extension"],
  "collection": "windom",
  "status": "published",
  "publishedAt": "2026-04-25T12:00:00Z",
  "readingMinutes": 2,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "Changelog", "url": "https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md" },
    { "label": "The guide", "url": "https://windom.app/guide" }
  ],
  "sources": [
    { "label": "WindoM CHANGELOG, 1.3.5 and 1.4.0", "url": "https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md" },
    { "label": "Tag v1.4.0", "url": "https://github.com/YehudaBriskman/WindoM/tree/v1.4.0" }
  ]
}
---
1.4 is the release where WindoM stopped being a set of widgets and started
being organised around what people actually connect. It also includes the
settings work from 1.3.5, which made most of it possible.

## One place for integrations

Calendar, Spotify, Finance, Gmail, History and Tasks are now icon-only cards
in an **Apps Hub**, and each opens into a shared App Center panel. Connecting
and disconnecting Google Calendar moved there too, out of account settings,
so every integration is managed the same way.

## Markets

A **finance dashboard** with separate Stocks and Crypto cards, each
scrollable, with ticker search and autocomplete and a toggle to show or hide
either card. Prices come from Yahoo Finance and CoinGecko. Getting them to
arrive reliably took several rounds of fixes, from symbol encoding to retry
fallbacks, all in this release.

## A better first five minutes

- **Six settings templates** to start from rather than a blank page.
- **An onboarding walkthrough** on first run, and a one-time prompt for
  existing users to connect Spotify.
- **A Help & Guide panel** in the app. The same guide is published at
  windom.app/guide, in English and Hebrew.

## Settings, restructured (1.3.5)

Settings moved from one flat object to named sections, with a migration for
existing users. Sync conflicts are now resolved per key with timestamps, so
a change made on one device no longer silently replaces an unrelated change
made on another. In 1.4, saving merges into what is stored rather than
replacing it, and loading fills in fields that were added after a user's last
save. Timer state that belongs to one device stays on that device.

## Also in this release

- Session IP addresses and user agents are hashed before they are stored.
- Provider responses from Google and Spotify are validated with Zod.
- The extension asks for a narrower Google host permission.
- Icon-only buttons have labels, and the search overlay traps focus.
- The backend deploy takes a database backup first and checks health after.
