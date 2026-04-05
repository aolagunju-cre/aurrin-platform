import { NextResponse } from 'next/server';
import { getPublicFounderProfileBySlug } from '@/src/lib/founders/public-profile';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { slug } = await params;
  const result = await getPublicFounderProfileBySlug(slug);

  if (result.error) {
    return NextResponse.json({ success: false, message: result.error.message }, { status: 500 });
  }

  if (!result.data) {
    return NextResponse.json({ success: false, message: 'Founder profile not found.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 200 });
}
