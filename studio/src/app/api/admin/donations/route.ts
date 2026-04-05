import { NextRequest, NextResponse } from 'next/server';
import { DEMO_MODE } from '@/src/lib/demo/data';
import { requireAdmin } from '../../../../lib/auth/admin';
import { getSupabaseClient } from '../../../../lib/db/client';
import type { AdminDonationRecord } from '../../../../lib/db/client';

const DEMO_DONATIONS: AdminDonationRecord[] = [
  {
    id: 'demo-admin-donation-1',
    founder_id: 'demo-founder-1',
    donor_email: 'alice@example.com',
    donor_user_id: null,
    tier_id: 'demo-tier-1',
    amount_cents: 10000,
    stripe_payment_intent_id: 'pi_demo_admin_1',
    status: 'completed',
    created_at: '2026-03-20T10:00:00.000Z',
    tier_label: 'Gold Sponsor',
    founder_company_name: 'Acme Corp',
  },
  {
    id: 'demo-admin-donation-2',
    founder_id: 'demo-founder-2',
    donor_email: null,
    donor_user_id: null,
    tier_id: null,
    amount_cents: 2500,
    stripe_payment_intent_id: 'pi_demo_admin_2',
    status: 'completed',
    created_at: '2026-03-15T08:30:00.000Z',
    tier_label: null,
    founder_company_name: 'Beta Startup',
  },
  {
    id: 'demo-admin-donation-3',
    founder_id: 'demo-founder-1',
    donor_email: 'bob@example.com',
    donor_user_id: 'demo-user-bob',
    tier_id: 'demo-tier-2',
    amount_cents: 5000,
    stripe_payment_intent_id: 'pi_demo_admin_3',
    status: 'completed',
    created_at: '2026-03-10T14:00:00.000Z',
    tier_label: 'Silver Supporter',
    founder_company_name: 'Acme Corp',
  },
];

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (DEMO_MODE) {
    return NextResponse.json({ success: true, data: DEMO_DONATIONS }, { status: 200 });
  }

  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const client = getSupabaseClient();
  const result = await client.db.listAllDonations();
  if (result.error) {
    return NextResponse.json({ success: false, message: 'Failed to load donations.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 200 });
}
