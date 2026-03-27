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
      <main className="container mx-auto max-w-3xl px-6 py-8">
        <p role="alert" className="py-12 text-center text-default-400">Unable to load founder profile.</p>
      </main>
    );
  }

  const founder = founderResult.data[0] ?? null;
  if (!founder) {
    return (
      <main className="container mx-auto max-w-3xl px-6 py-8">
        <p role="alert" className="py-12 text-center text-default-400">Founder profile not found.</p>
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
    <main className="container mx-auto max-w-3xl px-6 py-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{founder.company_name ?? 'Founder Profile'}</h1>
      <p className="text-lg text-default-500">
        {founder.user?.name ? `${founder.user.name} · ` : ''}
        {founder.tagline ?? 'Startup founder'}
      </p>
      {founder.bio ? <p className="text-default-500">{founder.bio}</p> : null}
      {founder.website ? (
        <p className="text-default-500">
          Website: <a href={founder.website} className="text-violet-400 hover:text-violet-300 transition-colors">{founder.website}</a>
        </p>
      ) : null}

      <section aria-label="Founder Highlights" className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6">
        <h2 className="text-xl font-semibold text-foreground mb-3">Highlights</h2>
        {highlights.length === 0 ? (
          <p className="text-default-400">No published highlights available yet.</p>
        ) : (
          <ul className="list-disc pl-5 space-y-3 text-default-500">
            {highlights.map((highlight) => (
              <li key={highlight.id}>
                <p className="font-medium text-foreground">
                  <strong>{highlight.event_name}</strong> · Published {toDisplayDate(highlight.published_at)}
                </p>
                <p className="text-default-500">Aggregate score: {highlight.score_aggregate ?? 'N/A'}</p>
                {highlight.score_breakdown.length > 0 ? (
                  <p className="text-default-500">
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
