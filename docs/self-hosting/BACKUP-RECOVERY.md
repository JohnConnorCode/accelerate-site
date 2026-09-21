# Back up and recover a workspace

Before importing business records, make a recovery copy and restore it into an isolated environment. A useful recovery copy includes database records, uploaded files, and the configuration needed to decrypt connections and run the same release.

## What to keep

- The exact application commit and migration ledger.
- A database backup covering application tables, private functions, Auth identities and Storage metadata. Preserve roles and grants through the provider's supported backup procedure.
- The actual bytes of every uploaded object, with its bucket, path and checksum. Database backups contain Storage metadata, not those files.
- An encrypted copy of the installation's environment configuration, especially provider encryption keys. Record Auth redirect URLs, email settings, storage policies, scheduled jobs, hosting target and domains separately.

Keep these copies outside the application host, encrypted and access-controlled. Never commit backups, connection strings or environment files. Record when each component was captured; pause imports, uploads, scheduled actions and external sends while taking a consistent recovery point. Provider callbacks can continue arriving, so retain their receipts and reconcile pending work before resuming effects.

## Database copy

Use the [Supabase backup procedure](https://supabase.com/docs/guides/platform/backups) appropriate to your plan. On free projects, maintain your own logical exports; do not assume downloadable daily backups or point-in-time recovery are included.

For a native PostgreSQL installation, set `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` and `PGSSLMODE` for the reviewed source. Supply authentication through a private `PGPASSFILE` with mode `0600` or your secret manager. Do not put passwords in command arguments. Then:

```bash
umask 077
BACKUP_DIR="$HOME/accelerate-private-backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
git rev-parse HEAD > "$BACKUP_DIR/application-commit.txt"
pg_dump --format=custom --file "$BACKUP_DIR/database.dump"
pg_restore --list "$BACKUP_DIR/database.dump" > "$BACKUP_DIR/database-contents.txt"
```

Check every command's exit status. An existing file is not a successful backup. Use a PostgreSQL client version compatible with the server. The database password, encryption keys and provider settings belong in the separate encrypted configuration copy.

For hosted Supabase, use its documented [backup and restore workflow](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Managed Auth, roles and extensions require provider-specific handling; do not restore a native whole-database dump over a running hosted project.

## Files and configuration

Use your Storage provider's authenticated export or S3-compatible tooling to copy every application bucket recursively into the protected backup directory. Preserve bucket/path names, byte counts, content types and checksums in a manifest. Compare the object count and total bytes with the source before marking the copy complete. Re-download a sample, including a knowledge document, and compare its checksum.

Export required environment values through your secret manager into an encrypted archive. Keep the decryption key separately accessible to the recovery owner. Without the original provider-encryption keys, restored encrypted connections cannot be read; reconnect them explicitly rather than replacing keys silently.

## Restore drill

1. Create an empty, isolated target. Record both project identities and confirm the destination has no customer data. Keep outbound providers, webhooks and schedules disabled throughout the drill.
2. Restore the database using the provider-supported procedure. For a disposable native database, set the PostgreSQL connection variables to that destination, then run `pg_restore --exit-on-error --no-owner --dbname="$PGDATABASE" "$BACKUP_DIR/database.dump"`. Do not add `--clean` against an existing workspace.
3. Restore uploaded bytes to their original bucket/path locations, and compare the file manifest. Restore necessary configuration securely, with test-only URLs and provider credentials.
4. Check out the recorded application commit. Verify the migration ledger before applying an upgrade; never edit recorded checksums or replay unknown history.
5. Sign in and verify an existing contact, completed task, document download, approved guidance, active membership and audit receipt. Verify a revoked member and a second tenant cannot access those records.
6. Measure elapsed recovery time and record the latest recovered record timestamp. Keep a receipt naming the source snapshot, destination, application commit, missing components and result. These observations establish your recovery capability; they are not an uptime guarantee.

Only promote a recovered installation after its owner reviews the result, switches its configuration deliberately, and reconciles external actions that may already have happened. A restored queued send can otherwise repeat an external effect.

## Application rollback

Use the guarded rollback command in [Deployment](../../DEPLOY.md#rollback) to select a previously verified application deployment. Preserve additive migrations and business records. Suspend external effects if authorization or action receipts are uncertain, then verify login, saved records, documents and health on the canonical domain before resuming work.

## Automated proof and its limits

`npm run resources:run -- npm run test:cold-start:postgres` creates a disposable native database, exercises concurrent rate limits, saves a contact/task, dumps the database and restores it into another disposable database. It verifies membership, the completed task and migration replay after restoration. It requires PostgreSQL client/server tools, including `pg_dump` and `pg_restore`.

Auth and Storage interfaces in that test are simulated. Hosted Auth, uploaded-object restoration and a human recovery drill need their own receipts. Never label the native test as a completed hosted restore.
