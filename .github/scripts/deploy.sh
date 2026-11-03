#!/usr/bin/env bash
# The Deploy job's cluster work: what runs now, the rollout, the in-cluster
# readiness check, and putting things back (#199, #200).
#
#   deploy.sh guard       is this still the release to roll out? (#205) Writes
#                         proceed=true|false; refuses an older prod release
#   deploy.sh preflight   CI may port-forward here; refuse before touching anything
#   deploy.sh record      write down both Deployments' images; nothing is changed
#   deploy.sh rollout     mark the environment mutated, then set image (by
#                         digest), annotate, wait
#   deploy.sh readiness   through port-forward: api ready + DB up, web serves the
#                         document and a real /api/ route through nginx, both
#                         report $DEPLOY_SHA, and every pod runs the digest
#                         the release manifest names
#   deploy.sh edge        the public URL: / and a real /api/ route, status and
#                         body; preprod's answer is its gate's 302 (#155)
#   deploy.sh recover     if anything was mutated, set both back to what was
#                         recorded, wait, and check readiness again
#
# Inputs (environment): DEPLOY_NS, IMAGE_BASE, DEPLOY_SHA, DEPLOY_REF_NAME,
# and DEPLOY_WEB_IMAGE / DEPLOY_API_IMAGE: `<IMAGE_BASE>/<app>@sha256:<64 hex>`,
# read from the release manifest (.github/scripts/release.sh). A tag is
# refused: the manifest's digests are what was scanned and what is deployed.
# The guard also reads ROLLBACK (prod: "true" allows an older release) and
# DEPLOY_GIT_REMOTE (default origin).
# State lives in DEPLOY_STATE (default $RUNNER_TEMP/deploy-state), because each
# subcommand runs in its own workflow step and the steps share only the disk.
#
# Every kubectl call goes through `kubectl` on PATH, which is what lets
# deploy.test.sh drive this whole file against a fake one.
set -euo pipefail

: "${DEPLOY_NS:?DEPLOY_NS is not set}"
STATE="${DEPLOY_STATE:-${RUNNER_TEMP:-/tmp}/deploy-state}"
APPS=(web api)
# source-sha is the commit, because the image string is a digest now and no
# longer says which commit it was built from (Deploy drift reads it, #205).
ANNOTATIONS=(app.kubernetes.io/version portfolio.yehudabriskman.com/released-at portfolio.yehudabriskman.com/source-sha)

ROLLOUT_TIMEOUT="${ROLLOUT_TIMEOUT:-300s}"
RECOVERY_TIMEOUT="${RECOVERY_TIMEOUT:-180s}"
READY_ATTEMPTS="${READY_ATTEMPTS:-10}"
READY_SLEEP="${READY_SLEEP:-6}"
# Local ends of the port-forwards. Fixed rather than `:0`, so nothing has to
# parse a port back out of kubectl's output; a hosted runner has them free.
API_LOCAL_PORT="${DEPLOY_PF_API_PORT:-15000}"
WEB_LOCAL_PORT="${DEPLOY_PF_WEB_PORT:-18080}"

k() { kubectl -n "$DEPLOY_NS" "$@"; }

need() { : "${!1:?$1 is not set}"; }

# ---------------------------------------------------------------------- guard
#
# Concurrency is not ordering (#205). The deploy group runs one rollout per
# environment at a time, but not in the order the commits landed: a run that
# waited behind the lock, or was re-run a day later, would otherwise put an
# older build over a newer one. So this runs first INSIDE the lock, and asks
# the question again with what is true now.
#
#   preprod  Is $DEPLOY_SHA still the newest main commit with a successful
#            candidate (a release manifest in GHCR)? If a newer one has one,
#            this run is stale: proceed=false, a notice, and success. The
#            newer run deploys, or has already.
#   prod     Is this release older than the one prod runs? Older by commit
#            (an ancestor of the running commit) or by version (a lower
#            vX.Y.Z). Then refuse, as a failure, unless ROLLBACK=true: going
#            back is a deliberate act, not something a late tag does.
#
# Writes proceed=true|false to $GITHUB_OUTPUT; every later step checks it.
GUARD_MAX="${GUARD_MAX:-50}"

proceed() {
  echo "proceed=$1" >>"${GITHUB_OUTPUT:-/dev/null}"
  echo "proceed=$1"
}

