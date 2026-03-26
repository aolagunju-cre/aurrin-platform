'use client';

import React, { useEffect, useState } from 'react';

type SponsorTier = 'bronze' | 'silver' | 'gold';
type SponsorScope = 'event' | 'site-wide';
type SponsorStatus = 'active' | 'inactive';

interface SponsorListItem {
  id: string;
  name: string;
  logo: string | null;
  website: string | null;
  tier: SponsorTier;
  scope: SponsorScope;
  event: string | null;
  end_date: string | null;
  pricing: number;
  status: SponsorStatus;
}

interface TierConfigItem {
  tier: SponsorTier;
  pricing_cents: number;
}

interface SponsorsResponse {
  success: boolean;
  data?: SponsorListItem[];
  tier_config?: TierConfigItem[];
  message?: string;
}

interface CreateDraft {
  name: string;
  logo: string;
  website: string;
  tier: SponsorTier;
  scope: SponsorScope;
  event: string;
  end_date: string;
  pricing: string;
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function toDateInputValue(value: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export default function AdminSponsorsPage(): React.ReactElement {
  const [sponsors, setSponsors] = useState<SponsorListItem[]>([]);
  const [tierConfig, setTierConfig] = useState<TierConfigItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<CreateDraft>({
    name: '',
    logo: '',
    website: '',
    tier: 'bronze',
    scope: 'site-wide',
    event: '',
    end_date: '',
    pricing: '50000',
  });

  async function loadSponsors(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/sponsors');
      const payload = await response.json() as SponsorsResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? 'Could not load sponsors.');
      }
      setSponsors(payload.data ?? []);
      setTierConfig(payload.tier_config ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load sponsors.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSponsors();
  }, []);

  useEffect(() => {
    const suggested = tierConfig.find((item) => item.tier === draft.tier)?.pricing_cents;
    if (suggested !== undefined && !draft.pricing) {
      setDraft((current) => ({ ...current, pricing: String(suggested) }));
    }
  }, [draft.tier, draft.pricing, tierConfig]);

