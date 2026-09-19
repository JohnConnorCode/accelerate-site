# Connect ChatGPT to the installation website editor

This optional connection lets the installation owner edit the public website
through the same validated commands used by Site Studio. It does not grant
access to CRM, messages, workspace settings, arbitrary actions or tenant-owned
service-page drafts. The ordinary workspace MCP endpoints and keys retain their
existing proposal-only behavior.

## What you authorize

The owner grants one pre-registered OAuth client Site Studio control for 30 days.
That authority includes reading private drafts, changing and removing content,
saving, publishing, unpublishing and restoring previously published revisions.
The connection page states this scope before consent. Revoke it from
**Site Studio → Connect ChatGPT**; removing the native OAuth grant also blocks
future requests. Renewal requires a current native grant and owner sign-in.

ChatGPT manages its own write confirmations. The server cannot establish that
a person clicked a confirmation for every call, so receipts record **delegated
authority**, not fabricated human approval. Leave write confirmations enabled
in the client, and review the exact summary before publication or removal.
Do not enable this connection if a verified human signature on every individual
write is a requirement; use the editor's own approval workflow instead.

## Configure a controlled installation

1. Deploy a reviewed application commit and apply its ordered migrations to the
   intended database using the repository migration runner. Verify the project
   and pooler identity first. Required additions include form safety commands,
   Site Studio defaults and `20260919210534_site_editor_delegation.sql`.
   Local tests do not apply migrations or enable OAuth in production.
2. Configure `ADMIN_EMAIL`, the bootstrap workspace's active admin membership,
   and `NEXT_PUBLIC_SITE_URL` with the installation's canonical HTTPS origin.
   Site Studio defaults to enabled when its setting is omitted; an explicit
   `false` remains disabled. Existing private drafts and receipts are preserved.
3. Enable the native Supabase OAuth server. Pre-register the client with the
   exact redirect URL displayed by ChatGPT and authorization-code/PKCE S256
   support. Keep dynamic registration disabled for this connection. Set the
   consent URL to `https://<your-domain>/admin/site/connect`.
4. Put the registered client UUID in `SITE_STUDIO_OAUTH_CLIENT_IDS`. Separate
   multiple registered IDs with commas. Client secrets belong only in the
   approved provider/client configuration, never in this variable or chat.
5. Enable the native Custom Access Token hook
   `public.site_editor_access_token_hook`. **This opt-in hook dedicates native
   OAuth token issuance to Site Studio:** unknown OAuth clients are refused.
   Review any existing native OAuth consumers before enabling it. Ordinary
   first-party sign-ins, without `client_id`, are unchanged. The consent service
   records the scoped client before issuing its first authorization code.
6. In a ChatGPT environment supporting custom MCP apps, add
   `https://<your-domain>/api/mcp/site-studio` using OAuth and the pre-registered
   client settings. Sign in as the configured installation owner and review
   **Allow Site Studio control for 30 days**. Verify the client identity and
   redirect destination before consenting.

The endpoint uses stateless Streamable HTTP JSON responses. It advertises OAuth
protected-resource metadata at
`/.well-known/oauth-protected-resource/api/mcp/site-studio`, with the native
authorization server at `<SUPABASE_URL>/auth/v1`. Configure the client for
`openid email` identity scopes and the editor resource audience. A plain
`authenticated`-audience token or workspace API key is refused.

The token hook assigns the dedicated `mcp_site_editor` database role, which has
no direct table or mutation-RPC privileges. Every request verifies signature,
issuer, audience, registered client, expiry, current owner identity, native
grant, session, membership, module state and local delegation. Execution
rechecks the database authorization inside its transaction. Revoked client
classification remains in history so refresh cannot restore ordinary owner
Data API access. Keep delegation history; deleting it defeats that record.

## First verified editing session

1. Ask ChatGPT to call `read_site_editor` with `view: "pages"`. Check that the
   content and version match your installation. `view: "schema"` exposes the
   exact command, page, document or AI input definition on demand.
2. Request a small private change. `prepare_site_change` returns the exact
   difference, command digest and readable summary without writing. Review
   these, then stage the same command and digest with `stage_site_change`.
3. Confirm execution in ChatGPT. `execute_site_change` takes only the staged
   action ID, digest and exact summary. Check its receipt, then open the editor
   to verify that the saved draft changed while the public page stayed intact.
4. Prepare and review a separate publication command using the saved draft's
   revision ID and current version. Verify the public page and publication
   receipt. Test rollback or unpublish only on controlled content.
5. Revoke the connection and confirm that the old token cannot read or execute,
   including replaying an earlier successful action. Check ordinary owner
   sign-in and legacy workspace MCP reads still work.

Page operations cover creation, cloning, replacement and removal. A complete
page includes its sections, layout, text and metadata. Configuration operations
cover identity, theme, navigation, header, footer and dock. Asset and collection
operations reuse the portable document schema. Images reference existing files
or HTTPS URLs; this connection does not upload binary files or run arbitrary
HTML, JavaScript, CSS, SQL or shell commands.

History and receipts are paginated. Supply a revision ID to inspect historical
content. Export returns 64,000-character chunks and a next offset. Exact preview
output is limited to 256 KB; split larger changes or review an import in the
editor. Full imports retain the editor's 8 MB document limit. AI suggestions
use the existing model gateway, budget and selected-price ceilings, with the
same 20 requests per hour per owner as the UI.

## Recovery and release evidence

For an uncertain execution response, retry the same action ID, digest and
summary. A committed command returns its receipt without a second write. A
stale version needs a fresh read, preview and proposal. A revoked/expired grant
needs owner reconnection or renewal, not a different API key. Provider failures
leave the saved document unchanged. After a failed consent, reload the
connection screen to inspect the current state before retrying.

Run `npm run test:site-editor` and `npm run test:site-editor:postgres` for
controlled cryptographic, permission, replay and transaction checks. They use
signed fixture tokens, mocked native responses and isolated local PostgreSQL;
they are not proof of a deployed OAuth exchange. Before release, retain the
exact application commit, migration receipt, native OAuth configuration check,
real-client read/save/publish/revoke evidence, and desktop/mobile editor checks.
ChatGPT web and desktop support must be tested separately in the intended
account; do not infer desktop compatibility from an HTTP or web-client test.

Provider references: [ChatGPT developer mode](https://developers.openai.com/api/docs/guides/developer-mode),
[MCP app authentication](https://developers.openai.com/plugins/build/auth),
[Supabase MCP OAuth](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication),
and [OAuth token security](https://supabase.com/docs/guides/auth/oauth-server/token-security).
