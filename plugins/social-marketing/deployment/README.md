# Run the Postiz publishing service

This is a separate service deployment. The Accelerate application remains the
owner of drafts, approvals, scheduling and publication receipts. Postiz needs a
persistent Linux host, public HTTPS hostname and a LinkedIn application approved
for the required company-page access. Provision one Postiz organization per
Accelerate tenant. Customer groups do not provide tenant isolation.

## Prepare an immutable release

1. Run `./prepare-source.sh` in this directory. It checks out upstream commit
   `3cbe20b86bf3b2243843d51bb63dcec8773babf7` and applies `identity.patch` plus `service-hardening.patch`. The patches
   add organization identity, organization-owned media validation, private local
   image reads and refusal of automatic destructive schema changes; an unpatched
   upstream service is deliberately refused by the Accelerate adapter.
2. Build from that source using `docker build -f upstream/Dockerfile.dev
--build-arg NEXT_PUBLIC_VERSION=accelerate-3cbe20b-2 -t <registry>/postiz:<release>
upstream`. Push to your registry and resolve the resulting image digest.
   Set `POSTIZ_IMAGE=<registry>/postiz@sha256:<digest>` in private `.env`.
3. Resolve and record immutable digests for Caddy 2, Postgres 17, Redis 7,
   Postgres 16 for Temporal, and `temporalio/auto-setup:1.28.1`. Set the matching
   `*_IMAGE` variables in `compose.yaml`. The file has no `latest` fallback.
   Record platform/architecture and all resolved digests in the release receipt.
4. Set `POSTIZ_HOST`, `POSTIZ_JWT_SECRET`, `POSTIZ_DB_PASSWORD`,
   `TEMPORAL_DB_PASSWORD`, `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`
   in private `.env`. Use long random URL-safe passwords. Never commit this file.
5. Keep the exact modified source archive beside the running release. Caddy
   serves `/source/postiz-source.tar.gz`; connected workspaces see its download link in Social Marketing Setup. Verify that download and preserve its exact release checksum.
   Upstream is AGPL-3.0; preserve its license and attribution, including this
   modification and the source/build material. See `POSTIZ-LICENSE`.
6. Run `./validate-release.sh` with the private environment exported and inspect the exposed ports. Only HTTPS and
   its HTTP redirect are public; Postgres, Redis and Temporal have no host ports.
   Start with `docker compose up -d` on the chosen host. Confirm container health,
   HTTPS, source download and persistent volume ownership.
7. Bootstrap the owner through the private container network before connecting
   customers. The public proxy refuses `/api/auth/register` (including case
   variants) because upstream allows its first owner even with registration
   disabled. On the chosen host, supply `POSTIZ_OWNER_EMAIL`, `POSTIZ_OWNER_COMPANY` and
   `POSTIZ_OWNER_PASSWORD` through the secret manager, then run
   `node bootstrap-owner.mjs`. The helper validates the release, sends credentials
   over stdin inside the container and reports registration without returning
   session tokens. Sign in through the normal HTTPS page. Never expose the
   backend port publicly or remove the proxy restriction. Create each additional organization through an
   operator-controlled registration session with registration temporarily enabled
   internally, then return it to disabled. Connect LinkedIn pages in upstream setup.
8. Set the Accelerate server-only `POSTIZ_ORIGIN=https://<POSTIZ_HOST>`. Enable
   Social Marketing for the test workspace and connect its organization API key
   through **Social Marketing → Setup**. The organization identity must match,
   and the same organization cannot be attached to two Accelerate tenants.

The supplied `API_LIMIT=30` caps Postiz create-post requests at thirty per hour per organization in the pinned upstream guard. Other reads are not counted by that guard. Size publishing batches and service capacity accordingly; increasing this setting does not increase LinkedIn permissions or quotas.

The supplied Compose uses Temporal's PostgreSQL visibility store rather than
Elasticsearch. Validate the pinned service startup and publication workflow on
an isolated host before release. Source preparation and a valid Compose file do
not establish that a live host or LinkedIn application is ready.

## Private media and startup checks