  async function createSponsor(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    const pricing = Number.parseInt(draft.pricing, 10);
    if (!Number.isInteger(pricing) || pricing < 0) {
      setError('pricing must be a non-negative integer amount in cents.');
      return;
    }

    const response = await fetch('/api/admin/sponsors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name,
        logo: draft.logo || null,
        website: draft.website || null,
        tier: draft.tier,
        scope: draft.scope,
        event: draft.scope === 'event' ? draft.event : null,
        end_date: new Date(draft.end_date).toISOString(),
        pricing,
      }),
    });
    const payload = await response.json() as SponsorsResponse;
    if (!response.ok || !payload.success) {
      setError(payload.message ?? 'Could not create sponsor.');
      return;
    }

    setDraft({
      name: '',
      logo: '',
      website: '',
      tier: 'bronze',
      scope: 'site-wide',
      event: '',
      end_date: '',
      pricing: '50000',
    });
    await loadSponsors();
  }

  async function saveSponsor(sponsor: SponsorListItem): Promise<void> {
    setError(null);
    const response = await fetch(`/api/admin/sponsors/${sponsor.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: sponsor.name,
        logo: sponsor.logo,
        website: sponsor.website,
        tier: sponsor.tier,
        scope: sponsor.scope,
        event: sponsor.scope === 'event' ? sponsor.event : null,
        end_date: sponsor.end_date,
        pricing: sponsor.pricing,
        status: sponsor.status,
      }),
    });
    const payload = await response.json() as SponsorsResponse;
    if (!response.ok || !payload.success) {
      setError(payload.message ?? 'Could not save sponsor.');
      return;
    }

    await loadSponsors();
  }

  async function deleteSponsor(id: string): Promise<void> {
    const confirmed = window.confirm('Delete this sponsor?');
    if (!confirmed) {
      return;
    }

    setError(null);
    const response = await fetch(`/api/admin/sponsors/${id}`, {
      method: 'DELETE',
    });
    const payload = await response.json() as SponsorsResponse;
    if (!response.ok || !payload.success) {
      setError(payload.message ?? 'Could not delete sponsor.');
      return;
    }

    await loadSponsors();
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <header>
        <h1 style={{ marginBottom: '0.25rem' }}>Sponsored Placements</h1>
        <p style={{ margin: 0 }}>Admin-managed sponsorships by tier and scope.</p>
      </header>

      {error ? <p role="alert" style={{ color: '#b00020', margin: 0 }}>{error}</p> : null}
      {loading ? <p>Loading sponsors...</p> : null}

      <form onSubmit={(event) => void createSponsor(event)} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem', display: 'grid', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Create Sponsor</h2>
        <input
          aria-label="name"
          placeholder="name"
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          required
        />
        <input
          aria-label="logo"
          placeholder="logo url"
          value={draft.logo}
          onChange={(event) => setDraft((current) => ({ ...current, logo: event.target.value }))}
        />
        <input
          aria-label="website"
          placeholder="website url"
          value={draft.website}
          onChange={(event) => setDraft((current) => ({ ...current, website: event.target.value }))}
        />
        <select
          aria-label="tier"
          value={draft.tier}
          onChange={(event) => {
            const tier = event.target.value as SponsorTier;
            const suggested = tierConfig.find((entry) => entry.tier === tier)?.pricing_cents ?? 0;
            setDraft((current) => ({ ...current, tier, pricing: String(suggested) }));
          }}
        >
          <option value="bronze">bronze</option>
          <option value="silver">silver</option>
          <option value="gold">gold</option>
        </select>
        <select
          aria-label="scope"
          value={draft.scope}
          onChange={(event) => setDraft((current) => ({ ...current, scope: event.target.value as SponsorScope }))}
        >
          <option value="site-wide">site-wide</option>
          <option value="event">event</option>
        </select>
        <input
          aria-label="event"
          placeholder="event id (required when scope=event)"
          value={draft.event}
          onChange={(event) => setDraft((current) => ({ ...current, event: event.target.value }))}
          disabled={draft.scope === 'site-wide'}
        />
        <input
          aria-label="end_date"
          type="date"
          value={draft.end_date}
          onChange={(event) => setDraft((current) => ({ ...current, end_date: event.target.value }))}
          required
        />
        <input
          aria-label="pricing"
          type="number"
          min={0}
          value={draft.pricing}
          onChange={(event) => setDraft((current) => ({ ...current, pricing: event.target.value }))}
          required
        />
        <button type="submit">Create Sponsor</button>
      </form>

      <table aria-label="Sponsors Table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">name</th>
            <th align="left">tier</th>
            <th align="left">scope</th>
            <th align="left">end_date</th>
            <th align="left">pricing</th>
            <th align="left">status</th>
            <th align="left">actions</th>
          </tr>
        </thead>
        <tbody>
          {sponsors.map((sponsor) => (
            <tr key={sponsor.id}>
              <td>
                <input
                  aria-label={`name ${sponsor.id}`}
                  value={sponsor.name}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSponsors((current) => current.map((item) => (item.id === sponsor.id ? { ...item, name: value } : item)));
                  }}
                />
              </td>
              <td>
                <select
                  aria-label={`tier ${sponsor.id}`}
                  value={sponsor.tier}
                  onChange={(event) => {
                    const tier = event.target.value as SponsorTier;
                    const suggested = tierConfig.find((entry) => entry.tier === tier)?.pricing_cents ?? sponsor.pricing;
                    setSponsors((current) => current.map((item) => (
                      item.id === sponsor.id ? { ...item, tier, pricing: suggested } : item
                    )));
                  }}
                >
                  <option value="bronze">bronze</option>
                  <option value="silver">silver</option>
                  <option value="gold">gold</option>
                </select>
              </td>
              <td>
                <select
                  aria-label={`scope ${sponsor.id}`}
                  value={sponsor.scope}
                  onChange={(event) => {
                    const scope = event.target.value as SponsorScope;
                    setSponsors((current) => current.map((item) => (
                      item.id === sponsor.id ? { ...item, scope, event: scope === 'site-wide' ? null : item.event } : item
                    )));
                  }}
                >
                  <option value="site-wide">site-wide</option>
                  <option value="event">event</option>
                </select>
              </td>
              <td>
                <input
                  aria-label={`end_date ${sponsor.id}`}
                  type="date"
                  value={toDateInputValue(sponsor.end_date)}
                  onChange={(event) => {
                    const value = event.target.value ? `${event.target.value}T00:00:00.000Z` : null;
                    setSponsors((current) => current.map((item) => (item.id === sponsor.id ? { ...item, end_date: value } : item)));
                  }}
                />
              </td>
              <td>
                <input
                  aria-label={`pricing ${sponsor.id}`}
                  type="number"
                  min={0}
                  value={sponsor.pricing}
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10);
                    setSponsors((current) => current.map((item) => (
                      item.id === sponsor.id ? { ...item, pricing: Number.isFinite(value) ? value : 0 } : item
                    )));
                  }}
                />
                <div>{formatUsd(sponsor.pricing)}</div>
              </td>
              <td>
                <select
                  aria-label={`status ${sponsor.id}`}
                  value={sponsor.status}
                  onChange={(event) => {
                    const value = event.target.value as SponsorStatus;
                    setSponsors((current) => current.map((item) => (item.id === sponsor.id ? { ...item, status: value } : item)));
                  }}
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </td>
              <td>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={() => void saveSponsor(sponsor)}>Save</button>
                  <button type="button" onClick={() => void deleteSponsor(sponsor.id)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
