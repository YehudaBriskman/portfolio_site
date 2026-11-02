#!/usr/bin/env bash
# Drives deploy.sh against a fake `kubectl` and a fake `curl` on PATH, and
# asserts which calls it made (#199, #200). No cluster and no network: the
# fakes keep each Deployment's image in a file, and the "pods" answer
# according to the image they were last set to.
#
#   bash .github/scripts/deploy.test.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY="$HERE/deploy.sh"
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT

BASE=ghcr.io/yehudabriskman/portfolio_site
NEW=1111111111111111111111111111111111111111
OLD=2222222222222222222222222222222222222222

# ---------------------------------------------------------------- the fakes
mkdir -p "$ROOT/bin"

cat >"$ROOT/bin/kubectl" <<'FAKE'
#!/usr/bin/env bash
# Fake kubectl. Logs every call, then answers from $FAKE_DIR.
#   FAKE_FAIL      regex; a call (after `-n NS`) matching it exits 1
#   FAKE_CANI      the answer to `auth can-i` (default yes)
#   FAKE_STUCK     regex; `rollout status deploy/X` fails while X's image matches
#   FAKE_PODS_<d>  lines `rollout status`-independent pods report as imageID
set -u
F="$FAKE_DIR"
echo "kubectl $*" >>"$F/calls"
[ "${1-}" = -n ] && shift 2
line="$*"
if [ -n "${FAKE_FAIL:-}" ] && [[ "$line" =~ $FAKE_FAIL ]]; then
  echo "fake kubectl: refused: $line" >&2
  exit 1
fi
case "$1" in
  auth)
    echo "${FAKE_CANI:-yes}"
    [ "${FAKE_CANI:-yes}" = yes ]
    exit ;;
  get)
    if [ "$2" = deploy ]; then
      d="$3"; jp="$5"
      case "$jp" in
        *'.image}') cat "$F/img.$d" ;;
        *'version}') cat "$F/ann.$d.version" 2>/dev/null || true ;;
        *'released-at}') cat "$F/ann.$d.released-at" 2>/dev/null || true ;;
      esac
    elif [ "$2" = pods ]; then
      d="${4#app=}"
      case "$*" in
        *imageID*) var="FAKE_PODS_$d"; printf '%s\n' "${!var:-}" ;;
        *) echo "POD PHASE REASON MSG"; echo "$d-x Pending ErrImagePull nope" ;;
      esac
    fi
    exit 0 ;;
  set)
    # set image deploy/<d> <d>=<image>
    d="${3#deploy/}"
    printf '%s' "${4#*=}" >"$F/img.$d"
    exit 0 ;;
  annotate)
    d="$3"; shift 3
    for kv in "$@"; do
      case "$kv" in
        --overwrite) ;;
        *-) rm -f "$F/ann.$d.$(basename "${kv%-}")" ;;
        *=*) k="${kv%%=*}"; printf '%s' "${kv#*=}" >"$F/ann.$d.$(basename "$k")" ;;
      esac
    done
    exit 0 ;;
  rollout)
    d="${3#deploy/}"
    if [ -n "${FAKE_STUCK:-}" ] && [[ "$(cat "$F/img.$d")" =~ $FAKE_STUCK ]]; then
      echo "error: timed out waiting for the condition" >&2
      exit 1
    fi
    echo "deployment \"$d\" successfully rolled out"
    exit 0 ;;
  describe) echo "Events: fake"; exit 0 ;;
  port-forward)
    d="${2#deploy/}"; ports="$3"
    echo "$d" >"$F/pf.${ports%%:*}"
    echo "Forwarding from 127.0.0.1:${ports%%:*} -> ${ports#*:}"
    exec sleep 30 ;;
esac
echo "fake kubectl: unhandled: $line" >&2
exit 1
FAKE

cat >"$ROOT/bin/curl" <<'FAKE'
#!/usr/bin/env bash
# Fake curl: answers as the pod behind the forwarded port would, from the
# image that Deployment was last set to.
#   FAKE_BROKEN   regex on the image; the api says db down (503), web says 502
#   FAKE_NOVER    regex on the image; it reports no version ("dev")
#   FAKE_LEGACY   regex on the image; an api build without /health/ready
#   FAKE_HOLLOW   regex on the image; web answers 200 with a page that is
#                 not the site (the nginx welcome page)
set -u
F="$FAKE_DIR"
out=/dev/null; url=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    -w|-m) shift 2 ;;
    -*) shift ;;
    *) url="$1"; shift ;;
  esac
