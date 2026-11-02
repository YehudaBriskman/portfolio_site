#!/usr/bin/env bash
# Drives release.sh against a fake `oras` (a registry in a directory), a fake
# `gh` (the Actions API from files), a fake `trivy` and `docker`, and real git
# in throwaway repositories (#205). No registry, no API, no network.
#
# What it holds: a tag's commit must be on main; a missing, mismatched,
# swapped or foreign manifest stops the release; the run a manifest names
# must be a passing main CI run for that commit; and what is pushed is what
# is read back.
#
#   bash .github/scripts/release.test.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE="$HERE/release.sh"
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT

BASE=ghcr.io/yehudabriskman/portfolio_site
REPO=YehudaBriskman/portfolio_site
SHA=1111111111111111111111111111111111111111
OTHER=2222222222222222222222222222222222222222
WD="sha256:$(printf 'a%.0s' {1..64})"
AD="sha256:$(printf 'b%.0s' {1..64})"
TYPE="application/vnd.yehudabriskman.portfolio.release.v1+json"

# ---------------------------------------------------------------- the fakes
mkdir -p "$ROOT/bin"

cat >"$ROOT/bin/oras" <<'FAKE'
#!/usr/bin/env bash
# Fake oras over a registry in $FAKE_DIR/registry: tags/<repo>/<tag> holds a
# digest, blobs/<digest>/ the files and the artifact type.
#   FAKE_ORAS_TYPE   the artifactType every manifest reports instead
#   FAKE_ORAS_LIE=1  `push` reports one digest and stores another
set -u
F="$FAKE_DIR"; R="$F/registry"
echo "oras $*" >>"$F/calls"
resolve() { # <ref> -> digest, or exit 1
  local ref="$1" repo tag
  if [[ "$ref" == *@sha256:* ]]; then
    [ -d "$R/blobs/${ref#*@}" ] || { echo "Error: $ref: not found" >&2; exit 1; }
    echo "${ref#*@}"; return
  fi
  repo="${ref%:*}"; tag="${ref##*:}"
  [ -f "$R/tags/$repo/$tag" ] || { echo "Error: $ref: not found" >&2; exit 1; }
  cat "$R/tags/$repo/$tag"
}
case "$1 ${2-}" in
  "version "*) echo "Version:        1.3.5" ;;
  "push "*)
    ref="$2"; shift 2; type=""; files=()
    while [ $# -gt 0 ]; do
      case "$1" in
        --artifact-type) type="$2"; shift 2 ;;
        --annotation|--format) shift 2 ;;
        *) files+=("${1%%:*}"); shift ;;
      esac
    done
    d="sha256:$(cat "${files[@]}" | sha256sum | cut -d' ' -f1)"
    mkdir -p "$R/blobs/$d" "$R/tags/${ref%:*}"
    cp "${files[@]}" "$R/blobs/$d/"
    printf '%s' "$type" >"$R/blobs/$d/.type"
    printf '%s' "$d" >"$R/tags/${ref%:*}/${ref##*:}"
    [ "${FAKE_ORAS_LIE:-}" = 1 ] && d="sha256:$(printf 'f%.0s' {1..64})"
    printf '{"digest":"%s"}\n' "$d" ;;
  "manifest fetch")
    if [ "$3" = --descriptor ]; then
      d=$(resolve "$4") || exit 1
      printf '{"mediaType":"application/vnd.oci.image.manifest.v1+json","digest":"%s","size":1}\n' "$d"
    else
      d=$(resolve "$3") || exit 1
      printf '{"artifactType":"%s"}\n' "${FAKE_ORAS_TYPE:-$(cat "$R/blobs/$d/.type")}"
    fi ;;
  "pull "*)
    d=$(resolve "$2") || exit 1
    mkdir -p "$4"; cp "$R/blobs/$d/"* "$4/" ;;
  *) echo "fake oras: unhandled: $*" >&2; exit 1 ;;
esac
FAKE

