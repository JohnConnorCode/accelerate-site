# Deployment

The repository supports a prebuilt Vercel release path, but every fork must link its own hosting project and configure its own environment.

## Fork preview

A fork must create its own Vercel project. Do not link, deploy to, or copy the original Accelerate project IDs in the table below. Those identify the reference installation only. Use `deployment-target.example.json` and `node scripts/generate-fork-hosting.mjs`, or the Deploy with Vercel button in README.md, then `npm run deploy:check` on a project you control. Set `NEXT_PUBLIC_DISTRIBUTION_PROFILE=neutral` so entry identity follows the configured business. Automatic Git deployments stay off until you enable them in the new project's Settings → Git. Production deployment of the original installation remains a separate maintainer action.

## Account and project preflight

Read `deployment-target.json` before any hosting diagnosis. The Accelerate installation expects:

| Setting       | Expected value                     |
| ------------- | ---------------------------------- |
| Project       | `accelerate-site`                  |
| Project ID    | `prj_w46n3AgV4L4IGEJZ0WzCBCZhDTot` |
| Team ID       | `team_aoXdtupaCmY2LDwBtCd4d7If`    |
| Canonical URL | `https://www.acceleratewith.us`    |

These are nonsecret installation identifiers. Fork maintainers must replace them with their own reviewed target; never change them merely to make an unexpected login pass.

Run `vercel whoami` and `vercel teams ls` first. Confirm access to the expected team ID, then inspect the exact project:

```bash
vercel api '/v9/projects/prj_w46n3AgV4L4IGEJZ0WzCBCZhDTot?teamId=team_aoXdtupaCmY2LDwBtCd4d7If'
```

If access fails, correct the CLI login with `vercel login` using the existing project owner's account or an authorized team member. Do not create a replacement project, copy another checkout's hosting configuration, investigate billing, or infer suspension from an unrelated account. If the request fails after identity matches, distinguish network/authentication errors from an explicit provider restriction.

After confirming access, use `vercel link --project accelerate-site --scope <verified-team-slug>` in this checkout and run `npm run deploy:check`. The check compares the local link and environment overrides with the declared IDs and verifies authenticated access to that exact project/team. It stops before configuration pull, Vercel build, upload or rollback when identity cannot be verified.

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

The prebuilt identity check supports both the static demo document and the server function produced by a connected installation. For a server function, it verifies the packaged Next.js configuration carries the exact release identity and disables runtime identity overrides. The canonical hosted document is still checked after deployment.

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
