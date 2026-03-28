import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { JWTPayload } from './jwt';
import { signJWT, verifyAppJWT, verifyJWT } from './jwt';
import { getRuntimeEnv, getSupabaseConfigStatus, isDemoModeEnabled } from '../config/env';
import { demoFounderProfile } from '../demo/data';
import type { RoleAssignmentRecord } from '../db/client';

export const ACCESS_TOKEN_COOKIE = 'aurrin_access_token';
export const DEMO_SESSION_COOKIE = 'aurrin_demo_session';

const AUTH_COOKIE_PATH = '/';
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEMO_SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const DEMO_SESSION_AUDIENCE = 'aurrin-demo-session';
const DEMO_SESSION_ISSUER = 'aurrin-platform';

export type NormalizedRole = 'admin' | 'judge' | 'founder' | 'mentor' | 'subscriber' | 'audience';
export type PortalRole = Exclude<NormalizedRole, 'audience'>;
export type DemoPersona = NormalizedRole;
export type SignUpRole = 'founder' | 'judge' | 'mentor' | 'subscriber';

const PORTAL_ROLE_PRECEDENCE: PortalRole[] = ['admin', 'judge', 'founder', 'mentor', 'subscriber'];
const PORTAL_PATH_BY_ROLE: Record<PortalRole, string> = {
  admin: '/admin',
  judge: '/judge/events',
  founder: '/founder',
  mentor: '/mentor',
  subscriber: '/subscriber',
};

interface CookieRecord {
  value: string;
}

export interface HeaderStoreLike {
  get(name: string): string | null | undefined;
}

export interface CookieStoreLike {
  get(name: string): CookieRecord | string | undefined;
}

export interface DemoPersonaDefinition {
  id: string;
  persona: DemoPersona;
  label: string;
  email: string;
  name: string;
  description: string;
  roles: NormalizedRole[];
}

export interface DemoSessionClaims {
  sub: string;
  email: string;
  name: string;
  persona: DemoPersona;
  roles: NormalizedRole[];
  iat?: number;
  exp?: number;
  aud?: string | string[];
  iss?: string;
}

export interface ResolvedAuthIdentity {
  kind: 'access-token' | 'demo-session';
  userId: string;
  email: string;
  jwt: JWTPayload | null;
  accessToken: string | null;
  demoSession: DemoSessionClaims | null;
}

const DEMO_PERSONAS: DemoPersonaDefinition[] = [
  {
    id: 'persona-admin',
    persona: 'admin',
    label: 'Admin',
    email: 'admin@aurrin.demo',
    name: 'Aurrin Admin',
    description: 'Manage events, rubrics, founders, sponsors, and analytics.',
    roles: ['admin'],
  },
  {
    id: 'persona-judge',
    persona: 'judge',
    label: 'Judge',
    email: 'judge@aurrin.demo',
    name: 'Jordan Judge',
    description: 'Review assigned events and submit rubric scores.',
    roles: ['judge'],
  },
  {
    id: 'persona-founder',
    persona: 'founder',
    label: 'Founder',
    email: demoFounderProfile.email,
    name: demoFounderProfile.name,
    description: 'View founder reports, scores, validation, and mentor matches.',
    roles: ['founder'],
  },
  {
    id: 'persona-mentor',
    persona: 'mentor',
    label: 'Mentor',
    email: 'mentor@aurrin.demo',
    name: 'Morgan Mentor',
    description: 'Review pending mentor matches and accepted introductions.',
    roles: ['mentor'],
  },
  {
    id: 'persona-subscriber',
    persona: 'subscriber',
    label: 'Subscriber',
    email: 'subscriber@aurrin.demo',
    name: 'Sky Subscriber',
    description: 'Access subscription status, billing, and premium downloads.',
    roles: ['subscriber'],
  },
  {
    id: 'persona-audience',
    persona: 'audience',
    label: 'Audience',
    email: 'audience@aurrin.demo',
    name: 'Avery Audience',
    description: 'Preview the QR validation experience and feedback flow.',
    roles: ['audience'],
  },
];

export const SIGN_UP_ROLE_OPTIONS: ReadonlyArray<{ value: SignUpRole; label: 'Founder' | 'Judge' | 'Mentor' | 'Subscriber' }> = [
  { value: 'founder', label: 'Founder' },
  { value: 'judge', label: 'Judge' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'subscriber', label: 'Subscriber' },
];

function normalizeCookieValue(value: CookieRecord | string | undefined): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  return value.value;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    path: AUTH_COOKIE_PATH,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge,
  };
}

function getDemoPersonaDefinition(persona: string): DemoPersonaDefinition | null {
  return DEMO_PERSONAS.find((entry) => entry.persona === persona) ?? null;
}