cat >"$ROOT/bin/gh" <<'FAKE'
#!/usr/bin/env bash
# Fake `gh api`: the answer to <path> is $FAKE_DIR/gh/<path with / as _>,
# query string dropped; no file is a 404. `--jq` is applied with jq.
set -u
F="$FAKE_DIR"
echo "gh $*" >>"$F/calls"
[ "$1" = api ] || exit 1
shift
path=""; q=""
while [ $# -gt 0 ]; do
  case "$1" in
    --paginate) shift ;;
    --jq) q="$2"; shift 2 ;;
    *) path="$1"; shift ;;
  esac
done
f="$F/gh/$(printf '%s' "${path%%\?*}" | tr '/' '_')"
[ -f "$f" ] || { echo "gh: Not Found (HTTP 404)" >&2; exit 1; }
if [ -n "$q" ]; then jq -c "$q" "$f"; else cat "$f"; fi
FAKE

cat >"$ROOT/bin/trivy" <<'FAKE'
#!/usr/bin/env bash
# Fake trivy: `version --format json`, and `image ... --output F` writing the
# report in $FAKE_TRIVY_REPORT (default: no findings).
set -u
echo "trivy $*" >>"$FAKE_DIR/calls"
if [ "$1" = version ]; then
  echo '{"Version":"0.70.0","VulnerabilityDB":{"Version":2,"UpdatedAt":"2026-11-02T06:00:00Z","DownloadedAt":"2026-11-02T08:00:00Z","NextUpdate":"2026-11-03T06:00:00Z"}}'
  exit 0
fi
o=""
while [ $# -gt 0 ]; do [ "$1" = --output ] && o="$2"; shift; done
printf '%s' "${FAKE_TRIVY_REPORT:-{\"Results\":[]\}}" >"$o"
FAKE

cat >"$ROOT/bin/docker" <<'FAKE'
#!/usr/bin/env bash
case "$1" in
  version) echo "28.0.0" ;;
  buildx) echo "github.com/docker/buildx v0.30.0" ;;
esac
FAKE
chmod +x "$ROOT/bin/"*

# ------------------------------------------------------------------ harness
PASS=0; FAIL=0; CASE=""; RC=0; OUT=""
RUN_DIR="$ROOT"

scenario() {
  CASE="$1"
  export FAKE_DIR="$ROOT/case-$PASS-$FAIL-$RANDOM"
  mkdir -p "$FAKE_DIR/gh" "$FAKE_DIR/work"
  : >"$FAKE_DIR/calls"
  : >"$FAKE_DIR/github_output"
  unset FAKE_ORAS_TYPE FAKE_ORAS_LIE FAKE_TRIVY_REPORT EXPECT_MANIFEST_DIGEST REBUILD_RUN_ID RELEASE_GIT_REMOTE
  RUN_DIR="$ROOT"
}

# run <subcommand...>: RC and OUT, never aborts the harness.
run() {
  set +e
  OUT=$(cd "$RUN_DIR" && PATH="$ROOT/bin:$PATH" IMAGE_BASE="$BASE" PLATFORM=linux/arm64 \
    GITHUB_REPOSITORY="$REPO" GITHUB_OUTPUT="$FAKE_DIR/github_output" GITHUB_STEP_SUMMARY="$FAKE_DIR/summary" \
    bash "$RELEASE" "$@" 2>&1)
  RC=$?
  set -e
  printf '%s\n' "$OUT" >>"$FAKE_DIR/out"
}

ok() { PASS=$((PASS + 1)); }
bad() {
  FAIL=$((FAIL + 1))
  echo "FAIL [$CASE] $1"
  echo "  --- calls"; sed 's/^/  /' "$FAKE_DIR/calls"
  echo "  --- output"; sed 's/^/  /' "$FAKE_DIR/out" 2>/dev/null || true
}
rc_is() { if [ "$RC" = "$1" ]; then ok; else bad "exit $RC, wanted $1"; fi; }
rc_not0() { if [ "$RC" != 0 ]; then ok; else bad "exit 0, wanted a failure"; fi; }
said() { if grep -qE -- "$1" "$FAKE_DIR/out"; then ok; else bad "output lacks: $1"; fi; }
output_is() { if grep -qxF -- "$1=$2" "$FAKE_DIR/github_output"; then ok; else bad "GITHUB_OUTPUT lacks $1=$2: $(tr '\n' ' ' <"$FAKE_DIR/github_output")"; fi; }

