import Link from 'next/link';
import { getDemoPersonaCatalog, sanitizeNextPath } from '@/src/lib/auth/request-auth';
import { getSupabaseConfigStatus, isDemoModeEnabled } from '@/src/lib/config/env';

interface SignInPageProps {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
}

function messageForError(error: string | undefined): string | null {
  if (error === 'forbidden') {
    return 'That account cannot access the requested area.';
  }
  if (error === 'invalid_token' || error === 'session_failure') {
    return 'Your session could not be established. Please sign in again.';
  }
  if (error === 'invalid_credentials') {
    return 'Invalid email or password.';
  }
  if (error === 'unauthorized') {
    return 'Sign in to continue.';
  }
  if (error === 'supabase_not_configured') {
    return 'Supabase auth is not configured for credential sign-in. Use demo mode or configure the missing environment variables.';
  }
  return null;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);
  const demoMode = isDemoModeEnabled();
  const errorMessage = messageForError(params.error);
  const supabaseConfigStatus = getSupabaseConfigStatus();

  return (
    <main className="mx-auto grid min-h-[calc(100vh-12rem)] max-w-5xl gap-8 px-6 py-12 md:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-default-200 bg-default-50/80 p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-default-500">Aurrin Ventures</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground">Welcome back</h1>
        <p className="mt-3 max-w-2xl text-default-500">
          {demoMode
            ? 'Try the platform with a demo account — pick a role below to get started.'
            : 'Sign in with your email and password to access your dashboard.'}
        </p>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {errorMessage}
          </div>
        ) : null}

        {!supabaseConfigStatus.configured && !demoMode ? (
          <div className="mt-4 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-warning-700">
            Account sign-in is not available yet. Please check back soon.
          </div>
        ) : null}

        {demoMode ? (
          <div className="mt-8 grid gap-3">
            {getDemoPersonaCatalog().map((persona) => (
              <form key={persona.id} method="post" action="/auth/sign-in/submit" className="rounded-2xl border border-default-200 bg-background p-4">
                <input type="hidden" name="mode" value="demo" />
                <input type="hidden" name="persona" value={persona.persona} />
                <input type="hidden" name="next" value={nextPath} />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">{persona.label}</p>
                    <p className="mt-1 text-sm text-default-500">{persona.description}</p>
                    <p className="mt-2 text-xs text-default-400">{persona.email}</p>
                  </div>
                  <button
                    type="submit"
                    className="inline-flex rounded-full border border-default-300 px-4 py-2 text-sm font-medium text-foreground transition hover:border-violet-500 hover:text-violet-500"
                  >
                    Enter
                  </button>
                </div>
              </form>
            ))}
          </div>
        ) : (
          <>
            <form method="post" action="/auth/sign-in/submit" className="mt-8 grid gap-4">
              <input type="hidden" name="mode" value="credentials" />
              <input type="hidden" name="next" value={nextPath} />
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
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-default-200 bg-background px-4 py-3 text-sm text-foreground focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </label>
              <button
                type="submit"
                className="inline-flex w-fit items-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
              >
                Sign in
              </button>
            </form>
          </>
        )}
      </section>

      <section className="rounded-3xl border border-default-200 bg-background p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-foreground">New to Aurrin?</h2>
        <p className="mt-2 text-sm text-default-500">
          Create an account to apply as a founder, judge pitches, mentor teams, or access premium content.
        </p>
        <Link
          className="mt-4 inline-flex rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700"
          href="/auth/sign-up"
        >
          Create Account
        </Link>

        {demoMode ? (
          <div className="mt-8 rounded-2xl border border-default-200 bg-default-50/50 p-4">
            <p className="text-sm font-medium text-foreground">Demo mode enabled</p>
            <p className="mt-1 text-xs text-default-500">
              Seeded personas are available. Sign in using one of the profiles on the left.
            </p>
          </div>
        ) : null}

        <p className="mt-6 text-xs text-default-400">
          Need to leave the current session? Visit <Link className="text-violet-500 hover:text-violet-400" href="/auth/sign-out">/auth/sign-out</Link>.
        </p>
      </section>
    </main>
  );
}
