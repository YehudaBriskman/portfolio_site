---
{
  "slug": "windom-provider-401-is-not-a-session",
  "title": "A provider's 401 is not a signed-out user",
  "subtitle": "One misread status code, and why the fix is keyed on the route",
  "excerpt": "Signing in to WindoM worked, then undid itself. A stale Calendar or Spotify grant was being read as an expired session, and the refresh storm that followed ended the real one.",
  "tags": ["windom", "auth", "testing"],
  "collection": "windom",
  "status": "published",
  "publishedAt": "2026-11-02T09:10:00Z",
  "readingMinutes": 2,
  "featured": 2,
  "coverImage": null,
  "links": [
    { "label": "PR #362, stop a provider 401 from ending the session", "url": "https://github.com/YehudaBriskman/WindoM/pull/362" }
  ],
  "sources": [
    { "label": "WindoM PR #362", "url": "https://github.com/YehudaBriskman/WindoM/pull/362" },
    { "label": "WindoM CHANGELOG, 1.5.1", "url": "https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md" }
  ]
}
---
"Connect with Google" in WindoM would show *Connecting…* and then stop. It
looked like a sign-in failure. It was not. The sign-in succeeded every time;
what came after it ended the session.

## Two meanings of 401

WindoM's backend speaks for two kinds of identity. There is the user's
session with WindoM itself, and there are the user's grants with each
provider: Google Calendar, Spotify, and the others. Both can be stale, and
both answer `401 Unauthorized` when they are.

The client treated every 401 the same way: as an expired WindoM session.
On a 401 it refreshed the session token and retried.

## How that became a sign-out

Right after a successful sign-in, the dashboard loads every connected
integration at once. If those provider grants were stale, Calendar, Spotify
and the others each answered 401, and each one triggered a session refresh.

The refresh endpoint is rate limited to five calls per fifteen minutes, which
is a sensible budget for one client. Five integrations exhausted it in
seconds. The next refresh got `429 Too Many Requests`, the client read that
failure as a dead session, and it logged the user out.

So the more integrations someone had connected, the faster a successful
sign-in destroyed itself. Spotify and Calendar went down with it, which made
it look like several bugs rather than one.

## The fix: decide by route

There were two faults, and they were corrected separately.

**A provider's 401 belongs to the provider.** Responses from the integration
routes are returned to the widget that asked, which can say "reconnect
Spotify" instead of signing anyone out.

**A 429 is not a session state.** Being throttled says nothing about whether
a session is valid, so it no longer raises the session-expired path.

The interesting decision is how the client tells the two kinds of 401 apart.
The obvious approach is to check whether the session token still looks
valid, and treat a 401 with a valid-looking token as a provider problem. That
is wrong for one important case: a session revoked on the server still looks
valid in the client. It has to keep its refresh-then-logout path.

So the decision is keyed on the route. The integration routes own their
401s; everything else is still the session's. The OAuth routes are
deliberately not in the provider list, because they run under WindoM's own
session.

## Tests that fail first

The fix came with 15 new tests. Two of them carry most of the weight. One
proves that a genuinely failed refresh still logs the user out, so real
session expiry is untouched. The other proves that the route match is exact:
`/calendarium` is not `/calendar`.

Each new test was run against the unfixed client first and failed there. A
test that passes on the old code as well as the new one describes the
behaviour without pinning it.
