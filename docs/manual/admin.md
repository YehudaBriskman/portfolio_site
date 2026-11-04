# Admin and content guide

Everything the site shows is edited in the admin at `/admin`, and stored in
CouchDB. Deploys never write content.

## Signing in

The admin is behind a single sign-on proxy (GitHub sign-in) in front of the
site. The API trusts a request as the admin only when the proxy vouches for it
and the signed-in account is the configured admin. There are two other ways in,
both scoped: API tokens (below) and grants made through the remote MCP server
([MCP](mcp.md)). The rules are in `backend/src/middlewares/requireAdmin.ts`.

## The pages

| Page | What it is for |
|---|---|
| `/admin` | overview: counts, recent items, quick actions |
| `/admin/posts` | the notes, with their state (draft or published) and translation status |
| `/admin/posts/:slug` | the note editor: English and Hebrew side by side, a diff when the Hebrew is stale, and a publish review that can publish one language or both |
| `/admin/areas` | areas, the groups notes are filed under (`/blog/area/:slug` on the site) |
| `/admin/projects` | the projects on `/projects`: text in both languages, links, pictures from the media library |
| `/admin/story` | the Journey page: the opening, the roles, beat layouts and pinned photographs |
| `/admin/site-copy` | the hero, "how I work", the contact plate, profiles and the footer |
| `/admin/media` | the media library ([Media](media.md)) |
| `/admin/translations` | everything missing or stale in Hebrew ([Hebrew](i18n.md)) |
| `/admin/settings` | site settings such as the accent and motion defaults |
| `/admin/connections` | apps connected through the remote MCP server, with revoke |

Saves use an optimistic lock, so two tabs editing the same record cannot
silently overwrite each other.

## API tokens

For scripts and the local MCP server. Minted from the backend:

```bash
cd backend
npx tsx scripts/api-token.ts create <name> [--scope write] [--days N]
npx tsx scripts/api-token.ts list
npx tsx scripts/api-token.ts revoke <id>
```

It needs the CouchDB URL and credentials in its environment (there is no
default URL, on purpose). Tokens are read-only unless `--scope write` is
passed, last 30 days by default and 90 at most, and are printed once: only a
hash is stored.

## Content kept in the repository

`backend/content/` holds reviewed drafts of areas and posts. They reach a
database only through `backend/scripts/import-content.mjs`, which goes through
the same admin API routes as the editor:

```bash
node backend/scripts/import-content.mjs           # dry run: prints the diff
node backend/scripts/import-content.mjs --apply   # writes
```

It is idempotent, never deletes or archives anything, and allows plain HTTP
only to a loopback host. It needs the API's base URL and an admin credential in
its environment. The review workflow is in [content-review.md](../content-review.md).

## Local fixtures

`make seed` fills the local CouchDB with fixture posts
(`backend/scripts/seed-dev-content.mjs`). The script refuses any non-loopback
host, because it writes documents titled "Fixture".
