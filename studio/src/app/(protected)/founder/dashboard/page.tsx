'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { slugifyCompanyName } from '../../../../lib/directory/slug';

interface FounderProfileData {
  founder_id: string;
  name: string | null;
  email: string;
  company_name: string | null;
  pitch_summary: string | null;
  website: string | null;
}

export default function FounderDashboardPage(): React.ReactElement {
  const [profile, setProfile] = useState<FounderProfileData | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const [fundingGoalDollars, setFundingGoalDollars] = useState('');
  const [currentGoalCents, setCurrentGoalCents] = useState<number | null>(null);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalMessage, setGoalMessage] = useState<string | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      setIsLoadingProfile(true);
      setProfileError(null);
      try {
        const [profileRes, goalRes] = await Promise.all([
          fetch('/api/founder/profile'),
          fetch('/api/founder/dashboard/goal'),
        ]);

        const profilePayload = (await profileRes.json()) as {
          success: boolean;
          data?: FounderProfileData;
          message?: string;
        };
        if (!profileRes.ok || !profilePayload.success || !profilePayload.data) {
          throw new Error(profilePayload.message ?? 'Failed to load founder profile.');
        }
        setProfile(profilePayload.data);

        const goalPayload = (await goalRes.json()) as {
          success: boolean;
          data?: { funding_goal_cents: number | null };
          message?: string;
        };
        if (goalRes.ok && goalPayload.success && goalPayload.data) {
          const cents = goalPayload.data.funding_goal_cents;
          setCurrentGoalCents(cents);
          if (cents !== null) {
            setFundingGoalDollars(String(Math.round(cents / 100)));
          }
        }
      } catch (err) {
        setProfileError(err instanceof Error ? err.message : 'Failed to load dashboard.');
      } finally {
        setIsLoadingProfile(false);
      }
    }

    void load();
  }, []);

  // Generate QR code onto canvas after profile loads
  useEffect(() => {
    if (!profile?.company_name || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const slug = slugifyCompanyName(profile.company_name);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const qrUrl = `${origin}/founders/${slug}`;

    async function drawQr(): Promise<void> {
      try {
        const QRCode = (await import('qrcode')).default;
        await QRCode.toCanvas(canvas, qrUrl, { width: 200, margin: 2 });
      } catch {
        setQrError('QR code generation failed.');
      }
    }

    void drawQr();
  }, [profile]);

  const handleGoalSubmit = useCallback(
    async (e: React.FormEvent): Promise<void> => {
      e.preventDefault();
      setGoalSaving(true);
      setGoalMessage(null);
      setGoalError(null);

      const dollars = parseFloat(fundingGoalDollars);
      if (isNaN(dollars) || dollars < 0) {
        setGoalError('Please enter a valid positive dollar amount.');
        setGoalSaving(false);
        return;
      }

      const cents = Math.round(dollars * 100);

      try {
        const res = await fetch('/api/founder/dashboard/goal', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ funding_goal_cents: cents }),
        });
        const payload = (await res.json()) as {
          success: boolean;
          data?: { funding_goal_cents: number | null };
          message?: string;
        };
        if (!res.ok || !payload.success) {
          throw new Error(payload.message ?? 'Failed to save funding goal.');
        }
        const saved = payload.data?.funding_goal_cents ?? cents;
        setCurrentGoalCents(saved);
        setGoalMessage('Funding goal saved.');
      } catch (err) {
        setGoalError(err instanceof Error ? err.message : 'Failed to save funding goal.');
      } finally {
        setGoalSaving(false);
      }
    },
    [fundingGoalDollars]
  );

  const handleDownloadQr = useCallback((): void => {
    if (!canvasRef.current) {
      return;
    }
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'founder-qr-code.png';
    link.click();
  }, []);

  const slug = profile?.company_name ? slugifyCompanyName(profile.company_name) : '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const qrTargetUrl = slug ? `${origin}/founders/${slug}` : '';

  return (
    <section className="container mx-auto max-w-4xl px-6 py-8 space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Founder Dashboard</h1>

      <nav aria-label="Founder Dashboard Navigation" className="flex flex-wrap gap-4 text-sm">
        <a href="/founder/dashboard" className="text-violet-400 hover:text-violet-300 transition-colors font-semibold">Dashboard</a>
        <span className="text-default-300">|</span>
        <a href="/founder/profile" className="text-violet-400 hover:text-violet-300 transition-colors">Edit Profile</a>
        <span className="text-default-300">|</span>
        <a href="/founder/dashboard/tiers" className="text-violet-400 hover:text-violet-300 transition-colors">Sponsorship Tiers</a>
        <span className="text-default-300">|</span>
        <a href="/founder/dashboard/donors" className="text-violet-400 hover:text-violet-300 transition-colors">Donors</a>
      </nav>

      {profileError ? (
        <p role="alert" className="text-danger">{profileError}</p>
      ) : null}

      {isLoadingProfile ? (
        <p className="text-default-400">Loading dashboard...</p>
      ) : null}

      {!isLoadingProfile && profile ? (
        <>
          {/* Profile Summary */}
          <section aria-label="Profile Summary" className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Your Profile</h2>
              <a
                href="/founder/profile"
                className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                Edit Profile →
              </a>
            </div>
            <p className="text-foreground font-medium">{profile.name ?? 'No name set'}</p>
            <p className="text-default-500 text-sm">{profile.company_name ?? 'No company name set'}</p>
            <p className="text-default-400 text-sm">{profile.email}</p>
            {profile.pitch_summary ? (
              <p className="text-default-500 text-sm">{profile.pitch_summary}</p>
            ) : null}
            {profile.website ? (
              <a href={profile.website} className="text-violet-400 text-sm hover:underline" target="_blank" rel="noopener noreferrer">
                {profile.website}
              </a>
            ) : null}
          </section>

          {/* Funding Goal */}
          <section aria-label="Funding Goal" className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Funding Goal</h2>
            {currentGoalCents !== null ? (
              <p className="text-default-500">
                Current goal:{' '}
                <span className="text-violet-400 font-semibold">
                  ${(currentGoalCents / 100).toLocaleString('en-CA', { minimumFractionDigits: 0 })}
                </span>
              </p>
            ) : (
              <p className="text-default-400 text-sm">No funding goal set yet.</p>
            )}
            <form onSubmit={(e) => { void handleGoalSubmit(e); }} className="flex items-end gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label htmlFor="funding-goal-input" className="text-sm text-default-500">
                  Target amount (CAD $)
                </label>
                <input
                  id="funding-goal-input"
                  type="number"
                  min="0"
                  step="1"
                  value={fundingGoalDollars}
                  onChange={(e) => setFundingGoalDollars(e.target.value)}
                  placeholder="e.g. 50000"
                  className="rounded-xl border border-default-300 bg-default-100 dark:bg-default-100/10 px-4 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <button
                type="submit"
                disabled={goalSaving}
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {goalSaving ? 'Saving…' : 'Set Goal'}
              </button>
            </form>
            {goalMessage ? <p className="text-sm text-green-400">{goalMessage}</p> : null}
            {goalError ? <p className="text-sm text-danger">{goalError}</p> : null}
          </section>

          {/* QR Code Panel */}
          <section aria-label="QR Code" className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">QR Code</h2>
            {qrTargetUrl ? (
              <p className="text-default-400 text-sm break-all">
                Links to: <span className="text-violet-400">{qrTargetUrl}</span>
              </p>
            ) : null}
            {qrError ? (
              <p className="text-sm text-danger">{qrError}</p>
            ) : null}
            <canvas ref={canvasRef} aria-label="Founder public profile QR code" className="rounded-lg" />
            <div>
              <button
                type="button"
                onClick={handleDownloadQr}
                className="px-5 py-2 rounded-xl bg-default-200 hover:bg-default-300 text-foreground text-sm font-medium transition-colors"
              >
                Download QR Code
              </button>
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
