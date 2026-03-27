'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@heroui/button';

type SponsorTier = 'bronze' | 'silver' | 'gold';
type SponsorScope = 'event' | 'site-wide';

interface SponsorRecord {
  id: string;
  name: string;
  logo: string | null;
  tier: SponsorTier;
  scope: SponsorScope;
  event: string | null;
}

interface SponsorsResponse {
  success: boolean;
  data?: SponsorRecord[];
  message?: string;
}

interface CreateDraft {
  name: string;
  logo: string;
  tier: SponsorTier;
  scope: SponsorScope;
}

export default function AdminEventSponsorsPage(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const [sponsors, setSponsors] = useState<SponsorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CreateDraft>({
    name: '',
    logo: '',
    tier: 'bronze',
    scope: 'event',
  });

  async function loadSponsors(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/events/${params.id}/sponsors`);
      const payload = await response.json() as SponsorsResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? 'Failed to load sponsors.');
      }
      setSponsors(payload.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load sponsors.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (params.id) {
      void loadSponsors();
    }
  }, [params.id]);

  async function createSponsor(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    const response = await fetch(`/api/admin/events/${params.id}/sponsors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name,
        logo: draft.logo || null,
        tier: draft.tier,
        scope: draft.scope,
        end_date: '2099-12-31T00:00:00.000Z',
      }),
    });
    const payload = await response.json() as SponsorsResponse;
    if (!response.ok || !payload.success) {
      setError(payload.message ?? 'Failed to create sponsor.');
      return;
    }

    setDraft({ name: '', logo: '', tier: 'bronze', scope: 'event' });
    await loadSponsors();
  }

  async function deleteSponsor(sponsorId: string): Promise<void> {
    setError(null);
    const response = await fetch(`/api/admin/sponsors/${sponsorId}`, { method: 'DELETE' });
    const payload = await response.json() as SponsorsResponse;
    if (!response.ok || !payload.success) {
      setError(payload.message ?? 'Failed to delete sponsor.');
      return;
    }

    setSponsors((current) => current.filter((sponsor) => sponsor.id !== sponsorId));
  }

  const inputClass = "w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground placeholder:text-default-400 focus:outline-none focus:ring-2 focus:ring-violet-500";

  return (
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Event Sponsors</h1>
        <a href={`/admin/events/${params.id}`} className="text-violet-400 hover:text-violet-300 transition-colors text-sm">Back to Event</a>
      </header>

      {error ? <p role="alert" className="text-danger">{error}</p> : null}
      {loading ? <p className="text-default-400">Loading sponsors...</p> : null}

      <form onSubmit={(event) => void createSponsor(event)} className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Add Sponsor</h2>
        <input aria-label="sponsor name" placeholder="name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required className={inputClass} />
        <input aria-label="sponsor logo" placeholder="logo" value={draft.logo} onChange={(event) => setDraft((current) => ({ ...current, logo: event.target.value }))} className={inputClass} />
        <select aria-label="sponsor tier" value={draft.tier} onChange={(event) => setDraft((current) => ({ ...current, tier: event.target.value as SponsorTier }))} className={inputClass}>
          <option value="bronze">bronze</option>
          <option value="silver">silver</option>
          <option value="gold">gold</option>
        </select>
        <select aria-label="sponsor scope" value={draft.scope} onChange={(event) => setDraft((current) => ({ ...current, scope: event.target.value as SponsorScope }))} className={inputClass}>
          <option value="event">event</option>
          <option value="site-wide">site-wide</option>
        </select>
        <Button type="submit" color="secondary">Add Sponsor</Button>
      </form>

      <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 overflow-x-auto">
        <table aria-label="Event Sponsors Table" className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Name</th>
              <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Tier</th>
              <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Scope</th>
              <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sponsors.map((sponsor) => (
              <tr key={sponsor.id} className="hover:bg-default-100/50 transition-colors">
                <td className="px-4 py-3 border-b border-default-100 text-foreground">{sponsor.name}</td>
                <td className="px-4 py-3 border-b border-default-100">
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                    sponsor.tier === 'gold' ? 'bg-yellow-500/10 text-yellow-400' :
                    sponsor.tier === 'silver' ? 'bg-gray-400/10 text-gray-400' :
                    'bg-orange-500/10 text-orange-400'
                  }`}>{sponsor.tier}</span>
                </td>
                <td className="px-4 py-3 border-b border-default-100 text-default-500">{sponsor.scope}</td>
                <td className="px-4 py-3 border-b border-default-100">
                  <Button size="sm" color="danger" variant="flat" onPress={() => void deleteSponsor(sponsor.id)}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
