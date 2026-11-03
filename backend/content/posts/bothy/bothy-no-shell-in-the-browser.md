---
{
  "slug": "bothy-no-shell-in-the-browser",
  "title": "Why Bothy has no shell in the browser",
  "subtitle": "Three verbs, written down where they cannot drift",
  "excerpt": "Bothy can restart, stop and start a container, and nothing else. The missing exec is a deliberate regression, and the limit is enforced in places a later change cannot quietly widen.",
  "tags": ["bothy", "security", "docker", "testing"],
  "collection": "bothy",
  "status": "published",
  "publishedAt": "2026-11-02T09:40:00Z",
  "readingMinutes": 2,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "Bothy guide, Roles", "url": "https://github.com/YehudaBriskman/Bothy/blob/main/docs/guide/roles.md" }
  ],
  "sources": [
    { "label": "Bothy README, What you get", "url": "https://github.com/YehudaBriskman/Bothy/blob/main/README.md" },
    { "label": "Bothy release v2026.8.1, Known gaps", "url": "https://github.com/YehudaBriskman/Bothy/releases/tag/v2026.8.1" },
    { "label": "Bothy guide, Roles", "url": "https://github.com/YehudaBriskman/Bothy/blob/main/docs/guide/roles.md" },
    { "label": "Bothy PR #125, what a browser shell would cost", "url": "https://github.com/YehudaBriskman/Bothy/pull/125" },
    { "label": "Bothy PR #142, a plan for a browser shell and a second factor", "url": "https://github.com/YehudaBriskman/Bothy/pull/142" }
  ]
}
---
Bothy's Control page can do three things to a container: restart it, stop
it, and start it. There is no shell in the browser, no kill, no create, no
removal, and no image, volume or network management.

Before Bothy, the same machine ran Portainer, which offered all of that. It
was removed. Measured against Portainer, Bothy is a step backwards, and the
step was taken on purpose.

## Why exec is the line

`docker exec` is effectively root on the machine. A browser terminal is a
convenient way to hand that to anyone who can reach a web page and hold the
right session. For a console that is meant to be left open on a tab all day,
that is the wrong default. Container access stays where it already was, on
SSH.

## Making the limit hard to erode

A limit like this rarely disappears in one decision. It erodes through small,
reasonable-looking changes: a new handler, a widened permission, a default
nobody re-read. So the three verbs are written down in places designed to
resist that.

- **The socket proxies say no explicitly.** Exec is switched off by an
  explicit setting on every Docker socket proxy, rather than left to a
  default that a future version could change.
- **The verb list is a literal.** The allowed actions are a fixed
  three-element tuple in the operations service. It is never derived from
  whichever handlers happen to exist, so adding a handler does not add a
  verb.
- **A check asserts both.** CI fails if either the proxy setting or the
  tuple changes.

## Roles that cannot add up to a shell

Bothy's identity layer has four roles: `viewer`, `editor`, `operator` and
`shell`. They are flat and deliberately non-composite. `shell` means an
arbitrary terminal, so it must never be reachable by holding some
combination of the other three. Today nobody holds it, and no route requires it.

## Deciding before building

The first release listed the missing shell as a known gap rather than hiding
it. Before any terminal capability exists, the project's security document
already sets out what one would cost, and a separate design plan describes
what would have to sit in front of it, including a second factor.

Writing that argument before there is code to defend is the point. Once a
feature exists, the discussion tends to be about how to secure it. Before it
exists, the discussion can still be about whether it should.
