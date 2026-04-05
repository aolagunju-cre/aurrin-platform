import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE } from '@/src/lib/demo/data';
import { requireFounderOrAdmin } from '../../../../lib/auth/founder';
import { getSupabaseClient } from '../../../../lib/db/client';
import type { DonationWithTierRecord } from '../../../../lib/db/client';

const DEMO_DONORS: DonationWithTierRecord[] = [
  {
    id: 'demo-donation-1',
    founder_id: 'demo-founder-1',
    donor_email: 'alice@example.com',
    donor_user_id: null,
    tier_id: 'demo-tier-1',
    amount_cents: 1000,
    stripe_payment_intent_id: 'pi_demo_1',
    status: 'completed',
    created_at: '2026-01-15T10:00:00.000Z',
    tier_label: 'Bronze Supporter',
  },
  {
    id: 'demo-donation-2',
    founder_id: 'demo-founder-1',
    donor_email: null,
    donor_user_id: null,
    tier_id: null,
    amount_cents: 2500,
    stripe_payment_intent_id: 'pi_demo_2',
    status: 'completed',
    created_at: '2026-01-10T08:30:00.000Z',
    tier_label: null,
  },
];

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (DEMO_MODE) {
    return NextResponse.json({ success: true, data: DEMO_DONORS }, { status: 200 });
  }

  const authResult = await requireFounderOrAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  if (!authResult.isFounder) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const client = getSupabaseClient();
  const result = await client.db.listDonationsByFounderId(authResult.userId);
  if (result.error) {
    return NextResponse.json({ success: false, message: 'Failed to load donors.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 200 });
}
