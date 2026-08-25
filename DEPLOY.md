# Deploying acceleratewith.us

**One npm script. No git push. No surprises.**

```bash
npm run deploy
```

That's the entire deploy. It runs `vercel pull → vercel build --prod → vercel deploy --prebuilt --prod`. Read on for why, how to verify, how to roll back, and what to do when things go sideways.

---

## The non-negotiable rules

1. **Always deploy with `npm run deploy` (Vercel CLI), never `git push`.**
   The Vercel project lives on **John Connor's** personal account (`john-connors-projects-d9df1dfe`), migrated off Robert Farrell's team on 2026-08-24. No Git repository is connected (the auto-connect attempt during migration failed silently and was left disconnected on purpose), so there is no Commit-Author Verification to trip. CLI deploys in `--prebuilt` mode upload `.vercel/output` directly: no source upload, no `.git` read, no commit-author check. Keep deploying this way regardless — it's also just less to go wrong.

2. **Be logged into the right Vercel account first.**
   `npm run deploy:check` prints the active account + accessible teams. Required values:
   - `vercel whoami` → `johnconnorcode`
   - `vercel teams ls` → `john-connors-projects-d9df1dfe`
   
   If you're on a different account (Robert's, Theresa's, etc.), `vercel logout && vercel login` and authorize as the right account in the browser.

3. **Never run `vercel link`** — the project is already linked via `.vercel/project.json`. `vercel link` without `--project` will offer to create a new project on whatever team you're authed against. That's how we accidentally created a phantom `accelerate-site` under the wrong team.

---

## Commands

| Command | What it does |
|---|---|
| `npm run deploy` | The whole deploy. Pull env → build locally → upload prebuilt to production. |
| `npm run deploy:check` | Verify you're on the right Vercel account + team. **Run this first if anything feels off.** |
| `npm run deploy:pull` | Fetch latest env vars + project settings from Vercel into `.vercel/`. |
| `npm run deploy:build` | Local production build → `.vercel/output`. |
| `npm run deploy:upload` | Upload the prebuilt output as a production deploy. |
| `npm run deploy:rollback` | Roll the production alias back to a previous deployment (interactive picker). |

---

## Full deploy flow (what `npm run deploy` actually does)

```bash
vercel pull --yes --environment=production    # fetch env vars + project settings
vercel build --prod                            # build locally → .vercel/output
vercel deploy --prebuilt --prod                # upload prebuilt, no source, no git
```

You want to see at the end:

```
"readyState": "READY"
"target": "production"
"url": "https://accelerate-site-<hash>-john-connors-projects-d9df1dfe.vercel.app"
```

`www.acceleratewith.us` aliases to the new deployment automatically.

---

## Verify (always do this after deploying)

```bash
curl -sI https://www.acceleratewith.us | head -3                             # expect HTTP/2 200
curl -sL https://www.acceleratewith.us/ | grep -o "logo-mark__cv" | head -1  # confirm new build
```

Note: `acceleratewith.us` 307-redirects to `www.acceleratewith.us`. Always verify the `www` URL.

---

## Why these flags?

**`--prebuilt`** — `vercel deploy --prod` (without `--prebuilt`) uploads source files AND reads `.git/` metadata. Vercel then runs Commit-Author Verification against the latest commit. If the author isn't a team member, the deploy goes `readyState: BLOCKED` — and the CLI just shows `UNKNOWN` with no error message. The dashboard shows: *"Deployment Blocked — the commit email could not be matched to a GitHub account."* `vercel deploy --prebuilt --prod` uploads only the `.vercel/output` directory (already built locally). No source, no git read, no author check. Goes straight to `READY`.

**`--archive=tgz`** — Vercel's free tier limits to 5000 file uploads per 24 hours. A Next.js build has thousands of files; without this flag a single deploy can blow through the quota and you'll get `Too many requests — "api-upload-free"`. `--archive=tgz` bundles everything into one tarball so it counts as **one** upload. Harmless on paid tiers. Always on.

---

## Rolling back

If a deploy ships a bug, roll back to the previous working deployment:

```bash
npm run deploy:rollback
```

Interactive picker. Pick a previous `Ready` deploy and Vercel re-aliases the production domain to it. **No new deploy is built** — it just re-points.

To inspect previous deploys before rolling back:

```bash
vercel ls accelerate-site
```

---

## Updating environment variables

Production env vars live in the Vercel dashboard (not in `.env.local`). To change them:

1. Set the value in the Vercel dashboard (Project → Settings → Environment Variables).
2. Pull the updated env locally + redeploy:
   ```bash
   npm run deploy
   ```
   (The `deploy:pull` step refreshes `.vercel/.env.production.local` before building.)

For local dev, edit `.env.local` (gitignored). It is **not** auto-synced with production.

---

## Diagnosing a broken deploy

