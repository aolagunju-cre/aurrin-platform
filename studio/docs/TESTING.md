# Testing Guide

This guide defines the standard testing workflow for the `studio/` application.

## Run Tests Locally

From the repository root:

```bash
npm --prefix studio ci
npm --prefix studio test -- --runInBand
npm --prefix studio test -- --coverage
```

Coverage output is written to `studio/coverage/` with CI-friendly artifacts (`lcov`, `cobertura`, and JSON summary).

## Writing Tests

- Unit tests: place focused logic tests in `studio/test/*.test.ts` (for example scoring, matching, entitlements, auth/session helpers).
- Integration tests: test route handlers and service boundaries with mocked external systems.
- E2E contract tests: validate critical multi-step journeys across module boundaries (for example application to approval to scoring flows).

Keep tests deterministic, avoid network calls, and mock external providers.

## Fixtures and Mocks

Reusable test data and helpers:

- Fixtures: `studio/src/lib/test/fixtures/`
- Test setup helpers: `studio/src/lib/test/database.ts`
- Mocks/stubs: `studio/src/lib/test/mocks/`

Use these shared fixtures/mocks instead of ad-hoc test data so scenarios stay consistent across suites.

## Coverage Expectations

Jest enforces minimum statement coverage thresholds:

- Public API routes (`src/app/api/public/**/*.ts`): `>= 80%`
- Internal utilities (`src/lib/**/*.ts`, excluding `src/lib/db/client.ts` and `src/lib/test/**`): `>= 60%`

Any coverage drop below threshold fails the test command and therefore fails PR validation.

## PR Checks and Merge Gate

PR test status is shown in GitHub pull request checks under:

- `Node CI` (runs `bash scripts/validate-implementation.sh`)
- `Pipeline Scripts CI`

All required checks must pass before merge.

## Debugging Tests

- Run one suite:

```bash
npm --prefix studio test -- --runTestsByPath test/public-validate-routes.test.ts
```

- Run one test name pattern:

```bash
npm --prefix studio test -- --runInBand -t "duplicate founder submission"
```

- Regenerate coverage after changes:

```bash
npm --prefix studio test -- --coverage --runInBand
```
