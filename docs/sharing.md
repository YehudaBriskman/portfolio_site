# Sharing and Announce

Two halves of one feature. Neither calls a platform API or loads a third-party
script: a share is a link the reader's own click opens, and the owner's kit is
text to copy.

## What a visitor gets

A Share menu (`web/src/components/share/ShareMenu.tsx`, logic in
`web/src/lib/share/`) on posts, notes, projects, areas, the story and the home
page. Nothing leaves the page until an item is chosen. Third parties are
opened only by that click, from a plain link in a new tab; no SDK, pixel or
cookie is added, and the site does not learn whether anyone shared.

| Channel | What happens | Limit |
|---|---|---|
| native | the device's own share sheet, on touch devices only | none |
| copy | the page address is copied | none |
| LinkedIn | opens `share-offsite` with the address | 3000 characters |
| Email | `mailto:` in the reader's mail app | none |
| Gmail | opens a Gmail compose window | none |
| X | opens the post intent, address and text as separate parameters | 280, a link counts as 23 |
| WhatsApp | opens `wa.me` with the text | none |
| Instagram | saves the share card and copies the caption | 2200 |

Two channels cannot do what the others do. LinkedIn's dialog reads only the
URL, so it cannot be pre-filled with text: the caption is copied to the
clipboard as the item is chosen, and the reader pastes it. Instagram has no web
intent at all, so the item saves the card image and copies the caption; it is
listed only for kinds that have a card (posts, notes, projects).

Captions come from templates with `{title} {summary} {url} {tags} {version}
{site}`, in English or Hebrew by the page's language. Text is plain, never HTML,
and is cut to the channel's limit without splitting a link. The address is the
site origin plus the entity's own path, never user input.

### UTM tag

Shared links may carry `utm_source=<source>&utm_medium=<channel>`. It is on by
default and optional: `utm.enabled` turns it off, `utm.source` renames it.

## Settings reference

`/admin/settings`, group `sharing`. It is part of the public settings object
(`/api/settings` serves it whole), so nothing owner-only goes in it.

| Key | Meaning |
|---|---|
| `enabled` | the whole visitor menu; false hides it everywhere |
| `surfaces` | which of `post note project area story home` show the menu |
| `channels` | which of `native copy linkedin email gmail x whatsapp instagram` are listed |
| `utm.enabled`, `utm.source` | the tag above; source is `[a-z0-9_-]`, 40 characters |
| `templates.en`, `templates.he` | per-channel caption overrides, up to 1000 characters, markup refused; empty means the built-in default |

A saved settings document with no `sharing` group reads as the defaults, so
old data keeps working. **Rollback:** set `sharing.enabled` to false and the
menu disappears; no deploy needed.

## Share cards

`GET /api/seo/og/{blog|projects}/<slug>.png`, with `?format=og` (1200x630, the
default), `square` (1080x1080) or `story` (1080x1920), and `?lang=he` for a
Hebrew card. Hebrew cards use Heebo Bold, bundled under
`backend/src/assets/fonts/` (SIL OFL 1.1, licence text beside it, details in
that folder's README). The renderer loads only those files, never system fonts.

## Announce (the owner's side)

`/admin/announce`, API under `/api/admin/announce`, behind `requireAdmin` and
audited like the rest of admin. Its settings live in their own document, never
in the public settings.

**Events.** A post going from not-published to published records a `post`
event. After each releases refresh, a tag not seen before records a `release`
event. Each event has a stable id, so a republish or a repeated refresh never
records it twice. Open an event to get a kit per channel (LinkedIn, Instagram,
email, Gmail, X) in English and, where the post has one, Hebrew, with
character counts; mark a channel done, mark read, or dismiss.

**Silent first run.** The first releases refresh after this feature is
deployed only records the tags that already exist (`seededAt` in the state
document), so the whole release history is not announced.

**Nothing sends itself.** The inbox posts to no platform. The only automatic
action is the optional owner email: `email.enabled` (off by default) and
`email.events`. It is one mail per event, sent through the contact service to
its one configured recipient (the contact address, `CONTACT_TO`), with no
`replyTo`, so the service sends nobody an auto-reply. A failed mail is logged
and never blocks a publish.

| Key | Meaning |
|---|---|
| `enabled` | false stops new events being recorded; the inbox stays readable |
| `email` | the owner email, above |
| `hashtags`, `signature` | appended to captions |
| `channels` | which kits are shown |
| `templates.en`, `templates.he` | per-channel overrides, up to 2000 characters |

**Rollback.** `announce.enabled` false stops recording; `email.enabled` false
stops the mail. Both are saved from the Announce page.
