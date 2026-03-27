import { NextResponse } from 'next/server';
import { getPublicDirectoryProfile } from '@/src/lib/directory/profile';

interface RouteParams {
  params: Promise<{ founderSlug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { founderSlug } = await params;
  const result = await getPublicDirectoryProfile(founderSlug);
  if (result.error) {
    return NextResponse.json({ success: false, message: result.error.message }, { status: 500 });
  }

  if (!result.data) {
    return NextResponse.json({ success: false, message: 'Founder profile not found.' }, { status: 404 });
  }

  return NextResponse.json(
    {
      success: true,
      data: result.data,
    },
    { status: 200 }
  );
}
