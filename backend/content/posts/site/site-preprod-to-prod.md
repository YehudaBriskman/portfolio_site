---
{
  "slug": "site-preprod-to-prod",
  "title": "From a merge to production: preprod, a tag, and a credential per environment",
  "subtitle": "How a change reaches yehudabriskman.com, and why the deploy job for one environment cannot touch the other",
  "excerpt": "A merge to main deploys to preprod, and a version tag promotes the same image digests to production. Each environment now has its own cluster credential, and the deploy refuses one that reaches the other.",
  "tags": ["site", "deploy", "ci", "kubernetes"],
  "collection": "site",
  "status": "published",
  "publishedAt": "2026-11-04T11:45:42Z",
  "readingMinutes": 2,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "PR #326, a cluster credential per environment", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/326" }
  ],
  "sources": [
    { "label": "PR #326, a cluster credential per environment", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/326" },
    { "label": "PR #231, promote releases by digest", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/231" },
    { "label": "PR #214, roll back a partial rollout", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/214" },
    { "label": "oci-free, the cluster side", "url": "https://github.com/YehudaBriskman/oci-free" }
  ]
}
---
The site runs in two environments on the same small cluster: preprod at
`preprod.yehudabriskman.com` and production at `yehudabriskman.com`. They are
separate namespaces, each with its own database. This note is the path a
change takes from a merge to production, and the change in 1.2 that keeps
the two environments apart.

## The path

1. **A pull request** runs lint, types, tests and the build. Changed paths
   decide which jobs run, and one stable check gates the merge.
2. **A merge to `main`** builds one candidate per image, natively for arm64,
   scans it, pushes those exact bytes and records them in a release manifest
   stored beside the images. Preprod rolls out to those digests.
3. **A `v*` tag** on a commit that preprod already ran promotes the same
   digests to production. Nothing is rebuilt for a release; the tag is a name
   for images that have already passed every check.

Each rollout is followed by readiness and version checks inside the cluster.
If anything fails after the first change, both deployments are put back as
they were.

## One credential per environment

Until 1.2, both environments were deployed with one shared cluster
credential. That meant a preprod deploy job held a credential that could
change production. Now:

- **Each environment has its own credential**, held as a secret of the
  matching GitHub environment, so only that environment's job receives it.
- **The selection is explicit.** The job picks the credential by namespace
  in the shell, not with an expression that would silently fall through to
  the other environment's credential if one were empty.
- **The preprod job fails if it can see production's credential**, because
  that would mean the secret is shared at repository level.
- **The preflight refuses a credential that reaches the other namespace.**
  Before anything changes, it asks the cluster whether the credential can
  patch the other environment's deployment. A leftover shared credential or
  an admin one is caught there.

The cluster side, a role per namespace that can patch the two deployments by
name and nothing else, lives in the infrastructure repository.

## Readiness without port-forward

The readiness checks used to reach the pods through a port-forward. That
grant reached every pod in the namespace, on any port, including the
database. The checks now go through the cluster's service proxy, and the
role allows exactly two services, read-only. The checks are the same; only
the way in changed, and it is narrower.

## How it is tested

The deploy script has its own test suite with a fake cluster client. It
covers a credential for one namespace passing, a credential that reaches
the other namespace being refused in both directions, and a missing proxy
grant stopping the deploy before anything changes.