export function getDemoPersonaCatalog(): DemoPersonaDefinition[] {
  return DEMO_PERSONAS;
}

export function isDemoPersona(value: string): value is DemoPersona {
  return getDemoPersonaDefinition(value) !== null;
}

export function normalizeRole(role: string): NormalizedRole | null {
  const normalized = role.trim().toLowerCase();
  switch (normalized) {
    case 'admin':
    case 'judge':
    case 'founder':
    case 'mentor':
    case 'subscriber':
    case 'audience':
      return normalized;
    default:
      return null;
  }
}

export function normalizeSignUpRole(role: string): SignUpRole | null {
  const normalized = normalizeRole(role);
  if (!normalized || normalized === 'admin' || normalized === 'audience') {
    return null;
  }

  return normalized;
}

export function resolvePrimaryPortalRole(roles: string[]): PortalRole | null {
  const normalizedRoles = new Set(
    roles
      .map((role) => normalizeRole(role))
      .filter((role): role is PortalRole => Boolean(role && role !== 'audience'))
  );

  for (const role of PORTAL_ROLE_PRECEDENCE) {
    if (normalizedRoles.has(role)) {
      return role;
    }
  }

  return null;
}

export function resolvePrimaryPortalPath(roles: string[]): string | null {
  const role = resolvePrimaryPortalRole(roles);
  if (!role) {
    return null;
  }

  return PORTAL_PATH_BY_ROLE[role];
}

export function resolvePrimaryPortalPathFromAssignments(assignments: Array<Pick<RoleAssignmentRecord, 'role'>>): string | null {
  return resolvePrimaryPortalPath(assignments.map((assignment) => assignment.role));
}

export function hasNormalizedRole(roles: string[], requiredRole: NormalizedRole): boolean {
  const normalizedRoles = roles
    .map((role) => normalizeRole(role))
    .filter((role): role is NormalizedRole => Boolean(role));

  return normalizedRoles.includes('admin') || normalizedRoles.includes(requiredRole);
}

export function createDemoRoleAssignments(identity: ResolvedAuthIdentity): RoleAssignmentRecord[] {
  if (!identity.demoSession) {
    return [];
  }

  const timestamp = new Date().toISOString();
  return identity.demoSession.roles.map((role, index) => ({
    id: `demo-role-${role}-${index + 1}`,
    user_id: identity.userId,
    role,
    scope: 'global',
    scoped_id: null,
    created_at: timestamp,
    updated_at: timestamp,
    created_by: identity.userId,
  }));
}

