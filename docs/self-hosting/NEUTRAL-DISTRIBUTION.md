# Neutral fork distribution

This repository can run two profiles. They share the same admin, runtime, plugins and approval services.

| Profile             | When                                 | Identity                                                                                                   |
| ------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `branded` (default) | The original Accelerate installation | Marketing site, `deployment-target.json`, and tenant bootstrap stay Accelerate                             |
| `neutral`           | A fork or a new business             | Entry pages, authentication chrome, AI identity, metadata and email footer come from the configured tenant |

Set `NEXT_PUBLIC_DISTRIBUTION_PROFILE=neutral` in the fork environment. Leave it unset to preserve the branded installation.

## Hosting

Copy `deployment-target.example.json` to `deployment-target.json` and fill IDs for a Vercel project you control:

```bash
node scripts/generate-fork-hosting.mjs --project prj_your_id --team team_your_id --name my-revenue-os --url https://your-business.example
```

The generator refuses the original Accelerate project, team and canonical URL. `vercel.json` keeps automatic Git deployments off until you enable them in your project. Cron routes in that file stay disabled until you set `CRON_SECRET` and a scheduler you own. `npm run deploy:check` in the neutral profile also refuses original IDs.

This does not deploy the original production account.

## Protected media

`distribution/inclusion-manifest.json` lists agency, customer and personal media that belong to this branded repository. A starter must omit those paths; hiding a nav link while still serving the file is not enough. `npm run test:neutral-runtime-distribution` proves excluded paths stay out of the starter file list while admin, runtime, extensions and self-hosting docs remain.

Replace remaining bootstrap identity in `src/config/tenant.ts` and `BOOTSTRAP_*` with the fork's business before the first connected install.

## Stable extensions vs sample screens

Stable interfaces: module manifests in `extensions/`, integration adapters, registered AI tools, the isolate host, the approval queue and the audit ledger. See [Extending](../contributing/EXTENDING.md).

Sample business applications: fictional demo workspaces, marketing case-study pages, and plugin examples under `plugins/` that demonstrate a pattern. Keep those as examples; put your business records in your own workspace.

To take upstream upgrades, keep a fork on published `main`, replace only tenant identity, hosting IDs and excluded media, and avoid editing `src/lib/revenue-os/` unless you are contributing the change back.
