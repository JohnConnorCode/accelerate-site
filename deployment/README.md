# Run the complete Accelerate package

Fork this repository and deploy the app and Social Marketing runtime together.
There is no separate Postiz repository to install or hosting account to select.
Docker Compose runs the app, bundled Postiz worker, private databases and shared
HTTPS proxy as one stack. Workspace plugin enablement remains optional.

1. Install Node 22, Git, Docker Engine and Docker Compose on your app host.
2. Copy `.env.example` to `.env` and configure the existing application/Supabase
   setup as described in [self-hosting](../docs/self-hosting/SELF-HOSTING.md).
3. Set `APP_HOST` to your application hostname. Point it and `social.APP_HOST`
   to this same host. `POSTIZ_HOST` can override the social subdomain. These are
   two routes into one installation, not separate hosting accounts.
4. Run `npm run stack:up` from the repository root.

The command generates missing private Postiz secrets in `.env`, prepares the
pinned patched upstream source, builds both app images and starts the stack.
Only the shared proxy exposes ports 80/443. The app receives its Postiz origin
automatically. LinkedIn credentials are not required to install the package.
The first build can take several minutes. Caddy obtains HTTPS certificates once
both names resolve to this host and ports 80/443 are reachable.

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

Use `docker compose ps` and `docker compose logs app postiz` for local diagnosis;
do not publish logs containing private data. `npm run stack:down` stops the stack
and retains its volumes. Never use `down --volumes` on an installation you need.
`npm run stack:check` validates the configured package without printing secrets.

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
this Compose stack using `extends`, with private networking, named volumes and
health checks. Reuse this root startup command and shared proxy. Keep provider
credentials and tenant activation in the plugin's existing setup flow. No new
installer framework or arbitrary-code loader is required.
