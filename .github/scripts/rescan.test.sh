#!/usr/bin/env bash
# Drives rescan.sh against a fake `trivy` and `kubectl` on PATH (#206). No
# cluster, no registry, no database download.
#
# What it holds: CI's policy (CRITICAL fixed or not, HIGH only with a fix);
# a finding (exit 1) and a scanner error (exit 2) are told apart, and an
# error is never reported as clean; the database is fetched once and every
# scan uses it without updating; a stale database is an error; a digest two
# environments share is scanned once; a tag or an unreadable Deployment is
# reported and not scanned; and the exceptions file is always passed.
#
#   bash .github/scripts/rescan.test.sh
#
# The summary is Markdown, so the patterns below match literal backticks.
# shellcheck disable=SC2016
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESCAN="$HERE/rescan.sh"
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT

BASE=ghcr.io/yehudabriskman/portfolio_site
WEB="$BASE/web@sha256:$(printf 'a%.0s' {1..64})"
API="$BASE/api@sha256:$(printf 'b%.0s' {1..64})"
OLD_API="$BASE/api@sha256:$(printf 'c%.0s' {1..64})"

mkdir -p "$ROOT/bin"
cat >"$ROOT/bin/trivy" <<'FAKE'
#!/usr/bin/env bash
# Fake trivy.
#   FAKE_DB_FAIL=1     --download-db-only fails
#   FAKE_DB_UPDATED    the database's UpdatedAt (default: an hour ago)
#   FAKE_SCAN_FAIL     regex; scanning a matching ref exits 1
# A scan writes $FAKE_DIR/reports/<last 4 hex of the ref>.json, or no findings.
set -u
F="$FAKE_DIR"
echo "trivy $*" >>"$F/calls"
case "$1" in
  --version) echo "Version: 0.70.0"; exit 0 ;;
  version) jq -n --arg u "${FAKE_DB_UPDATED:-$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)}" \
             '{Version: "0.70.0", VulnerabilityDB: {Version: 2, UpdatedAt: $u}}'; exit 0 ;;
esac
[ "$1" = image ] || exit 9
if [[ " $* " == *" --download-db-only "* ]]; then
  [ "${FAKE_DB_FAIL:-0}" = 1 ] && { echo "FATAL db download failed" >&2; exit 1; }
  exit 0
