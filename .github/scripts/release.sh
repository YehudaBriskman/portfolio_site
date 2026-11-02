#!/usr/bin/env bash
# The release manifest (#205): what main CI built, scanned and published for
# one commit, stored durably in GHCR, and the only thing a deploy reads.
#
#   release.sh install-oras            the pinned oras CLI, checksum verified
#   release.sh evidence IMAGE CONTEXT  (Scan image) one component's build
#                                      inputs, tools and scan result, as
#                                      $EVIDENCE_DIR/evidence-IMAGE.json
#   release.sh assemble DIR            (Release manifest) DIR/evidence-*.json
#                                      and the pushed digests -> DIR/manifest.json
#   release.sh push DIR                push it as $IMAGE_BASE/manifest:<sha>,
#                                      read it back, output manifest_digest
#   release.sh fetch SHA DIR           pull manifest:<sha> by digest, validate,
#                                      output web_image, api_image, manifest_digest
#   release.sh validate FILE SHA       the checks `fetch` makes, on a file
#   release.sh on-main SHA             the commit is on main
#   release.sh origin FILE             the run it names is a successful main CI
#                                      run for that commit (or, with
#                                      REBUILD_RUN_ID, this very run)
#
# WHERE IT LIVES
#
# An OCI artifact in GHCR, `ghcr.io/<owner>/portfolio_site/manifest:<sha>`,
# pushed with oras next to the images it names. A GitHub artifact expires (5
# days for this repository's default, 1 day for the candidates), and a
# redeploy or a tag a week later must not depend on one; the registry keeps
# it as long as it keeps the images. A copy is uploaded as a run artifact too,
# for reading in the browser, and nothing reads that copy.
#
# Deploy reads the manifest from the registry, by the digest the producing
# job reported, and rolls out the image digests it names. So what runs is,
# byte for byte, what was scanned (#204), and a manifest that was swapped,
# expired or written for another commit stops the release.
#
# Inputs are environment variables, named where they are used. oras, gh and
# git are called by name, which is what lets release.test.sh run all of this
# against fakes.
set -Eeuo pipefail

SCHEMA="portfolio-release-manifest/v1"
ARTIFACT_TYPE="application/vnd.yehudabriskman.portfolio.release.v1+json"
MANIFEST_MEDIA="application/vnd.yehudabriskman.portfolio.release.manifest.v1+json"
APPS=(web api)
WORKFLOW=".github/workflows/ci.yml"

die() {
  echo "::error title=$1::$2" >&2
  exit 1
}
out() { printf '%s=%s\n' "$1" "$2" >>"${GITHUB_OUTPUT:-/dev/null}"; echo "$1=$2"; }

# sha256 of a file as a JSON string, or null when there is no such file.
sum_or_null() { if [ -f "$1" ]; then jq -n --arg s "$(sha256sum "$1" | cut -d' ' -f1)" '$s'; else echo null; fi; }

