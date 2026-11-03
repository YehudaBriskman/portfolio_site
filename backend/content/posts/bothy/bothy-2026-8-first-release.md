---
{
  "slug": "bothy-2026-8-first-release",
  "title": "Bothy 2026.8: the first release",
  "subtitle": "A console, local identity, a CLI, and CI that installs it from nothing",
  "excerpt": "The first tagged release of Bothy: a console discovered from Docker, local single sign-on with four roles, the bothy CLI, and an install with nothing to fill in.",
  "tags": ["bothy", "release", "self-hosting", "docker"],
  "collection": "bothy",
  "status": "published",
  "publishedAt": "2026-08-19T05:21:31Z",
  "readingMinutes": 1,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "Release v2026.8.1", "url": "https://github.com/YehudaBriskman/Bothy/releases/tag/v2026.8.1" }
  ],
  "sources": [
    { "label": "Bothy release v2026.8.1", "url": "https://github.com/YehudaBriskman/Bothy/releases/tag/v2026.8.1" },
    { "label": "Bothy README", "url": "https://github.com/YehudaBriskman/Bothy/blob/main/README.md" }
  ]
}
---
Bothy's first tagged release is v2026.8.1. Bothy is a console for one
machine: it shows what is running by asking Docker, never by reading a list
somebody remembered to update.

## Installing it

Clone, copy the example environment file, and run `just up`. There is
nothing to fill in first. The five credentials the stack uses are generated
on first start; the bootstrap step prints which keys it wrote, never their
values, and never touches a value you set yourself.

## What is in it

- **The console.** Overview, Control and Files, all discovered from Docker
  rather than configured. Five themes and a theme editor. A markdown reader
  with wikilinks, backlinks, images and code.
- **Identity.** A local Keycloak with four flat roles (`viewer`, `editor`,
  `operator` and `shell`), enforced at the edge. Nothing leaves the machine.
- **The `bothy` CLI.** `init`, `download`, `upgrade` and `version`, and it
  installs `just` for you.

## Tested the way it is installed

Every pull request clones the repository into an empty directory, runs the
same three install commands a user would, and then runs about 600 assertions
against the stack that came up. Nightly jobs install it at awkward paths and
prove an upgrade keeps your data.

## Versioning

Versions are `YYYY.M.PATCH`. The date answers the question people actually
ask about something they install, which is how old it is, and the format is
still valid semver. The `VERSION` file is the single source of truth, and a
check stops it falling behind the newest tag.

## Known gaps, stated up front

- There is no shell in the browser, on purpose. Container access stays on
  SSH.
- Diagrams in the reader render as code for now.
- The user guide is not written yet.
