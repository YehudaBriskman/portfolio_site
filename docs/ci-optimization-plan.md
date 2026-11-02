# CI: job inventory and measured baseline

**A reference doc, not a task list.** The work is tracked in GitHub issues:
#207 is the tracking issue, and this file arrived with #202 (P1). It records
what the `CI` workflow (`.github/workflows/ci.yml`) runs, and what it measured
before P1 changed it, so later changes are compared with numbers rather than
with memory.

**The repository has been public since 2026-11-02.** Standard GitHub-hosted
runner minutes are free for public repositories, so nothing here is a billing
saving. The goals are latency (how long until a pull request has an answer),
redundancy (work done twice, or done for a commit nobody will use) and
keeping every check. No saving is claimed below that was not measured.

---

## 1. Job inventory

### Before P1 (main at `f9ef3b6`)

| Job (check name) | Runs on | Needs | Timeout |
|---|---|---|---|
| Preflight | every event | - | none (6 h default) |
| Frontend | every event | Preflight | none |
| Backend | every event | Preflight | none |
| Dockerfiles (web), Dockerfiles (backend) | every event | Preflight | none |
| Compose files parse | every event | Preflight | none |
| Scan image (web, web), Scan image (api, backend) | every event | Dockerfiles | none |
| Publish image (web, web), Publish image (api, backend) | main, `v*` tags | Frontend, Backend, Dockerfiles, Compose, Scan | none |
| Deploy | main, `v*` tags | Publish image | none |

No workflow-level `concurrency`: a second push to a pull request left the
first run going. Deploy had (and keeps) its own group,
`deploy-<prod|preprod>`, with `cancel-in-progress: false`.

### After P1

| Job (check name) | Runs on | Needs | Timeout (min) |
|---|---|---|---|
| Static | every event | - | 10 |
| Frontend | every event | - | 15 |
| Backend | every event | - | 10 |
| Scan image (web, web), Scan image (api, backend) | every event | Static | 20 |
| Publish image (web, web), Publish image (api, backend) | main, `v*` tags | Static, Frontend, Backend, Scan | 45 |
| Deploy | main, `v*` tags | Publish image | 30 |

**Static** holds every check that needs only the source, as steps:

- the supersede-select tests (`node --test .github/scripts/supersede-select.test.mjs`, #213);
- every file the build assumes is present;
- every nginx location that sets a header keeps the security headers;
- hadolint on `web/Dockerfile` and on `backend/Dockerfile` (`failure-threshold: error`, as before);
- `docker compose config` on the base file, the CI file and the base + dev overlay;
- actionlint 1.7.12 (release tarball checked against its published sha256);
- zizmor 1.31.1 (pinned on PyPI), over the workflows and `dependabot.yml`.

Each step after the checkout runs unless the job was cancelled, so one failing
assertion does not hide the next, as separate jobs did not.

**Ordering.** Frontend and Backend start at once rather than after Static: the
old Preflight was ~10 s and cost the critical path almost nothing, whereas
Static with hadolint and the workflow lint would sit in front of the longest
job. Nothing is published without Static, since Scan and Publish image need it.

**Cancellation.** One workflow-level group:
`ci-pr-<number>` for a pull request, with `cancel-in-progress: true`, and
`ci-run-<run id>` for everything else, with `cancel-in-progress: false`. A run
id is unique, so a main push, a tag or a manual run never shares a group, and
therefore is never queued behind or cancelled by another run. (A shared group
would not be safe even without cancel-in-progress: a group holds one pending
run, and a third arrival cancels the one that was waiting.) Deploy never runs
on a pull request, and its per-environment group is unchanged.

**Timeouts** are several times the slowest observed run (section 2), with
extra margin where a cold cache is known to be slower than anything sampled:
Publish image rebuilds the arm64 leg under emulation on a cache miss, and
Deploy is sized from the waits written into it (a minute for a path to the
node, 300 s per rollout, 180 s per undo), not from its usual duration.

### Required checks

The ruleset "main: CI must pass" requires names that P1 removes (`Preflight`,
`Dockerfiles (web)`, `Dockerfiles (backend)`, `Compose files parse`). The new
set to require is `Static`, `Frontend`, `Backend`, `Scan image (web, web)`,
`Scan image (api, backend)`. The ruleset is an external setting and is
changed by the owner, not by a workflow change.

### After P2 (#203)

Two jobs are added, and three become conditional on pull requests:

| Job (check name) | Runs on | Needs | Timeout (min) |
|---|---|---|---|
| Classify changes | every event | - | 5 |
| Static | every event | - | 10 |
| Frontend | web selected | Classify | 15 |
| Backend | backend selected | Classify | 10 |
| Scan image (web, web), Scan image (api, backend) | a leg per selected image | Static, Classify | 20 |
| Publish image, Deploy | main, `v*` tags (unchanged) | as before | 45, 30 |
| CI gate | always | every job above | 5 |

**Classification** (`.github/scripts/ci-classify.mjs`, table tests in
`ci-classify.test.mjs`) diffs a pull request from the merge-base to its head,
and a push from `before` to `after`, with local git over full history, never
the API's capped file list. `web/**` selects Frontend and the web scan,
`backend/**` Backend and the api scan, `docs/**` and root `*.md` nothing
beyond Static. Workflows and CI scripts, lockfiles and manifests,
Dockerfiles and `.dockerignore`, nginx config, Compose, the Makefile,
tsconfig, eslint config, the Trivy ignore file and any path no rule names
select everything; so do a missing `before`, a force push, missing history,
a diff error, an empty diff and every event other than a pull request or a
push. Renames and copies count both paths, deletions their old path.

**Main and `v*` tags select everything.** Deploy sets both Deployments to the
commit's sha, so an api-only merge still needs a web image. The push diff is
computed and shown in the job summary, but only pull requests are narrowed
until digest reuse (P4, #205).

**CI gate** (`.github/scripts/ci-gate.mjs`, tests in `ci-gate.test.mjs`)
runs with `if: always()` and needs every job. It passes only when
classification succeeded, every selected job succeeded, and every skipped
job was one classification did not select. A failure, a cancellation, an
unexplained skip or a failed classification fails it. Static runs both test
files on every change, docs-only included.

**Required checks after P2:** `Static` and `CI gate`. Frontend, Backend and
the Scan legs can now be skipped on purpose, so they must not be required:
a skipped leg reports as `Scan image` rather than under its own name, and a
required check that never reports blocks the merge.

### After P3 (#204)

| Job (check name) | Runs on | Runner | Needs | Timeout (min) |
|---|---|---|---|---|
| Scan image (web, web), Scan image (api, backend) | a leg per selected image | `ubuntu-24.04-arm` | Static, Classify | 20 |
| Publish image (web), Publish image (api) | main, `v*` tags | `ubuntu-24.04-arm` | Static, Frontend, Backend, Scan | 15 |

Everything else is as after P2, and the required checks are unchanged
(`Static`, `CI gate`).

**One candidate per component.** Scan image builds each selected image once,
natively for `linux/arm64`, into a docker-archive
(`outputs: type=docker,dest=…`), and Trivy scans that archive with the same
policy as before: every CRITICAL whether or not a fix exists, HIGH where a
fix exists, `.trivyignore.yaml` for reviewed exceptions. A scanner or
database error exits non-zero and fails the leg. On main and tags the
archive is uploaded as an artifact (one day's retention) and Publish image
pushes it; nothing is built twice and nothing runs under QEMU.

**Digest identity** (`.github/scripts/candidate.sh`, tested against a fake
`docker` in Static by `candidate.test.sh`). The scan leg records the image
ID (the config digest, which names every layer by its uncompressed digest)
and the archive's sha256 as job outputs. Publish image refuses an archive
that does not hash to the recorded sha256, loads and pushes it, reads the
manifest back from GHCR, and fails unless its config digest equals the
scanned image ID. The log prints the scanned image ID, the pushed manifest
digest and the pushed image ID. The manifest digest is what the cluster
pulls; it differs from BuildKit's own because `docker push` recompresses
the layers, which is why the assertion is on the config digest.

**Permissions.** Scan image has `contents: read` only, on every event; a
pull request builds and scans, uploads nothing and pushes nothing. Publish
image alone has `packages: write`, and runs only on main and `v*` tags.

**Cache.** BuildKit's `gha` cache, one scope per component and platform:
`web-arm64`, `api-arm64` (`mode=max`). The old `web` and `api` scopes are
no longer read or written. A pull request's cache writes land in its own
ref's scope, which main never reads.

**amd64 is no longer built.** Consumers checked on 2026-11-02:

- the cluster (oci-free `k8s/portfolio.yaml`, `k8s/portfolio-preprod.yaml`)
  runs on one arm64 node (Ampere A1) and pulls `web`/`api` from GHCR;
- oci-free's `deploy-portfolio.sh` is retired (it built on the node);
- `docker-compose.ci.yml` names the GHCR images, but nothing runs it (no
  Makefile target, no workflow, no script in either repository), and the
  packages are private;
- no other file in this repository, oci-free or `~/stacks` names the images.

Nothing consumes amd64, so no manual multi-arch path was kept. An amd64
host runs the site from source with `docker-compose.yml`.

### After P4 (#205)

| Job (check name) | Runs on | Runner | Needs | Timeout (min) |
|---|---|---|---|---|
| Publish image (web), Publish image (api) | main, a rebuild from a tag | `ubuntu-24.04-arm` | Classify, Static, Frontend, Backend, Scan | 15 |
| Release manifest | main, a rebuild from a tag | `ubuntu-latest` | Classify, Scan, Publish | 10 |
| Promote release | `v*` tag (push, or a run from the tag) | `ubuntu-latest` | Classify, Static, Release manifest | 20 |
| Deploy | main → preprod, tag → prod | `ubuntu-latest` | Classify, Release manifest, Promote | 30 |

The required checks are unchanged (`Static`, `CI gate`); the gate now
also needs Release manifest and Promote release.

**Modes** (Classify's `mode` output, with the commit it resolved once as
`sha`): `pr`, `main`, `promote` (a `v*` tag push, or a run from the tag),
`rebuild` (a run from a tag with `rebuild: true`), `other`. A tag push
selects Static, Promote and Deploy only: **a tag builds nothing.**

**The release manifest** (`.github/scripts/release.sh`, tested in Static by
`release.test.sh`). Main CI writes one per commit: source sha, each image as
`ghcr.io/yehudabriskman/portfolio_site/<image>@sha256:…` with its image ID,
the build inputs (context git tree, Dockerfile, lockfile, base image
digests, build argument), tool versions, platform, the scan result with
the Trivy DB timestamp, and the run id and attempt. It is stored as an OCI
artifact at `ghcr.io/yehudabriskman/portfolio_site/manifest:<sha>` (pushed
with a pinned, checksum-verified oras), read back and compared after the
push. A run artifact `release-manifest` (30 days) is a convenience only.

**Promotion.** The tag's commit must be on main; the manifest for exactly
that commit must exist; the run it names must be this repository's CI on
main for that commit, with Static, Frontend, Backend, both Scan legs, both
Publish legs and Release manifest green in that attempt. Then both digests
are re-scanned against the current database with the same policy, and the
tag is added to the images and the manifest as aliases. No manifest stops
the release; `rebuild: true` is the only path past it.

**Deploy** rolls out the manifest's digests (never a tag), annotates the
source sha, and checks that both Deployments and every pod's `imageID`
carry them. Inside the deploy lock, `deploy.sh guard` decides first:
preprod skips with a notice when a newer main commit already has a
manifest; prod refuses a release older than the running one unless the run
was started with `rollback: true`. `:latest` moves only after a passing prod
deploy.

**Retention.** Release images, manifests and `v*` tags, and any digest a
manifest references, are never pruned. Checked 2026-11-03: no workflow in
this repository deletes package versions. Anything added later that prunes
GHCR must skip all three.

**Left out: unchanged-component reuse.** Both images are still built on
every main commit. Reusing an unchanged image's digest needs a proof that
every input is identical (context tree, base image digests, build args,
toolchain), which the evidence now records but nothing yet compares.

---

## 2. Baseline

**Window:** the last 20 completed `push` runs on `main`
(2026-11-02 12:06 to 18:41 UTC) and the last 20 completed `pull_request`
runs (2026-11-02 12:29 to 18:48 UTC), taken from `gh run view --json jobs`.
All forty fall on one day, the day the repository went public, with a warm
Actions cache throughout; it is not a sample of cold-cache behaviour, and
forty runs support a median, not a p95. The only tag run so far (`v1.0.0`,
10:57 UTC the same day) falls outside the window and is not included.

Definitions:

- *Wall clock*: run created to the last executed job's completion.
- *Critical path*: the longest chain of job durations along `needs`
  (Preflight, then the longest of Frontend / Backend / Compose /
  Dockerfiles + Scan, then Publish image, then Deploy).
- *Rounded minutes*: each executed job's duration rounded up to a whole
  minute and summed, the way per-job minutes are counted. Informational
  only, since public-repository minutes are free.
- Queue time before the first job started was ~3 s (median) in both sets.

Runs that failed at Preflight executed one job and are counted in the
totals: 1 of 20 on main, 2 of 20 on pull requests.

### Per run (minutes)

| | main push (n=20) | pull request (n=20) |
|---|---|---|
| Wall clock, median | 5.9 | 2.9 |
| Wall clock, slowest | 9.4 | 4.2 |
| Critical path, median | 5.6 | 2.7 |
| Critical path, slowest | 9.2 | 3.9 |
| Sum of job durations, median | 9.9 | 6.4 |
| Rounded minutes, median | 17 | 12 |
| Rounded minutes, slowest | 22 | 13 |
| Jobs executed (full run) | 11 | 8 |
| Image builds (full run) | 4: two amd64 scan builds, two amd64+arm64 publish builds | 2: two amd64 scan builds |

The last job to finish was Deploy on main (19 of 20) and Frontend on pull
requests (18 of 20); the rest stopped at Preflight.

### Per job (minutes, completed runs only)

| Job | main median | main slowest | PR median | PR slowest |
|---|---|---|---|---|
| Preflight | 0.15 | 0.60 | 0.16 | 0.48 |
| Frontend | 2.40 | 4.18 | 2.59 | 3.77 |
| Backend | 0.38 | 1.68 | 0.38 | 0.95 |
| Dockerfiles (web) | 0.25 | 0.55 | 0.26 | 0.42 |
| Dockerfiles (backend) | 0.28 | 0.47 | 0.27 | 0.82 |
| Compose files parse | 0.15 | 0.45 | 0.16 | 0.67 |
| Scan image (web, web) | 1.32 | 3.60 | 1.28 | 1.82 |
| Scan image (api, backend) | 1.17 | 1.95 | 1.09 | 1.58 |
| Publish image (web, web) | 2.12 | 4.17 | - | - |
| Publish image (api, backend) | 0.63 | 1.60 | - | - |
| Deploy | 0.62 | 1.93 | - | - |

Four of the eleven jobs (Preflight, two Dockerfiles legs, Compose) each ran
for well under a minute; together their median is ~0.8 min of work spread
over four runners, which is what Static consolidates.

### Redundancy visible in the baseline (not addressed by P1)

- A main push builds each image twice: once amd64-only to scan, once
  amd64+arm64 to publish. The published arm64 image is not the bytes that
  were scanned. That is P3/P4's subject (#207), not P1's. **Fixed by P3:**
  one native arm64 build per image, and the scanned archive is what is pushed.
- A `v*` tag on an already-built main commit runs the whole pipeline again,
  publish builds included (mostly cache hits). **Still true after P3:** the
  tag run builds, scans and pushes its own candidate under `:<sha>`;
  promoting main's recorded digest instead is P4 (#205).

---

## 3. Measuring after the change

Compare like with like: the same events, a stated window, and the same
definitions as section 2. What P1 can be expected to change, and should be
measured rather than assumed:

- jobs executed per run (main 11 to 8, pull request 8 to 5);
- critical path on a pull request, now Frontend alone rather than Preflight
  then Frontend;
- runs cancelled by a newer push to the same pull request, and the minutes
  they would otherwise have run.

### P3 (#204), measured on 2026-11-02

**Before:** the three `push` runs on main with P1's job layout
(41525961101, 41527119821, 41528918814; warm cache), and the slowest of the
last 60 main runs (41424010215, 09:51 UTC, a cold arm64 publish).
**After:** two `workflow_dispatch` runs of a throwaway branch identical to
this change except that Publish image pushed to `:p3-test-<sha>` and then
deleted that package version (41530378134 on an empty cache, 41531416417
on the cache the first one wrote), and the pull request's first run
(41530210402, empty cache). A dispatch on a branch runs no Deploy (main
only, ~0.6 to 0.9 min in the before runs), so its wall clock stops at
Publish image and the CI gate. Three and two runs: medians, not
percentiles.

Per run (minutes):

| | Before, main, warm (n=3) | Before, main, cold publish (n=1) | After, full, cold (n=1) | After, full, warm (n=1) | After, PR, cold (n=1) |
|---|---|---|---|---|---|
| Wall clock | 6.27 (5.40-7.95) | 18.98 | 6.30 | 4.48 | 5.80 |
| Sum of job durations | 10.22 (9.93-11.17) | - | 12.10 | 6.43 | 11.57 |
| Image builds | 4 (2 amd64 scan, 2 amd64+arm64 publish) | 4 | 2 (arm64) | 2 (arm64) | 2 (arm64) |

Per job (minutes):

| Job | Before, warm (median of 3) | Before, cold publish | After, cold | After, warm | After, PR cold |
|---|---|---|---|---|---|
| Frontend | 3.72 | - | 3.77 | 3.58 | 4.00 |
| Scan image (web) | 1.27 | - | 1.38 | 0.55 | 1.67 |
| Scan image (api) | 0.93 | - | 4.33 | 0.63 | 3.55 |
| Publish image (web) | 1.88 | 15.25 (slowest leg) | 0.47 | 0.35 | - |
| Publish image (api) | 0.78 | - | 1.07 | 0.40 | - |
| Deploy | 0.80 | - | not run | not run | - |

What the numbers say:

- Warm, the critical path is Frontend; Scan and Publish image no longer
  add to it beyond ~0.4 min of push. Cold, a native arm64 build of web
  took 40 s and of api 26 s (the build step); the QEMU publish this
  replaces took 15.25 min in the slowest main run.
- Both cold api scan legs spent minutes after their last step (3.25 min in
  the dispatch, 2.4 in the pull request), in the runner's "Cleaning up
  orphan processes", not in any step of ours (in the dispatch, the build,
  both scans and the upload were done in 57 s). It did not recur warm. Watch for it on main; it is runner-side and the 20-minute timeout
  covers it.
- A warm rebuild of the same commit produced the same image IDs
  (`sha256:5ef95dae…` web, `sha256:334d6828…` api) as the cold one; the
  archives' sha256 differ, which is why the archive hash is checked only
  within one run.
- Digest identity, from the dry run's log (cold run): web scanned
  `sha256:5ef95dae66480cbbca460ca14754a8d6bfad96f0bc5b4d413501da621c00f495`,
  pushed `web@sha256:06eddafeae568d2389179a98d227d982108ab6ff72a19b861a61640f541b9fce`
  whose config is that same ID; api scanned
  `sha256:334d6828a74f3c5915983acc40018bedc07b7b9beff87e6dcef2e9dd214e14ba`,
  pushed `api@sha256:474d710ea9f0f3588a166ed801fdc39ea21ebec195187564fdff5bd6c4613656`,
  same config. Both throwaway versions were deleted by the same job.