manifest_exists() {
  oras manifest fetch --descriptor "$IMAGE_BASE/manifest:$1" >/dev/null 2>&1
}

guard_preprod() {
  local remote="${DEPLOY_GIT_REMOTE:-origin}" head c
  if ! git fetch -q "$remote" "+refs/heads/main:refs/remotes/$remote/main"; then
    echo "::error title=Cannot read main::git fetch $remote main failed, so whether $DEPLOY_SHA is still the newest release cannot be told. Nothing has been changed."
    return 1
  fi
  head=$(git rev-parse "refs/remotes/$remote/main")
  if ! git merge-base --is-ancestor "$DEPLOY_SHA" "$head"; then
    echo "::error title=$DEPLOY_SHA is not on main::Preprod rolls out main's commits, and main ($head) does not contain this one. Nothing has been changed."
    return 1
  fi
  # Newest first, along main's own line: a merged branch's inner commits were
  # never main pushes and have no manifests of their own.
  for c in $(git rev-list --first-parent --max-count="$GUARD_MAX" "$DEPLOY_SHA..$head"); do
    if manifest_exists "$c"; then
      echo "::notice title=Skipped: preprod has a newer release::main $c is newer than $DEPLOY_SHA and has its own release manifest, so its run deploys preprod (or already has). Rolling this one out would put an older build over it. Nothing has been changed."
      proceed false
      return 0
    fi
  done
  echo "$DEPLOY_SHA is the newest main commit with a release manifest (main is at $head)"
  proceed true
}

# The version and commit prod runs now, from the api Deployment's
# annotations; older deploys carried no source-sha, so a v* version
# annotation is resolved through git, and a commit-sha image tag is read last.
running_prod() {
  local ver sha img
  ver=$(k get deploy api -o "jsonpath={.metadata.annotations.app\\.kubernetes\\.io/version}" 2>/dev/null || true)
  sha=$(k get deploy api -o "jsonpath={.metadata.annotations.portfolio\\.yehudabriskman\\.com/source-sha}" 2>/dev/null || true)
  if [ -z "$sha" ] && [[ "$ver" == v* ]]; then
    sha=$(git rev-parse -q --verify "refs/tags/$ver^{commit}" 2>/dev/null || true)
  fi
  if [ -z "$sha" ]; then
    img=$(k get deploy api -o "jsonpath={.spec.template.spec.containers[?(@.name==\"api\")].image}" 2>/dev/null || true)
    [[ "${img##*:}" =~ ^[0-9a-f]{40}$ ]] && sha="${img##*:}"
  fi
  printf '%s %s\n' "${ver:--}" "${sha:--}"
}

guard_prod() {
  need DEPLOY_REF_NAME
  local ver sha why="" low remote="${DEPLOY_GIT_REMOTE:-origin}"
  # Main and the tags as they are now, so a release that landed while this
  # run waited for the lock is in the history it is compared against.
  git fetch -q "$remote" "+refs/heads/main:refs/remotes/$remote/main" "+refs/tags/*:refs/tags/*" ||
    echo "::warning title=Could not refresh main and tags::Comparing against the history this checkout already has."
  read -r ver sha < <(running_prod)
  [ "$ver" = - ] && ver=""
  [ "$sha" = - ] && sha=""
  echo "prod runs ${ver:-an unnamed release} (${sha:-commit unknown}); this is $DEPLOY_REF_NAME ($DEPLOY_SHA)"
  if [ -n "$sha" ] && [ "$sha" != "$DEPLOY_SHA" ]; then
    if ! git cat-file -e "$sha^{commit}" 2>/dev/null; then
      echo "::warning title=Cannot order against prod::prod runs $sha, which is not a commit in this clone, so its age cannot be compared by history."
    elif git merge-base --is-ancestor "$DEPLOY_SHA" "$sha"; then
      why="its commit $DEPLOY_SHA is an ancestor of the running $sha"
    fi
  fi
  local semver='^v[0-9]+\.[0-9]+\.[0-9]+$'
  if [[ "$ver" =~ $semver ]] && [[ "$DEPLOY_REF_NAME" =~ $semver ]] && [ "$ver" != "$DEPLOY_REF_NAME" ]; then
    low=$(printf '%s\n%s\n' "${ver#v}" "${DEPLOY_REF_NAME#v}" | sort -V | head -1)
    if [ "$low" = "${DEPLOY_REF_NAME#v}" ]; then
      why="${why:+$why, and }$DEPLOY_REF_NAME is a lower version than the running $ver"
    fi
  fi
  if [ -n "$why" ]; then
    if [ "${ROLLBACK:-false}" = true ]; then
      echo "::warning title=Rollback::Deploying $DEPLOY_REF_NAME over the newer ${ver:-$sha} because the run asked for a rollback: $why."
    else
      echo "::error title=Refused: $DEPLOY_REF_NAME is older than prod::$why. A late or re-run tag must not overwrite a newer release. To go back on purpose, run CI from the tag with rollback: true (Actions > CI > Run workflow, 'Use workflow from' the tag). Nothing has been changed."
      proceed false
      return 1
    fi
  fi
  proceed true
}

