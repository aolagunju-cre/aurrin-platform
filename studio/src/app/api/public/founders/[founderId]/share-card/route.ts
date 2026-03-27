import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../../../lib/db/client';
import { listFounderSignedAssetMetadata } from '../../../../../../lib/social-assets/delivery';

interface RouteParams {
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

function toNumericBreakdown(source: Record<string, unknown> | null): Record<string, number> {
  if (!source) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
  );
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { founderId } = await params;
  const client = getSupabaseClient();

  const founderResult = await client.db.queryTable<FounderRow>(
    'founders',
    `id=eq.${encodeURIComponent(founderId)}&select=id,company_name,tagline,bio,website,user:users!founders_user_id_fkey(name)&limit=1`
  );
  if (founderResult.error) {
    return NextResponse.json({ success: false, message: founderResult.error.message }, { status: 500 });
  }

  const founder = founderResult.data[0] ?? null;
  if (!founder) {
    return NextResponse.json({ success: false, message: 'Founder not found.' }, { status: 404 });
  }

  const pitchResult = await client.db.queryTable<FounderPitchHighlightRow>(
    'founder_pitches',
    `founder_id=eq.${encodeURIComponent(founderId)}&select=id,score_aggregate,score_breakdown,is_published,published_at,event:events!founder_pitches_event_id_fkey(id,name,publishing_start)&order=published_at.desc.nullslast,updated_at.desc&limit=20`
  );
  if (pitchResult.error) {
    return NextResponse.json({ success: false, message: pitchResult.error.message }, { status: 500 });
  }

  const now = new Date();
  const highlights = pitchResult.data
    .filter((pitch) => pitch.event && isPublishedForPublicView(pitch, now))
    .map((pitch) => ({
      pitch_id: pitch.id,
      event_id: pitch.event?.id ?? null,
      event_name: pitch.event?.name ?? 'Unknown event',
      published_at: pitch.published_at,
      score_aggregate: pitch.score_aggregate,
      score_breakdown: toNumericBreakdown(pitch.score_breakdown),
    }));

  const assets = await listFounderSignedAssetMetadata(founder.id);

  return NextResponse.json(
    {
      success: true,
      data: {
        founder: {
          id: founder.id,
          founder_name: founder.user?.name ?? null,
          company_name: founder.company_name,
          tagline: founder.tagline,
          bio: founder.bio,
          website: founder.website,
        },
        highlights,
        assets,
      },
    },
    { status: 200 }
  );
}