| Symptom | Real cause | Fix |
|---|---|---|
| `vercel ls` → "Could not retrieve Project Settings" | Logged into wrong account | `vercel logout && vercel login` to Robert's account |
| Deploy stuck in `UNKNOWN` / `BLOCKED` | Commit-Author Verification rejected the git author | You're not using `--prebuilt`. Run `npm run deploy` (which uses `--prebuilt`) |
| `acceleratewith.us` shows the old site | Domain redirects to `www.` — check `www.acceleratewith.us` | Always curl the `www.` URL |
| `vercel link` created the wrong project | Ran `vercel link` without `--project` | `vercel project rm <name>` to delete the phantom; restore `.vercel/project.json` from the reference below |
| `Too many requests… "api-upload-free"` on upload | Free-tier file-count limit (5000 / 24h). Each project file = one upload. | The deploy script already uses `--archive=tgz` — uploads everything as one tarball, bypasses the limit. If a future fork drops the flag, restore it. |
| Build fails with `Unable to acquire lock at .next/lock` | Zombie `next build` (or `next dev`) from a prior session is still alive | `pgrep -af node \| grep accelerate-site \| awk '{print $1}' \| xargs -r kill -9` then `rm -rf .next .vercel/output` and retry |
| Build fails with `Build error: ENOENT … server/pages-manifest.json` | Concurrent `next build` instances clobbering `.next` (Turbopack issue) | Same fix as above — kill all zombies, `rm -rf .next`, single retry |
| `Type error: Route "…/route.ts" … "_FOO" is not a valid Route export field` | Next 16+ only allows specific exports from `app/*/route.ts` (HTTP verbs + a small metadata allowlist) | Move the custom export to a non-route module (e.g. `src/lib/…`). Routes can only export verb handlers + `dynamic` / `revalidate` / `runtime` etc. |
| Deploy uploads but you don't see new code on the domain | `acceleratewith.us` → 307 → `www.acceleratewith.us` (always test the www URL); or the deploy actually went to a different account | Run `npm run deploy:check` to confirm account, then `vercel ls accelerate-site` to verify the latest deploy is `● Ready` and is from `johnconnorcode` |

To pull the true state of any deploy when the CLI hides it:

```bash
TOKEN=$(jq -r .token ~/Library/Application\ Support/com.vercel.cli/auth.json)
TEAM=team_aoXdtupaCmY2LDwBtCd4d7If
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.vercel.com/v6/deployments?projectId=accelerate-site&teamId=$TEAM&limit=5" \
  | jq '.deployments[] | {state, url, created, meta: {commit: .meta.githubCommitSha[0:7]}}'
```

`state` values you'll see:
- `READY` — live (or available to be aliased)
- `BUILDING` — building right now
- `BLOCKED` — deployment-authorization held it (use `--prebuilt`)
- `ERROR` — build failed (check logs in Vercel dashboard)

---

## If `.vercel/project.json` ever goes wrong

Restore it to exactly:

```json
{
  "projectId": "prj_w46n3AgV4L4IGEJZ0WzCBCZhDTot",
  "orgId": "team_aoXdtupaCmY2LDwBtCd4d7If",
  "projectName": "accelerate-site"
}
```

Then `npm run deploy:check` to verify the link resolves.

---

## Reference card

```
Team:       john-connors-projects-d9df1dfe (id team_aoXdtupaCmY2LDwBtCd4d7If)
Project:    accelerate-site                 (id prj_w46n3AgV4L4IGEJZ0WzCBCZhDTot)
Domain:     acceleratewith.us → 307 → www.acceleratewith.us
Owner:      johnconnorcode (John Connor's personal account)
CLI auth:   ~/Library/Application Support/com.vercel.cli/auth.json
Min CLI:    50.x (must support vercel build --prod + --prebuilt)
```

Migrated off Robert Farrell's team (`robert-farrells-projects`) on 2026-08-24: new
project created under John's account, all 13 readable production env vars copied
over (`OPENROUTER_API_KEY` could not be read back from Robert's account — it is a
Vercel "sensitive" var, write-only even to the owner; re-add it manually), a fresh
`CRON_SECRET` generated (self-referential, doesn't need to match the old value),
and both domains moved with zero DNS changes since Namecheap already pointed at
Vercel's generic edge IPs — only the Vercel-side project assignment changed.
Robert's original project (`prj_JDk6HGWB7lcgeJlusvWZmYxIIrfj` /
`team_qHBO9P2V9uF31MH4k6s4mz8F`) still exists as a dormant fallback with the
domain removed; delete it once the new project has proven itself.

```
DEPLOY                       → npm run deploy
VERIFY ACCOUNT FIRST         → npm run deploy:check
ROLL BACK                    → npm run deploy:rollback
DEPLOY HISTORY               → vercel ls accelerate-site
SWITCH ACCOUNT               → vercel logout && vercel login
```
