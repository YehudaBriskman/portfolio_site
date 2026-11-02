#!/usr/bin/env bash
# The scheduled rescan of what is deployed (#206). Run by the Rescan job of
# .github/workflows/deploy-drift.yml; tested by rescan.test.sh.
#
#   rescan.sh install-trivy   the pinned trivy CLI, checksum verified
#   rescan.sh targets         (on the tailnet) the image each web and api
#                             Deployment in preprod and prod runs, as the
#                             JSON output `targets`
#   rescan.sh scan            scan every distinct digest in $TARGETS with
#                             today's vulnerability database, and say what
#                             each one is: clean, findings, or not scanned
#
# WHY
#
# A scan is evidence about the advisories known on the day it ran. Main CI
# scanned these digests when it built them, and Promote release scanned prod's
# again on the day it was tagged; neither says anything about an advisory
# published since. So this scans the exact digests the clusters run, never a
# tag, and builds and deploys nothing.
#
# THE POLICY is CI's, unchanged (see the Scan image job in ci.yml): every
# CRITICAL, fixed or not, and every HIGH that has a fix, after the reviewed
# exceptions in .trivyignore.yaml. One JSON report per digest, evaluated here,
# rather than two exit-code runs, so the result can say which it was.
#
# THREE OUTCOMES, kept apart, because they need different people:
#
#   exit 0  every running digest scanned clean
#   exit 1  a finding: a digest that is running now fails the policy. Fix
#           and release, or record a reviewed exception.
#   exit 2  a scanner error: the database could not be fetched, is stale, or
#           a scan did not complete. Nothing is known about the images; that
#           is not the same as "clean", and it is not the same as "vulnerable".
#
# Both a finding and an error: exit 2, with both annotated.
#
# Inputs are environment variables, named where they are used. trivy and
# kubectl are called by name, which is what lets rescan.test.sh run this
# against fakes.
set -Eeuo pipefail

NAMESPACES=(preprod prod)
APPS=(web api)

die() {
  echo "::error title=$1::$2" >&2
  exit 2
}

# ---------------------------------------------------------------- install-trivy
#
# The version trivy-action v0.36.0 installs for Scan image and Promote
# release, so a finding here is one CI would have reported too. Checked
# against the sha256 trivy's release publishes. Bumping it is a deliberate
# edit, together with the trivy-action pin in ci.yml.
TRIVY_VERSION=0.70.0
TRIVY_SHA256_X64=8b4376d5d6befe5c24d503f10ff136d9e0c49f9127a4279fd110b727929a5aa9
install_trivy() {
  local dir="${RUNNER_TEMP:?}/trivy" tgz="trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz"
  [ "${RUNNER_ARCH:-X64}" = X64 ] || die "No trivy for ${RUNNER_ARCH}" "rescan.sh pins the linux amd64 build only"
  mkdir -p "$dir"
  curl -fsSLo "$dir/$tgz" "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/$tgz"
  echo "$TRIVY_SHA256_X64  $dir/$tgz" | sha256sum -c -
  tar -xzf "$dir/$tgz" -C "$dir" trivy
  echo "$dir" >>"${GITHUB_PATH:?}"
  "$dir/trivy" --version
}

# ---------------------------------------------------------------------- targets
#
# What each Deployment's pod template says, which since #205 is
# `<repo>@sha256:<digest>`. An unreadable Deployment becomes an empty image
# (reported, not scanned) rather than stopping the others.
targets() {
  local ns app image json="[]"
  for ns in "${NAMESPACES[@]}"; do
    for app in "${APPS[@]}"; do
      image=$(kubectl -n "$ns" get deploy "$app" \
        -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || true)
      json=$(jq -c --arg env "$ns" --arg app "$app" --arg image "$image" \
        '. + [{env: $env, app: $app, image: $image}]' <<<"$json")
    done
  done
  printf 'targets=%s\n' "$json" >>"${GITHUB_OUTPUT:-/dev/null}"
  echo "targets=$json"
}

# ------------------------------------------------------------------------- scan
summary() { printf '%s\n' "$@" >>"${GITHUB_STEP_SUMMARY:-/dev/null}"; }