fi
ref="$2"; out=""
shift 2
while [ $# -gt 0 ]; do [ "$1" = --output ] && out="$2"; shift; done
if [ -n "${FAKE_SCAN_FAIL:-}" ] && [[ "$ref" =~ $FAKE_SCAN_FAIL ]]; then
  echo "FATAL unable to pull $ref" >&2; exit 1
fi
r="$F/reports/${ref: -4}.json"
if [ -f "$r" ]; then cp "$r" "$out"; else echo '{"Results":[{"Target":"x"}]}' >"$out"; fi
FAKE

cat >"$ROOT/bin/kubectl" <<'FAKE'
#!/usr/bin/env bash
# Fake kubectl: `-n NS get deploy APP -o jsonpath=...` answers $FAKE_DIR/img.NS.APP,
# or fails when there is no such file.
set -u
ns="$2"; app="$5"
f="$FAKE_DIR/img.$ns.$app"
[ -f "$f" ] || { echo "Error from server (NotFound)" >&2; exit 1; }
cat "$f"
FAKE
chmod +x "$ROOT/bin/"*

vuln() { # severity id fixed
  jq -n --arg s "$1" --arg id "$2" --arg f "$3" \
    '{VulnerabilityID: $id, PkgName: "pkg", InstalledVersion: "1.0", Severity: $s} + (if $f == "" then {} else {FixedVersion: $f} end)'
}
report() { # name vuln...
  local name="$1"; shift
  printf '%s\n' "$@" | jq -s '{Results: [{Target: "t", Vulnerabilities: .}]}' >"$FAKE_DIR/reports/$name.json"
}

pass=0
fail=0
ok() { pass=$((pass + 1)); echo "ok   - $1"; }
no() { fail=$((fail + 1)); echo "FAIL - $1"; sed 's/^/       /' "$FAKE_DIR/out" | tail -20; }

setup() {
  export FAKE_DIR="$ROOT/case-$1"
  rm -rf "$FAKE_DIR"; mkdir -p "$FAKE_DIR/reports" "$FAKE_DIR/work"
  : >"$FAKE_DIR/calls"
  unset FAKE_DB_FAIL FAKE_DB_UPDATED FAKE_SCAN_FAIL
  export GITHUB_STEP_SUMMARY="$FAKE_DIR/summary" GITHUB_OUTPUT="$FAKE_DIR/output"
  export REPORT_DIR="$FAKE_DIR/reports-out" TRIVY_CACHE_DIR="$FAKE_DIR/cache"
  export TRIVYIGNORE="$FAKE_DIR/work/.trivyignore.yaml"
  echo 'vulnerabilities: []' >"$TRIVYIGNORE"
  export TARGETS
  TARGETS=$(jq -nc --arg w "$WEB" --arg a "$API" \
    '[{env: "preprod", app: "web", image: $w}, {env: "preprod", app: "api", image: $a},
      {env: "prod", app: "web", image: $w}, {env: "prod", app: "api", image: $a}]')
}
run() { # expected-exit
  local rc=0
  PATH="$ROOT/bin:$PATH" bash "$RESCAN" scan >"$FAKE_DIR/out" 2>&1 || rc=$?
  [ "$rc" = "$1" ]
}
scans() { grep -c -- '--skip-db-update' "$FAKE_DIR/calls" || true; }

# --------------------------------------------------------------------- cases
setup clean
if run 0 && grep -q '| `prod` | api | .* | 0 | 0 | 0 | clean |' "$GITHUB_STEP_SUMMARY"; then
  ok "clean images exit 0 with a clean row per environment"
else no "clean"; fi

setup dedupe
run 0 || true
if [ "$(scans)" = 2 ] && [ "$(grep -c -- '--download-db-only' "$FAKE_DIR/calls")" = 1 ]; then
  ok "one database download, one scan per distinct digest (2 for 4 rows)"
else no "dedupe: $(scans) scans"; fi

setup policy-args
run 0 || true
if ! grep -- '--skip-db-update' "$FAKE_DIR/calls" | grep -v -- "--ignorefile $TRIVYIGNORE" | grep -q . &&
   ! grep -- '--skip-db-update' "$FAKE_DIR/calls" | grep -v -- '--severity HIGH,CRITICAL' | grep -q . &&
   ! grep -- '--skip-db-update' "$FAKE_DIR/calls" | grep -q -- '--ignore-unfixed'; then
  ok "every scan passes the exceptions file and HIGH,CRITICAL, and never --ignore-unfixed"
else no "policy args"; fi

setup unfixed-high
report bbbb "$(vuln HIGH CVE-2026-0001 '')"
if run 0 && grep -q '| `prod` | api | .* | 0 | 0 | 1 | clean |' "$GITHUB_STEP_SUMMARY"; then
  ok "a HIGH without a fix passes, and is counted"
else no "unfixed high"; fi

setup fixed-high
report bbbb "$(vuln HIGH CVE-2026-0002 1.1)"
if run 1 && grep -q 'CVE-2026-0002' "$FAKE_DIR/out" && grep -q 'FINDINGS' "$GITHUB_STEP_SUMMARY" &&
   ! grep -q 'Scanner error' "$FAKE_DIR/out"; then
  ok "a HIGH with a fix is a finding: exit 1, named, not a scanner error"
else no "fixed high"; fi

setup unfixed-critical
report aaaa "$(vuln CRITICAL CVE-2026-0003 '')"
if run 1 && grep -q 'CVE-2026-0003' "$FAKE_DIR/out"; then
  ok "a CRITICAL fails whether or not a fix exists"
else no "unfixed critical"; fi

setup db-fail
export FAKE_DB_FAIL=1
if run 2 && [ "$(scans)" = 0 ] && grep -q 'Scanner error: vulnerability DB' "$FAKE_DIR/out" &&
   ! grep -q 'clean' "$GITHUB_STEP_SUMMARY"; then
  ok "a database download failure is a scanner error (exit 2), nothing scanned, nothing called clean"
else no "db fail"; fi

setup db-stale
export FAKE_DB_UPDATED
FAKE_DB_UPDATED=$(date -u -d '3 days ago' +%Y-%m-%dT%H:%M:%SZ)
if run 2 && [ "$(scans)" = 0 ] && grep -q 'stale vulnerability DB' "$FAKE_DIR/out"; then
  ok "a database older than 48h is a scanner error"
else no "db stale"; fi

setup scan-fail
export FAKE_SCAN_FAIL='/api@'
if run 2 && grep -q 'Scanner error: preprod/api' "$FAKE_DIR/out" &&
   grep -q '| `prod` | api | .* | \*\*SCANNER ERROR' "$GITHUB_STEP_SUMMARY" &&
   grep -q '| `prod` | web | .* | clean |' "$GITHUB_STEP_SUMMARY"; then
  ok "a failed scan is a scanner error for that digest; the others still report"
else no "scan fail"; fi

setup error-and-finding
export FAKE_SCAN_FAIL='/api@'
report aaaa "$(vuln CRITICAL CVE-2026-0004 2.0)"
if run 2 && grep -q 'CVE-2026-0004' "$FAKE_DIR/out"; then
  ok "a finding and an error together exit 2, with the finding still named"
else no "error and finding"; fi

setup not-a-digest
TARGETS=$(jq -nc --arg w "$WEB" --arg base "$BASE" \
  '[{env: "preprod", app: "web", image: $w}, {env: "prod", app: "api", image: ($base + "/api:latest")},
    {env: "prod", app: "web", image: ""}]')
if run 0 && [ "$(scans)" = 1 ] && grep -q 'not a digest, not scanned' "$GITHUB_STEP_SUMMARY" &&
   grep -q '| `prod` | web | unreadable' "$GITHUB_STEP_SUMMARY"; then
  ok "a tag or an unreadable Deployment is reported and not scanned"
else no "not a digest"; fi

setup nothing
TARGETS='[{"env":"prod","app":"api","image":""}]'
if run 2 && grep -q 'nothing scanned' "$FAKE_DIR/out"; then
  ok "nothing scannable is a scanner error, never clean"
else no "nothing"; fi

setup targets
echo -n "$WEB" >"$FAKE_DIR/img.preprod.web"; echo -n "$API" >"$FAKE_DIR/img.preprod.api"
echo -n "$WEB" >"$FAKE_DIR/img.prod.web"; echo -n "$OLD_API" >"$FAKE_DIR/img.prod.api"
rc=0; PATH="$ROOT/bin:$PATH" bash "$RESCAN" targets >"$FAKE_DIR/out" 2>&1 || rc=$?
got=$(sed -n 's/^targets=//p' "$GITHUB_OUTPUT")
if [ "$rc" = 0 ] && [ "$(jq -r '.[] | select(.env == "prod" and .app == "api") | .image' <<<"$got")" = "$OLD_API" ] &&
   [ "$(jq length <<<"$got")" = 4 ]; then
  ok "targets reads web and api in preprod and prod"
else no "targets"; fi

setup targets-unreadable
echo -n "$WEB" >"$FAKE_DIR/img.preprod.web"
rc=0; PATH="$ROOT/bin:$PATH" bash "$RESCAN" targets >"$FAKE_DIR/out" 2>&1 || rc=$?
got=$(sed -n 's/^targets=//p' "$GITHUB_OUTPUT")
if [ "$rc" = 0 ] && [ "$(jq '[.[] | select(.image == "")] | length' <<<"$got")" = 3 ]; then
  ok "an unreadable Deployment is an empty image, not a stopped job"
else no "targets unreadable"; fi

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
