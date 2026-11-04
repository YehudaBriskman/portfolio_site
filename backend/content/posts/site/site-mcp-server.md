---
{
  "slug": "site-mcp-server",
  "title": "An MCP server for the site, locally and over HTTPS",
  "subtitle": "Public reads for anyone, owner-only writes behind scoped tokens, a dry run by default and an audit log of every change",
  "excerpt": "The site can be read and edited by an MCP client: first as a local stdio server over the API, then at a public HTTPS endpoint with an OAuth 2.1 sign-in through GitHub that only the owner can pass.",
  "tags": ["site", "mcp", "security", "api"],
  "collection": "site",
  "status": "published",
  "publishedAt": "2026-11-03T07:31:57Z",
  "readingMinutes": 2,
  "featured": null,
  "coverImage": null,
  "links": [
    { "label": "PR #264, the remote MCP server", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/264" },
    { "label": "PR #256, the stdio server and API tokens", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/256" }
  ],
  "sources": [
    { "label": "PR #256, the stdio server and API tokens", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/256" },
    { "label": "PR #264, the remote MCP server", "url": "https://github.com/YehudaBriskman/portfolio_site/pull/264" }
  ]
}
---
An admin page is one way to write a note. Asking an assistant to draft it,
show the diff and publish it is another, and that needs a protocol the
assistant speaks. The site now has an MCP server, built in two steps.

## Step one: a local server over the API

The first server runs locally over stdio and wraps the site's HTTP API. It
does not touch the database itself.

- **Public tools, always**: list and read notes, tags, areas and activity.
- **Admin tools, only with a token**: read drafts, save a draft, publish,
  unpublish, delete, and edit areas.
- **Every write defaults to a dry run** and returns a field-by-field diff of
  what would change. Saving never changes a note's status, and a delete is
  refused unless it is confirmed and the dry run is turned off.

The admin API had only ever been reachable through the site's sign-in
proxy, so this step also added API tokens, and they are off by default. When
they are turned on, a token is random, stored only as a SHA-256 hash, scoped
to read or write, and always expires. A token can never manage other tokens.

Every admin request that is not a read, refusals included, is appended to
an audit log with who made it, what it touched and a hash of the document
before and after. A test drives every public route against a store that
holds tokens and audit entries dressed as notes, and checks that none of
them leak.

## Step two: the same tools over HTTPS

The second step makes connecting a client one line, with a browser sign-in
and nothing to run locally. The endpoint is `https://yehudabriskman.com/mcp`.

- **OAuth 2.1, served by the API**, with dynamic client registration, PKCE
  required, and tokens bound to the MCP endpoint so they are useless
  anywhere else.
- **Sign-in is through GitHub, and only the owner passes.** The account is
  checked by login and by numeric id, and anyone else gets a "Not
  authorized" page with nothing issued. The GitHub token is never stored.
- **Short-lived access.** Access tokens last an hour. Refresh tokens last
  thirty days, rotate on every use, and a reused one revokes the whole
  grant.
- **Consent is explicit.** The write scope is never pre-selected on the
  consent page.
- **The public tools** have their own endpoint that needs no sign-in.

The whole remote server sits behind a switch that is off by default; while
it is off, every new path answers 404. A page at `/developers/mcp` explains
how to connect.

## Why this shape

The server is a client of the same API the admin uses, so it inherits that
API's validation, revisions and conflict checks instead of growing its own.
The dry-run default and the audit log are there because the writer is a
program: the cheapest mistake to undo is the one that was only shown, never
made.