export async function getRoleAssignmentsForUser(userId: string): Promise<RoleAssignmentRecord[] | null> {
  const runtimeEnv = getRuntimeEnv();
  if (!runtimeEnv.supabaseUrl || !runtimeEnv.supabaseServiceRoleKey) {
    return null;
  }

  const response = await fetch(
    `${runtimeEnv.supabaseUrl}/rest/v1/role_assignments?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=100`,
    {
      method: 'GET',
      headers: {
        apikey: runtimeEnv.supabaseServiceRoleKey,
        Authorization: `Bearer ${runtimeEnv.supabaseServiceRoleKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<RoleAssignmentRecord[]>;
}

async function hasActiveSupabaseSession(accessToken: string): Promise<boolean> {
  const runtimeEnv = getRuntimeEnv();
  if (!runtimeEnv.supabaseUrl || !runtimeEnv.supabaseAnonKey) {
    return false;
  }

  const response = await fetch(`${runtimeEnv.supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: runtimeEnv.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  return response.ok;
}

export function toAuthPayload(identity: ResolvedAuthIdentity): JWTPayload {
  if (identity.jwt) {
    return identity.jwt;
  }

  const now = Math.floor(Date.now() / 1000);
  return {
    sub: identity.userId,
    email: identity.email,
    iat: now,
    exp: now + DEMO_SESSION_TTL_SECONDS,
    aud: DEMO_SESSION_AUDIENCE,
    iss: DEMO_SESSION_ISSUER,
    user_metadata: identity.demoSession ? { persona: identity.demoSession.persona } : undefined,
  };
}

export function sanitizeNextPath(nextPath: string | null | undefined): string {
  if (!nextPath) {
    return '/';
  }

  if (!nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return '/';
  }

  return nextPath;
}

export async function createDemoSessionToken(persona: DemoPersona): Promise<string> {
  if (!isDemoModeEnabled()) {
    throw new Error('Demo mode is not enabled.');
  }

  const personaDefinition = getDemoPersonaDefinition(persona);
  if (!personaDefinition) {
    throw new Error(`Unknown demo persona: ${persona}`);
  }

  return signJWT(
    {
      sub: personaDefinition.email === demoFounderProfile.email ? demoFounderProfile.id : personaDefinition.id,
      email: personaDefinition.email,
      name: personaDefinition.name,
      persona: personaDefinition.persona,
      roles: personaDefinition.roles,
    },
    {
      audience: DEMO_SESSION_AUDIENCE,
      expiresInSeconds: DEMO_SESSION_TTL_SECONDS,
      issuer: DEMO_SESSION_ISSUER,
    }
  );
}

export async function createDemoRegistrationSessionToken(input: {
  role: SignUpRole;
  email: string;
  name?: string | null;
}): Promise<string> {
  if (!isDemoModeEnabled()) {
    throw new Error('Demo mode is not enabled.');
  }

  const normalizedRole = normalizeSignUpRole(input.role);
  if (!normalizedRole) {
    throw new Error('Invalid sign-up role.');
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Email is required.');
  }

  const normalizedName = input.name?.trim() || `${normalizedRole[0].toUpperCase()}${normalizedRole.slice(1)} User`;
  const syntheticUserId = `demo-signup-${normalizedRole}-${normalizedEmail.replace(/[^a-z0-9]+/giu, '-').replace(/^-+|-+$/gu, '') || 'user'}`;

  return signJWT(
    {
      sub: syntheticUserId,
      email: normalizedEmail,
      name: normalizedName,
      persona: normalizedRole,
      roles: [normalizedRole],
    },
    {
      audience: DEMO_SESSION_AUDIENCE,
      expiresInSeconds: DEMO_SESSION_TTL_SECONDS,
      issuer: DEMO_SESSION_ISSUER,
    }
  );
}

export async function verifyDemoSessionToken(token: string): Promise<DemoSessionClaims | null> {
  return verifyAppJWT<DemoSessionClaims>(token, {
    audience: DEMO_SESSION_AUDIENCE,
    issuer: DEMO_SESSION_ISSUER,
  });
}

export async function resolveAuthIdentityFromStores(
  headerStore: HeaderStoreLike,
  cookieStore: CookieStoreLike
): Promise<ResolvedAuthIdentity | null> {
  const demoToken = normalizeCookieValue(cookieStore.get(DEMO_SESSION_COOKIE));
  if (demoToken) {
    const demoSession = await verifyDemoSessionToken(demoToken);
    if (demoSession?.sub && demoSession.email) {
      return {
        kind: 'demo-session',
        userId: demoSession.sub,
        email: demoSession.email,
        jwt: null,
        accessToken: null,
        demoSession,
      };
    }
  }

  const accessToken = extractAccessToken(headerStore, cookieStore);
  if (!accessToken) {
    return null;
  }

  const payload = await verifyJWT(accessToken);
  if (!payload?.sub || !payload.email) {
    return null;
  }

  const supabaseConfigStatus = getSupabaseConfigStatus();
  if (!isDemoModeEnabled() && supabaseConfigStatus.configured) {
    const hasActiveSession = await hasActiveSupabaseSession(accessToken);
    if (!hasActiveSession) {
      return null;
    }
  }

  return {
    kind: 'access-token',
    userId: payload.sub,
    email: payload.email,
    jwt: payload,
    accessToken,
    demoSession: null,
  };
}

export async function resolveAuthIdentityFromRequest(request: NextRequest): Promise<ResolvedAuthIdentity | null> {
  return resolveAuthIdentityFromStores(request.headers, request.cookies);
}

export function extractAccessToken(headerStore: HeaderStoreLike, cookieStore?: CookieStoreLike): string | null {
  const authHeader = headerStore.get('authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer' && parts[1]) {
      return parts[1];
    }

    return null;
  }

  if (!cookieStore) {
    return null;
  }

  return normalizeCookieValue(cookieStore.get(ACCESS_TOKEN_COOKIE));
}

export function setAccessTokenCookie(response: NextResponse, accessToken: string): void {
  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE,
    value: accessToken,
    ...cookieOptions(ACCESS_TOKEN_TTL_SECONDS),
  });
  response.cookies.delete(DEMO_SESSION_COOKIE);
}

export function setDemoSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: DEMO_SESSION_COOKIE,
    value: token,
    ...cookieOptions(DEMO_SESSION_TTL_SECONDS),
  });
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE,
    value: '',
    ...cookieOptions(0),
  });
  response.cookies.set({
    name: DEMO_SESSION_COOKIE,
    value: '',
    ...cookieOptions(0),
  });
}

export function buildSignInUrl(request: NextRequest, reason?: 'forbidden' | 'unauthorized'): URL {
  const url = new URL('/auth/sign-in', request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.searchParams.set('next', sanitizeNextPath(nextPath));
  if (reason) {
    url.searchParams.set('error', reason);
  }
  return url;
}
