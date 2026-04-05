import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth/admin';
import { getSupabaseClient } from '../../../../../lib/db/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type FounderStatus = 'pending' | 'accepted' | 'assigned' | 'declined';

function toUiStatus(status: FounderStatus): 'Pending' | 'Accepted' | 'Assigned' | 'Declined' {
  if (status === 'accepted') return 'Accepted';
  if (status === 'assigned') return 'Assigned';
  if (status === 'declined') return 'Declined';
  return 'Pending';
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await params;
  const client = getSupabaseClient();
  const applicationResult = await client.db.getFounderApplicationById(id);

  if (applicationResult.error) {
    return NextResponse.json({ success: false, message: applicationResult.error.message }, { status: 500 });
  }

  if (!applicationResult.data) {
    return NextResponse.json({ success: false, message: 'Founder application not found.' }, { status: 404 });
  }

  const eventsResult = await client.db.listEvents();
  if (eventsResult.error) {
    return NextResponse.json({ success: false, message: eventsResult.error.message }, { status: 500 });
  }

  const appData = applicationResult.data.application_data ?? {};

  return NextResponse.json(
    {
      success: true,
      data: {
        id: applicationResult.data.id,
        name: applicationResult.data.full_name || applicationResult.data.name,
        email: applicationResult.data.email,
        company_name: applicationResult.data.company_name,
        pitch_summary: applicationResult.data.pitch_summary,
        industry: applicationResult.data.industry,
        stage: applicationResult.data.stage,
        website: applicationResult.data.website,
        twitter: applicationResult.data.twitter,
        linkedin: applicationResult.data.linkedin,
        phone: applicationResult.data.phone ?? null,
        etransfer_email: applicationResult.data.etransfer_email ?? null,
        status: toUiStatus(applicationResult.data.status),
        status_value: applicationResult.data.status,
        assigned_event_id: applicationResult.data.assigned_event_id,
        submission_date: applicationResult.data.created_at,
        submitted_form_data: appData,
        submitted_scores: (appData.scores as Record<string, unknown> | null | undefined) ?? null,
        validation_results: (appData.validation_results as Record<string, unknown> | null | undefined) ?? null,
        events: eventsResult.data.map((event) => ({ id: event.id, name: event.name, status: event.status })),
      },
    },
    { status: 200 }
  );
}
