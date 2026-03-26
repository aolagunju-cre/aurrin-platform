# Judge Guide

This guide describes what judges can do today and what is still planned.

## How-to: Get judge access

1. Ask an admin to assign your account the `judge` role.
2. Scope is usually `event` for a specific event, or `global` for cross-event judge operations.
3. Sign in and use your authenticated session for protected judge/admin APIs.

## How-to: Work with scoring rubrics (current)

1. Judges currently consume rubric-driven scoring structures managed by admins.
2. Rubrics are versioned so scoring can reference stable definitions.
3. If rubric criteria look wrong, report the rubric template/version to an admin for correction.

## How-to: Track scoring outcomes (current)

1. Judges can coordinate with admins for scoring timelines and completion checks.
2. Analytics surfaces score distributions and trends in admin analytics views.

## Planned / partial areas

- Dedicated `/judge` scoring UI is protected by middleware path rules but is not yet shipped as a complete page flow in this repository snapshot.
- Judge assignment and per-pitch scoring workflow UX is planned for a later issue lane.

## FAQ

### Can judges edit rubrics directly?
No. Rubric creation/versioning is currently an admin capability.

### Why is there no full judge dashboard yet?
Judge-specific UX is planned; current implementation focuses on admin rubric management and shared analytics contracts.

### How do I know which event I can score?
Access is controlled by role assignments and scope (`event` or `global`) managed by admins.
