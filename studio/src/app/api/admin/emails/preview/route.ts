import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth/admin';
import { isEmailTemplateName, renderEmailTemplate } from '../../../../../lib/email/templates';
import type { EmailTemplateData } from '../../../../../lib/email/templates';

function badRequest(message: string): NextResponse {
  return NextResponse.json({ success: false, message }, { status: 400 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const templateName = request.nextUrl.searchParams.get('template')?.trim() ?? '';
  if (!templateName) {
    return badRequest('Query parameter "template" is required.');
  }

  if (!isEmailTemplateName(templateName)) {
    return NextResponse.json({ success: false, message: `Unknown email template: ${templateName}` }, { status: 404 });
  }

  const rawData = request.nextUrl.searchParams.get('data');
  let data: EmailTemplateData = {};

  if (rawData !== null) {
    try {
      const parsed = JSON.parse(rawData) as unknown;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        return badRequest('Query parameter "data" must be a JSON object.');
      }
      data = parsed as EmailTemplateData;
    } catch {
      return badRequest('Query parameter "data" must be valid JSON.');
    }
  }

  const renderedTemplate = renderEmailTemplate(templateName, data);
  return new NextResponse(renderedTemplate.html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