# A manifest as Release manifest writes it, with jq edits applied: good <file> [jq-filter]
good() {
  jq -n --arg sha "$SHA" --arg base "$BASE" --arg wd "$WD" --arg ad "$AD" --arg repo "$REPO" '
    def comp($n; $d): {image: ($base + "/" + $n + "@" + $d), digest: $d, image_id: "sha256:cfg",
      source_sha: $sha, reused: false, built_in_run: 41,
      scan: {result: "pass", db: {updated_at: "2026-11-02T06:00:00Z"}}};
    {schema: "portfolio-release-manifest/v1", source_sha: $sha, platform: "linux/arm64",
     repository: $repo, run: {id: 41, attempt: 2, url: "https://github.com/x/actions/runs/41"},
     components: {web: comp("web"; $wd), api: comp("api"; $ad)}}' | jq "${2:-.}" >"$1"
}

# store <tag> <manifest-file>: the registry holds it as manifest:<tag>.
store() {
  local d="$FAKE_DIR/push-$RANDOM"
  mkdir -p "$d"; cp "$2" "$d/manifest.json"
  (cd "$d" && FAKE_DIR="$FAKE_DIR" "$ROOT/bin/oras" push "$BASE/manifest:$1" --artifact-type "$TYPE" manifest.json:x --format json | jq -r .digest)
}

# The Actions API's view of run 41 and its jobs: run41 [jq-filter-on-run] [jobs-json]
JOBS_OK='{"jobs":[{"name":"Classify changes","conclusion":"success"},{"name":"Static","conclusion":"success"},
  {"name":"Frontend","conclusion":"success"},{"name":"Backend","conclusion":"success"},
  {"name":"Scan image (web, web)","conclusion":"success"},{"name":"Scan image (api, backend)","conclusion":"success"},
  {"name":"Publish image (web)","conclusion":"success"},{"name":"Publish image (api)","conclusion":"success"},
  {"name":"Release manifest","conclusion":"success"},{"name":"Deploy","conclusion":"failure"},{"name":"CI gate","conclusion":"failure"}]}'
run41() {
  jq -n --arg sha "$SHA" --arg repo "$REPO" '{id: 41, head_sha: $sha, head_branch: "main", event: "push",
    path: ".github/workflows/ci.yml", html_url: "https://github.com/x/actions/runs/41",
    repository: {full_name: $repo}, head_repository: {full_name: $repo}}' | jq "${1:-.}" \
    >"$FAKE_DIR/gh/repos_${REPO//\//_}_actions_runs_41"
  printf '%s' "${2:-$JOBS_OK}" >"$FAKE_DIR/gh/repos_${REPO//\//_}_actions_runs_41_attempts_2_jobs"
}

# -------------------------------------------------- validate: what is a manifest
scenario "validate: a manifest main CI would write passes"
good "$FAKE_DIR/m.json"
run validate "$FAKE_DIR/m.json" "$SHA"; rc_is 0
said "web: $BASE/web@$WD"

validate_rejects() { # <name> <jq-filter> <message regex> [sha]
  scenario "validate: $1"
  good "$FAKE_DIR/m.json" "$2"
  run validate "$FAKE_DIR/m.json" "${4:-$SHA}"; rc_not0
  said "Release manifest rejected"
  said "$3"
}
validate_rejects "the manifest for a different commit" '.' "manifest for \"$SHA\", not for $OTHER" "$OTHER"
validate_rejects "a component built from another commit" ".components.api.source_sha = \"$OTHER\"" "api was built from \"$OTHER\""
validate_rejects "a tag instead of a digest" ".components.web.image = \"$BASE/web:$SHA\"" "web.image is .*not $BASE/web@sha256"
validate_rejects "another repository's image" ".components.api.image = \"ghcr.io/evil/api@$AD\"" "api.image is"
validate_rejects "a digest that is not the image's" ".components.web.digest = \"$AD\"" "web.digest does not match"
validate_rejects "written by a fork" '.repository = "someone/portfolio_site"' "written by \"someone/portfolio_site\""
validate_rejects "another platform" '.platform = "linux/amd64"' "platform is \"linux/amd64\""
validate_rejects "an unknown schema" '.schema = "v0"' "schema is \"v0\""
validate_rejects "no run named" 'del(.run)' "names no run id and attempt"
validate_rejects "a reused component (not supported)" '.components.web.reused = true' "web is marked reused"
validate_rejects "no scan DB timestamp" 'del(.components.api.scan.db.updated_at)' "api has no vulnerability DB timestamp"
validate_rejects "a missing component" 'del(.components.api)' "no api component"

