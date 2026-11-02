#!/usr/bin/env bash
# Drives candidate.sh against hand-made archives and a fake `docker` on PATH
# (#204). No daemon and no registry: the fake "pushes" by remembering which
# config the archive carried, and answers `imagetools inspect` from that,
# unless told to answer with something else.
#
#   bash .github/scripts/candidate.test.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CANDIDATE="$HERE/candidate.sh"
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT
REF=ghcr.io/yehudabriskman/portfolio_site/web:1111111111111111111111111111111111111111

# ---------------------------------------------------------------- the fake
mkdir -p "$ROOT/bin"
cat >"$ROOT/bin/docker" <<'FAKE'
#!/usr/bin/env bash
# Fake docker. Logs every call.
#   FAKE_PUSHED_CONFIG  the config digest the "registry" reports (default:
#                       whatever the loaded archive carried)
#   FAKE_INDEX=1        the registry answers with an index around the manifest
set -u
F="$FAKE_DIR"
echo "docker $*" >>"$F/calls"
case "$1 ${2-}" in
  "load -i")
    tar -xOf "$3" manifest.json | jq -r '.[0].Config' | sed 's|.*/||; s|\.json$||; s|^|sha256:|' >"$F/loaded" ;;
  "push "*) cp "$F/loaded" "$F/pushed" ;;
  "buildx imagetools")
    cfg="${FAKE_PUSHED_CONFIG:-$(cat "$F/pushed")}"
    m=$(jq -nc --arg c "$cfg" '{mediaType:"application/vnd.oci.image.manifest.v1+json", config:{digest:$c}}')
    if [ "${FAKE_INDEX:-}" = 1 ] && [[ "$*" != *@* ]]; then
      if [ "$4" = --raw ]; then
        jq -nc '{mediaType:"application/vnd.oci.image.index.v1+json", manifests:[
          {digest:"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", platform:{os:"linux", architecture:"amd64"}},
          {digest:"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", platform:{os:"linux", architecture:"arm64"}}]}'
      else echo '{"digest":"sha256:index"}'; fi
    elif [ "$4" = --raw ] || [ "${5-}" = --raw ]; then echo "$m"
    else echo "{\"digest\":\"sha256:${FAKE_MANIFEST_HEX:-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee}\"}"; fi ;;
esac
FAKE
chmod +x "$ROOT/bin/docker"
export PATH="$ROOT/bin:$PATH"

# An archive in BuildKit's layout: manifest.json naming blobs/sha256/<config>.
archive() { # archive DIR ARCH [TAG] -> prints the tar path
  local d="$ROOT/$1" hex
  mkdir -p "$d/blobs/sha256"
  printf '{"architecture":"%s","os":"linux","rootfs":{"type":"layers","diff_ids":[]}}' "$2" >"$d/cfg"
  hex=$(sha256sum "$d/cfg" | cut -d' ' -f1)
  mv "$d/cfg" "$d/blobs/sha256/$hex"
  jq -nc --arg c "blobs/sha256/$hex" --arg t "${3:-$REF}" '[{Config:$c, RepoTags:[$t], Layers:[]}]' >"$d/manifest.json"
  tar -cf "$d.tar" -C "$d" manifest.json blobs
  echo "$d.tar"
}

PASS=0
FAIL=0
run() { # run NAME ARGS... ; sets RC, fresh FAKE_DIR
  CASE="$1"
  shift
  export FAKE_DIR="$ROOT/case.$PASS.$FAIL.$RANDOM"
  mkdir -p "$FAKE_DIR"
  : >"$FAKE_DIR/calls"
  RC=0
  PLATFORM=linux/arm64 PREFIX=web GITHUB_OUTPUT="$FAKE_DIR/output" GITHUB_STEP_SUMMARY="$FAKE_DIR/summary" \
    bash "$CANDIDATE" "$@" >"$FAKE_DIR/out" 2>&1 || RC=$?
}
ok() { PASS=$((PASS + 1)); }
bad() {
  FAIL=$((FAIL + 1))
  echo "FAIL [$CASE]: $1"
  sed 's/^/    /' "$FAKE_DIR/out"
}
rc_is() { if [ "$RC" = "$1" ]; then ok; else bad "exit $RC, wanted $1"; fi; }
said() { if grep -qE -- "$1" "$FAKE_DIR/out"; then ok; else bad "output lacks: $1"; fi; }
called() { if grep -qE -- "$1" "$FAKE_DIR/calls"; then ok; else bad "no call matching: $1"; fi; }
not_called() { if grep -qE -- "$1" "$FAKE_DIR/calls"; then bad "unexpected call matching: $1"; else ok; fi; }

