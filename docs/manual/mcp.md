# MCP: writing to the site from an AI client

The site can be read and edited through the Model Context Protocol, in two
ways that share the same tools.

## Remote server (most people want this)

`https://yehudabriskman.com/mcp` is a Streamable HTTP MCP server with OAuth 2.1
in front of it; sign-in goes through GitHub. With Claude Code:

```sh
claude mcp add --transport http yehuda https://yehudabriskman.com/mcp
```

The public page is [yehudabriskman.com/developers/mcp](https://yehudabriskman.com/developers/mcp).
Connected apps are listed, and revoked, under `/admin/connections`; a revoked
grant is refused on its next request. The server lives in `backend/src/mcp/`.
Details: [docs/remote-mcp/README.md](../remote-mcp/README.md).

## Local stdio server

`mcp/` is `portfolio-mcp`, a stdio MCP server over the site's HTTP API, for
working against the local Compose stack or with an API token
([Admin](admin.md#api-tokens)). Setup and the tool list:
[mcp/README.md](../../mcp/README.md).

The tool definitions are shared between the two. After editing
`mcp/src/api.ts`, `diff.ts` or `tools.ts`, regenerate the copy the backend uses
and commit it:

```sh
node mcp/scripts/sync-shared.mjs
```
