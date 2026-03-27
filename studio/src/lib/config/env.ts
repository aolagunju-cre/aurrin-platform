const warnedMessages = new Set<string>();

interface EnvLookupOptions {
  legacyKeys?: string[];
  defaultValue?: string;
}

export interface FeatureFlags {
  scoring: boolean;
  audienceValidation: boolean;
  mentorMatching: boolean;
  commerce: boolean;
}

export interface RuntimeEnv {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  supabaseServiceRoleKey: string | null;
  supabaseJwtSecret: string;
  stripeSecretKey: string | null;
  stripePublishableKey: string | null;
  stripeWebhookSecret: string | null;
  resendApiKey: string | null;
  demoMode: boolean;
  featureFlags: FeatureFlags;
}

let cachedRuntimeEnv: RuntimeEnv | null = null;

function warnOnce(message: string): void {
  if (warnedMessages.has(message)) {
    return;
  }

  warnedMessages.add(message);
  console.warn(message);
}

function readBooleanEnv(key: string, defaultValue = false): boolean {
  const value = process.env[key]?.trim();
  if (!value) {
    return defaultValue;
  }

  return /^(1|true|yes|on)$/iu.test(value);
}

function readEnv(canonicalKey: string, options: EnvLookupOptions = {}): string | null {
  const directValue = process.env[canonicalKey]?.trim();
  if (directValue) {
    return directValue;
  }

  for (const legacyKey of options.legacyKeys ?? []) {
    const legacyValue = process.env[legacyKey]?.trim();
    if (legacyValue) {
      warnOnce(`[env] ${legacyKey} is deprecated; use ${canonicalKey} instead.`);
      return legacyValue;
    }
  }

  if (options.defaultValue !== undefined) {
    return options.defaultValue;
  }

  return null;
}

function buildRuntimeEnv(): RuntimeEnv {
  const demoModeRequested = readBooleanEnv('DEMO_MODE');
  const forceDemo = readBooleanEnv('FORCE_DEMO_MODE');
  const demoMode = forceDemo || (demoModeRequested && process.env.NODE_ENV !== 'production');

  if (demoModeRequested && !forceDemo && process.env.NODE_ENV === 'production') {
    warnOnce('[env] DEMO_MODE is ignored in production environments. Use FORCE_DEMO_MODE=true to override.');
  }

  const supabaseJwtSecret = readEnv('SUPABASE_JWT_SECRET', { defaultValue: 'your-secret-key' }) ?? 'your-secret-key';
  if (supabaseJwtSecret === 'your-secret-key') {
    warnOnce('[env] SUPABASE_JWT_SECRET is not configured; using the default development secret.');
  }

  return {
    supabaseUrl: readEnv('NEXT_PUBLIC_SUPABASE_URL', { legacyKeys: ['SUPABASE_URL'] }),
    supabaseAnonKey: readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', { legacyKeys: ['SUPABASE_ANON_KEY'] }),
    supabaseServiceRoleKey: readEnv('SUPABASE_SERVICE_ROLE_KEY', { legacyKeys: ['SUPABASE_SERVICE_KEY'] }),
    supabaseJwtSecret,
    stripeSecretKey: readEnv('STRIPE_SECRET_KEY'),
    stripePublishableKey: readEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', { legacyKeys: ['STRIPE_PUBLISHABLE_KEY'] }),
    stripeWebhookSecret: readEnv('STRIPE_WEBHOOK_SECRET'),
    resendApiKey: readEnv('RESEND_API_KEY'),
    demoMode,
    featureFlags: {
      scoring: readBooleanEnv('NEXT_PUBLIC_ENABLE_SCORING', true),
      audienceValidation: readBooleanEnv('NEXT_PUBLIC_ENABLE_AUDIENCE_VALIDATION', true),
      mentorMatching: readBooleanEnv('NEXT_PUBLIC_ENABLE_MENTOR_MATCHING', false),
      commerce: readBooleanEnv('NEXT_PUBLIC_ENABLE_COMMERCE', false),
    },
  };
}

export function getRuntimeEnv(): RuntimeEnv {
  if (!cachedRuntimeEnv) {
    cachedRuntimeEnv = buildRuntimeEnv();
  }

  return cachedRuntimeEnv;
}

export function isDemoModeEnabled(): boolean {
  return getRuntimeEnv().demoMode;
}

export function resetRuntimeEnvCacheForTests(): void {
  cachedRuntimeEnv = null;
  warnedMessages.clear();
}