done
echo "curl $url" >>"$F/calls"
hostport="${url#http://}"; hostport="${hostport%%/*}"; port="${hostport#*:}"
path="/${url#http://*/}"
d=$(cat "$F/pf.$port")
img=$(cat "$F/img.$d")
sha="dev"
[[ "$img" =~ :([0-9a-f]{40})$ ]] && sha="${BASH_REMATCH[1]}"
[ -n "${FAKE_NOVER:-}" ] && [[ "$img" =~ $FAKE_NOVER ]] && sha="dev"
broken=0; [ -n "${FAKE_BROKEN:-}" ] && [[ "$img" =~ $FAKE_BROKEN ]] && broken=1
legacy=0; [ -n "${FAKE_LEGACY:-}" ] && [[ "$img" =~ $FAKE_LEGACY ]] && legacy=1
hollow=0; [ -n "${FAKE_HOLLOW:-}" ] && [[ "$img" =~ $FAKE_HOLLOW ]] && hollow=1
reply() { printf '%s' "$2" >"$out"; printf '%s' "$1"; }
case "$d:$path" in
  api:/health/ready)
    if [ "$legacy" = 1 ]; then reply 404 '{"ok":false,"error":"Not Found"}'
    elif [ "$broken" = 1 ]; then reply 503 "{\"ok\":false,\"db\":\"down\",\"version\":\"$sha\"}"
    else reply 200 "{\"ok\":true,\"db\":\"up\",\"version\":\"$sha\"}"; fi ;;
  api:/health) reply 200 '{"ok":true}' ;;
  web:/ | web:/index.html)
    if [ "$broken" = 1 ]; then reply 502 '<html>Bad Gateway</html>'
    elif [ "$hollow" = 1 ]; then reply 200 '<!DOCTYPE html><html><body><h1>Welcome to nginx!</h1></body></html>'
    else reply 200 "<!DOCTYPE html><html><head><meta name=\"build-sha\" content=\"$sha\" /></head><body><div id=\"root\"></div></body></html>"; fi ;;
  *) reply 404 '' ;;
esac
FAKE
chmod +x "$ROOT/bin/kubectl" "$ROOT/bin/curl"

# ------------------------------------------------------------------ harness
PASS=0; FAIL=0; CASE=""; RC=0; OUT=""

scenario() {
  CASE="$1"
  export FAKE_DIR="$ROOT/case-$PASS-$FAIL-$RANDOM"
  mkdir -p "$FAKE_DIR"
  : >"$FAKE_DIR/calls"
  printf '%s' "$BASE/web:$OLD" >"$FAKE_DIR/img.web"
  printf '%s' "$BASE/api:$OLD" >"$FAKE_DIR/img.api"
  printf '%s' "main-2222222" >"$FAKE_DIR/ann.web.version"
  printf '%s' "main-2222222" >"$FAKE_DIR/ann.api.version"
  unset FAKE_FAIL FAKE_CANI FAKE_STUCK FAKE_BROKEN FAKE_NOVER FAKE_LEGACY FAKE_HOLLOW FAKE_PODS_web FAKE_PODS_api
  export DEPLOY_STATE="$FAKE_DIR/state"
}

