---
{
  "slug": "bothy-2026-9-five-services",
  "title": "Bothy 2026.9: five services, a cluster console, and a guide",
  "subtitle": "Fewer containers, new metrics storage, a written guide, and releases that tag themselves",
  "excerpt": "Bothy goes from eight containers to five, gains a Kubernetes console with 29 audited actions, moves to VictoriaMetrics and Alloy, and ships a guide for people who have not read the source.",
  "tags": ["bothy", "release", "self-hosting", "observability"],
  "collection": "bothy",
  "status": "published",
  "publishedAt": "2026-09-18T21:03:28Z",
  "readingMinutes": 2,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "Release v2026.9.0", "url": "https://github.com/YehudaBriskman/Bothy/releases/tag/v2026.9.0" },
    { "label": "The guide", "url": "https://github.com/YehudaBriskman/Bothy/blob/main/docs/guide/index.md" }
  ],
  "sources": [
    { "label": "Bothy release v2026.9.0", "url": "https://github.com/YehudaBriskman/Bothy/releases/tag/v2026.9.0" },
    { "label": "Bothy PR #176, the reorganisation", "url": "https://github.com/YehudaBriskman/Bothy/pull/176" },
    { "label": "Bothy PR #181, CI-gated tagging", "url": "https://github.com/YehudaBriskman/Bothy/pull/181" },
    { "label": "Bothy PR #117, the installer", "url": "https://github.com/YehudaBriskman/Bothy/pull/117" }
  ]
}
---
v2026.9.0 is a reorganisation. Bothy's own footprint got smaller while the
console learned to do more, and the project gained the documentation it was
missing in the first release.

## Eight containers become five

Bothy now runs as five containers: the web front end, a file service that
also owns the configuration forms, an operations service, and two Docker
socket proxies, one read-only and one for the three container actions. The
Python the services shared moved into one common library, replacing about
470 duplicated lines, and the single sign-on gates are defined in one file.

## A console for the cluster

A new cluster page covers topology, workloads, pods, jobs, configuration,
networking, storage, events and metrics. It offers 29 audited actions, such as
rollback, pause and resume, and changing an image. Those actions are declared
in one catalogue file. The edge routes, the permissions and the interface are
all generated from it, and CI fails if any of them are out of date.

## New metrics storage

VictoriaMetrics replaces Prometheus, with 15 days of history imported and
Prometheus kept available as a rollback. Grafana Alloy replaces Promtail,
which has reached end of life. A parity check compares every query and alert
across both backends before the switch.

## Settings, rebuilt

Settings is now one area with 12 sections and a search. Operators can see
users, credential and backup metadata, and the audit log. The credential view
shows metadata computed on the host, never values, and a test proves that no
value bytes reach the response.

## Documentation and the reader

- **A user guide**, written for people who have not read the source:
  installing, configuring, roles, themes, backups, upgrading and
  troubleshooting.
- The reader now renders diagrams and other media, closing one of the gaps
  listed in the first release.

## Installing and releasing

- **An installer** that clones a pinned release, verifies the commit
  against a value baked into the script, and then stops and tells you the
  next command rather than running it.
- **`bothy self-update`**, because `upgrade` updates the box and not the
  tool.
- **Releases tag themselves.** After CI passes on `main`, a workflow tags
  that exact commit and publishes release notes. A commit whose CI failed is
  never tagged.