scenario "validate: not JSON"
printf 'nope' >"$FAKE_DIR/m.json"
run validate "$FAKE_DIR/m.json" "$SHA"; rc_not0
said "is not JSON"

# --------------------------------------------- fetch: by digest, from GHCR
scenario "fetch: the manifest for the commit, by digest, with the images as outputs"
good "$FAKE_DIR/m.json"
D=$(store "$SHA" "$FAKE_DIR/m.json")
run fetch "$SHA" "$FAKE_DIR/got"; rc_is 0
output_is web_image "$BASE/web@$WD"
output_is api_image "$BASE/api@$AD"
output_is manifest_digest "$D"
if grep -q "oras pull $BASE/manifest@$D" "$FAKE_DIR/calls"; then ok; else bad "did not pull by digest"; fi

scenario "fetch: a tag whose commit main never recorded: missing manifest, clear failure"
run fetch "$SHA" "$FAKE_DIR/got"; rc_not0
said "No release manifest for $SHA"
said "rebuild: true"
if [ -s "$FAKE_DIR/github_output" ]; then bad "wrote outputs for a missing manifest"; else ok; fi

scenario "fetch: manifest:<sha> holds the manifest of a different commit"
good "$FAKE_DIR/m.json" ".source_sha = \"$OTHER\" | .components.web.source_sha = \"$OTHER\" | .components.api.source_sha = \"$OTHER\""
store "$SHA" "$FAKE_DIR/m.json" >/dev/null
run fetch "$SHA" "$FAKE_DIR/got"; rc_not0
said "it is the manifest for \"$OTHER\", not for $SHA"
if grep -q web_image "$FAKE_DIR/github_output"; then bad "handed out images from the wrong manifest"; else ok; fi

scenario "fetch: the manifest changed after the job that wrote or verified it"
good "$FAKE_DIR/m.json"
store "$SHA" "$FAKE_DIR/m.json" >/dev/null
EXPECT_MANIFEST_DIGEST="sha256:$(printf 'c%.0s' {1..64})" run fetch "$SHA" "$FAKE_DIR/got"; rc_not0
said "Release manifest changed"

scenario "fetch: the expected digest matches"
good "$FAKE_DIR/m.json"
D=$(store "$SHA" "$FAKE_DIR/m.json")
EXPECT_MANIFEST_DIGEST="$D" run fetch "$SHA" "$FAKE_DIR/got"; rc_is 0

scenario "fetch: something under the tag that is not a release manifest"
good "$FAKE_DIR/m.json"
store "$SHA" "$FAKE_DIR/m.json" >/dev/null
FAKE_ORAS_TYPE=application/vnd.oci.image.config.v1+json run fetch "$SHA" "$FAKE_DIR/got"; rc_not0
said "Not a release manifest"

scenario "fetch: not a commit sha"
run fetch v1.2.0 "$FAKE_DIR/got"; rc_not0
said "is not a commit sha"

# ------------------------------------------ assemble and push: the writer side
evidence_file() { # <dir> <app> [jq-filter]
  jq -n --arg sha "$SHA" --arg app "$2" '{image: $app, source_sha: $sha, platform: "linux/arm64",
    image_id: "sha256:cfg", archive_sha256: "abc", inputs: {context_tree: "t"},
    scan: {result: "pass", db: {updated_at: "2026-11-02T06:00:00Z"}}}' | jq "${3:-.}" >"$1/evidence-$2.json"
  printf '{}' >"$1/trivy-$2.json"
}
assemble_env() { export SOURCE_SHA="$SHA" WEB_DIGEST="$WD" API_DIGEST="$AD" GITHUB_RUN_ID=41 GITHUB_RUN_ATTEMPT=2; }