# run <subcommand...>: RC and OUT, never aborts the harness.
run() {
  set +e
  OUT=$(PATH="$ROOT/bin:$PATH" DEPLOY_NS=preprod IMAGE_BASE="$BASE" DEPLOY_SHA="$NEW" \
    DEPLOY_REF_NAME=main READY_ATTEMPTS=2 READY_SLEEP=0 \
    bash "$DEPLOY" "$@" 2>&1)
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
called() { if grep -qE -- "$1" "$FAKE_DIR/calls"; then ok; else bad "no call matching: $1"; fi; }
not_called() { if grep -qE -- "$1" "$FAKE_DIR/calls"; then bad "unexpected call matching: $1"; else ok; fi; }
said() { if grep -qE -- "$1" "$FAKE_DIR/out"; then ok; else bad "output lacks: $1"; fi; }
not_said() { if grep -qE -- "$1" "$FAKE_DIR/out"; then bad "output has: $1"; else ok; fi; }
image_is() { if [ "$(cat "$FAKE_DIR/img.$1")" = "$2" ]; then ok; else bad "$1 is $(cat "$FAKE_DIR/img.$1"), wanted $2"; fi; }
# after <a> <b>: the last call matching b comes after the first call matching a.
after() {
  local a b
  a=$(grep -nE -- "$1" "$FAKE_DIR/calls" | head -1 | cut -d: -f1 || true)
  b=$(grep -nE -- "$2" "$FAKE_DIR/calls" | tail -1 | cut -d: -f1 || true)
  if [ -n "$a" ] && [ -n "$b" ] && [ "$b" -gt "$a" ]; then ok; else bad "'$2' is not after '$1'"; fi
}
calls_since_mark() { : >"$FAKE_DIR/calls"; }

# -------------------------------------------------------------- scenarios

scenario "happy path: record, roll out, ready on the new sha"
run preflight; rc_is 0
run record; rc_is 0
run rollout; rc_is 0
called "set image deploy/web web=$BASE/web:$NEW"
called "set image deploy/api api=$BASE/api:$NEW"
called "annotate deploy web --overwrite app.kubernetes.io/version=main-1111111"
run readiness; rc_is 0
called "port-forward deploy/api 15000:5000"
called "port-forward deploy/web 18080:8080"
called "curl http://127.0.0.1:15000/health/ready"
called "curl http://127.0.0.1:18080/index.html"
not_called "rollout undo"

scenario "web patch succeeds, api patch fails: both go back to the recorded images"
run record; rc_is 0
FAKE_FAIL="set image deploy/api api=.*:$NEW" run rollout; rc_not0
image_is web "$BASE/web:$NEW"
calls_since_mark
run recover; rc_is 0
called "set image deploy/web web=$BASE/web:$OLD"
called "set image deploy/api api=$BASE/api:$OLD"
after "set image deploy/api api=$BASE/api:$OLD" "rollout status deploy/web --timeout=180s"
after "set image deploy/api api=$BASE/api:$OLD" "rollout status deploy/api --timeout=180s"
after "rollout status deploy/api" "curl http://127.0.0.1:15000/health/ready"
image_is web "$BASE/web:$OLD"
image_is api "$BASE/api:$OLD"
called "annotate deploy web --overwrite app.kubernetes.io/version=main-2222222"
called "annotate deploy web portfolio.yehudabriskman.com/released-at-"
not_called "rollout undo"
said "title=Rolled back"
not_said "RECOVERY FAILED"

scenario "rollout times out on api: both go back"
run record; rc_is 0
export FAKE_STUCK=":$NEW\$"
run rollout; rc_not0
said "why api did not come up"
called "get pods -l app=api -o custom-columns"
calls_since_mark
run recover; rc_is 0
called "set image deploy/web web=$BASE/web:$OLD"
called "set image deploy/api api=$BASE/api:$OLD"
image_is api "$BASE/api:$OLD"
said "title=Rolled back"

scenario "readiness fails (db down on the new build): both go back"
run record; rc_is 0
run rollout; rc_is 0
export FAKE_BROKEN=":$NEW\$"
run readiness; rc_not0
said "api: /health/ready answered 503"
said "title=preprod is not ready"
calls_since_mark
run recover; rc_is 0
called "set image deploy/web web=$BASE/web:$OLD"
called "set image deploy/api api=$BASE/api:$OLD"
called "curl http://127.0.0.1:15000/health/ready"
said "title=Rolled back"

scenario "readiness fails on version: the pods are not running this commit"
run record; rc_is 0
run rollout; rc_is 0
FAKE_NOVER=":$NEW\$" run readiness; rc_not0
said "running an unversioned build|running dev, not $NEW"

scenario "readiness fails on the web document"
run record; rc_is 0
run rollout; rc_is 0
printf '%s' "$BASE/api:$NEW" >"$FAKE_DIR/img.api"
FAKE_BROKEN="web:$NEW\$" run readiness; rc_not0
said "web: / answered 502"

scenario "readiness fails on a 200 that is not the site"
run record; rc_is 0
run rollout; rc_is 0
FAKE_HOLLOW="web:$NEW\$" run readiness; rc_not0
said "web: / answered 200 without the shell"

scenario "recovery itself fails: a separate, loud error"
run record; rc_is 0
export FAKE_FAIL="set image deploy/api"
run rollout; rc_not0
calls_since_mark
run recover; rc_not0
called "set image deploy/web web=$BASE/web:$OLD"
called "rollout status deploy/web"
called "rollout status deploy/api"
said "::error title=RECOVERY FAILED in preprod::"
not_said "title=Rolled back"

scenario "recovery comes back but is not healthy: recovery failed"
run record; rc_is 0
run rollout; rc_is 0
export FAKE_BROKEN="."
run readiness; rc_not0
run recover; rc_not0
said "::error title=RECOVERY FAILED in preprod::"

scenario "recovery onto a build from before /health/ready"
run record; rc_is 0
FAKE_FAIL="set image deploy/api api=.*:$NEW" run rollout; rc_not0
export FAKE_LEGACY=":$OLD\$"
run recover; rc_is 0
called "curl http://127.0.0.1:15000/health\$"
said "older build without /health/ready"

scenario "cluster never reached: nothing recorded, nothing mutated, no recovery"
export FAKE_FAIL="get deploy"
run record; rc_not0
calls_since_mark
run recover; rc_is 0
not_called "set image"
not_called "rollout status"
said "nothing to put back"

scenario "rollout refuses to start without a record"
run rollout; rc_not0
not_called "set image"
if [ -e "$DEPLOY_STATE/mutated" ]; then bad "marked mutated without a record"; else ok; fi
run recover; rc_is 0
not_called "set image"

scenario "preflight: no port-forward grant stops the deploy before any change"
FAKE_CANI=no run preflight; rc_not0
called "auth can-i create pods --subresource=portforward"
said "CI cannot port-forward in preprod"
not_called "set image"

scenario "record: a digest pin is kept, :latest is pinned to the running digest"
printf '%s' "$BASE/web@sha256:aaaa" >"$FAKE_DIR/img.web"
printf '%s' "$BASE/api:latest" >"$FAKE_DIR/img.api"
export FAKE_PODS_api="ghcr.io/yehudabriskman/portfolio_site/api@sha256:bbbb
docker-pullable://ghcr.io/yehudabriskman/portfolio_site/api@sha256:bbbb"
run record; rc_is 0
if [ "$(cat "$DEPLOY_STATE/web.image")" = "$BASE/web@sha256:aaaa" ]; then ok; else bad "web recorded $(cat "$DEPLOY_STATE/web.image")"; fi
if [ "$(cat "$DEPLOY_STATE/api.image")" = "$BASE/api@sha256:bbbb" ]; then ok; else bad "api recorded $(cat "$DEPLOY_STATE/api.image")"; fi
FAKE_FAIL="rollout status" run rollout; rc_not0
unset FAKE_FAIL
run recover; rc_is 0
called "set image deploy/web web=$BASE/web@sha256:aaaa"
called "set image deploy/api api=$BASE/api@sha256:bbbb"

scenario "record: :latest whose pods disagree stays the tag, with a warning"
printf '%s' "$BASE/api:latest" >"$FAKE_DIR/img.api"
export FAKE_PODS_api="$BASE/api@sha256:bbbb
$BASE/api@sha256:cccc"
run record; rc_is 0
if [ "$(cat "$DEPLOY_STATE/api.image")" = "$BASE/api:latest" ]; then ok; else bad "api recorded $(cat "$DEPLOY_STATE/api.image")"; fi
said "api runs a moving tag"

scenario "prod names the release by its tag"
run record; rc_is 0
set +e
OUT=$(PATH="$ROOT/bin:$PATH" DEPLOY_NS=prod IMAGE_BASE="$BASE" DEPLOY_SHA="$NEW" DEPLOY_REF_NAME=v9.9.9 \
  bash "$DEPLOY" rollout 2>&1); RC=$?
set -e
rc_is 0
called "kubectl -n prod annotate deploy api --overwrite app.kubernetes.io/version=v9.9.9"

echo "deploy.sh: $PASS passed, $FAIL failed"
[ "$FAIL" = 0 ]
