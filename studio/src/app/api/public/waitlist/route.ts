import { NextRequest, NextResponse } from 'next/server';
import { upsertPlatformWaitlistSignup } from '../../../../lib/waitlist/db';

interface WaitlistPayload {
  firstName?: unknown;
  lastName?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  email?: unknown;
  phone?: unknown;
  source?: unknown;
  metadata?: unknown;
}

interface WaitlistValidationErrors {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
}

function optionalTextField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: WaitlistPayload;

  try {
    body = await request.json() as WaitlistPayload;
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid request: expected application/json' },
      { status: 400 }
    );
  }

  const firstName = optionalTextField(body.firstName ?? body.first_name);
  const lastName = optionalTextField(body.lastName ?? body.last_name);
  const email = optionalTextField(body.email).toLowerCase();
  const phone = optionalTextField(body.phone);
  const source = optionalTextField(body.source) || 'public-waitlist';
  const metadata = isRecord(body.metadata) ? body.metadata : {};

  const errors: WaitlistValidationErrors = {};

  if (!firstName) errors.first_name = 'First name is required';
  if (!lastName) errors.last_name = 'Last name is required';
  if (!email) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(email)) {
    errors.email = 'Email format is invalid';
  }

  if (!phone) {
    errors.phone = 'Phone number is required';
  } else if (!isValidPhone(phone)) {
    errors.phone = 'Phone number format is invalid';
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { success: false, message: 'Validation failed', errors },
      { status: 400 }
    );
  }

  const saveResult = await upsertPlatformWaitlistSignup({
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    source,
    metadata,
  });

  if (saveResult.error || !saveResult.data) {
    return NextResponse.json(
      { success: false, message: 'Could not save waitlist signup' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Waitlist submitted',
    data: {
      id: saveResult.data.id,
    },
  });
}
