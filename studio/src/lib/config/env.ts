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

export const REQUIRED_SUPABASE_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
] as const;

export interface SupabaseConfigStatus {
  configured: boolean;
  missingKeys: string[];
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

function readOptionalBooleanEnv(key: string): boolean | null {
  const value = process.env[key]?.trim();
  if (!value) {
    return null;
  }

  if (/^(1|true|yes|on)$/iu.test(value)) {
    return true;
  }

  if (/^(0|false|no|off)$/iu.test(value)) {
    return false;
  }

  return null;
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
  const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL', { legacyKeys: ['SUPABASE_URL'] });
  const supabaseAnonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', { legacyKeys: ['SUPABASE_ANON_KEY'] });
  const supabaseServiceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY', { legacyKeys: ['SUPABASE_SERVICE_KEY'] });
  const supabaseJwtSecret = readEnv('SUPABASE_JWT_SECRET', { defaultValue: 'your-secret-key' }) ?? 'your-secret-key';
  const demoModePreference = readOptionalBooleanEnv('DEMO_MODE');
  const forceDemo = readBooleanEnv('FORCE_DEMO_MODE');
  const hasSupabaseConfig = getSupabaseConfigStatusFromValues(
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    supabaseJwtSecret
  ).configured;
  const demoMode = forceDemo || demoModePreference === true || (demoModePreference !== false && process.env.NODE_ENV === 'production' && !hasSupabaseConfig);

  if (demoModePreference === null && demoMode && process.env.NODE_ENV === 'production' && !hasSupabaseConfig) {
    warnOnce('[env] Demo mode enabled automatically because Supabase environment variables are not configured.');
  }

  if (demoModePreference === false && !hasSupabaseConfig) {
    warnOnce(
      '[env] DEMO_MODE=false but one or more required Supabase keys are missing: '
      + 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET.'
    );
  }

  if (supabaseJwtSecret === 'your-secret-key') {
    warnOnce('[env] SUPABASE_JWT_SECRET is not configured; using the default development secret.');
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
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

function getSupabaseConfigStatusFromValues(
  supabaseUrl: string | null,
  supabaseAnonKey: string | null,
  supabaseServiceRoleKey: string | null,
  supabaseJwtSecret: string
): SupabaseConfigStatus {
  const missingKeys: string[] = [];

  if (!supabaseUrl) {
    missingKeys.push('NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!supabaseAnonKey) {
    missingKeys.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  if (!supabaseServiceRoleKey) {
    missingKeys.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  if (!supabaseJwtSecret || supabaseJwtSecret === 'your-secret-key') {
    missingKeys.push('SUPABASE_JWT_SECRET');
  }

  return {
    configured: missingKeys.length === 0,
    missingKeys,
  };
}

export function getRuntimeEnv(): RuntimeEnv {
  if (!cachedRuntimeEnv) {
    cachedRuntimeEnv = buildRuntimeEnv();
  }

  return cachedRuntimeEnv;
}

export function getSupabaseConfigStatus(env: RuntimeEnv = getRuntimeEnv()): SupabaseConfigStatus {
  return getSupabaseConfigStatusFromValues(
    env.supabaseUrl,
    env.supabaseAnonKey,
    env.supabaseServiceRoleKey,
    env.supabaseJwtSecret
  );
}

export function isDemoModeEnabled(): boolean {
  return getRuntimeEnv().demoMode;
}

export function resetRuntimeEnvCacheForTests(): void {
  cachedRuntimeEnv = null;
  warnedMessages.clear();
}