ARM=$(archive arm arm64)
ARM_ID="sha256:$(tar -xOf "$ARM" manifest.json | jq -r '.[0].Config' | sed 's|.*/||')"
ARM_SUM=$(sha256sum "$ARM" | cut -d' ' -f1)

# ------------------------------------------------------------- describe
run "describe: an arm64 candidate reports its identity" describe "$ARM"
rc_is 0
said "image ID $ARM_ID \(linux/arm64\), archive sha256:$ARM_SUM"
if grep -qx "web_id=$ARM_ID" "$FAKE_DIR/output" && grep -qx "web_sha256=$ARM_SUM" "$FAKE_DIR/output"; then ok; else bad "outputs: $(cat "$FAKE_DIR/output")"; fi

run "describe: an amd64 candidate is the wrong platform" describe "$(archive amd amd64)"
rc_is 1
said "Wrong platform"

TAMPER="$ROOT/arm2"
cp -r "$ROOT/arm" "$TAMPER"
f=$(ls "$TAMPER/blobs/sha256")
printf '{"architecture":"arm64","os":"linux","tampered":true}' >"$TAMPER/blobs/sha256/$f"
tar -cf "$TAMPER.tar" -C "$TAMPER" manifest.json blobs
run "describe: a config that does not hash to its name is refused" describe "$TAMPER.tar"
rc_is 1
said "Corrupt candidate"

run "describe: a missing archive is refused" describe "$ROOT/nope.tar"
rc_is 1
said "No candidate"

# -------------------------------------------------------------- publish
export EXPECT_ID="$ARM_ID" EXPECT_SHA256="$ARM_SUM"

run "publish: the scanned archive is pushed and proven identical" publish "$ARM" "$REF"
rc_is 0
called "docker load -i $ARM"
called "docker push $REF"
said "scanned image ID:  $ARM_ID"
said "pushed image ID:   $ARM_ID"
said "pushed manifest:   ${REF%:*}@sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
said "identical"
# The digest Release manifest records and Deploy rolls out (#205).
if grep -qx "web_digest=sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" "$FAKE_DIR/output"; then ok; else bad "outputs: $(cat "$FAKE_DIR/output" 2>/dev/null)"; fi

FAKE_MANIFEST_HEX=nothex run "publish: a registry answer that is not a digest is not recorded" publish "$ARM" "$REF"
rc_is 1
said "No pushed digest"
if grep -q web_digest "$FAKE_DIR/output" 2>/dev/null; then bad "recorded a non-digest"; else ok; fi

EXPECT_SHA256=0000 run "publish: an archive other than the scanned one is never loaded" publish "$ARM" "$REF"
rc_is 1
said "Not the scanned archive"
not_called "docker load"
not_called "docker push"

FAKE_PUSHED_CONFIG="sha256:$(printf '%064d' 9)" run "publish: a registry serving another image fails" publish "$ARM" "$REF"
rc_is 1
said "Pushed image is not the scanned image"

EXPECT_ID="" run "publish: no scanned identity, no push" publish "$ARM" "$REF"
rc_is 1
not_called "docker push"

run "publish: a candidate not tagged with the ref is refused" publish "$ARM" "${REF%:*}:other"
rc_is 1
said "Wrong name"
not_called "docker push"

FAKE_INDEX=1 run "publish: an index is resolved to its arm64 manifest" publish "$ARM" "$REF"
rc_is 0
called "imagetools inspect --raw ${REF%:*}@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
said "pushed manifest:   ${REF%:*}@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

echo "candidate.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" = 0 ]
