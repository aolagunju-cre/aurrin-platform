import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/auth/admin';
import { auditLog } from '../../../../../../lib/audit/log';
import { getSupabaseClient } from '../../../../../../lib/db/client';
import { sendEmail } from '../../../../../../lib/email/send';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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

  try {
    await sendEmail(applicationResult.data.email, 'founder_approved', {
      name: applicationResult.data.full_name || applicationResult.data.name,
      company: applicationResult.data.company_name,
      link: `/public/apply/status?email=${encodeURIComponent(applicationResult.data.email)}`,
      email: applicationResult.data.email,
      next_steps: 'Confirm your email before accessing the founder platform.',
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Could not enqueue confirmation email.' }, { status: 500 });
  }

  await auditLog(
    'founder_confirmation_enqueued',
    authResult.userId,
    {
      resource_type: 'founder_application',
      resource_id: id,
      changes: {
        email: applicationResult.data.email,
      },
    },
    { request_id: request.headers.get('x-request-id') ?? undefined }
  );

  return NextResponse.json(
    {
      success: true,
      message: 'Confirmation email job enqueued.',
      data: {
        id: applicationResult.data.id,
        email: applicationResult.data.email,
      },
    },
    { status: 202 }
  );
}
