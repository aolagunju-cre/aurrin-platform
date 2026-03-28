import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SignInPage from '../src/app/auth/sign-in/page';
import { resetRuntimeEnvCacheForTests } from '../src/lib/config/env';

const ORIGINAL_ENV = process.env;

describe('auth sign-in page mode detection', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.DEMO_MODE;
    delete process.env.FORCE_DEMO_MODE;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_JWT_SECRET;
    process.env.NODE_ENV = 'production';
    resetRuntimeEnvCacheForTests();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    resetRuntimeEnvCacheForTests();
  });

  it('renders email/password sign-in in non-demo mode', async () => {
    process.env.DEMO_MODE = 'false';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.SUPABASE_JWT_SECRET = 'jwt-secret';
    resetRuntimeEnvCacheForTests();

    const page = await SignInPage({ searchParams: Promise.resolve({}) });
    render(page as React.ReactElement);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: 'Enter' })).toHaveLength(0);
  });

  it('renders demo persona sign-in in demo mode', async () => {
    process.env.DEMO_MODE = 'true';
    resetRuntimeEnvCacheForTests();

    const page = await SignInPage({ searchParams: Promise.resolve({}) });
    render(page as React.ReactElement);

    expect(screen.getByText('Demo mode enabled')).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Enter' }).length).toBeGreaterThan(0);
  });

  it('shows deterministic invalid-credentials error messaging', async () => {
    process.env.DEMO_MODE = 'false';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.SUPABASE_JWT_SECRET = 'jwt-secret';
    resetRuntimeEnvCacheForTests();

    const page = await SignInPage({ searchParams: Promise.resolve({ error: 'invalid_credentials' }) });
    render(page as React.ReactElement);

    expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
  });

  it('shows Supabase configuration guidance with missing key list when auth config is incomplete', async () => {
    process.env.DEMO_MODE = 'false';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    resetRuntimeEnvCacheForTests();

    const page = await SignInPage({ searchParams: Promise.resolve({ error: 'supabase_not_configured' }) });
    render(page as React.ReactElement);

    expect(
      screen.getByText('Supabase auth is not configured for credential sign-in. Use demo mode or configure the missing environment variables.')
    ).toBeInTheDocument();
    expect(screen.getByText(/Missing Supabase auth config:/)).toBeInTheDocument();
    expect(screen.getByText(/SUPABASE_SERVICE_ROLE_KEY/)).toBeInTheDocument();
    expect(screen.getByText(/SUPABASE_JWT_SECRET/)).toBeInTheDocument();
  });
});
