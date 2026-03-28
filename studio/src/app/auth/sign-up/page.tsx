import Link from 'next/link';
import { SIGN_UP_ROLE_OPTIONS, sanitizeNextPath } from '@/src/lib/auth/request-auth';
import { getSupabaseConfigStatus, isDemoModeEnabled } from '@/src/lib/config/env';

interface SignUpPageProps {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
}

function messageForError(error: string | undefined): string | null {
  if (error === 'invalid_role') {
    return 'Choose one of the allowed roles: Founder, Judge, Mentor, or Subscriber.';
  }
  if (error === 'invalid_credentials') {
    return 'Please provide a valid email and password to create your account.';
  }
  if (error === 'registration_failed') {
    return 'Account creation failed. Please try again.';
  }
  if (error === 'session_failure') {
    return 'Account created, but session setup failed. Please sign in.';
  }
  if (error === 'forbidden') {
    return 'Demo sign-up is not available right now.';
  }
  if (error === 'supabase_not_configured') {
    return 'Supabase auth is not configured for credential sign-up. Use demo mode or configure the missing environment variables.';
  }
  return null;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);
  const demoMode = isDemoModeEnabled();
  const errorMessage = messageForError(params.error);
  const supabaseConfigStatus = getSupabaseConfigStatus();

  return (
    <main className="mx-auto grid min-h-[calc(100vh-12rem)] max-w-5xl gap-8 px-6 py-12 md:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-default-200 bg-default-50/80 p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-default-500">Aurrin Access</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground">Create your account</h1>
        <p className="mt-3 max-w-2xl text-default-500">
          {demoMode
            ? 'Demo sign-up simulates account creation and starts a role-based session.'
            : 'Register with email, choose your role, and continue into your portal.'}
        </p>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {errorMessage}
          </div>
        ) : null}

        {!supabaseConfigStatus.configured ? (
          <div className="mt-4 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-warning-700">
            Missing Supabase auth config: {supabaseConfigStatus.missingKeys.join(', ')}
          </div>
        ) : null}

        <form method="post" action="/auth/sign-up/submit" className="mt-8 grid gap-4">
          <input type="hidden" name="mode" value={demoMode ? 'demo' : 'credentials'} />
          <input type="hidden" name="next" value={nextPath} />
          <label className="grid gap-2 text-sm text-default-600">
            Full name
            <input
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Your name"
              className="w-full rounded-2xl border border-default-200 bg-background px-4 py-3 text-sm text-foreground focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </label>
          <label className="grid gap-2 text-sm text-default-600">
            Email
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              className="w-full rounded-2xl border border-default-200 bg-background px-4 py-3 text-sm text-foreground focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </label>
          <label className="grid gap-2 text-sm text-default-600">
            Password
            <input
              type="password"
              name="password"
              required
              autoComplete="new-password"
              className="w-full rounded-2xl border border-default-200 bg-background px-4 py-3 text-sm text-foreground focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </label>
          <label className="grid gap-2 text-sm text-default-600">
            Role
            <select
              name="role"
              required
              defaultValue=""
              className="w-full rounded-2xl border border-default-200 bg-background px-4 py-3 text-sm text-foreground focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            >
              <option value="" disabled>Select a role</option>
              {SIGN_UP_ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex w-fit items-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
          >
            Create account
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-default-200 bg-background p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-foreground">Already have an account?</h2>
        <p className="mt-2 text-sm text-default-500">
          Use the sign-in flow to continue to your assigned portal.
        </p>
        <p className="mt-6 text-sm">
          <Link className="text-violet-500 hover:text-violet-400" href="/auth/sign-in">Go to sign in</Link>
        </p>
      </section>
    </main>
  );
}
