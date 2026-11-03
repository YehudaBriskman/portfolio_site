---
{
  "slug": "windom-gmail-withdrawn-for-licensing",
  "title": "Why the Gmail widget was withdrawn",
  "subtitle": "A licensing decision rather than a product one, and how it was kept reversible",
  "excerpt": "Reading mail needs a Google scope that requires a recurring third-party security assessment. WindoM switched the widget off behind a flag instead of deleting it.",
  "tags": ["windom", "privacy", "auth", "chrome-extension"],
  "collection": "windom",
  "status": "published",
  "publishedAt": "2026-11-02T09:20:00Z",
  "readingMinutes": 2,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "PR #329, gate the Gmail restricted scope", "url": "https://github.com/YehudaBriskman/WindoM/pull/329" }
  ],
  "sources": [
    { "label": "WindoM PR #329", "url": "https://github.com/YehudaBriskman/WindoM/pull/329" },
    { "label": "WindoM CHANGELOG, 1.5.0 and 1.5.1", "url": "https://github.com/YehudaBriskman/WindoM/blob/main/CHANGELOG.md" }
  ]
}
---
WindoM 1.4 added a Gmail widget: an unread count and the most recent
messages, on the new tab. WindoM 1.5 removed it. Nothing was wrong with the
feature. The decision was about what it would take to keep publishing it.

## What the permission costs

To read mail, an app asks Google for the `gmail.readonly` scope. Google
classes it as a *restricted* scope. An extension that requests one can only
be published after a third-party CASA security assessment, which is priced
per tier and has to be repeated every year. The assessment applies here
because WindoM's mail reads go through its own server rather than staying in
the browser.

Set against the size of the project, a recurring assessment for one widget
was not proportionate. It also blocked the store submission outright. The
two scopes WindoM still needs, sign-in and Calendar, verify at no cost.

## Withdrawn, not deleted

Removing the feature did not mean removing the code. The Gmail scope is now
requested only when the backend runs with `GMAIL_ENABLED=true`, which is off
by default and off in production. The extension asks the server which
features it offers and stops showing a Gmail "Connect" button that could
never finish.

That keeps one option open: moving mail reads into the extension itself,
where mail would never pass through the server and the assessment may not
apply. If that happens, turning the flag on restores the widget in full.

## The check that guards it

The test that protects this decision does not check the flag. It checks the
consent URL the backend actually sends users to, and fails if `gmail`
appears in it. It also checks that the summary endpoint refuses without
calling Google. The flag is an implementation detail; the URL is what would
make the listing unpublishable if a configuration mistake ever brought the
scope back.

## Cleaning up after a removal

A withdrawn feature can leave traces. After 1.5.0, the widget kept polling
the server every forty-five seconds for users who had connected Gmail
earlier, because it trusted a saved setting rather than what the server
offered. 1.5.1 stopped that. The privacy policy now lists exactly the scopes
requested and carries the Limited Use statement Google's user data policy
requires.
