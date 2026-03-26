# Engineering Style Guide

## Code Organization

- Keep route handlers in `studio/src/app/api/**`.
- Keep domain logic in `studio/src/lib/**`.
- Keep UI components in `studio/src/components/**`.
- Keep tests in `studio/test/**`.
- Keep docs in `studio/docs/**`.

## Naming Conventions

- Use `camelCase` for functions and variables.
- Use `PascalCase` for React components and TypeScript types/interfaces.
- Use descriptive names that reflect domain meaning (`founderApplication`, `roleAssignment`, `subscriptionStatus`).
- Keep API route segment names consistent with resource nouns.

## React and Next.js Patterns

- Use server route handlers for API contracts and auth checks.
- Use client components only when browser state/effects are required.
- Keep page components thin; move reusable logic into `lib` helpers.
- Avoid mixing transport validation and business logic when extraction improves readability.

## API Design Conventions

- Return consistent JSON envelopes (`success`, `data`, `message`) where already established.
- Use explicit status codes:
  - `200` success
  - `201` created
  - `400` bad request
  - `401` unauthorized
  - `403` forbidden
  - `404` not found
  - `409` conflict
  - `500` internal error
- For list endpoints, standardize pagination with `limit` and `offset`.
- Keep error messages actionable and specific to the failed contract.

## Database Naming and Constraints

- Use snake_case for table and column names.
- Keep foreign keys explicit and consistently named.
- Use unique constraints for dedup/idempotency requirements.
- Use check constraints for enum-like states where appropriate.
- Follow constraint naming conventions that indicate type and target.

## Comments Policy

- Comments should explain non-obvious intent or tradeoffs.
- Do not add comments that restate obvious code.
- Prefer small focused functions over heavy inline commentary.
- Update comments when behavior changes.
