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

  it('renders role options exactly for founder, judge, mentor, and subscriber', async () => {
    process.env.DEMO_MODE = 'false';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.SUPABASE_JWT_SECRET = 'jwt-secret';
    resetRuntimeEnvCacheForTests();

    const page = await SignUpPage({ searchParams: Promise.resolve({}) });
    render(page as React.ReactElement);

    const roleInput = screen.getByLabelText('Role');
    expect(roleInput).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Founder' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Judge' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Mentor' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Subscriber' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Admin' })).not.toBeInTheDocument();
  });
});