The public proxy refuses `/uploads` URLs. Accelerate renders private drafts from
its own tenant-owned storage, while the patched Postiz LinkedIn provider reads
approved image bytes directly from its local upload volume. The shared Postiz
post-mapping service rejects foreign, deleted or mismatched media IDs and paths
before processing a post through either its web or public API. The upstream
media gallery's public image previews are unavailable with this deployment;
use the native Social Marketing workspace for content work.

Do not expose Postiz's port 5000 directly. It bypasses the public proxy restrictions.
The service health check requires frontend, backend and orchestrator processes to
remain online for at least fifteen seconds, plus successful frontend and backend
HTTP probes. A green login page alone does not prove that publishing workers run.
The patch removes Prisma's automatic `--accept-data-loss` flag. A schema change
that requires destructive confirmation must stop startup for a reviewed migration
and backup procedure; do not add the flag back to make an upgrade start.

## Run the disposable service verification

The **Postiz service verification** GitHub workflow builds the exact modified
upstream application and runs `verify-service.sh` on a temporary Linux runner.
It uses random fixture credentials and empty organizations, binds test ports to
loopback and removes its own Compose volumes on exit. No real LinkedIn app,
page, customer data or deployment credentials belong in this run.

The script records image identities and JSON receipts for bootstrap, restart and
application database/upload restoration. It exercises both organization identities,
invalid keys, public registration denial, public media denial and rejection of a
foreign organization's media reference. Private fixture credentials and database
archives are removed even after failure, and arbitrary service logs are excluded
from uploaded artifacts. Each receipt lists remaining release proof explicitly.

For local verification, use a disposable Linux Docker environment with enough
memory and disk to build upstream. Run `prepare-source.sh`, build
`accelerate-postiz:verification` as above, then run `verify-service.sh`. From a
repository with its developer dependencies installed, `node
plugins/social-marketing/deployment/verify-hardening.mjs` separately tests the
applied local media reader's path and symlink protections. Keep the full database,
Temporal history, HTTPS and real connected-page checks in the host acceptance;
the disposable fixture check covers only the evidence stated in its receipts.

## Back up and prove restoration

Before upgrades, stop `postiz` and `temporal` to quiesce writers, then take a
consistent host-volume snapshot covering `postiz-db`, `postiz-config`,
`postiz-uploads`, `redis-data`, `temporal-db`, `caddy-data` and `caddy-config`.
Alternatively use `pg_dump` for the Postiz database and both Temporal databases
while writers remain stopped, with matching upload/config snapshots. Encrypt the
backup outside the host, include the private environment and exact image/source
checksums in the protected recovery set, then restart the same release.

Restore into a separate hostname and volume namespace with publishing blocked at
the network boundary. Verify both organizations, their separate channels, stored
media, Temporal history and API authentication. A restore must never replay a
publication against real LinkedIn accounts. Record the restored backup ID,
checksums, health checks and isolation results before calling the backup proven.

## Release and recovery

Run a two-organization integration test: operation IDs remain isolated and foreign draft IDs are refused; a foreign page/media ID is refused; credential rotation and disconnect
stop pending sends. Publish only exact human-approved test posts. Retain the
Postiz post ID, LinkedIn URL and Accelerate attempt/approval receipts. Exercise
process interruption after provider acceptance and prove there is no second send.

An unknown submission stays unresolved until its exact provider receipt is
reviewed. Do not reset attempts, delete Temporal history or blindly retry. A
provider outage can delay reconciliation; it cannot justify claiming publication.
Keep the prior immutable release and backup for rollback. Restore data only after
reviewing effects since the backup; reverting application containers alone must
not replay already submitted work.

## Verify host-database permissions

Apply both ordered Social Marketing migrations through the canonical migration
runner. The privileges migration explicitly removes API-role function grants,
including grants inherited from a Supabase installation's defaults. Verify that
`authenticated` and `anon` cannot execute any of the four publication RPCs, while
`service_role` can. The application uses its verified tenant/actor host bridge;
RLS alone does not protect a security-definer function from an unintended grant.
