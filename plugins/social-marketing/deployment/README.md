# Run the Postiz publishing service

This is a separate service deployment. The Accelerate application remains the
owner of drafts, approvals, scheduling and publication receipts. Postiz needs a
persistent Linux host, public HTTPS hostname and a LinkedIn application approved
for the required company-page access. Provision one Postiz organization per
Accelerate tenant. Customer groups do not provide tenant isolation.

## Prepare an immutable release

1. Run `./prepare-source.sh` in this directory. It checks out upstream commit
   `3cbe20b86bf3b2243843d51bb63dcec8773babf7` and applies `identity.patch`. The patch
   adds organization identity to the authenticated connection check; an unpatched
   upstream service is deliberately refused by the Accelerate adapter.
2. Build from that source using `docker build -f upstream/Dockerfile.dev
--build-arg NEXT_PUBLIC_VERSION=accelerate-3cbe20b-1 -t <registry>/postiz:<release>
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
   serves `/source/postiz-source.tar.gz`; provide that link to service users.
   Upstream is AGPL-3.0; preserve its license and attribution, including this
   modification and the source/build material. See `POSTIZ-LICENSE`.
6. Run `./validate-release.sh` with the private environment exported and inspect the exposed ports. Only HTTPS and
   its HTTP redirect are public; Postgres, Redis and Temporal have no host ports.
   Start with `docker compose up -d` on the chosen host. Confirm container health,
   HTTPS, source download and persistent volume ownership.
7. Registration is disabled by default. For first-owner bootstrap, temporarily
   enable registration only behind an operator access restriction, create the
   owner, then disable it and remove the restriction after verification. Create
   isolated organizations and connect their LinkedIn pages in upstream setup.
8. Set the Accelerate server-only `POSTIZ_ORIGIN=https://<POSTIZ_HOST>`. Enable
   Social Marketing for the test workspace and connect its organization API key
   through **Social Marketing → Setup**. The organization identity must match,
   and the same organization cannot be attached to two Accelerate tenants.

The supplied `API_LIMIT=30` caps Postiz create-post requests at thirty per hour per organization in the pinned upstream guard. Other reads are not counted by that guard. Size publishing batches and service capacity accordingly; increasing this setting does not increase LinkedIn permissions or quotas.

The supplied Compose uses Temporal's PostgreSQL visibility store rather than
Elasticsearch. Validate the pinned service startup and publication workflow on
an isolated host before release. Source preparation and a valid Compose file do
not establish that a live host or LinkedIn application is ready.

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
