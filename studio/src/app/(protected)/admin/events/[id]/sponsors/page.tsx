'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

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

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <header>
        <h1 style={{ marginBottom: '0.5rem' }}>Event Sponsors</h1>
        <a href={`/admin/events/${params.id}`}>Back to Event</a>
      </header>

      {error ? <p role="alert" style={{ color: '#b00020', margin: 0 }}>{error}</p> : null}
      {loading ? <p>Loading sponsors...</p> : null}

      <form onSubmit={(event) => void createSponsor(event)} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem', display: 'grid', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Add Sponsor</h2>
        <input
          aria-label="sponsor name"
          placeholder="name"
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          required
        />
        <input
          aria-label="sponsor logo"
          placeholder="logo"
          value={draft.logo}
          onChange={(event) => setDraft((current) => ({ ...current, logo: event.target.value }))}
        />
        <select
          aria-label="sponsor tier"
          value={draft.tier}
          onChange={(event) => setDraft((current) => ({ ...current, tier: event.target.value as SponsorTier }))}
        >
          <option value="bronze">bronze</option>
          <option value="silver">silver</option>
          <option value="gold">gold</option>
        </select>
        <select
          aria-label="sponsor scope"
          value={draft.scope}
          onChange={(event) => setDraft((current) => ({ ...current, scope: event.target.value as SponsorScope }))}
        >
          <option value="event">event</option>
          <option value="site-wide">site-wide</option>
        </select>
        <button type="submit">Add Sponsor</button>
      </form>

      <table aria-label="Event Sponsors Table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">name</th>
            <th align="left">tier</th>
            <th align="left">scope</th>
            <th align="left">actions</th>
          </tr>
        </thead>
        <tbody>
          {sponsors.map((sponsor) => (
            <tr key={sponsor.id}>
              <td>{sponsor.name}</td>
              <td>{sponsor.tier}</td>
              <td>{sponsor.scope}</td>
              <td>
                <button type="button" onClick={() => void deleteSponsor(sponsor.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
