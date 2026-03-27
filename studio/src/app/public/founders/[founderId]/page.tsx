import { getSupabaseClient } from '../../../../lib/db/client';

interface PublicFounderPageProps {
  params: Promise<{ founderId: string }>;
}

interface FounderRow {
  id: string;
  company_name: string | null;
  tagline: string | null;
  bio: string | null;
  website: string | null;
  user: {
    name: string | null;
  } | null;
}

interface FounderPitchHighlightRow {
  id: string;
  score_aggregate: number | null;
  score_breakdown: Record<string, unknown> | null;
  is_published: boolean;
  published_at: string | null;
  event: {
    id: string;
    name: string;
    publishing_start: string | null;
  } | null;
}

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function isPublishedForPublicView(pitch: FounderPitchHighlightRow, now: Date): boolean {
  if (pitch.is_published) {
    return true;
  }
  const publishingStart = parseDate(pitch.event?.publishing_start ?? null);
  return publishingStart ? now >= publishingStart : false;
}

function toDisplayDate(value: string | null): string {
  const parsed = parseDate(value);
  return parsed ? parsed.toLocaleDateString() : 'Date unavailable';
}

export default async function PublicFounderPage({ params }: PublicFounderPageProps) {
  const { founderId } = await params;
  const client = getSupabaseClient();

  const founderResult = await client.db.queryTable<FounderRow>(
    'founders',
    `id=eq.${encodeURIComponent(founderId)}&select=id,company_name,tagline,bio,website,user:users!founders_user_id_fkey(name)&limit=1`
  );
  if (founderResult.error) {
    return (
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1rem' }}>
        <p role="alert">Unable to load founder profile.</p>
      </main>
    );
  }

  const founder = founderResult.data[0] ?? null;
  if (!founder) {
    return (
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1rem' }}>
        <p role="alert">Founder profile not found.</p>
      </main>
    );
  }

  const pitchResult = await client.db.queryTable<FounderPitchHighlightRow>(
    'founder_pitches',
    `founder_id=eq.${encodeURIComponent(founderId)}&select=id,score_aggregate,score_breakdown,is_published,published_at,event:events!founder_pitches_event_id_fkey(id,name,publishing_start)&order=published_at.desc.nullslast,updated_at.desc&limit=20`
  );

  const now = new Date();
  const highlights = (pitchResult.data ?? [])
    .filter((pitch) => pitch.event && isPublishedForPublicView(pitch, now))
    .map((pitch) => ({
      id: pitch.id,
      event_name: pitch.event?.name ?? 'Unknown event',
      published_at: pitch.published_at,
      score_aggregate: pitch.score_aggregate,
      score_breakdown: Object.entries(pitch.score_breakdown ?? {}).filter(
        (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1])
      ),
    }));

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1rem', display: 'grid', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>{founder.company_name ?? 'Founder Profile'}</h1>
      <p style={{ margin: 0 }}>
        {founder.user?.name ? `${founder.user.name} · ` : ''}
        {founder.tagline ?? 'Startup founder'}
      </p>
      {founder.bio ? <p style={{ margin: 0 }}>{founder.bio}</p> : null}
      {founder.website ? (
        <p style={{ margin: 0 }}>
          Website: <a href={founder.website}>{founder.website}</a>
        </p>
      ) : null}

      <section aria-label="Founder Highlights" style={{ border: '1px solid #e3e3e3', padding: '0.75rem' }}>
        <h2 style={{ marginTop: 0 }}>Highlights</h2>
        {highlights.length === 0 ? (
          <p style={{ margin: 0 }}>No published highlights available yet.</p>
        ) : (
          <ul style={{ margin: 0, paddingInlineStart: '1.2rem', display: 'grid', gap: '0.75rem' }}>
            {highlights.map((highlight) => (
              <li key={highlight.id}>
                <p style={{ margin: 0 }}>
                  <strong>{highlight.event_name}</strong> · Published {toDisplayDate(highlight.published_at)}
                </p>
                <p style={{ margin: 0 }}>Aggregate score: {highlight.score_aggregate ?? 'N/A'}</p>
                {highlight.score_breakdown.length > 0 ? (
                  <p style={{ margin: 0 }}>
                    Breakdown: {highlight.score_breakdown.map(([label, value]) => `${label}: ${value}`).join(', ')}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
