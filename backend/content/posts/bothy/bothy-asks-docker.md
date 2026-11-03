---
{
  "slug": "bothy-asks-docker",
  "title": "Bothy asks Docker what is running",
  "subtitle": "Why the console has no list of services, and what it does instead",
  "excerpt": "A console for one machine is usually a hand-written list, wrong from the first container that moves. Bothy has no list: it joins two read-only APIs and classifies what it finds.",
  "tags": ["bothy", "docker", "self-hosting"],
  "collection": "bothy",
  "status": "published",
  "publishedAt": "2026-11-02T09:30:00Z",
  "readingMinutes": 3,
  "featured": 3,
  "coverImage": null,
  "links": [
    { "label": "Bothy on GitHub", "url": "https://github.com/YehudaBriskman/Bothy" }
  ],
  "sources": [
    { "label": "Bothy README, The three ideas worth stealing", "url": "https://github.com/YehudaBriskman/Bothy/blob/main/README.md" },
    { "label": "Bothy guide, Declaring a project", "url": "https://github.com/YehudaBriskman/Bothy/blob/main/docs/guide/projects.md" },
    { "label": "Bothy PR #237, Done and Dormant statuses", "url": "https://github.com/YehudaBriskman/Bothy/pull/237" },
    { "label": "Bothy PR #245, disk usage off the ten-second loop", "url": "https://github.com/YehudaBriskman/Bothy/pull/245" }
  ]
}
---
Most dashboards for a single machine start as a list. Someone writes down the
services, their ports and their links, and the dashboard renders the list.
It is correct on the day it is written. After that, every container that
moves, gets renamed or is added makes it a little more wrong, and nobody
notices until the moment they need it to be right.

Bothy has no list. The test for the whole idea is simple: **start any
container and it appears in the console within ten seconds, with no edit to
Bothy.** Stop it, and its status turns red just as fast.

## Two read-only sources, joined

The console is built by joining two APIs, both read-only and both proxied
under Bothy's own origin, so the browser never makes a cross-origin call.

- **Traefik's API** gives every route and the service behind it.
- **A read-only Docker socket proxy** gives ports, health, images, Compose
  labels and per-volume disk use.

Traefik is the skeleton and Docker is the enrichment. Either one can fail and
the page still renders with what the other one knows. That is the design,
not a nicety: a console that goes blank when one of its sources hiccups is
least useful exactly when something is wrong.

## Classification without a lookup table

Discovering containers is half the job; the other half is grouping them
sensibly. Bothy does that without a table of names anywhere in the code.

Docker Compose already labels every container with the files it came from.
That label is enough to say whether a container belongs to Bothy's own
stack or to a project on the machine. Optional labels can add an icon, a
description or a display name, but they are only refinements. The rule the
code is held to: if the page ever *needs* a label to be correct, the
defaults are wrong.

## Knowing what is off

Asking Docker has one blind spot. Docker only knows about containers that
exist, so a project that is switched off simply disappears, and absent looks
the same as never installed.

So a project can declare itself in a small file in its own repository. A
collector turns those declarations into a list the console reads alongside
Docker, which lets a stopped project read as *off* rather than missing, and
lets a project made of host processes show up at all. The statuses grew
with use: a one-shot job that finished is *Done*, and a project nobody runs
any more is *Dormant*, rather than both looking like failures.

This is the one place a declaration exists, and it lives with the project,
not in Bothy. Bothy still has no list of its own.

## What it costs

Discovery is not free. Every refresh asks two APIs and joins the results, and
some measurements are too expensive to repeat every ten seconds. Disk usage
was one of them. Its cost grew with the number of images and volumes until
it kept the Docker daemon busy enough to slow unrelated health checks, so it
now runs every two minutes and the last answer is reused in between. Disk
usage changes when something is built, pulled or deleted, not every ten
seconds. The trade is still a good one. A list costs
nothing to read, but it costs someone's attention every time the machine
changes, and that cost never stops.
