# Deploy and release

Merging does not ship. `main` is continuously integrated and continuously
deployed to **preprod**; the live site moves only when somebody tags a release.

| Environment | Address | Runs | Moved by |
|---|---|---|---|
| preprod | https://preprod.yehudabriskman.com (private network only, `noindex`) | the latest `main` | every push to `main` |
| production | https://yehudabriskman.com | the latest release | a `v*` tag |

Both run on a single-node k3s cluster defined in
[oci-free](https://github.com/YehudaBriskman/oci-free).

## The pipeline (`.github/workflows/ci.yml`)

**On a pull request** CI classifies the changed paths and runs only the jobs
they need: `Static` always, then `Frontend`, `Backend` and `MCP server` as
touched, and a `Scan image` build of each touched image. The `CI gate` job
fails if any selected job failed. `Static` and `CI gate` are the required
checks on `main`.

**On a push to `main`** everything runs. Each image (`web`, `api`) is built
natively for `linux/arm64`, scanned with Trivy (critical findings always fail,
high ones fail where a fix exists), and only then pushed to GHCR with build
provenance and an SBOM attached. CI then records a **release manifest** for the
commit, the source sha plus both images by digest, and rolls preprod onto
those digests.

**On a `v*` tag** nothing is built. CI checks that the tagged commit is on
`main` and has a release manifest from a passing run, re-scans those exact
digests against today's vulnerability database, refuses a release older than
what production runs (unless asked to roll back), and rolls production onto
them.

```sh
git tag -a v1.2.0 -m "what changed"
git push origin v1.2.0
```

## How a rollout works

Both environments use the same `Deploy` job, parameterised on the ref:

1. A preflight that refuses a rollout the cluster is not configured to finish.
2. `kubectl set image` to the digest, never a tag, with the version and source
   commit written on as annotations.
3. Wait for the rollout, check the pods run those digests, and fetch the site
   through the cluster to prove it answers, not only that the rollout finished.
4. On failure, put back what ran before, and say why it stalled.

Each environment has its own narrowly scoped cluster credential that can roll
out `web` and `api` in its own namespace and nothing else. `:latest` in GHCR
means "the last release production runs" and moves only after a passing
production rollout.

## Other workflows

| Workflow | What it does |
|---|---|
| `CodeQL` | static analysis of the TypeScript in `web/` and `backend/` |
| `Deploy drift` | scheduled: how far each environment is behind `main`, and a re-scan of the running digests; deploys nothing |
| `Secret scan` | weekly full-history secret scan (new commits are scanned in `Static`) |
| `Dependabot supersede` | closes older Dependabot PRs once a newer one covers them |

## Rolling back

Run CI by hand from the older release's tag with `rollback: true`. Release
images, manifests and `v*` tags are never pruned, so every release stays
redeployable.

Background and measurements: [ci-optimization-plan.md](../ci-optimization-plan.md).
