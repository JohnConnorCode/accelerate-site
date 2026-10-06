# Back up and recover a workspace

Before importing business records, make a recovery copy and restore it into an isolated environment. A useful recovery copy includes database records, uploaded files, and the configuration needed to decrypt connections and run the same release.

## What to keep

- The exact application commit, migration ledger, fork-owned source changes and plugin assets.
- A database backup covering tenant records and memberships, business configuration, provider account identities and sync cursors, action/work checkpoints, immutable receipts, private functions, Auth identities and Storage metadata. Preserve roles and grants through the provider's supported backup procedure.
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

With the reviewed source configuration in `.env.local`, run:

```bash
npm run workspace:files -- backup --project YOUR_SOURCE_REF --directory /absolute/private/new-files-copy
```

The destination must not exist. This command copies actual bytes from every bucket, including nested files, and writes a private manifest with bucket policies, paths, byte counts, content types and SHA-256 checksums. It compares the source inventory again before completing. The printed receipt contains counts and timing, without credentials or file names. A stopped copy has no completed manifest; retain it for diagnosis and retry into a new directory after resolving access or pausing uploads.

The command handles files up to 100 MB and at most 25,000 inventory entries, including folders. Use the provider's authenticated S3 export for larger collections. Keep the local copy on protected storage and encrypt it before moving it off-host. A private filesystem mode is not encryption. Bucket and file access policies also need the matching database migrations or provider-supported schema restoration; copying bytes alone does not restore authorization.

Export required environment values through your secret manager into an encrypted archive. Keep the decryption key separately accessible to the recovery owner. Without the original provider-encryption keys, restored encrypted connections cannot be read; reconnect them explicitly rather than replacing keys silently.

Record external dependencies separately: Auth URL/SMTP/OAuth settings, encryption keys, hosting and domains, Storage policies, Cron/Vault configuration, provider webhooks and provider-side receipts. An enabled Social Marketing/Postiz installation has its own data volumes and provider configuration; use `deployment/README.md` for that package. Those components are not restored by the file command or the native core drill.

## Restore drill

1. Create an empty, isolated target. Record both project identities and confirm the destination has no customer data. Keep outbound providers, webhooks and schedules disabled throughout the drill.
2. Restore the database using the provider-supported procedure. For a disposable native database, set the PostgreSQL connection variables to that destination, then run `pg_restore --exit-on-error --no-owner --dbname="$PGDATABASE" "$BACKUP_DIR/database.dump"`. Do not add `--clean` against an existing workspace.
3. Select the reviewed target environment, then run the file plan and apply commands below. Restore necessary configuration securely, with test-only URLs and provider credentials. Keep the original encryption key in the separate configuration archive until receipt reconciliation is complete.
4. Check out the recorded application commit. Verify the migration ledger before applying an upgrade; never edit recorded checksums or replay unknown history.
5. Sign in and verify an existing contact, completed task, document download, approved guidance, active membership and audit receipt. Verify a revoked member and a second tenant cannot access those records.
6. Measure elapsed recovery time and record the latest recovered record timestamp. Keep a receipt naming the source snapshot, destination, application commit, missing components and result. These observations establish your recovery capability; they are not an uptime guarantee.

Only promote a recovered installation after its owner reviews the result, switches its configuration deliberately, and reconciles external actions that may already have happened. A restored queued send can otherwise repeat an external effect.

### Restore uploaded files

Use the target's `.env.local` and its exact project reference:

```bash
npm run workspace:files -- restore --project YOUR_TARGET_REF --directory /absolute/private/files-copy
npm run workspace:files -- restore --project YOUR_TARGET_REF --directory /absolute/private/files-copy --apply
npm run workspace:files -- restore --project YOUR_TARGET_REF --directory /absolute/private/files-copy
```

