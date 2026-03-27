import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '../../../../../../lib/email/send';
import { getSupabaseClient } from '../../../../../../lib/db/client';
import { requireAdmin } from '../../../../../../lib/auth/admin';

type ApplicationStatus = 'accepted' | 'assigned' | 'declined';

function isAllowedTransition(currentStatus: string, nextStatus: ApplicationStatus): boolean {
  const allowed: Record<string, ApplicationStatus[]> = {
    pending: ['accepted', 'declined'],
    accepted: ['assigned', 'declined'],
    assigned: ['declined'],
    declined: [],
  };
  return allowed[currentStatus]?.includes(nextStatus) ?? false;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> }
): Promise<NextResponse> {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) {
    return admin;
  }

  const actorId = admin.userId;

  const client = getSupabaseClient();
  let payload: { status?: ApplicationStatus; assigned_event_id?: string | null };
  try {
    payload = await request.json() as { status?: ApplicationStatus; assigned_event_id?: string | null };
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  if (!payload.status || !['accepted', 'assigned', 'declined'].includes(payload.status)) {
    return NextResponse.json({ success: false, message: 'Invalid status transition request' }, { status: 400 });
  }
  if (payload.status === 'assigned' && !payload.assigned_event_id) {
    return NextResponse.json(
      { success: false, message: 'assigned_event_id is required when status=assigned' },
      { status: 400 }
    );
  }

  const { applicationId } = await context.params;
  const applicationResult = await client.db.getFounderApplicationById(applicationId);
  if (applicationResult.error) {
    return NextResponse.json({ success: false, message: 'Could not load application' }, { status: 500 });
  }
  if (!applicationResult.data) {
    return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
  }
  if (!isAllowedTransition(applicationResult.data.status, payload.status)) {
    return NextResponse.json(
      {
        success: false,
        message: `Cannot transition application from ${applicationResult.data.status} to ${payload.status}`,
      },
      { status: 409 }
    );
  }

  if (payload.status === 'accepted') {
    try {
      const existingUser = await client.db.getUserByEmail(applicationResult.data.email);
      if (existingUser.error) {
        return NextResponse.json({ success: false, message: 'Could not load founder user account' }, { status: 500 });
      }

      const userInsertResult = existingUser.data
        ? null
        : await client.db.insertUser({
            email: applicationResult.data.email,
            name: applicationResult.data.full_name || applicationResult.data.name,
          });
      if (userInsertResult?.error) {
        return NextResponse.json({ success: false, message: 'Could not create founder user account' }, { status: 500 });
      }
      const user = existingUser.data ?? userInsertResult?.data ?? null;
      if (!user) {
        return NextResponse.json({ success: false, message: 'Could not create founder user account' }, { status: 500 });
      }

      const existingFounder = await client.db.getFounderByUserId(user.id);
      if (existingFounder.error) {
        return NextResponse.json({ success: false, message: 'Could not load founder profile' }, { status: 500 });
      }
      if (!existingFounder.data) {
        const founderInsert = await client.db.insertFounder({
          user_id: user.id,
          company_name: applicationResult.data.company_name,
          website: applicationResult.data.website,
        });
        if (founderInsert.error || !founderInsert.data) {
          return NextResponse.json({ success: false, message: 'Could not create founder profile' }, { status: 500 });
        }
      }

      await sendEmail(applicationResult.data.email, 'founder_approved', {
        name: applicationResult.data.full_name || applicationResult.data.name,
        company: applicationResult.data.company_name,
        link: `/public/apply/status?email=${encodeURIComponent(applicationResult.data.email)}`,
        email: applicationResult.data.email,
        next_steps: 'Confirm your email before accessing the founder platform.',
      });
    } catch {
      return NextResponse.json({ success: false, message: 'Could not complete acceptance workflow' }, { status: 500 });
    }
  }

  const now = new Date().toISOString();
  const updateResult = await client.db.updateFounderApplication(applicationId, {
    status: payload.status,
    reviewed_at: now,
    reviewed_by: actorId,
    assigned_event_id: payload.status === 'assigned' ? payload.assigned_event_id ?? null : null,
  });
  if (updateResult.error || !updateResult.data) {
    return NextResponse.json({ success: false, message: 'Could not update application status' }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      message: `Application status updated to ${payload.status}`,
      data: {
        id: updateResult.data.id,
        status: updateResult.data.status,
        assigned_event_id: updateResult.data.assigned_event_id,
      },
    },
    { status: 200 }
  );
}
