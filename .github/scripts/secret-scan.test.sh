#!/usr/bin/env bash
# Drives secret-scan.sh against real git in a throwaway repository and a fake
# `gitleaks` on PATH (#206). No network.
#
# What it holds: a pull request scans base..head, so every intermediate
# commit; a push to main scans before..after, and its whole history when
# `before` is unusable; a tag scans nothing and says so; a missing range end
# is an error, never a smaller scan; values are always redacted; and a
# finding (exit 3) is told apart from gitleaks failing.
#
#   bash .github/scripts/secret-scan.test.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCAN="$HERE/secret-scan.sh"
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT

mkdir -p "$ROOT/bin"
cat >"$ROOT/bin/gitleaks" <<'FAKE'
#!/usr/bin/env bash
# Fake gitleaks: logs its arguments, exits $FAKE_RC (default 0).
printf '%s\n' "$*" >>"$FAKE_DIR/calls"
exit "${FAKE_RC:-0}"
FAKE
chmod +x "$ROOT/bin/gitleaks"

REPO="$ROOT/repo"
git init -q -b main "$REPO"
c() { git -C "$REPO" -c user.name=t -c user.email=t@t commit -q --allow-empty -m "$1"; git -C "$REPO" rev-parse HEAD; }
A=$(c a); B=$(c b)
git -C "$REPO" checkout -q -b topic
C1=$(c c1); C2=$(c c2)
git -C "$REPO" checkout -q main
D=$(c d)

pass=0
fail=0
ok() { pass=$((pass + 1)); echo "ok   - $1"; }
no() { fail=$((fail + 1)); echo "FAIL - $1"; sed 's/^/       /' "$FAKE_DIR/out" | tail -10; }

setup() {
  export FAKE_DIR="$ROOT/case-$1"
  rm -rf "$FAKE_DIR"; mkdir -p "$FAKE_DIR"; : >"$FAKE_DIR/calls"
  unset EVENT_NAME REF BASE_SHA HEAD_SHA BEFORE AFTER MODE FAKE_RC
}
run() { # expected-exit command
  local rc=0
  (cd "$REPO" && PATH="$ROOT/bin:$PATH" bash "$SCAN" "$2") >"$FAKE_DIR/out" 2>&1 || rc=$?
  [ "$rc" = "$1" ]
}
called() { grep -qF -- "$1" "$FAKE_DIR/calls"; }

setup pr
export EVENT_NAME=pull_request BASE_SHA="$B" HEAD_SHA="$C2"
if run 0 scan && called "--log-opts=$B..$C2" && grep -q 'Scanning 2 commit' "$FAKE_DIR/out"; then
  ok "a pull request scans base..head, intermediate commits included (2)"
else no "pr"; fi

setup redact
export EVENT_NAME=pull_request BASE_SHA="$B" HEAD_SHA="$C2"
if run 0 scan && called "--redact" && ! grep -q -- '--report' "$FAKE_DIR/calls"; then
  ok "values are redacted and no report file is written"
else no "redact"; fi

setup pr-missing-base
export EVENT_NAME=pull_request BASE_SHA=1234567890123456789012345678901234567890 HEAD_SHA="$C2"
if run 2 scan && [ ! -s "$FAKE_DIR/calls" ] && grep -q 'no base' "$FAKE_DIR/out"; then
  ok "a base missing from the clone is an error, and nothing is scanned"
else no "pr missing base"; fi

setup push
export EVENT_NAME=push REF=refs/heads/main BEFORE="$B" AFTER="$D"
if run 0 scan && called "--log-opts=$B..$D"; then
  ok "a push to main scans before..after"
else no "push"; fi

setup push-new
export EVENT_NAME=push REF=refs/heads/main BEFORE=0000000000000000000000000000000000000000 AFTER="$D"
if run 0 scan && called "--log-opts=$D" && grep -q 'Scanning 3 commit' "$FAKE_DIR/out"; then
  ok "a push with no before scans everything reachable from after"
else no "push new"; fi

setup push-forced
export EVENT_NAME=push REF=refs/heads/main BEFORE="$C2" AFTER="$D"
if run 0 scan && called "--log-opts=$D"; then
  ok "a force push (before not an ancestor) scans everything reachable from after"
else no "push forced"; fi

setup tag
export EVENT_NAME=push REF=refs/tags/v1.0.0 BEFORE=0000000000000000000000000000000000000000 AFTER="$D"
if run 0 scan && [ ! -s "$FAKE_DIR/calls" ] && grep -q '::notice' "$FAKE_DIR/out"; then
  ok "a tag scans nothing and says so"
else no "tag"; fi

setup full
export MODE=full EVENT_NAME=schedule
if run 0 scan && called "--log-opts=--all"; then
  ok "MODE=full scans every ref"
else no "full"; fi

setup finding
export EVENT_NAME=pull_request BASE_SHA="$B" HEAD_SHA="$C2" FAKE_RC=3
if run 3 scan && grep -q 'title=Secret committed' "$FAKE_DIR/out"; then
  ok "a finding exits 3 and says to rotate"
else no "finding"; fi

setup broken
export EVENT_NAME=pull_request BASE_SHA="$B" HEAD_SHA="$C2" FAKE_RC=1
if run 2 scan && grep -q 'did not run' "$FAKE_DIR/out" && ! grep -q 'Secret committed' "$FAKE_DIR/out"; then
  ok "gitleaks failing is a scanner error (exit 2), not a finding and not clean"
else no "broken"; fi

: "$A" "$C1"
echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