scan() {
  : "${TARGETS:?}"
  local cache="${TRIVY_CACHE_DIR:-${RUNNER_TEMP:-/tmp}/trivy-cache}"
  local ignorefile="${TRIVYIGNORE:-.trivyignore.yaml}"
  local max_age="${MAX_DB_AGE_HOURS:-48}"
  local out="${REPORT_DIR:-${RUNNER_TEMP:-/tmp}/rescan}"
  local errors=0 findings=0 scanned=0
  mkdir -p "$out"
  jq -e 'type == "array"' >/dev/null <<<"$TARGETS" || die "Scanner error: no targets" "TARGETS is not a JSON array"
  [ -f "$ignorefile" ] || die "Scanner error: no exceptions file" "$ignorefile is missing; the policy cannot be applied without it"

  # The database, once, before any image: every digest is judged against the
  # same one, and a download failure is named as what it is.
  if ! trivy image --download-db-only --cache-dir "$cache" --quiet; then
    summary "### Rescan of deployed images" "" "**Scanner error:** the vulnerability database could not be downloaded. Nothing was scanned."
    die "Scanner error: vulnerability DB" "trivy could not download its vulnerability database. Nothing was scanned; this is not a clean result."
  fi
  local ver updated age_h
  ver=$(trivy version --format json --cache-dir "$cache") || die "Scanner error: trivy version" "trivy version failed"
  updated=$(jq -r '.VulnerabilityDB.UpdatedAt // empty' <<<"$ver")
  [ -n "$updated" ] || die "Scanner error: vulnerability DB" "trivy reports no database after downloading it"
  age_h=$(( ($(date -u +%s) - $(date -u -d "$updated" +%s)) / 3600 ))
  # Upstream rebuilds the database every six hours. One two days old means
  # the download served something stale, and "clean" against it means little.
  if [ "$age_h" -gt "$max_age" ]; then
    summary "### Rescan of deployed images" "" "**Scanner error:** the vulnerability database is ${age_h}h old (built $updated, limit ${max_age}h)."
    die "Scanner error: stale vulnerability DB" "The database trivy downloaded was built $updated, ${age_h}h ago (limit ${max_age}h)."
  fi

  summary "### Rescan of deployed images" "" \
    "Today's vulnerability DB (built \`$updated\`, trivy $TRIVY_VERSION), CI's policy: CRITICAL fixed or not, HIGH where a fix exists, after \`$ignorefile\`." "" \
    "| environment | component | image | CRITICAL | HIGH, fixed | HIGH, no fix | result |" \
    "|---|---|---|---|---|---|---|"

  # Distinct digests: preprod and prod often run the same one.
  declare -A verdict=() counts=()
  local row env app image d short report key c result
  while IFS= read -r row; do
    env=$(jq -r .env <<<"$row"); app=$(jq -r .app <<<"$row"); image=$(jq -r .image <<<"$row")
    if [ -z "$image" ]; then
      echo "::warning title=$env/$app unreadable::Could not read the $app Deployment in $env, so its image was not rescanned."
      summary "| \`$env\` | $app | unreadable | — | — | — | not scanned |"
      continue
    fi
    if [[ ! "$image" =~ @sha256:[0-9a-f]{64}$ ]]; then
      # A tag can point anywhere by the time it is pulled; scanning it would
      # vouch for something that may not be what runs. Deploy pins digests,
      # so a tag here was applied by hand.
      echo "::warning title=$env/$app is not pinned to a digest::It runs '$image'. Deploy rolls out digests only; this was probably applied by hand. Not rescanned."
      summary "| \`$env\` | $app | \`$image\` | — | — | — | not a digest, not scanned |"
      continue
    fi
    d="${image#*@sha256:}"; short="${image%%@*}@sha256:${d:0:12}…"
    if [ -z "${verdict[$image]+x}" ]; then
      key=$(sha256sum <<<"$image" | cut -c1-16)
      report="$out/trivy-$key.json"
      if trivy image "$image" --cache-dir "$cache" --skip-db-update --quiet \
          --scanners vuln --severity HIGH,CRITICAL --ignorefile "$ignorefile" \
          --format json --exit-code 0 --output "$report" &&
         c=$(jq -ec '[.Results[]?.Vulnerabilities[]?] | {
              critical: (map(select(.Severity == "CRITICAL")) | length),
              high_fixed: (map(select(.Severity == "HIGH" and (.FixedVersion // "") != "")) | length),
              high_unfixed: (map(select(.Severity == "HIGH" and (.FixedVersion // "") == "")) | length)}' "$report"); then
        counts[$image]="$c"
        if jq -e '.critical > 0 or .high_fixed > 0' >/dev/null <<<"$c"; then
          verdict[$image]=findings
          # Advisory ids and packages only; no image content is printed.
          jq -r --arg img "$image" '[.Results[]?.Vulnerabilities[]?
              | select(.Severity == "CRITICAL" or (.Severity == "HIGH" and (.FixedVersion // "") != ""))]
              | unique_by(.VulnerabilityID + .PkgName)[]
              | "::error title=Vulnerability in a running image::\(.VulnerabilityID) (\(.Severity)) in \(.PkgName) \(.InstalledVersion), fixed in \(.FixedVersion // "no release") - running in \($img)"' "$report"
        else
          verdict[$image]=clean
        fi
      else
        verdict[$image]=error
        counts[$image]='{}'
        echo "::error title=Scanner error: $env/$app::trivy did not complete a scan of $image. Nothing is known about it; this is not a clean result."
      fi
      scanned=$((scanned + 1))
    fi
    c="${counts[$image]}"
    case "${verdict[$image]}" in
      clean) result="clean" ;;
      findings) result="**FINDINGS**"; findings=1 ;;
      *) result="**SCANNER ERROR**"; errors=1 ;;
    esac
    summary "| \`$env\` | $app | \`$short\` | $(jq -r '.critical // "—"' <<<"$c") | $(jq -r '.high_fixed // "—"' <<<"$c") | $(jq -r '.high_unfixed // "—"' <<<"$c") | $result |"
    echo "$env/$app: $image -> ${verdict[$image]} $c"
  done < <(jq -c '.[]' <<<"$TARGETS")

  if [ "$scanned" -eq 0 ]; then
    summary "" "**Scanner error:** no running digest could be read, so nothing was scanned."
    die "Scanner error: nothing scanned" "No Deployment reported a digest. This is not a clean result."
  fi
  if [ "$errors" -ne 0 ]; then
    summary "" "**Scanner error.** At least one digest was not scanned to completion; its result is unknown, not clean."
    exit 2
  fi
  if [ "$findings" -ne 0 ]; then
    summary "" "**Findings.** A running image fails CI's policy against today's database. Fix and release it, or record a reviewed exception in \`$ignorefile\`."
    exit 1
  fi
  summary "" "Every running digest is clean against today's database."
}

case "${1-}" in
  install-trivy) install_trivy ;;
  targets) targets ;;
  scan) scan ;;
  *)
    echo "usage: $0 install-trivy | targets | scan" >&2
    exit 2
    ;;
esac
