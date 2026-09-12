# Start development

Read [the north star](../NORTHSTAR.md), then [AGENTS.md](../../AGENTS.md). The live Feature Board owns work, dependencies and acceptance. Repository templates and dated reports help with orientation; they do not authorize a claim or replace newer live instructions.

## Start with the right checkout

Use published `main` for the control checkout. The integration owner supplies its
exact verified commit; fetch it before starting. Temporary `agent/*` branches are
implementation or integration candidates, not a second permanent baseline. Active
tickets retain their own approved immutable bases. See [Development baseline](DEVELOPMENT-BASELINE.md).

```bash
git clone --branch main https://github.com/JohnConnorCode/accelerate-site.git
cd accelerate-site
export ACCELERATE_CONTROL="$PWD"
npm ci
npm run hooks:install
npm run dev:doctor
npm run dev
```

Open `/demo/command-center` on the local server to explore fictional data. Node 22.16 or newer is required. No production, provider or database credentials are needed for this exploration. A green default doctor result means local-demo prerequisites passed; it does not mean shared assignment or production is ready.

## Connect to assigned work

### Natural-language pickup

Agents should understand “pick up work from the backlog and go until it is
completed and committed” as the complete execution request. The user does not
need to provide a card key or the internal command name. After reading the
repository entrypoint, run the internal `agent:go` runner, accept its selected
worktree and packet, and continue until evidence is submitted or an explicit
operator block is returned. Do not stop at `git status`, `git log`, broad
documentation browsing, or a status-only answer. See [Natural-language agent
execution](NATURAL-LANGUAGE-AGENT.md).

The maintainer must provide all of the following before a developer is expected to pick up tickets:

| Required handoff                                                                                                                                   | What it establishes                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Published development ref and exact commit                                                                                                         | Another machine can fetch the agreed code.                                                                                        |
| HTTPS board URL running packet protocol v2 for remote workers, or the local Supabase board for an owner-authorized local profile                   | All workers use the same current definitions, claims and evidence.                                                                |
| Individually issued remote token with project, scopes, expiry and capabilities, or an owner-authorized local operator profile with a named project | The worker can read, claim, heartbeat, progress, release, block and submit only authorized work. Review authority stays separate. |
| Approved isolated test workspace and any required provider sandbox                                                                                 | Service and integration verification can run without production keys or customer data.                                            |
| Named reviewer and integration/release owner                                                                                                       | Submitted work has a clear next owner.                                                                                            |

For remote dispatch, put only the supplied `WORK_BOARD_URL` and `WORK_BOARD_TOKEN` in an ignored `.env.agent.local` file, or export them from your secret manager. For owner-operated local dispatch, the maintainer may configure one private `work-board-operator.json` profile with a named project and the existing `.env.local`; `agent:go` detects it automatically in every worktree. The CLI and doctor load the configured private transport automatically. Never paste a token or database key into a ticket, commit, terminal argument or screenshot. A worktree does not inherit environment files; the shared private profile supplies the transport without another user prompt.

```bash
npm run dev:doctor -- --board
npm run agent:go -- --json
```

The board doctor is the remote HTTP readiness check. A configured local operator
profile is checked by `agent:go` itself and does not need a remote URL or token.

For a named task, add `--card <ticket-key>`. The first connected machine can
create its private reusable profile with
`npm run agent:setup -- --env-file /absolute/path/to/.env.agent.local`; the
profile contains no credential. An owner-authorized local profile uses
`npm run agent:setup -- --local-operator --project accelerate --env-file /absolute/path/to/.env.local`;
it contains only the named project and env-file path. The natural-language request in
[Natural-language agent execution](NATURAL-LANGUAGE-AGENT.md) is the normal
user interface after setup.

The board doctor makes only authenticated GET requests. It reports incompatible deployments, missing scopes and unfinished strict-write rollout. Resolve blocked checks with the maintainer before unattended shared dispatch. Per-ticket dependencies, capability requirements and live claim ownership still apply. Work volume does not block claims; explicitly requested expired tasks continue with a fresh revision and token.

Pickup checks the repository identity and exact approved base before claiming. If needed it fetches the declared branch from the existing matching `origin`; it never invents a branch, adopts a different repository or changes remote configuration. If the base exists only on the maintainer's machine, publish it first. A retained dirty or mismatched worktree needs inspection before reuse. `--no-worktree` is an explicit manual-preparation option, not automatic readiness proof.

The JSON result contains `worktree`, `controlCheckout` and the complete execution packet. Change into that directory and install compatible dependencies if needed. Worktree locations are consistent regardless of which checkout ran the command. Keep the published control checkout for board commands. A ticket may intentionally use an older application base with older scripts; run `npm --prefix "$ACCELERATE_CONTROL" run agent:heartbeat -- --card <ticket-key>` (and the equivalent progress, release or complete command) from any directory to use the current protocol. The private claim session lives in the repository's common Git directory.

## Execute and hand off

Follow the packet's ordered steps, scope exclusions and source revisions. Verify referenced prerequisite work before extending it. When acceptance or scope is ambiguous, record the exact missing decision and release/block the ticket so another worker does not independently invent the answer.

```bash
npm --prefix "$ACCELERATE_CONTROL" run agent:heartbeat -- --card <ticket-key>
npm --prefix "$ACCELERATE_CONTROL" run agent:progress -- --card <ticket-key> --message "Implemented the scoped path; controlled failure checks remain."
```

Renew before the 30-minute lease expires. When stepping away, release the claim and preserve the worktree. If an HTTP claim result is uncertain, retry the printed UUID with `agent:next -- --request-key <uuid>`; the exact original request and token are retained privately. Never start a second claim to guess whether the first succeeded. Resume an explicitly requested expired task through the normal claim path without another recovery approval; preserve its retained checkout.

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
