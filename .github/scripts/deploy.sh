#!/usr/bin/env bash
# The Deploy job's cluster work: what runs now, the rollout, the in-cluster
# readiness check, and putting things back (#199, #200).
#
#   deploy.sh preflight   CI may port-forward here; refuse before touching anything
#   deploy.sh record      write down both Deployments' images; nothing is changed
#   deploy.sh rollout     mark the environment mutated, then set image, annotate, wait
#   deploy.sh readiness   through port-forward: api ready + DB up, web serves the
#                         document, both report $DEPLOY_SHA
#   deploy.sh recover     if anything was mutated, set both back to what was
#                         recorded, wait, and check readiness again
#
# Inputs (environment): DEPLOY_NS, IMAGE_BASE, DEPLOY_SHA, DEPLOY_REF_NAME.
# State lives in DEPLOY_STATE (default $RUNNER_TEMP/deploy-state), because each
# subcommand runs in its own workflow step and the steps share only the disk.
#
# Every kubectl call goes through `kubectl` on PATH, which is what lets
# deploy.test.sh drive this whole file against a fake one.
set -euo pipefail

: "${DEPLOY_NS:?DEPLOY_NS is not set}"
STATE="${DEPLOY_STATE:-${RUNNER_TEMP:-/tmp}/deploy-state}"
APPS=(web api)
ANNOTATIONS=(app.kubernetes.io/version portfolio.yehudabriskman.com/released-at)

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

rollout() {
  need IMAGE_BASE
  need DEPLOY_SHA
  local d release
  for d in "${APPS[@]}"; do
    if [ ! -s "$STATE/$d.image" ]; then
      echo "::error title=Nothing recorded for $d::Refusing to change a Deployment without a recorded way back. Run 'deploy.sh record' first."
      return 1
    fi
  done
  # From here on the environment may differ from what was recorded, whatever
  # happens next: a patch that times out on the client may still have landed.
  date -u +%FT%TZ >"$STATE/mutated"

  # The sha, not `rollout restart` against a moving tag: a sha cannot move.
  for d in "${APPS[@]}"; do
    k set image "deploy/$d" "$d=$IMAGE_BASE/$d:$DEPLOY_SHA"
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
      portfolio.yehudabriskman.com/released-at="$(date -u +%FT%TZ)"
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

# readiness [--recovery]
readiness() {
  local want="" legacy=0 i
  if [ "${1-}" = --recovery ]; then
    legacy=1
  else
    need DEPLOY_SHA
    want="$DEPLOY_SHA"
  fi
  mkdir -p "$STATE"
  for i in $(seq 1 "$READY_ATTEMPTS"); do
    echo "readiness attempt $i/$READY_ATTEMPTS"
    if check_api "$want" "$legacy" && check_web "$want"; then
      return 0
    fi
    [ "$i" -lt "$READY_ATTEMPTS" ] && sleep "$READY_SLEEP"
  done
  if [ "$legacy" = 0 ]; then
    echo "::error title=$DEPLOY_NS is not ready::Inside the cluster, after the rollout, the api and web pods did not both answer healthy and report $DEPLOY_SHA. The lines above say which, and what they answered instead."
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
  preflight | record | rollout | recover) "$1" ;;
  readiness) shift; readiness "$@" ;;
  *)
    echo "usage: $0 {preflight|record|rollout|readiness [--recovery]|recover}" >&2
    exit 2
    ;;
esac
