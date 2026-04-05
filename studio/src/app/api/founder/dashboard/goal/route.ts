import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE } from '@/src/lib/demo/data';
import { requireFounderOrAdmin } from '../../../../../lib/auth/founder';
import { getSupabaseClient } from '../../../../../lib/db/client';

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (DEMO_MODE) {
    return NextResponse.json({ success: true, data: { funding_goal_cents: null } }, { status: 200 });
  }

  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (!authResult.isFounder) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const client = getSupabaseClient();
  const userResult = await client.db.getUserById(authResult.userId);
  if (userResult.error || !userResult.data) {
    return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
  }

  const appResult = await client.db.getFounderApplicationByEmail(userResult.data.email);
  if (appResult.error) {
    return NextResponse.json({ success: false, message: appResult.error.message }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, data: { funding_goal_cents: appResult.data?.funding_goal_cents ?? null } },
    { status: 200 }
  );
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  if (DEMO_MODE) {
    return NextResponse.json({ success: true, data: { funding_goal_cents: null } }, { status: 200 });
  }

  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (!authResult.isFounder) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const raw = body.funding_goal_cents;
  if (raw !== null && raw !== undefined && typeof raw !== 'number') {
    return NextResponse.json(
      { success: false, message: 'funding_goal_cents must be a positive integer or null.' },
      { status: 400 }
    );
  }

  const fundingGoalCents = typeof raw === 'number' ? Math.max(0, Math.round(raw)) : null;

  const client = getSupabaseClient();
  const userResult = await client.db.getUserById(authResult.userId);
  if (userResult.error || !userResult.data) {
    return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
  }

  const appResult = await client.db.getFounderApplicationByEmail(userResult.data.email);
  if (appResult.error) {
    return NextResponse.json({ success: false, message: appResult.error.message }, { status: 500 });
  }
  if (!appResult.data) {
    return NextResponse.json({ success: false, message: 'Founder application not found.' }, { status: 404 });
  }

  const updateResult = await client.db.updateFounderApplication(appResult.data.id, {
    funding_goal_cents: fundingGoalCents,
  });
  if (updateResult.error) {
    return NextResponse.json({ success: false, message: updateResult.error.message }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, data: { funding_goal_cents: updateResult.data?.funding_goal_cents ?? fundingGoalCents } },
    { status: 200 }
  );
}
