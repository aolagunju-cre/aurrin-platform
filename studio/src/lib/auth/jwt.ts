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

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const jose = await getJoseLib();
    if (!jose) {
      return null;
    }
    const verified = await jose.jwtVerify(token, getSecret());
    return isVerifiedJWTPayload(verified.payload) ? verified.payload : null;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
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
