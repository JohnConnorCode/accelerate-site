# Contributing

Thanks for helping improve Accelerate Revenue OS.

## Before opening a change

1. Search existing issues and keep the proposed scope narrow.
2. Read `AGENTS.md` and the contract relevant to your change.
3. For security-sensitive behavior, open a private report instead of a public issue.
4. Never use real customer data, production credentials, or production mutations for development or screenshots.

## Local workflow

```bash
npm ci
npm run verify:agent-contract
npm run typecheck
npm run lint
npm run format:check
npm run test:core
npm run build
```

Run the closest service or Playwright journey for the behavior you changed. Visual work requires desktop and mobile screenshots, keyboard coverage, console-error checks, and reduced-motion coverage when motion is involved.

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
