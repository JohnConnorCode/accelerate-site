# Verification workflow

Fast commits preserve small, reviewable checkpoints. CI and release verification
provide evidence that the integrated application works. A commit alone is never
release approval or evidence that a ticket is complete.

| Stage                      | Checks                                                                                                                   | Timing                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Commit                     | Staged whitespace/conflicts, JSON syntax, environment/key filenames and existing secret patterns                         | Every commit; offline, no dependencies beyond Git and Node |
| Iteration                  | Closest behavioral tests; `npm run typecheck` when useful                                                                | After relevant changes                                     |
| Local handoff              | `npm run verify:review` plus the card's scoped tests and visual/provider evidence                                        | Once for the final relevant source tree                    |
| Pull request / merge queue | All repository contracts, strict lint/format, core tests and full type-checking build                                    | Every candidate; independent checks and build jobs         |
| Production release         | Reconcile branches, verify the immutable release tree, build and deploy that exact revision, inspect production receipts | Only with explicit founder release authorization           |

## Install the project hooks

```bash
npm run hooks:install
```

Installation is explicit and applies to the current worktree through Git's
`extensions.worktreeConfig` and `core.hooksPath`. Other worktrees retain their
existing configuration. The installer preserves the old `.git/hooks` files and
the user's global Git templates. Run it in each checkout after this change is
available there. To undo the local opt-in:

```bash
git config --worktree --unset core.hooksPath
```

The hook reads **staged blobs**, so an unstaged correction cannot conceal a
broken commit and unrelated unstaged work cannot block a valid one. It never
stashes, reformats, stages files, queries Supabase, or builds the app. Findings
name files and pattern categories without printing secret values. Pattern checks
are a useful early guard, not a guarantee that a repository contains no secrets.

`npm run verify:commit` runs the same checks manually. Live Feature Board status
remains explicit operational work: `agent:next`, `agent:heartbeat`,
`agent:complete`, and `verify:feature-status`. A network outage or another agent's
lease change must not prevent saving a local checkpoint.

## Review once, retain accurate evidence

`npm run verify:review` runs the engineering contract, guardrails, lint, core
suite, and production build. Run the card's additional scoped checks as needed.
The build already performs TypeScript validation, so a successful build satisfies
the final typecheck requirement for the same relevant source tree. Standalone
`typecheck` remains available for faster feedback during editing. Never enable
`typescript.ignoreBuildErrors` to shorten verification.

Record commands, outcomes and the verified revision in ticket evidence. Rerun
checks when their inputs change, a failure is fixed, or a new concern emerges.
Do not repeat a build merely because you are committing or updating ticket prose.
Documentation-only changes need their applicable docs/format/link checks;
hook/CI changes need their own behavioral and workflow validation. Application
source, dependencies, build configuration and release inputs still require a
fresh build before a shipped code handoff.

There is no cached-pass bypass. CI checks fresh checkouts independently. Its
`checks` and `build` jobs run in parallel; the existing `verify` result fails if
either fails, is cancelled, or is skipped. The compiler cache accelerates work,
but every run still executes the build. Only superseded pull-request runs are
cancelled; merge-queue and main receipts remain revision-specific. Strict CI
lint/format policies are unchanged. Remote branch-protection settings must still
require `verify`; changing YAML does not configure GitHub repository rules.

## Why this replaces the old hook

The inherited, untracked universal hook ran standalone TypeScript, repository
contracts, live Feature Board status and a full build on every commit. During
work-completion-truth it collided with an already-running build; a later hook
build alone compiled for 52 seconds and typechecked for 94 seconds before page
generation. The local verification and CI then repeated much of that work.

Measured on this 15-file change, three staged-hook runs took 708ms, 799ms and
1002ms on the same busy machine. These are local timings, not a CI performance
guarantee.

The versioned hook puts immediate checks next to editing and expensive checks at
review/release boundaries. This keeps checkpoints cheap while preserving the
Northstar's requirement for trustworthy evidence.

References: [Git hooks](https://git-scm.com/docs/githooks),
[Git worktree configuration](https://git-scm.com/docs/git-worktree#_configuration_file),
[Next.js build type checking](https://nextjs.org/docs/app/api-reference/config/next-config-js/typescript),
[GitHub concurrency](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency).
