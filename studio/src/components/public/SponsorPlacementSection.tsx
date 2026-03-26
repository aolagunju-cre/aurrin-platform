'use client';

import { useEffect, useMemo, useState } from 'react';

interface SponsorCardData {
  id: string;
  name: string;
  logo: string | null;
  link: string | null;
  tier: 'bronze' | 'silver' | 'gold';
}

interface SponsorResponse {
  success?: boolean;
  data?: SponsorCardData[];
  message?: string;
}

function SponsorCard({ sponsor }: { sponsor: SponsorCardData }) {
  const cardContent = (
    <>
      {sponsor.logo ? (
        <img
          src={sponsor.logo}
          alt={`${sponsor.name} logo`}
          style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 8 }}
        />
      ) : null}
      <div>
        <strong>{sponsor.name}</strong>
      </div>
      <small>{sponsor.tier} sponsor</small>
    </>
  );

  if (!sponsor.link) {
    return <article style={{ display: 'grid', gap: '0.25rem' }}>{cardContent}</article>;
  }

  return (
    <article style={{ display: 'grid', gap: '0.25rem' }}>
      <a href={sponsor.link} target="_blank" rel="noreferrer">
        {cardContent}
      </a>
    </article>
  );
}

export function SponsorPlacementSection({ eventId }: { eventId?: string }) {
  const [sponsors, setSponsors] = useState<SponsorCardData[]>([]);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    if (!eventId) {
      return '/api/public/sponsors';
    }

    return `/api/public/sponsors?event_id=${encodeURIComponent(eventId)}`;
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSponsors(): Promise<void> {
      try {
        const response = await fetch(endpoint);
        const payload = await response.json() as SponsorResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.message ?? 'Unable to load sponsors');
        }

        if (!cancelled) {
          setSponsors(payload.data ?? []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load sponsors');
          setSponsors([]);
        }
      }
    }

    void loadSponsors();

    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  if (error) {
    return <p role="alert">{error}</p>;
  }

  if (sponsors.length === 0) {
    return null;
  }

  return (
    <section aria-label={eventId ? 'Event Sponsors' : 'Site Sponsors'} style={{ display: 'grid', gap: '0.75rem' }}>
      <h2 style={{ margin: 0 }}>{eventId ? 'Event Sponsors' : 'Our Sponsors'}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
        {sponsors.map((sponsor) => (
          <SponsorCard key={sponsor.id} sponsor={sponsor} />
        ))}
      </div>
    </section>
  );
}
