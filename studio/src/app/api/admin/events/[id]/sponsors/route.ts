import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/auth/admin';
import { auditLog } from '../../../../../../lib/audit/log';
import { SponsorTier, getSupabaseClient } from '../../../../../../lib/db/client';
import { getDefaultPricingForTier } from '../../../../../../lib/sponsors/tier-config';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface CreateEventSponsorPayload {
  name?: string;
  logo?: string | null;
  website?: string | null;
  tier?: string;
  scope?: string;
  end_date?: string;
  pricing?: number;
  status?: string;
}

function isSponsorTier(value: unknown): value is SponsorTier {
  return value === 'bronze' || value === 'silver' || value === 'gold';
}

function isSponsorStatus(value: unknown): value is 'active' | 'inactive' {
  return value === 'active' || value === 'inactive';
}

function isSponsorScope(value: unknown): value is 'event' | 'site-wide' {
  return value === 'event' || value === 'site-wide';
}

function toResponseRecord(record: {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  tier: SponsorTier;
  placement_scope: 'event' | 'site-wide';
  event_id: string | null;
  end_date: string | null;
  pricing_cents: number;
  status: 'active' | 'inactive';
  display_priority: number;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: record.id,
    name: record.name,
    logo: record.logo_url,
    website: record.website_url,
    tier: record.tier,
    scope: record.placement_scope,
    event: record.event_id,
    end_date: record.end_date,
    pricing: record.pricing_cents,
    status: record.status,
    display_priority: record.display_priority,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await params;
  const client = getSupabaseClient();
  const eventResult = await client.db.getEventById(id);
  if (eventResult.error) {
    return NextResponse.json({ success: false, message: eventResult.error.message }, { status: 500 });
  }
  if (!eventResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  const sponsorsResult = await client.db.listSponsors();
  if (sponsorsResult.error) {
    return NextResponse.json({ success: false, message: sponsorsResult.error.message }, { status: 500 });
  }

  const scopedSponsors = sponsorsResult.data.filter(
    (record) => record.placement_scope === 'site-wide' || record.event_id === id
  );

  return NextResponse.json(
    {
      success: true,
      data: scopedSponsors.map(toResponseRecord),
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await params;

  let body: CreateEventSponsorPayload;
  try {
    body = await request.json() as CreateEventSponsorPayload;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ success: false, message: 'name is required.' }, { status: 400 });
  }
  if (!isSponsorTier(body.tier)) {
    return NextResponse.json({ success: false, message: 'tier must be one of: bronze, silver, gold.' }, { status: 400 });
  }
  if (body.scope !== undefined && !isSponsorScope(body.scope)) {
    return NextResponse.json({ success: false, message: 'scope must be one of: event, site-wide.' }, { status: 400 });
  }
  if (!body.end_date || Number.isNaN(Date.parse(body.end_date))) {
    return NextResponse.json({ success: false, message: 'end_date must be a valid ISO date string.' }, { status: 400 });
  }
  if (body.pricing !== undefined && (!Number.isInteger(body.pricing) || body.pricing < 0)) {
    return NextResponse.json({ success: false, message: 'pricing must be a non-negative integer amount in cents.' }, { status: 400 });
  }
  if (body.status !== undefined && !isSponsorStatus(body.status)) {
    return NextResponse.json({ success: false, message: 'status must be one of: active, inactive.' }, { status: 400 });
  }

  const client = getSupabaseClient();
  const eventResult = await client.db.getEventById(id);
  if (eventResult.error) {
    return NextResponse.json({ success: false, message: eventResult.error.message }, { status: 500 });
  }
  if (!eventResult.data) {
    return NextResponse.json({ success: false, message: 'Event not found.' }, { status: 404 });
  }

  const insertResult = await client.db.insertSponsor({
    name: body.name.trim(),
    logo_url: body.logo ?? null,
    website_url: body.website ?? null,
    tier: body.tier,
    placement_scope: body.scope ?? 'event',
    event_id: body.scope === 'site-wide' ? null : id,
    end_date: new Date(body.end_date).toISOString(),
    pricing_cents: body.pricing ?? getDefaultPricingForTier(body.tier),
    status: body.status ?? 'active',
  });
  if (insertResult.error || !insertResult.data) {
    return NextResponse.json(
      { success: false, message: insertResult.error?.message ?? 'Failed to create sponsor.' },
      { status: 500 }
    );
  }

  await auditLog(
    'sponsor_added',
    authResult.userId,
    {
      resource_type: 'sponsor',
      resource_id: insertResult.data.id,
      changes: {
        before: null,
        after: insertResult.data,
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json({ success: true, data: toResponseRecord(insertResult.data) }, { status: 201 });
}