# -------------------------------------------------------------------- evidence
#
# Runs in Scan image, after both policy scans passed, on the archive they
# scanned. The effective inputs are the ones that decide the bytes: the
# context's git tree (every source file, by content), the Dockerfile, the
# lockfile, .dockerignore, the base images by digest, and the build argument.
evidence() {
  local image="$1" ctx="$2" dir trivy cache ver report base stages
  : "${SOURCE_SHA:?}" "${PLATFORM:?}" "${CANDIDATE:?}" "${IMAGE_ID:?}" "${ARCHIVE_SHA256:?}"
  dir="${EVIDENCE_DIR:-.}"
  mkdir -p "$dir"
  trivy=$(command -v trivy || echo "$HOME/.local/bin/trivy-bin/trivy")
  cache="${TRIVY_CACHE_DIR:-${GITHUB_WORKSPACE:-$PWD}/.cache/trivy}"

  # The database the two policy scans just used, and when it was built: a
  # scan is evidence about the advisories known at that time, not forever.
  ver=$("$trivy" version --format json --cache-dir "$cache") || die "No scanner version" "trivy version failed"
  jq -e '.VulnerabilityDB.UpdatedAt | length > 0' >/dev/null <<<"$ver" ||
    die "No vulnerability DB" "trivy reports no database in $cache, so the scan's freshness cannot be recorded"

  # The findings, same policy inputs, same database (no update), as data.
  report="$dir/trivy-$image.json"
  "$trivy" image --input "$CANDIDATE" --cache-dir "$cache" --skip-db-update --quiet \
    --scanners vuln --severity HIGH,CRITICAL --ignorefile "${TRIVYIGNORE:-.trivyignore.yaml}" \
    --format json --exit-code 0 --output "$report"
  local counts
  counts=$(jq -c '[.Results[]?.Vulnerabilities[]?] | {
      critical: (map(select(.Severity == "CRITICAL")) | length),
      high: (map(select(.Severity == "HIGH")) | length),
      high_fixed: (map(select(.Severity == "HIGH" and (.FixedVersion // "") != "")) | length)}' "$report")
  # The policy steps passed, so this must agree; if it does not, the
  # evidence is not evidence of what the gate decided.
  jq -e '.critical == 0 and .high_fixed == 0' >/dev/null <<<"$counts" ||
    die "Scan evidence disagrees with the gate" "the JSON report for $image finds $counts, but the policy scans passed"

  stages=$(awk 'toupper($1) == "FROM" && toupper($(NF-1)) == "AS" { print $NF }' "$ctx/Dockerfile")
  base=$(awk 'toupper($1) == "FROM" { for (i = 2; i <= NF; i++) if ($i !~ /^--/) { print $i; break } }' "$ctx/Dockerfile" |
    sort -u | grep -vxF -f <(printf '%s\n' "$stages" scratch) || true)


  jq -n \
    --arg image "$image" --arg context "$ctx" --arg sha "$SOURCE_SHA" --arg platform "$PLATFORM" \
    --arg image_id "$IMAGE_ID" --arg archive "$ARCHIVE_SHA256" \
    --arg tree "$(git rev-parse "HEAD:$ctx")" \
    --argjson dockerfile "$(sum_or_null "$ctx/Dockerfile")" \
    --argjson lockfile "$(sum_or_null "$ctx/package-lock.json")" \
    --argjson dockerignore "$(sum_or_null "$ctx/.dockerignore")" \
    --argjson base "$(printf '%s\n' "$base" | jq -R 'select(length > 0) | {ref: ., digest: (if test("@sha256:") then sub(".*@"; "") else null end)}' | jq -s .)" \
    --argjson trivy "$ver" --argjson counts "$counts" \
    --arg docker "$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo unknown)" \
    --arg buildx "$(docker buildx version 2>/dev/null | head -1 || echo unknown)" \
    --arg runner "${ImageOS:-unknown}/${ImageVersion:-unknown} ${RUNNER_ARCH:-}" \
    '{
      image: $image, source_sha: $sha, platform: $platform,
      image_id: $image_id, archive_sha256: $archive,
      inputs: {
        context: $context, context_tree: $tree,
        dockerfile_sha256: $dockerfile, lockfile_sha256: $lockfile, dockerignore_sha256: $dockerignore,
        base_images: $base, build_args: {BUILD_SHA: $sha}
      },
      tools: {trivy: $trivy.Version, docker: $docker, buildx: $buildx, runner: $runner},
      scan: {
        result: "pass",
        policy: ["CRITICAL, fixed or not", "HIGH, where a fix exists"],
        ignorefile: ".trivyignore.yaml",
        findings: $counts,
        trivy_version: $trivy.Version,
        db: {
          version: $trivy.VulnerabilityDB.Version,
          updated_at: $trivy.VulnerabilityDB.UpdatedAt,
          downloaded_at: $trivy.VulnerabilityDB.DownloadedAt,
          next_update: $trivy.VulnerabilityDB.NextUpdate
        },
        report: ("trivy-" + $image + ".json")
      }
    }' >"$dir/evidence-$image.json"
  echo "evidence for $image: $(jq -c '{image_id, inputs: {context_tree: .inputs.context_tree}, scan: {findings: .scan.findings, db: .scan.db.updated_at}}' "$dir/evidence-$image.json")"
}

# -------------------------------------------------------------------- assemble
assemble() {
  local dir="$1" d var digest ev comps="{}"
  : "${SOURCE_SHA:?}" "${IMAGE_BASE:?}" "${PLATFORM:?}"
  for d in "${APPS[@]}"; do
    var="$(printf '%s' "$d" | tr '[:lower:]' '[:upper:]')_DIGEST"
    digest="${!var:-}"
    [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || die "No digest for $d" "$var is '${digest:-unset}'; Publish image did not report what it pushed"
    ev="$dir/evidence-$d.json"
    [ -s "$ev" ] || die "No evidence for $d" "$ev is missing; Scan image writes it after both scans pass"
    jq -e --arg s "$SOURCE_SHA" --arg p "$PLATFORM" '.source_sha == $s and .platform == $p' "$ev" >/dev/null ||
      die "Evidence for another build" "$ev is for $(jq -r '.source_sha + " " + .platform' "$ev"), not $SOURCE_SHA $PLATFORM"
    comps=$(jq -c --arg d "$d" --arg ref "$IMAGE_BASE/$d@$digest" --arg digest "$digest" \
      --arg run "${GITHUB_RUN_ID:-0}" --slurpfile ev "$ev" \
      '. + {($d): ($ev[0] | del(.image) + {image: $ref, digest: $digest, reused: false, built_in_run: ($run | tonumber)})}' <<<"$comps")
  done
  jq -n --arg schema "$SCHEMA" --arg sha "$SOURCE_SHA" --arg platform "$PLATFORM" \
    --arg repo "${GITHUB_REPOSITORY:-}" --arg wf "${GITHUB_WORKFLOW_REF:-}" \
    --arg ref "${GITHUB_REF:-}" --arg event "${GITHUB_EVENT_NAME:-}" \
    --arg run "${GITHUB_RUN_ID:-0}" --arg attempt "${GITHUB_RUN_ATTEMPT:-0}" \
    --arg url "${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-0}" \
    --arg oras "$(oras version 2>/dev/null | awk '/^Version:/ { print $2 }' || true)" \
    --arg at "$(date -u +%FT%TZ)" --argjson comps "$comps" \
    '{
      schema: $schema, source_sha: $sha, platform: $platform, created_at: $at,
      repository: $repo, workflow_ref: $wf, ref: $ref, event: $event,
      run: {id: ($run | tonumber), attempt: ($attempt | tonumber), url: $url},
      components: $comps,
      tools: {oras: $oras},
      retention: "Never prune: a deployed or rollback release is redeployed from this manifest and the digests it names (docs/ci-optimization-plan.md, After P4)."
    }' >"$dir/manifest.json"
  validate "$dir/manifest.json" "$SOURCE_SHA"
}

# -------------------------------------------------------------------- validate
validate() {
  local file="$1" sha="$2" d img base="${IMAGE_BASE:?}" problems
  [ -s "$file" ] || die "No release manifest" "$file is missing or empty"
  jq -e . "$file" >/dev/null 2>&1 || die "Unreadable release manifest" "$file is not JSON"
  problems=$(jq -r --arg schema "$SCHEMA" --arg sha "$sha" --arg platform "${PLATFORM:-linux/arm64}" \
    --arg repo "${GITHUB_REPOSITORY:-}" --arg base "$base" '
    def comp($d):
      .components[$d] as $c
      | if $c == null then "no \($d) component"
        else
          (if ($c.image | type) != "string" or ($c.image | test("^" + ($base | gsub("\\."; "\\.")) + "/" + $d + "@sha256:[0-9a-f]{64}$") | not)
             then "\($d).image is \($c.image | tojson), not \($base)/\($d)@sha256:<digest>" else empty end),
          (if $c.digest != (($c.image // "") | sub("^[^@]*@"; "")) then "\($d).digest does not match its image" else empty end),
          (if $c.source_sha != $sha then "\($d) was built from \($c.source_sha | tojson), not \($sha)" else empty end),
          (if $c.reused != false then "\($d) is marked reused; reuse is not supported (#205)" else empty end),
          (if $c.scan.result != "pass" then "\($d) scan result is \($c.scan.result | tojson)" else empty end),
          (if (($c.scan.db.updated_at // "") | length) == 0 then "\($d) has no vulnerability DB timestamp" else empty end)
        end;
    (if .schema != $schema then "schema is \(.schema | tojson), not \($schema)" else empty end),
    (if .source_sha != $sha then "it is the manifest for \(.source_sha | tojson), not for \($sha)" else empty end),
    (if .platform != $platform then "platform is \(.platform | tojson), not \($platform)" else empty end),
    (if $repo != "" and .repository != $repo then "it was written by \(.repository | tojson), not \($repo)" else empty end),
    (if ((.run.id // 0) | type) != "number" or .run.id < 1 or ((.run.attempt // 0) | type) != "number" or .run.attempt < 1
       then "it names no run id and attempt" else empty end),
    comp("web"), comp("api")
  ' "$file")
  if [ -n "$problems" ]; then
    die "Release manifest rejected" "$(printf '%s; ' "$problems" | tr '\n' ' ')($file)"
  fi
  for d in "${APPS[@]}"; do
    img=$(jq -r --arg d "$d" '.components[$d].image' "$file")
    echo "$d: $img"
  done
}

# ------------------------------------------------------------------------ push
push() {
  local dir="$1" ref digest got files=(manifest.json:"$MANIFEST_MEDIA")
  : "${SOURCE_SHA:?}" "${IMAGE_BASE:?}"
  validate "$dir/manifest.json" "$SOURCE_SHA" >/dev/null
  for d in "${APPS[@]}"; do
    [ -f "$dir/trivy-$d.json" ] && files+=("trivy-$d.json:application/json")
  done
  ref="$IMAGE_BASE/manifest:$SOURCE_SHA"
  digest=$(cd "$dir" && oras push "$ref" --artifact-type "$ARTIFACT_TYPE" \
    --annotation "org.opencontainers.image.revision=$SOURCE_SHA" \
    --annotation "org.opencontainers.image.source=${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}" \
    --annotation "org.opencontainers.image.description=Release manifest: image digests, build inputs and scan evidence for $SOURCE_SHA" \
    "${files[@]}" --format json | jq -r .digest)
  [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || die "Push failed" "oras push $ref reported digest '$digest'"
  # Read back what the registry now serves under the tag, by digest, and
  # compare bytes: a push that reported success is a claim.
  got=$(oras manifest fetch --descriptor "$ref" | jq -r .digest)
  [ "$got" = "$digest" ] || die "Registry disagrees" "$ref is $got, the push said $digest"
  rm -rf "$dir/.readback"
  oras pull "$IMAGE_BASE/manifest@$digest" -o "$dir/.readback" >/dev/null
  cmp -s "$dir/manifest.json" "$dir/.readback/manifest.json" || die "Registry disagrees" "manifest.json read back from $ref@$digest differs from what was pushed"
  out manifest_digest "$digest"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      echo "### Release manifest"
      echo
      echo "\`$ref\` = \`$digest\`"
      echo
      echo '| Component | Image | Image ID | Scan DB |'
      echo '|---|---|---|---|'
      jq -r '.components | to_entries[] | "| \(.key) | `\(.value.image)` | `\(.value.image_id)` | \(.value.scan.db.updated_at) |"' "$dir/manifest.json"
    } >>"$GITHUB_STEP_SUMMARY"
  fi
}

# ----------------------------------------------------------------------- fetch
fetch() {
  local sha="$1" dir="$2" ref desc digest type err
  : "${IMAGE_BASE:?}"
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || die "Not a commit" "'$sha' is not a commit sha"
  ref="$IMAGE_BASE/manifest:$sha"
  err=$(mktemp)
  if ! desc=$(oras manifest fetch --descriptor "$ref" 2>"$err"); then
    die "No release manifest for $sha" "$ref does not exist or cannot be read ($(tr '\n' ' ' <"$err" | head -c 300)). Main CI writes it after both images of that commit are built, scanned and published. Either main CI for $sha did not get that far, or the commit predates release manifests (#205). Nothing was built or deployed. To release a commit main never recorded, run CI from the tag with rebuild: true."
  fi
  digest=$(jq -r .digest <<<"$desc")
  [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || die "Unreadable release manifest" "$ref answered no digest"
  if [ -n "${EXPECT_MANIFEST_DIGEST:-}" ] && [ "$digest" != "$EXPECT_MANIFEST_DIGEST" ]; then
    die "Release manifest changed" "$ref is $digest now, but the job that wrote or verified it reported $EXPECT_MANIFEST_DIGEST. Refusing to deploy a manifest nobody checked."
  fi
  # Everything below reads by digest, so the tag cannot move under it.
  type=$(oras manifest fetch "$IMAGE_BASE/manifest@$digest" | jq -r '.artifactType // ""')
  [ "$type" = "$ARTIFACT_TYPE" ] || die "Not a release manifest" "$ref@$digest has artifactType '$type', not $ARTIFACT_TYPE"
  rm -rf "$dir"
  mkdir -p "$dir"
  oras pull "$IMAGE_BASE/manifest@$digest" -o "$dir" >/dev/null
  validate "$dir/manifest.json" "$sha"
  out manifest_digest "$digest"
  out web_image "$(jq -r .components.web.image "$dir/manifest.json")"
  out api_image "$(jq -r .components.api.image "$dir/manifest.json")"
  out run_url "$(jq -r .run.url "$dir/manifest.json")"
}

# --------------------------------------------------------------------- on-main
on_main() {
  local sha="$1" remote="${RELEASE_GIT_REMOTE:-origin}"
  git fetch -q "$remote" "+refs/heads/main:refs/remotes/$remote/main" ||
    die "Cannot read main" "git fetch $remote main failed, so whether $sha is on main cannot be told"
  git cat-file -e "$sha^{commit}" 2>/dev/null || die "Unknown commit" "$sha is not a commit in this repository"
  git merge-base --is-ancestor "$sha" "refs/remotes/$remote/main" ||
    die "Tag is not on main" "$sha is not on main ($(git rev-parse "refs/remotes/$remote/main")). A release is a commit main CI built, tested and scanned; tag a commit on main. Nothing was built or deployed."
  echo "$sha is on main"
}

# ---------------------------------------------------------------------- origin
#
# The manifest says which run wrote it. Believe that only once GitHub agrees:
# the run is this repository's CI workflow, on main, for exactly this commit,
# and in that attempt every job that produced or vetted the images passed.
origin() {
  local file="$1" id attempt sha run jobs problems
  : "${GITHUB_REPOSITORY:?}"
  id=$(jq -r .run.id "$file")
  attempt=$(jq -r .run.attempt "$file")
  sha=$(jq -r .source_sha "$file")
  if [ -n "${REBUILD_RUN_ID:-}" ]; then
    [ "$id" = "$REBUILD_RUN_ID" ] ||
      die "Not this rebuild's manifest" "a rebuild promotes only the manifest it just wrote (run $REBUILD_RUN_ID); manifest:$sha names run $id"
    echo "written by this run ($id), which built, tested and scanned it"
    return 0
  fi
  run=$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$id") ||
    die "Unknown run" "the manifest names run $id, which GitHub does not know in $GITHUB_REPOSITORY"
  problems=$(jq -r --arg sha "$sha" --arg repo "$GITHUB_REPOSITORY" --arg wf "$WORKFLOW" '
    (if .head_sha != $sha then "run \(.id) built \(.head_sha), not \($sha)" else empty end),
    (if .head_branch != "main" then "run \(.id) ran on \(.head_branch | tojson), not main" else empty end),
    (if (.event | IN("push", "workflow_dispatch")) | not then "run \(.id) was a \(.event) event" else empty end),
    (if ((.path // "") | startswith($wf)) | not then "run \(.id) is \(.path | tojson), not \($wf)" else empty end),
    (if .repository.full_name != $repo or .head_repository.full_name != $repo then "run \(.id) is not from \($repo)" else empty end)
  ' <<<"$run")
  [ -z "$problems" ] || die "Release manifest from the wrong run" "$(printf '%s; ' "$problems" | tr '\n' ' ')"
  jobs=$(gh api --paginate "repos/$GITHUB_REPOSITORY/actions/runs/$id/attempts/$attempt/jobs?per_page=100" \
    --jq '.jobs[] | {name, conclusion}' | jq -s .) ||
    die "Unknown run attempt" "cannot list the jobs of run $id attempt $attempt"
  problems=$(jq -r '
    def need($n): (map(select(.name == $n)) | if length == 0 then "\($n) did not run" elif all(.conclusion == "success") then empty else "\($n): \(map(.conclusion) | join(","))" end);
    def legs($p): (map(select(.name | startswith($p))) | if length < 2 then "\($p): \(length) leg(s), not web and api" elif all(.conclusion == "success") then empty else "\($p): \(map(.name + " " + (.conclusion // "unfinished")) | join(", "))" end);
    need("Static"), need("Frontend"), need("Backend"), need("Release manifest"),
    legs("Scan image"), legs("Publish image")
  ' <<<"$jobs")
  [ -z "$problems" ] || die "Main CI did not pass for $sha" "in run $id attempt $attempt: $(printf '%s; ' "$problems" | tr '\n' ' ')"
  echo "written by $(jq -r .html_url <<<"$run") (attempt $attempt): main, $sha, every build, test and scan job passed"
}

# ----------------------------------------------------------------- install-oras
#
# An exact version, checked against the sha256 its release publishes, like
# actionlint in Static. Bumping it is a deliberate edit here. amd64 only:
# the three jobs that use it run on ubuntu-latest.
ORAS_VERSION=1.3.5
ORAS_SHA256=f48a73ea6d026a862c3919fc773da9a8c86fc259c2c737d5baed3b8b9614ad22
install_oras() {
  local dir="${RUNNER_TEMP:?}/oras" tgz="oras_${ORAS_VERSION}_linux_amd64.tar.gz"
  [ "${RUNNER_ARCH:-X64}" = X64 ] || die "No oras for ${RUNNER_ARCH}" "release.sh pins the linux amd64 build only"
  mkdir -p "$dir"
  curl -fsSLo "$dir/$tgz" "https://github.com/oras-project/oras/releases/download/v${ORAS_VERSION}/$tgz"
  echo "$ORAS_SHA256  $dir/$tgz" | sha256sum -c -
  tar -xzf "$dir/$tgz" -C "$dir" oras
  echo "$dir" >>"${GITHUB_PATH:?}"
  "$dir/oras" version
}

case "${1-}" in
  install-oras) install_oras ;;
  evidence) evidence "$2" "$3" ;;
  assemble) assemble "$2" ;;
  push) push "$2" ;;
  fetch) fetch "$2" "$3" ;;
  validate) validate "$2" "$3" ;;
  on-main) on_main "$2" ;;
  origin) origin "$2" ;;
  *)
    echo "usage: $0 install-oras | evidence IMAGE CONTEXT | assemble DIR | push DIR | fetch SHA DIR | validate FILE SHA | on-main SHA | origin FILE" >&2
    exit 2
    ;;
esac
