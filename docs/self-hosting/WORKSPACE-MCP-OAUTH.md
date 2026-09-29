# Connect ChatGPT web to a workspace

This optional OAuth connection gives a supported ChatGPT web workspace access
to one Command Center workspace's registered MCP tools. Reads stay bounded.
Business changes are staged as proposals for a separate human decision in
Command Center; some tools also record supporting internal evidence. The OAuth
client cannot approve its own proposal. Tool coverage depends on the
deployed registry, enabled modules and connected providers. It does not include
every admin operation or the separate Site Studio website editor.

Use [OpenAI’s current ChatGPT connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt) to check account eligibility and supported clients. Configure OAuth using the exact callback URI supplied by the client. A workspace MCP API key is not a substitute for the OAuth connection. Refresh the client's tool metadata after deploying registry changes.

## Installation setup

1. Deploy a reviewed application commit, then apply
   `migrations/20261001-workspace-mcp-oauth.sql` through the ordered migration
   runner. It adds revocable workspace grants, a database role without Data API
   privileges, and extends the existing Site Studio token hook. Do not enable
   that hook before reviewing any other native OAuth clients: unknown clients
   fail closed while first-party sign-ins remain unchanged.
2. Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS application origin. The
   existing Supabase URL, anon key, service-role key and tenant header controls
   must already work. Do not put service-role credentials in a client or chat.
3. In the native Supabase OAuth server, use `/admin/oauth/consent` as the single
   authorization path for both workspace MCP and Site Studio. Pre-register a
   distinct OAuth client for each workspace. Use ChatGPT's exact redirect URI
   and authorization-code/PKCE S256. Keep dynamic client registration disabled
   for this controlled connection. Use asymmetric JWT signing when requesting
   `openid`.
4. Set `MCP_WORKSPACE_OAUTH_CLIENTS` to a JSON object mapping tenant slugs to
   their registered client UUIDs, for example
   `{"northline":"33333333-3333-4333-8333-333333333333"}`. A client ID must
   not appear under two slugs or in `SITE_STUDIO_OAUTH_CLIENT_IDS`. Keep any
   Site Studio client in that separate variable.
5. Enable the native Custom Access Token hook
   `public.site_editor_access_token_hook`. It assigns the restricted
   `mcp_workspace` role and exact workspace resource audience to approved
   workspace clients. The OAuth grant and local 30-day delegation are both
   checked on every MCP request, along with the live user, session, tenant and
   admin membership. A refresh after local revocation remains unusable.

The OAuth endpoint for a workspace is:

```text
https://<your-domain>/api/public/<tenantSlug>/mcp/oauth
```

Its protected-resource metadata is at
`/.well-known/oauth-protected-resource/api/public/<tenantSlug>/mcp/oauth`.
A 503 there means installation OAuth configuration is incomplete. The legacy
`/api/public/<tenantSlug>/mcp` endpoint still accepts a workspace Bearer key
for clients that support one; it is a separate connection.

## First connection and proof

1. In a supported ChatGPT web workspace, create a custom MCP app with the OAuth
   endpoint above. Sign in as an active admin of the intended Command Center
   workspace. The consent screen identifies the registered client, return
   host, scopes and the workspace's read/proposal authority. Approve it.
2. Ask ChatGPT to list available tools, then request a bounded Today read.
   Check that the records belong to the intended workspace. Request a small
   task proposal and verify that it appears in Command Center Approvals. The
   task must remain unchanged until a separate admin approval.
3. Revoke the connection at `/admin/mcp/connect`. Confirm that the old OAuth
   token can no longer read or propose, including after token refresh. Check
   the ordinary workspace sign-in and any legacy Bearer-key MCP client.

Keep the application commit, migration receipt, native OAuth configuration,
real-client read/proposal/revoke results and any provider warnings together.
Local signed-token and PostgreSQL checks cover code and database boundaries;
they do not prove that the deployed OAuth exchange or a particular ChatGPT
account works. If a write confirmation appears in ChatGPT, it is separate
from Command Center's required proposal approval.

References: [ChatGPT MCP availability](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt),
[OpenAI MCP authentication](https://developers.openai.com/plugins/build/auth),
[Supabase MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication).
