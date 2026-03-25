// JWT verification using jose library
// jose is an ES module, imported dynamically to avoid transpilation issues

let jwtVerifyFn: any = null;

async function getJwtVerify() {
  if (jwtVerifyFn) return jwtVerifyFn;
  try {
    const { jwtVerify: verify } = await import('jose');
    jwtVerifyFn = verify;
    return verify;
  } catch (error) {
    console.error('Failed to load jose library:', error);
    return null;
  }
}

let secret: Uint8Array | Buffer;

function initSecret() {
  const secretString = process.env.SUPABASE_JWT_SECRET || 'your-secret-key';
  // Use Buffer in Node.js, TextEncoder in browser
  if (typeof Buffer !== 'undefined') {
    secret = Buffer.from(secretString, 'utf-8');
  } else {
    secret = new TextEncoder().encode(secretString);
  }
}

initSecret();

export interface JWTPayload {
  sub: string;
  email: string;
  email_confirmed_at?: string;
  phone_confirmed_at?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  iat: number;
  exp: number;
  aud: string;
  iss: string;
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const jwtVerify = await getJwtVerify();
    if (!jwtVerify) {
      return null;
    }
    const verified = await jwtVerify(token, secret);
    return verified.payload as JWTPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
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