guard() {
  need DEPLOY_SHA
  need IMAGE_BASE
  if [ "$DEPLOY_NS" = prod ]; then guard_prod; else guard_preprod; fi
}

# ------------------------------------------------------------------ preflight
#
# The readiness check reaches the pods through `kubectl port-forward`, which
# needs `create` on pods/portforward. The CI Role did not grant it when this
# was written. Asked here, before the first patch, so a missing grant fails a
# deploy that has changed nothing rather than one that then has to be undone.
preflight() {
  local ans
  ans=$(k auth can-i create pods --subresource=portforward 2>/dev/null || true)
  if [ "$ans" != "yes" ]; then
    echo "::error title=CI cannot port-forward in $DEPLOY_NS::The readiness check reaches the pods through kubectl port-forward, and the ci-rollout Role in $DEPLOY_NS does not grant create on pods/portforward (answer: '${ans:-none}'). Nothing has been changed. Add that rule to k8s/ci-rollout-rbac.yaml in the oci-free repository and kubectl apply it."
    return 1
  fi
  echo "ci-rollout may port-forward in $DEPLOY_NS"
}

# --------------------------------------------------------------------- record
#
# The exact image string from the pod template. When it is digest-pinned that
# string IS the digest. When it is a moving tag (`:latest`, or no tag) it is
# not something to go back to: a release moves `:latest` to the new build
# before this job starts, so "back to :latest" would be "forward again". In
# that one case the running pod's digest is recorded instead, if there is one.
pin() {
  local d="$1" img="$2" ids repo="$2" tag=""
  case "$img" in
    *@sha256:*) echo "$img"; return ;;
  esac
  # The tag is after the last colon of the last path segment; a colon in the
  # registry's host:port is not one.
  if [[ "${img##*/}" == *:* ]]; then
    tag="${img##*:}"
    repo="${img%:*}"
  fi
  if [ -n "$tag" ] && [ "$tag" != latest ]; then
    echo "$img"; return
  fi
  ids=$(k get pods -l "app=$d" \
    -o "jsonpath={range .items[*]}{.status.containerStatuses[?(@.name==\"$d\")].imageID}{\"\\n\"}{end}" \
    2>/dev/null | sed -e 's#^[a-z-]*://##' | grep '@sha256:' | sort -u || true)
  if [ "$(printf '%s\n' "$ids" | grep -c . || true)" = 1 ]; then
    echo "${repo}@${ids#*@}"
  else
    echo "::warning title=$d runs a moving tag::$img is not pinned and its pods do not agree on one digest, so a recovery would set it back to the tag itself." >&2
    echo "$img"
  fi
}

record() {
  need DEPLOY_SHA
  rm -rf "$STATE"
  mkdir -p "$STATE"
  local d img a v
  for d in "${APPS[@]}"; do
    img=$(k get deploy "$d" -o "jsonpath={.spec.template.spec.containers[?(@.name==\"$d\")].image}")
    if [ -z "$img" ]; then
      echo "::error title=Could not read $d::No container named $d in deploy/$d, so there is nothing to go back to. Refusing to roll out."
      return 1
    fi
    pin "$d" "$img" >"$STATE/$d.image"
    for a in "${ANNOTATIONS[@]}"; do
      v=$(k get deploy "$d" -o "jsonpath={.metadata.annotations.${a//./\\.}}" || true)
      printf '%s' "$v" >"$STATE/$d.$(basename "$a")"
    done
    echo "$d: recorded $(cat "$STATE/$d.image")"
  done
}