scenario "assemble + push: evidence and digests become a manifest, pushed and read back"
assemble_env
evidence_file "$FAKE_DIR/work" web
evidence_file "$FAKE_DIR/work" api
run assemble "$FAKE_DIR/work"; rc_is 0
if jq -e '.components.web.image_id == "sha256:cfg" and .run.attempt == 2 and .components.api.built_in_run == 41' "$FAKE_DIR/work/manifest.json" >/dev/null; then ok; else bad "manifest lacks the evidence"; fi
run push "$FAKE_DIR/work"; rc_is 0
if grep -q '^manifest_digest=sha256:' "$FAKE_DIR/github_output"; then ok; else bad "no manifest_digest output"; fi
if grep -q "oras push $BASE/manifest:$SHA .*trivy-web.json:application/json" "$FAKE_DIR/calls"; then ok; else bad "scan reports not pushed with it"; fi
run fetch "$SHA" "$FAKE_DIR/back"; rc_is 0
output_is api_image "$BASE/api@$AD"

scenario "push: the registry reports one digest and serves another"
assemble_env
evidence_file "$FAKE_DIR/work" web
evidence_file "$FAKE_DIR/work" api
run assemble "$FAKE_DIR/work"; rc_is 0
FAKE_ORAS_LIE=1 run push "$FAKE_DIR/work"; rc_not0
said "Registry disagrees"

scenario "assemble: Publish image reported no digest"
assemble_env
evidence_file "$FAKE_DIR/work" web
evidence_file "$FAKE_DIR/work" api
API_DIGEST="" run assemble "$FAKE_DIR/work"; rc_not0
said "No digest for api"

scenario "assemble: evidence from another commit's scan"
assemble_env
evidence_file "$FAKE_DIR/work" web ".source_sha = \"$OTHER\""
evidence_file "$FAKE_DIR/work" api
run assemble "$FAKE_DIR/work"; rc_not0
said "Evidence for another build"
unset SOURCE_SHA WEB_DIGEST API_DIGEST GITHUB_RUN_ID GITHUB_RUN_ATTEMPT

# ------------------------------------------------- evidence: the scan side
EV="$ROOT/ev"
mkdir -p "$EV/web"
git -C "$EV" init -q -b main
printf 'FROM node:26-alpine@sha256:%s AS builder\nRUN true\nFROM --platform=linux/arm64 nginx:alpine@sha256:%s AS runner\nCOPY --from=builder /a /b\n' \
  "$(printf 'c%.0s' {1..64})" "$(printf 'd%.0s' {1..64})" >"$EV/web/Dockerfile"
printf '{}' >"$EV/web/package-lock.json"
git -C "$EV" add -A
git -C "$EV" -c user.name=t -c user.email=t@t -c commit.gpgsign=false commit -qm root
ev_env() { export SOURCE_SHA="$SHA" CANDIDATE=/dev/null IMAGE_ID=sha256:cfg ARCHIVE_SHA256=abc EVIDENCE_DIR="$FAKE_DIR/ev"; }

scenario "evidence: inputs, base images by digest, tools and the scan DB"
ev_env; RUN_DIR="$EV"
run evidence web web; rc_is 0
f="$FAKE_DIR/ev/evidence-web.json"
if jq -e --arg t "$(git -C "$EV" rev-parse HEAD:web)" '.inputs.context_tree == $t' "$f" >/dev/null; then ok; else bad "context tree"; fi
if jq -e '[.inputs.base_images[].ref] | length == 2 and all(test("@sha256:"))' "$f" >/dev/null; then ok; else bad "base images: $(jq -c .inputs.base_images "$f")"; fi
if jq -e '.inputs.base_images | map(.ref) | index("builder") == null' "$f" >/dev/null; then ok; else bad "a stage name counted as a base image"; fi
if jq -e '.scan.db.updated_at == "2026-11-02T06:00:00Z" and .scan.trivy_version == "0.70.0" and .scan.findings.critical == 0' "$f" >/dev/null; then ok; else bad "scan evidence"; fi
if jq -e '.inputs.dockerignore_sha256 == null and (.inputs.lockfile_sha256 | length) == 64' "$f" >/dev/null; then ok; else bad "file hashes"; fi
if grep -q -- '--skip-db-update' "$FAKE_DIR/calls"; then ok; else bad "the report did not reuse the gate's DB"; fi

