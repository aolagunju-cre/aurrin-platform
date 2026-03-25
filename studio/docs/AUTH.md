# Authentication & Role-Based Access Control (RBAC)

This guide explains how authentication and authorization work in the Aurrin Ventures platform.

## Overview

The platform uses **Supabase Auth** for user identity and **database-backed RBAC** with PostgreSQL Row-Level Security (RLS) for authorization.

### Key Components

- **Supabase Auth**: Handles user registration, login, password reset, and JWT token generation
- **JWT Tokens**: Stateless authentication tokens issued by Supabase Auth
- **Role Assignments**: Database table storing which roles each user has and their scope
- **RLS Policies**: Database-level access control enforced by PostgreSQL
- **Session Context**: Application utilities to check user permissions

## User Roles

The platform supports six concurrent roles:

| Role | Description | Typical Scopes |
|------|-------------|---|
| **Admin** | Full platform access | global |
| **Judge** | Evaluates founder applications | event, global |
| **Founder** | Submits applications, views scores | global, event |
| **Mentor** | Matches with founders, provides guidance | global, founder |
| **Subscriber** | Accesses premium content | global, subscriber |
| **Audience** | Participates in validation sessions | session |

## Role Scopes

Roles can be assigned with different scopes:

- **global**: User has the role across all resources
- **event**: User has the role for a specific event (e.g., Judge for Event A)
- **founder**: User has the role relative to a specific founder (e.g., Mentor for Founder X)
- **subscriber**: User has the role for a specific subscription tier

## Setting Up Supabase Auth

### 1. Create Supabase Project

1. Visit [supabase.com](https://supabase.com)
2. Create a new project
3. Note the project URL and anon key
4. Enable email authentication in Authentication → Providers

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_AUTH_REDIRECT_URL=http://localhost:3000/auth/callback
```

### 3. Link Users Table to Auth

The `users` table is automatically linked to Supabase Auth:

```sql
ALTER TABLE users
ADD CONSTRAINT fk_users_auth
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

## Assigning Roles

### Via Supabase Dashboard

Non-technical operators can assign roles:

1. Go to Supabase → SQL Editor
2. Insert role assignments:

```sql
INSERT INTO role_assignments (user_id, role, scope, scoped_id, created_by)
VALUES (
  'user-uuid-here',
  'Judge',
  'event',
  'event-uuid-here',
  auth.uid()
);
```

### Via API

Route handlers can insert role assignments (Admin only):

```typescript
export async function POST(request: Request) {
  const { userId, role, scope, scopedId } = await request.json();

  // Check if current user is Admin
  if (!await hasRole('Admin')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  // Insert role assignment
  const { error } = await supabase
    .from('role_assignments')
    .insert({
      user_id: userId,
      role,
      scope,
      scoped_id: scopedId,
      created_by: currentUserId,
    });

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
```

## Using Session Context in Route Handlers

### Get Current User

```typescript
import { getCurrentUser } from '@/lib/auth/session';

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  return new Response(JSON.stringify(user), { status: 200 });
}
```

### Check Permissions

```typescript
import { getCurrentUser, hasRole } from '@/lib/auth/session';

export async function GET(request: Request) {
  const user = await getCurrentUser();

  // Check if user is a Judge
  if (!hasRole(user?.roleAssignments, 'Judge')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  // Check if user is a Judge for a specific event
  const eventId = 'event-uuid';
  if (!hasRole(user?.roleAssignments, 'Judge', { type: 'event', id: eventId })) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  return new Response(JSON.stringify({ data: 'secret' }), { status: 200 });
}
```

### Get Effective Roles

```typescript
import { getCurrentUser, getEffectiveRoles } from '@/lib/auth/session';

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const roles = getEffectiveRoles(user.roleAssignments);
  return new Response(JSON.stringify({ roles }), { status: 200 });
}
```

## RLS Policies

All sensitive tables have Row-Level Security (RLS) policies:

### Example: Judge Scores

- **Judges** see only their own scores
- **Founders** see scores after publishing
- **Admins** see all scores
- **Others** see nothing

```sql
-- Judge sees own scores
CREATE POLICY "judge_scores_select_own" ON judge_scores
  FOR SELECT USING (judge_id = auth.uid());

-- Founder sees scores after publish
CREATE POLICY "judge_scores_select_founder_published" ON judge_scores
  FOR SELECT USING (
    founder_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM events
      WHERE id = judge_scores.event_id
      AND scoring_published_at IS NOT NULL
    )
  );
```

## JWT Token Structure

Supabase Auth issues JWT tokens with this structure:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "email_confirmed_at": "2024-01-01T00:00:00Z",
  "iat": 1234567890,
  "exp": 1234654290,
  "aud": "authenticated",
  "iss": "https://project.supabase.co/auth/v1"
}
```

The middleware verifies this token and injects the user ID into request headers.

## Middleware Flow

1. Request arrives with `Authorization: Bearer <jwt-token>`
2. Middleware extracts and verifies the JWT
3. If invalid or expired → return 401 Unauthorized
4. If valid → inject `x-user-id` and `x-user-email` headers
5. Route handler receives request with user context

## Protecting Routes

### Protected Routes (Require Authentication)

```
/admin/*              - Admin functions
/judge/*              - Judge scoring interface
/founder/*            - Founder application portal
/mentor/*             - Mentor matching dashboard
/subscriber/*         - Subscriber content
/api/protected/*      - Protected API endpoints
```

### Public Routes (No Authentication)

```
/public/*             - Public directory, validation sessions
/api/public/*         - Public API endpoints
```

## Auditing Role Changes

All role assignments changes are automatically logged to `audit_logs` table:

- **actor**: User who made the change
- **action**: 'role_assigned', 'role_revoked'
- **resource_type**: 'role_assignments'
- **resource_id**: Role assignment ID
- **changes**: Details of what changed
- **timestamp**: When the change occurred

## Testing Authentication

### Test User Authentication

```bash
curl -X POST https://project.supabase.co/auth/v1/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Test Token Verification

```bash
curl -X GET http://localhost:3000/api/protected/user \
  -H "Authorization: Bearer <jwt-token>"
```

## Troubleshooting

### "Unauthorized" on Protected Routes

- Check JWT token is in `Authorization: Bearer <token>` header
- Verify token hasn't expired
- Check `SUPABASE_JWT_SECRET` is correct

### RLS Policy Blocks Access

- Verify role assignments exist in database
- Check scope and scoped_id match the resource
- Review RLS policy in `003_rls_policies.sql`

### Admin Cannot See Data

- Ensure Admin role is assigned with `scope = 'global'`
- Admin role bypasses RLS policies

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [JWT.io](https://jwt.io/)
- [ADR-002: Supabase Auth for Identity](../docs/ARCHITECTURE.md)
