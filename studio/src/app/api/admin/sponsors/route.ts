import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE, demoSponsors } from '@/src/lib/demo/data';
import { requireAdmin } from '../../../../lib/auth/admin';
import { auditLog } from '../../../../lib/audit/log';
import { SponsorScope, SponsorTier, getSupabaseClient } from '../../../../lib/db/client';
import { getDefaultPricingForTier, getSponsorTierConfig } from '../../../../lib/sponsors/tier-config';

interface CreateSponsorPayload {
  name?: string;
  logo?: string | null;
  website?: string | null;
  tier?: string;
  scope?: string;
  event?: string | null;
  end_date?: string;
  pricing?: number;
  status?: string;
}

function isSponsorTier(value: unknown): value is SponsorTier {
  return value === 'bronze' || value === 'silver' || value === 'gold';
}

function isSponsorScope(value: unknown): value is SponsorScope {
  return value === 'event' || value === 'site-wide';
}

function isSponsorStatus(value: unknown): value is 'active' | 'inactive' {
  return value === 'active' || value === 'inactive';
}

function toResponseRecord(record: {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  tier: SponsorTier;
  placement_scope: SponsorScope;
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

async function validateEventScope(scope: SponsorScope, eventId: string | null): Promise<{ valid: boolean; message?: string }> {
  if (scope === 'site-wide') {
    return { valid: true };
  }

  if (!eventId) {
    return { valid: false, message: 'event is required when scope is event.' };
  }

  const eventResult = await getSupabaseClient().db.getEventById(eventId);
  if (eventResult.error) {
    return { valid: false, message: eventResult.error.message };
  }

  if (!eventResult.data) {
    return { valid: false, message: 'event must reference an existing event ID when scope is event.' };
  }

  return { valid: true };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (DEMO_MODE) {
    return NextResponse.json({ success: true, data: demoSponsors }, { status: 200 });
  }

  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const sponsorsResult = await getSupabaseClient().db.listSponsors();
  if (sponsorsResult.error) {
    return NextResponse.json({ success: false, message: sponsorsResult.error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      data: sponsorsResult.data.map(toResponseRecord),
      tier_config: getSponsorTierConfig(),
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (DEMO_MODE) {
    return NextResponse.json({ success: true, data: { id: 'demo-sponsor-new' } }, { status: 201 });
  }

  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  let body: CreateSponsorPayload;
  try {
    body = await request.json() as CreateSponsorPayload;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ success: false, message: 'name is required.' }, { status: 400 });
  }
  if (!isSponsorTier(body.tier)) {
    return NextResponse.json({ success: false, message: 'tier must be one of: bronze, silver, gold.' }, { status: 400 });
  }
  if (!isSponsorScope(body.scope)) {
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
  if (body.logo !== undefined && body.logo !== null && typeof body.logo !== 'string') {
    return NextResponse.json({ success: false, message: 'logo must be a string URL or null.' }, { status: 400 });
  }
  if (body.website !== undefined && body.website !== null && typeof body.website !== 'string') {
    return NextResponse.json({ success: false, message: 'website must be a string URL or null.' }, { status: 400 });
  }

  const scopeValidation = await validateEventScope(body.scope, body.scope === 'event' ? (body.event ?? null) : null);
  if (!scopeValidation.valid) {
    return NextResponse.json({ success: false, message: scopeValidation.message }, { status: 400 });
  }

  const insertResult = await getSupabaseClient().db.insertSponsor({
    name: body.name.trim(),
    logo_url: body.logo ?? null,
    website_url: body.website ?? null,
    tier: body.tier,
    placement_scope: body.scope,
    event_id: body.scope === 'event' ? (body.event ?? null) : null,
    end_date: new Date(body.end_date).toISOString(),
    pricing_cents: body.pricing ?? getDefaultPricingForTier(body.tier),
    status: body.status ?? 'active',
  });

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json({ success: false, message: insertResult.error?.message || 'Failed to create sponsor.' }, { status: 500 });
  }

  await auditLog(
    'sponsor_created',
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
