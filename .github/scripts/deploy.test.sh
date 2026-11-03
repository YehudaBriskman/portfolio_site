#!/usr/bin/env bash
# Drives deploy.sh against a fake `kubectl`, `curl` and `oras` on PATH, and
# asserts which calls it made (#199, #200, #205). No cluster, no registry and
# no network: the fakes keep each Deployment's image in a file, the "pods"
# answer according to the image they were last set to, and the "registry"
# holds a release manifest for a commit when a file says so. The guard's
# history questions go to real git, in throwaway repositories.
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
# Digests whose first 40 hex digits are the commit they were built from, so
# the fake pods can say which build they are. Web and api differ.
WPAD=aaaaaaaaaaaaaaaaaaaaaaaa
APAD=bbbbbbbbbbbbbbbbbbbbbbbb
NEW_WEB="$BASE/web@sha256:$NEW$WPAD"
NEW_API="$BASE/api@sha256:$NEW$APAD"
OLD_WEB="$BASE/web@sha256:$OLD$WPAD"
OLD_API="$BASE/api@sha256:$OLD$APAD"

# ---------------------------------------------------------------- the fakes
mkdir -p "$ROOT/bin"

cat >"$ROOT/bin/kubectl" <<'FAKE'
#!/usr/bin/env bash
# Fake kubectl. Logs every call, then answers from $FAKE_DIR.
#   FAKE_FAIL      regex; a call (after `-n NS`) matching it exits 1
#   FAKE_CANI      the answer to `auth can-i` (default yes)
#   FAKE_STUCK     regex; `rollout status deploy/X` fails while X's image matches
#   FAKE_PODS_<d>  the imageID lines X's pods report; unset, they report the
#                  Deployment's image when that is a digest
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
        *'source-sha}') cat "$F/ann.$d.source-sha" 2>/dev/null || true ;;
      esac
    elif [ "$2" = pods ]; then
      d="${4#app=}"
      case "$*" in
        *imageID*)
          var="FAKE_PODS_$d"
          if [ -n "${!var+x}" ]; then printf '%s\n' "${!var}"
          elif grep -q @sha256: "$F/img.$d"; then echo "docker-pullable://$(cat "$F/img.$d")"; fi ;;
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
#   FAKE_NOAPI    regex on the web image; nginx cannot reach the api, so
#                 /api/ answers 502 and / falls back to the SPA shell (#155)
# An https:// URL is the public edge, which forwards everything to web:
#   FAKE_GATE     "closed": every edge request is a 302 to the identity
#                 provider (preprod's forwardAuth); "open": the gate lets it
#                 through; unset: no gate (prod)
set -u
F="$FAKE_DIR"
out=/dev/null; url=""; fmt=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    -w) fmt="$2"; shift 2 ;;
    -m) shift 2 ;;
    -*) shift ;;
    *) url="$1"; shift ;;
  esac
done
echo "curl $url" >>"$F/calls"
redirect=""
if [[ "$url" == https://* ]]; then
  path="/${url#https://*/}"
  d=web
  if [ "${FAKE_GATE:-}" = closed ]; then
    printf '%s' '' >"$out"
    printf '%s' 302
    [[ "$fmt" == *redirect_url* ]] && printf ' %s' "https://idp.example/login"
    exit 0
  fi
else
  hostport="${url#http://}"; hostport="${hostport%%/*}"; port="${hostport#*:}"
  path="/${url#http://*/}"
  d=$(cat "$F/pf.$port")
fi
img=$(cat "$F/img.$d")
sha="dev"
[[ "$img" =~ :([0-9a-f]{40})$ ]] && sha="${BASH_REMATCH[1]}"
[[ "$img" =~ @sha256:([0-9a-f]{40})[0-9a-f]{24}$ ]] && sha="${BASH_REMATCH[1]}"
[ -n "${FAKE_NOVER:-}" ] && [[ "$img" =~ $FAKE_NOVER ]] && sha="dev"
broken=0; [ -n "${FAKE_BROKEN:-}" ] && [[ "$img" =~ $FAKE_BROKEN ]] && broken=1
legacy=0; [ -n "${FAKE_LEGACY:-}" ] && [[ "$img" =~ $FAKE_LEGACY ]] && legacy=1
hollow=0; [ -n "${FAKE_HOLLOW:-}" ] && [[ "$img" =~ $FAKE_HOLLOW ]] && hollow=1
noapi=0; [ -n "${FAKE_NOAPI:-}" ] && [[ "$img" =~ $FAKE_NOAPI ]] && noapi=1
reply() {
  printf '%s' "$2" >"$out"; printf '%s' "$1"
  [[ "$fmt" == *redirect_url* ]] && printf ' %s' "$redirect"
  return 0
}
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
  web:/api/blog/posts)
    if [ "$broken" = 1 ] || [ "$noapi" = 1 ]; then reply 502 '<html><head><title>502 Bad Gateway</title></head></html>'
    elif [ "$hollow" = 1 ]; then reply 200 '<!DOCTYPE html><html><body><div id="root"></div></body></html>'
    else reply 200 '{"ok":true,"items":[{"slug":"hello"}]}'; fi ;;
  *) reply 404 '' ;;
