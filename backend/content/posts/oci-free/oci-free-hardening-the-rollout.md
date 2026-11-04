---
{
  "slug": "oci-free-hardening-the-rollout",
  "title": "Two replicas, CI-owned images and CI for the infrastructure itself",
  "subtitle": "Zero-downtime rollouts on one node, manifests that cannot undo a deploy, a credential per environment, and checks on every change to the repository",
  "excerpt": "The site now runs two replicas of each service with rollouts that never drop to zero. The manifests no longer name an image, so applying them cannot revert CI, and the infrastructure repository gained its own CI before it went public.",
  "tags": ["infrastructure", "kubernetes", "ci", "security"],
  "collection": "oci-free",
  "status": "published",
  "publishedAt": "2026-11-04T11:47:36Z",
  "readingMinutes": 2,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "PR #42, two replicas and a PDB", "url": "https://github.com/YehudaBriskman/oci-free/pull/42" },
    { "label": "PR #46, CI and tests", "url": "https://github.com/YehudaBriskman/oci-free/pull/46" }
  ],
  "sources": [
    { "label": "oci-free PR #42", "url": "https://github.com/YehudaBriskman/oci-free/pull/42" },
    { "label": "oci-free PR #43", "url": "https://github.com/YehudaBriskman/oci-free/pull/43" },
    { "label": "oci-free PR #44", "url": "https://github.com/YehudaBriskman/oci-free/pull/44" },
    { "label": "oci-free PR #46", "url": "https://github.com/YehudaBriskman/oci-free/pull/46" }
  ]
}
---
A rollout on a single replica has a gap in it: the old pod stops, the new
one starts, and for a moment nothing answers. A set of changes on the same
day closed that gap and a few quieter ones.

## Two replicas, and rollouts that never reach zero

Both `web` and `api` run two replicas. A rollout adds a new pod before it
removes an old one, so at least two are always serving, and a
PodDisruptionBudget keeps at least one up during maintenance.

The API also gained a readiness probe. Without one, "wait until the new pod
is ready" would have waited on nothing. The probe checks the process, not
the database, so a database outage does not take every API pod out of
service; the parts that work without the store keep working.

Running two copies needed a check first: is the API stateless? It was
audited piece by piece. Content, media and sign-in state live in CouchDB,
caches refill themselves, and the scheduled jobs are safe to run twice. The
one real cost is that rate limits are counted per pod, so a client spread
across both can get up to twice each limit. That is accepted and written
down, with the fix named if it ever matters.

## Manifests that cannot undo a deploy

The manifests for `web` and `api` no longer contain an `image` field. CI is
the only writer of the image, setting it by digest from the site's release
manifest.

A pinned digest in the file would not have worked: applying the file
compares it with the live object, so whatever the file says wins over what
CI set, and the file is stale after the next release. Leaving the field out
is the only static file that a plain apply cannot use to roll production
back.

## A credential per environment

The deploy role was split per namespace, so the credential for preprod
cannot change production and the reverse. The readiness checks moved from
port-forwarding, which reached every pod on any port, to the service proxy,
limited to the two services and to reads.

## CI for the infrastructure repository

The repository had no CI at all. It now runs on every pull request, in the
same style as the site's: actions pinned by SHA, one gate, and path filters.

- **gitleaks** over the commits a change adds, and a weekly full-history
  scan.
- **shellcheck** over every script.
- **kubeconform** in strict mode over the manifests, with pinned schemas.
- **Helm rendering** of each values file at pinned chart versions.
- **OpenTofu** formatting and validation against the locked provider.
- **An end-to-end test** of the telemetry pipeline's configuration.

With those checks in place, the repository was made public.
