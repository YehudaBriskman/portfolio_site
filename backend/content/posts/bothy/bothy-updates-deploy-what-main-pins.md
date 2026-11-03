---
{
  "slug": "bothy-updates-deploy-what-main-pins",
  "title": "An updater that cannot choose the version",
  "subtitle": "How Bothy keeps its own stack current without letting the update button decide what to run",
  "excerpt": "Bothy's updater deploys only what the main branch already pins. It checks before, snapshots, verifies by response body, rolls back on failure, and never replaces itself mid-run.",
  "tags": ["bothy", "updates", "ci", "self-hosting"],
  "collection": "bothy",
  "status": "published",
  "publishedAt": "2026-11-02T09:50:00Z",
  "readingMinutes": 3,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "Bothy guide, Upgrading", "url": "https://github.com/YehudaBriskman/Bothy/blob/main/docs/guide/upgrading.md" }
  ],
  "sources": [
    { "label": "Bothy PR #181, CI-gated tagging", "url": "https://github.com/YehudaBriskman/Bothy/pull/181" },
    { "label": "Bothy PR #195, the host updater", "url": "https://github.com/YehudaBriskman/Bothy/pull/195" },
    { "label": "Bothy PR #200, automatic patches at night", "url": "https://github.com/YehudaBriskman/Bothy/pull/200" },
    { "label": "Bothy PR #205, Bothy updates itself", "url": "https://github.com/YehudaBriskman/Bothy/pull/205" }
  ]
}
---
A self-hosted stack goes stale quietly. Dependabot opens pull requests for
newer images, the pull requests get merged, and the machine keeps running
whatever it was started with. Bothy's Settings now has an Updates page that
closes that gap. This work is on `main` and arrives in the release after
2026.9.

The design rests on one decision.

## The updater deploys only what main pins

The updater never picks a version. It does not write a newer pin, commit
anything, or move the checkout. If a newer image exists but `main` does not
pin it yet, the update is simply not offered: merge its pull request first,
and the updater will see it.

That keeps git as the only source of truth. Every version the machine runs
went through review and CI, and the working tree stays clean. The one
exception is rollback, which restores the previous pin as a single,
deliberately uncommitted line, so it stands out in `git status` as a
decision rather than drift.

It also bounds what the request side of the system can do. The service that
asks for an update can choose *when*, and nothing else: not the version, the
image, a file or a command.

## Every update follows the same steps

Plans are computed ahead of time from the current commit, the running image
and the image digest. If any of those change, the plan is stale and is
refused rather than reinterpreted. Then each update runs the same sequence:

1. **Pre-flight.** A recent backup, enough disk, healthy services, and a
   proof that the change recreates only the service being updated.
2. **Snapshot**, keeping the last three per component.
3. **Pull**, requiring the exact digest that was planned.
4. **Verify** with checks that read response bodies, not just status codes.
5. **Roll back** if verification fails.

## Patches at night, and a pause on failure

Patch releases on an automatic channel can update themselves in a night
window, at most one per night, and only after that night's backup has
succeeded. A failed or rolled-back update pauses automatic updates for that
component until an operator clears it, and raises an alert. A night that is
missed is skipped, not caught up in the middle of the next day.

## Bothy updates itself last, and carefully

Bothy's own code follows a stricter path. It only moves to the newest
release tag whose CI passed in full. New images are built before anything
live is touched, and a ten-minute rollback timer is armed before the switch.
If verification never confirms the new version, the timer restores the
previous one, with no rebuild needed.

The updater also never replaces itself while it is running. A release that
changes the updater stages the new copy, and Settings says a switch is
pending.

## Releases that are safe to trust

All of this depends on one property upstream: a release tag always points at
a commit that passed CI. Bothy's release workflow tags only after CI succeeds
on `main`, and never tags a commit whose checks failed. The updater's job is
easier because the releases it trusts were made to be trusted.
