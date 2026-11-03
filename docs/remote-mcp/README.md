# Remote MCP server (#263)

`https://yehudabriskman.com/mcp` is a Streamable HTTP MCP server, with OAuth 2.1 in front of it. Sign-in goes through GitHub. Connecting a client takes one line:

```sh
claude mcp add --transport http yehuda https://yehudabriskman.com/mcp
```

The public page is `/developers/mcp`, and the code is in `backend/src/mcp/`.

## Turning it on (owner)

1. **Create a GitHub OAuth app.** Go to https://github.com/settings/developers and choose **New OAuth App**:
   - Name: `yehudabriskman.com MCP`
   - Homepage: `https://yehudabriskman.com/developers/mcp`
   - Callback: `https://yehudabriskman.com/mcp/oauth/github/callback`
   - Leave device flow off.

   Generate a client secret. Do **not** reuse the oauth2-proxy app: its callback and its users are different.
2. **Put the secrets in the API's environment:**
   - `MCP_GITHUB_CLIENT_ID` and `MCP_GITHUB_CLIENT_SECRET`, from step 1.
   - `ADMIN_GITHUB_ID` is optional: your numeric GitHub id, from `gh api user -q .id`. Without it, the id seen at the first sign-in is recorded and held from then on.
3. **Set `MCP_REMOTE=on`.** The API refuses to start with it on and the GitHub credentials missing.
4. **Tag a release** to deploy it.
5. **Check it.**
   - `curl -s https://yehudabriskman.com/.well-known/oauth-protected-resource/mcp` returns JSON.
   - `/developers/mcp` shows "Status: live".
   - Run the `claude mcp add` line above.

To switch it off, set `MCP_REMOTE=off`. Every path then answers 404. Existing grants stay in the store and work again once it is back on. Revoke them under Admin → Connected apps.

## Preprod

Preprod sits behind oauth2-proxy forwardAuth, which breaks this flow at every step. A client's `POST /mcp`, the metadata fetches, the token call and the registration call have no proxy cookie, so each gets oauth2-proxy's redirect instead of a 401 or JSON.

An exception would need to let these paths through the forwardAuth:

- `/mcp`
- `/mcp/`
- `/.well-known/oauth-`

That is the same exception production gets by having no forwardAuth at all.

Making that exception is **not advised**. Preprod's gate exists so that unreleased code is not public. If the exception is ever wanted, it belongs in the oci-free repo's preprod Traefik middleware chain: a router for those path prefixes, at a higher priority, without the forwardAuth middleware.

Test the flow locally instead, as below.

## Verified locally (2026-11-03)

The setup:

- A real CouchDB 3.4.
- The backend with `MCP_REMOTE=on` and the GitHub URLs pointed at a mock that signs in at once.
- The official SDK client, `@modelcontextprotocol/sdk` 1.32.2.

The run went like this:

1. The first call got a 401. The client then:
   - discovered the metadata,
   - registered itself (DCR),
   - started the authorization with PKCE S256 and `resource=…/mcp`.
2. The browser leg went from authorize, to GitHub (mock), to the callback, to the consent page, and back to `localhost:53682/callback` with the state intact.
3. `finishAuth` received tokens with scope `mcp:read mcp:write` and a 3600 s lifetime.
4. Tools:
   - All 15 tools were listed.
   - `save_post_draft` was a dry run by default and wrote with `dryRun:false`.
   - `delete_post` without `confirm` was refused.
   - The audit log recorded `{"via":"mcp-oauth","client":"E2E SDK client"}`.
5. `/mcp/public` listed the 6 public tools without sign-in.
6. Refresh and reuse:
   - A refresh rotated the refresh token.
   - Replaying the old refresh token returned `invalid_grant` and revoked the grant.
   - The new access token then got a 401.
7. The API's request log held no codes, states or tokens, because the query strings are stripped.

Screenshots in this directory come from `web/scripts/shoot-remote-mcp.mjs`.
