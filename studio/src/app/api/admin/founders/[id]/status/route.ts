import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/auth/admin';
import { auditLog } from '../../../../../../lib/audit/log';
import { getSupabaseClient } from '../../../../../../lib/db/client';
import { sendEmail } from '../../../../../../lib/email/send';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type FounderStatus = 'pending' | 'accepted' | 'assigned' | 'declined';

interface StatusPayload {
  status?: FounderStatus;
  assigned_event_id?: string | null;
}

function isAllowedTransition(currentStatus: FounderStatus, nextStatus: FounderStatus): boolean {
  const allowed: Record<FounderStatus, FounderStatus[]> = {
    pending: ['accepted', 'declined'],
    accepted: ['assigned', 'declined'],
    assigned: ['declined'],
    declined: [],
  };

  return allowed[currentStatus].includes(nextStatus);
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  let body: StatusPayload;
  try {
    body = await request.json() as StatusPayload;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.status || !['pending', 'accepted', 'assigned', 'declined'].includes(body.status)) {
    return NextResponse.json(
      { success: false, message: 'status must be one of: pending, accepted, assigned, declined.' },
      { status: 400 }
    );
  }

  if (body.status === 'assigned' && !body.assigned_event_id) {
    return NextResponse.json(
      { success: false, message: 'assigned_event_id is required when status=assigned.' },
      { status: 400 }
    );
  }

  const { id } = await params;
  const client = getSupabaseClient();

  const currentResult = await client.db.getFounderApplicationById(id);
  if (currentResult.error) {
    return NextResponse.json({ success: false, message: currentResult.error.message }, { status: 500 });
  }

  if (!currentResult.data) {
    return NextResponse.json({ success: false, message: 'Founder application not found.' }, { status: 404 });
  }

  if (!isAllowedTransition(currentResult.data.status, body.status)) {
    return NextResponse.json(
      {
        success: false,
        message: `Cannot transition application from ${currentResult.data.status} to ${body.status}.`,
      },
      { status: 409 }
    );
  }

  if (body.status === 'accepted') {
    const existingUserResult = await client.db.getUserByEmail(currentResult.data.email);
    if (existingUserResult.error) {
      return NextResponse.json({ success: false, message: 'Could not load founder user account.' }, { status: 500 });
    }

    const insertUserResult = existingUserResult.data
      ? null
      : await client.db.insertUser({
          email: currentResult.data.email,
          name: currentResult.data.full_name || currentResult.data.name,
        });

    if (insertUserResult?.error) {
      return NextResponse.json({ success: false, message: 'Could not create founder user account.' }, { status: 500 });
    }

    const founderUser = existingUserResult.data ?? insertUserResult?.data ?? null;
    if (!founderUser) {
      return NextResponse.json({ success: false, message: 'Could not resolve founder user account.' }, { status: 500 });
    }

    const existingFounderResult = await client.db.getFounderByUserId(founderUser.id);
    if (existingFounderResult.error) {
      return NextResponse.json({ success: false, message: 'Could not load founder profile.' }, { status: 500 });
    }

    if (!existingFounderResult.data) {
      const founderInsertResult = await client.db.insertFounder({
        user_id: founderUser.id,
        company_name: currentResult.data.company_name,
        website: currentResult.data.website,
      });
      if (founderInsertResult.error || !founderInsertResult.data) {
        return NextResponse.json({ success: false, message: 'Could not create founder profile.' }, { status: 500 });
      }
    }

    try {
      await sendEmail(currentResult.data.email, 'founder_approved', {
        name: currentResult.data.full_name || currentResult.data.name,
        company: currentResult.data.company_name,
        link: `/public/apply/status?email=${encodeURIComponent(currentResult.data.email)}`,
        email: currentResult.data.email,
        next_steps: 'Confirm your email before accessing the founder platform.',
      });
    } catch {
      return NextResponse.json({ success: false, message: 'Could not enqueue confirmation email.' }, { status: 500 });
    }
  }

  const updateResult = await client.db.updateFounderApplication(id, {
    status: body.status,
    reviewed_at: new Date().toISOString(),
    reviewed_by: authResult.userId,
    assigned_event_id: body.status === 'assigned' ? body.assigned_event_id ?? null : null,
  });

  if (updateResult.error || !updateResult.data) {
    return NextResponse.json(
      { success: false, message: updateResult.error?.message || 'Could not update founder status.' },
      { status: 500 }
    );
  }

  await auditLog(
    'founder_status_updated',
    authResult.userId,
    {
      resource_type: 'founder_application',
      resource_id: id,
      changes: {
        before: {
          status: currentResult.data.status,
          assigned_event_id: currentResult.data.assigned_event_id,
        },
        after: {
          status: updateResult.data.status,
          assigned_event_id: updateResult.data.assigned_event_id,
        },
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json(
    {
      success: true,
      data: {
        id: updateResult.data.id,
        status: updateResult.data.status,
        assigned_event_id: updateResult.data.assigned_event_id,
      },
    },
    { status: 200 }
  );
}
