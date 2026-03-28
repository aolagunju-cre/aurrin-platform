import { getRuntimeEnv } from '../config/env';

let joseLib: {
  jwtVerify: typeof import('jose').jwtVerify;
  SignJWT: typeof import('jose').SignJWT;
} | null = null;

async function getJoseLib() {
  if (joseLib) {
    return joseLib;
  }

  try {
    const { jwtVerify, SignJWT } = await import('jose');
    joseLib = { jwtVerify, SignJWT };
    return joseLib;
  } catch (error) {
    console.error('Failed to load jose library:', error);
    return null;
  }
}

function getSecret(): Uint8Array | Buffer {
  const secretString = getRuntimeEnv().supabaseJwtSecret;
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(secretString, 'utf-8');
  }

  return new TextEncoder().encode(secretString);
}

function hasConfiguredJwtSecret(): boolean {
  return getRuntimeEnv().supabaseJwtSecret !== 'your-secret-key';
}

export interface JWTPayload {
  sub: string;
  email: string;
  email_confirmed_at?: string;
  phone_confirmed_at?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  iat: number;
  exp: number;
  aud: string | string[];
  iss: string;
}

function isVerifiedJWTPayload(payload: unknown): payload is JWTPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  const audience = candidate.aud;

  return (
    typeof candidate.sub === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.iat === 'number' &&
    typeof candidate.exp === 'number' &&
    typeof candidate.iss === 'string' &&
    (typeof audience === 'string' || (Array.isArray(audience) && audience.every((entry) => typeof entry === 'string')))
  );
}

function decodeJwtPayload(token: string): Partial<JWTPayload> | null {
  try {
    const [, payloadSegment] = token.split('.');
    if (!payloadSegment) {
      return null;
    }

    const normalized = payloadSegment.replace(/-/gu, '+').replace(/_/gu, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const decoded = typeof Buffer !== 'undefined'
      ? Buffer.from(padded, 'base64').toString('utf-8')
      : atob(padded);
    const payload = JSON.parse(decoded) as Partial<JWTPayload>;
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

interface SupabaseUserResponse {
  id?: string;
  email?: string;
  email_confirmed_at?: string;
  phone_confirmed_at?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

async function verifySupabaseAccessToken(token: string): Promise<JWTPayload | null> {
  const runtimeEnv = getRuntimeEnv();
  if (!runtimeEnv.supabaseUrl || !runtimeEnv.supabaseAnonKey) {
    return null;
  }

  try {
    const response = await fetch(`${runtimeEnv.supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: runtimeEnv.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const user = await response.json() as SupabaseUserResponse;
    if (!user.id || !user.email) {
      return null;
    }

    const decoded = decodeJwtPayload(token);
    const audience = decoded?.aud;

    return {
      sub: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      phone_confirmed_at: user.phone_confirmed_at,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
      iat: typeof decoded?.iat === 'number' ? decoded.iat : Math.floor(Date.now() / 1000),
      exp: typeof decoded?.exp === 'number' ? decoded.exp : Math.floor(Date.now() / 1000),
      aud: typeof audience === 'string' || (Array.isArray(audience) && audience.every((entry) => typeof entry === 'string'))
        ? audience
        : 'authenticated',
      iss: typeof decoded?.iss === 'string' ? decoded.iss : `${runtimeEnv.supabaseUrl}/auth/v1`,
    };
  } catch (error) {
    console.error('Supabase token introspection failed:', error);
    return null;
  }
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  let verificationError: unknown = null;

  try {
    if (hasConfiguredJwtSecret()) {
      const jose = await getJoseLib();
      if (!jose) {
        return null;
      }
      const verified = await jose.jwtVerify(token, getSecret());
      return isVerifiedJWTPayload(verified.payload) ? verified.payload : null;
    }
  } catch (error) {
    verificationError = error;
  }

  const introspectedPayload = await verifySupabaseAccessToken(token);
  if (introspectedPayload) {
    return introspectedPayload;
  }

  if (verificationError) {
    console.error('JWT verification failed:', verificationError);
  }

  return null;
}

interface AppJWTOptions {
  audience: string;
  expiresInSeconds: number;
  issuer: string;
}

interface AppJWTVerificationOptions {
  audience: string;
  issuer: string;
}

export async function signJWT(payload: Record<string, unknown>, options: AppJWTOptions): Promise<string> {
  const jose = await getJoseLib();
  if (!jose) {
    throw new Error('Could not load jose library');
  }

  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(options.issuer)
    .setAudience(options.audience)
    .setExpirationTime(`${options.expiresInSeconds}s`)
    .sign(getSecret());
}

export async function verifyAppJWT<T>(
  token: string,
  options: AppJWTVerificationOptions
): Promise<T | null> {
  try {
    const jose = await getJoseLib();
    if (!jose) {
      return null;
    }

    const verified = await jose.jwtVerify(token, getSecret(), {
      issuer: options.issuer,
      audience: options.audience,
    });

    return verified.payload as unknown as T;
  } catch (error) {
    console.error('App JWT verification failed:', error);
    return null;
  }
}

export function extractTokenFromHeader(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

export function isTokenExpired(payload: JWTPayload): boolean {
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}
