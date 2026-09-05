# Contributing

Thanks for helping improve Accelerate Revenue OS.

## Before opening a change

1. Check the [roadmap](https://www.acceleratewith.us/roadmap) and search existing issues (issues labeled `help wanted` are a curated, dependency-satisfied subset of the roadmap, safe to pick up without waiting on other work). `scripts/feature-backlog-data.mjs` is the canonical backlog behind both, with acceptance criteria and dependencies already written out for planned and backlog cards.
2. Keep the proposed scope narrow.
3. Read `AGENTS.md` and the contract relevant to your change.
4. For security-sensitive behavior, open a private report instead of a public issue.
5. Never use real customer data, production credentials, or production mutations for development or screenshots.

## Local workflow

The commands below assume a running instance with `.env.local` configured
and migrations applied. If you're starting from a fresh clone with neither,
follow [docs/self-hosting/SELF-HOSTING.md](docs/self-hosting/SELF-HOSTING.md) first.

```bash
npm ci
npm run hooks:install
npm run verify:review
npm run format:check
```

Commit hooks check staged content without a build or live database access. Run
review verification once for the final relevant source tree; the production build
also checks TypeScript. Standalone `npm run typecheck` is available during editing.
See [verification workflow](docs/contributing/VERIFICATION-WORKFLOW.md) for CI,
worktree installation and release boundaries.

Run the closest service or Playwright journey for the behavior you changed. Visual work requires desktop and mobile screenshots, keyboard coverage, console-error checks, and reduced-motion coverage when motion is involved. `node scripts/shot.mjs <path> <label> [width] [height]` and `node scripts/film.mjs <path> <frames> <mode>` are ad hoc Playwright tools for capturing those screenshots against a local dev server; each has a usage comment at the top of the file.

## Pull requests

- Explain the user problem and the resulting behavior.
- Link an issue when one exists.
- Include verification commands and screenshots for visible changes.
- Keep domain rules in `src/lib/revenue-os/`, not route handlers or components.
- Preserve tenant isolation, idempotency, audit receipts, and fail-closed behavior.
- Add ordered, additive, idempotent migrations; never mutate schema from a request path.
- Do not combine unrelated cleanup with a functional change.

Maintainers may ask for a smaller change, additional threat-boundary tests, or a migration rollback note before merging.

## Commit and review expectations

Use clear imperative commit subjects such as `fix(admin): preserve tenant context`. By contributing, you agree that your contribution is licensed under the repository's MIT License.
