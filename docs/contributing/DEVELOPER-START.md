# Start development

Read [the north star](../NORTHSTAR.md), then [AGENTS.md](../../AGENTS.md). The live Feature Board owns work, dependencies and acceptance. Repository templates and dated reports help with orientation; they do not authorize a claim or replace newer live instructions.

## Start with the right checkout

The maintainer supplies the reviewed development branch or tag, its exact commit, and the repository URL. Use that ref when cloning; do not assume public `main` contains unmerged local work. For the integrated handoff candidate in this change:

```bash
git clone --branch agent/developer-handoff-readiness https://github.com/JohnConnorCode/accelerate-site.git
cd accelerate-site
export ACCELERATE_CONTROL="$PWD"
npm ci
npm run hooks:install
npm run dev:doctor
npm run dev
```

Open `/demo/command-center` on the local server to explore fictional data. Node 22 or newer is required. No production, provider or database credentials are needed for this exploration. A green default doctor result means local-demo prerequisites passed; it does not mean shared assignment or production is ready.

## Connect to assigned work

The maintainer must provide all of the following before a developer is expected to pick up tickets:

| Required handoff                                                        | What it establishes                                                                                                               |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Published development ref and exact commit                              | Another machine can fetch the agreed code.                                                                                        |
| HTTPS board URL running packet protocol v2                              | All workers use the same current definitions, claims and evidence.                                                                |
| Individually issued token with project, scopes, expiry and capabilities | The worker can read, claim, heartbeat, progress, release, block and submit only authorized work. Review authority stays separate. |
| Approved isolated test workspace and any required provider sandbox      | Service and integration verification can run without production keys or customer data.                                            |
| Named reviewer and integration/release owner                            | Submitted work has a clear next owner.                                                                                            |

Put only the supplied `WORK_BOARD_URL` and `WORK_BOARD_TOKEN` in an ignored `.env.agent.local` file, or export them from your secret manager. The CLI and doctor load that file automatically. Never paste the token into a ticket, commit, terminal argument or screenshot. A worktree does not inherit environment files: provide the same scoped token through the environment or a private file in the new checkout.

```bash
npm run dev:doctor -- --board
npm run agent:status
npm run agent:show -- --card <ticket-key>
npm run agent:next -- --card <ticket-key> --json
```

The board doctor makes only authenticated GET requests. It reports incompatible deployments, missing scopes and unfinished strict-write rollout. Resolve blocked checks with the maintainer before unattended shared dispatch. Per-ticket dependencies, capability requirements and WIP limits still apply.

Pickup checks the repository identity and exact approved base before claiming. If needed it fetches the declared branch from the existing matching `origin`; it never invents a branch, adopts a different repository or changes remote configuration. If the base exists only on the maintainer's machine, publish it first. A retained dirty or mismatched worktree needs inspection before reuse. `--no-worktree` is an explicit manual-preparation option, not automatic readiness proof.

The JSON result contains `worktree`, `controlCheckout` and the complete execution packet. Change into that directory and install compatible dependencies if needed. Worktree locations are consistent regardless of which checkout ran the command. Keep the published control checkout for board commands. A ticket may intentionally use an older application base with older scripts; run `npm --prefix "$ACCELERATE_CONTROL" run agent:heartbeat -- --card <ticket-key>` (and the equivalent progress, release or complete command) from any directory to use the current protocol. The private claim session lives in the repository's common Git directory.

## Execute and hand off

Follow the packet's ordered steps, scope exclusions and source revisions. Verify referenced prerequisite work before extending it. When acceptance or scope is ambiguous, record the exact missing decision and release/block the ticket so another worker does not independently invent the answer.

```bash
npm --prefix "$ACCELERATE_CONTROL" run agent:heartbeat -- --card <ticket-key>
npm --prefix "$ACCELERATE_CONTROL" run agent:progress -- --card <ticket-key> --message "Implemented the scoped path; controlled failure checks remain."
```

Renew before the 30-minute lease expires. When stepping away, release the claim and preserve the worktree. If an HTTP claim result is uncertain, retry the printed UUID with `agent:next -- --request-key <uuid>`; the exact original request and token are retained privately. Never start a second claim to guess whether the first succeeded. Expired claims require an operator's explicit recovery.

Run the packet's scoped checks and the [verification workflow](VERIFICATION-WORKFLOW.md). Use the shared resource gate for heavy work; the full build includes final TypeScript validation. Commit hooks stay offline and fast. Fresh installations should use `npm ci`; locally shared dependency symlinks may require `npm run build -- --webpack` because Turbopack rejects dependencies outside its filesystem root. Do not disable compiler checks.

An evidence file has this shape; replace every example with an actual result and cover every acceptance ID in its required environment:

```json
{
  "summary": "The approved business outcome and its failure cases were verified.",
  "commitSha": "<exact 40-character implementation commit>",
  "checks": [
    {
      "acceptanceId": "AC1",
      "environment": "local",
      "name": "<actual verification command>",
      "status": "passed",
      "evidence": "<actual result and durable artifact location>"
    }
  ]
}
```

```bash
npm --prefix "$ACCELERATE_CONTROL" run agent:complete -- --card <ticket-key> --evidence-file <absolute-path-to-evidence.json>
```

Submission enters review. Reviewer acceptance, Git integration, deployment and production proof are distinct records. A developer does not self-deploy to make a local acceptance check pass.

## Maintainer activation checklist

Before announcing open shared dispatch, publish the candidate and every referenced base branch, provide access and the isolated test setup, apply the ordered migration catalog through `20260907-work-packet-quality.sql`, deploy compatible adapters through the authorized release process, and verify strict write enforcement. Confirm a worker credential passes `dev:doctor -- --board` and perform one controlled claim, heartbeat, release/reclaim and evidence-review drill. Keep the drill's exact revision and receipt with the rollout card. Do not replace this proof with a local demo or a green build.