scenario "evidence: a report that disagrees with the gate stops the release"
ev_env; RUN_DIR="$EV"
FAKE_TRIVY_REPORT='{"Results":[{"Vulnerabilities":[{"Severity":"CRITICAL","FixedVersion":""}]}]}' run evidence web web; rc_not0
said "Scan evidence disagrees with the gate"
unset SOURCE_SHA CANDIDATE IMAGE_ID ARCHIVE_SHA256 EVIDENCE_DIR

# --------------------------------------------- on-main: tag lineage, real git
G="$ROOT/lineage"
git init -q --bare -b main "$G/origin.git"
git init -q -b main "$G/work"
gw() { git -C "$G/work" -c user.name=t -c user.email=t@t -c commit.gpgsign=false "$@"; }
gw remote add origin "$G/origin.git"
gw commit -q --allow-empty -m m1
ON=$(gw rev-parse HEAD)
gw push -q origin main
gw checkout -q -b side
gw commit -q --allow-empty -m s1
OFF=$(gw rev-parse HEAD)
gw push -q origin side

scenario "on-main: the tag's commit is on main"
RUN_DIR="$G/work"
run on-main "$ON"; rc_is 0
said "is on main"

scenario "on-main: a tag on a commit that is not on main is refused"
RUN_DIR="$G/work"
run on-main "$OFF"; rc_not0
said "Tag is not on main"

scenario "on-main: a commit the repository does not have"
RUN_DIR="$G/work"
run on-main "$OTHER"; rc_not0
said "Unknown commit"

# ---------------------------------------------- origin: which run wrote it
scenario "origin: a passing main CI run for this commit (a failed Deploy does not matter)"
good "$FAKE_DIR/m.json"; run41
run origin "$FAKE_DIR/m.json"; rc_is 0
said "every build, test and scan job passed"
if grep -q "gh api --paginate repos/$REPO/actions/runs/41/attempts/2/jobs" "$FAKE_DIR/calls"; then ok; else bad "did not read the recorded attempt's jobs"; fi

origin_rejects() { # <name> <run jq-filter> <jobs json or ""> <message regex>
  scenario "origin: $1"
  good "$FAKE_DIR/m.json"; run41 "$2" "${3:-$JOBS_OK}"
  run origin "$FAKE_DIR/m.json"; rc_not0
  said "$4"
}
origin_rejects "the run built another commit" ".head_sha = \"$OTHER\"" "" "built $OTHER, not $SHA"
origin_rejects "the run was not on main" '.head_branch = "feature"' "" 'ran on "feature", not main'
origin_rejects "a pull request run" '.event = "pull_request"' "" "was a pull_request event"
origin_rejects "another workflow" '.path = ".github/workflows/other.yml"' "" 'is ".github/workflows/other.yml"'
origin_rejects "a fork's run" '.head_repository.full_name = "evil/portfolio_site"' "" "is not from $REPO"
origin_rejects "a scan leg failed in that attempt" '.' "$(jq -c '.jobs |= map(if .name == "Scan image (api, backend)" then .conclusion = "failure" else . end)' <<<"$JOBS_OK")" "Scan image: .*api, backend. failure"
origin_rejects "Frontend never ran" '.' "$(jq -c '.jobs |= map(select(.name != "Frontend"))' <<<"$JOBS_OK")" "Frontend did not run"
origin_rejects "only one publish leg" '.' "$(jq -c '.jobs |= map(select(.name != "Publish image (api)"))' <<<"$JOBS_OK")" "Publish image: 1 leg"
origin_rejects "the release job is still running" '.' "$(jq -c '.jobs |= map(if .name == "Release manifest" then .conclusion = null else . end)' <<<"$JOBS_OK")" "Release manifest: "

scenario "origin: the run does not exist"
good "$FAKE_DIR/m.json"
run origin "$FAKE_DIR/m.json"; rc_not0
said "Unknown run"

scenario "origin: a rebuild promotes only its own manifest"
good "$FAKE_DIR/m.json"
REBUILD_RUN_ID=99 run origin "$FAKE_DIR/m.json"; rc_not0
said "Not this rebuild's manifest"
REBUILD_RUN_ID=41 run origin "$FAKE_DIR/m.json"; rc_is 0

echo "release.sh: $PASS passed, $FAIL failed"
[ "$FAIL" = 0 ]