The first command is read-only. It verifies every local checksum before contacting the target, refuses the source project or API origin, and rejects conflicting files or bucket policies before writing. The apply command creates missing buckets with the saved settings and uploads without overwriting, then downloads and verifies each uploaded object. The final plan should show `pending: 0`. A stopped restore can be inspected and resumed with the same commands; already matching files are retained. Never resolve a conflict by deleting customer files or adding an overwrite flag. Choose a reviewed empty target or reconcile that conflict first.

`files_verified` confirms uploaded bytes only. Its `effectsResumeAllowed: false` is a receipt, not an application-wide pause switch. Keep the app inaccessible to workers and provider callbacks, omit outbound credentials, and leave schedules disabled until the recovery owner approves reactivation.

### Resume work after receipt review

1. Keep the restored application, callbacks and schedules stopped while validating records, permissions, file checksums and encryption-key access. Do not start a connected app merely because its database restore completed.
2. In the isolated workspace, inspect **Activity**, **Today**, and the relevant provider's own records. Compare action receipts and idempotency identities with effects since the backup point. A missing local receipt does not prove that an email, invoice or payment never happened.
3. Work recorded as requiring reconciliation remains terminal; a scheduler claim cannot reopen it. Executed actions cannot be claimed again, and expired plugin operations require receipt reconciliation before new work. Preserve provider identities, sync cursors and checkpoints. Do not set queue rows back to pending with SQL.
4. For an unresolved outcome, keep that provider disconnected. Once its receipt establishes what happened, use the relevant supported review/retry workflow to prepare any remaining work. Recheck current permissions and approvals.
5. Restore only the reviewed provider credentials, verify Auth redirects and the canonical hostname, then re-enable callbacks and schedules deliberately. Record the owner, recovery receipt and connections resumed. A file-copy success never authorizes this step automatically.

## Application rollback

Use the guarded rollback command in [Deployment](../../DEPLOY.md#rollback) to select a previously verified application deployment. Preserve additive migrations and business records. Suspend external effects if authorization or action receipts are uncertain, then verify login, saved records, documents and health on the canonical domain before resuming work.

## Automated proof and its limits

`npm run resources:run -- npm run test:cold-start:postgres` creates a disposable native database, exercises concurrent rate limits, saves a contact/task, dumps the database and restores it into another disposable database. It verifies membership, the completed task and migration replay after restoration. It requires PostgreSQL 15+ binaries on `PATH`, including `initdb`, `pg_ctl`, `psql`, `pg_dump` and `pg_restore`.

Auth and Storage interfaces in that test are simulated. Hosted Auth, uploaded-object restoration and a human recovery drill need their own receipts. Never label the native test as a completed hosted restore.

The **Connected fork** workflow also runs `npm run test:release-recovery` on an isolated Docker runner with Supabase CLI 2.72.7 and PostgreSQL 17. It creates two owned native Supabase projects, uses real Auth and Storage APIs, populates two tenants from a pinned earlier published source revision, copies private files, and restores application/Auth data into a distinct empty target. Matching source migrations rebuild routines and policies before this disposable native data-only restore; managed hosted restoration remains provider-specific. It applies pending current migrations, repeats the migration verification, and checks password login, RLS, foreign keys, immutable provider evidence, ciphertext/key boundaries and quarantined work.

The safe `release-recovery-evidence/receipt.json` artifact records the exact commit, earlier source commit, table counts, file counts/bytes, recovery point, deliberately omitted post-backup write, and measured recovery time. Recovery time includes target startup and verification; the loss window measures only this controlled fixture. Read those observed numbers for the tested data size rather than treating them as a recovery guarantee. Private dumps, file copies, passwords and keys never enter that artifact. A failed stage produces `failure.json` and cannot claim acceptance. Run the owned drill through the workflow, or set `RECOVERY_PROOF_NATIVE=1` and `RUNNER_TEMP` on a disposable Docker runner before the resource-gated test command. It never targets an existing project.

This proves local native recovery, not hosted provider restoration, production activation or a human recovery trial. Complete those receipts for the installation you intend to release.
