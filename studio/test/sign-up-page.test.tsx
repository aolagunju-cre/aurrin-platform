import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SignUpPage from '../src/app/auth/sign-up/page';
import { resetRuntimeEnvCacheForTests } from '../src/lib/config/env';

const ORIGINAL_ENV = process.env;

describe('auth sign-up page', () => {
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

  it('renders role cards exactly for founder, judge, mentor, and subscriber with route hints', async () => {
    process.env.DEMO_MODE = 'false';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.SUPABASE_JWT_SECRET = 'jwt-secret';
    resetRuntimeEnvCacheForTests();

    const page = await SignUpPage({ searchParams: Promise.resolve({}) });
    render(page as React.ReactElement);

    expect(screen.getByDisplayValue('founder')).toBeInTheDocument();
    expect(screen.getByDisplayValue('judge')).toBeInTheDocument();
    expect(screen.getByDisplayValue('mentor')).toBeInTheDocument();
    expect(screen.getByDisplayValue('subscriber')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Admin/i })).not.toBeInTheDocument();
    expect(screen.getByText('Route: /founder')).toBeInTheDocument();
    expect(screen.getByText('Route: /judge/events')).toBeInTheDocument();
    expect(screen.getByText('Route: /mentor')).toBeInTheDocument();
    expect(screen.getByText('Route: /subscriber')).toBeInTheDocument();
  });

  it('shows Supabase configuration guidance when credential sign-up is selected but env is incomplete', async () => {
    process.env.DEMO_MODE = 'false';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    resetRuntimeEnvCacheForTests();

    const page = await SignUpPage({ searchParams: Promise.resolve({ error: 'supabase_not_configured' }) });
    render(page as React.ReactElement);

    expect(
      screen.getByText('Supabase auth is not configured for credential sign-up. Use demo mode or configure the missing environment variables.')
    ).toBeInTheDocument();
    expect(screen.getByText(/Missing Supabase auth config:/)).toBeInTheDocument();
    expect(screen.getByText(/SUPABASE_SERVICE_ROLE_KEY/)).toBeInTheDocument();
    expect(screen.getByText(/SUPABASE_JWT_SECRET/)).toBeInTheDocument();
  });
});
