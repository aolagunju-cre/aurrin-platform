# Mentor Matching Guide

This guide documents current mentor-matching behavior and planned expansion.

## How-to: Prepare for mentor matching

1. Ensure mentor and founder roles are assigned correctly by an admin.
2. Confirm the target event and founder records exist.
3. Use standard operations monitoring to verify background jobs are processing.

## How-to: Understand current matching implementation

1. Mentor matching is represented as a background job type: `mentor_match`.
2. Current handler validates required payload fields (`event_id`, `founder_id`).
3. Advanced matching logic and notifications are planned and stubbed for follow-up implementation.

## Planned / partial areas

- Automated matching algorithm and full mentor workflow UI are not yet complete.
- Current behavior is intentionally minimal to preserve job-contract integrity while future work lands.

## FAQ

### Is automatic mentor assignment live?
Not fully. The current handler is a contract-preserving stub.

### What breaks if a mentor job payload is missing fields?
The job handler returns a structured failure describing required fields.

### Where will full matching rules live?
In the mentor matching engine implementation path referenced by the mentor issue lane.