esac
FAKE

cat >"$ROOT/bin/oras" <<'FAKE'
#!/usr/bin/env bash
# Fake oras: `manifest fetch --descriptor <base>/manifest:<sha>` succeeds when
# $FAKE_DIR/manifests/<sha> exists.
set -u
F="$FAKE_DIR"
echo "oras $*" >>"$F/calls"
if [ "$1 $2 $3" = "manifest fetch --descriptor" ]; then
  [ -e "$F/manifests/${4##*:}" ] || { echo "Error: $4: not found" >&2; exit 1; }
  echo '{"mediaType":"application/vnd.oci.image.manifest.v1+json","digest":"sha256:feed","size":1}'
  exit 0
fi
echo "fake oras: unhandled: $*" >&2
exit 1
FAKE
chmod +x "$ROOT/bin/kubectl" "$ROOT/bin/curl" "$ROOT/bin/oras"

# ------------------------------------------------------------------ harness
PASS=0; FAIL=0; CASE=""; RC=0; OUT=""
RUN_DIR="$ROOT"

scenario() {
  CASE="$1"
  export FAKE_DIR="$ROOT/case-$PASS-$FAIL-$RANDOM"
  mkdir -p "$FAKE_DIR/manifests"
  : >"$FAKE_DIR/calls"
  : >"$FAKE_DIR/github_output"
  printf '%s' "$BASE/web:$OLD" >"$FAKE_DIR/img.web"
  printf '%s' "$BASE/api:$OLD" >"$FAKE_DIR/img.api"
  printf '%s' "main-2222222" >"$FAKE_DIR/ann.web.version"
  printf '%s' "main-2222222" >"$FAKE_DIR/ann.api.version"
  unset FAKE_FAIL FAKE_CANI FAKE_STUCK FAKE_BROKEN FAKE_NOVER FAKE_LEGACY FAKE_HOLLOW FAKE_NOAPI FAKE_GATE FAKE_PODS_web FAKE_PODS_api
  export DEPLOY_STATE="$FAKE_DIR/state"
  NS=preprod; SHA="$NEW"; REF_NAME=main; WEB_IMG="$NEW_WEB"; API_IMG="$NEW_API"; ROLLBACK=""
  URL=https://preprod.site.example/; EXPECT=302; export FAKE_GATE=closed
  RUN_DIR="$ROOT"
}

