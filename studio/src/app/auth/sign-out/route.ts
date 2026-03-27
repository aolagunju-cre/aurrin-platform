import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies, sanitizeNextPath } from '@/src/lib/auth/request-auth';

function createSignOutResponse(request: NextRequest, status = 307): NextResponse {
  const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get('next') ?? '/auth/sign-in');
  const response = NextResponse.redirect(new URL(nextPath, request.url), status);
  clearAuthCookies(response);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return createSignOutResponse(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return createSignOutResponse(request, 303);
}
