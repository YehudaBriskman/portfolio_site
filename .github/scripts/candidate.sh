#!/usr/bin/env bash
# One image candidate per component: built once, scanned, and published as
# the same bytes (#204).
#
#   candidate.sh describe TAR      check what TAR holds and print its identity
#   candidate.sh publish TAR REF   push TAR's image as REF, then prove the
#                                  registry holds the image that was scanned
#
# TAR is the docker-archive BuildKit writes for `outputs: type=docker,dest=`.
# The scan job builds it, runs Trivy over it and calls `describe`; Publish
# image downloads the same file and calls `publish`. Nothing in between
# builds anything.
#
# Inputs (environment):
#   describe: PLATFORM (linux/arm64), PREFIX (the image name, for the outputs
#             `<PREFIX>_id` and `<PREFIX>_sha256` in $GITHUB_OUTPUT)
#   publish:  PLATFORM, EXPECT_ID and EXPECT_SHA256 (the scan job's outputs),
#             PREFIX (for the output `<PREFIX>_digest`, the pushed manifest)
#
# WHAT "THE SAME BYTES" IS CHECKED AGAINST
#
# The image ID: the digest of the image's config. The config names every
# layer by the digest of its *uncompressed* content (rootfs.diff_ids), and
# carries the platform, entrypoint, env and labels, so one ID is one
# filesystem and one configuration. It is the identity that survives
# `docker load` and `docker push`. The manifest digest does not: it covers
# the compressed layers, and a push may compress again. So the registry's
# manifest digest is printed (it is what the cluster pulls and what Deploy
# records), and the assertion is that the manifest it names carries the
# config the scan saw.
#
# Before loading, the archive itself is checked against the sha256 the scan
# job recorded, so the file that was scanned is the file that is loaded.
set -Eeuo pipefail

die() {
  echo "::error title=$1::$2" >&2
  exit 1
}

# The config's path inside the archive: `blobs/sha256/<hex>` from BuildKit's
# OCI-flavoured archive, `<hex>.json` from an older `docker save`.
config_path() {
  tar -xOf "$1" manifest.json |
    jq -er 'if length == 1 then .[0].Config else error("expected one image, found \(length)") end'
}

describe() {
  local tar="$1" cfg hex actual plat sum
  : "${PLATFORM:?}" "${PREFIX:?}"
  [ -s "$tar" ] || die "No candidate" "$tar is missing or empty"
  cfg=$(config_path "$tar") || die "Unreadable candidate" "$tar has no single-image manifest.json"
  hex=${cfg##*/}
  hex=${hex%.json}
  [[ $hex =~ ^[0-9a-f]{64}$ ]] || die "Unreadable candidate" "manifest.json names config '$cfg'"
  # The name is a claim; the content is the fact.
  actual=$(tar -xOf "$tar" "$cfg" | sha256sum | cut -d' ' -f1)
  [ "$actual" = "$hex" ] || die "Corrupt candidate" "config $cfg hashes to $actual"
  plat=$(tar -xOf "$tar" "$cfg" | jq -r '.os + "/" + .architecture')
  [ "$plat" = "$PLATFORM" ] || die "Wrong platform" "the candidate is $plat; the cluster runs $PLATFORM"
  sum=$(sha256sum "$tar" | cut -d' ' -f1)
  echo "scanned candidate: image ID sha256:$hex ($plat), archive sha256:$sum"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    printf '%s_id=sha256:%s\n%s_sha256=%s\n' "$PREFIX" "$hex" "$PREFIX" "$sum" >>"$GITHUB_OUTPUT"
  fi
}

publish() {
  local tar="$1" ref="$2" sum raw manifest digest pushed_id media d
  : "${PLATFORM:?}" "${EXPECT_ID:?}" "${EXPECT_SHA256:?}"
  [[ $EXPECT_ID =~ ^sha256:[0-9a-f]{64}$ ]] || die "No scanned identity" "EXPECT_ID is '$EXPECT_ID'; the scan job did not report one"
  sum=$(sha256sum "$tar" | cut -d' ' -f1)
  [ "$sum" = "$EXPECT_SHA256" ] ||
    die "Not the scanned archive" "the downloaded candidate hashes to $sum; the scan job recorded $EXPECT_SHA256"
  tar -xOf "$tar" manifest.json | jq -e --arg r "$ref" '.[0].RepoTags | index($r) != null' >/dev/null ||
    die "Wrong name" "the candidate is not tagged $ref"

  docker load -i "$tar"
  docker push "$ref"

  # What the registry now serves under that tag. A single-platform push is
  # one manifest; should a daemon ever push an index instead, the leg for
  # PLATFORM is the one the cluster pulls.
  raw=$(docker buildx imagetools inspect --raw "$ref")
  digest=$(docker buildx imagetools inspect "$ref" --format '{{json .Manifest}}' | jq -r .digest)
  media=$(jq -r '.mediaType // ""' <<<"$raw")
  manifest="$raw"
  case "$media" in
    *manifest.list*|*image.index*)
      d=$(jq -r --arg os "${PLATFORM%/*}" --arg arch "${PLATFORM#*/}" \
        '[.manifests[] | select(.platform.os == $os and .platform.architecture == $arch)][0].digest // empty' <<<"$raw")
      [ -n "$d" ] || die "Wrong platform pushed" "$ref is an index with no $PLATFORM entry"
      manifest=$(docker buildx imagetools inspect --raw "${ref%:*}@$d")
      digest="$d"
      ;;
  esac
  pushed_id=$(jq -r '.config.digest // empty' <<<"$manifest")

  echo "scanned image ID:  $EXPECT_ID"
  echo "pushed manifest:   ${ref%:*}@$digest"
  echo "pushed image ID:   ${pushed_id:-none}"
  [ "$pushed_id" = "$EXPECT_ID" ] ||
    die "Pushed image is not the scanned image" "$ref carries config ${pushed_id:-none}; the scan saw $EXPECT_ID"
  echo "identical: the registry holds the image that was scanned"
  # The digest the release manifest records and Deploy rolls out (#205), as
  # `<PREFIX>_digest`. Only a real digest: a deploy pins exactly this string.
  [[ $digest =~ ^sha256:[0-9a-f]{64}$ ]] || die "No pushed digest" "the registry answered '$digest' for $ref"
  if [ -n "${GITHUB_OUTPUT:-}" ] && [ -n "${PREFIX:-}" ]; then
    printf '%s_digest=%s\n' "$PREFIX" "$digest" >>"$GITHUB_OUTPUT"
  fi
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    printf '| Published | Scanned image ID | Pushed manifest |\n|---|---|---|\n| %s | %s | %s |\n' \
      "$ref" "$EXPECT_ID" "$digest" >>"$GITHUB_STEP_SUMMARY"
  fi
}

case "${1-}" in
  describe) describe "$2" ;;
  publish) publish "$2" "$3" ;;
  *)
    echo "usage: $0 describe TAR | publish TAR REF" >&2
    exit 2
    ;;
esac
