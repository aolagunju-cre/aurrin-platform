import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth/admin';
import { auditLog } from '../../../../../lib/audit/log';
import { SponsorScope, SponsorTier, getSupabaseClient } from '../../../../../lib/db/client';
import { getDefaultPricingForTier } from '../../../../../lib/sponsors/tier-config';

interface RouteParams {
  params: Promise<{ sponsorId: string }>;
}

interface UpdateSponsorPayload {
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

async function validateEventIfNeeded(scope: SponsorScope, eventId: string | null): Promise<{ valid: boolean; message?: string }> {
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

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { sponsorId } = await params;
  const client = getSupabaseClient();
  const existingResult = await client.db.getSponsorById(sponsorId);

  if (existingResult.error) {
    return NextResponse.json({ success: false, message: existingResult.error.message }, { status: 500 });
  }

  if (!existingResult.data) {
    return NextResponse.json({ success: false, message: 'Sponsor not found.' }, { status: 404 });
  }

  let body: UpdateSponsorPayload;
  try {
    body = await request.json() as UpdateSponsorPayload;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ success: false, message: 'name cannot be empty.' }, { status: 400 });
  }
  if (body.tier !== undefined && !isSponsorTier(body.tier)) {
    return NextResponse.json({ success: false, message: 'tier must be one of: bronze, silver, gold.' }, { status: 400 });
  }
  if (body.scope !== undefined && !isSponsorScope(body.scope)) {
    return NextResponse.json({ success: false, message: 'scope must be one of: event, site-wide.' }, { status: 400 });
  }
  if (body.end_date !== undefined && Number.isNaN(Date.parse(body.end_date))) {
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

  const effectiveScope = (body.scope ?? existingResult.data.placement_scope) as SponsorScope;
  const effectiveEvent = effectiveScope === 'event'
    ? (body.event !== undefined ? body.event : existingResult.data.event_id)
    : null;
  const scopeValidation = await validateEventIfNeeded(effectiveScope, effectiveEvent ?? null);
  if (!scopeValidation.valid) {
    return NextResponse.json({ success: false, message: scopeValidation.message }, { status: 400 });
  }

  const effectiveTier = (body.tier ?? existingResult.data.tier) as SponsorTier;
  const updateResult = await client.db.updateSponsor(sponsorId, {
    name: body.name?.trim(),
    logo_url: body.logo,
    website_url: body.website,
    tier: body.tier as SponsorTier | undefined,
    placement_scope: body.scope as SponsorScope | undefined,
    event_id: effectiveScope === 'event' ? (effectiveEvent ?? null) : null,
    end_date: body.end_date !== undefined ? new Date(body.end_date).toISOString() : undefined,
    pricing_cents: body.pricing ?? (body.tier ? getDefaultPricingForTier(effectiveTier) : undefined),
    status: body.status as 'active' | 'inactive' | undefined,
  });

  if (updateResult.error || !updateResult.data) {
    return NextResponse.json({ success: false, message: updateResult.error?.message || 'Failed to update sponsor.' }, { status: 500 });
  }

  await auditLog(
    'sponsor_updated',
    authResult.userId,
    {
      resource_type: 'sponsor',
      resource_id: sponsorId,
      changes: {
        before: existingResult.data,
        after: updateResult.data,
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json({ success: true, data: toResponseRecord(updateResult.data) }, { status: 200 });
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { sponsorId } = await params;
  const client = getSupabaseClient();
  const existingResult = await client.db.getSponsorById(sponsorId);
  if (existingResult.error) {
    return NextResponse.json({ success: false, message: existingResult.error.message }, { status: 500 });
  }
  if (!existingResult.data) {
    return NextResponse.json({ success: false, message: 'Sponsor not found.' }, { status: 404 });
  }

  const deleteResult = await client.db.deleteSponsor(sponsorId);
  if (deleteResult.error) {
    return NextResponse.json({ success: false, message: deleteResult.error.message }, { status: 500 });
  }

  await auditLog(
    'sponsor_removed',
    authResult.userId,
    {
      resource_type: 'sponsor',
      resource_id: sponsorId,
      changes: {
        before: existingResult.data,
        after: null,
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json({ success: true }, { status: 200 });
}
