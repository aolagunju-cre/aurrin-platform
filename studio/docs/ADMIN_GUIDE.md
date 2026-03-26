# Admin Guide

This guide documents the current admin contract for event operations, rubrics, founder workflows, and role management.

## How to create/manage events

1. Open `/admin/events`.
2. Select **Create Event**.
3. Enter required fields: `name`, `start_date`, and `end_date`.
4. Optionally set `description`, `max_judges`, `max_founders`, `rubric_id`, and event `config`.
5. Save and verify the event appears in the table with status `Upcoming`, `Live`, or `Archived`.
6. Open an event detail page and use **Save** to update fields.
7. Use archive/delete action only for soft delete behavior (`status=archived`), not hard deletion.
8. Use **Assign Judges** and **Assign Founders** to manage event participants.

## How to build rubrics

1. Open `/admin/rubrics`.
2. Select **Create Rubric** to create a template.
3. Enter rubric metadata and definition details.
4. Add/edit categories and questions in the builder.
5. Ensure category weights satisfy validation rules before saving.
6. Save to create a new immutable rubric version.
7. Use clone when you need a new template based on an existing rubric.

## How to approve founders and assign to events

1. Review applications in the admin founder workflow.
2. Use the approval route flow to change status (`PATCH /api/protected/admin/founder-applications/:applicationId`).
3. Follow allowed transitions:
   - `pending -> accepted`
   - `pending -> declined`
   - `accepted -> assigned`
   - `accepted -> declined`
   - `assigned -> declined`
4. Include `assigned_event_id` when moving to `assigned`.
5. On `accepted`, verify founder identity provisioning and confirmation email enqueue succeeded.
6. Confirm assignment data appears on the event/admin side for operational tracking.

## How to manage roles and permissions

1. Open `/admin/roles`.
2. Select **Assign Role**.
3. Choose role: `admin`, `judge`, `founder`, `mentor`, or `subscriber`.
4. Choose scope: `global`, `event`, `founder`, or `subscriber`.
5. Provide `scoped_id` for non-global scope.
6. Submit and verify the assignment appears in the table.
7. Use **Revoke Role** when access should be removed.
8. Confirm role-sensitive admin endpoints return `401` for unauthenticated calls and `403` for non-admin calls.

## Contract Assumptions And Remediation Notes

- Founder approval remains on `/api/protected/admin/founder-applications/:applicationId` in the current build.
- Remediation path: complete migration to equivalent `/api/admin/founders/*` approval/assignment control plane endpoints and then update this guide to reference only `/api/admin/*` routes.

## FAQ

### Why do I get `403 Forbidden` on admin APIs?

Your user is authenticated but does not have an `admin` role assignment with `global` scope.

### Why does rubric save fail with validation errors?

Rubric definitions must be structurally valid, including category weights and question definitions.

### Why can’t I move an application directly to `assigned` from `pending`?

The transition contract enforces sequenced transitions. Use `accepted` first.

### Are all analytics metrics real-time?

Metrics are near-real-time and may include cache windows. Use exports for point-in-time snapshots.
