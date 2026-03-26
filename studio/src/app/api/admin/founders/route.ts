import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth/admin';
import { getSupabaseClient } from '../../../../lib/db/client';

interface FounderListRow {
  id: string;
  email: string;
  name: string;
  full_name: string | null;
  status: 'pending' | 'accepted' | 'assigned' | 'declined';
  assigned_event_id: string | null;
  created_at: string;
}

type FounderStatus = FounderListRow['status'];

function toUiStatus(status: FounderStatus): 'Pending' | 'Accepted' | 'Assigned' | 'Declined' {
  if (status === 'accepted') return 'Accepted';
  if (status === 'assigned') return 'Assigned';
  if (status === 'declined') return 'Declined';
  return 'Pending';
}

const validStatuses: FounderStatus[] = ['pending', 'accepted', 'assigned', 'declined'];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const statusFilter = request.nextUrl.searchParams.get('status');
  if (statusFilter && !validStatuses.includes(statusFilter as FounderStatus)) {
    return NextResponse.json(
      { success: false, message: 'status must be one of: pending, accepted, assigned, declined.' },
      { status: 400 }
    );
  }

  const client = getSupabaseClient();
  const statusQuery = statusFilter ? `&status=eq.${statusFilter}` : '';
  const foundersResult = await client.db.queryTable<FounderListRow>(
    'founder_applications',
    `select=id,email,name,full_name,status,assigned_event_id,created_at&order=created_at.desc${statusQuery}`
  );

  if (foundersResult.error) {
    return NextResponse.json({ success: false, message: foundersResult.error.message }, { status: 500 });
  }

  const eventsResult = await client.db.listEvents();
  if (eventsResult.error) {
    return NextResponse.json({ success: false, message: eventsResult.error.message }, { status: 500 });
  }

  const eventNameById = new Map(eventsResult.data.map((event) => [event.id, event.name]));

  return NextResponse.json(
    {
      success: true,
      data: foundersResult.data.map((founder) => ({
        id: founder.id,
        name: founder.full_name || founder.name,
        email: founder.email,
        application_status: toUiStatus(founder.status),
        application_status_value: founder.status,
        assigned_event: founder.assigned_event_id ? (eventNameById.get(founder.assigned_event_id) ?? founder.assigned_event_id) : null,
        assigned_event_id: founder.assigned_event_id,
        submission_date: founder.created_at,
      })),
    },
    { status: 200 }
  );
}