# -------------------------------------------------------------------- rollout
#
# `rollout status` reports that it gave up, never why. A pull failure is the
# likeliest reason and is invisible without the group below; on a first
# preprod rollout the likeliest is a missing secret, and the pods wait in
# CreateContainerConfigError, which the REASON column names.
wait_rollouts() {
  local timeout="$1" d ok=0
  for d in "${APPS[@]}"; do
    if ! k rollout status "deploy/$d" --timeout="$timeout"; then
      echo "::group::why $d did not come up"
      k get pods -l "app=$d" \
        -o custom-columns='POD:.metadata.name,PHASE:.status.phase,REASON:.status.containerStatuses[0].state.waiting.reason,MSG:.status.containerStatuses[0].state.waiting.message' || true
      k describe deploy "$d" | tail -20 || true
      echo "::endgroup::"
      ok=1
    fi
  done
  return "$ok"
}

# target <app>: the image the release manifest names for it, which must be a
# digest of that app's repository. Anything else is refused before any patch.
target() {
  local d="$1" var img
  var="DEPLOY_$(printf '%s' "$1" | tr '[:lower:]' '[:upper:]')_IMAGE"
  img="${!var:-}"
  if ! [[ "$img" =~ ^${IMAGE_BASE//./\\.}/$d@sha256:[0-9a-f]{64}$ ]]; then
    echo "::error title=No digest for $d::$var is '${img:-unset}', not $IMAGE_BASE/$d@sha256:<digest>. Deploy rolls out only the digests the release manifest names (#205)." >&2
    return 1
  fi
  echo "$img"
}

rollout() {
  need IMAGE_BASE
  need DEPLOY_SHA
  local d release img
  for d in "${APPS[@]}"; do
    if [ ! -s "$STATE/$d.image" ]; then
      echo "::error title=Nothing recorded for $d::Refusing to change a Deployment without a recorded way back. Run 'deploy.sh record' first."
      return 1
    fi
    target "$d" >/dev/null || return 1
  done
  # From here on the environment may differ from what was recorded, whatever
  # happens next: a patch that times out on the client may still have landed.
  date -u +%FT%TZ >"$STATE/mutated"

  # The digest, not a tag and not `rollout restart`: a digest cannot move, and
  # it is the exact image the release manifest says was scanned.
  for d in "${APPS[@]}"; do
    img=$(target "$d")
    k set image "deploy/$d" "$d=$img"
  done
  # The version goes on as an annotation so `kubectl describe` can answer
  # "which release is this". Preprod has no release to name, so it carries
  # the branch and the short sha.
  if [ "$DEPLOY_NS" = prod ]; then
    release="${DEPLOY_REF_NAME:?DEPLOY_REF_NAME is not set}"
  else
    release="main-${DEPLOY_SHA:0:7}"
  fi
  for d in "${APPS[@]}"; do
    k annotate deploy "$d" --overwrite \
      app.kubernetes.io/version="$release" \
      portfolio.yehudabriskman.com/released-at="$(date -u +%FT%TZ)" \
      portfolio.yehudabriskman.com/source-sha="$DEPLOY_SHA"
  done
  wait_rollouts "$ROLLOUT_TIMEOUT"
}

# ------------------------------------------------------------------ readiness
#
# Through port-forward to the Deployments rather than the Services: the CI
# Role can read Deployments and pods but not Services, and the forwarded
# request goes past Traefik and the forwardAuth gate, which is the point —
# outside, preprod's healthy answer is a 302 that says nothing about the app.

PF_PID=""
stop_forward() {
  if [ -n "$PF_PID" ]; then
    kill "$PF_PID" 2>/dev/null || true
    wait "$PF_PID" 2>/dev/null || true
    PF_PID=""
  fi
}
trap stop_forward EXIT

# forward <deploy> <local> <remote>: waits until kubectl says it is listening.
forward() {
  local log="$STATE/pf-$1.log" i
  kubectl -n "$DEPLOY_NS" port-forward "deploy/$1" "$2:$3" --address 127.0.0.1 >"$log" 2>&1 &
  PF_PID=$!
  for i in $(seq 1 30); do
    grep -q '^Forwarding from' "$log" 2>/dev/null && return 0
    if ! kill -0 "$PF_PID" 2>/dev/null; then
      echo "  port-forward to $1 exited: $(tr '\n' ' ' <"$log")"
      PF_PID=""
      return 1
    fi
    [ "$i" -lt 30 ] && sleep 0.5
  done
  echo "  port-forward to $1 never said it was listening"
  stop_forward
  return 1
}

# The API route the checks ask for, through nginx and the edge. Public,
# read-only, and served from the store, so a 200 with this body means nginx
# reached the api and the api reached CouchDB.
API_PROBE="${API_PROBE:-/api/blog/posts}"

# api_body_ok <code>: $STATE/body is the posts list's JSON. The body as well
# as the status, because what answers 200 on this host is not always the api.
api_body_ok() {
  [ "$1" = 200 ] && jq -e '.ok == true and (.items | type == "array")' "$STATE/body" >/dev/null 2>&1
}

# fetch <port> <path>: the status on stdout, the body in $STATE/body.
fetch() {
  curl -sS -m 10 -o "$STATE/body" -w '%{http_code}' "http://127.0.0.1:$1$2" 2>/dev/null || echo 000
}

# check_api <want-sha|""> <legacy-ok>
check_api() {
  local want="$1" legacy="$2" code
  forward api "$API_LOCAL_PORT" 5000 || return 1
  code=$(fetch "$API_LOCAL_PORT" /health/ready)
  if [ "$code" = 404 ] && [ "$legacy" = 1 ]; then
    # A build from before /health/ready existed, which is what a recovery
    # will usually be putting back. Liveness is all it can say.
    code=$(fetch "$API_LOCAL_PORT" /health)
    stop_forward
    if [ "$code" = 200 ] && jq -e '.ok == true' "$STATE/body" >/dev/null 2>&1; then
      echo "  api: alive (an older build without /health/ready, so the DB is not checked)"
      return 0
    fi
    echo "  api: /health answered $code"
    return 1
  fi
  stop_forward
  if [ "$code" != 200 ] || ! jq -e '.ok == true and .db == "up"' "$STATE/body" >/dev/null 2>&1; then
    echo "  api: /health/ready answered $code $(head -c 200 "$STATE/body" 2>/dev/null | tr -d '\n')"
    return 1
  fi
  if [ -n "$want" ]; then
    local got
    got=$(jq -r '.version // ""' "$STATE/body")
    if [ "$got" != "$want" ]; then
      echo "  api: ready, but running ${got:-an unversioned build}, not $want"
      return 1
    fi
  fi
  echo "  api: ready, DB up${want:+, running $want}"
}

# check_web <want-sha|"">
check_web() {
  local want="$1" code
  forward web "$WEB_LOCAL_PORT" 8080 || return 1
  # The root, which nginx hands to the api to render: the whole chain, and the
  # bytes rather than the status, because the SPA fallback answers 200 to
  # nearly anything.
  code=$(fetch "$WEB_LOCAL_PORT" /)
  if [ "$code" != 200 ] || ! grep -q '<div id="root">' "$STATE/body" || ! grep -qi '</html>' "$STATE/body"; then
    stop_forward
    echo "  web: / answered $code without the shell's <div id=\"root\">"
    return 1
  fi
  # A real API route through nginx, which is what the edge forwards every
  # request to (#155). The root above cannot see the api: when nginx cannot
  # reach it, `/` falls back to the SPA shell with a 200, and that is how
  # v1.0.0 went green while every /api/ request answered 502.
  code=$(fetch "$WEB_LOCAL_PORT" "$API_PROBE")
  if ! api_body_ok "$code"; then
    stop_forward
    echo "  web: $API_PROBE through nginx answered $code $(head -c 200 "$STATE/body" 2>/dev/null | tr -d '\n'), not the API's posts list. A 502 here is nginx unable to reach the api (NGINX_API_HOST)."
    return 1
  fi
  if [ -n "$want" ]; then
    # Web's own file, not the api's rendering of it, which is cached.
    code=$(fetch "$WEB_LOCAL_PORT" /index.html)
    if [ "$code" != 200 ] || ! grep -q "<meta name=\"build-sha\" content=\"$want\"" "$STATE/body"; then
      stop_forward
      echo "  web: /index.html ($code) does not carry build-sha $want; it says '$(grep -o '<meta name="build-sha" content="[^"]*"' "$STATE/body" 2>/dev/null | sed 's/.*content="//; s/"$//' || true)'"
      return 1
    fi
  fi
  stop_forward
  echo "  web: serves the document${want:+, built from $want}"
}

# check_digests: the Deployment's spec and every pod behind it name the
# digest the release manifest does (#205: deployed digests equal the
# manifest). A pod's imageID is what the kubelet actually pulled, so this is
# the registry's word, not ours. Retried with the rest: a pod of the old
# ReplicaSet can still be listed for a moment after `rollout status` returns.
check_digests() {
  local d want spec ids n bad
  for d in "${APPS[@]}"; do
    want=$(target "$d") || return 1
    spec=$(k get deploy "$d" -o "jsonpath={.spec.template.spec.containers[?(@.name==\"$d\")].image}" 2>/dev/null || true)
    if [ "$spec" != "$want" ]; then
      echo "  $d: the Deployment names ${spec:-nothing}, not the manifest's $want"
      return 1
    fi
    ids=$(k get pods -l "app=$d" \
      -o "jsonpath={range .items[*]}{.status.containerStatuses[?(@.name==\"$d\")].imageID}{\"\\n\"}{end}" \
      2>/dev/null | grep . || true)
    n=$(printf '%s\n' "$ids" | grep -c . || true)
    bad=$(printf '%s\n' "$ids" | grep . | grep -v -- "@${want#*@}\$" || true)
    if [ "$n" = 0 ] || [ -n "$bad" ]; then
      echo "  $d: pods run [$(printf '%s' "$ids" | tr '\n' ' ')], not only ${want#*@}"
      return 1
    fi
  done
  echo "  digests: both Deployments and all their pods run the manifest's digests"
}

# readiness [--recovery]
readiness() {
  local want="" legacy=0 i
  if [ "${1-}" = --recovery ]; then
    legacy=1
  else
    need DEPLOY_SHA
    need IMAGE_BASE
    want="$DEPLOY_SHA"
  fi
  mkdir -p "$STATE"
  for i in $(seq 1 "$READY_ATTEMPTS"); do
    echo "readiness attempt $i/$READY_ATTEMPTS"
    if { [ "$legacy" = 1 ] || check_digests; } && check_api "$want" "$legacy" && check_web "$want"; then
      return 0
    fi
    [ "$i" -lt "$READY_ATTEMPTS" ] && sleep "$READY_SLEEP"
  done
  if [ "$legacy" = 0 ]; then
    echo "::error title=$DEPLOY_NS is not ready::Inside the cluster, after the rollout, the api and web pods did not all run the manifest's digests, answer healthy and report $DEPLOY_SHA. The lines above say which, and what they answered instead."
  fi
  return 1
}

# ----------------------------------------------------------------------- edge
#
# The public URL, from outside the cluster, after the in-cluster check (#155).
# This is the path a visitor takes: DNS, Traefik, the Ingress, web's nginx,
# and for /api/ the api behind it. Both the root and a real API route, each
# by its status AND its body.
#
#   prod     (DEPLOY_EXPECT=200) the root is the site's document, and
#            $API_PROBE is the posts list as JSON. A 502 from nginx, an
#            error page or the SPA shell answering in the api's place all fail.
#   preprod  (DEPLOY_EXPECT=302) the github-auth forwardAuth gate covers the
#            whole host, so the healthy answer to CI's unauthenticated request
#            is a redirect to the identity provider, on /api/ as well as on /.
#            A 200 means the gate is open. What is behind the gate is asserted
#            by `readiness`, through the same nginx the Ingress forwards to.
#
# Inputs: DEPLOY_URL (with a trailing slash), DEPLOY_EXPECT.
EDGE_ATTEMPTS="${EDGE_ATTEMPTS:-10}"
EDGE_SLEEP="${EDGE_SLEEP:-6}"

# edge_fetch <url>: "<status> <redirect-url>" on stdout, the body in $STATE/body.
edge_fetch() {
  local r
  r=$(curl -sS -m 10 -o "$STATE/body" -w '%{http_code} %{redirect_url}' "$1" 2>/dev/null) || true
  [ -n "$r" ] || r=000
  printf '%s\n' "$r"
}

# edge_check <path>: one request, judged by environment. Prints why on failure.
edge_check() {
  local path="$1" url code loc
  url="${DEPLOY_URL%/}$path"
  read -r code loc < <(edge_fetch "$url")
  if [ "$DEPLOY_EXPECT" = 302 ]; then
    if [ "$code" != 302 ] || [ -z "${loc:-}" ]; then
      echo "  $path: $code${loc:+ to $loc}, not the gate's 302 to the identity provider"
      return 1
    fi
    echo "  $path: 302, the gate answered"
    return 0
  fi
  if [ "$code" != "$DEPLOY_EXPECT" ]; then
    echo "  $path: $code, not $DEPLOY_EXPECT $(head -c 200 "$STATE/body" 2>/dev/null | tr -d '\n')"
    return 1
  fi
  if [ "$path" = / ]; then
    if ! grep -q '<div id="root">' "$STATE/body" || ! grep -qi '</html>' "$STATE/body"; then
      echo "  /: $code, but not the site's document"
      return 1
    fi
  elif ! api_body_ok "$code"; then
    echo "  $path: $code, but not the API's posts list: $(head -c 200 "$STATE/body" 2>/dev/null | tr -d '\n')"
    return 1
  fi
  echo "  $path: $code with the right body"
}

edge() {
  need DEPLOY_URL
  need DEPLOY_EXPECT
  mkdir -p "$STATE"
  local i root api
  for i in $(seq 1 "$EDGE_ATTEMPTS"); do
    echo "edge attempt $i/$EDGE_ATTEMPTS: $DEPLOY_URL"
    root=0; api=0
    edge_check / || root=1
    edge_check "$API_PROBE" || api=1
    [ "$root" = 0 ] && [ "$api" = 0 ] && return 0
    [ "$i" -lt "$EDGE_ATTEMPTS" ] && sleep "$EDGE_SLEEP"
  done
  if [ "$DEPLOY_EXPECT" = 302 ]; then
    echo "::error title=$DEPLOY_NS did not answer through its gate::$DEPLOY_URL did not answer 302 to the identity provider on both / and $API_PROBE. A 200 means the forwardAuth gate is open; a 403 means Traefik refused before the gate (the runner left the tailnet?); a 5xx is the edge itself."
  else
    echo "::error title=$DEPLOY_NS is not serving::$DEPLOY_URL did not answer $DEPLOY_EXPECT with the site's document on / and the API's posts list on $API_PROBE. A 502 on $API_PROBE is nginx unable to reach the api, the v1.0.0 outage (#155); a 403 means Traefik refused before reaching the app."
  fi
  return 1
}

# -------------------------------------------------------------------- recover
#
# `set image` to the recorded strings, not `rollout undo`: undo goes to the
# previous ReplicaSet, which after a half-finished rollout is not necessarily
# what was running, and for a Deployment that was never patched is something
# older still.
recover() {
  if [ ! -e "$STATE/mutated" ]; then
    echo "Nothing in $DEPLOY_NS was changed, so there is nothing to put back."
    return 0
  fi
  local d a v img failed=0
  echo "::group::putting $DEPLOY_NS back to what was recorded"
  for d in "${APPS[@]}"; do
    img=$(cat "$STATE/$d.image")
    echo "$d -> $img"
    k set image "deploy/$d" "$d=$img" || failed=1
  done
  for d in "${APPS[@]}"; do
    for a in "${ANNOTATIONS[@]}"; do
      v=$(cat "$STATE/$d.$(basename "$a")" 2>/dev/null || true)
      if [ -n "$v" ]; then
        k annotate deploy "$d" --overwrite "$a=$v" || echo "::warning::could not restore $a on $d"
      else
        k annotate deploy "$d" "$a-" || echo "::warning::could not remove $a from $d"
      fi
    done
  done
  wait_rollouts "$RECOVERY_TIMEOUT" || failed=1
  echo "::endgroup::"
  if [ "$failed" = 0 ]; then
    readiness --recovery || failed=1
  fi
  if [ "$failed" = 1 ]; then
    echo "::error title=RECOVERY FAILED in $DEPLOY_NS::The rollout failed and putting back the recorded images (web=$(cat "$STATE/web.image"), api=$(cat "$STATE/api.image")) did not come back healthy. $DEPLOY_NS may be half-changed or down. Look now: kubectl -n $DEPLOY_NS get deploy,pods -o wide"
    return 1
  fi
  echo "::warning title=Rolled back::$DEPLOY_NS is back on the recorded images and answers healthy. The failure that caused it is above."
}

case "${1-}" in
  guard | preflight | record | rollout | edge | recover) "$1" ;;
  readiness) shift; readiness "$@" ;;
  *)
    echo "usage: $0 {guard|preflight|record|rollout|readiness [--recovery]|edge|recover}" >&2
    exit 2
    ;;
esac
