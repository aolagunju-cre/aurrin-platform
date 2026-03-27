import Link from 'next/link';
import { getDemoPersonaCatalog, sanitizeNextPath } from '@/src/lib/auth/request-auth';
import { isDemoModeEnabled } from '@/src/lib/config/env';

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
  if (error === 'invalid_token') {
    return 'The provided token was invalid or expired.';
  }
  if (error === 'unauthorized') {
    return 'Sign in to continue.';
  }
  return null;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);
  const demoMode = isDemoModeEnabled();
  const errorMessage = messageForError(params.error);

  return (
    <main className="mx-auto grid min-h-[calc(100vh-12rem)] max-w-5xl gap-8 px-6 py-12 md:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-default-200 bg-default-50/80 p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-default-500">Aurrin Access</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground">Sign in to the platform</h1>
        <p className="mt-3 max-w-2xl text-default-500">
          Real sessions use a Supabase-issued access token. Demo mode provides seeded personas for end-to-end exploration without touching live infrastructure.
        </p>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {errorMessage}
          </div>
        ) : null}

        <form method="post" action="/auth/sign-in/submit" className="mt-8 grid gap-4">
          <input type="hidden" name="mode" value="token" />
          <input type="hidden" name="next" value={nextPath} />
          <label className="grid gap-2 text-sm text-default-600">
            Supabase access token
            <textarea
              name="access_token"
              rows={8}
              required
              placeholder="Paste a valid Supabase JWT or use /auth/callback?access_token=..."
              className="w-full rounded-2xl border border-default-200 bg-background px-4 py-3 font-mono text-xs text-foreground focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </label>
          <button
            type="submit"
            className="inline-flex w-fit items-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
          >
            Sign in with token
          </button>
        </form>

        <div className="mt-8 rounded-2xl border border-default-200 bg-background/70 p-4 text-sm text-default-500">
          <p className="font-medium text-foreground">Callback support</p>
          <p className="mt-1">
            Redirect your Supabase auth flow to{' '}
            <code className="rounded bg-default-100 px-1.5 py-0.5 text-xs text-foreground">/auth/callback?access_token=&lt;jwt&gt;</code>
            {' '}or include a relative <code className="rounded bg-default-100 px-1.5 py-0.5 text-xs text-foreground">next</code> query.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-default-200 bg-background p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-foreground">Demo personas</h2>
        <p className="mt-2 text-sm text-default-500">
          {demoMode
            ? 'Choose a seeded persona to exercise the protected journeys without external services.'
            : 'Demo mode is disabled. Set DEMO_MODE=true to enable seeded personas.'}
        </p>

        <div className="mt-6 grid gap-3">
          {getDemoPersonaCatalog().map((persona) => (
            <form key={persona.id} method="post" action="/auth/sign-in/submit" className="rounded-2xl border border-default-200 p-4">
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
                  disabled={!demoMode}
                  className="inline-flex rounded-full border border-default-300 px-4 py-2 text-sm font-medium text-foreground transition hover:border-violet-500 hover:text-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Enter
                </button>
              </div>
            </form>
          ))}
        </div>

        <p className="mt-6 text-xs text-default-400">
          Need to leave the current session? Visit <Link className="text-violet-500 hover:text-violet-400" href="/auth/sign-out">/auth/sign-out</Link>.
        </p>
      </section>
    </main>
  );
}
