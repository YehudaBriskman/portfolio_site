---
{
  "slug": "windom-1-4-1-reliability",
  "title": "WindoM 1.4.1: a release about not breaking",
  "subtitle": "Readiness checks, a release gate, session controls and a GitHub widget",
  "excerpt": "Database migrations leave server startup, health checks start telling the truth, every release passes one shared gate, and users can see and revoke their sessions.",
  "tags": ["windom", "release", "ci", "auth"],
  "collection": "windom",
  "status": "published",
  "publishedAt": "2026-10-20T12:00:00Z",
  "readingMinutes": 2,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "Changelog", "url": "https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md" }
  ],
  "sources": [
    { "label": "WindoM CHANGELOG, 1.4.1", "url": "https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md" },
    { "label": "PR #308, stop a read-only database from taking the API down", "url": "https://github.com/YehudaBriskman/WindoM/pull/308" },
    { "label": "PR #309, make a version tag prove it is releasable", "url": "https://github.com/YehudaBriskman/WindoM/pull/309" }
  ]
}
---
Most of 1.4.1 is invisible by design. It is a hardening and reliability
release: one new feature, and a long list of changes whose purpose is that the
next failure is caught early, reported honestly, or does not happen.

## The API no longer depends on migrations to start

Database migrations used to run as part of server startup, so a database
that refused writes stopped the API from starting at all. Migrations now run
once per deploy, as a separate release step. The API also gained a readiness
endpoint, and its health check now looks at the database, so monitoring sees
a real signal instead of a "healthy" that only meant the process was up.

## Every release passes the same gate

Both tag-triggered workflows, the backend deploy and the Chrome Web Store
publish, now have to pass one shared release gate before anything ships. The
gate can be run as a dry run before tagging. A scheduled job also reports
when the deployed backend has drifted too far behind `main`, and CI now
includes container image scanning and a dependency audit.

## Sessions you can see

Account settings now list your active sessions and let you revoke any of
them. Behind that, refresh tokens moved out of response bodies into
HttpOnly cookies, session rotation became transactional, and verification
and reset tokens are stored hashed rather than as they were issued.

## A GitHub widget

The one user-facing addition: connect GitHub with a personal access token
and a sidebar widget shows notifications, review requests and issues
assigned to you.

## Smaller fixes

- Calendar events that arrived without a date showed as "No upcoming
  events"; every event now carries its date.
- Keyboard navigation works again in the custom select, and clickable
  elements are real buttons.
- Every outbound call to an external API now has a timeout.
- `npm` is no longer in the production container image.
