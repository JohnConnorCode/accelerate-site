# Contributing

Thanks for helping improve Accelerate Revenue OS.

## Before opening a change

1. Start with [the developer handoff](docs/contributing/DEVELOPER-START.md). The live Feature Board owns current scope, readiness and claims. Public roadmap entries and Git templates are orientation; confirm the live ticket before starting assigned work.
2. Keep the proposed scope narrow.
3. Read `AGENTS.md` and the contract relevant to your change.
4. For security-sensitive behavior, open a private report instead of a public issue.
5. Never use real customer data, production credentials, or production mutations for development or screenshots.

## Local workflow

Start the fictional demo without credentials using `npm ci`, `npm run dev:doctor` and `npm run dev`. Assigned work additionally needs the maintainer-provided board endpoint, scoped token and approved test environment described in [the developer handoff](docs/contributing/DEVELOPER-START.md).

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
