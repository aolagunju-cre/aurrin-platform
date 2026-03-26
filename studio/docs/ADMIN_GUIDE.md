# Admin Guide

This guide covers current admin capabilities in the platform and calls out planned areas.

## How-to: Access the admin area

1. Sign in with an account that has the `admin` role with `global` scope.
2. Open `/admin`.
3. If your token is missing or invalid, admin APIs return `401`.
4. If your account is authenticated but not admin, admin APIs return `403`.

## How-to: Manage scoring rubrics

1. Open `/admin/rubrics`.
2. Select **Create Rubric** to create a template.
3. Provide name, optional description, and initial definition.
4. Open a rubric builder from the table.
5. Edit categories, question text, scales, and weights.
6. Save changes to create a new immutable rubric version.
7. Use clone to duplicate a rubric into a new template.

## How-to: Manage role assignments

1. Open `/admin/roles`.
2. Select **Assign Role**.
3. Choose one role: `admin`, `judge`, `founder`, `mentor`, or `subscriber`.
4. Choose scope: `global`, `event`, `founder`, or `subscriber`.
5. Provide `scoped_id` when scope is not `global`.
6. Submit and verify the assignment appears in the table.
7. Use **Revoke Role** to remove an assignment.

## How-to: Review founder applications

1. Open founder intake records in your admin workflow.
2. Approve or reject through the protected route flow (`PATCH /api/protected/admin/founder-applications/:applicationId`).
3. Allowed status transitions are:
   - `pending -> accepted`
   - `pending -> declined`
   - `accepted -> assigned`
   - `accepted -> declined`
   - `assigned -> declined`
4. For `assigned`, include `assigned_event_id`.
5. On `accepted`, the platform provisions founder identity data and queues approval email delivery.

## How-to: Use analytics and exports

1. Open `/admin/analytics`.
2. Select a date range (preset or custom).
3. Review KPI, validation, mentoring, revenue, and cohort views.
4. Export CSV or JSON from the dashboard export action.

## Planned / partial areas

- Some event-operations actions (for example score lock and publishing controls) are documented at runbook level but not fully exposed through dedicated admin UI screens yet.

## FAQ

### Why do I get `403 Forbidden` on admin APIs?
Your user is authenticated but does not have `admin` role assignment with `global` scope.

### Why does rubric save fail with validation errors?
Rubric definitions must be structurally valid, including category weights and question definitions.

### Why can’t I move an application directly to `assigned` from `pending`?
The transition contract enforces sequenced transitions. Use `accepted` first.

### Are all analytics metrics real-time?
Metrics are near-real-time and may include cache windows. Use exports for point-in-time snapshots.
