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

const TIER_BADGE_CLASSES: Record<SponsorCardData['tier'], string> = {
  gold: 'bg-yellow-500/10 text-yellow-400',
  silver: 'bg-gray-400/10 text-gray-400',
  bronze: 'bg-orange-500/10 text-orange-400',
};

function SponsorCard({ sponsor }: { sponsor: SponsorCardData }) {
  const cardContent = (
    <div className="flex flex-col items-center gap-3 text-center">
      {sponsor.logo ? (
        <img
          src={sponsor.logo}
          alt={`${sponsor.name} logo`}
          className="w-14 h-14 object-contain rounded-lg"
        />
      ) : null}
      <div>
        <strong className="text-foreground">{sponsor.name}</strong>
      </div>
      <span
        className={`inline-block px-3 py-1 rounded-full text-xs font-medium capitalize ${TIER_BADGE_CLASSES[sponsor.tier]}`}
      >
        {sponsor.tier} sponsor
      </span>
    </div>
  );

  const wrapperClasses =
    'rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-6 transition-all duration-300 hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10';

  if (!sponsor.link) {
    return <article className={wrapperClasses}>{cardContent}</article>;
  }

  return (
    <article className={wrapperClasses}>
      <a
        href={sponsor.link}
        target="_blank"
        rel="noreferrer"
        className="block no-underline"
      >
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
    return <p role="alert" className="text-danger text-sm">{error}</p>;
  }

  if (sponsors.length === 0) {
    return null;
  }

  return (
    <section aria-label={eventId ? 'Event Sponsors' : 'Site Sponsors'} className="grid gap-4">
      <h2 className="text-xl font-semibold text-foreground">
        {eventId ? 'Event Sponsors' : 'Our Sponsors'}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sponsors.map((sponsor) => (
          <SponsorCard key={sponsor.id} sponsor={sponsor} />
        ))}
      </div>
    </section>
  );
}
