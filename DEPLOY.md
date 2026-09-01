# Deployment

The repository supports a prebuilt Vercel release path, but every fork must link its own hosting project and configure its own environment.

## First deployment

1. Create or select a Vercel project you control.
2. Run `vercel link` and confirm the generated `.vercel/project.json` points to that project. The `.vercel` directory is ignored and must never be committed.
3. Add production variables from `.env.example` through the Vercel dashboard or CLI.
4. Configure the canonical domain and Supabase authentication callback URLs.
5. Run the verification suite before enabling provider effects or importing real data.

## Release commands

```bash
npm run deploy:check
npm run deploy
```

`npm run deploy` pulls production configuration, creates a prebuilt output with the current commit as its immutable release identity, verifies that identity, and uploads the archive to production.

The command intentionally uses `--prebuilt` and `--archive=tgz`. Prebuilt deployment keeps local and hosted artifacts aligned; the archive avoids thousands of individual file uploads.

## Verification

Do not treat a successful upload as a complete release. Record:

- the full commit SHA;
- the provider deployment ID and `READY` state;
- the canonical alias;
- the release identity returned by the canonical document;
- the relevant service and browser journeys; and
- final repository/worktree status.

At minimum, verify the canonical home page, fictional Command Center, authentication boundary, Settings/Setup health, and one desktop/mobile admin matrix.

## Rollback

```bash
npm run deploy:rollback
```

Rollback should re-alias a previously verified deployment. Do not remove tenant-aware schema or delete customer data during an application rollback. Suspend external effects when a release may have crossed an authorization, idempotency, or provider boundary.

## Maintainer safety

- Never copy another installation's `.vercel` directory or credentials.
- Never commit `.env` files, provider payloads, access tokens, or deployment auth files.
- Confirm the active Vercel account and project before every production action.
- Production deployment requires explicit maintainer authority; a passing pull request is not release approval.
