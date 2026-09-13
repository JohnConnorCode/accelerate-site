# Run the complete Accelerate package

Fork this repository and deploy the app and Social Marketing runtime together.
There is no separate Postiz repository to install or hosting account to select.
Docker Compose runs the app and HTTPS proxy by default. The Postiz worker and
private dependencies are opt-in services in the same package.

1. Install Node 22, Git, Docker Engine and Docker Compose on your app host.
2. Copy `.env.example` to `.env` and configure the existing application/Supabase
   setup as described in [self-hosting](../docs/self-hosting/SELF-HOSTING.md).
3. Set `APP_HOST` to your application hostname and point it to this host.
4. Run `npm run stack:up` from the repository root.

The default `SOCIAL_MARKETING_ENABLED=false` starts only the app and proxy.
It does not download or build Postiz, generate provider secrets, start its
workers/databases, or configure a social hostname.

To include Social Marketing, set `SOCIAL_MARKETING_ENABLED=true` in the same
`.env` and run `npm run stack:up` again. Point `social.APP_HOST` at the same host
(or set `POSTIZ_HOST` to another hostname there). This opt-in prepares the pinned
patched source, generates missing private service secrets and starts the bundled
workers/databases alongside the app.
Only the shared proxy exposes ports 80/443. When enabled, the app receives its Postiz origin
automatically. LinkedIn credentials are not required to install the package.
The first build can take several minutes. Caddy obtains HTTPS certificates once
the configured names resolve to this host and ports 80/443 are reachable.

Open the app at `https://APP_HOST`. Complete the existing workspace setup, then
follow [Social Marketing setup](../plugins/social-marketing/README.md) to activate
LinkedIn. Company-page authorization and workspace organization binding still
require setup; this command does not claim to automate those permissions.
The provider setup screen lives at `https://social.APP_HOST`; daily work stays
in Command Center. For the first provider owner, put `POSTIZ_OWNER_EMAIL`, `POSTIZ_OWNER_COMPANY` and
`POSTIZ_OWNER_PASSWORD` in private `.env`, then run `npm run stack:owner`. Remove
the owner password afterward. The command uses this same stack and sends no
credentials to command output. Sign in to the bundled setup screen and bind the
organization through Social Marketing's connection settings.

Use `docker compose ps` and `docker compose logs app` for local diagnosis;
do not publish logs containing private data. `npm run stack:down` stops the stack
and retains its volumes. Never use `down --volumes` on an installation you need.
`npm run stack:check` validates the selected package without printing secrets.

To stop using the runtime, disable Social Marketing in affected workspaces first,
set `SOCIAL_MARKETING_ENABLED=false`, and run `npm run stack:up`. The command removes
services no longer selected in this Compose project, retaining named volumes,
credentials and source. It removes the social proxy route and clears the app's
Postiz origin. Turning the runtime back on reuses those volumes. This installation
flag affects all workspaces; each workspace still enables its own plugin separately.
Never store unrelated custom containers under this package's Compose project name.

For updates, back up `.env`, the app database and the bundled service data first.
Pull the reviewed app revision and run `npm run stack:up` again. Changed upstream
patches cause source preparation to run again; previous generated source folders
are retained with `.previous-*` names. Remove those generated copies only after
verifying the update and retaining the corresponding source for deployed images.
Use the [recovery guide](../plugins/social-marketing/deployment/README.md) for
Postiz databases, Temporal history and uploads. Database changes are not undone
by switching a Git revision.

This package needs a host that runs persistent Docker services. A serverless
website deployment alone cannot run its workers. The existing website deployment
path remains available, but it is not the complete bundled runtime. Supabase
remains the application's existing configured database/auth service; this change
does not add a separate local Supabase installation.

## Add another service-backed plugin

Keep its domain operations, native UI and tools in the app. Add its runtime to
an opt-in Compose file using `extends`, with private networking, named volumes and
health checks. Reuse this root startup command and shared proxy. Keep provider
credentials and tenant activation in the plugin's existing setup flow. No new
installer framework or arbitrary-code loader is required.