# run <subcommand...>: RC and OUT, never aborts the harness.
run() {
  set +e
  OUT=$(cd "$RUN_DIR" && PATH="$ROOT/bin:$PATH" DEPLOY_NS="$NS" IMAGE_BASE="$BASE" DEPLOY_SHA="$SHA" \
    DEPLOY_REF_NAME="$REF_NAME" DEPLOY_WEB_IMAGE="$WEB_IMG" DEPLOY_API_IMAGE="$API_IMG" \
    ROLLBACK="$ROLLBACK" GITHUB_OUTPUT="$FAKE_DIR/github_output" \
    READY_ATTEMPTS=2 READY_SLEEP=0 EDGE_ATTEMPTS=2 EDGE_SLEEP=0 \
    DEPLOY_URL="$URL" DEPLOY_EXPECT="$EXPECT" \
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
ann_is() { if [ "$(cat "$FAKE_DIR/ann.$1.$2" 2>/dev/null || echo '<none>')" = "$3" ]; then ok; else bad "$1 $2 is $(cat "$FAKE_DIR/ann.$1.$2" 2>/dev/null || echo '<none>'), wanted $3"; fi; }
proceed_is() { if grep -qx "proceed=$1" "$FAKE_DIR/github_output"; then ok; else bad "GITHUB_OUTPUT has '$(tr '\n' ' ' <"$FAKE_DIR/github_output")', wanted proceed=$1"; fi; }
# after <a> <b>: the last call matching b comes after the first call matching a.
after() {
  local a b
  a=$(grep -nE -- "$1" "$FAKE_DIR/calls" | head -1 | cut -d: -f1 || true)
  b=$(grep -nE -- "$2" "$FAKE_DIR/calls" | tail -1 | cut -d: -f1 || true)
  if [ -n "$a" ] && [ -n "$b" ] && [ "$b" -gt "$a" ]; then ok; else bad "'$2' is not after '$1'"; fi
}
calls_since_mark() { : >"$FAKE_DIR/calls"; }

# -------------------------------------------------------------- scenarios

scenario "happy path: record, roll out the manifest's digests, ready on the new sha"
run preflight; rc_is 0
run record; rc_is 0
run rollout; rc_is 0
called "set image deploy/web web=$NEW_WEB"
called "set image deploy/api api=$NEW_API"
called "annotate deploy web --overwrite app.kubernetes.io/version=main-1111111"
ann_is api source-sha "$NEW"
run readiness; rc_is 0
called "port-forward deploy/api 15000:5000"
called "port-forward deploy/web 18080:8080"
called "curl http://127.0.0.1:15000/health/ready"
called "curl http://127.0.0.1:18080/index.html"
called "curl http://127.0.0.1:18080/api/blog/posts"
called "get pods -l app=api -o jsonpath=.*imageID"
said "digests: both Deployments and all their pods run the manifest's digests"
not_called "rollout undo"

scenario "rollout refuses a tag: only a digest from the manifest is rolled out"
run record; rc_is 0
WEB_IMG="$BASE/web:$NEW" run rollout; rc_not0
said "No digest for web"
not_called "set image"
if [ -e "$DEPLOY_STATE/mutated" ]; then bad "marked mutated before refusing"; else ok; fi

scenario "rollout refuses a digest of another repository"
run record; rc_is 0
API_IMG="ghcr.io/someone/else/api@sha256:$NEW$APAD" run rollout; rc_not0
said "No digest for api"
not_called "set image"

scenario "rollout refuses a missing manifest image"
run record; rc_is 0
API_IMG="" run rollout; rc_not0
said "DEPLOY_API_IMAGE is 'unset'"
not_called "set image"

scenario "readiness fails when a pod runs another digest than the manifest"
run record; rc_is 0
run rollout; rc_is 0
export FAKE_PODS_api="docker-pullable://$NEW_API
docker-pullable://$OLD_API"
run readiness; rc_not0
said "api: pods run"
said "title=preprod is not ready"

scenario "readiness fails when the Deployment names another image than the manifest"
run record; rc_is 0
run rollout; rc_is 0
printf '%s' "$OLD_WEB" >"$FAKE_DIR/img.web"
run readiness; rc_not0
said "web: the Deployment names $OLD_WEB"

scenario "readiness fails when nginx cannot reach the api, though / still answers 200 (#155)"
run record; rc_is 0
run rollout; rc_is 0
export FAKE_NOAPI="$NEW"
run readiness; rc_not0
called "curl http://127.0.0.1:18080/api/blog/posts"
said "/api/blog/posts through nginx answered 502"
said "title=preprod is not ready"

scenario "edge, preprod: / and the API route both answer the gate's 302"
run edge; rc_is 0
called "curl https://preprod.site.example/$"
called "curl https://preprod.site.example/api/blog/posts"
said "/api/blog/posts: 302, the gate answered"

scenario "edge, preprod: an open gate fails, and recover puts both back"
run record; rc_is 0
run rollout; rc_is 0
run readiness; rc_is 0
export FAKE_GATE=open
run edge; rc_not0
said "/: 200, not the gate's 302"
said "title=preprod did not answer through its gate"
run recover; rc_is 0
image_is web "$BASE/web:$OLD"
image_is api "$BASE/api:$OLD"
said "title=Rolled back"

prod_edge() {
  scenario "$1"
  NS=prod; URL=https://site.example/; EXPECT=200; unset FAKE_GATE
  printf '%s' "$NEW_WEB" >"$FAKE_DIR/img.web"
  printf '%s' "$NEW_API" >"$FAKE_DIR/img.api"
}

prod_edge "edge, prod: the document on / and the posts list on the API route"
run edge; rc_is 0
called "curl https://site.example/api/blog/posts"
said "/api/blog/posts: 200 with the right body"
not_said "::error"

prod_edge "edge, prod: every /api/ request 502 while / answers 200 fails (#155)"
export FAKE_NOAPI="$NEW"
run edge; rc_not0
said "/: 200 with the right body"
said "/api/blog/posts: 502"
said "title=prod is not serving"

prod_edge "edge, prod: a 200 that is not the API's JSON fails"
export FAKE_HOLLOW="$NEW"
run edge; rc_not0
said "/api/blog/posts: 200, but not the API's posts list"

prod_edge "edge, prod: a gate's redirect is not prod's 200"
export FAKE_GATE=closed
run edge; rc_not0
said "/: 302, not 200"

scenario "web patch succeeds, api patch fails: both go back to the recorded images"
run record; rc_is 0
FAKE_FAIL="set image deploy/api api=.*$NEW" run rollout; rc_not0
image_is web "$NEW_WEB"
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
called "annotate deploy web portfolio.yehudabriskman.com/source-sha-"
ann_is web source-sha "<none>"
not_called "rollout undo"
said "title=Rolled back"
not_said "RECOVERY FAILED"

scenario "digest to digest: a failed rollout goes back to the recorded digests and source-sha"
printf '%s' "$OLD_WEB" >"$FAKE_DIR/img.web"
printf '%s' "$OLD_API" >"$FAKE_DIR/img.api"
printf '%s' "$OLD" >"$FAKE_DIR/ann.web.source-sha"
printf '%s' "$OLD" >"$FAKE_DIR/ann.api.source-sha"
run record; rc_is 0
if [ "$(cat "$DEPLOY_STATE/api.image")" = "$OLD_API" ]; then ok; else bad "api recorded $(cat "$DEPLOY_STATE/api.image")"; fi
export FAKE_STUCK="$NEW"
run rollout; rc_not0
calls_since_mark
run recover; rc_is 0
called "set image deploy/web web=$OLD_WEB"
called "set image deploy/api api=$OLD_API"
image_is web "$OLD_WEB"
image_is api "$OLD_API"
ann_is api source-sha "$OLD"
said "title=Rolled back"

scenario "rollout times out on api: both go back"
run record; rc_is 0
export FAKE_STUCK="$NEW"
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
export FAKE_BROKEN="$NEW"
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
FAKE_NOVER="$NEW" run readiness; rc_not0
said "running an unversioned build|running dev, not $NEW"

scenario "readiness fails on the web document"
run record; rc_is 0
run rollout; rc_is 0
FAKE_BROKEN="web@sha256:$NEW" run readiness; rc_not0
said "web: / answered 502"

scenario "readiness fails on a 200 that is not the site"
run record; rc_is 0
run rollout; rc_is 0
FAKE_HOLLOW="web@sha256:$NEW" run readiness; rc_not0
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
FAKE_FAIL="set image deploy/api api=.*$NEW" run rollout; rc_not0
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
NS=prod REF_NAME=v9.9.9 run rollout
rc_is 0
called "kubectl -n prod annotate deploy api --overwrite app.kubernetes.io/version=v9.9.9"
called "kubectl -n prod set image deploy/api api=$NEW_API"

# ------------------------------------------------------- the guard (#205)
#
# A real repository with main's first-parent line m1 - m2 - m3 - M4, where M4
# merges a branch whose own commit b1 is not one of main's pushes, and a
# commit x1 that is not on main at all. "origin" is a bare copy.
G="$ROOT/git"
gitc() { git -C "$G/work" -c user.name=t -c user.email=t@t -c commit.gpgsign=false -c tag.gpgsign=false "$@"; }
mkdir -p "$G"
git init -q --bare -b main "$G/origin.git"
git init -q -b main "$G/work"
gitc remote add origin "$G/origin.git"
commit() { gitc commit -q --allow-empty -m "$1"; gitc rev-parse HEAD; }
M1=$(commit m1)
M2=$(commit m2)
M3=$(commit m3)
gitc checkout -q -b topic
B1=$(commit b1)
gitc checkout -q main
gitc merge -q --no-ff -m M4 topic
M4=$(gitc rev-parse HEAD)
gitc tag v1.1.0 "$M2"
gitc tag -a -m v1.2.0 v1.2.0 "$M3"
gitc push -q origin main --tags
gitc checkout -q -b stray "$M1"
X1=$(commit x1)
gitc checkout -q main
# The clone deploy.sh runs in has fallen behind origin: main was at M2 when
# it checked out, which is the case the guard exists for.
git clone -q "$G/origin.git" "$G/clone"
git -C "$G/clone" -c advice.detachedHead=false checkout -q "$M2"
git -C "$G/clone" update-ref refs/remotes/origin/main "$M2"
git -C "$G/clone" fetch -q "$G/work" "$X1"

guard_case() { scenario "$1"; RUN_DIR="$G/clone"; }

guard_case "preprod guard: the newest main commit proceeds"
SHA="$M4" run guard; rc_is 0
proceed_is true

guard_case "preprod guard: a newer main commit with a manifest makes this one stale: skip, not fail"
touch "$FAKE_DIR/manifests/$M3"
SHA="$M2" run guard; rc_is 0
proceed_is false
said "::notice title=Skipped: preprod has a newer release::main $M3"
called "oras manifest fetch --descriptor $BASE/manifest:$M4"
not_called "set image"

guard_case "preprod guard: sees main as it is now, not as the checkout saw it"
touch "$FAKE_DIR/manifests/$M4"
SHA="$M3" run guard; rc_is 0
proceed_is false

guard_case "preprod guard: newer commits without a manifest (still building, or failed) do not block"
SHA="$M2" run guard; rc_is 0
proceed_is true
called "oras manifest fetch --descriptor $BASE/manifest:$M3"

guard_case "preprod guard: a merged branch's own commit is not one of main's releases"
touch "$FAKE_DIR/manifests/$B1"
SHA="$M3" run guard; rc_is 0
proceed_is true
not_called "manifest:$B1"

guard_case "preprod guard: a commit that is not on main is refused"
SHA="$X1" run guard; rc_not0
said "is not on main"
not_called "set image"

guard_case "preprod guard: main cannot be fetched: refuse, do not guess"
SHA="$M3" DEPLOY_GIT_REMOTE=nowhere run guard; rc_not0
said "Cannot read main"

prod_case() {
  guard_case "$1"
  NS=prod
  printf '%s' "$2" >"$FAKE_DIR/ann.api.version"
  if [ -n "$3" ]; then printf '%s' "$3" >"$FAKE_DIR/ann.api.source-sha"; fi
}

prod_case "prod guard: an older tag than prod runs is refused" v1.2.0 "$M3"
SHA="$M2" REF_NAME=v1.1.0 run guard; rc_not0
proceed_is false
said "Refused: v1.1.0 is older than prod"
said "ancestor of the running $M3"
said "lower version than the running v1.2.0"

prod_case "prod guard: an older tag with rollback is allowed, loudly" v1.2.0 "$M3"
SHA="$M2" REF_NAME=v1.1.0 ROLLBACK=true run guard; rc_is 0
proceed_is true
said "::warning title=Rollback::"

prod_case "prod guard: a newer tag proceeds" v1.1.0 "$M2"
SHA="$M4" REF_NAME=v1.3.0 run guard; rc_is 0
proceed_is true
not_said "Refused"

prod_case "prod guard: the same commit under a new tag (a redeploy) proceeds" v1.2.0 "$M3"
SHA="$M3" REF_NAME=v1.2.1 run guard; rc_is 0
proceed_is true

prod_case "prod guard: before source-sha existed, the running version is resolved through its tag" v1.2.0 ""
SHA="$M2" REF_NAME=v1.1.0 run guard; rc_not0
said "ancestor of the running $M3"

prod_case "prod guard: a lower version on a newer commit is refused too" v2.0.0 "$M2"
SHA="$M3" REF_NAME=v1.9.0 run guard; rc_not0
said "lower version than the running v2.0.0"
not_said "ancestor"

prod_case "prod guard: nothing known about prod (first release by digest) proceeds" "" ""
printf '%s' "$BASE/api:latest" >"$FAKE_DIR/img.api"
SHA="$M3" REF_NAME=v1.2.0 run guard; rc_is 0
proceed_is true

prod_case "prod guard: an old commit-tag image still orders by history" "" ""
printf '%s' "$BASE/api:$M3" >"$FAKE_DIR/img.api"
SHA="$M2" REF_NAME=v1.1.0 run guard; rc_not0
said "ancestor of the running $M3"

echo "deploy.sh: $PASS passed, $FAIL failed"
[ "$FAIL" = 0 ]
