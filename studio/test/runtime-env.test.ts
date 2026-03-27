/** @jest-environment node */

import { getRuntimeEnv, resetRuntimeEnvCacheForTests } from '../src/lib/config/env';

const ORIGINAL_ENV = process.env;

describe('runtime env demo mode', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_JWT_SECRET;
    delete process.env.DEMO_MODE;
    delete process.env.FORCE_DEMO_MODE;
    process.env.NODE_ENV = 'production';
    resetRuntimeEnvCacheForTests();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    resetRuntimeEnvCacheForTests();
  });

  it('honors DEMO_MODE=true in production', () => {
    process.env.DEMO_MODE = 'true';

    expect(getRuntimeEnv().demoMode).toBe(true);
  });

  it('defaults production deployments without Supabase config into demo mode', () => {
    expect(getRuntimeEnv().demoMode).toBe(true);
  });

  it('lets explicit DEMO_MODE=false disable the production fallback', () => {
    process.env.DEMO_MODE = 'false';

    expect(getRuntimeEnv().demoMode).toBe(false);
  });

  it('keeps demo mode off when production Supabase config is present', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.SUPABASE_JWT_SECRET = 'jwt-secret-key';

    expect(getRuntimeEnv().demoMode).toBe(false);
  });

  it('keeps demo fallback on when one required Supabase key is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    expect(getRuntimeEnv().demoMode).toBe(true);
  });
});
